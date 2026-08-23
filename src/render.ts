// Canvas 2D rendering of a World snapshot. Primitives only, per the art
// direction in dis_doc.md: dark field, bright thin geometry, color reserved
// for charged/energized things. No image assets.
//
// Layout: the top HUD_HEIGHT strip holds the boss/shield/base status bars,
// drawn in untransformed canvas space. Everything else (the actual table) is
// drawn translated down by HUD_HEIGHT, so World's own 0..FIELD_H coordinate
// space is unaffected by the HUD - sim.ts/physics.ts never need to know it exists.
import { AIM_TIMEOUT, BALL_RADIUS, FIELD_H, FIELD_W, HUD_HEIGHT } from './constants';
import { LEVEL } from './level';
import type { Ball, World } from './types';

export const COLOR_HEX: Record<Ball['color'], string> = {
  white: '#e8e8f0',
  red: '#ff3b6b',
  blue: '#38d6ff',
  rainbow: '#ffe93b',
};

const BUMPER_COLOR: Record<'paint' | 'energy', string> = {
  paint: '#ff3b6b',
  energy: '#38d6ff',
};

export function render(ctx: CanvasRenderingContext2D, world: World): void {
  drawHudBar(ctx, world);

  ctx.save();
  ctx.translate(0, HUD_HEIGHT);
  drawFieldBorder(ctx);
  drawWalls(ctx, world);
  drawShieldIndicator(ctx, world);
  drawPegs(ctx, world);
  drawLaunchPads(ctx, world);
  drawLaunchZone(ctx, world);
  drawBoss(ctx, world);
  for (const b of world.bumpers) drawBumper(ctx, b, BUMPER_COLOR[b.kind]);
  drawFlippers(ctx, world);
  drawProjectiles(ctx, world);
  drawBalls(ctx, world);
  drawAimIndicator(ctx, world);
  drawFieldOverlay(ctx, world);
  ctx.restore();
}

function drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, color: string): void {
  ctx.strokeStyle = '#444';
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
}

function drawHudBar(ctx: CanvasRenderingContext2D, world: World): void {
  const { boss, shield, base } = world;
  const pad = 10;
  const w = FIELD_W - pad * 2;
  const barH = 6;

  ctx.fillStyle = '#0a0612';
  ctx.fillRect(0, 0, FIELD_W, HUD_HEIGHT);

  ctx.font = '9px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8888a0';
  ctx.fillText('BOSS', pad, 14);
  drawBar(ctx, pad, 17, w, barH, boss.hp / boss.maxHp, '#ff3b6b');

  ctx.fillStyle = '#8888a0';
  ctx.fillText('SHIELD', pad, 35);
  drawBar(ctx, pad, 38, w * 0.45, barH, shield.energy / shield.maxEnergy, '#38d6ff');

  ctx.fillStyle = '#8888a0';
  ctx.fillText('BASE', pad + w * 0.55, 35);
  drawBar(ctx, pad + w * 0.55, 38, w * 0.45, barH, base.hp / base.maxHp, '#ff8a3b');

  ctx.strokeStyle = '#444';
  ctx.beginPath();
  ctx.moveTo(0, HUD_HEIGHT - 0.5);
  ctx.lineTo(FIELD_W, HUD_HEIGHT - 0.5);
  ctx.stroke();
}

function drawFieldBorder(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = '#8888a0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, FIELD_H);
  ctx.moveTo(FIELD_W, 0);
  ctx.lineTo(FIELD_W, FIELD_H);
  ctx.moveTo(0, 0);
  ctx.lineTo(FIELD_W, 0);
  ctx.stroke();
}

/** Draws every Wall polyline in world.walls (the floor/apron, and anything
 * else placed by the level - see level.ts). Gaps between/within walls are
 * where the ball can fall through (drains). */
