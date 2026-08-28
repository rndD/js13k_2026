// Canvas 2D rendering of a World snapshot. Primitives only, per the art
// direction in dis_doc.md: dark field, bright thin geometry, color reserved
// for charged/energized things. No image assets.
//
// Layout: the top HUD_HEIGHT strip holds combat/status readouts,
// drawn in untransformed canvas space. Everything else (the actual table) is
// drawn translated down by HUD_HEIGHT, so World's own 0..FIELD_H coordinate
// space is unaffected by the HUD - sim.ts/physics.ts never need to know it exists.
import { AIM_TIMEOUT, ARMOR_ARC_HALF, ARMOR_ORBIT_RADIUS, ARMOR_THICKNESS, AUTO_LAUNCH_DELAY, BALL_RADIUS, BALL_RESTORE_TIME, BUMPER_COOLDOWN, ECHO_STABILITY, FIELD_H, FIELD_W, HUD_HEIGHT, LAUNCH_PAD_COOLDOWN, POISON_DELAY, ROLE_FLASH_DURATION } from './constants';
import { abilityById, abilityDescription, type AbilityRarity } from './abilities';
import { BG, CYAN, HUD_BG, LIME, ORANGE, RED, STRUCTURE, VIOLET, WHITE, YELLOW, rainbowColor, withAlpha, withGlow } from './palette';
import type { Ball, World } from './types';

export const COLOR_HEX: Record<Ball['color'], string> = {
  white: WHITE,
  red: RED,
  blue: CYAN,
  rainbow: VIOLET, // static fallback only - actual rainbow balls use ballColor() below
};

/** Resolves a ball's on-screen color, giving the fully-charged 'rainbow'
 * tier real cycling motion (see palette.ts's rainbowColor) instead of a
 * flat hue. Shared with main.ts's trail so the afterimage shimmers too. */
export function ballColor(color: Ball['color'], time: number): string {
  return color === 'rainbow' ? rainbowColor(time) : COLOR_HEX[color];
}

export const BUMPER_COLOR: Record<'paint' | 'energy', string> = {
  paint: RED,
  energy: CYAN,
};

/** Short-lived expanding, fading ring around a just-triggered bumper/pad -
 * dis_doc.md's "Pulse" effect (#5 in the high-payoff effects list): bumpers
 * and charged targets briefly expand on trigger. Derived purely from
 * the existing cooldown field (no new World state). */
function drawImpactPulse(ctx: CanvasRenderingContext2D, x: number, y: number, baseR: number, cooldown: number, maxCooldown: number, color: string): void {
  if (cooldown <= 0) return;
  const t = 1 - cooldown / maxCooldown; // 0 = just hit, 1 = faded out
  withGlow(ctx, color, 8 * (1 - t), () => {
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, baseR + t * 16, 0, Math.PI * 2);
    ctx.stroke();
  });
}

export function render(ctx: CanvasRenderingContext2D, world: World): void {
  drawHudBar(ctx, world);

  ctx.save();
  ctx.translate(0, HUD_HEIGHT);
  drawFieldBorder(ctx);
  drawWalls(ctx, world);
  drawPegs(ctx, world);
  drawLaunchPads(ctx, world);
  drawLaunchZone(ctx, world);
  drawBoss(ctx, world);
  for (const b of world.bumpers) {
    drawBumper(ctx, b, BUMPER_COLOR[b.kind]);
    // pulses in the SAME hue as the bumper that fired it, per dis_doc.md's
    // paint-burst rule ("color of the element that caused them") - not a
    // generic accent color unrelated to what was actually hit.
    drawImpactPulse(ctx, b.x, b.y, b.r, b.cooldown, BUMPER_COOLDOWN, BUMPER_COLOR[b.kind]);
  }
  drawFlippers(ctx, world);
  drawBullets(ctx, world);
  drawBalls(ctx, world);
  drawAimIndicator(ctx, world);
  drawFieldOverlay(ctx, world);
  drawPickCards(ctx, world);
  ctx.restore();
}

function drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, color: string): void {
  ctx.strokeStyle = STRUCTURE;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
}

