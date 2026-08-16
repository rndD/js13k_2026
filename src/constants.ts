// Tunable constants for the pinball table and game balance.
// Keeping these in one place makes it easy to tweak feel and to reference
// the same numbers from tests.

export const FIELD_W = 360;
export const FIELD_H = 640;

export const BALL_RADIUS = 6;
export const GRAVITY = 700; // px/s^2, downward under normal tilt
export const MAX_SPEED = 900; // px/s hard clamp
export const WALL_RESTITUTION = 0.85; // velocity kept after bouncing off a wall

// Drain gap between the flippers, in field-space x coordinates.
export const DRAIN_X0 = FIELD_W * 0.32;
export const DRAIN_X1 = FIELD_W * 0.68;

// Flippers
export const FLIPPER_LENGTH = 60;
export const FLIPPER_THICKNESS = 8;
export const FLIPPER_REST_ANGLE = 0.55; // radians, resting (down) angle from horizontal
export const FLIPPER_ACTIVE_ANGLE = -0.55; // radians, activated (up) angle
export const FLIPPER_ANGULAR_SPEED = 14; // radians/s, how fast it swings
export const FLIPPER_BOOST_SPEED = 520; // px/s imparted to a ball on a strong hit
export const FLIPPER_LEFT_PIVOT = { x: FIELD_W * 0.36, y: FIELD_H - 60 };
export const FLIPPER_RIGHT_PIVOT = { x: FIELD_W * 0.64, y: FIELD_H - 60 };

// Bumpers / targets
export const PAINT_BUMPER = { x: FIELD_W * 0.3, y: FIELD_H * 0.4, r: 18 };
export const ENERGY_TARGET = { x: FIELD_W * 0.7, y: FIELD_H * 0.4, r: 18 };
export const BUMPER_IMPULSE = 420; // px/s pushed away from bumper center
export const BUMPER_COOLDOWN = 0.15; // s, re-trigger cooldown per bumper

// Ball build growth
export const PAINT_DAMAGE_BASE = 40;
export const PAINT_MULTIPLIER_STEP = 0.5;
export const PAINT_MULTIPLIER_MAX = 8;
export const DIRECT_DAMAGE_BASE = 10;
export const ENERGY_TARGET_GAIN = 18; // shield energy restored per hit
export const ENERGY_TARGET_MULT_BONUS = 0.2;

// Boss
export const BOSS_POS = { x: FIELD_W * 0.5, y: FIELD_H * 0.16 };
export const BOSS_RADIUS = 46;
export const BOSS_MAX_HP = 1000;
export const BOSS_SHOOT_INTERVAL = 3.2; // s between normal shots
export const BOSS_PROJECTILE_SPEED = 140; // px/s, intentionally slow/readable
export const BOSS_PROJECTILE_DAMAGE = 12;
export const BOSS_PROJECTILE_RADIUS = 7;
export const BOSS_HIT_COOLDOWN = 0.25; // s, per-ball direct-damage cooldown while inside boss

// Boss special action: shield overload
export const OVERLOAD_INTERVAL = 8; // s between overload attempts
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
export const LAUNCH_CHARGE_TIME = 0.9; // s to reach full power from empty
export const LAUNCH_MIN_SPEED = 260;
export const LAUNCH_MAX_SPEED = 560;
export const LAUNCH_X = FIELD_W - 20;
export const LAUNCH_Y = FIELD_H - 80;

export const FIXED_DT = 1 / 60;
