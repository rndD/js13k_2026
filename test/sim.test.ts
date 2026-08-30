import { describe, expect, it } from 'vitest';
import { ARMOR_ORBIT_RADIUS, ARMOR_RING_GAP, AUTO_LAUNCH_DELAY, BOSS_HPS, BOSS_MOVE_X, BOSS_MOVE_Y, ECHO_LIFETIME, FIXED_DT, MAX_SPEED } from '../src/constants';
import { createBall, createBoss, createWorld } from '../src/entities';
import { abilityById, abilityDescription } from '../src/abilities';
import { LEVEL, LEVELS } from '../src/level';
import { step } from '../src/sim';
import { NO_CONTROLS } from '../src/types';
import type { AbilityId } from '../src/types';

function applyUpgrade(world: ReturnType<typeof createWorld>, id: AbilityId): void {
  world.phase = 'pick';
  world.pick = { offers: [id], resumePhase: 'battle', timer: 0, armed: true, selected: 0 };
  step(world, NO_CONTROLS, FIXED_DT);
}

describe('launch', () => {
  it('does nothing while charging, then spawns a ball and enters battle on release', () => {
    const world = createWorld();
    const holding = { ...NO_CONTROLS, launch: true };

    for (let i = 0; i < 10; i++) step(world, holding, FIXED_DT);
    expect(world.phase).toBe('launch');
    expect(world.balls).toHaveLength(0);
    expect(world.launch.power).toBeGreaterThan(0);

    step(world, NO_CONTROLS, FIXED_DT); // release
    expect(world.phase).toBe('battle');
    expect(world.balls).toHaveLength(1);
    expect(world.launch.power).toBe(0);
  });

  it('can immediately launch the next core while echoes remain in play', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.coreBalls = 2;
    const echo = createBall(1, 120, 300, 'echo');
    echo.stability = 5;
    world.balls = [echo];

    step(world, { ...NO_CONTROLS, launch: true }, FIXED_DT);
    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.phase).toBe('battle');
    expect(world.balls.some((ball) => ball.role === 'core')).toBe(true);
    expect(world.balls.some((ball) => ball.role === 'echo')).toBe(true);
    expect(world.coreBalls).toBe(2);
  });

  it('can voluntarily launch a second core while the first is still in play', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.balls = [createBall(1, 120, 300)];

    step(world, { ...NO_CONTROLS, launch: true }, FIXED_DT);
    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.phase).toBe('battle');
    expect(world.balls.filter((ball) => ball.role === 'core')).toHaveLength(2);
    expect(world.coreBalls).toBe(3);
  });

  it('temporary core clones do not consume or block reserve balls', () => {
    const world = createWorld();
    world.phase = 'battle';
    const clone = createBall(1, 120, 300);
    clone.stocked = false;
    world.balls = [clone];

    step(world, { ...NO_CONTROLS, launch: true }, FIXED_DT);
    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.balls.filter((ball) => ball.stocked)).toHaveLength(1);
    expect(world.coreBalls).toBe(3);
  });

  it('automatically launches after ten seconds without a player ball', () => {
    const world = createWorld();

    for (let t = 0; t < AUTO_LAUNCH_DELAY - FIXED_DT; t += FIXED_DT) step(world, NO_CONTROLS, FIXED_DT);
    expect(world.balls).toHaveLength(0);
    expect(world.launch.autoTimer).toBeGreaterThan(9);

    step(world, NO_CONTROLS, FIXED_DT * 2);
    expect(world.phase).toBe('battle');
    expect(world.balls.filter((ball) => ball.role === 'core')).toHaveLength(1);
  });

  it('counts down again when only boss balls remain', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.balls = [createBall(9, 100, 100, 'hostile')];

    for (let t = 0; t < AUTO_LAUNCH_DELAY + FIXED_DT; t += FIXED_DT) step(world, NO_CONTROLS, FIXED_DT);

    expect(world.balls.some((ball) => ball.role === 'core')).toBe(true);
  });
});

describe('boss ghost damage', () => {
  it('damages the boss through an open armor gap while plates remain', () => {
    const world = createWorld();
    world.phase = 'battle';
    const ball = createBall(1, world.boss.x, world.boss.y);
    ball.vx = 0;
    ball.vy = 0;
    world.balls = [ball];
    const bossHp = world.boss.hp;

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.boss.armor.some((armor) => armor.hp > 0)).toBe(true);
    expect(world.boss.hp).toBeLessThan(bossHp);
  });

  it('deals direct damage on overlap but respects the per-ball cooldown', () => {
    const world = createWorld();
    world.phase = 'battle';
    for (const armor of world.boss.armor) armor.hp = 0;
    const ball = createBall(1, world.boss.x, world.boss.y);
    ball.vx = 0;
    ball.vy = 0;
    world.balls = [ball];

    const startHp = world.boss.hp;
    let hits = 0;
    let lastHp = startHp;

    for (let i = 0; i < 40; i++) {
      // pin the ball on the boss so we're only exercising the cooldown logic,
      // not the (irrelevant here) trajectory through the field
      world.balls[0].x = world.boss.x;
      world.balls[0].y = world.boss.y;
      world.balls[0].vx = 0;
      world.balls[0].vy = 0;
      step(world, NO_CONTROLS, FIXED_DT);
      if (world.boss.hp < lastHp) hits += 1;
      lastHp = world.boss.hp;
    }

    // 40 ticks * FIXED_DT (~0.667s) with a 0.25s cooldown should yield 2-3 hits, not 40
    expect(hits).toBeGreaterThanOrEqual(2);
    expect(hits).toBeLessThanOrEqual(4);
    expect(world.boss.hp).toBeLessThan(startHp);
  });

  it('does not physically bounce the ball off the boss', () => {
    const world = createWorld();
    world.phase = 'battle';
    const ball = createBall(1, world.boss.x, world.boss.y);
    ball.vx = 50;
    ball.vy = 0;
    world.balls = [ball];

    step(world, NO_CONTROLS, FIXED_DT);
    // velocity should be unaffected by the boss (only gravity applies)
    expect(world.balls[0].vx).toBe(50);
  });

  it('spends half a power step after directly damaging the boss', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.boss.armor.forEach((armor) => armor.hp = 0);
    const ball = createBall(1, world.boss.x, world.boss.y);
    ball.multiplier = 2;
    world.balls = [ball];
    const hp = world.boss.hp;

    step(world, NO_CONTROLS, FIXED_DT);

    expect(hp - world.boss.hp).toBe(20);
    expect(ball.multiplier).toBe(1.5);
  });

  it('rewards a rainbow ball with 25% more direct damage', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.boss.armor.forEach((armor) => armor.hp = 0);
    const ball = createBall(1, world.boss.x, world.boss.y);
    ball.multiplier = 2;
    ball.color = 'rainbow';
    world.balls = [ball];
    const hp = world.boss.hp;

    step(world, NO_CONTROLS, FIXED_DT);

    expect(hp - world.boss.hp).toBe(25);
  });
});