function drawHudBar(ctx: CanvasRenderingContext2D, world: World): void {
  const { boss } = world;
  const pad = 10;
  const w = FIELD_W - pad * 2;
  const barH = 6;

  ctx.fillStyle = HUD_BG;
  ctx.fillRect(0, 0, FIELD_W, HUD_HEIGHT);

  ctx.font = '9px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = STRUCTURE;
  ctx.fillText('BOSS', pad, 14);
  drawBar(ctx, pad, 17, w, barH, boss.hp / boss.maxHp, RED);

  ctx.fillStyle = LIME;
  ctx.fillText(`POINTS ${Math.round(world.points)} / ${world.nextUpgradeAt}`, pad, 40);
  ctx.textAlign = 'right';
  ctx.fillStyle = WHITE;
  const regen = world.upgrades.ballRestore && world.coreBalls < world.coreCapacity ? ` +${Math.ceil(BALL_RESTORE_TIME - world.restoreTimer)}s` : '';
  ctx.fillText(`BALLS ${world.coreBalls}${regen}`, FIELD_W - pad, 40);

  ctx.strokeStyle = STRUCTURE;
  ctx.beginPath();
  ctx.moveTo(0, HUD_HEIGHT - 0.5);
  ctx.lineTo(FIELD_W, HUD_HEIGHT - 0.5);
  ctx.stroke();
}

const RARITY_COLOR: Record<AbilityRarity, string> = {
  common: WHITE,
  uncommon: CYAN,
  rare: VIOLET,
};

function drawPickCards(ctx: CanvasRenderingContext2D, world: World): void {
  if (world.phase !== 'pick' || !world.pick) return;
  ctx.fillStyle = withAlpha(BG, 0.82);
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);

  ctx.textAlign = 'center';
  ctx.fillStyle = YELLOW;
  ctx.font = 'bold 17px monospace';
  ctx.fillText('CHOOSE UPGRADE', FIELD_W / 2, 145);
  ctx.fillStyle = STRUCTURE;
  ctx.font = '9px monospace';
  ctx.fillText(world.pick.armed ? 'TAP A CARD  /  KEYS 1 2 3' : 'RELEASE CONTROLS', FIELD_W / 2, 164);

  const gap = 7;
  const margin = 8;
  const cardW = (FIELD_W - margin * 2 - gap * 2) / 3;
  const cardH = 190;
  const y = 185;
  world.pick.offers.forEach((id, index) => {
    const ability = abilityById(id);
    const description = abilityDescription(ability, world.upgrades[id]);
    const color = RARITY_COLOR[ability.rarity];
    const x = margin + index * (cardW + gap);
    const selected = world.pick!.selected === index;
    withGlow(ctx, color, 5, () => {
      ctx.fillStyle = selected ? withAlpha(color, 0.2) : withAlpha(HUD_BG, 0.96);
      ctx.strokeStyle = color;
      ctx.lineWidth = selected ? 4 : 2;
      ctx.fillRect(x, y, cardW, cardH);
      ctx.strokeRect(x, y, cardW, cardH);
    });
    ctx.font = '8px monospace';
    ctx.fillStyle = color;
    ctx.fillText(ability.rarity.toUpperCase(), x + cardW / 2, y + 30);
    ctx.fillStyle = WHITE;
    ctx.font = '9px monospace';
    description.forEach((line, i) => ctx.fillText(line, x + cardW / 2, y + 68 + i * 15));
    ctx.fillStyle = STRUCTURE;
    ctx.fillText(`RANK ${world.upgrades[id] + 1}/${ability.maxStacks}`, x + cardW / 2, y + 145);
    ctx.fillStyle = color;
    ctx.font = 'bold 12px monospace';
    ctx.fillText(String(index + 1), x + cardW / 2, y + 174);
  });
}

