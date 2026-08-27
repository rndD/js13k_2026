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
  ARMOR_ARC_HALF,
  ARMOR_DAMAGE_BASE,
  ARMOR_DEFLECT_SPEED,
  ARMOR_HIT_COOLDOWN,
  ARMOR_ORBIT_RADIUS,
  ARMOR_ROTATION_SPEED,
  ARMOR_THICKNESS,
  BOSS_HIT_COOLDOWN,
  BOSS_MOVE_SPEED,
  BOSS_MOVE_X,
  BOSS_MOVE_Y,
  BUMPER_COOLDOWN,
  BUMPER_IMPULSE,
  DIRECT_DAMAGE_BASE,
  ECHO_STABILITY,
  ECHO_LIFETIME,
  ENERGY_TARGET_MULT_BONUS,
  FIELD_H,
  FIELD_W,
  FLIPPER_ANGULAR_SPEED,
  FLIPPER_BOOST_SPEED,
  FLIPPER_THICKNESS,
  HOSTILE_BALL_SPEED,
  HOSTILE_HINT_DURATION,
  HOSTILE_SPAWN_INTERVAL,
  LAUNCH_CHARGE_TIME,
  LAUNCH_MAX_SPEED,
  LAUNCH_MIN_SPEED,
  LAUNCH_PAD_BOOST,
  LAUNCH_PAD_COOLDOWN,
  LAUNCH_PAD_TRIGGER_R,
  MAX_SPEED,
  PAINT_MULTIPLIER_MAX,
  PAINT_MULTIPLIER_STEP,
  PEG_IMPULSE,
  POINTS_BOSS_DEFEAT,
  POINTS_ARMOR_BREAK,
  POINTS_CHARGE_TARGET,
  POINTS_CORE_DRAIN_PENALTY,
  POINTS_OTHER_DRAIN_PENALTY,
  POINTS_HOSTILE_CAPTURE,
  POINTS_PAINT_TARGET,
  ROLE_FLASH_DURATION,
  STUCK_MAX_RESCUES,
  STUCK_PROGRESS_RADIUS,
  STUCK_RESCUE_SPEED,
  STUCK_TIMEOUT,
  WALL_THICKNESS,
} from './constants';
import { createBall } from './entities';
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

  world.time += dt;

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
  updateCooldowns(world, dt);
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
  const activeCores = world.balls.filter((ball) => ball.role === 'core').length;
  const canLaunch = world.phase === 'launch' || (world.phase === 'battle' && activeCores < world.coreBalls);
  if (!canLaunch) return;

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
    ball.roleFlash = Math.max(0, ball.roleFlash - dt);
    if (ball.role !== 'core') {
      ball.lifetime = Math.max(0, ball.lifetime - dt);
      if (ball.lifetime === 0) {
        explodeBall(world, ball);
        continue;
      }
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
        world.contacts.push({ kind: 'structure', x: ball.x, y: ball.y });
      }

      for (const wall of world.walls) {
        if (resolveWall(ball, wall, WALL_THICKNESS)) {
          bounced = true;
          world.contacts.push({ kind: 'structure', x: ball.x, y: ball.y });
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

      for (const peg of world.pegs) {
        if (resolveBumper(ball, peg, PEG_IMPULSE)) {
          bounced = true; // plain physical bounce, no scoring effect
          world.contacts.push({ kind: 'structure', x: ball.x, y: ball.y });
        }
      }

      for (const pad of world.launchPads) {
        if (pad.cooldown <= 0 && resolveLaunchPad(ball, pad, LAUNCH_PAD_TRIGGER_R, LAUNCH_PAD_BOOST)) {
          pad.cooldown = LAUNCH_PAD_COOLDOWN;
          world.sfx.push('padBoost');
          world.contacts.push({ kind: 'pad', x: ball.x, y: ball.y });
        }
      }

      for (const bumper of world.bumpers) {
        if (resolveBumper(ball, bumper, BUMPER_IMPULSE)) {
          world.contacts.push({ kind: bumper.kind, x: ball.x, y: ball.y });
          if (ball.role !== 'hostile' && bumper.cooldown <= 0) {
            if (bumper.kind === 'paint') applyPaintHit(world, ball);
            else applyEnergyHit(world, ball);
            bumper.cooldown = BUMPER_COOLDOWN;
            expired = spendEchoStability(ball);
          }
          if (expired) break;
        }
      }
      if (expired) break;

      if (ball.bossCooldown > 0) {
        ball.bossCooldown = Math.max(0, ball.bossCooldown - subDt);
      }
      if (ball.armorCooldown > 0) {
        ball.armorCooldown = Math.max(0, ball.armorCooldown - subDt);
      }

      let hitArmor = false;
      for (const armor of world.boss.armor) {
        if (armor.hp <= 0) continue;
        const hit = resolveArmorArc(ball, world.boss.x, world.boss.y, armor.angle);
        if (!hit) continue;
        hitArmor = true;
        blockedBossThisTick = true;
        world.contacts.push({ kind: 'armor', x: hit.x, y: hit.y });
        if (ball.role !== 'hostile' && ball.armorCooldown <= 0) {
          const damage = Math.round(ARMOR_DAMAGE_BASE * ball.multiplier * (ball.accent ? ARMOR_ACCENT_BONUS : 1));
          armor.hp = Math.max(0, armor.hp - damage);
          ball.armorCooldown = ARMOR_HIT_COOLDOWN;
          addPoints(world, damage + (armor.hp === 0 ? POINTS_ARMOR_BREAK : 0));
          world.sfx.push(armor.hp === 0 ? 'armorBreak' : 'armorHit');
          world.fx.push({ kind: 'armor', x: hit.x, y: hit.y, amount: damage });
          expired = spendEchoStability(ball);
        }
        break;
      }
      if (expired) break;

      if (!hitArmor && !blockedBossThisTick && ball.role !== 'hostile' && ball.bossCooldown <= 0 && overlapsCircle(ball, world.boss)) {
        const dmg = Math.round(DIRECT_DAMAGE_BASE * ball.multiplier);
        world.boss.hp = Math.max(0, world.boss.hp - dmg);
        addPoints(world, dmg);
        ball.damage = dmg;
        ball.bossCooldown = BOSS_HIT_COOLDOWN;
        world.sfx.push('bossHitThud');
        world.fx.push({ kind: 'boss', x: world.boss.x, y: world.boss.y, amount: dmg });
        expired = spendEchoStability(ball);
      }

      clampSpeed(ball);
    }

    // One tick sound max per ball for plain wall/peg contact, even if it
    // touched several segments across substeps this tick - a rapid clatter
    // of multiple clicks for one visible bounce would sound like a glitch.
    if (bounced && !drained && !aiming && !expired) world.sfx.push('wallTick');

    if (drained) continue; // ball (and its accumulated build) is lost
    if (expired) {
      explodeBall(world, ball);
      continue;
    }

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

function resolveArmorArc(ball: Ball, cx: number, cy: number, angle: number): { x: number; y: number } | null {
  const dx = ball.x - cx;
  const dy = ball.y - cy;
  const distance = Math.hypot(dx, dy) || 0.0001;
  const ballAngle = Math.atan2(dy, dx);
  const angleDelta = Math.atan2(Math.sin(ballAngle - angle), Math.cos(ballAngle - angle));
  if (Math.abs(angleDelta) > ARMOR_ARC_HALF || Math.abs(distance - ARMOR_ORBIT_RADIUS) > ball.r + ARMOR_THICKNESS / 2) return null;

  const nx = dx / distance;
  const ny = dy / distance;
  const outside = distance >= ARMOR_ORBIT_RADIUS;
  const targetDistance = ARMOR_ORBIT_RADIUS + (outside ? 1 : -1) * (ball.r + ARMOR_THICKNESS / 2);
  ball.x = cx + nx * targetDistance;
  ball.y = cy + ny * targetDistance;
  const speed = Math.max(ARMOR_DEFLECT_SPEED, Math.hypot(ball.vx, ball.vy));
  const direction = outside ? 1 : -1;
  ball.vx = nx * speed * direction;
  ball.vy = ny * speed * direction;
  return { x: cx + nx * ARMOR_ORBIT_RADIUS, y: cy + ny * ARMOR_ORBIT_RADIUS };
}

function consumeDrainedBall(world: World, ball: Ball): void {
  if (ball.role === 'core') world.coreBalls = Math.max(0, world.coreBalls - 1);
  addPoints(world, -(ball.role === 'core' ? POINTS_CORE_DRAIN_PENALTY : POINTS_OTHER_DRAIN_PENALTY));
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
  ball.role = 'echo';
  ball.stability = ECHO_STABILITY;
  ball.lifetime = ECHO_LIFETIME;
  ball.damage = 0;
  ball.multiplier = 1;
  ball.charge = 0;
  ball.color = 'white';
  ball.accent = false;
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
  const growth = ball.role === 'echo' ? 0.5 : 1;
  ball.charge += growth;
  ball.multiplier = Math.min(PAINT_MULTIPLIER_MAX, ball.multiplier + PAINT_MULTIPLIER_STEP * growth);
  addPoints(world, POINTS_PAINT_TARGET);
  world.sfx.push('paintHit');
}

function applyEnergyHit(world: World, ball: Ball): void {
  const growth = ball.role === 'echo' ? 0.5 : 1;
  ball.accent = true;
  ball.multiplier = Math.min(PAINT_MULTIPLIER_MAX, ball.multiplier + ENERGY_TARGET_MULT_BONUS * growth);
  addPoints(world, POINTS_CHARGE_TARGET);
  world.sfx.push('energyChime');
}

function updateCooldowns(world: World, dt: number): void {
  for (const b of world.bumpers) b.cooldown = Math.max(0, b.cooldown - dt);
  for (const p of world.launchPads) p.cooldown = Math.max(0, p.cooldown - dt);
}

function updateBoss(world: World, dt: number): void {
  if (world.phase !== 'battle') return;
  world.hostileHintTimer = Math.max(0, world.hostileHintTimer - dt);
  const boss = world.boss;
  boss.x = boss.homeX + Math.sin(world.time * BOSS_MOVE_SPEED) * BOSS_MOVE_X;
  boss.y = boss.homeY + Math.sin(world.time * BOSS_MOVE_SPEED * 1.6) * BOSS_MOVE_Y;
  for (const armor of boss.armor) armor.angle += ARMOR_ROTATION_SPEED * dt;
  boss.spawnTimer -= dt;
  // One living boss supports one hostile ball. When encounters gain several
  // bosses, this count is the only value the spawn cadence/cap must consume.
  const livingBosses = boss.hp > 0 ? 1 : 0;
  const hostileCount = world.balls.filter((ball) => ball.role === 'hostile').length;
  if (!livingBosses || boss.spawnTimer > 0 || hostileCount >= livingBosses) return;

  boss.spawnTimer = HOSTILE_SPAWN_INTERVAL / livingBosses;
  const ball = createBall(world.nextBallId++, boss.x, boss.y + boss.r + 8, 'hostile');
  const angle = Math.PI / 2 + Math.sin(world.time * 1.7) * 0.45;
  ball.vx = Math.cos(angle) * HOSTILE_BALL_SPEED;
  ball.vy = Math.sin(angle) * HOSTILE_BALL_SPEED;
  world.balls.push(ball);
  if (!world.hasShownHostileHint) {
    world.hasShownHostileHint = true;
    world.hostileHintTimer = HOSTILE_HINT_DURATION;
  }
  world.sfx.push('hostileSpawn');
}

function checkOutcome(world: World): void {
  if (world.boss.hp <= 0) {
    addPoints(world, POINTS_BOSS_DEFEAT);
    world.phase = 'win';
    world.sfx.push('win');
    world.fx.push({ kind: 'win', x: world.boss.x, y: world.boss.y });
  }
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