describe('paint bumper', () => {
  it('grows the ball build and awards points', () => {
    const world = createWorld();
    world.phase = 'battle';
    const bumper = world.bumpers.find((b) => b.kind === 'paint')!;
    const ball = createBall(1, bumper.x + bumper.r + 3, bumper.y);
    ball.vx = -10;
    ball.vy = 0;
    world.balls = [ball];

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.balls[0].charge).toBe(1);
    expect(world.balls[0].multiplier).toBeCloseTo(1.5, 5);
    expect(world.balls[0].color).toBe('red');
    expect(world.points).toBeGreaterThan(0);
  });
});

describe('ball power size', () => {
  it('grows player balls slightly with their multiplier', () => {
    const world = createWorld();
    world.phase = 'battle';
    const ball = createBall(1, 100, 300);
    ball.multiplier = 4;
    const bossBall = createBall(2, 200, 300, 'hostile');
    world.balls = [ball, bossBall];

    step(world, NO_CONTROLS, FIXED_DT);

    expect(ball.r).toBeCloseTo(6.63);
    expect(bossBall.r).toBe(6);
  });
});

describe('energy target', () => {
  it('tags the ball with an accent and increases its multiplier', () => {
    const world = createWorld();
    world.phase = 'battle';
    const target = world.bumpers.find((b) => b.kind === 'energy')!;
    const ball = createBall(1, target.x + target.r + 3, target.y);
    ball.vx = -10;
    ball.vy = 0;
    world.balls = [ball];

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.balls[0].accent).toBe(true);
    expect(world.balls[0].multiplier).toBeGreaterThan(1);
    expect(world.balls[0].color).toBe('blue');
    expect(world.points).toBeGreaterThan(0);
  });
});

describe('upgrade milestones', () => {
  it('pauses at 100 points, grants a free choice, and resumes the frozen fight', () => {
    const world = createWorld();
    world.upgrades[3] = 3;
    world.upgrades[4] = 4;
    world.upgrades[10] = 3;
    world.phase = 'battle';
    world.points = 90;
    const target = world.bumpers.find((bumper) => bumper.kind === 'paint')!;
    const ball = createBall(1, target.x + target.r + 3, target.y);
    ball.vx = -10;
    ball.gunTimer = 1;
    world.balls = [ball];

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.phase).toBe('pick');
    expect(world.points).toBe(110);
    expect(world.nextUpgradeAt).toBe(250);
    expect(world.pick?.offers).toHaveLength(3);
    expect(new Set(world.pick?.offers).size).toBe(3);
    const extraIndex = world.pick!.offers.indexOf(1);
    expect(extraIndex).toBeGreaterThanOrEqual(0);
    const frozen = world.balls.map(({ x, y, vx, vy }) => ({ x, y, vx, vy }));

    step(world, { ...NO_CONTROLS, choice: 0 }, FIXED_DT); // accidental early click is ignored
    for (let i = 0; i < 31; i++) step(world, NO_CONTROLS, FIXED_DT); // wait out the input guard and arm
    expect(world.balls.map(({ x, y, vx, vy }) => ({ x, y, vx, vy }))).toEqual(frozen);
    expect(world.pick?.selected).toBeNull();
    step(world, { ...NO_CONTROLS, left: true }, FIXED_DT);
    expect(world.pick?.selected).toBeNull(); // flipper/arrow controls never select cards
    step(world, { ...NO_CONTROLS, choice: extraIndex }, FIXED_DT);
    expect(world.phase).toBe('pick'); // applies on release, so gameplay input cannot leak through
    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.phase).toBe('battle');
    expect(world.pick).toBeNull();
    expect(world.points).toBe(110);
    expect(world.coreBalls).toBe(5);
    expect(world.upgrades[1]).toBe(1);
  });

  it('queues every crossed Fibonacci milestone even if points later fall', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.points = 510;
    world.balls = [createBall(1, 30, 300)];

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.phase).toBe('pick');
    expect(world.pendingUpgrades).toBe(2);
    expect(world.nextUpgradeAt).toBe(900);
    world.points = 0; // queued choices are earned permanently

    for (let i = 0; i < 3; i++) {
      for (let tick = 0; tick < 31; tick++) step(world, NO_CONTROLS, FIXED_DT);
      const safeIndex = world.pick!.offers.findIndex((id) => id !== 7);
      step(world, { ...NO_CONTROLS, choice: safeIndex }, FIXED_DT);
      step(world, NO_CONTROLS, FIXED_DT);
    }

    expect(world.phase).toBe('battle');
    expect(world.pendingUpgrades).toBe(0);
    expect(world.upgradeCount).toBe(3);
  });

  it('caps late-game upgrade gaps at 5000 points', () => {
    const world = createWorld();
    world.points = 1e6;
    step(world, NO_CONTROLS, FIXED_DT);
    expect(world.upgradeGap).toBe(5000);
    expect(world.nextUpgradeAt - 1e6).toBeLessThanOrEqual(5000);
  });
});

