// Visual-only feedback: hit-flash, screen shake, floating damage numbers.
// Reads World.fx (see types.ts's FxEvent) each tick and turns those
// point-of-cause tags into transient render state, exactly like main.ts's
// ball-trail Map already does for its own cosmetic effect - this state is
// deliberately NOT part of World: it's ephemeral/non-deterministic-looking
// render dressing, not simulation state a test would ever need to assert on.
import {
  FIELD_W,
  FX_FLASH_DURATION,
  FX_FLOATER_LIFE,
  FX_FLOATER_RISE,
  FX_SHAKE_BASE,
  FX_SHAKE_BIG,
  FX_SHAKE_BOSS,
  FX_SHAKE_DECAY,
  FX_SHAKE_LOSE,
  FX_SHAKE_SHIELD,
  FX_SHAKE_WIN,
  HUD_HEIGHT,
} from './constants';
import { LEVEL } from './level';
import type { FxEvent, World } from './types';

interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  age: number;
}

export interface FxState {
  shake: number; // current screen-shake magnitude in px, decays toward 0
  floaters: Floater[];
  flashes: Map<FxEvent['kind'], number>; // remaining seconds per flash, keyed by hit location
}

export function createFxState(): FxState {
  return { shake: 0, floaters: [], flashes: new Map() };
}

const FLOATER_COLOR: Record<FxEvent['kind'], string> = {
  boss: '#ff3b6b',
  shield: '#38d6ff',
  base: '#ff8a3b',
  win: '#ffe93b',
  lose: '#ff3b6b',
};

const SHAKE_FOR: Record<FxEvent['kind'], number> = {
  boss: FX_SHAKE_BOSS,
  shield: FX_SHAKE_SHIELD,
  base: FX_SHAKE_BASE,
  win: FX_SHAKE_WIN,
  lose: FX_SHAKE_LOSE,
};

/** Consumes this tick's world.fx events into fx state, and ages/decays
 * everything already in flight (shake magnitude, flash timers, floaters). */
export function updateFx(fx: FxState, world: World, dt: number): void {
  for (const ev of world.fx) {
    fx.shake = Math.max(fx.shake, ev.big ? FX_SHAKE_BIG : SHAKE_FOR[ev.kind]);
    if (ev.kind !== 'win' && ev.kind !== 'lose') fx.flashes.set(ev.kind, FX_FLASH_DURATION);
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

/** Draws hit-flashes and floating damage numbers. Called in the same
 * HUD_HEIGHT-translated playfield space as render()'s own draw calls, so
 * world coordinates (boss.x/y, projectile x/y at the moment of impact,
 * LEVEL.shield.y/base.y) line up without any extra conversion. */
export function drawFx(ctx: CanvasRenderingContext2D, fx: FxState, world: World): void {
  ctx.save();
  ctx.translate(0, HUD_HEIGHT);

  const bossFlash = fx.flashes.get('boss');
  if (bossFlash) {
    ctx.globalAlpha = bossFlash / FX_FLASH_DURATION;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(world.boss.x, world.boss.y, world.boss.r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  const shieldFlash = fx.flashes.get('shield');
  if (shieldFlash) {
    ctx.globalAlpha = shieldFlash / FX_FLASH_DURATION;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, LEVEL.shield.y);
    ctx.lineTo(FIELD_W, LEVEL.shield.y);
    ctx.stroke();
  }

  const baseFlash = fx.flashes.get('base');
  if (baseFlash) {
    ctx.globalAlpha = baseFlash / FX_FLASH_DURATION;
    ctx.fillStyle = '#ff8a3b';
    ctx.fillRect(0, LEVEL.base.y - 4, FIELD_W, 8);
  }

  ctx.globalAlpha = 1;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  for (const f of fx.floaters) {
    const t = f.age / FX_FLOATER_LIFE;
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y - t * FX_FLOATER_RISE);
  }
  ctx.globalAlpha = 1;

  ctx.restore();
}
