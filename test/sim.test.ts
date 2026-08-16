import { describe, expect, it } from 'vitest';
import { BASE_MAX_HP, FIXED_DT, MAX_SPEED } from '../src/constants';
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
  it('grows the ball build and damages the boss on hit', () => {
    const world = createWorld();
    world.phase = 'battle';
    const bumper = world.paintBumper;
    const ball = createBall(1, bumper.x + bumper.r + 3, bumper.y);
    ball.vx = -10;
    ball.vy = 0;
    world.balls = [ball];

    const startHp = world.boss.hp;
    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.balls[0].charge).toBe(1);
    expect(world.balls[0].multiplier).toBeCloseTo(1.5, 5);
    expect(world.balls[0].color).toBe('red');
    expect(world.boss.hp).toBeLessThan(startHp);
  });
});

describe('energy target', () => {
  it('restores shield energy and tags the ball with an accent', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.shield.energy = 0;
    const target = world.energyTarget;
    const ball = createBall(1, target.x + target.r + 3, target.y);
    ball.vx = -10;
    ball.vy = 0;
    world.balls = [ball];

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.shield.energy).toBeGreaterThan(0);
    expect(world.balls[0].accent).toBe(true);
    expect(world.balls[0].color).toBe('blue');
  });
});

describe('shield vs base', () => {
  it('absorbs projectile damage into the shield when active with energy', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.balls = [createBall(1, -100, -100)]; // keep a ball alive so phase stays 'battle'
    world.shield.energy = world.shield.maxEnergy;
    world.projectiles = [{ x: 180, y: 599, vx: 0, vy: 100, r: 7, damage: 20, big: false }];

    step(world, { ...NO_CONTROLS, shield: true }, FIXED_DT);

    expect(world.base.hp).toBe(BASE_MAX_HP);
    expect(world.shield.hp).toBeLessThan(world.shield.maxHp);
    expect(world.projectiles).toHaveLength(0);
  });

  it('damages the base when the shield is not raised', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.balls = [createBall(1, -100, -100)];
    world.projectiles = [{ x: 180, y: 599, vx: 0, vy: 100, r: 7, damage: 20, big: false }];

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.base.hp).toBe(BASE_MAX_HP - 20);
    expect(world.shield.hp).toBe(world.shield.maxHp);
  });
});

describe('outcomes', () => {
  it('wins when the boss hp reaches zero', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.boss.hp = 5;
    const ball = createBall(1, world.boss.x, world.boss.y);
    ball.vx = 0;
    ball.vy = 0;
    world.balls = [ball];

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.boss.hp).toBe(0);
    expect(world.phase).toBe('win');
  });

  it('loses when the base hp reaches zero', () => {
    const world = createWorld();
    world.phase = 'battle';
    world.balls = [createBall(1, -100, -100)];
    world.base.hp = 15;
    world.projectiles = [{ x: 180, y: 599, vx: 0, vy: 100, r: 7, damage: 20, big: false }];

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.base.hp).toBe(0);
    expect(world.phase).toBe('lose');
  });

  it('freezes the world once a win/lose outcome is reached', () => {
    const world = createWorld();
    world.phase = 'win';
    world.boss.hp = 0;
    const before = JSON.stringify(world);
    step(world, { ...NO_CONTROLS, left: true, shield: true }, FIXED_DT);
    expect(JSON.stringify(world)).toBe(before);
  });
});

describe('drain', () => {
  it('resets phase to launch once the last ball is drained', () => {
    const world = createWorld();
    world.phase = 'battle';
    const ball = createBall(1, 180, 700); // inside the drain x-range, below the field
    ball.vx = 0;
    ball.vy = 50;
    world.balls = [ball];

    step(world, NO_CONTROLS, FIXED_DT);

    expect(world.balls).toHaveLength(0);
    expect(world.phase).toBe('launch');
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
