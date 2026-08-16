// Small, dependency-free 2D collision helpers used by sim.ts. Everything
// operates on plain Ball-like objects ({x,y,vx,vy,r}) and mutates them in
// place — this is a js13k game, not a general-purpose physics library.
import { DRAIN_X0, DRAIN_X1, FIELD_H, FIELD_W, GRAVITY, MAX_SPEED, WALL_RESTITUTION } from './constants';
import type { Flipper, Vec2 } from './types';

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
 * Resolve collisions with the field boundary. Left/right/top always hold the
 * ball. The bottom has two thresholds: `apronY` is the raised, compact play
 * area boundary (where the ball bounces off the solid apron next to the
 * flippers), while `drainY` is the true bottom of the field. A ball that
 * falls through the drain gap keeps falling (visibly, under gravity) from
 * apronY down to drainY before it's actually removed - so it reads as
 * rolling off the bottom of the screen instead of vanishing mid-field the
 * instant it passes the raised apron.
 */
export function resolveWalls(m: Movable, width = FIELD_W, apronY = FIELD_H, drainY = apronY): WallResult {
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
  } else if (m.y - m.r > apronY) {
    const inDrain = m.x > DRAIN_X0 && m.x < DRAIN_X1;
    if (inDrain) {
      // Falling through the gap: only actually remove the ball once it
      // reaches the true bottom of the field.
      if (m.y - m.r > drainY) return 'drained';
      return 'none';
    }
    // Outside the drain gap: treat like a wall so the ball doesn't vanish
    // through the solid apron next to the flippers.
    m.y = apronY - m.r;
    m.vy = -Math.abs(m.vy) * WALL_RESTITUTION;
    result = 'bounced';
  }

  return result;
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
  const abx = tip.x - f.pivot.x;
  const aby = tip.y - f.pivot.y;
  const apx = m.x - f.pivot.x;
  const apy = m.y - f.pivot.y;
  const abLenSq = abx * abx + aby * aby || 0.0001;
  let t = (apx * abx + apy * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  const closestX = f.pivot.x + abx * t;
  const closestY = f.pivot.y + aby * t;
  const dx = m.x - closestX;
  const dy = m.y - closestY;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const minDist = m.r + thickness;
  if (dist >= minDist) return false;

  const nx = dx / dist;
  const ny = dy / dist;
  m.x = closestX + nx * minDist;
  m.y = closestY + ny * minDist;

  if (f.active) {
    // Strong, readable boost roughly along the flipper normal (up and outward).
    m.vx = nx * boostSpeed;
    m.vy = ny * boostSpeed - boostSpeed * 0.3;
  } else {
    // Passive bounce: reflect velocity about the normal with some damping.
    const dot = m.vx * nx + m.vy * ny;
    m.vx = (m.vx - 2 * dot * nx) * WALL_RESTITUTION;
    m.vy = (m.vy - 2 * dot * ny) * WALL_RESTITUTION;
  }
  return true;
}