describe('wild upgrades', () => {
  it('explains every sacrifice consequence on the card', () => {
    expect(abilityById(7).description).toEqual([
      'Halve boss HP',
      'Lose balls in play',
      'Pick 2 more cards',
    ]);
  });

  it('adds 2, 3, 4, then 5 stock balls across Extra Ball ranks', () => {
    const world = createWorld();
    world.phase = 'battle';

    for (const expected of [5, 8, 12, 17]) {
      applyUpgrade(world, 1);
      expect(world.coreBalls).toBe(expected);
    }
  });

  it('restores one lost ball every thirty active seconds and pauses at four', () => {
    const world = createWorld();
    world.upgrades[9] = 1;
    world.coreBalls = 2;
    world.launch.autoTimer = -1000;

    for (let i = 0; i < 29 / FIXED_DT; i++) step(world, NO_CONTROLS, FIXED_DT);
    expect(world.coreBalls).toBe(2);
    for (let i = 0; i < 2 / FIXED_DT; i++) step(world, NO_CONTROLS, FIXED_DT);
    expect(world.coreBalls).toBe(3);

    for (let i = 0; i < 31 / FIXED_DT; i++) step(world, NO_CONTROLS, FIXED_DT);
    expect(world.coreBalls).toBe(4);
    world.restoreTimer = 29;
    for (let i = 0; i < 2 / FIXED_DT; i++) step(world, NO_CONTROLS, FIXED_DT);
    expect(world.coreBalls).toBe(4);
    expect(world.restoreTimer).toBe(29);

    world.balls = [createBall(1)];
    for (let i = 0; i < 2 / FIXED_DT; i++) step(world, NO_CONTROLS, FIXED_DT);
    expect(world.coreBalls).toBe(5); // one active plus four actually stored
  });

  it('restores a ball every twenty-five seconds at regen level two', () => {
    const world = createWorld();
    world.upgrades[9] = 2;
    world.coreBalls = 1;
    world.launch.autoTimer = -1000;

    for (let i = 0; i < 24 / FIXED_DT; i++) step(world, NO_CONTROLS, FIXED_DT);
    expect(world.coreBalls).toBe(1);
    for (let i = 0; i < 2 / FIXED_DT; i++) step(world, NO_CONTROLS, FIXED_DT);
    expect(world.coreBalls).toBe(2);
  });

  it('critical chance can double direct ball damage and marks the hit', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.upgrades[10] = 3;
    world.randomSeed = 1;
    world.boss.armor.forEach((armor) => armor.hp = 0);
    const ball = createBall(1, world.boss.x, world.boss.y);
    world.balls = [ball];
    const hp = world.boss.hp;

    step(world, NO_CONTROLS, FIXED_DT);

    expect(hp - world.boss.hp).toBe(20);
    expect(world.fx).toContainEqual(expect.objectContaining({ kind: 'boss', critical: true, amount: 20 }));
  });

  it('auto gun fires gravity-free short-lived shots toward the boss', () => {
    const world = createWorld();
    world.phase = 'battle';
    const ball = createBall(1, 40, 400);
    ball.vy = -300;
    world.balls = [ball];
    world.upgrades[4] = 1;

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.bullets).toHaveLength(1);
    expect(world.bullets[0].vy).toBeLessThan(0);
    const vy = world.bullets[0].vy;
    step(world, NO_CONTROLS, FIXED_DT);
    expect(world.bullets[0].vy).toBe(vy);
    expect(world.bullets[0].lifetime).toBeLessThan(ECHO_LIFETIME);
  });

  it('scales bullet damage from its ball modifier at half strength above x2', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.upgrades[4] = 1;
    const ball = createBall(1, 40, 400);
    ball.vy = -300;
    ball.multiplier = 4;
    world.balls = [ball];

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.bullets[0].damage).toBe(8);
  });

  it('gun shots pass through table geometry', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.bullets = [{ x: 359, y: 300, vx: 420, vy: 0, r: 2, damage: 4, lifetime: 1 }];

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.bullets).toHaveLength(1);
  });

  it('gives player bullets half the normal critical chance', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.upgrades[4] = 1;
    world.upgrades[10] = 3;
    const ball = createBall(1, 40, 400);
    ball.vy = -300;
    world.balls = [ball];

    world.randomSeed = 1;
    step(world, NO_CONTROLS, FIXED_DT);
    expect(world.bullets[0].critical).toBe(false);

    world.bullets = [];
    ball.gunTimer = 0;
    world.randomSeed = 1972;
    step(world, NO_CONTROLS, FIXED_DT);
    expect(world.bullets[0].critical).toBe(true);
  });

  it('critical bullets deal double damage and mark the hit', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.boss.armor.forEach((armor) => armor.hp = 0);
    world.bullets = [{ x: world.boss.x, y: world.boss.y, vx: 0, vy: 0, r: 2, damage: 4, lifetime: 1, critical: true }];
    const hp = world.boss.hp;

    step(world, NO_CONTROLS, FIXED_DT);

    expect(hp - world.boss.hp).toBe(8);
    expect(world.fx).toContainEqual(expect.objectContaining({ kind: 'boss', amount: 8, critical: true }));
  });

  it('does not fire while the ball is still at the launcher', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.upgrades[4] = 1;
    const ball = createBall(1, world.launch.x, world.launch.y);
    world.balls = [ball];

    step(world, NO_CONTROLS, FIXED_DT);
    expect(world.sfx).not.toContain('gunShot');

    ball.x = 80;
    ball.y -= 30;
    ball.vy = -300;
    step(world, NO_CONTROLS, FIXED_DT);
    expect(world.sfx).toContain('gunShot');
  });

  it('raises base power of current player balls by 0.5, 1, then 2.5', () => {
    const world = createWorld();
    world.phase = 'battle';
    const mine = createBall(1, 80, 300);
    const bossBall = createBall(2, 160, 300, 'hostile');
    world.balls = [mine, bossBall];
    world.nextBallId = 3;

    applyUpgrade(world, 5);
    expect(mine.multiplier).toBe(1.5);
    applyUpgrade(world, 5);
    expect(mine.multiplier).toBe(2.5);
    applyUpgrade(world, 5);

    expect(mine.multiplier).toBe(5);
    expect(bossBall.multiplier).toBe(1);

    step(world, { ...NO_CONTROLS, launch: true }, FIXED_DT);
    step(world, NO_CONTROLS, FIXED_DT);
    expect(world.balls.find((ball) => ball.id === 3)!.multiplier).toBe(5);
  });

  it('makes current and future player balls permanently rainbow', () => {
    const world = createWorld();
    world.phase = 'battle';
    const mine = createBall(1, 80, 300);
    const hostile = createBall(2, 160, 300, 'hostile');
    world.balls = [mine, hostile];
    world.nextBallId = 3;

    applyUpgrade(world, 13);
    expect(mine.color).toBe('rainbow');
    expect(hostile.color).not.toBe('rainbow');

    step(world, { ...NO_CONTROLS, launch: true }, FIXED_DT);
    step(world, NO_CONTROLS, FIXED_DT);
    expect(mine.color).toBe('rainbow');
    expect(world.balls.find((ball) => ball.id === 3)!.color).toBe('rainbow');
  });

  it('never drains player balls below their upgraded base power', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.upgrades[5] = 3;
    for (const armor of world.boss.armor) armor.hp = 0;
    const ball = createBall(1, world.boss.x, world.boss.y);
    ball.multiplier = 5;
    world.balls = [ball];

    step(world, NO_CONTROLS, FIXED_DT);

    expect(ball.multiplier).toBe(5);
  });

  it('tracks damage dealt during the latest three seconds', () => {
    const world = createWorld();
    world.phase = 'battle';
    for (const armor of world.boss.armor) armor.hp = 0;
    world.balls = [createBall(1, world.boss.x, world.boss.y)];

    step(world, NO_CONTROLS, FIXED_DT);
    expect(world.damageLog.reduce((sum, hit) => sum + hit[1], 0)).toBe(10);

    world.phase = 'pick';
    world.pick = null;
    for (let i = 0; i < 181; i++) step(world, NO_CONTROLS, FIXED_DT);
    expect(world.damageLog).toHaveLength(1);

    world.phase = 'transition';
    world.transitionTimer = 20;
    for (let i = 0; i < 181; i++) step(world, NO_CONTROLS, FIXED_DT);
    expect(world.damageLog).toHaveLength(0);
  });

  it('animates toward damage-driven vibrancy instead of changing instantly', () => {
    const world = createWorld();
    const idle = createWorld();
    world.phase = 'pick';
    idle.phase = 'pick';
    world.damageLog = [[0, 150]];

    step(world, NO_CONTROLS, FIXED_DT);
    expect(world.vibrancy).toBeGreaterThan(0);
    expect(world.vibrancy).toBeLessThan(1);
    for (let i = 0; i < 180; i++) {
      step(world, NO_CONTROLS, FIXED_DT);
      step(idle, NO_CONTROLS, FIXED_DT);
    }
    expect(world.vibrancy).toBeGreaterThan(0.99);
    expect(world.spectrumPhase).toBeGreaterThan(idle.spectrumPhase * 2);

    world.damageLog = [[world.time, 300]];
    const phase = world.spectrumPhase;
    step(world, NO_CONTROLS, 1);
    expect(world.spectrumPhase - phase).toBeCloseTo(8.2);
  });

  it('splits every current player-owned ball but not boss balls', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.balls = [createBall(1, 80, 300), createBall(2, 160, 300, 'echo'), createBall(3, 220, 300, 'hostile')];

    applyUpgrade(world, 6);

    expect(world.balls.filter((ball) => ball.role !== 'hostile')).toHaveLength(4);
    expect(world.balls.filter((ball) => ball.role === 'hostile')).toHaveLength(1);
    expect(new Set(world.balls.map((ball) => ball.id)).size).toBe(world.balls.length);

    applyUpgrade(world, 6);

    expect(world.balls.filter((ball) => ball.role !== 'hostile')).toHaveLength(16);
    expect(world.balls.filter((ball) => ball.role === 'hostile')).toHaveLength(1);
    expect(abilityDescription(abilityById(6), 1)).toEqual(['Quadruple all', 'your balls in play']);
  });

  it('sacrifice halves boss life, bursts every ball, and grants two choices', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.boss.hp = 301;
    world.balls = [createBall(1, 80, 300), createBall(2, 160, 300, 'hostile')];

    applyUpgrade(world, 7);

    expect(world.boss.hp).toBe(151);
    expect(world.balls).toHaveLength(0);
    expect(world.phase).toBe('pick');
    expect(world.pendingUpgrades).toBe(1);
    expect(world.coreBalls).toBe(2);
    expect(world.sfx.filter((event) => event === 'ballExplode')).toHaveLength(2);
  });

  it('boss magnet curves player-owned balls but not boss balls', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.upgrades[8] = 1;
    const mine = createBall(1, 40, world.boss.y);
    const bossBall = createBall(2, 40, world.boss.y, 'hostile');
    world.balls = [mine, bossBall];

    step(world, NO_CONTROLS, FIXED_DT);

    expect(mine.vx).toBeGreaterThan(0);
    expect(bossBall.vx).toBe(0);
  });

  it('poison adds delayed damage after a direct boss hit', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.upgrades[3] = 1;
    world.boss.armor.forEach((armor) => armor.hp = 0);
    world.balls = [createBall(1, world.boss.x, world.boss.y)];
    const hp = world.boss.hp;

    step(world, NO_CONTROLS, FIXED_DT);
    expect(world.boss.hp).toBe(hp - 10);
    expect(world.boss.poisonDamage).toBe(8);
    world.balls = [];
    for (let i = 0; i < 61; i++) step(world, NO_CONTROLS, FIXED_DT);

    expect(world.boss.hp).toBe(hp - 18);
    expect(world.boss.poisonDamage).toBe(0);
  });
});