function drawWalls(ctx: CanvasRenderingContext2D, world: World): void {
  ctx.strokeStyle = '#8888a0';
  ctx.lineWidth = 3;
  for (const wall of world.walls) {
    ctx.beginPath();
    for (let i = 0; i < wall.length; i++) {
      const p = wall[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
}

/** Thin highlighted line across the floor while the shield is raised, as
 * on-field feedback (the actual shield/base status lives in the HUD bar). */
function drawShieldIndicator(ctx: CanvasRenderingContext2D, world: World): void {
  if (!world.shield.active) return;
  ctx.strokeStyle = 'rgba(56,214,255,0.85)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, LEVEL.shield.y);
  ctx.lineTo(FIELD_W, LEVEL.shield.y);
  ctx.stroke();
}

function drawPegs(ctx: CanvasRenderingContext2D, world: World): void {
  ctx.strokeStyle = '#8888a0';
  ctx.lineWidth = 3;
  for (const p of world.pegs) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** Directional boost pads, drawn as small triangles pointing along their angle. */
function drawLaunchPads(ctx: CanvasRenderingContext2D, world: World): void {
  const size = 12;
  ctx.fillStyle = '#ffe93b';
  for (const pad of world.launchPads) {
    ctx.save();
    ctx.translate(pad.x, pad.y);
    ctx.rotate(pad.angle);
    ctx.globalAlpha = pad.cooldown > 0 ? 0.4 : 1;
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.6, size * 0.6);
    ctx.lineTo(-size * 0.6, -size * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/** Plunger indicator at world.launch: a compressing spring plus a ball
 * outline, so the (otherwise invisible) launch spot reads as "pull/hold
 * here" before the first ball exists. Only relevant during the 'launch'
 * phase - once a real ball is in play it's drawn by drawBalls() instead. */
function drawLaunchZone(ctx: CanvasRenderingContext2D, world: World): void {
  if (world.phase !== 'launch') return;
  const { x, y } = world.launch;
  const power = world.launch.power;

  const springTop = y + BALL_RADIUS + 4;
  const springBottom = FIELD_H - 6;
  const restLen = springBottom - springTop;
  const len = restLen * (1 - power * 0.45); // compresses as it charges
  const coils = 7;
  const coilW = 7;

  ctx.strokeStyle = world.launch.charging ? '#ffe93b' : '#8888a0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, springTop);
  for (let i = 1; i < coils; i++) {
    const t = i / coils;
    ctx.lineTo(x + (i % 2 === 0 ? coilW : -coilW), springTop + len * t);
  }
  ctx.lineTo(x, springTop + len);
  ctx.stroke();

  ctx.strokeStyle = '#e8e8f0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
}

function drawBoss(ctx: CanvasRenderingContext2D, world: World): void {
  const { boss } = world;
  const r = boss.r;

  ctx.strokeStyle = boss.overloadCharging ? '#ffe93b' : '#ff3b6b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(boss.x, boss.y, r, 0, Math.PI * 2);
  ctx.stroke();

  if (boss.overloadCharging) {
    ctx.strokeStyle = 'rgba(255,233,59,0.6)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, r + 8, -Math.PI / 2, -Math.PI / 2 + boss.overloadProgress * Math.PI * 2);
    ctx.stroke();
  }

  drawAngryFace(ctx, boss.x, boss.y, r);
}

/** A small angry face (angled eyebrows, dot eyes, frown) drawn inside the
 * boss circle so it reads as a hostile enemy at a glance. */
function drawAngryFace(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const eyeY = cy - r * 0.15;
  const eyeDx = r * 0.4;

  ctx.strokeStyle = '#e8e8f0';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  // eyebrows angled down toward the middle (angry)
  ctx.beginPath();
  ctx.moveTo(cx - eyeDx - r * 0.25, eyeY - r * 0.35);
  ctx.lineTo(cx - eyeDx + r * 0.2, eyeY - r * 0.05);
  ctx.moveTo(cx + eyeDx + r * 0.25, eyeY - r * 0.35);
  ctx.lineTo(cx + eyeDx - r * 0.2, eyeY - r * 0.05);
  ctx.stroke();

  // eyes
  ctx.fillStyle = '#e8e8f0';
  ctx.beginPath();
  ctx.arc(cx - eyeDx, eyeY + r * 0.15, r * 0.1, 0, Math.PI * 2);
  ctx.arc(cx + eyeDx, eyeY + r * 0.15, r * 0.1, 0, Math.PI * 2);
  ctx.fill();

  // frown (arc bulging up in the middle)
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.75, r * 0.35, Math.PI, Math.PI * 2);
  ctx.stroke();
}

function drawBumper(ctx: CanvasRenderingContext2D, b: { x: number; y: number; r: number; cooldown: number }, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = b.cooldown > 0 ? 2 : 4;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.stroke();
}

function drawFlippers(ctx: CanvasRenderingContext2D, world: World): void {
  ctx.strokeStyle = '#e8e8f0';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  for (const f of world.flippers) {
    // f.angle is already mirrored for the right side by createFlippers().
    const tipX = f.pivot.x + Math.cos(f.angle) * f.length;
    const tipY = f.pivot.y + Math.sin(f.angle) * f.length;
    ctx.beginPath();
    ctx.moveTo(f.pivot.x, f.pivot.y);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
  }
}

function drawProjectiles(ctx: CanvasRenderingContext2D, world: World): void {
  // Squares (not circles) so enemy shots are never mistaken for the player's
  // ball at a glance, even when the ball is charged red from paint hits.
  // Colors are chosen to not collide with any ball color (white/red/blue/yellow).
  for (const p of world.projectiles) {
    ctx.fillStyle = p.big ? '#ff3bd6' : '#ff8a3b';
    const size = p.r * 2;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(p.vy, p.vx));
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  }
}

function drawBalls(ctx: CanvasRenderingContext2D, world: World): void {
  for (const ball of world.balls) {
    ctx.fillStyle = COLOR_HEX[ball.color];
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * The frozen-time aim window: dims everything else so the sweeping vector
 * reads clearly, draws the full sweep cone as a dim guide plus the current
 * angle as a bright arrow, and a shrinking ring around the ball for the
 * auto-fire timeout so the player can feel the window closing.
 */
function drawAimIndicator(ctx: CanvasRenderingContext2D, world: World): void {
  const aim = world.aim;
  if (world.phase !== 'aim' || !aim) return;
  const ball = world.balls.find((b) => b.id === aim.ballId);
  if (!ball) return;

  ctx.fillStyle = 'rgba(5,2,8,0.55)';
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);

  const len = 60;
  const drawRay = (angle: number, color: string, width: number): void => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(ball.x, ball.y);
    ctx.lineTo(ball.x + Math.cos(angle) * len, ball.y + Math.sin(angle) * len);
    ctx.stroke();
  };

  // dim guides showing the full reachable cone
  drawRay(aim.centerAngle - aim.cone, 'rgba(232,232,240,0.35)', 2);
  drawRay(aim.centerAngle + aim.cone, 'rgba(232,232,240,0.35)', 2);

  // bright current aim vector
  const angle = aim.centerAngle + (aim.sweepT * 2 - 1) * aim.cone;
  drawRay(angle, '#ffe93b', 4);
  ctx.fillStyle = '#ffe93b';
  ctx.beginPath();
  ctx.arc(ball.x + Math.cos(angle) * len, ball.y + Math.sin(angle) * len, 5, 0, Math.PI * 2);
  ctx.fill();

  // shrinking timeout ring around the ball
  ctx.strokeStyle = 'rgba(255,233,59,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r + 6, -Math.PI / 2, -Math.PI / 2 + (aim.timer / AIM_TIMEOUT) * Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#e8e8f0';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('release to fire', ball.x, ball.y - 20);
}

function drawFieldOverlay(ctx: CanvasRenderingContext2D, world: World): void {
  ctx.fillStyle = '#e8e8f0';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  const ball = world.balls[0];
  if (ball) {
    ctx.fillText(`x${ball.multiplier.toFixed(1)}`, ball.x + 10, ball.y - 10);
  }
  if (world.phase === 'launch') {
    ctx.textAlign = 'center';
    ctx.fillText('hold launch zone to charge', FIELD_W / 2, FIELD_H / 2);
  } else if (world.phase === 'win') {
    ctx.textAlign = 'center';
    ctx.font = '24px monospace';
    ctx.fillText('BOSS DOWN', FIELD_W / 2, FIELD_H / 2);
  } else if (world.phase === 'lose') {
    ctx.textAlign = 'center';
    ctx.font = '24px monospace';
    ctx.fillText('BASE DESTROYED', FIELD_W / 2, FIELD_H / 2);
  }
}
