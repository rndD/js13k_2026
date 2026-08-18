// Tunable constants for the pinball table and game balance. Positions/shapes
// (walls, pegs, bumpers, flippers, boss, launch point) live in level.ts
// instead - this file only holds HOW things behave (speeds, damage, timing).

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
export const WALL_THICKNESS = 6; // half-thickness used for ball-vs-wall-segment collision

// Flippers
export const FLIPPER_LENGTH = 60;
export const FLIPPER_THICKNESS = 8;
export const FLIPPER_REST_ANGLE = 0.55; // radians, resting (down) angle from horizontal
export const FLIPPER_ACTIVE_ANGLE = -0.55; // radians, activated (up) angle
export const FLIPPER_ANGULAR_SPEED = 14; // radians/s, how fast it swings
export const FLIPPER_BOOST_SPEED = 580; // px/s imparted to a ball on a strong hit - tuned so a solid hit can reach the boss

// Bumpers / targets
export const BUMPER_IMPULSE = 420; // px/s pushed away from bumper center
export const BUMPER_COOLDOWN = 0.15; // s, re-trigger cooldown per bumper

// Pegs: plain physical bounce points with no scoring effect.
export const PEG_IMPULSE = 320; // px/s pushed away from a peg on contact

// Launch pads: directional one-shot boost triangles.
export const LAUNCH_PAD_BOOST = 620; // px/s imparted along the pad's angle
export const LAUNCH_PAD_TRIGGER_R = 16; // trigger radius around the pad center
export const LAUNCH_PAD_COOLDOWN = 0.3; // s, re-trigger cooldown per pad

// Ball build growth
export const PAINT_DAMAGE_BASE = 40;
export const PAINT_MULTIPLIER_STEP = 0.5;
export const PAINT_MULTIPLIER_MAX = 8;
export const DIRECT_DAMAGE_BASE = 10;
export const ENERGY_TARGET_GAIN = 18; // shield energy restored per hit
export const ENERGY_TARGET_MULT_BONUS = 0.2;

// Contact aim: when an ACTIVE flipper hits a ball, the whole sim freezes and
// a sweeping aim indicator appears; releasing that same flipper button (or
// the timeout) fires the ball along the sweep's current angle.
export const AIM_CONE = 0.85; // radians, +/- half-angle around the contact's outward direction
export const AIM_SWEEP_PERIOD = 1; // s, time for one half-sweep (full cycle = 2x this)
export const AIM_TIMEOUT = 2.5; // s, auto-fires at the current sweep angle if never released
export const AIM_BASE_SPEED = 520; // px/s at multiplier 1
export const AIM_SPEED_PER_MULT = 45; // extra px/s per point of ball.multiplier - a "cooler" ball aims further/faster

// Boss
export const BOSS_RADIUS = 30;
export const BOSS_MAX_HP = 1000;
export const BOSS_SHOOT_INTERVAL = 6.5; // s between normal shots
export const BOSS_PROJECTILE_SPEED = 140; // px/s, intentionally slow/readable
export const BOSS_PROJECTILE_DAMAGE = 12;
export const BOSS_PROJECTILE_RADIUS = 7;
export const BOSS_HIT_COOLDOWN = 0.25; // s, per-ball direct-damage cooldown while inside boss

// Boss special action: shield overload
export const OVERLOAD_INTERVAL = 18; // s between overload attempts
export const OVERLOAD_CHARGE_TIME = 2.2; // s telegraph before the hit lands
export const OVERLOAD_DAMAGE = 45;

// Shield
export const SHIELD_MAX_ENERGY = 100;
export const SHIELD_MAX_HP = 60;
export const SHIELD_DRAIN_RATE = 22; // energy/s while held active
export const SHIELD_WIDTH = FIELD_W * 0.5;

// Base
export const BASE_MAX_HP = 100;

// Launch / plunger
export const LAUNCH_CHARGE_TIME = 0.5; // s to reach full power from empty
export const LAUNCH_MIN_SPEED = 260;
export const LAUNCH_MAX_SPEED = 560;

export const FIXED_DT = 1 / 60;