function drawFieldBorder(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = STRUCTURE;
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
  ctx.strokeStyle = STRUCTURE;
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

function drawPegs(ctx: CanvasRenderingContext2D, world: World): void {
  ctx.strokeStyle = STRUCTURE;
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
  for (const pad of world.launchPads) {
    withGlow(ctx, YELLOW, 10, () => {
      ctx.fillStyle = YELLOW;
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
    });
    // pad pulses YELLOW too - its own fill color, same rule as bumpers above.
    drawImpactPulse(ctx, pad.x, pad.y, size * 0.7, pad.cooldown, LAUNCH_PAD_COOLDOWN, YELLOW);
  }
}

/** Plunger indicator at world.launch: a compressing spring plus a ball
 * outline, so the (otherwise invisible) launch spot reads as "pull/hold
 * here" before the first ball exists. Only relevant during the 'launch'
 * phase - once a real ball is in play it's drawn by drawBalls() instead. */
function drawLaunchZone(ctx: CanvasRenderingContext2D, world: World): void {
  const activeCores = world.balls.filter((ball) => ball.role === 'core').length;
  if (world.phase !== 'launch' && (world.phase !== 'battle' || activeCores >= world.coreBalls)) return;
  const { x, y } = world.launch;
  const power = world.launch.power;

  const springTop = y + BALL_RADIUS + 4;
  const springBottom = FIELD_H - 6;
  const restLen = springBottom - springTop;
  const len = restLen * (1 - power * 0.45); // compresses as it charges
  const coils = 7;
  const coilW = 7;

  ctx.strokeStyle = world.launch.charging ? YELLOW : STRUCTURE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, springTop);
  for (let i = 1; i < coils; i++) {
    const t = i / coils;
    ctx.lineTo(x + (i % 2 === 0 ? coilW : -coilW), springTop + len * t);
  }
  ctx.lineTo(x, springTop + len);
  ctx.stroke();

  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  if (activeCores === 0) {
    ctx.fillStyle = world.launch.autoTimer > AUTO_LAUNCH_DELAY - 3 ? YELLOW : STRUCTURE;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`AUTO LAUNCH ${Math.max(0, Math.ceil(AUTO_LAUNCH_DELAY - world.launch.autoTimer))}`, x - BALL_RADIUS - 6, y + 3);
  }
}

