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
  ARMOR_ACCENT_BONUS,
  ARMOR_DAMAGE_BASE,
  ARMOR_DEFLECT_SPEED,
  ARMOR_HIT_COOLDOWN,
  ARMOR_ORBIT_RADIUS,
  ARMOR_RING_GAP,
  ARMOR_ROTATION_SPEED,
  ARMOR_THICKNESS,
  AUTO_LAUNCH_DELAY,
  BALL_RESTORE_TIMES,
  BALL_RADIUS,
  BALL_SIZE_PER_MULT,
  BULLET_DAMAGES,
  BULLET_INTERVALS,
  BULLET_LIFETIME,
  BULLET_SPEED,
  BOSS_HIT_COOLDOWN,
  BOSS_BLAST_INTERVALS,
  BOSS_BLAST_RADIUS,
  BOSS_BLAST_WARNING,
  BOSS_HOSTILE_INTERVALS,
  BOSS_HPS,
  BOSS_MOVE_SPEED,
  BOSS_MOVE_X,
  BOSS_MOVE_Y,
  BOSS_MAGNET_FORCE,
  BOSS_SHOT_INTERVAL,
  BOSS_SHOT_SPEED,
  BUMPER_COOLDOWN,
  BUMPER_IMPULSE,
  CRITICAL_CHANCE,
  DIRECT_DAMAGE_BASE,
  ENERGY_TARGET_MULT_BONUS,
  ENERGY_ECHO_CHANCES,
  FIELD_H,
  FIELD_W,
  FLIPPER_ANGULAR_SPEED,
  FLIPPER_BOOST_SPEED,
  FLIPPER_THICKNESS,
  HOSTILE_BALL_SPEED,
  HIT_MULTIPLIER_COST,
  LAUNCH_CHARGE_TIME,
  LAUNCH_MAX_SPEED,
  LAUNCH_MIN_SPEED,
  LAUNCH_PAD_BOOST,
  LAUNCH_PAD_COOLDOWN,
  LAUNCH_PAD_TRIGGER_R,
  LEVEL_TRANSITION_TIME,
  MAX_SPEED,
  OVERCHARGE_BONUSES,
  PAINT_MULTIPLIER_MAX,
  PAINT_MULTIPLIER_STEP,
  PAINT_SHOT_DAMAGES,
  PEG_IMPULSE,
  POINTS_BOSS_DEFEAT,
  POINTS_ARMOR_BREAK,
  POINTS_CHARGE_TARGET,
  POINTS_CORE_DRAIN_PENALTY,
  POINTS_OTHER_DRAIN_PENALTY,
  POINTS_HOSTILE_CAPTURE,
  POINTS_PAINT_TARGET,
  POISON_DAMAGE,
  POISON_DELAY,
  RECRUITER_LIFETIMES,
  RECRUITER_STABILITIES,
  ROLE_FLASH_DURATION,
  STUCK_MAX_RESCUES,
  STUCK_PROGRESS_RADIUS,
  STUCK_RESCUE_SPEED,
  STUCK_TIMEOUT,
  WALL_THICKNESS,
  WALL_SOUND_TICKS,
} from './constants';
import { ABILITIES } from './abilities';
import { createBall, createBoss, loadTable } from './entities';
import { LEVELS } from './level';
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
import type { AbilityId, AimState, Ball, Bullet, Bumper, ControlsState, Flipper, World } from './types';

/** Advance the world by one fixed timestep. Mutates and returns `world`. */
export function step(world: World, controls: ControlsState, dt: number): World {
  // Cleared before the win/lose early-return (not just after it) - otherwise
  // once the round ends, world.sfx/world.fx keep holding the single 'lose'/
  // 'win' event from the tick the game ended, and since main.ts calls step()
  // every tick regardless of phase, that stale event got replayed/redrawn
  // (sound + flash + shake) on every single frame forever instead of once.
  world.sfx = [];
  world.fx = [];
  world.contacts = [];

  if (world.phase === 'win' || world.phase === 'lose') {
    return world;
  }

  if (world.phase === 'pick') {
    updateVibrancy(world, dt);
    updatePick(world, controls, dt);
    return world;
  }

  world.time += dt;
  while (world.damageLog[0]?.[0] < world.time - 3) world.damageLog.shift();
  updateVibrancy(world, dt);

  if (world.phase === 'transition') {
    world.transitionTimer -= dt;
    if (world.transitionTimer <= 0) startNextBoss(world);
    return world;
  }

  updateBallRestore(world, dt);

  updateFlippers(world, controls, dt);
  updateLaunch(world, controls, dt);

  if (world.phase === 'aim') {
    // Everything else (boss and other balls) is fully frozen while aiming -
    // only the sweep indicator itself advances, on
    // real time, so the player gets an unhurried, fully readable window to
    // pick a launch vector instead of reacting on reflex.
    updateAim(world, controls, dt);
    return world;
  }

  updateBoss(world, dt);
  updateBalls(world, dt);
  updateGun(world, dt);
  updateBullets(world, dt);
  updateCooldowns(world, dt);
  queueUpgradeMilestones(world);
  checkOutcome(world);
  checkAllBallsLost(world);
  if (world.pendingUpgrades > 0 && !isFinished(world)) beginPick(world);

  return world;
}

