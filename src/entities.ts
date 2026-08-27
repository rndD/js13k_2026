// Factory functions that build the initial World and its entities. Kept
// separate from sim.ts (behavior) so tests can construct fresh worlds and
// custom fixtures easily. Positions/shapes come from a LevelData (level.ts
// by default) - this file only assembles behavioral fields from constants.ts.
import {
  ARMOR_COUNT,
  ARMOR_MAX_HP,
  BALL_RADIUS,
  BOSS_MAX_HP,
  FLIPPER_ACTIVE_ANGLE,
  FLIPPER_LENGTH,
  FLIPPER_REST_ANGLE,
  ECHO_LIFETIME,
  HOSTILE_LIFETIME,
  HOSTILE_SPAWN_INTERVAL,
  STARTING_CORE_BALLS,
} from './constants';
import { LEVEL, type LevelData, type LevelFlipper } from './level';
import type { Ball, BallRole, Bumper, Flipper, World } from './types';

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

export function createBall(id: number, x = LEVEL.launch.x, y = LEVEL.launch.y, role: BallRole = 'core'): Ball {
  return {
    id,
    role,
    stocked: role === 'core',
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
    armorCooldown: 0,
    anchorX: x,
    anchorY: y,
    stuckTimer: 0,
    rescueCount: 0,
    stability: 0,
    lifetime: role === 'hostile' ? HOSTILE_LIFETIME : role === 'echo' ? ECHO_LIFETIME : 0,
    wallSoundTicks: 0,
    gunTimer: 0,
    roleFlash: 0,
  };
}

export function createWorld(level: LevelData = LEVEL): World {
  return {
    time: 0,
    phase: 'launch',
    nextBallId: 1,
    coreBalls: STARTING_CORE_BALLS,
    points: 0,
    upgrades: { extraCore: 0, recruiter: 0, poison: 0, autoGun: 0, overcharge: 0, splitAll: 0, sacrifice: 0, bossMagnet: 0 },
    previousUpgradeGap: 50,
    upgradeGap: 100,
    nextUpgradeAt: 100,
    pendingUpgrades: 0,
    upgradeCount: 0,
    pick: null,
    balls: [],
    bullets: [],
    walls: level.walls.map((wall) => wall.map((p) => ({ ...p }))),
    flippers: createFlippers(level.flippers),
    boss: {
      x: level.boss.x,
      y: level.boss.y,
      homeX: level.boss.x,
      homeY: level.boss.y,
      r: level.boss.r,
      hp: BOSS_MAX_HP,
      maxHp: BOSS_MAX_HP,
      spawnTimer: HOSTILE_SPAWN_INTERVAL,
      poisonDamage: 0,
      poisonTimer: 0,
      armor: Array.from({ length: ARMOR_COUNT }, (_, i) => ({
        angle: i * Math.PI * 2 / ARMOR_COUNT,
        hp: ARMOR_MAX_HP,
        maxHp: ARMOR_MAX_HP,
      })),
    },
    bumpers: level.bumpers.map((b) => createBumper(b)),
    pegs: level.pegs.map((p) => ({ ...p })),
    launchPads: level.launchPads.map((p) => ({ ...p, cooldown: 0 })),
    launch: { x: level.launch.x, y: level.launch.y, charging: false, power: 0, autoTimer: 0 },
    aim: null,
    sfx: [],
    fx: [],
    contacts: [],
  };
}
