// Factory functions that build the initial World and its entities. Kept
// separate from sim.ts (behavior) so tests can construct fresh worlds and
// custom fixtures easily. Positions/shapes come from a LevelData (level.ts
// by default) - this file only assembles behavioral fields from constants.ts.
import {
  BALL_RADIUS,
  BASE_MAX_HP,
  BOSS_MAX_HP,
  BOSS_SHOOT_INTERVAL,
  FLIPPER_ACTIVE_ANGLE,
  FLIPPER_LENGTH,
  FLIPPER_REST_ANGLE,
  OVERLOAD_INTERVAL,
  SHIELD_MAX_ENERGY,
  SHIELD_MAX_HP,
} from './constants';
import { LEVEL, type LevelData, type LevelFlipper } from './level';
import type { Ball, Bumper, Flipper, World } from './types';

export function createFlippers(levelFlippers: LevelFlipper[] = LEVEL.flippers): Flipper[] {
  return levelFlippers.map((lf) => {
    const mirror = lf.side === 'right';
    const restAngle = mirror ? Math.PI - FLIPPER_REST_ANGLE : FLIPPER_REST_ANGLE;
    const activeAngle = mirror ? Math.PI - FLIPPER_ACTIVE_ANGLE : FLIPPER_ACTIVE_ANGLE;
    return {
      side: lf.side,
      pivot: { ...lf.pivot },
      length: FLIPPER_LENGTH,
      angle: restAngle,
      restAngle,
      activeAngle,
      active: false,
    };
  });
}

export function createBumper(base: { x: number; y: number; r: number; kind: Bumper['kind'] }): Bumper {
  return { ...base, cooldown: 0 };
}

export function createBall(id: number, x = LEVEL.launch.x, y = LEVEL.launch.y): Ball {
  return {
    id,
    x,
    y,
    vx: 0,
    vy: 0,
    r: BALL_RADIUS,
    damage: 0,
    multiplier: 1,
    charge: 0,
    color: 'white',
    accent: false,
    bossCooldown: 0,
    anchorX: x,
    anchorY: y,
    stuckTimer: 0,
    rescueCount: 0,
  };
}

export function createWorld(level: LevelData = LEVEL): World {
  return {
    time: 0,
    phase: 'launch',
    nextBallId: 1,
    balls: [],
    walls: level.walls.map((wall) => wall.map((p) => ({ ...p }))),
    flippers: createFlippers(level.flippers),
    boss: {
      x: level.boss.x,
      y: level.boss.y,
      r: level.boss.r,
      hp: BOSS_MAX_HP,
      maxHp: BOSS_MAX_HP,
      shootTimer: BOSS_SHOOT_INTERVAL,
      overloadTimer: OVERLOAD_INTERVAL,
      overloadCharging: false,
      overloadProgress: 0,
    },
    shield: {
      energy: SHIELD_MAX_ENERGY,
      maxEnergy: SHIELD_MAX_ENERGY,
      hp: SHIELD_MAX_HP,
      maxHp: SHIELD_MAX_HP,
      active: false,
    },
    base: { hp: BASE_MAX_HP, maxHp: BASE_MAX_HP },
    bumpers: level.bumpers.map((b) => createBumper(b)),
    pegs: level.pegs.map((p) => ({ ...p })),
    launchPads: level.launchPads.map((p) => ({ ...p, cooldown: 0 })),
    projectiles: [],
    launch: { x: level.launch.x, y: level.launch.y, charging: false, power: 0 },
    aim: null,
  };
}
