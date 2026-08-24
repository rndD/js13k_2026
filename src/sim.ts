// The entire game simulation, expressed as one pure-ish step function with
// no DOM/canvas dependency. This lets tests (and a future replay/record
// system) drive the game headlessly by feeding scripted ControlsState
// sequences and inspecting the resulting World.
import {
  AIM_BASE_SPEED,
  AIM_CONE_MAX,
  AIM_CONE_MIN,
  AIM_LOFT_BIAS,
  AIM_SAFE_CLEARANCE,
  AIM_SPEED_PER_MULT,
  AIM_SWEEP_PERIOD,
  AIM_TIMEOUT,
  BOSS_HIT_COOLDOWN,
  BOSS_PROJECTILE_DAMAGE,
  BOSS_PROJECTILE_RADIUS,
  BOSS_PROJECTILE_SPEED,
  BOSS_SHOOT_INTERVAL,
  BUMPER_COOLDOWN,
  BUMPER_IMPULSE,
  DIRECT_DAMAGE_BASE,
  ENERGY_TARGET_GAIN,
  ENERGY_TARGET_MULT_BONUS,
  FIELD_H,
  FIELD_W,
  FLIPPER_ANGULAR_SPEED,
  FLIPPER_BOOST_SPEED,
  FLIPPER_THICKNESS,
  LAUNCH_CHARGE_TIME,
  LAUNCH_MAX_SPEED,
  LAUNCH_MIN_SPEED,
  LAUNCH_PAD_BOOST,
  LAUNCH_PAD_COOLDOWN,
  LAUNCH_PAD_TRIGGER_R,
  MAX_SPEED,
  OVERLOAD_CHARGE_TIME,
  OVERLOAD_DAMAGE,
  OVERLOAD_INTERVAL,
  PAINT_DAMAGE_BASE,
  PAINT_MULTIPLIER_MAX,
  PAINT_MULTIPLIER_STEP,
  PEG_IMPULSE,
  SHIELD_DRAIN_RATE,
  STUCK_MAX_RESCUES,
  STUCK_PROGRESS_RADIUS,
  STUCK_RESCUE_SPEED,
  STUCK_TIMEOUT,
  WALL_THICKNESS,
} from './constants';
import { createBall } from './entities';
import { LEVEL } from './level';
import {
  clampSpeed,
  integrate,
  overlapsCircle,
  resolveBumper,
  resolveFlipper,
  resolveLaunchPad,
  resolveWall,
  resolveWalls,
} from './physics';
import type { AimState, Ball, ControlsState, Flipper, World } from './types';

/** Advance the world by one fixed timestep. Mutates and returns `world`. */
export function step(world: World, controls: ControlsState, dt: number): World {
  if (world.phase === 'win' || world.phase === 'lose') {
    return world;
  }

  // Cleared at the start of every step (not the end) so main.ts - which
  // reads world.sfx right after each step() call - always sees exactly this
  // tick's events, never a stale leftover or a double-read.
  world.sfx = [];

  world.time += dt;

  updateFlippers(world, controls, dt);
  updateLaunch(world, controls, dt);

  if (world.phase === 'aim') {
    // Everything else (boss, projectiles, other balls, shield) is fully
    // frozen while aiming - only the sweep indicator itself advances, on
    // real time, so the player gets an unhurried, fully readable window to
    // pick a launch vector instead of reacting on reflex.
    updateAim(world, controls, dt);
    return world;
  }

  // Shield state must be resolved before projectiles are checked against it,
  // otherwise a projectile arriving this tick would see last tick's state.
  updateShield(world, controls, dt);
  updateBalls(world, dt);
  updateCooldowns(world, dt);
  updateBoss(world, dt);
  updateProjectiles(world, dt);
  checkOutcome(world);
  checkAllBallsLost(world);

  return world;
}

