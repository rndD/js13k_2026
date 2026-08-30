import { describe, expect, it } from 'vitest';
import { FIELD_H, FIELD_W, FIXED_DT } from '../src/constants';
import { createWorld } from '../src/entities';
import { LEVEL, LEVELS } from '../src/level';
import { step } from '../src/sim';
import { NO_CONTROLS } from '../src/types';

describe('built-in tables', () => {
  it('keeps all gameplay objects inside the field with a playable core layout', () => {
    expect(LEVELS).toHaveLength(2);
    for (const level of LEVELS) {
      expect(level.fieldW).toBe(FIELD_W);
      expect(level.fieldH).toBe(FIELD_H);
      expect(level.flippers.map((flipper) => flipper.side)).toEqual(['left', 'right']);
      expect(level.walls.length).toBeGreaterThanOrEqual(2);
      expect(level.bumpers.length).toBeGreaterThanOrEqual(2);
      expect(level.pads.length).toBeGreaterThanOrEqual(2);
      for (const item of [level.boss, level.launch, ...level.pegs, ...level.bumpers, ...level.pads, ...level.walls.flat()]) {
        expect(item.x).toBeGreaterThanOrEqual(0);
        expect(item.x).toBeLessThanOrEqual(FIELD_W);
        expect(item.y).toBeGreaterThanOrEqual(0);
        expect(item.y).toBeLessThanOrEqual(FIELD_H);
      }
    }
  });

  it('creates isolated worlds from every table', () => {
    const worlds = [LEVEL, ...LEVELS].map((level) => createWorld(level));
    worlds[1].walls[0][0].x = 123;
    expect(worlds[0].walls[0][0].x).not.toBe(123);
    expect(worlds[2].walls[0][0].x).not.toBe(123);
  });

  it('auto-launches a playable ball on every table', () => {
    for (const level of LEVELS) {
      const world = createWorld(level);
      for (let tick = 0; tick < 610; tick++) step(world, NO_CONTROLS, FIXED_DT);
      expect(world.phase).toBe('battle');
      expect(world.balls.some((ball) => ball.role === 'core')).toBe(true);
    }
  });
});
