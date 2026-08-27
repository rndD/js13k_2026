// "Paint wash" particle system. Per the user's follow-ups: splats should
// appear on contact with ANYTHING (not just bumpers/pads/flipper-tip), then
// drift off on their own randomly (sideways sway + slow up-or-down float)
// and fade - not sit painted on a fixed spot - and different kinds of
// contact should leave slightly different colors instead of every splat
// looking the same.
//
// Contact is tagged at the exact point-of-cause in sim.ts's updateBalls
// (World.contacts, see types.ts's ContactEvent) - the same pattern already
// used for sfx/fx - rather than guessed afterward, so every kind of thing
// the ball can touch (wall/peg, flipper, paint bumper, energy bumper,
// launch pad) is covered exactly once and gets its own color below,
// matching the color that element already uses elsewhere in the game
// (paint=RED, energy=CYAN, pads=YELLOW, flippers=VIOLET while active).
//
// Each splat is a standalone particle (not painted onto a persistent
// bitmap): a bitmap can only ever erode/blur in place, it can't actually
// slide sideways or float upward, so there's nothing to gain from a
// separate offscreen canvas here - just track {position, age, life} per
// splat and draw each one at its own live-computed position every frame.
// Overlapping splats are drawn with additive ('lighter') compositing so
// their colors mix/brighten together instead of one flatly covering
// another - the cheap trick behind an oil-film/gasoline-sheen look.
//
// A ball currently sitting on top of a splat also carves a soft BG-colored
// "hole" through it (see BGFX_CUT_* / drawBgFx's final loop) - as if the
// ball is physically parting/cutting the film as it flies through, rather
// than just passing over a static painted layer. This is recomputed fresh
// every frame from the ball's live position (no persistent per-splat
// state), so the gap closes right back up the instant the ball moves on -
// a live "wake" through the film, not a permanent scar.
import {
  BGFX_CUT_ALPHA,
  BGFX_CUT_RADIUS_MULT,
  BGFX_DRIFT_SPEED,
  BGFX_GROWTH_PER_SEC,
  BGFX_HIT_ALPHA,
  BGFX_HIT_RADIUS,
  BGFX_LIFE,
  BGFX_SWAY_AMP,
  BGFX_SWAY_FREQ,
  HUD_HEIGHT,
} from './constants';
import { BG, CYAN, RED, STRUCTURE, VIOLET, YELLOW, withAlpha } from './palette';
import type { ContactEvent, World } from './types';

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
}

const HIT_COLOR: Record<'boss' | 'armor' | 'hostileBurst' | 'echoBurst' | 'win' | 'lose', string> = {
  boss: RED,
  armor: CYAN,
  hostileBurst: RED,
  echoBurst: CYAN,
  win: YELLOW,
  lose: RED,
};

/** One color per ContactEvent.kind, matching how that element is colored
 * everywhere else in the game (paint bumper=RED, energy bumper=CYAN,
 * launch pad=YELLOW, active flipper glow=VIOLET) - plain wall/peg structure
 * gets the neutral pale-grey STRUCTURE tone used for that geometry. */
const CONTACT_COLOR: Record<ContactEvent['kind'], string> = {
  structure: STRUCTURE,
  flipper: VIOLET,
  paint: RED,
  energy: CYAN,
  pad: YELLOW,
  armor: CYAN,
};

export function createBgFx(): BgFxState {
  return { splats: [] };
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

/** Called once per fixed sim step - drains this tick's world.fx events (big
 * game-state moments) and world.contacts events (any ball touching
 * anything), spawning one splat per event, colored per its kind. */
export function spawnBgFx(state: BgFxState, world: World): void {
  for (const ev of world.fx) {
    const burst = ev.kind === 'hostileBurst' || ev.kind === 'echoBurst';
    spawnSplat(
      state,
      ev.x,
      ev.y,
      HIT_COLOR[ev.kind],
      BGFX_HIT_RADIUS * (burst ? 1.6 : 1),
      BGFX_HIT_ALPHA * (burst ? 1.5 : 1),
    );
  }
  for (const c of world.contacts) {
    spawnSplat(state, c.x, c.y, CONTACT_COLOR[c.kind], BGFX_HIT_RADIUS, BGFX_HIT_ALPHA);
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
 * of one covering another - then carves a soft hole under each live ball,
 * as if it's physically parting/cutting the film as it flies through
 * rather than just passing over a static painted layer. Call inside the
 * same shake-translated block as the rest of the playfield so the wash
 * shakes along with a hit, like the trail/render/fx layers. */
export function drawBgFx(ctx: CanvasRenderingContext2D, state: BgFxState, world: World): void {
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

  // Cut a soft hole through whatever's been painted so far wherever a ball
  // currently sits - repaints the plain field BG color there via normal
  // ('source-over') blending, rather than 'destination-out' (which punches
  // real alpha transparency, revealing whatever's behind the <canvas>
  // element in the DOM instead of this game's own BG tone - invisible/wrong
  // on a near-black page background). Drawn once per ball, after all
  // splats, rather than per-splat - this reads as the ball parting the film
  // as it moves through it (the gap closes back up the instant the ball
  // moves on, since splats are fully redrawn from scratch every frame - a
  // live "wake", not a permanent scar).
  ctx.globalCompositeOperation = 'source-over';
  for (const b of world.balls) {
    const cutR = b.r * BGFX_CUT_RADIUS_MULT;
    const cg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, cutR);
    cg.addColorStop(0, withAlpha(BG, BGFX_CUT_ALPHA));
    cg.addColorStop(1, withAlpha(BG, 0));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(b.x, b.y, cutR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

