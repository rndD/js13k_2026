// Factory functions that build the initial World and its entities. Kept
// separate from sim.ts (behavior) so tests can construct fresh worlds and
// custom fixtures easily.
import {
  BASE_MAX_HP,
  BOSS_MAX_HP,
  BOSS_POS,
  BOSS_RADIUS,
  BOSS_SHOOT_INTERVAL,
  ENERGY_TARGET,
  FLIPPER_ACTIVE_ANGLE,
  FLIPPER_LEFT_PIVOT,
  FLIPPER_LENGTH,
  FLIPPER_REST_ANGLE,
  FLIPPER_RIGHT_PIVOT,
  LAUNCH_X,
  LAUNCH_Y,
  OVERLOAD_INTERVAL,
  PAINT_BUMPER,
  SHIELD_MAX_ENERGY,
  SHIELD_MAX_HP,
  BALL_RADIUS,
} from './constants';
import type { Ball, Bumper, Flipper, World } from './types';

export function createFlippers(): Flipper[] {
  return [
    {
      side: 'left',
      pivot: { ...FLIPPER_LEFT_PIVOT },
      length: FLIPPER_LENGTH,
      angle: FLIPPER_REST_ANGLE,
      restAngle: FLIPPER_REST_ANGLE,
      activeAngle: FLIPPER_ACTIVE_ANGLE,
      active: false,
    },
    {
      side: 'right',
      pivot: { ...FLIPPER_RIGHT_PIVOT },
      length: FLIPPER_LENGTH,
      angle: Math.PI - FLIPPER_REST_ANGLE,
      restAngle: Math.PI - FLIPPER_REST_ANGLE,
      activeAngle: Math.PI - FLIPPER_ACTIVE_ANGLE,
      active: false,
    },
  ];
}

export function createBumper(base: { x: number; y: number; r: number }): Bumper {
  return { ...base, cooldown: 0 };
}

export function createBall(id: number, x = LAUNCH_X, y = LAUNCH_Y): Ball {
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
  };
}

export function createWorld(): World {
  return {
    time: 0,
    phase: 'launch',
    nextBallId: 1,
    balls: [],
    flippers: createFlippers(),
    boss: {
      x: BOSS_POS.x,
      y: BOSS_POS.y,
      r: BOSS_RADIUS,
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
    paintBumper: createBumper(PAINT_BUMPER),
    energyTarget: createBumper(ENERGY_TARGET),
    projectiles: [],
    launch: { charging: false, power: 0 },
  };
}
