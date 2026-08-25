// "Paint wash" particle system. Per the user's follow-up: splats should
// appear on contact with ANYTHING (not just bumpers/pads/flipper-tip), in
// varied colors, then drift off on their own randomly (sideways sway +
// slow up-or-down float) and fade - not sit painted on a fixed spot.
//
// Contact is detected generically as a sudden ball velocity-DIRECTION
// change: gravity alone only ever curves a ball's path smoothly, so any
// sharp swing in velocity angle in a single tick means it just bounced off
// something - a peg, wall, bumper, or flipper - without sim.ts needing to
// name every kind of collision. The splat's color is the ball's own current
// rendered color (see render.ts's ballColor - already varies per ball tier
// and cycles for a fully-charged rainbow ball), so different balls/contacts
// naturally paint different colors.
//
// Each splat is a standalone particle (not painted onto a persistent
// bitmap): a bitmap can only ever erode/blur in place, it can't actually
// slide sideways or float upward, so there's nothing to gain from a
// separate offscreen canvas here - just track {position, age, life} per
// splat and draw each one at its own live-computed position every frame.
// Overlapping splats are drawn with additive ('lighter') compositing so
// their colors mix/brighten together instead of one flatly covering
// another - the cheap trick behind an oil-film/gasoline-sheen look.
import {
  BGFX_CONTACT_ANGLE,
  BGFX_DRIFT_SPEED,
  BGFX_GROWTH_PER_SEC,
  BGFX_HIT_ALPHA,
  BGFX_HIT_RADIUS,
  BGFX_LIFE,
  BGFX_MIN_SPEED,
  BGFX_SWAY_AMP,
  BGFX_SWAY_FREQ,
  HUD_HEIGHT,
} from './constants';
import { ballColor } from './render';
import { CYAN, ORANGE, RED, YELLOW, withAlpha } from './palette';
import type { World } from './types';

interface Splat {
  baseX: number;
  baseY: number;
  color: string;
  radius: number;
  age: number;
  life: number;
  driftY: number; // px/s, signed - direction (+down/-up) picked randomly at spawn
  swayAmp: number;
  swayFreq: number;
  swayPhase: number;
  peakAlpha: number;
}

export interface BgFxState {
  splats: Splat[];
  // Previous tick's velocity per ball id, so a sudden direction change (a
  // bounce off anything) can be detected without sim.ts naming the cause.
  lastVel: Map<number, { vx: number; vy: number }>;
}

const HIT_COLOR: Record<'boss' | 'shield' | 'base' | 'win' | 'lose', string> = {
  boss: RED,
  shield: CYAN,
  base: ORANGE,
  win: YELLOW,
  lose: RED,
};

export function createBgFx(): BgFxState {
  return { splats: [], lastVel: new Map() };
}

function spawnSplat(state: BgFxState, x: number, y: number, color: string, radius: number, alpha: number): void {
  const driftSign = Math.random() < 0.5 ? -1 : 1;
  state.splats.push({
    baseX: x,
    baseY: y,
    color,
    radius,
    age: 0,
    life: BGFX_LIFE * (0.7 + Math.random() * 0.6),
    driftY: driftSign * BGFX_DRIFT_SPEED * (0.5 + Math.random()),
    swayAmp: BGFX_SWAY_AMP * (0.5 + Math.random()),
    swayFreq: BGFX_SWAY_FREQ * (0.6 + Math.random() * 0.8),
    swayPhase: Math.random() * Math.PI * 2,
    peakAlpha: alpha,
  });
}

/** Called once per fixed sim step - reads this tick's world.fx events (big
 * game-state moments) plus every ball's velocity for a generic "just
 * bounced off something" edge, and spawns a splat for each. */
export function spawnBgFx(state: BgFxState, world: World): void {
  const liveIds = new Set(world.balls.map((b) => b.id));
  for (const id of state.lastVel.keys()) if (!liveIds.has(id)) state.lastVel.delete(id);

  for (const ev of world.fx) {
    spawnSplat(state, ev.x, ev.y, HIT_COLOR[ev.kind], BGFX_HIT_RADIUS * (ev.big ? 1.6 : 1), BGFX_HIT_ALPHA);
  }

  for (const b of world.balls) {
    const prev = state.lastVel.get(b.id);
    if (prev) {
      const speed = Math.hypot(b.vx, b.vy);
      const prevSpeed = Math.hypot(prev.vx, prev.vy);
      if (speed > BGFX_MIN_SPEED && prevSpeed > BGFX_MIN_SPEED) {
        const dot = (prev.vx * b.vx + prev.vy * b.vy) / (prevSpeed * speed);
        const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
        if (angle > BGFX_CONTACT_ANGLE) {
          spawnSplat(state, b.x, b.y, ballColor(b.color, world.time), BGFX_HIT_RADIUS, BGFX_HIT_ALPHA);
        }
      }
    }
    state.lastVel.set(b.id, { vx: b.vx, vy: b.vy });
  }
}

/** Called once per rendered frame with the real elapsed time: ages every
 * splat (advancing its sway/drift/growth/fade) and drops any whose life is
 * over - independent of how many fixed steps ran this frame. */
export function updateBgFx(state: BgFxState, dt: number): void {
  for (const s of state.splats) s.age += dt;
  state.splats = state.splats.filter((s) => s.age < s.life);
}

/** Draws every live splat at its own current drifted/grown/faded position -
 * additive blending so overlapping colors mix into a bright sheen instead
 * of one covering another. Call inside the same shake-translated block as
 * the rest of the playfield so the wash shakes along with a hit, like the
 * trail/render/fx layers. */
export function drawBgFx(ctx: CanvasRenderingContext2D, state: BgFxState): void {
  ctx.save();
  ctx.translate(0, HUD_HEIGHT);
  ctx.globalCompositeOperation = 'lighter';
  for (const s of state.splats) {
    const t = s.age / s.life;
    const x = s.baseX + Math.sin(s.age * s.swayFreq + s.swayPhase) * s.swayAmp;
    const y = s.baseY + s.driftY * s.age;
    const r = s.radius * (1 + BGFX_GROWTH_PER_SEC * s.age);
    const alpha = s.peakAlpha * (1 - t);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, withAlpha(s.color, alpha));
    g.addColorStop(1, withAlpha(s.color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

