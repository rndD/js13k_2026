// Tunable constants for the pinball table and game balance.
// Keeping these in one place makes it easy to tweak feel and to reference
// the same numbers from tests.

export const FIELD_W = 360;
export const FIELD_H = 640;

// Reserved strip at the very top of the canvas for the boss/shield/base
// status readouts, so the playfield itself starts below it instead of
// having bars overlaid on top of gameplay.
export const HUD_HEIGHT = 56;
export const CANVAS_H = FIELD_H + HUD_HEIGHT;

export const BALL_RADIUS = 6;
export const GRAVITY = 700; // px/s^2, downward under normal tilt
export const MAX_SPEED = 900; // px/s hard clamp
export const WALL_RESTITUTION = 0.85; // velocity kept after bouncing off a wall

// The floor/apron sits just below the flippers' resting position instead of
// at the very bottom of the field, so there's no dead visual/physical gap
// below them. (Can't raise it all the way to the pivot's y - a flipper at
// rest droops length*sin(restAngle) below its own pivot, so the floor must
// clear that or it would clip straight through the flipper's own geometry.)
// Raised well up from the field bottom so a solid flipper hit has enough
// vertical room to actually reach the boss (see FLIPPER_BOOST_SPEED below).
export const FLIPPER_PIVOT_Y = FIELD_H - 180;
export const TABLE_FLOOR_Y = FLIPPER_PIVOT_Y + 40;

// Drain gap between the flippers, in field-space x coordinates.
export const DRAIN_X0 = FIELD_W * 0.36;
export const DRAIN_X1 = FIELD_W * 0.64;

// Flippers
export const FLIPPER_LENGTH = 60;
export const FLIPPER_THICKNESS = 8;
export const FLIPPER_REST_ANGLE = 0.55; // radians, resting (down) angle from horizontal
export const FLIPPER_ACTIVE_ANGLE = -0.55; // radians, activated (up) angle
export const FLIPPER_ANGULAR_SPEED = 14; // radians/s, how fast it swings
export const FLIPPER_BOOST_SPEED = 580; // px/s imparted to a ball on a strong hit - tuned so a solid hit can reach the boss
export const FLIPPER_LEFT_PIVOT = { x: FIELD_W * 0.3, y: FLIPPER_PIVOT_Y };
export const FLIPPER_RIGHT_PIVOT = { x: FIELD_W * 0.7, y: FLIPPER_PIVOT_Y };

// Bumpers / targets
export const PAINT_BUMPER = { x: FIELD_W * 0.3, y: FIELD_H * 0.45, r: 18 };
export const ENERGY_TARGET = { x: FIELD_W * 0.7, y: FIELD_H * 0.45, r: 18 };
export const BUMPER_IMPULSE = 420; // px/s pushed away from bumper center
export const BUMPER_COOLDOWN = 0.15; // s, re-trigger cooldown per bumper

// Pegs: plain physical bounce points with no scoring effect, just to give
// the freed-up upper area (above the boss) some pinball texture/variety.
export const PEGS = [
  { x: FIELD_W * 0.25, y: 140, r: 9 },
  { x: FIELD_W * 0.5, y: 112, r: 9 },
  { x: FIELD_W * 0.75, y: 140, r: 9 },
];
export const PEG_IMPULSE = 320; // px/s pushed away from a peg on contact

// Ball build growth
export const PAINT_DAMAGE_BASE = 40;
export const PAINT_MULTIPLIER_STEP = 0.5;
export const PAINT_MULTIPLIER_MAX = 8;
export const DIRECT_DAMAGE_BASE = 10;
export const ENERGY_TARGET_GAIN = 18; // shield energy restored per hit
export const ENERGY_TARGET_MULT_BONUS = 0.2;

// Boss
export const BOSS_POS = { x: FIELD_W * 0.5, y: FIELD_H * 0.27 };
export const BOSS_RADIUS = 30;
export const BOSS_MAX_HP = 1000;
export const BOSS_SHOOT_INTERVAL = 6.5; // s between normal shots (was 4.5)
export const BOSS_PROJECTILE_SPEED = 140; // px/s, intentionally slow/readable
export const BOSS_PROJECTILE_DAMAGE = 12;
export const BOSS_PROJECTILE_RADIUS = 7;
export const BOSS_HIT_COOLDOWN = 0.25; // s, per-ball direct-damage cooldown while inside boss

// Boss special action: shield overload
export const OVERLOAD_INTERVAL = 18; // s between overload attempts (was 12)
export const OVERLOAD_CHARGE_TIME = 2.2; // s telegraph before the hit lands
export const OVERLOAD_DAMAGE = 45;

// Shield
export const SHIELD_MAX_ENERGY = 100;
export const SHIELD_MAX_HP = 60;
export const SHIELD_DRAIN_RATE = 22; // energy/s while held active
export const SHIELD_Y = FIELD_H - 90; // shield arc sits just above the base
export const SHIELD_WIDTH = FIELD_W * 0.5;

// Base
export const BASE_MAX_HP = 100;
export const BASE_Y = FIELD_H - 40;

// Launch / plunger
export const LAUNCH_CHARGE_TIME = 0.5; // s to reach full power from empty
export const LAUNCH_MIN_SPEED = 260;
export const LAUNCH_MAX_SPEED = 560;
export const LAUNCH_X = FIELD_W - 20;
export const LAUNCH_Y = FLIPPER_PIVOT_Y - 20; // just above the (now raised) flipper zone

export const FIXED_DT = 1 / 60;
