// The source of truth for WHERE everything on each table lives (walls,
// pegs, bumpers, flippers, boss, launch point, launch pads). constants.ts
// holds HOW things behave (speeds/damage/timings); this file holds the
// table's actual layout.
//
// This split exists so a future standalone level editor (see tools/editor)
// can read/export exactly this shape - the editor places/drags these same
// plain-data records, and its export is a drop-in replacement for LEVEL
// below (paste the exported object literal back in here).
import {
  BOSS_RADIUS,
  FIELD_H,
  FIELD_W,
} from './constants';
import type { Vec2, Wall } from './types';

export interface LevelBumper {
  x: number;
  y: number;
  r: number;
  kind: 'paint' | 'energy';
}

export interface LevelFlipper {
  side: 'left' | 'right';
  pivot: Vec2;
}

export interface LevelLaunchPad {
  x: number;
  y: number;
  /** direction the pad launches balls, in radians (0 = pointing right) */
  angle: number;
}

export interface LevelData {
  fieldW: number;
  fieldH: number;
  walls: Wall[];
  pegs: { x: number; y: number; r: number }[];
  bumpers: LevelBumper[];
  flippers: LevelFlipper[];
  launchPads: LevelLaunchPad[];
  boss: { x: number; y: number; r: number };
  launch: Vec2;
}

// The outer/top end of each resting flipper meets the apron line; the paddle
// then slopes downward into the drain instead of floating above the floor.
const FLOOR_Y = FIELD_H - 112;
const FLIPPER_PIVOT_Y = FLOOR_Y + 4;

const DRAIN_X0 = FIELD_W * 0.32;
const DRAIN_X1 = FIELD_W * 0.68;

const BOSS_X = FIELD_W * 0.5;
const BOSS_Y = FIELD_H * 0.27;

function angleTo(from: Vec2, to: Vec2): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

const leftPad = { x: 14, y: FLOOR_Y - 6 };
const rightPad = { x: FIELD_W - 14, y: FLOOR_Y - 6 };

export const LEVEL: LevelData = {
  fieldW: FIELD_W,
  fieldH: FIELD_H,

  // Floor/apron with a gap between the flippers (the drain).
  walls: [
    [{ x: 0, y: FLOOR_Y }, { x: DRAIN_X0, y: FLOOR_Y }],
    [{ x: DRAIN_X1, y: FLOOR_Y }, { x: FIELD_W, y: FLOOR_Y }],
  ],

  pegs: [
    { x: FIELD_W * 0.25, y: 140, r: 9 },
    { x: FIELD_W * 0.5, y: 112, r: 9 },
    { x: FIELD_W * 0.75, y: 140, r: 9 },
  ],

  bumpers: [
    { x: FIELD_W * 0.3, y: FIELD_H * 0.45, r: 18, kind: 'paint' },
    { x: FIELD_W * 0.7, y: FIELD_H * 0.45, r: 18, kind: 'energy' },
  ],

  flippers: [
    { side: 'left', pivot: { x: FIELD_W * 0.3, y: FLIPPER_PIVOT_Y } },
    { side: 'right', pivot: { x: FIELD_W * 0.7, y: FLIPPER_PIVOT_Y } },
  ],

  // Corner boost pads, aimed at the boss, just outside the flippers.
  launchPads: [
    { x: leftPad.x, y: leftPad.y, angle: angleTo(leftPad, { x: BOSS_X, y: BOSS_Y }) },
    { x: rightPad.x, y: rightPad.y, angle: angleTo(rightPad, { x: BOSS_X, y: BOSS_Y }) },
  ],

  boss: { x: BOSS_X, y: BOSS_Y, r: BOSS_RADIUS },
  launch: { x: FIELD_W - 20, y: FLIPPER_PIVOT_Y - 20 },
};

const common = {
  fieldW: FIELD_W,
  fieldH: FIELD_H,
  flippers: LEVEL.flippers,
  boss: LEVEL.boss,
  launch: LEVEL.launch,
};

