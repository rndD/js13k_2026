import { describe, expect, it } from 'vitest';
import { FIXED_DT } from '../../src/constants';
import { createWorld } from '../../src/entities';
import { LEVELS } from '../../src/level';
import { step } from '../../src/sim';
import { NO_CONTROLS } from '../../src/types';

describe('scenario: five-boss run', () => {
  it('changes table and boss four times, then ends in victory', () => {
    const world = createWorld(LEVELS[0], 0);

    for (let rank = 0; rank < 5; rank++) {
      const ballsBefore = world.coreBalls;
      world.phase = 'battle';
      world.boss.hp = 0;
      step(world, NO_CONTROLS, FIXED_DT);

      if (rank === 4) break;
      expect(world.phase).toBe('transition');
      expect(world.coreBalls).toBe(ballsBefore + 1);
      for (let tick = 0; tick < 121; tick++) step(world, NO_CONTROLS, FIXED_DT);
      expect(world.phase).toBe('launch');
      expect(world.boss.rank).toBe(rank + 1);
      expect(world.tableIndex).toBe((rank + 1) % LEVELS.length);
    }

    expect(world.phase).toBe('win');
    expect(world.boss.rank).toBe(4);
  });
});