describe('combat model', () => {
  it('does not expose the removed projectile, shield, base, or overload systems', () => {
    const world = createWorld();
    expect('projectiles' in world).toBe(false);
    expect('shield' in world).toBe(false);
    expect('base' in world).toBe(false);
    expect('overloadTimer' in world.boss).toBe(false);
    expect('overloadCharging' in world.boss).toBe(false);
    expect('overloadProgress' in world.boss).toBe(false);
  });
});

describe('outcomes', () => {
  it('advances after the first boss and wins after the fifth', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.boss.hp = 5;
    for (const armor of world.boss.armor) armor.hp = 0;
    const ball = createBall(1, world.boss.x, world.boss.y);
    ball.vx = 0;
    ball.vy = 0;
    world.balls = [ball];

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.boss.hp).toBe(0);
    expect(world.phase).toBe('transition');
    expect(world.fx).toContainEqual(expect.objectContaining({ kind: 'win' }));
    expect(world.sfx).toContain('ballExplode');

    for (let i = 0; i < 121; i++) step(world, NO_CONTROLS, FIXED_DT);
    expect(world.phase).toBe('launch');
    expect(world.boss.rank).toBe(1);
    expect(world.boss.armor).toHaveLength(9);

    world.phase = 'battle';
    world.boss.rank = 4;
    world.boss.hp = 0;
    step(world, NO_CONTROLS, FIXED_DT);
    expect(world.phase).toBe('win');
  });

  it('banks temporary player balls, discards hostiles, and changes production table', () => {
    const world = createWorld(LEVELS[0], 0);
    world.phase = 'battle';
    const core = createBall(1, 40, 400);
    const clone = createBall(2, 80, 400);
    clone.stocked = false;
    const echo = createBall(3, 120, 400, 'echo');
    const hostile = createBall(4, 160, 400, 'hostile');
    world.balls = [core, clone, echo, hostile];
    world.boss.hp = 0;

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.coreBalls).toBe(6); // two temporary survivors plus level reward
    expect(world.balls).toHaveLength(0);
    for (let i = 0; i < 121; i++) step(world, NO_CONTROLS, FIXED_DT);
    expect(world.tableIndex).toBe(1);
    expect(world.bumpers).toHaveLength(LEVELS[1].bumpers.length);
  });

  it('boss three warns before destroying nearby player balls only', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.boss = createBoss(LEVEL.boss, 2);
    world.boss.warningTimer = FIXED_DT / 2;
    const core = createBall(1, world.boss.x + 20, world.boss.y);
    const hostile = createBall(2, world.boss.x + 20, world.boss.y, 'hostile');
    world.balls = [core, hostile];

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.balls).toEqual([hostile]);
    expect(world.coreBalls).toBe(2);
  });

  it('boss three starts its warning before the blast becomes dangerous', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.boss = createBoss(LEVEL.boss, 2);
    world.boss.specialTimer = 0;
    const core = createBall(1, world.boss.x + 20, world.boss.y);
    world.balls = [core];

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.boss.warningTimer).toBeGreaterThan(0);
    expect(world.balls).toContain(core);
  });

  it('gives boss four two counter-rotating armor rings and every remaining attack', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.boss = createBoss(LEVEL.boss, 3);
    world.boss.specialTimer = 0;
    world.boss.spawnTimer = 0;
    world.balls = [createBall(1, 180, 500)];
    const inner = world.boss.armor.find((armor) => armor.ring === 0)!;
    const outer = world.boss.armor.find((armor) => armor.ring === 1)!;
    const innerAngle = inner.angle;
    const outerAngle = outer.angle;

    expect(world.boss.hp).toBe(BOSS_HPS[3]);
    expect(world.boss.armor.filter((armor) => armor.ring === 0)).toHaveLength(9);
    expect(world.boss.armor.filter((armor) => armor.ring === 1)).toHaveLength(9);
    step(world, NO_CONTROLS, FIXED_DT);

    expect(inner.angle).toBeGreaterThan(innerAngle);
    expect(outer.angle).toBeLessThan(outerAngle);
    expect(world.boss.warningTimer).toBeGreaterThan(0);
    expect(world.balls.some((ball) => ball.role === 'hostile')).toBe(true);
    expect(ARMOR_ORBIT_RADIUS + ARMOR_RING_GAP).toBe(56);
  });

  it('gives boss five more health, three armor rings, and faster destruction fields', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.boss = createBoss(LEVEL.boss, 4);
    world.boss.specialTimer = 0;
    world.balls = [createBall(1, 180, 500)];

    expect(world.boss.hp).toBe(5000);
    expect(world.boss.armor).toHaveLength(27);
    for (let ring = 0; ring < 3; ring++) {
      expect(world.boss.armor.filter((armor) => armor.ring === ring)).toHaveLength(9);
    }

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.boss.warningTimer).toBeGreaterThan(0);
    expect(world.boss.specialTimer).toBe(8);
  });

  it('fires a geometry-piercing paint shot with Auto Gun bonus damage', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.upgrades[11] = 1;
    world.upgrades[4] = 3;
    const target = world.bumpers.find((bumper) => bumper.kind === 'paint')!;
    const ball = createBall(1, target.x + target.r + 3, target.y);
    ball.vx = -10;
    world.balls = [ball];

    step(world, NO_CONTROLS, FIXED_DT);

    const shot = world.bullets.find((bullet) => bullet.paint)!;
    expect(shot).toBeDefined();
    expect(shot.damage).toBe(24);
  });

  it('can spawn an echo above the boss from an energy bumper', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.upgrades[12] = 3;
    world.randomSeed = 0;
    const target = world.bumpers.find((bumper) => bumper.kind === 'energy')!;
    const ball = createBall(1, target.x + target.r + 3, target.y);
    ball.vx = -10;
    world.balls = [ball];

    step(world, NO_CONTROLS, FIXED_DT);

    const echo = world.balls.find((candidate) => candidate.role === 'echo')!;
    expect(echo).toBeDefined();
    expect(Math.abs(echo.x - world.boss.x)).toBeLessThan(2);
    expect(echo.y).toBeLessThan(world.boss.y);
    expect(echo.stocked).toBe(false);
  });

  it('shows the stronger Blue Bumper temporary-ball chances', () => {
    expect([0, 1, 2].map((rank) => abilityDescription(abilityById(12), rank)[0])).toEqual([
      'Blue bumper: 18%',
      'Blue bumper: 38%',
      'Blue bumper: 60%',
    ]);
  });

  it('pauses the run timer during card choices but counts transitions', () => {
    const world = createWorld();
    world.phase = 'pick';
    world.pick = { offers: [3], resumePhase: 'battle', timer: 1, armed: false, selected: null };
    step(world, NO_CONTROLS, 1);
    expect(world.time).toBe(0);
    world.phase = 'transition';
    world.transitionTimer = 2;
    step(world, NO_CONTROLS, 1);
    expect(world.time).toBe(1);
  });

  it('freezes the world once a win/lose outcome is reached', () => {
    const world = createWorld();
    world.phase = 'win';
    world.boss.hp = 0;
    const before = JSON.stringify(world);
    step(world, { ...NO_CONTROLS, left: true }, FIXED_DT);
    expect(JSON.stringify(world)).toBe(before);
  });
});