function updateFlippers(world: World, controls: ControlsState, dt: number): void {
  for (const f of world.flippers) {
    const wasActive = f.active;
    f.active = f.side === 'left' ? controls.left : controls.right;
    if (f.active && !wasActive) world.sfx.push('flipperClick');
    const target = f.active ? f.activeAngle : f.restAngle;
    const maxStep = FLIPPER_ANGULAR_SPEED * dt;
    const diff = target - f.angle;
    if (Math.abs(diff) <= maxStep) f.angle = target;
    else f.angle += Math.sign(diff) * maxStep;
  }
}

function updateLaunch(world: World, controls: ControlsState, dt: number): void {
  if (world.phase !== 'launch') return;

  if (controls.launch) {
    world.launch.charging = true;
    world.launch.power = Math.min(1, world.launch.power + dt / LAUNCH_CHARGE_TIME);
    return;
  }

  if (world.launch.charging) {
    const power = world.launch.power;
    const speed = LAUNCH_MIN_SPEED + power * (LAUNCH_MAX_SPEED - LAUNCH_MIN_SPEED);
    const ball = createBall(world.nextBallId++, world.launch.x, world.launch.y);
    ball.vx = -60; // small nudge toward the field, away from the lane wall
    ball.vy = -speed;
    world.balls.push(ball);
    world.launch.charging = false;
    world.launch.power = 0;
    world.phase = 'battle';
    world.sfx.push('launchWhoosh');
  }
}

// Movement is subdivided into several substeps so that fast-moving balls
// (near MAX_SPEED) can't tunnel straight through thin colliders like the
// flippers in a single tick - at 60fps a ball at max speed can travel ~15px
// per frame, which is close to the flipper's ~14px collision half-width.
// Re-checking collisions every substep keeps per-tick displacement small.
const BALL_SUBSTEPS = 4;

function updateBalls(world: World, dt: number): void {
  const remaining: Ball[] = [];
  const subDt = dt / BALL_SUBSTEPS;

  for (const ball of world.balls) {
    let drained = false;
    let aiming = false;
    let bounced = false; // plain non-scoring wall/peg contact this tick, see wallTick push below

    for (let i = 0; i < BALL_SUBSTEPS && !drained && !aiming; i++) {
      integrate(ball, subDt);

      const wallResult = resolveWalls(ball, FIELD_W, FIELD_H);
      if (wallResult === 'drained') {
        drained = true;
        world.sfx.push('ballDrain');
        break;
      }
      if (wallResult === 'bounced') bounced = true;

      for (const wall of world.walls) {
        if (resolveWall(ball, wall, WALL_THICKNESS)) bounced = true;
      }

      for (const f of world.flippers) {
        const hit = resolveFlipper(ball, f, FLIPPER_BOOST_SPEED, FLIPPER_THICKNESS);
        // An ACTIVE flipper swing catching the ball opens the contact-aim
        // window instead of applying its usual instant boost: freeze the
        // ball right where it landed and let the player pick the exact
        // launch vector (see updateAim/fireAimedBall) rather than reacting
        // on reflex to an unpredictable bounce.
        if (hit && f.active && !world.aim) {
          ball.vx = 0;
          ball.vy = 0;
          // Lift the ball clear of the flipper's entire swept arc (not just
          // its current angle) so that when the button is released and the
          // flipper retracts toward rest, it can't sweep back up through the
          // ball while it's launching - the ball was getting re-swatted or
          // blocked mid-flight otherwise.
          const topY = flipperSweptTopY(f) - ball.r - FLIPPER_THICKNESS - AIM_SAFE_CLEARANCE;
          if (ball.y > topY) ball.y = topY;
          world.aim = {
            ballId: ball.id,
            side: f.side,
            centerAngle: aimCenterAngle(ball.x, ball.y, world.boss.x, world.boss.y),
            cone: aimConeForMultiplier(ball.multiplier),
            sweepT: 0,
            dir: 1,
            timer: AIM_TIMEOUT,
          };
          world.phase = 'aim';
          aiming = true;
          break;
        }
      }
      if (aiming) break;

      for (const peg of world.pegs) {
        if (resolveBumper(ball, peg, PEG_IMPULSE)) bounced = true; // plain physical bounce, no scoring effect
      }

      for (const pad of world.launchPads) {
        if (pad.cooldown <= 0 && resolveLaunchPad(ball, pad, LAUNCH_PAD_TRIGGER_R, LAUNCH_PAD_BOOST)) {
          pad.cooldown = LAUNCH_PAD_COOLDOWN;
          world.sfx.push('padBoost');
        }
      }

      for (const bumper of world.bumpers) {
        if (resolveBumper(ball, bumper, BUMPER_IMPULSE) && bumper.cooldown <= 0) {
          if (bumper.kind === 'paint') applyPaintHit(world, ball);
          else applyEnergyHit(world, ball);
          bumper.cooldown = BUMPER_COOLDOWN;
        }
      }

      if (ball.bossCooldown > 0) {
        ball.bossCooldown = Math.max(0, ball.bossCooldown - subDt);
      }
      if (ball.bossCooldown <= 0 && overlapsCircle(ball, world.boss)) {
        const dmg = Math.round(DIRECT_DAMAGE_BASE * ball.multiplier);
        world.boss.hp = Math.max(0, world.boss.hp - dmg);
        ball.damage = dmg;
        ball.bossCooldown = BOSS_HIT_COOLDOWN;
        world.sfx.push('bossHitThud');
      }

      clampSpeed(ball);
    }

    // One tick sound max per ball for plain wall/peg contact, even if it
    // touched several segments across substeps this tick - a rapid clatter
    // of multiple clicks for one visible bounce would sound like a glitch.
    if (bounced && !drained && !aiming) world.sfx.push('wallTick');

    if (drained) continue; // ball (and its accumulated build) is lost

    if (!aiming && checkStuck(world, ball, dt)) { world.sfx.push('ballDrain'); continue; } // watchdog gave up on this ball

    ball.color = deriveColor(ball.charge > 0, ball.accent);
    remaining.push(ball);
  }

  world.balls = remaining;
}

