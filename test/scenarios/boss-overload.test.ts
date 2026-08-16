// Scenario: the boss's "shield overload" special action telegraphs for
// OVERLOAD_CHARGE_TIME seconds before firing a big, high-damage projectile.
// Holding the shield through the telegraph should absorb it; ignoring the
// telegraph should hurt badly.
import { describe, expect, it } from 'vitest';
import { BASE_MAX_HP, OVERLOAD_CHARGE_TIME } from '../../src/constants';
import { createBall, createWorld } from '../../src/entities';
import { runScript } from '../harness';

function worldAboutToOverload() {
  const world = createWorld();
  world.phase = 'battle';
  world.balls = [createBall(1, -100, -100)];
  world.shield.energy = world.shield.maxEnergy;
  world.boss.overloadTimer = 0; // starts charging on the very next tick
  world.boss.shootTimer = 999; // suppress the unrelated regular shot for this test
  return world;
}

// The overload projectile is intentionally slow (same speed class as a
// regular shot, just bigger), so give it enough time to actually travel
// from the boss down to the base after the telegraph completes.
const IMPACT_WINDOW = OVERLOAD_CHARGE_TIME + 6;

describe('scenario: boss shield-overload special action', () => {
  it('absorbs the overload hit when the shield is raised for the strike (not held the whole telegraph)', () => {
    const world = worldAboutToOverload();

    // Per the design doc this is a precise-timing play, not a "hold shield
    // the entire multi-second telegraph" play (energy would run out first).
    // Raise it shortly before the charge completes and keep it up through impact.
    const { world: result } = runScript(
      world,
      [{ t: OVERLOAD_CHARGE_TIME - 0.3, controls: { shield: true } }],
      { duration: IMPACT_WINDOW },
    );

    expect(result.base.hp).toBe(BASE_MAX_HP);
    expect(result.shield.hp).toBeLessThan(result.shield.maxHp);
  });

  it('badly damages the base when the overload is ignored', () => {
    const world = worldAboutToOverload();

    const { world: result } = runScript(world, [], { duration: IMPACT_WINDOW });

    expect(result.base.hp).toBeLessThan(BASE_MAX_HP);
    expect(result.shield.hp).toBe(result.shield.maxHp);
  });
});