describe('drain', () => {
  it('consumes a core ball without interrupting battle when reserve remains', () => {
    const world = createWorld();
    expect(world.coreBalls).toBe(3);
    world.points = 40;
    world.phase = 'battle';
    const ball = createBall(1, 180, 700); // inside the drain x-range, below the field
    ball.vx = 0;
    ball.vy = 50;
    world.balls = [ball];

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.balls).toHaveLength(0);
    expect(world.coreBalls).toBe(2);
    expect(world.points).toBe(0);
    expect(world.phase).toBe('battle');
  });

  it('loses when the final core ball drains', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.coreBalls = 1;
    world.balls = [createBall(1, 180, 700)];

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.coreBalls).toBe(0);
    expect(world.phase).toBe('lose');
  });

  it('keeps battle live between reserve launches but hostiles cannot prevent final defeat', () => {
    const world = createWorld();
    world.phase = 'battle';
    const core = createBall(1, 180, 700);
    const echo = createBall(2, 100, 300, 'echo');
    echo.stability = 5;
    world.balls = [core, echo];

    step(world, NO_CONTROLS, FIXED_DT);
    expect(world.phase).toBe('battle');
    expect(world.balls).toHaveLength(1);

    world.balls[0].y = 700;
    step(world, NO_CONTROLS, FIXED_DT);
    expect(world.phase).toBe('battle');

    world.coreBalls = 0;
    world.balls = [createBall(3, 180, 300, 'hostile')];
    step(world, NO_CONTROLS, FIXED_DT);
    expect(world.phase).toBe('lose');
    expect(world.balls).toHaveLength(0);
  });
});

