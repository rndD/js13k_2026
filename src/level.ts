// The single source of truth for WHERE everything on the table lives (walls,
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
  FLIPPER_LENGTH,
  FLIPPER_REST_ANGLE,
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

// Flippers sit well above the true bottom of the field so a solid hit has
// enough vertical room to reach the boss (see FLIPPER_BOOST_SPEED tuning).
const FLIPPER_PIVOT_Y = FIELD_H - 180;

// The apron/floor line sits at (or just past) the flippers' own resting
// droop, or it visibly floats above them instead of touching them. A
// resting flipper droops length*sin(restAngle) below its own pivot.
const FLOOR_Y = Math.round(FLIPPER_PIVOT_Y + FLIPPER_LENGTH * Math.sin(FLIPPER_REST_ANGLE)) + 3;

const DRAIN_X0 = FIELD_W * 0.36;
const DRAIN_X1 = FIELD_W * 0.64;

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
