// Visual-only feedback: hit-flash, screen shake, floating damage numbers.
// Reads World.fx (see types.ts's FxEvent) each tick and turns those
// point-of-cause tags into transient render state, exactly like main.ts's
// ball-trail Map already does for its own cosmetic effect - this state is
// deliberately NOT part of World: it's ephemeral/non-deterministic-looking
// render dressing, not simulation state a test would ever need to assert on.
import {
  FX_FLASH_DURATION,
  FX_FLOATER_LIFE,
  FX_FLOATER_RISE,
  FX_SHAKE_BOSS,
  FX_SHAKE_DECAY,
  FX_SHAKE_LOSE,
  FX_SHAKE_WIN,
  HUD_HEIGHT,
} from './constants';
import { CYAN, RED, WHITE, YELLOW, withGlow } from './palette';
import type { FxEvent, World } from './types';

interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  age: number;
}

interface Pop {
  x: number;
  y: number;
  age: number;
}

export interface FxState {
  shake: number; // current screen-shake magnitude in px, decays toward 0
  floaters: Floater[];
  pops: Pop[];
  flashes: Map<FxEvent['kind'], number>; // remaining seconds per flash, keyed by hit location
}

export function createFxState(): FxState {
  return { shake: 0, floaters: [], pops: [], flashes: new Map() };
}

const FLOATER_COLOR: Record<FxEvent['kind'], string> = {
  boss: RED,
  armor: CYAN,
  echo: CYAN,
  win: YELLOW,
  lose: RED,
};

const SHAKE_FOR: Record<FxEvent['kind'], number> = {
  boss: FX_SHAKE_BOSS,
  armor: FX_SHAKE_BOSS,
  echo: 1,
  win: FX_SHAKE_WIN,
  lose: FX_SHAKE_LOSE,
};

/** Consumes this tick's world.fx events into fx state, and ages/decays
 * everything already in flight (shake magnitude, flash timers, floaters). */
export function updateFx(fx: FxState, world: World, dt: number): void {
  for (const ev of world.fx) {
    fx.shake = Math.max(fx.shake, SHAKE_FOR[ev.kind]);
    if (ev.kind === 'echo') fx.pops.push({ x: ev.x, y: ev.y, age: 0 });
    else if (ev.kind !== 'win' && ev.kind !== 'lose') fx.flashes.set(ev.kind, FX_FLASH_DURATION);
    if (ev.amount !== undefined) {
      fx.floaters.push({ x: ev.x, y: ev.y, text: String(ev.amount), color: FLOATER_COLOR[ev.kind], age: 0 });
    }
  }

  fx.shake = Math.max(0, fx.shake - FX_SHAKE_DECAY * dt);

  for (const [kind, remaining] of fx.flashes) {
    const next = remaining - dt;
    if (next <= 0) fx.flashes.delete(kind);
    else fx.flashes.set(kind, next);
  }

  fx.floaters = fx.floaters.filter((f) => {
    f.age += dt;
    return f.age < FX_FLOATER_LIFE;
  });
  fx.pops = fx.pops.filter((pop) => {
    pop.age += dt;
    return pop.age < FX_FLASH_DURATION;
  });
}

/** A small pixel offset to translate the canvas by this frame - apply
 * around the trail/render/fx drawing (not the opaque background clear) for
 * a classic screen-shake feel. Not random-seeded/deterministic on purpose:
 * this is pure presentation, never read back by sim.ts or asserted by tests. */
export function shakeOffset(fx: FxState): { x: number; y: number } {
  if (fx.shake <= 0) return { x: 0, y: 0 };
  const angle = Math.random() * Math.PI * 2;
  return { x: Math.cos(angle) * fx.shake, y: Math.sin(angle) * fx.shake };
}

/** Draws hit-flashes and floating damage numbers in the same
 * HUD_HEIGHT-translated playfield space as render()'s own draw calls. */
export function drawFx(ctx: CanvasRenderingContext2D, fx: FxState, world: World): void {
  ctx.save();
  ctx.translate(0, HUD_HEIGHT);

  const bossFlash = fx.flashes.get('boss');
  if (bossFlash) {
    ctx.globalAlpha = bossFlash / FX_FLASH_DURATION;
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(world.boss.x, world.boss.y, world.boss.r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const pop of fx.pops) {
    const t = pop.age / FX_FLASH_DURATION;
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 3 * (1 - t);
    ctx.beginPath();
    ctx.arc(pop.x, pop.y, 5 + t * 18, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  for (const f of fx.floaters) {
    const t = f.age / FX_FLOATER_LIFE;
    ctx.globalAlpha = 1 - t;
    withGlow(ctx, f.color, 6, () => {
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y - t * FX_FLOATER_RISE);
    });
  }
  ctx.globalAlpha = 1;

  ctx.restore();
}