describe('flipper tunneling', () => {
  it('does not let a max-speed ball tunnel through a resting flipper in one tick', () => {
    // Regression test: a ball moving at MAX_SPEED covers ~15px per 60fps tick,
    // close to the flipper's ~14px collision half-width. Without substepping
    // the ball's position, a single-step overlap check taken only at the end
    // of the tick could miss the flipper entirely (tunneling straight through).
    const world = createWorld();
    world.phase = 'battle';
    const flipper = world.flippers[0]; // left, at rest
    const tipX = flipper.pivot.x + Math.cos(flipper.angle) * flipper.length;
    const tipY = flipper.pivot.y + Math.sin(flipper.angle) * flipper.length;
    const midX = (flipper.pivot.x + tipX) / 2;
    const midY = (flipper.pivot.y + tipY) / 2;

    const ball = createBall(1, midX, midY - 12); // just above the flipper's surface
    ball.vx = 0;
    ball.vy = MAX_SPEED;
    world.balls = [ball];

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.balls).toHaveLength(1);
    // The ball must have been stopped/deflected by the flipper, not have
    // tunneled straight past it.
    expect(world.balls[0].y).toBeLessThan(midY + 20);
  });
});

function ballOnFlipper(role: 'core' | 'hostile' | 'echo') {
  const world = createWorld();
  world.phase = 'battle';
  const flipper = world.flippers[0];
  flipper.angle = flipper.activeAngle;
  const ball = createBall(
    1,
    flipper.pivot.x + Math.cos(flipper.angle) * flipper.length * 0.5,
    flipper.pivot.y + Math.sin(flipper.angle) * flipper.length * 0.5 - 10,
    role,
  );

  ball.vy = 100;
  world.balls = [ball];
  return world;
}

describe('contact sound limiting', () => {
  it('emits one wall sound and structure splat per ball every ten simulation ticks', () => {
    const world = createWorld();
    world.phase = 'battle';
    const ball = createBall(1, 3, 350);
    world.balls = [ball];

    const wallSounds: number[] = [];
    const splats: number[] = [];
    for (let tick = 0; tick < 11; tick++) {
      ball.x = 3;
      ball.vx = -100;
      step(world, NO_CONTROLS, FIXED_DT);
      if (world.sfx.includes('wallTick')) wallSounds.push(tick);
      if (world.contacts.some((contact) => contact.kind === 'structure')) splats.push(tick);
    }

    expect(wallSounds).toEqual([0, 10]);
    expect(splats).toEqual(wallSounds);
  });
});