/**
 * Anti-stuck watchdog: tracks how far the ball has actually traveled from a
 * periodically-reset anchor point. A ball trapped bouncing in a tight pocket
 * (net displacement ~0 even while still moving) or wedged dead-still against
 * a corner will sit here making no progress; after STUCK_TIMEOUT seconds of
 * that, it gets a firm nudge toward the boss instead of the round hanging.
 * If nudging repeatedly fails to free the same ball, give up and drain it -
 * this guarantees the watchdog can never itself loop forever.
 * Returns true if the ball was drained (caller should drop it).
 */
function checkStuck(world: World, ball: Ball, dt: number): boolean {
  const dx = ball.x - ball.anchorX;
  const dy = ball.y - ball.anchorY;
  if (dx * dx + dy * dy >= STUCK_PROGRESS_RADIUS * STUCK_PROGRESS_RADIUS) {
    ball.anchorX = ball.x;
    ball.anchorY = ball.y;
    ball.stuckTimer = 0;
    return false;
  }

  ball.stuckTimer += dt;
  if (ball.stuckTimer < STUCK_TIMEOUT) return false;

  if (ball.rescueCount >= STUCK_MAX_RESCUES) return true; // repeatedly un-rescuable, cut losses

  const toBoss = Math.atan2(world.boss.y - ball.y, world.boss.x - ball.x);
  // Alternate the kick off dead-center each attempt so a perfectly
  // symmetric trap can't just re-stick the ball the same way twice.
  const jitter = (ball.rescueCount % 2 === 0 ? 1 : -1) * (0.3 + ball.rescueCount * 0.15);
  const angle = toBoss + jitter;
  ball.vx = Math.cos(angle) * STUCK_RESCUE_SPEED;
  ball.vy = Math.sin(angle) * STUCK_RESCUE_SPEED;
  ball.rescueCount += 1;
  ball.anchorX = ball.x;
  ball.anchorY = ball.y;
  ball.stuckTimer = 0;
  return false;
}

function deriveColor(hasPaint: boolean, hasAccent: boolean): Ball['color'] {
  if (hasPaint && hasAccent) return 'rainbow';
  if (hasPaint) return 'red';
  if (hasAccent) return 'blue';
  return 'white';
}

