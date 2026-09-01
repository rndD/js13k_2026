// Factory functions that build the initial World and its entities. Kept
// separate from sim.ts (behavior) so tests can construct fresh worlds and
// custom fixtures easily. Positions/shapes come from a LevelData (level.ts
// by default) - this file only assembles behavioral fields from constants.ts.
import {
  BALL_RADIUS,
  BOSS_ARMOR_ARCS,
  BOSS_ARMOR_COUNTS,
  BOSS_ARMOR_HPS,
  BOSS_HOSTILE_INTERVALS,
  BOSS_HPS,
  BOSS_BLAST_INTERVALS,
  FLIPPER_ACTIVE_ANGLE,
  FLIPPER_LENGTH,
  FLIPPER_REST_ANGLE,
  ECHO_LIFETIME,
  HOSTILE_LIFETIME,
  STARTING_CORE_BALLS,
} from './constants';
import { LEVEL, type LevelData, type LevelFlipper } from './level';
import type { Ball, BallRole, Boss, Bumper, Flipper, World } from './types';

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

export function createBoss(spot: LevelData['boss'], rank: number): Boss {
  const count = BOSS_ARMOR_COUNTS[rank];
  const armorHp = BOSS_ARMOR_HPS[rank];
  return {
    rank,
    x: spot.x,
    y: spot.y,
    homeX: spot.x,
    homeY: spot.y,
    r: spot.r,
    hp: BOSS_HPS[rank],
    maxHp: BOSS_HPS[rank],
    trailHp: BOSS_HPS[rank],
    hitTimer: 0,
    rage: 0,
    heal: 0,
    spawnTimer: BOSS_HOSTILE_INTERVALS[rank],
    specialTimer: BOSS_BLAST_INTERVALS[rank],
    warningTimer: 0,
    armorArc: BOSS_ARMOR_ARCS[rank],
    poisonDamage: 0,
    poisonTimer: 0,
    armor: Array.from({ length: count }, (_, i) => {
      const rings = rank >= 3 ? rank - 1 : 1;
      const perRing = count / rings;
      const ring = Math.floor(i / perRing);
      return {
        angle: i % perRing * Math.PI * 2 / perRing + ring * Math.PI / perRing,
        hp: armorHp,
        maxHp: armorHp,
        ring,
      };
    }),
  };
}

export function loadTable(world: World, level: LevelData): void {
  world.walls = level.walls.map((wall) => wall.map((p) => ({ ...p })));
  world.flippers = createFlippers(level.flippers);
  if (world.upgrades[15]) for (const flipper of world.flippers) flipper.length *= 1.15;
  world.bumpers = level.bumpers.map((b) => createBumper(b));
  world.pegs = level.pegs.map((p) => ({ ...p }));
  world.pads = level.pads.map((p) => ({ ...p, cooldown: 0 }));
  world.launch = { x: level.launch.x, y: level.launch.y, charging: false, power: 0, autoTimer: 0 };
}

export function createWorld(level: LevelData = LEVEL, tableIndex = -1): World {
  return {
    time: 0,
    damageLog: [],
    vibrancy: 0,
    spectrumPhase: 0,
    phase: 'launch',
    tableIndex,
    transitionTimer: 0,
    nextBallId: 1,
    coreBalls: STARTING_CORE_BALLS,
    restoreTimer: 0,
    randomSeed: 1,
    points: 0,
    upgrades: Array(16).fill(0),
    previousUpgradeGap: 50,
    upgradeGap: 150,
    nextUpgradeAt: 150,
    pendingUpgrades: 0,
    upgradeCount: 0,
    pick: null,
    balls: [],
    bullets: [],
    walls: level.walls.map((wall) => wall.map((p) => ({ ...p }))),
    flippers: createFlippers(level.flippers),
    boss: createBoss(level.boss, 0),
    bumpers: level.bumpers.map((b) => createBumper(b)),
    pegs: level.pegs.map((p) => ({ ...p })),
    pads: level.pads.map((p) => ({ ...p, cooldown: 0 })),
    launch: { x: level.launch.x, y: level.launch.y, charging: false, power: 0, autoTimer: 0 },
    aim: null,
    sfx: [],
    fx: [],
    contacts: [],
  };
}