describe('ball roles', () => {
  it('automatically aims a nearby core ball after gaining Auto Flippers', () => {
    const world = ballOnFlipper('core');
    expect(world.upgrades[14]).toBe(0);
    world.upgrades[14] = 1;

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.flippers[0].active).toBe(true);
    expect(world.phase).toBe('aim');
    expect(world.aim?.sweepT).toBe(0.5);
    step(world, NO_CONTROLS, FIXED_DT);
    expect(world.phase).toBe('battle');
    expect(world.balls[0].vy).toBeLessThan(0);
  });

  it('removes non-core balls when their lifetime runs out but never times out cores', () => {
    const world = createWorld();
    world.phase = 'battle';
    const core = createBall(1, 100, 300);
    const hostile = createBall(2, 180, 300, 'hostile');
    const echo = createBall(3, 260, 300, 'echo');
    hostile.lifetime = FIXED_DT / 2;
    echo.lifetime = FIXED_DT / 2;
    echo.stability = 5;
    world.balls = [core, hostile, echo];

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.balls).toEqual([core]);
    expect(world.sfx.filter((event) => event === 'ballExplode')).toHaveLength(2);
    expect(world.fx.map((event) => event.kind)).toEqual(['hostileBurst', 'echoBurst']);
  });

  it('lets only the core ball open precision aim', () => {
    const coreWorld = ballOnFlipper('core');
    step(coreWorld, { ...NO_CONTROLS, left: true }, FIXED_DT);
    expect(coreWorld.phase).toBe('aim');

    const echoWorld = ballOnFlipper('echo');
    echoWorld.balls[0].stability = 5;
    step(echoWorld, { ...NO_CONTROLS, left: true }, FIXED_DT);
    expect(echoWorld.phase).toBe('battle');
    expect(echoWorld.aim).toBeNull();
  });

  it('spawns at most one hostile ball and converts it on an active flipper', () => {
    const world = ballOnFlipper('hostile');
    world.boss.spawnTimer = 0;

    step(world, { ...NO_CONTROLS, left: true }, FIXED_DT);

    const converted = world.balls.find((ball) => ball.id === 1)!;
    expect(converted.role).toBe('echo');
    expect(converted.stability).toBe(5);
    expect(converted.lifetime).toBe(ECHO_LIFETIME);
    expect(world.points).toBeGreaterThan(0);
    expect(world.balls.filter((ball) => ball.role === 'hostile')).toHaveLength(0);

    world.boss.spawnTimer = 0;
    step(world, NO_CONTROLS, FIXED_DT);
    expect(world.balls.filter((ball) => ball.role === 'hostile')).toHaveLength(1);

    world.boss.spawnTimer = 0;
    step(world, NO_CONTROLS, FIXED_DT);
    expect(world.balls.filter((ball) => ball.role === 'hostile')).toHaveLength(1);
  });

  it('makes captured echoes stronger with Recruiter ranks', () => {
    const world = ballOnFlipper('hostile');
    world.upgrades[2] = 2;
    world.upgrades[5] = 2;

    step(world, { ...NO_CONTROLS, left: true }, FIXED_DT);

    const echo = world.balls.find((ball) => ball.id === 1)!;
    expect(echo.role).toBe('echo');
    expect(echo.charge).toBe(2);
    expect(echo.multiplier).toBe(4.5);
    expect(echo.stability).toBe(20);
    expect(echo.lifetime).toBe(60);
    expect(abilityDescription(abilityById(2), 2)).toEqual(['Temporary balls', 'hit harder &', 'last longer']);
  });

  it('upgrades current echoes to 10, 20, then 40 useful hits', () => {
    const world = createWorld();
    world.phase = 'battle';
    const echo = createBall(1, 180, 300, 'echo');
    world.balls = [echo];

    applyUpgrade(world, 2);
    expect([echo.multiplier, echo.stability, echo.lifetime]).toEqual([2, 10, 30]);
    applyUpgrade(world, 2);
    expect([echo.multiplier, echo.stability, echo.lifetime]).toEqual([3, 20, 60]);
    applyUpgrade(world, 2);
    expect([echo.multiplier, echo.stability, echo.lifetime]).toEqual([4, 40, 120]);
  });

  it('lets hostile balls pass through pegs on their way to the flippers', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.walls = [];
    world.bumpers = [];
    world.launchPads = [];
    world.pegs = [{ x: 180, y: 300, r: 8 }];
    const hostile = createBall(1, 192, 300, 'hostile');
    hostile.vx = -10;
    world.balls = [hostile];

    step(world, NO_CONTROLS, FIXED_DT);

    expect(hostile.vx).toBe(-10);
    expect(world.contacts).toEqual([]);
  });

  it('relaunches a ball that escaped through a non-drain boundary', () => {
    const world = createWorld();
    world.phase = 'battle';
    const ball = createBall(1, -100, 300);
    ball.multiplier = 3;
    world.balls = [ball];

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.balls).toEqual([ball]);
    expect(ball.x).toBeGreaterThan(world.launch.x - 5);
    expect(ball.y).toBeLessThan(world.launch.y);
    expect(ball.vy).toBeLessThan(0);
    expect(ball.multiplier).toBe(3);
    expect(world.coreBalls).toBe(3);
  });

  it('does not convert a hostile on passive flipper contact', () => {
    const world = ballOnFlipper('hostile');
    world.upgrades[14] = 0;
    world.balls.push(createBall(2, 30, 300));

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.balls.find((ball) => ball.id === 1)?.role).toBe('hostile');
    expect(world.aim).toBeNull();
  });

  it('does not let hostile balls earn target rewards or damage the boss', () => {
    const targetWorld = createWorld();
    targetWorld.phase = 'battle';
    const target = targetWorld.bumpers.find((bumper) => bumper.kind === 'paint')!;
    const hostile = createBall(1, target.x + target.r + 3, target.y, 'hostile');
    hostile.vx = -10;
    targetWorld.balls = [hostile, createBall(2, 30, 300)];
    step(targetWorld, NO_CONTROLS, FIXED_DT);
    expect(targetWorld.balls[0].charge).toBe(0);
    expect(targetWorld.balls[0].vx).toBe(-10);
    expect(targetWorld.points).toBe(0);

    const bossWorld = createWorld();
    bossWorld.phase = 'battle';
    for (const armor of bossWorld.boss.armor) armor.hp = 0;
    bossWorld.balls = [createBall(1, bossWorld.boss.x, bossWorld.boss.y, 'hostile'), createBall(2, 30, 300)];
    const hp = bossWorld.boss.hp;
    step(bossWorld, NO_CONTROLS, FIXED_DT);
    expect(bossWorld.boss.hp).toBe(hp);
  });

  it('lets hostile balls pass through launch pads', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.walls = [];
    world.pegs = [];
    world.bumpers = [];
    world.launchPads = [{ x: 180, y: 300, angle: 0, cooldown: 0 }];
    const hostile = createBall(1, 180, 300, 'hostile');
    hostile.vx = -10;
    world.balls = [hostile];

    step(world, NO_CONTROLS, FIXED_DT);

    expect(hostile.vx).toBe(-10);
    expect(world.sfx).not.toContain('padBoost');
  });

  it('gives echoes half build growth and spends stability only after a useful hit', () => {
    const coreWorld = createWorld();
    coreWorld.phase = 'battle';
    const coreTarget = coreWorld.bumpers.find((bumper) => bumper.kind === 'paint')!;
    const core = createBall(1, coreTarget.x + coreTarget.r + 3, coreTarget.y);
    core.vx = -10;
    coreWorld.balls = [core];
    step(coreWorld, NO_CONTROLS, FIXED_DT);

    const echoWorld = createWorld();
    echoWorld.phase = 'battle';
    const echoTarget = echoWorld.bumpers.find((bumper) => bumper.kind === 'paint')!;
    const echo = createBall(1, echoTarget.x + echoTarget.r + 3, echoTarget.y, 'echo');
    echo.vx = -10;
    echo.stability = 5;
    echoWorld.balls = [echo];
    step(echoWorld, NO_CONTROLS, FIXED_DT);

    expect(echoWorld.balls[0].charge).toBeCloseTo(coreWorld.balls[0].charge * 0.5);
    expect(echoWorld.balls[0].multiplier - 1).toBeCloseTo((coreWorld.balls[0].multiplier - 1) * 0.5);
    expect(echoWorld.balls[0].stability).toBe(4);
  });

  it('resolves an echo final useful hit before the echo expires', () => {
    const world = createWorld();
    world.phase = 'battle';
    const target = world.bumpers.find((bumper) => bumper.kind === 'paint')!;
    const echo = createBall(1, target.x + target.r + 3, target.y, 'echo');
    echo.vx = -10;
    echo.stability = 1;
    world.balls = [echo];
    const pointsBefore = world.points;

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.points).toBeGreaterThan(pointsBefore);
    expect(world.balls).toHaveLength(0);
    expect(world.sfx).toContain('ballExplode');
  });

  it('does not spend echo stability on structure or flipper contact', () => {
    const wallWorld = createWorld();
    wallWorld.phase = 'battle';
    const wallEcho = createBall(1, 3, 350, 'echo');
    wallEcho.vx = -100;
    wallEcho.stability = 5;
    wallWorld.balls = [wallEcho];
    step(wallWorld, NO_CONTROLS, FIXED_DT);
    expect(wallWorld.balls[0].stability).toBe(5);

    const flipperWorld = ballOnFlipper('echo');
    flipperWorld.balls[0].stability = 5;
    step(flipperWorld, { ...NO_CONTROLS, left: true }, FIXED_DT);
    expect(flipperWorld.balls[0].stability).toBe(5);
  });

  it('lets overlapping balls pass through without changing each other', () => {
    const world = createWorld();
    world.phase = 'battle';
    const left = createBall(1, 180, 350);
    const right = createBall(2, 180, 350, 'echo');
    left.vx = -100;
    right.vx = 100;
    right.stability = 5;
    world.balls = [left, right];

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.balls[0].vx).toBe(-100);
    expect(world.balls[1].vx).toBe(100);
  });
});

