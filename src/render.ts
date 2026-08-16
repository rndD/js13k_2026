// Canvas 2D rendering of a World snapshot. Primitives only, per the art
// direction in dis_doc.md: dark field, bright thin geometry, color reserved
// for charged/energized things. No image assets.
import { BASE_Y, DRAIN_X0, DRAIN_X1, FIELD_H, FIELD_W, SHIELD_WIDTH, SHIELD_Y } from './constants';
import type { Ball, World } from './types';

const COLOR_HEX: Record<Ball['color'], string> = {
  white: '#e8e8f0',
  red: '#ff3b6b',
  blue: '#38d6ff',
  rainbow: '#ffe93b',
};

export function render(ctx: CanvasRenderingContext2D, world: World): void {
  drawWalls(ctx);
  drawBoss(ctx, world);
  drawBumper(ctx, world.paintBumper, '#ff3b6b');
  drawBumper(ctx, world.energyTarget, '#38d6ff');
  drawFlippers(ctx, world);
  drawShieldAndBase(ctx, world);
  drawProjectiles(ctx, world);
  drawBalls(ctx, world);
  drawHud(ctx, world);
}

function drawWalls(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = '#8888a0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, FIELD_H);
  ctx.moveTo(FIELD_W, 0);
  ctx.lineTo(FIELD_W, FIELD_H);
  ctx.moveTo(0, 0);
  ctx.lineTo(FIELD_W, 0);
  // bottom apron, with a gap for the drain
  ctx.moveTo(0, FIELD_H);
  ctx.lineTo(DRAIN_X0, FIELD_H);
  ctx.moveTo(DRAIN_X1, FIELD_H);
  ctx.lineTo(FIELD_W, FIELD_H);
  ctx.stroke();
}

function drawBoss(ctx: CanvasRenderingContext2D, world: World): void {
  const { boss } = world;
  const hpFrac = boss.hp / boss.maxHp;
  ctx.strokeStyle = boss.overloadCharging ? '#ffe93b' : '#ff3b6b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(boss.x, boss.y, boss.r, 0, Math.PI * 2);
  ctx.stroke();

  if (boss.overloadCharging) {
    ctx.strokeStyle = 'rgba(255,233,59,0.6)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, boss.r + 10, -Math.PI / 2, -Math.PI / 2 + boss.overloadProgress * Math.PI * 2);
    ctx.stroke();
  }

  // hp bar above the boss
  const barW = boss.r * 2;
  ctx.strokeStyle = '#444';
  ctx.strokeRect(boss.x - barW / 2, boss.y - boss.r - 16, barW, 6);
  ctx.fillStyle = '#ff3b6b';
  ctx.fillRect(boss.x - barW / 2, boss.y - boss.r - 16, barW * hpFrac, 6);
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

function drawShieldAndBase(ctx: CanvasRenderingContext2D, world: World): void {
  const { shield, base } = world;
  const cx = FIELD_W / 2;

  if (shield.active) {
    ctx.strokeStyle = '#38d6ff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, SHIELD_Y + 30, SHIELD_WIDTH / 2, Math.PI, 0);
    ctx.stroke();
  }

  // base hp bar
  const barW = SHIELD_WIDTH;
  ctx.strokeStyle = '#444';
  ctx.strokeRect(cx - barW / 2, BASE_Y + 10, barW, 8);
  ctx.fillStyle = '#ff8a3b';
  ctx.fillRect(cx - barW / 2, BASE_Y + 10, barW * (base.hp / base.maxHp), 8);

  // shield energy bar
  ctx.strokeStyle = '#444';
  ctx.strokeRect(cx - barW / 2, BASE_Y + 22, barW, 5);
  ctx.fillStyle = '#38d6ff';
  ctx.fillRect(cx - barW / 2, BASE_Y + 22, barW * (shield.energy / shield.maxEnergy), 5);
}

function drawProjectiles(ctx: CanvasRenderingContext2D, world: World): void {
  for (const p of world.projectiles) {
    ctx.fillStyle = p.big ? '#ffe93b' : '#ff3b6b';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
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

function drawHud(ctx: CanvasRenderingContext2D, world: World): void {
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
