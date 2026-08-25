// Persistent "paint wash" background layer. Per the user's ask: hits and
// flipper motion should visibly bleed color into the background, spread
// wider, and slowly dissolve - and mix with each other into an oil-slick /
// gasoline-film sheen where colors overlap, instead of a flash that just
// vanishes once its timer ends.
//
// Implementation: an offscreen canvas that's NEVER hard-cleared. Splats are
// painted onto it at the moment of each event (spawnBgFx, called once per
// fixed sim step so no event is missed - same reasoning as fx.ts/sound
// draining) using 'lighter' (additive) compositing instead of the default
// alpha blend, so two different-colored splats overlapping brighten and
// shift hue together rather than one just covering the other - the cheap
// trick behind the "colors mixing like a thin oil film" look.
//
// Once per rendered frame (fadeBgFx, using real elapsed time so the rate
// doesn't depend on how many fixed steps ran that frame) two things happen:
// (1) the whole canvas is blurred a little into a scratch canvas and copied
// back, so existing paint visibly spreads/diffuses wider each frame instead
// of sitting frozen as a static blob; (2) its alpha is nudged down via
// 'destination-out', which erases proportional to existing alpha - a cheap,
// code-free "dissolve toward transparent" you can't get from a plain
// translucent-black overlay (that darkens instead of clearing, see main.ts's
// header comment on why the *ball* trail avoids it).
import { BGFX_FADE_PER_SEC, BGFX_FLIPPER_ALPHA, BGFX_FLIPPER_RADIUS, BGFX_HIT_ALPHA, BGFX_HIT_RADIUS, BGFX_SPREAD_PX, CANVAS_H, FIELD_H, FIELD_W, HUD_HEIGHT } from './constants';
import { BUMPER_COLOR } from './render';
import { ORANGE, RED, VIOLET, WHITE, YELLOW, withAlpha } from './palette';
import type { World } from './types';

export interface BgFxState {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  // Scratch buffer used only as a blur destination - drawImage-with-filter
  // can't safely read and write the same canvas, so the blur pass renders
  // here first, then gets copied back onto `canvas`.
  scratch: HTMLCanvasElement;
  scratchCtx: CanvasRenderingContext2D;
  // Previous-tick cooldowns, used to detect the exact tick a bumper/pad
  // fires (rising edge 0 -> cooldown) without needing sim.ts to push a
  // dedicated fx event for them.
  lastBumperCd: number[];
  lastPadCd: number[];
}

const HIT_COLOR: Record<'boss' | 'shield' | 'base' | 'win' | 'lose', string> = {
  boss: RED,
  shield: BUMPER_COLOR.energy,
  base: ORANGE,
  win: YELLOW,
  lose: RED,
};

export function createBgFx(): BgFxState {
  const canvas = document.createElement('canvas');
  canvas.width = FIELD_W;
  canvas.height = FIELD_H;
  const scratch = document.createElement('canvas');
  scratch.width = FIELD_W;
  scratch.height = FIELD_H;
  return {
    canvas,
    ctx: canvas.getContext('2d')!,
    scratch,
    scratchCtx: scratch.getContext('2d')!,
    lastBumperCd: [],
    lastPadCd: [],
  };
}

function splat(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, r: number, alpha: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, withAlpha(color, alpha));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Called once per fixed sim step - reads this tick's world.fx events plus
 * bumper/pad cooldown edges plus active flippers, and paints their splats. */
export function spawnBgFx(state: BgFxState, world: World): void {
  const { ctx } = state;
  // Additive blending: two overlapping splats of different colors brighten
  // and shift hue together instead of one alpha-covering the other - see
  // the header comment for why this reads as color "mixing" like a thin
  // film, rather than colors simply staining over each other.
  ctx.globalCompositeOperation = 'lighter';

  for (const ev of world.fx) {
    splat(ctx, ev.x, ev.y, HIT_COLOR[ev.kind], BGFX_HIT_RADIUS * (ev.big ? 1.6 : 1), BGFX_HIT_ALPHA);
  }

  world.bumpers.forEach((b, i) => {
    if ((state.lastBumperCd[i] ?? 0) <= 0 && b.cooldown > 0) {
      splat(ctx, b.x, b.y, BUMPER_COLOR[b.kind], BGFX_HIT_RADIUS, BGFX_HIT_ALPHA);
    }
    state.lastBumperCd[i] = b.cooldown;
  });

  world.launchPads.forEach((p, i) => {
    if ((state.lastPadCd[i] ?? 0) <= 0 && p.cooldown > 0) {
      splat(ctx, p.x, p.y, YELLOW, BGFX_HIT_RADIUS, BGFX_HIT_ALPHA);
    }
    state.lastPadCd[i] = p.cooldown;
  });

  for (const f of world.flippers) {
    if (!f.active) continue;
    const tipX = f.pivot.x + Math.cos(f.angle) * f.length;
    const tipY = f.pivot.y + Math.sin(f.angle) * f.length;
    splat(ctx, tipX, tipY, VIOLET, BGFX_FLIPPER_RADIUS, BGFX_FLIPPER_ALPHA);
  }

  ctx.globalCompositeOperation = 'source-over';
}

/** Called once per rendered frame with the real (unclamped-by-fixed-step)
 * elapsed time: spreads the existing wash a little wider via blur, then
 * dissolves it a little via alpha erase, so the constant real-world rate
 * governs both the spread and the fade regardless of fixed-step count. */
export function fadeBgFx(state: BgFxState, dt: number): void {
  const { ctx, canvas, scratch, scratchCtx } = state;

  // Spread: blur can't safely read+write the same canvas, so bounce through
  // the scratch canvas and copy the result back - a few frames of this tiny
  // blur compound into an organic "paint bleeding wider over time" look
  // instead of a static blob that just dims in place.
  scratchCtx.clearRect(0, 0, FIELD_W, FIELD_H);
  scratchCtx.filter = `blur(${BGFX_SPREAD_PX}px)`;
  scratchCtx.drawImage(canvas, 0, 0);
  scratchCtx.filter = 'none';
  ctx.clearRect(0, 0, FIELD_W, FIELD_H);
  ctx.drawImage(scratch, 0, 0);

  // Dissolve: erase alpha proportionally so the (now slightly wider) wash
  // actually fades to nothing instead of only ever spreading.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = withAlpha(WHITE, Math.min(1, BGFX_FADE_PER_SEC * dt));
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  ctx.globalCompositeOperation = 'source-over';
}

/** Draws the wash under the crisp gameplay layer - call right after the
 * opaque background clear, before trails/render/fx. */
export function drawBgFx(ctx: CanvasRenderingContext2D, state: BgFxState): void {
  ctx.drawImage(state.canvas, 0, HUD_HEIGHT);
}