describe('moving armored boss', () => {
  it('drifts smoothly inside its compact horizontal and vertical range', () => {
    const world = createWorld();
    world.phase = 'battle';
    const { homeX, homeY } = world.boss;
    world.balls = [createBall(1, 180, 350)];
    world.balls[0].vx = 100;

    for (let i = 0; i < 120; i++) step(world, NO_CONTROLS, FIXED_DT);

    expect(world.boss.x).not.toBe(homeX);
    expect(world.boss.y).not.toBe(homeY);
    expect(Math.abs(world.boss.x - homeX)).toBeLessThanOrEqual(BOSS_MOVE_X);
    expect(Math.abs(world.boss.y - homeY)).toBeLessThanOrEqual(BOSS_MOVE_Y);
  });

  it('deflects player balls into armor without damaging the protected boss', () => {
    const world = createWorld();
    world.phase = 'battle';
    const armor = world.boss.armor[0];
    const ball = createBall(
      1,
      world.boss.x + Math.cos(armor.angle) * ARMOR_ORBIT_RADIUS,
      world.boss.y + Math.sin(armor.angle) * ARMOR_ORBIT_RADIUS,
    );
    world.balls = [ball];
    const bossHp = world.boss.hp;
    const armorHp = armor.hp;

    step(world, NO_CONTROLS, FIXED_DT);

    expect(armor.hp).toBeLessThan(armorHp);
    expect(world.boss.hp).toBe(bossHp);
    expect(world.points).toBeGreaterThan(0);
  });

  it('lets hostile balls pass through boss armor', () => {
    const world = createWorld();
    world.phase = 'battle';
    const armor = world.boss.armor[0];
    const ball = createBall(1, world.boss.x + Math.cos(armor.angle) * ARMOR_ORBIT_RADIUS, world.boss.y + Math.sin(armor.angle) * ARMOR_ORBIT_RADIUS, 'hostile');
    world.balls = [ball];

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.contacts.some((contact) => contact.kind === 'armor')).toBe(false);
    expect(armor.hp).toBe(armor.maxHp);
  });

  it('spends power after directly damaging armor', () => {
    const world = createWorld();
    world.phase = 'battle';
    const armor = world.boss.armor[0];
    const ball = createBall(1, world.boss.x + Math.cos(armor.angle) * ARMOR_ORBIT_RADIUS, world.boss.y + Math.sin(armor.angle) * ARMOR_ORBIT_RADIUS);
    ball.multiplier = 2;
    world.balls = [ball];

    step(world, NO_CONTROLS, FIXED_DT);

    expect(armor.hp).toBeLessThan(armor.maxHp);
    expect(ball.multiplier).toBe(1.5);
  });

  it('lets a ball pass through a gap between curved armor plates', () => {
    const world = createWorld();
    world.phase = 'battle';
    const gapAngle = Math.PI / 3;
    const ball = createBall(
      1,
      world.boss.x + Math.cos(gapAngle) * ARMOR_ORBIT_RADIUS,
      world.boss.y + Math.sin(gapAngle) * ARMOR_ORBIT_RADIUS,
    );
    world.balls = [ball];
    const armorHp = world.boss.armor.map((armor) => armor.hp);

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.boss.armor.map((armor) => armor.hp)).toEqual(armorHp);
  });

  it('exposes the boss after every armor node breaks', () => {
    const world = createWorld();
    world.phase = 'battle';
    for (const armor of world.boss.armor) armor.hp = 0;
    world.balls = [createBall(1, world.boss.x, world.boss.y)];
    const bossHp = world.boss.hp;

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.boss.hp).toBeLessThan(bossHp);
  });

  it('does not double-hit the boss on the same contact that breaks the final armor', () => {
    const world = createWorld();
    world.phase = 'battle';
    for (const armor of world.boss.armor) armor.hp = 0;
    const armor = world.boss.armor[0];
    armor.hp = 1;
    const ball = createBall(
      1,
      world.boss.x + Math.cos(armor.angle) * ARMOR_ORBIT_RADIUS,
      world.boss.y + Math.sin(armor.angle) * ARMOR_ORBIT_RADIUS,
    );
    world.balls = [ball];
    const bossHp = world.boss.hp;

    step(world, NO_CONTROLS, FIXED_DT);

    expect(armor.hp).toBe(0);
    expect(world.boss.hp).toBe(bossHp);
  });

});