function isFinished(world: World): boolean {
  return world.phase === 'win' || world.phase === 'lose' || world.phase === 'transition';
}

function trackDamage(world: World, amount: number): void {
  world.damageLog.push([world.time, amount]);
}

function updateVibrancy(world: World, dt: number): void {
  const damage = world.damageLog.reduce((sum, hit) => sum + hit[1], 0);
  const target = Math.min(1, damage / 120);
  world.vibrancy += (target - world.vibrancy) * Math.min(1, dt * 2);
  world.spectrumPhase += dt * (0.2 + world.vibrancy ** 2 * 4);
}

function queueUpgradeMilestones(world: World): void {
  while (world.points >= world.nextUpgradeAt) {
    world.pendingUpgrades += 1;
    const nextGap = Math.min(5000, world.previousUpgradeGap + world.upgradeGap);
    world.previousUpgradeGap = world.upgradeGap;
    world.upgradeGap = nextGap;
    world.nextUpgradeAt += nextGap;
  }
}

function beginPick(world: World, resumePhase = world.phase): void {
  const eligible = ABILITIES.filter((ability) => world.upgrades[ability.id] < ability.maxStacks);
  const offers: AbilityId[] = [];
  while (offers.length < 3 && eligible.length) {
    const groups = ['common', 'uncommon', 'rare'].map((rarity) => eligible.filter((ability) => ability.rarity === rarity));
    const weights = [10, 7, 3];
    let roll = random(world) * groups.reduce((sum, group, i) => sum + (group.length ? weights[i] : 0), 0);
    let tier = 0;
    while (!groups[tier].length || (roll -= weights[tier]) > 0) tier++;
    const ability = groups[tier][Math.floor(random(world) * groups[tier].length)];
    offers.push(ability.id);
    eligible.splice(eligible.indexOf(ability), 1);
  }
  if (!offers.length) {
    world.pendingUpgrades = 0;
    return;
  }
  world.pendingUpgrades -= 1;
  world.pick = {
    offers,
    resumePhase: resumePhase as 'launch' | 'battle' | 'aim',
    timer: 0.5,
    armed: false,
    selected: null,
  };
  world.phase = 'pick';
  world.sfx.push('upgradeOpen');
}

