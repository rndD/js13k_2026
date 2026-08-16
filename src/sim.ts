// The entire game simulation, expressed as one pure-ish step function with
// no DOM/canvas dependency. This lets tests (and a future replay/record
// system) drive the game headlessly by feeding scripted ControlsState
// sequences and inspecting the resulting World.
import {
  BASE_Y,
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
  LAUNCH_X,
  LAUNCH_Y,
  OVERLOAD_CHARGE_TIME,
  OVERLOAD_DAMAGE,
  OVERLOAD_INTERVAL,
  PAINT_DAMAGE_BASE,
  PAINT_MULTIPLIER_MAX,
  PAINT_MULTIPLIER_STEP,
  PEG_IMPULSE,
  SHIELD_DRAIN_RATE,
  TABLE_FLOOR_Y,
} from './constants';
import { createBall } from './entities';
import {
  clampSpeed,
  integrate,
  overlapsCircle,
  resolveBumper,
  resolveFlipper,
  resolveWalls,
} from './physics';
import type { Ball, ControlsState, World } from './types';

/** Advance the world by one fixed timestep. Mutates and returns `world`. */
export function step(world: World, controls: ControlsState, dt: number): World {
  if (world.phase === 'win' || world.phase === 'lose') {
    return world;
  }

  world.time += dt;

  updateFlippers(world, controls, dt);
  updateLaunch(world, controls, dt);
  // Shield state must be resolved before projectiles are checked against it,
  // otherwise a projectile arriving this tick would see last tick's state.
  updateShield(world, controls, dt);
  updateBalls(world, dt);
  updateBumperCooldowns(world, dt);
  updateBoss(world, dt);
  updateProjectiles(world, dt);
  checkOutcome(world);
  checkAllBallsLost(world);

  return world;
}

function updateFlippers(world: World, controls: ControlsState, dt: number): void {
  for (const f of world.flippers) {
    f.active = f.side === 'left' ? controls.left : controls.right;
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
    const ball = createBall(world.nextBallId++, LAUNCH_X, LAUNCH_Y);
    ball.vx = -60; // small nudge toward the field, away from the lane wall
    ball.vy = -speed;
    world.balls.push(ball);
    world.launch.charging = false;
    world.launch.power = 0;
    world.phase = 'battle';
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

    for (let i = 0; i < BALL_SUBSTEPS && !drained; i++) {
      integrate(ball, subDt);

      const wallResult = resolveWalls(ball, FIELD_W, TABLE_FLOOR_Y, FIELD_H);
      if (wallResult === 'drained') {
        drained = true;
        break;
      }

      for (const f of world.flippers) {
        resolveFlipper(ball, f, FLIPPER_BOOST_SPEED, FLIPPER_THICKNESS);
      }

      for (const peg of world.pegs) {
        resolveBumper(ball, peg, PEG_IMPULSE); // plain physical bounce, no scoring effect
      }

      if (resolveBumper(ball, world.paintBumper, BUMPER_IMPULSE) && world.paintBumper.cooldown <= 0) {
        applyPaintHit(world, ball);
        world.paintBumper.cooldown = BUMPER_COOLDOWN;
      }

      if (resolveBumper(ball, world.energyTarget, BUMPER_IMPULSE) && world.energyTarget.cooldown <= 0) {
        applyEnergyHit(world, ball);
        world.energyTarget.cooldown = BUMPER_COOLDOWN;
      }

      if (ball.bossCooldown > 0) {
        ball.bossCooldown = Math.max(0, ball.bossCooldown - subDt);
      }
      if (ball.bossCooldown <= 0 && overlapsCircle(ball, world.boss)) {
        const dmg = Math.round(DIRECT_DAMAGE_BASE * ball.multiplier);
        world.boss.hp = Math.max(0, world.boss.hp - dmg);
        ball.damage = dmg;
        ball.bossCooldown = BOSS_HIT_COOLDOWN;
      }

      clampSpeed(ball);
    }

    if (drained) continue; // ball (and its accumulated build) is lost

    ball.color = deriveColor(ball.charge > 0, ball.accent);
    remaining.push(ball);
  }

  world.balls = remaining;
}

function deriveColor(hasPaint: boolean, hasAccent: boolean): Ball['color'] {
  if (hasPaint && hasAccent) return 'rainbow';
  if (hasPaint) return 'red';
  if (hasAccent) return 'blue';
  return 'white';
}

function applyPaintHit(world: World, ball: Ball): void {
  ball.charge += 1;
  ball.multiplier = Math.min(PAINT_MULTIPLIER_MAX, ball.multiplier + PAINT_MULTIPLIER_STEP);
  // MVP simplification: the paint attack lands instantly instead of
  // travelling as a separate projectile (see dis_doc.md "пейнт-снаряд").
  const dmg = Math.round(PAINT_DAMAGE_BASE * ball.multiplier);
  world.boss.hp = Math.max(0, world.boss.hp - dmg);
}

function applyEnergyHit(world: World, ball: Ball): void {
  ball.accent = true;
  ball.multiplier = Math.min(PAINT_MULTIPLIER_MAX, ball.multiplier + ENERGY_TARGET_MULT_BONUS);
  world.shield.energy = Math.min(world.shield.maxEnergy, world.shield.energy + ENERGY_TARGET_GAIN);
}

function updateBumperCooldowns(world: World, dt: number): void {
  world.paintBumper.cooldown = Math.max(0, world.paintBumper.cooldown - dt);
  world.energyTarget.cooldown = Math.max(0, world.energyTarget.cooldown - dt);
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
  const targetY = BASE_Y;
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

    if (p.y >= BASE_Y) {
      const blocked = world.shield.active && world.shield.energy > 0;
      if (blocked) {
        world.shield.hp = Math.max(0, world.shield.hp - p.damage);
      } else {
        world.base.hp = Math.max(0, world.base.hp - p.damage);
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
  } else if (world.base.hp <= 0) {
    world.phase = 'lose';
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
