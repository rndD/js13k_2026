import { describe, expect, it } from 'vitest';
import { ARMOR_ORBIT_RADIUS, BOSS_MOVE_X, BOSS_MOVE_Y, FIXED_DT, MAX_SPEED } from '../src/constants';
import { createBall, createWorld } from '../src/entities';
import { step } from '../src/sim';
import { NO_CONTROLS } from '../src/types';

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
});

describe('boss ghost damage', () => {
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
  it('wins when the boss hp reaches zero', () => {
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
    expect(world.phase).toBe('win');
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
  it('consumes one of three core balls and returns to launch when reserve remains', () => {
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
    expect(world.phase).toBe('launch');
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

  it('lets echoes postpone relaunch but never lets hostile balls keep play alive', () => {
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
    expect(world.phase).toBe('launch');

    world.phase = 'battle';
    world.balls = [createBall(3, 180, 300, 'hostile')];
    step(world, NO_CONTROLS, FIXED_DT);
    expect(world.phase).toBe('launch');
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

describe('ball roles', () => {
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
    expect(world.points).toBeGreaterThan(0);
    expect(world.balls.filter((ball) => ball.role === 'hostile')).toHaveLength(0);

    world.boss.spawnTimer = 0;
    step(world, NO_CONTROLS, FIXED_DT);
    expect(world.balls.filter((ball) => ball.role === 'hostile')).toHaveLength(1);

    world.boss.spawnTimer = 0;
    step(world, NO_CONTROLS, FIXED_DT);
    expect(world.balls.filter((ball) => ball.role === 'hostile')).toHaveLength(1);
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
    expect(world.sfx).toContain('echoExpire');
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

  it('exposes the boss after every armor node breaks', () => {
    const world = createWorld();
    world.phase = 'battle';
    for (const armor of world.boss.armor) armor.hp = 0;
    world.balls = [createBall(1, world.boss.x, world.boss.y)];
    const bossHp = world.boss.hp;

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.boss.hp).toBeLessThan(bossHp);
  });
});
