// Scenario: an incoming projectile must be blocked by raising the shield in
// time, or it will hit the base instead. This exercises the same timing
// decision the design doc calls out as the core defensive skill.
import { describe, expect, it } from 'vitest';
import { BASE_MAX_HP } from '../../src/constants';
import { createBall, createWorld } from '../../src/entities';
import { runScript } from '../harness';

function worldWithIncomingProjectile() {
  const world = createWorld();
  world.phase = 'battle';
  world.balls = [createBall(1, -100, -100)]; // parked off-field so phase stays 'battle'
  world.shield.energy = world.shield.maxEnergy;
  // Projectile 60px above the base line, moving down at 100px/s -> arrives in ~0.6s
  world.projectiles = [{ x: 180, y: 540, vx: 0, vy: 100, r: 7, damage: 25, big: false }];
  return world;
}

describe('scenario: shield timing', () => {
  it('blocks the projectile when the shield is raised before it arrives', () => {
    const world = worldWithIncomingProjectile();

    const { world: result } = runScript(
      world,
      [{ t: 0.3, controls: { shield: true } }],
      { duration: 1.5 },
    );

    expect(result.base.hp).toBe(BASE_MAX_HP);
    expect(result.shield.hp).toBeLessThan(result.shield.maxHp);
  });

  it('lets the projectile through when the shield is raised too late', () => {
    const world = worldWithIncomingProjectile();

    const { world: result } = runScript(
      world,
      [{ t: 1.2, controls: { shield: true } }], // well after the projectile already landed
      { duration: 1.5 },
    );

    expect(result.base.hp).toBe(BASE_MAX_HP - 25);
    expect(result.shield.hp).toBe(result.shield.maxHp);
  });
});