function updatePick(world: World, controls: ControlsState, dt: number): void {
  const pick = world.pick;
  if (!pick) return;
  pick.timer -= dt;
  if (pick.timer > 0) return;
  const anyHeld = controls.choice !== null;
  if (!pick.armed) {
    if (!anyHeld) pick.armed = true;
    return;
  }
  const index = controls.choice ?? -1;
  if (pick.selected === null) {
    if (pick.offers[index]) pick.selected = index;
    return;
  }
  if (anyHeld) return;
  const id = pick.offers[pick.selected];
  if (!id) return;

  world.upgrades[id] += 1;
  world.upgradeCount += 1;
  if (id === 'extraCore') {
    const amount = world.upgrades.extraCore + 1;
    world.coreBalls += amount;
  }
  if (id === 'recruiter') {
    const rank = world.upgrades.recruiter;
    for (const ball of world.balls) if (ball.role === 'echo') {
      ball.multiplier = Math.min(PAINT_MULTIPLIER_MAX, ball.multiplier + 1);
      ball.stability = Math.max(ball.stability, RECRUITER_STABILITIES[rank]);
      ball.lifetime = Math.max(ball.lifetime, RECRUITER_LIFETIMES[rank]);
    }
  }
  if (id === 'overcharge') {
    const rank = world.upgrades.overcharge;
    const bonus = OVERCHARGE_BONUSES[rank] - OVERCHARGE_BONUSES[rank - 1];
    for (const ball of world.balls) if (ball.role !== 'hostile') ball.multiplier = Math.min(PAINT_MULTIPLIER_MAX, ball.multiplier + bonus);
  }
  if (id === 'foreverRainbow') for (const ball of world.balls) if (ball.role !== 'hostile') makeRainbow(ball);
  if (id === 'splitAll') {
    const originals = world.balls.filter((ball) => ball.role !== 'hostile');
    world.nextBallId = Math.max(world.nextBallId, ...world.balls.map((ball) => ball.id + 1));
    for (const ball of originals) {
      const sign = ball.id % 2 ? 1 : -1;
      world.balls.push({ ...ball, id: world.nextBallId++, stocked: false, x: ball.x + sign * ball.r, vx: ball.vx + sign * 90, gunTimer: 0 });
    }
  }
  if (id === 'sacrifice') {
    trackDamage(world, world.boss.hp - Math.ceil(world.boss.hp / 2));
    world.boss.hp = Math.ceil(world.boss.hp / 2);
    for (const ball of world.balls) {
      if (ball.role === 'core' && ball.stocked) world.coreBalls = Math.max(0, world.coreBalls - 1);
      explodeBall(world, ball);
    }
    world.balls = [];
    world.bullets = [];
    world.pendingUpgrades += 2;
  }
  world.sfx.push('upgradePick');

  const resumePhase = pick.resumePhase;
  world.pick = null;
  world.phase = resumePhase;
  if (world.pendingUpgrades > 0) beginPick(world, resumePhase);
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

function updateBallRestore(world: World, dt: number): void {
  const rank = world.upgrades.ballRestore;
  if (!rank || (world.phase !== 'launch' && world.phase !== 'battle')) return;
  const stored = world.coreBalls - world.balls.filter((ball) => ball.role === 'core' && ball.stocked).length;
  if (stored >= 4) return;
  const interval = BALL_RESTORE_TIMES[rank - 1];
  world.restoreTimer = Math.min(interval, world.restoreTimer + dt);
  if (world.restoreTimer >= interval) {
    world.coreBalls += 1;
    world.restoreTimer = 0;
    world.sfx.push('energyChime');
  }
}

function rollCritical(world: World): boolean {
  return world.upgrades.critical > 0 && rollChance(world, CRITICAL_CHANCE * world.upgrades.critical);
}

function rollChance(world: World, chance: number): boolean {
  return random(world) < chance;
}

function random(world: World): number {
  world.randomSeed = (world.randomSeed * 1664525 + 1013904223) >>> 0;
  return world.randomSeed / 4294967296;
}

function baseMultiplier(world: World): number {
  return 1 + OVERCHARGE_BONUSES[world.upgrades.overcharge];
}

function updateLaunch(world: World, controls: ControlsState, dt: number): void {
  const activeCores = world.balls.filter((ball) => ball.role === 'core').length;
  const canLaunch = world.phase === 'launch' || (world.phase === 'battle' && activeCores < world.coreBalls);
  if (!canLaunch) return;

  if (activeCores === 0 && world.coreBalls > 0) {
    world.launch.autoTimer += dt;
    if (world.launch.autoTimer >= AUTO_LAUNCH_DELAY) {
      launchBall(world, 1);
      return;
    }
  } else world.launch.autoTimer = 0;

  if (controls.launch) {
    world.launch.charging = true;
    world.launch.power = Math.min(1, world.launch.power + dt / LAUNCH_CHARGE_TIME);
    return;
  }

  if (world.launch.charging) {
    launchBall(world, world.launch.power);
  }
}

function launchBall(world: World, power: number): void {
  const speed = LAUNCH_MIN_SPEED + power * (LAUNCH_MAX_SPEED - LAUNCH_MIN_SPEED);
  const ball = createBall(world.nextBallId++, world.launch.x, world.launch.y);
  ball.multiplier = baseMultiplier(world);
  if (world.upgrades.foreverRainbow) makeRainbow(ball);
  ball.vx = -60;
  ball.vy = -speed;
  world.balls.push(ball);
  world.launch.charging = false;
  world.launch.power = 0;
  world.launch.autoTimer = 0;
  world.phase = 'battle';
  world.sfx.push('launchWhoosh');
}

function updateGun(world: World, dt: number): void {
  const rank = world.upgrades.autoGun;
  if (!rank) return;
  const interval = BULLET_INTERVALS[rank - 1];
  const damage = BULLET_DAMAGES[rank - 1];
  for (const ball of world.balls) {
    if (ball.role !== 'core' || Math.hypot(ball.vx, ball.vy) < 100 || ball.y > world.launch.y - 15) continue;
    ball.gunTimer -= dt;
    if (ball.gunTimer > 0) continue;
    const angle = Math.atan2(world.boss.y - ball.y, world.boss.x - ball.x);
    world.bullets.push({
      x: ball.x + Math.cos(angle) * (ball.r + 4),
      y: ball.y + Math.sin(angle) * (ball.r + 4),
      vx: Math.cos(angle) * BULLET_SPEED,
      vy: Math.sin(angle) * BULLET_SPEED,
      r: 2,
      damage: damage * (ball.multiplier > 2 ? ball.multiplier / 2 : ball.multiplier) * (ball.color === 'rainbow' ? 1.25 : 1),
      lifetime: BULLET_LIFETIME,
    });
    ball.gunTimer = interval;
    world.sfx.push('gunShot');
  }
}

function updateBullets(world: World, dt: number): void {
  const remaining: Bullet[] = [];
  for (const bullet of world.bullets) {
    bullet.lifetime -= dt;
    let hit = false;
    for (let step = 0; step < BALL_SUBSTEPS && !hit; step++) {
      if (bullet.paint) {
        const angle = Math.atan2(world.boss.y - bullet.y, world.boss.x - bullet.x);
        bullet.vx = Math.cos(angle) * BULLET_SPEED;
        bullet.vy = Math.sin(angle) * BULLET_SPEED;
      }
      bullet.x += bullet.vx * dt / BALL_SUBSTEPS;
      bullet.y += bullet.vy * dt / BALL_SUBSTEPS;
      if (bullet.enemy) {
        const index = world.balls.findIndex((ball) => ball.role !== 'hostile' && overlapsCircle(bullet, ball));
        if (index >= 0) {
          const ball = world.balls[index];
          if (ball.role === 'echo' || !ball.stocked) {
            explodeBall(world, ball);
            world.balls.splice(index, 1);
          } else ball.multiplier = Math.max(baseMultiplier(world), ball.multiplier - 0.5);
          world.sfx.push('armorHit');
          hit = true;
        }
      }
      if (hit) break;
      if (!bullet.paint) {
        hit = resolveWalls(bullet, FIELD_W, FIELD_H) !== 'none';
        for (const wall of world.walls) if (resolveWall(bullet, wall, WALL_THICKNESS)) hit = true;
        for (const peg of world.pegs) if (resolveBumper(bullet, peg, PEG_IMPULSE)) hit = true;
        for (const bumper of world.bumpers) if (resolveBumper(bullet, bumper, 0)) hit = true;
        for (const flipper of world.flippers) if (resolveFlipper(bullet, flipper, 0, FLIPPER_THICKNESS)) hit = true;
        for (const pad of world.launchPads) if (resolveLaunchPad(bullet, pad, LAUNCH_PAD_TRIGGER_R, 0)) hit = true;
      }
      if (hit) break;

      if (bullet.enemy) continue;
      const dx = bullet.x - world.boss.x;
      const dy = bullet.y - world.boss.y;
      const distance = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      for (const armor of world.boss.armor) {
        const angleDelta = Math.atan2(Math.sin(angle - armor.angle), Math.cos(angle - armor.angle));
        if (armor.hp <= 0 || Math.abs(angleDelta) > world.boss.armorArc || Math.abs(distance - armorRadius(armor.ring)) > ARMOR_THICKNESS / 2 + bullet.r) continue;
        trackDamage(world, Math.min(armor.hp, bullet.damage));
        armor.hp = Math.max(0, armor.hp - bullet.damage);
        addPoints(world, bullet.damage);
        world.fx.push({ kind: 'armor', x: bullet.x, y: bullet.y, amount: bullet.damage });
        hit = true;
        break;
      }
      if (!hit && distance < world.boss.r + bullet.r) {
        trackDamage(world, Math.min(world.boss.hp, bullet.damage));
        world.boss.hp = Math.max(0, world.boss.hp - bullet.damage);
        addPoints(world, bullet.damage);
        world.fx.push({ kind: 'boss', x: bullet.x, y: bullet.y, amount: bullet.damage });
        hit = true;
      }
    }
    if (!hit && bullet.lifetime > 0 && bullet.y - bullet.r <= FIELD_H) remaining.push(bullet);
  }
  world.bullets = remaining;
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
    recoverEscapedBall(world, ball);
    ball.r = ball.role === 'hostile' ? BALL_RADIUS : BALL_RADIUS * (1 + Math.max(0, ball.multiplier - 1) * BALL_SIZE_PER_MULT);
    ball.roleFlash -= dt;
    ball.wallSoundTicks = Math.max(0, ball.wallSoundTicks - 1);
    if (ball.role !== 'core') {
      ball.lifetime = Math.max(0, ball.lifetime - dt);
      if (ball.lifetime === 0) {
        explodeBall(world, ball);
        continue;
      }
    }
    if (ball.role !== 'hostile' && world.upgrades.bossMagnet > 0) {
      const dx = world.boss.x - ball.x;
      const dy = world.boss.y - ball.y;
      const distance = Math.hypot(dx, dy) || 1;
      const pull = BOSS_MAGNET_FORCE * world.upgrades.bossMagnet * dt;
      ball.vx += dx / distance * pull;
      ball.vy += dy / distance * pull;
    }
    let drained = false;
    let aiming = false;
    let expired = false;
    let blockedBossThisTick = false;
    let bounced = false; // plain non-scoring wall/peg contact this tick, see wallTick push below

    for (let i = 0; i < BALL_SUBSTEPS && !drained && !aiming && !expired; i++) {
      integrate(ball, subDt);

      const wallResult = resolveWalls(ball, FIELD_W, FIELD_H);
      if (wallResult === 'drained') {
        drained = true;
        consumeDrainedBall(world, ball);
        world.sfx.push('ballDrain');
        break;
      }
      if (wallResult === 'bounced') {
        bounced = true;
      }

      for (const wall of world.walls) {
        if (resolveWall(ball, wall, WALL_THICKNESS)) {
          bounced = true;
        }
      }

      for (const f of world.flippers) {
        const hit = resolveFlipper(ball, f, FLIPPER_BOOST_SPEED, FLIPPER_THICKNESS);
        if (hit) world.contacts.push({ kind: 'flipper', x: ball.x, y: ball.y });
        // An ACTIVE flipper swing catching the ball opens the contact-aim
        // window instead of applying its usual instant boost: freeze the
        // ball right where it landed and let the player pick the exact
        // launch vector (see updateAim/fireAimedBall) rather than reacting
        // on reflex to an unpredictable bounce.
        if (hit && f.active && ball.role === 'hostile') {
          convertHostile(world, ball);
        } else if (hit && f.active && ball.role === 'core' && !world.aim) {
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

      if (ball.role !== 'hostile') for (const peg of world.pegs) {
        if (resolveBumper(ball, peg, PEG_IMPULSE)) {
          bounced = true; // plain physical bounce, no scoring effect
        }
      }

      if (ball.role !== 'hostile') for (const pad of world.launchPads) {
        if (pad.cooldown <= 0 && resolveLaunchPad(ball, pad, LAUNCH_PAD_TRIGGER_R, LAUNCH_PAD_BOOST)) {
          pad.cooldown = LAUNCH_PAD_COOLDOWN;
          world.sfx.push('padBoost');
          world.contacts.push({ kind: 'pad', x: ball.x, y: ball.y });
        }
      }

      if (ball.role !== 'hostile') for (const bumper of world.bumpers) {
        if (resolveBumper(ball, bumper, BUMPER_IMPULSE)) {
          world.contacts.push({ kind: bumper.kind, x: ball.x, y: ball.y });
          if (bumper.cooldown <= 0) {
            if (bumper.kind === 'paint') applyPaintHit(world, ball, bumper);
            else applyEnergyHit(world, ball);
            bumper.cooldown = BUMPER_COOLDOWN;
            expired = spendEchoStability(ball);
          }
          if (expired) break;
        }
      }
      if (expired) break;

      ball.bossCooldown -= subDt;
      ball.armorCooldown -= subDt;

      let hitArmor = false;
      for (const armor of world.boss.armor) {
        if (armor.hp <= 0) continue;
        const hit = resolveArmorArc(ball, world.boss.x, world.boss.y, armor.angle, world.boss.armorArc, armorRadius(armor.ring));
        if (!hit) continue;
        hitArmor = true;
        blockedBossThisTick = true;
        world.contacts.push({ kind: 'armor', x: hit.x, y: hit.y });
        if (ball.role !== 'hostile' && ball.armorCooldown <= 0) {
          const critical = rollCritical(world);
          const damage = Math.round(ARMOR_DAMAGE_BASE * ball.multiplier * (ball.accent ? ARMOR_ACCENT_BONUS : 1) * (ball.color === 'rainbow' ? 1.25 : 1)) * (critical ? 2 : 1);
          trackDamage(world, Math.min(armor.hp, damage));
          armor.hp = Math.max(0, armor.hp - damage);
          ball.armorCooldown = ARMOR_HIT_COOLDOWN;
          addPoints(world, damage + (armor.hp === 0 ? POINTS_ARMOR_BREAK : 0));
          world.sfx.push(armor.hp === 0 ? 'armorBreak' : 'armorHit');
          world.fx.push({ kind: 'armor', x: hit.x, y: hit.y, amount: damage, critical });
          if (critical) world.sfx.push('energyChime');
          ball.multiplier = Math.max(baseMultiplier(world), ball.multiplier - HIT_MULTIPLIER_COST);
          expired = spendEchoStability(ball);
        }
        break;
      }
      if (expired) break;

      if (!hitArmor && !blockedBossThisTick && ball.role !== 'hostile' && ball.bossCooldown <= 0 && overlapsCircle(ball, world.boss)) {
        const critical = rollCritical(world);
        const dmg = Math.round(DIRECT_DAMAGE_BASE * ball.multiplier * (ball.color === 'rainbow' ? 1.25 : 1)) * (critical ? 2 : 1);
        trackDamage(world, Math.min(world.boss.hp, dmg));
        world.boss.hp = Math.max(0, world.boss.hp - dmg);
        addPoints(world, dmg);
        ball.bossCooldown = BOSS_HIT_COOLDOWN;
        world.sfx.push('bossHitThud');
        world.fx.push({ kind: 'boss', x: world.boss.x, y: world.boss.y, amount: dmg, critical });
        if (critical) world.sfx.push('energyChime');
        ball.multiplier = Math.max(baseMultiplier(world), ball.multiplier - HIT_MULTIPLIER_COST);
        if (world.upgrades.poison > 0) {
          world.boss.poisonDamage += POISON_DAMAGE * world.upgrades.poison;
          world.boss.poisonTimer = POISON_DELAY;
        }
        expired = spendEchoStability(ball);
      }

      clampSpeed(ball);
    }

    // One tick sound max per ball for plain wall/peg contact, even if it
    // touched several segments across substeps this tick - a rapid clatter
    // of multiple clicks for one visible bounce would sound like a glitch.
    if (bounced && !drained && !aiming && !expired && ball.wallSoundTicks === 0) {
      world.sfx.push('wallTick');
      world.contacts.push({ kind: 'structure', x: ball.x, y: ball.y });
      ball.wallSoundTicks = WALL_SOUND_TICKS;
    }

    if (drained) continue; // ball (and its accumulated build) is lost
    if (expired) {
      explodeBall(world, ball);
      continue;
    }

    recoverEscapedBall(world, ball);

    if (!aiming && checkStuck(world, ball, dt)) {
      consumeDrainedBall(world, ball);
      world.sfx.push('ballDrain');
      continue;
    } // watchdog gave up on this ball

    ball.color = deriveColor(ball.charge > 0, ball.accent);
    remaining.push(ball);
  }

  world.balls = remaining;
}

function armorRadius(ring: number): number {
  return ARMOR_ORBIT_RADIUS + ring * ARMOR_RING_GAP;
}

function resolveArmorArc(ball: Ball, cx: number, cy: number, angle: number, arc: number, radius: number): { x: number; y: number } | null {
  const dx = ball.x - cx;
  const dy = ball.y - cy;
  const distance = Math.hypot(dx, dy) || 0.0001;
  const ballAngle = Math.atan2(dy, dx);
  const angleDelta = Math.atan2(Math.sin(ballAngle - angle), Math.cos(ballAngle - angle));
  if (Math.abs(angleDelta) > arc || Math.abs(distance - radius) > ball.r + ARMOR_THICKNESS / 2) return null;

  const nx = dx / distance;
  const ny = dy / distance;
  const outside = distance >= radius;
  const targetDistance = radius + (outside ? 1 : -1) * (ball.r + ARMOR_THICKNESS / 2);
  ball.x = cx + nx * targetDistance;
  ball.y = cy + ny * targetDistance;
  const speed = Math.max(ARMOR_DEFLECT_SPEED, Math.hypot(ball.vx, ball.vy));
  const direction = outside ? 1 : -1;
  ball.vx = nx * speed * direction;
  ball.vy = ny * speed * direction;
  return { x: cx + nx * radius, y: cy + ny * radius };
}

function consumeDrainedBall(world: World, ball: Ball): void {
  if (ball.role === 'core' && ball.stocked) world.coreBalls = Math.max(0, world.coreBalls - 1);
  addPoints(world, -(ball.role === 'core' ? POINTS_CORE_DRAIN_PENALTY : POINTS_OTHER_DRAIN_PENALTY));
}

function recoverEscapedBall(world: World, ball: Ball): void {
  const invalid = !Number.isFinite(ball.x + ball.y + ball.vx + ball.vy);
  const escaped = ball.x + ball.r < 0 || ball.x - ball.r > FIELD_W || ball.y + ball.r < 0;
  if (!invalid && (!escaped || ball.y - ball.r > FIELD_H)) return;
  ball.x = world.launch.x;
  ball.y = world.launch.y;
  ball.vx = -60;
  ball.vy = -LAUNCH_MIN_SPEED;
  ball.anchorX = ball.x;
  ball.anchorY = ball.y;
  ball.stuckTimer = 0;
  ball.rescueCount = 0;
  world.sfx.push('launchWhoosh');
}

function addPoints(world: World, amount: number): void {
  world.points = Math.max(0, world.points + amount);
}

function spendEchoStability(ball: Ball): boolean {
  if (ball.role !== 'echo') return false;
  ball.stability = Math.max(0, ball.stability - 1);
  return ball.stability === 0;
}

function explodeBall(world: World, ball: Ball): void {
  world.sfx.push('ballExplode');
  world.fx.push({ kind: ball.role === 'hostile' ? 'hostileBurst' : 'echoBurst', x: ball.x, y: ball.y });
}

function convertHostile(world: World, ball: Ball): void {
  const recruiter = world.upgrades.recruiter;
  ball.role = 'echo';
  ball.stability = RECRUITER_STABILITIES[recruiter];
  ball.lifetime = RECRUITER_LIFETIMES[recruiter];
  ball.multiplier = 1 + recruiter + OVERCHARGE_BONUSES[world.upgrades.overcharge];
  ball.charge = recruiter;
  ball.color = 'white';
  ball.accent = false;
  if (world.upgrades.foreverRainbow) makeRainbow(ball);
  ball.roleFlash = ROLE_FLASH_DURATION;
  addPoints(world, POINTS_HOSTILE_CAPTURE);
  world.sfx.push('echoCapture');
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

function makeRainbow(ball: Ball): void {
  ball.charge = Math.max(1, ball.charge);
  ball.accent = true;
  ball.color = 'rainbow';
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

function applyPaintHit(world: World, ball: Ball, bumper: Bumper): void {
  const growth = ball.role === 'echo' ? 0.5 : 1;
  ball.charge += growth;
  ball.multiplier = Math.min(PAINT_MULTIPLIER_MAX, ball.multiplier + PAINT_MULTIPLIER_STEP * growth);
  addPoints(world, POINTS_PAINT_TARGET);
  world.sfx.push('paintHit');
  const rank = world.upgrades.paintShot;
  if (rank) {
    const angle = Math.atan2(world.boss.y - bumper.y, world.boss.x - bumper.x);
    const gun = world.upgrades.autoGun;
    const damage = (PAINT_SHOT_DAMAGES[rank - 1] + (gun ? BULLET_DAMAGES[gun - 1] : 0)) * (ball.multiplier > 2 ? ball.multiplier / 2 : ball.multiplier) * (ball.color === 'rainbow' ? 1.25 : 1);
    world.bullets.push({ x: bumper.x, y: bumper.y, vx: Math.cos(angle) * BULLET_SPEED, vy: Math.sin(angle) * BULLET_SPEED, r: 4, damage, lifetime: 2, paint: true });
    world.sfx.push('gunShot');
  }
}

function applyEnergyHit(world: World, ball: Ball): void {
  const growth = ball.role === 'echo' ? 0.5 : 1;
  ball.accent = true;
  ball.multiplier = Math.min(PAINT_MULTIPLIER_MAX, ball.multiplier + ENERGY_TARGET_MULT_BONUS * growth);
  addPoints(world, POINTS_CHARGE_TARGET);
  world.sfx.push('energyChime');
  const rank = world.upgrades.energyEcho;
  if (rank && rollChance(world, ENERGY_ECHO_CHANCES[rank - 1])) {
    const echo = createBall(world.nextBallId++, world.boss.x, world.boss.y - ARMOR_ORBIT_RADIUS - ARMOR_RING_GAP - 14, 'echo');
    const recruiter = world.upgrades.recruiter;
    echo.stocked = false;
    echo.stability = RECRUITER_STABILITIES[recruiter];
    echo.lifetime = RECRUITER_LIFETIMES[recruiter];
    echo.multiplier = 1 + recruiter + OVERCHARGE_BONUSES[world.upgrades.overcharge];
    echo.charge = recruiter;
    if (world.upgrades.foreverRainbow) makeRainbow(echo);
    echo.vx = world.randomSeed % 121 - 60;
    echo.vy = -HOSTILE_BALL_SPEED;
    world.balls.push(echo);
    world.sfx.push('echoCapture');
  }
}

function updateCooldowns(world: World, dt: number): void {
  for (const b of world.bumpers) b.cooldown -= dt;
  for (const p of world.launchPads) p.cooldown -= dt;
}

function updateBoss(world: World, dt: number): void {
  if (world.phase !== 'battle') return;
  const boss = world.boss;
  boss.x = boss.homeX + Math.sin(world.time * BOSS_MOVE_SPEED) * BOSS_MOVE_X;
  boss.y = boss.homeY + Math.sin(world.time * BOSS_MOVE_SPEED * 1.6) * BOSS_MOVE_Y;
  for (const armor of boss.armor) armor.angle += ARMOR_ROTATION_SPEED * dt * (armor.ring % 2 ? -1 : 1);
  if (boss.rank === 1 || boss.rank >= 3) {
    boss.shotTimer -= dt;
    if (boss.shotTimer <= 0) {
      boss.shotTimer = BOSS_SHOT_INTERVAL;
      const targets = world.balls.filter((ball) => ball.role !== 'hostile');
      if (targets.length) {
        const target = targets[world.randomSeed++ % targets.length];
        const angle = Math.atan2(target.y - boss.y, target.x - boss.x);
        world.bullets.push({ x: boss.x + Math.cos(angle) * (boss.r + 4), y: boss.y + Math.sin(angle) * (boss.r + 4), vx: Math.cos(angle) * BOSS_SHOT_SPEED, vy: Math.sin(angle) * BOSS_SHOT_SPEED, r: 3, damage: 0, lifetime: 3, enemy: true });
        world.sfx.push('gunShot');
      }
    }
  }
  if (boss.rank >= 2) {
    if (boss.warningTimer > 0) {
      boss.warningTimer -= dt;
      if (boss.warningTimer <= 0) {
        world.balls = world.balls.filter((ball) => {
          if (ball.role === 'hostile' || Math.hypot(ball.x - boss.x, ball.y - boss.y) > BOSS_BLAST_RADIUS) return true;
          if (ball.role === 'core' && ball.stocked) world.coreBalls = Math.max(0, world.coreBalls - 1);
          explodeBall(world, ball);
          return false;
        });
        world.sfx.push('ballExplode');
      }
    } else {
      boss.specialTimer -= dt;
      if (boss.specialTimer <= 0) {
        boss.specialTimer = BOSS_BLAST_INTERVALS[boss.rank];
        boss.warningTimer = BOSS_BLAST_WARNING;
        world.sfx.push('energyChime');
      }
    }
  }
  if (boss.poisonDamage > 0) {
    boss.poisonTimer -= dt;
    if (boss.poisonTimer <= 0) {
      const damage = Math.min(boss.hp, boss.poisonDamage);
      trackDamage(world, damage);
      boss.hp -= damage;
      addPoints(world, damage);
      world.fx.push({ kind: 'boss', x: boss.x, y: boss.y, amount: damage });
      world.sfx.push('energyChime');
      boss.poisonDamage = 0;
    }
  }
  boss.spawnTimer -= dt;
  // One living boss supports one hostile ball. When encounters gain several
  // bosses, this count is the only value the spawn cadence/cap must consume.
  const livingBosses = boss.hp > 0 ? 1 : 0;
  const hostileCount = world.balls.filter((ball) => ball.role === 'hostile').length;
  if (!livingBosses || boss.spawnTimer > 0 || hostileCount >= livingBosses) return;

  boss.spawnTimer = BOSS_HOSTILE_INTERVALS[boss.rank] / livingBosses;
  const ball = createBall(world.nextBallId++, boss.x, boss.y + boss.r + 8, 'hostile');
  const angle = Math.PI / 2 + Math.sin(world.time * 1.7) * 0.45;
  ball.vx = Math.cos(angle) * HOSTILE_BALL_SPEED;
  ball.vy = Math.sin(angle) * HOSTILE_BALL_SPEED;
  world.balls.push(ball);
  world.sfx.push('hostileSpawn');
}

function checkOutcome(world: World): void {
  if (world.boss.hp <= 0) {
    addPoints(world, POINTS_BOSS_DEFEAT);
    // Stocked cores are already included in coreBalls until they are lost.
    // Only surviving echoes/clones become newly stored balls here.
    world.coreBalls += world.balls.filter((ball) => ball.role !== 'hostile' && !ball.stocked).length;
    world.balls = [];
    world.bullets = [];
    const finished = world.boss.rank === BOSS_HPS.length - 1;
    if (!finished) world.coreBalls += 1;
    world.phase = finished ? 'win' : 'transition';
    world.transitionTimer = LEVEL_TRANSITION_TIME;
    world.sfx.push('ballExplode', 'win');
    world.fx.push({ kind: 'win', x: world.boss.x, y: world.boss.y });
  }
}

function startNextBoss(world: World): void {
  const rank = world.boss.rank + 1;
  let spot = { x: world.boss.homeX, y: world.boss.homeY, r: world.boss.r };
  if (world.tableIndex >= 0) {
    world.tableIndex = (world.tableIndex + 1) % LEVELS.length;
    const level = LEVELS[world.tableIndex];
    loadTable(world, level);
    spot = level.boss;
  }
  world.boss = createBoss(spot, rank);
  world.phase = 'launch';
  world.restoreTimer = 0;
}

function checkAllBallsLost(world: World): void {
  const hasPlayerBall = world.balls.some((ball) => ball.role === 'core' || ball.role === 'echo');
  if (world.phase === 'battle' && !hasPlayerBall && world.coreBalls <= 0) {
    // Hostiles never keep a run alive after all player-owned balls and core
    // stock are gone. With reserve remaining, battle continues uninterrupted
    // and the launcher stays available alongside any hostile balls.
    world.balls = world.balls.filter((ball) => ball.role !== 'hostile');
    world.phase = 'lose';
    world.sfx.push('lose');
    world.fx.push({ kind: 'lose', x: FIELD_W / 2, y: FIELD_H });
  }
}

/** Deep-clone the world for safe inspection (tests, rendering, replay logs). */
export function getSnapshot(world: World): World {
  return structuredClone(world);
}