// Crossfire: opposing automatic pads keep changing lanes while the slanted
// rails feed misses back toward the active middle of the table.
export const CROSSFIRE: LevelData = {
  ...common,
  walls: [
    [{ x: 0, y: FLOOR_Y }, { x: 104.14, y: FLOOR_Y }],
    [{ x: 254.98, y: FLOOR_Y }, { x: FIELD_W, y: FLOOR_Y }],
    [{ x: 34, y: 396 }, { x: 106, y: 348 }],
    [{ x: 326, y: 396 }, { x: 254, y: 348 }],
    [{ x: 38, y: 244 }, { x: 108, y: 270 }],
    [{ x: 322, y: 244 }, { x: 252, y: 270 }],
  ],
  pegs: [
    { x: 70, y: 150, r: 8 }, { x: 180, y: 116, r: 9 }, { x: 290, y: 150, r: 8 },
    { x: 135, y: 330, r: 7 }, { x: 225, y: 330, r: 7 },
  ],
  bumpers: [
    { x: 92, y: 286, r: 17, kind: 'paint' },
    { x: 268, y: 286, r: 17, kind: 'energy' },
    { x: 180, y: 382, r: 15, kind: 'paint' },
    { x: 267, y: 60.08, r: 18, kind: 'paint' },
    { x: 92.29, y: 60.84, r: 18, kind: 'paint' },
    { x: 181.34, y: 39.68, r: 18, kind: 'energy' },
  ],
  launchPads: [
    LEVEL.launchPads[0], LEVEL.launchPads[1],
    { x: 70, y: 414, angle: angleTo({ x: 70, y: 414 }, { x: 270, y: 250 }) },
    { x: 290, y: 414, angle: angleTo({ x: 290, y: 414 }, { x: 90, y: 250 }) },
    { x: 180, y: 305, angle: -Math.PI / 2 },
  ],
};

// Orbit: a loose ring of targets and diagonal kickers creates long automatic
// circuits around the boss without enclosing the ball or adding new rules.
export const ORBIT: LevelData = {
  ...common,
  walls: [
    [{ x: 0, y: FLOOR_Y }, { x: 106.6, y: FLOOR_Y }],
    [{ x: 254.53, y: FLOOR_Y }, { x: FIELD_W, y: FLOOR_Y }],
    [{ x: 22, y: 270 }, { x: 72, y: 218 }, { x: 116, y: 244 }],
    [{ x: 338, y: 270 }, { x: 288, y: 218 }, { x: 244, y: 244 }],
    [{ x: 42, y: 412 }, { x: 102, y: 370 }],
    [{ x: 318, y: 412 }, { x: 258, y: 370 }],
  ],
  pegs: [
    { x: 62, y: 134, r: 8 }, { x: 122, y: 106, r: 7 },
    { x: 238, y: 106, r: 7 }, { x: 298, y: 134, r: 8 },
    { x: 105, y: 340, r: 8 }, { x: 255, y: 340, r: 8 },
  ],
  bumpers: [
    { x: 74, y: 304, r: 16, kind: 'energy' },
    { x: 286, y: 304, r: 16, kind: 'paint' },
    { x: 130, y: 270, r: 15, kind: 'paint' },
    { x: 230, y: 270, r: 15, kind: 'energy' },
    { x: 62.97, y: 59.2, r: 18, kind: 'energy' },
    { x: 298.66, y: 59.67, r: 18, kind: 'paint' },
  ],
  launchPads: [
    { x: 2.55, y: 526.63, angle: -1.127 },
    { x: 357.88, y: 527.84, angle: -2.015 },
    { x: 74, y: 365, angle: -0.72 },
    { x: 286, y: 365, angle: Math.PI + 0.72 },
    { x: 120, y: 190, angle: 0.3 },
    { x: 240, y: 190, angle: Math.PI - 0.3 },
  ],
};

// LEVEL remains the compact deterministic fixture used by tests and the
// editor. Players rotate only between the two richer production tables.
export const LEVELS = [CROSSFIRE, ORBIT];