/**
 * Highest point (smallest y) the flipper segment can reach anywhere between
 * its rest and active angles - used to park the aiming ball safely above the
 * whole arc rather than just clear of its current angle.
 */
function flipperSweptTopY(f: Flipper): number {
  const restTipY = f.pivot.y + Math.sin(f.restAngle) * f.length;
  const activeTipY = f.pivot.y + Math.sin(f.activeAngle) * f.length;
  return Math.min(f.pivot.y, restTipY, activeTipY);
}

/**
 * The aim sweep is centered on the boss (not the raw flipper-contact angle,
 * which varied wildly with exactly where/when the ball touched the swinging
 * flipper and was the main source of "why did that go sideways?" confusion),
 * then blended partway toward straight-up. That blend is a cheap stand-in
 * for full projectile-motion targeting: it roughly compensates for gravity
 * pulling the shot down over its flight without needing to solve for launch
 * angle analytically - good enough for a readable, aimable shot.
 */
function aimCenterAngle(ballX: number, ballY: number, targetX: number, targetY: number): number {
  const toTarget = Math.atan2(targetY - ballY, targetX - ballX);
  const straightUp = -Math.PI / 2;
  return toTarget + (straightUp - toTarget) * AIM_LOFT_BIAS;
}

/**
 * A fresh white ball gets a narrow, reliable "aimed at the boss" cone (few
 * wasted sideways/straight-up throws); a charged-up ball earns a much wider
 * cone so a built-up shot can go trick-shot for bumpers off to the side.
 */
function aimConeForMultiplier(multiplier: number): number {
  const t = Math.min(1, Math.max(0, (multiplier - 1) / (PAINT_MULTIPLIER_MAX - 1)));
  return AIM_CONE_MIN + (AIM_CONE_MAX - AIM_CONE_MIN) * t;
}

/**
 * Drives the frozen-time aim window opened when an active flipper catches a
 * ball (see updateBalls). The indicator ping-pongs across a fixed cone
 * around the contact's outward direction; releasing the same flipper button
 * that's held (or the timeout, if the player never lets go) fires the ball
 * along whatever angle the sweep is at that instant.
 */
function updateAim(world: World, controls: ControlsState, dt: number): void {
  const aim = world.aim;
  if (!aim) return;

  aim.timer -= dt;
  aim.sweepT += (dt / AIM_SWEEP_PERIOD) * aim.dir;
  if (aim.sweepT >= 1) {
    aim.sweepT = 1;
    aim.dir = -1;
  } else if (aim.sweepT <= 0) {
    aim.sweepT = 0;
    aim.dir = 1;
  }

  const held = aim.side === 'left' ? controls.left : controls.right;
  if (!held || aim.timer <= 0) {
    fireAimedBall(world, aim);
  }
}

function fireAimedBall(world: World, aim: AimState): void {
  const ball = world.balls.find((b) => b.id === aim.ballId);
  if (ball) {
    const angle = aim.centerAngle + (aim.sweepT * 2 - 1) * aim.cone;
    const speed = Math.min(MAX_SPEED, AIM_BASE_SPEED + ball.multiplier * AIM_SPEED_PER_MULT);
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
    world.sfx.push('launchWhoosh');
  }
  world.aim = null;
  world.phase = 'battle';
}

function applyPaintHit(world: World, ball: Ball): void {
  ball.charge += 1;
  ball.multiplier = Math.min(PAINT_MULTIPLIER_MAX, ball.multiplier + PAINT_MULTIPLIER_STEP);
  // MVP simplification: the paint attack lands instantly instead of
  // travelling as a separate projectile (see dis_doc.md "пейнт-снаряд").
  const dmg = Math.round(PAINT_DAMAGE_BASE * ball.multiplier);
  world.boss.hp = Math.max(0, world.boss.hp - dmg);
  world.sfx.push('paintHit');
}

