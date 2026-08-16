// Small, dependency-free 2D collision helpers used by sim.ts. Everything
// operates on plain Ball-like objects ({x,y,vx,vy,r}) and mutates them in
// place — this is a js13k game, not a general-purpose physics library.
import { FIELD_H, FIELD_W, GRAVITY, MAX_SPEED, WALL_RESTITUTION } from './constants';
import type { Flipper, LaunchPad, Vec2, Wall } from './types';

export interface Movable {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

/** Clamp a velocity vector's magnitude to maxSpeed, in place. */
export function clampSpeed(m: Movable, maxSpeed = MAX_SPEED): void {
  const speed = Math.hypot(m.vx, m.vy);
  if (speed > maxSpeed) {
    const scale = maxSpeed / speed;
    m.vx *= scale;
    m.vy *= scale;
  }
}

/** Apply gravity and integrate position for one tick, in place. */
export function integrate(m: Movable, dt: number, gravity: Vec2 = { x: 0, y: GRAVITY }): void {
  m.vx += gravity.x * dt;
  m.vy += gravity.y * dt;
  clampSpeed(m);
  m.x += m.vx * dt;
  m.y += m.vy * dt;
}

export type WallResult = 'none' | 'bounced' | 'drained';

/**
 * Resolve collisions with the implicit field boundary (left/right/top of the
 * canvas). There is no bottom wall here at all - the table's actual floor is
 * built out of level.ts's `walls` polylines (see resolveWallSegment/
 * resolveWall below). Wherever those polylines have a gap is a drain: a ball
 * simply keeps falling under gravity through any gap until it passes the
 * true bottom of the field, at which point it's removed.
 */
export function resolveWalls(m: Movable, width = FIELD_W, height = FIELD_H): WallResult {
  let result: WallResult = 'none';

  if (m.x - m.r < 0) {
    m.x = m.r;
    m.vx = Math.abs(m.vx) * WALL_RESTITUTION;
    result = 'bounced';
  } else if (m.x + m.r > width) {
    m.x = width - m.r;
    m.vx = -Math.abs(m.vx) * WALL_RESTITUTION;
    result = 'bounced';
  }

  if (m.y - m.r < 0) {
    m.y = m.r;
    m.vy = Math.abs(m.vy) * WALL_RESTITUTION;
    result = 'bounced';
  } else if (m.y - m.r > height) {
    return 'drained';
  }

  return result;
}

/** Nearest point on segment a->b to point p, plus the distance from p to it. */
function closestPointOnSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLenSq = abx * abx + aby * aby || 0.0001;
  let t = (apx * abx + apy * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  const x = ax + abx * t;
  const y = ay + aby * t;
  const dx = px - x;
  const dy = py - y;
  const dist = Math.hypot(dx, dy) || 0.0001;
  return { x, y, dist, nx: dx / dist, ny: dy / dist };
}

/**
 * Ball-vs-static-segment collision (one segment of a Wall polyline). Purely
 * passive: reflects velocity about the segment normal with some damping,
 * like bouncing off a solid edge. Returns true if a collision was resolved.
 */
export function resolveWallSegment(
  m: Movable,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  thickness: number,
): boolean {
  const c = closestPointOnSegment(m.x, m.y, ax, ay, bx, by);
  const minDist = m.r + thickness;
  if (c.dist >= minDist) return false;

  m.x = c.x + c.nx * minDist;
  m.y = c.y + c.ny * minDist;
  const dot = m.vx * c.nx + m.vy * c.ny;
  m.vx = (m.vx - 2 * dot * c.nx) * WALL_RESTITUTION;
  m.vy = (m.vy - 2 * dot * c.ny) * WALL_RESTITUTION;
  return true;
}

/** Resolve collision against every segment of a Wall polyline (open, not auto-closed). */
export function resolveWall(m: Movable, wall: Wall, thickness: number): boolean {
  let hit = false;
  for (let i = 0; i < wall.length - 1; i++) {
    const a = wall[i];
    const b = wall[i + 1];
    if (resolveWallSegment(m, a.x, a.y, b.x, b.y, thickness)) hit = true;
  }
  return hit;
}

/**
 * Circle-vs-circle bumper collision. If overlapping, pushes `m` away from
 * the bumper center at `impulseSpeed` and returns true.
 */
export function resolveBumper(
  m: Movable,
  bumper: { x: number; y: number; r: number },
  impulseSpeed: number,
): boolean {
  const dx = m.x - bumper.x;
  const dy = m.y - bumper.y;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const minDist = m.r + bumper.r;
  if (dist >= minDist) return false;

  const nx = dx / dist;
  const ny = dy / dist;
  m.x = bumper.x + nx * minDist;
  m.y = bumper.y + ny * minDist;
  m.vx = nx * impulseSpeed;
  m.vy = ny * impulseSpeed;
  return true;
}

/**
 * Directional one-shot boost pad. If the ball is within `triggerR` of the
 * pad center, its velocity is set along `pad.angle` at `boostSpeed`
 * (unlike a bumper, this doesn't reflect - it always fires the same way).
 */
export function resolveLaunchPad(
  m: Movable,
  pad: LaunchPad,
  triggerR: number,
  boostSpeed: number,
): boolean {
  const dx = m.x - pad.x;
  const dy = m.y - pad.y;
  const dist = Math.hypot(dx, dy);
  if (dist >= m.r + triggerR) return false;

  m.vx = Math.cos(pad.angle) * boostSpeed;
  m.vy = Math.sin(pad.angle) * boostSpeed;
  return true;
}

/** True if a ball overlaps a boss circle (used for ghost/no-bounce damage events). */
export function overlapsCircle(
  m: { x: number; y: number; r: number },
  c: { x: number; y: number; r: number },
): boolean {
  const dx = m.x - c.x;
  const dy = m.y - c.y;
  return dx * dx + dy * dy <= (m.r + c.r) * (m.r + c.r);
}

function flipperTip(f: Flipper): Vec2 {
  // f.angle is already mirrored for the right side by createFlippers()
  // (Math.PI - restAngle), so no extra side-based flip is needed here.
  return {
    x: f.pivot.x + Math.cos(f.angle) * f.length,
    y: f.pivot.y + Math.sin(f.angle) * f.length,
  };
}

/**
 * Ball-vs-flipper collision. The flipper is treated as a thick line segment
 * from its pivot to its tip. On overlap, reflects the ball's velocity off the
 * segment normal and, if the flipper is actively swinging, adds a boost.
 */
export function resolveFlipper(m: Movable, f: Flipper, boostSpeed: number, thickness: number): boolean {
  const tip = flipperTip(f);
  const c = closestPointOnSegment(m.x, m.y, f.pivot.x, f.pivot.y, tip.x, tip.y);
  const minDist = m.r + thickness;
  if (c.dist >= minDist) return false;

  m.x = c.x + c.nx * minDist;
  m.y = c.y + c.ny * minDist;

  if (f.active) {
    // Strong, readable boost roughly along the flipper normal (up and outward).
    m.vx = c.nx * boostSpeed;
    m.vy = c.ny * boostSpeed - boostSpeed * 0.3;
  } else {
    // Passive bounce: reflect velocity about the normal with some damping.
    const dot = m.vx * c.nx + m.vy * c.ny;
    m.vx = (m.vx - 2 * dot * c.nx) * WALL_RESTITUTION;
    m.vy = (m.vy - 2 * dot * c.ny) * WALL_RESTITUTION;
  }
  return true;
}
