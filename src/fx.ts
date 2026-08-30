// Visual-only feedback: hit-flash, screen shake, floating damage numbers.
// Reads World.fx (see types.ts's FxEvent) each tick and turns those
// point-of-cause tags into transient render state, exactly like main.ts's
// ball-trail Map already does for its own cosmetic effect - this state is
// deliberately NOT part of World: it's ephemeral/non-deterministic-looking
// render dressing, not simulation state a test would ever need to assert on.
import {
  FX_BURST_DURATION,
  FX_FLASH_DURATION,
  FX_FLOATER_LIFE,
  FX_FLOATER_RISE,
  FX_SHAKE_BOSS,
  FX_SHAKE_DECAY,
  FX_SHAKE_LOSE,
  FX_SHAKE_WIN,
  HUD_HEIGHT,
} from './constants';
import { CYAN, LIME, ORANGE, RED, WHITE, YELLOW, withGlow } from './palette';
import type { FxEvent, World } from './types';

interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  age: number;
}

interface Burst {
  x: number;
  y: number;
  color: string;
  age: number;
  shards: { angle: number; speed: number; size: number }[];
}

export interface FxState {
  shake: number; // current screen-shake magnitude in px, decays toward 0
  floaters: Floater[];
  bursts: Burst[];
  flashes: Map<FxEvent['kind'], number>; // remaining seconds per flash, keyed by hit location
}

export function createFxState(): FxState {
  return { shake: 0, floaters: [], bursts: [], flashes: new Map() };
}

const FLOATER_COLOR: Record<FxEvent['kind'], string> = {
  boss: RED,
  armor: CYAN,
  hostileBurst: ORANGE,
  echoBurst: CYAN,
  win: YELLOW,
  lose: RED,
};

const SHAKE_FOR: Record<FxEvent['kind'], number> = {
  boss: FX_SHAKE_BOSS,
  armor: FX_SHAKE_BOSS,
  hostileBurst: 2,
  echoBurst: 2,
  win: FX_SHAKE_WIN,
  lose: FX_SHAKE_LOSE,
};

/** Consumes this tick's world.fx events into fx state, and ages/decays
 * everything already in flight (shake magnitude, flash timers, floaters). */
export function updateFx(fx: FxState, world: World, dt: number): void {
  for (const ev of world.fx) {
    if (!ev.heal) fx.shake = Math.max(fx.shake, SHAKE_FOR[ev.kind]);
    if (ev.kind === 'hostileBurst' || ev.kind === 'echoBurst' || ev.kind === 'win') {
      const color = ev.kind === 'hostileBurst' ? ORANGE : ev.kind === 'echoBurst' ? CYAN : YELLOW;
      const count = ev.kind === 'win' ? 20 : 10;
      fx.bursts.push({
        x: ev.x,
        y: ev.y,
        color,
        age: 0,
        shards: Array.from({ length: count }, (_, i) => ({
          angle: i / count * Math.PI * 2 + Math.random() * 0.35,
          speed: 28 + Math.random() * (ev.kind === 'win' ? 100 : 45),
          size: 1.5 + Math.random() * (ev.kind === 'win' ? 5 : 2.5),
        })),
      });
    }
    else if (!ev.heal && ev.kind !== 'lose') fx.flashes.set(ev.kind, FX_FLASH_DURATION);
    if (ev.amount !== undefined) {
      const amount = Math.round(ev.amount);
      fx.floaters.push({ x: ev.x, y: ev.y, text: ev.heal ? `+${amount}` : ev.critical ? `CRIT ${amount}` : String(amount), color: ev.heal ? LIME : ev.critical ? YELLOW : FLOATER_COLOR[ev.kind], size: Math.min(24, 10 + Math.sqrt(amount)), age: 0 });
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
  fx.bursts = fx.bursts.filter((burst) => {
    burst.age += dt;
    return burst.age < FX_BURST_DURATION;
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

  for (const burst of fx.bursts) {
    const t = burst.age / FX_BURST_DURATION;
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = burst.color;
    ctx.lineWidth = 3 * (1 - t);
    ctx.beginPath();
    ctx.arc(burst.x, burst.y, 5 + t * 25, 0, Math.PI * 2);
    ctx.stroke();
    withGlow(ctx, burst.color, 8, () => {
      ctx.fillStyle = burst.color;
      for (const shard of burst.shards) {
        const distance = shard.speed * burst.age;
        const x = burst.x + Math.cos(shard.angle) * distance;
        const y = burst.y + Math.sin(shard.angle) * distance + 22 * burst.age * burst.age;
        ctx.fillRect(x - shard.size / 2, y - shard.size / 2, shard.size, shard.size);
      }
    });
  }

  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  for (const f of fx.floaters) {
    const t = f.age / FX_FLOATER_LIFE;
    ctx.globalAlpha = 1 - t;
    withGlow(ctx, f.color, 6, () => {
      ctx.fillStyle = f.color;
      ctx.font = `bold ${f.size}px monospace`;
      ctx.fillText(f.text, f.x, f.y - t * FX_FLOATER_RISE);
    });
  }
  ctx.globalAlpha = 1;

  ctx.restore();
}