function applyEnergyHit(world: World, ball: Ball): void {
  ball.accent = true;
  ball.multiplier = Math.min(PAINT_MULTIPLIER_MAX, ball.multiplier + ENERGY_TARGET_MULT_BONUS);
  // Pushed unconditionally on contact (not diffed off the energy value)
  // because Math.min below silently no-ops once shield.energy is already
  // maxed - a diff-based check would then wrongly stay silent on a real hit.
  world.shield.energy = Math.min(world.shield.maxEnergy, world.shield.energy + ENERGY_TARGET_GAIN);
  world.sfx.push('energyChime');
}

function updateCooldowns(world: World, dt: number): void {
  for (const b of world.bumpers) b.cooldown = Math.max(0, b.cooldown - dt);
  for (const p of world.launchPads) p.cooldown = Math.max(0, p.cooldown - dt);
}

function updateBoss(world: World, dt: number): void {
  // The boss must not attack while the player has no ball in play (e.g. while
  // still charging the launcher) - that felt unfair and let projectiles pile
  // up against an undefended base before the round even started.
  if (world.phase !== 'battle') return;

  const boss = world.boss;

  boss.shootTimer -= dt;
  if (boss.shootTimer <= 0) {
    boss.shootTimer = BOSS_SHOOT_INTERVAL;
    spawnProjectile(world, BOSS_PROJECTILE_DAMAGE, BOSS_PROJECTILE_SPEED, BOSS_PROJECTILE_RADIUS, false);
  }

  if (!boss.overloadCharging) {
    boss.overloadTimer -= dt;
    if (boss.overloadTimer <= 0) {
      boss.overloadCharging = true;
      boss.overloadProgress = 0;
    }
  } else {
    boss.overloadProgress += dt / OVERLOAD_CHARGE_TIME;
    if (boss.overloadProgress >= 1) {
      boss.overloadCharging = false;
      boss.overloadProgress = 0;
      boss.overloadTimer = OVERLOAD_INTERVAL;
      spawnProjectile(world, OVERLOAD_DAMAGE, BOSS_PROJECTILE_SPEED * 1.4, BOSS_PROJECTILE_RADIUS * 1.6, true);
    }
  }
}

function spawnProjectile(world: World, damage: number, speed: number, r: number, big: boolean): void {
  const boss = world.boss;
  const targetX = FIELD_W / 2;
  const targetY = LEVEL.base.y;
  const dx = targetX - boss.x;
  const dy = targetY - boss.y;
  const dist = Math.hypot(dx, dy) || 1;
  world.projectiles.push({
    x: boss.x,
    y: boss.y,
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
    r,
    damage,
    big,
  });
}

function updateProjectiles(world: World, dt: number): void {
  const remaining = [];
  for (const p of world.projectiles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.y >= LEVEL.base.y) {
      const blocked = world.shield.active && world.shield.energy > 0;
      if (blocked) {
        world.shield.hp = Math.max(0, world.shield.hp - p.damage);
        world.sfx.push('shieldBlock');
      } else {
        world.base.hp = Math.max(0, world.base.hp - p.damage);
        world.sfx.push('baseHit');
      }
      continue; // resolved, remove projectile
    }
    remaining.push(p);
  }
  world.projectiles = remaining;
}

function updateShield(world: World, controls: ControlsState, dt: number): void {
  const shield = world.shield;
  shield.active = controls.shield && shield.energy > 0;
  if (shield.active) {
    shield.energy = Math.max(0, shield.energy - SHIELD_DRAIN_RATE * dt);
  }
}

function checkOutcome(world: World): void {
  if (world.boss.hp <= 0) {
    world.phase = 'win';
    world.sfx.push('win');
  } else if (world.base.hp <= 0) {
    world.phase = 'lose';
    world.sfx.push('lose');
  }
}

function checkAllBallsLost(world: World): void {
  if (world.phase === 'battle' && world.balls.length === 0) {
    world.phase = 'launch';
  }
}

/** Deep-clone the world for safe inspection (tests, rendering, replay logs). */
export function getSnapshot(world: World): World {
  return structuredClone(world);
}