function drawBoss(ctx: CanvasRenderingContext2D, world: World): void {
  if (world.phase === 'win') return;
  const { boss } = world;
  const r = boss.r;
  const exposed = boss.armor.every((armor) => armor.hp <= 0);

  for (const armor of boss.armor) {
    if (armor.hp <= 0) continue;
    withGlow(ctx, CYAN, 8, () => {
      ctx.lineCap = 'round';
      ctx.strokeStyle = withAlpha(CYAN, 0.2);
      ctx.lineWidth = ARMOR_THICKNESS;
      ctx.beginPath();
      ctx.arc(boss.x, boss.y, ARMOR_ORBIT_RADIUS, armor.angle - ARMOR_ARC_HALF, armor.angle + ARMOR_ARC_HALF);
      ctx.stroke();

      ctx.strokeStyle = CYAN;
      ctx.lineWidth = ARMOR_THICKNESS - 2;
      ctx.beginPath();
      ctx.arc(
        boss.x,
        boss.y,
        ARMOR_ORBIT_RADIUS,
        armor.angle - ARMOR_ARC_HALF,
        armor.angle - ARMOR_ARC_HALF + armor.hp / armor.maxHp * ARMOR_ARC_HALF * 2,
      );
      ctx.stroke();
    });
  }

  withGlow(ctx, RED, exposed ? 10 : 6, () => {
    ctx.strokeStyle = RED;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  if (boss.poisonDamage > 0) {
    withGlow(ctx, LIME, 9, () => {
      ctx.strokeStyle = LIME;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(boss.x, boss.y, r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * boss.poisonTimer / POISON_DELAY);
      ctx.stroke();
    });
  }

  drawAngryFace(ctx, boss.x, boss.y, r);
}

/** A small angry face (angled eyebrows, dot eyes, frown) drawn inside the
 * boss circle so it reads as a hostile enemy at a glance. */
function drawAngryFace(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const eyeY = cy - r * 0.15;
  const eyeDx = r * 0.4;

  ctx.strokeStyle = WHITE;
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
  ctx.fillStyle = WHITE;
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
  withGlow(ctx, color, b.cooldown > 0 ? 4 : 9, () => {
    ctx.strokeStyle = color;
    ctx.lineWidth = b.cooldown > 0 ? 2 : 4;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function drawFlippers(ctx: CanvasRenderingContext2D, world: World): void {
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  for (const f of world.flippers) {
    // f.angle is already mirrored for the right side by createFlippers().
    const tipX = f.pivot.x + Math.cos(f.angle) * f.length;
    const tipY = f.pivot.y + Math.sin(f.angle) * f.length;
    const color = f.active ? VIOLET : WHITE;
    withGlow(ctx, color, f.active ? 10 : 0, () => {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(f.pivot.x, f.pivot.y);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
    });
  }
}

function drawBullets(ctx: CanvasRenderingContext2D, world: World): void {
  withGlow(ctx, YELLOW, 7, () => {
    ctx.fillStyle = YELLOW;
    for (const bullet of world.bullets) {
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawBalls(ctx: CanvasRenderingContext2D, world: World): void {
  for (const ball of world.balls) {
    const color = ballColor(ball.color, world.time);
    if (ball.role === 'hostile') drawHostileBall(ctx, ball, world.time);
    else {
      const opacity = ball.role === 'echo' ? Math.min(1, Math.max(0.25, ball.stability / ECHO_STABILITY)) : 1;
      drawBallSphere(ctx, ball, color, world.time, opacity);
      if (ball.role === 'core' && world.upgrades.autoGun > 0) {
        const angle = Math.atan2(world.boss.y - ball.y, world.boss.x - ball.x);
        ctx.strokeStyle = YELLOW;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ball.x + Math.cos(angle) * 5, ball.y + Math.sin(angle) * 5);
        ctx.lineTo(ball.x + Math.cos(angle) * (ball.r + 2), ball.y + Math.sin(angle) * (ball.r + 2));
        ctx.stroke();
      }
      if (ball.role === 'echo') {
        ctx.strokeStyle = CYAN;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (ball.roleFlash > 0) {
      const t = 1 - ball.roleFlash / ROLE_FLASH_DURATION;
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r + 5 + t * 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

}

function drawBallSphere(ctx: CanvasRenderingContext2D, ball: Ball, color: string, time: number, opacity: number): void {
  withGlow(ctx, color, 10, () => {
    // Offset highlight + dark rim turns the flat disc into a cheap sphere.
    const gradient = ctx.createRadialGradient(ball.x - ball.r * 0.35, ball.y - ball.r * 0.35, 1, ball.x, ball.y, ball.r);
    gradient.addColorStop(0, withAlpha(WHITE, opacity));
    gradient.addColorStop(0.35, withAlpha(color, opacity));
    gradient.addColorStop(1, withAlpha(BG, opacity));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();

    // A rotating off-centre crescent preserves the visible spin cue.
    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(time * 8 + ball.id);
    ctx.strokeStyle = withAlpha(WHITE, 0.7 * opacity);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ball.r * 0.15, 0, ball.r * 0.55, -1.1, 1.1);
    ctx.stroke();
    ctx.restore();
  });
}

function drawHostileBall(ctx: CanvasRenderingContext2D, ball: Ball, time: number): void {
  withGlow(ctx, ORANGE, 10, () => {
    ctx.fillStyle = BG;
    ctx.strokeStyle = RED;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(time * 3);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      ctx.moveTo(ball.r + 2, 0);
      ctx.lineTo(ball.r + 7, 0);
      ctx.rotate(Math.PI / 2);
    }
    ctx.stroke();
    ctx.restore();
  });
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

  ctx.fillStyle = withAlpha(BG, 0.55);
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
  drawRay(aim.centerAngle - aim.cone, withAlpha(WHITE, 0.35), 2);
  drawRay(aim.centerAngle + aim.cone, withAlpha(WHITE, 0.35), 2);

  // bright current aim vector
  const angle = aim.centerAngle + (aim.sweepT * 2 - 1) * aim.cone;
  drawRay(angle, YELLOW, 4);
  ctx.fillStyle = YELLOW;
  ctx.beginPath();
  ctx.arc(ball.x + Math.cos(angle) * len, ball.y + Math.sin(angle) * len, 5, 0, Math.PI * 2);
  ctx.fill();

  // shrinking timeout ring around the ball
  ctx.strokeStyle = withAlpha(YELLOW, 0.8);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r + 6, -Math.PI / 2, -Math.PI / 2 + (aim.timer / AIM_TIMEOUT) * Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = WHITE;
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('release to fire', ball.x, ball.y - ball.r - 22);
}

function drawFieldOverlay(ctx: CanvasRenderingContext2D, world: World): void {
  ctx.fillStyle = WHITE;
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  for (const ball of world.balls) {
    if (ball.role !== 'core') continue;
    // LIME (previously unused) reads as a distinct "power" readout, separate
    // from the plain white HUD/status text - dis_doc.md's color-progression
    // table treats build strength as its own visual channel.
    ctx.fillStyle = LIME;
    ctx.fillText(`x${ball.multiplier.toFixed(1)}`, ball.x, ball.y - ball.r - 4);
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
    ctx.fillText('GAME OVER', FIELD_W / 2, FIELD_H / 2);
  }
}
