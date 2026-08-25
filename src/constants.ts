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
//
// The cone is centered on the boss (not the raw flipper-contact normal, which
// felt random/unpredictable - see dis_doc.md's core complaint about
// unpredictability), biased partway toward straight-up to roughly compensate
// for gravity pulling the shot down during flight, without needing full
// projectile-motion math. The cone's HALF-ANGLE also scales with the ball's
// paint multiplier: a fresh white ball gets a narrow, reliable "aimed at the
// boss" cone (few boring wasted sideways/straight-up throws), while a
// charged-up ball earns a much wider cone for trick shots at side bumpers.
export const AIM_CONE_MIN = 0.138; // radians, +/- half-angle at multiplier 1 (0.12 base, widened 15%)
export const AIM_CONE_MAX = 1.15; // radians, +/- half-angle at PAINT_MULTIPLIER_MAX (1.0 base, widened 15%)
export const AIM_SAFE_CLEARANCE = 6; // px, extra gap kept above the flipper's swept arc while the ball is frozen for aiming
export const AIM_LOFT_BIAS = 0.35; // 0..1, how far to blend the boss-aim angle toward straight-up
export const AIM_SWEEP_PERIOD = 1; // s, time for one half-sweep (full cycle = 2x this)
export const AIM_TIMEOUT = 2.5; // s, auto-fires at the current sweep angle if never released
export const AIM_BASE_SPEED = 660; // px/s at multiplier 1 - tuned so a center-aimed shot clears the boss's height
export const AIM_SPEED_PER_MULT = 35; // extra px/s per point of ball.multiplier - a "cooler" ball aims further/faster

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

// Anti-stuck watchdog: pinball physics can pathologically trap a ball
// bouncing forever in a tight pocket (net displacement ~0 even though it's
// still moving) or wedge it dead-still against a corner. We track how far
// each ball has actually traveled from a periodically-reset "anchor" point;
// if it hasn't gone anywhere in STUCK_TIMEOUT seconds, give it a firm nudge
// toward the boss instead of letting the round hang. If that keeps
// happening to the same ball, give up and drain it (guarantees the round
// always terminates instead of ever soft-locking).
export const STUCK_PROGRESS_RADIUS = 28; // px, must move at least this far from the anchor to count as "progress"
export const STUCK_TIMEOUT = 2; // s with no progress before a rescue nudge fires
export const STUCK_RESCUE_SPEED = 380; // px/s imparted by a rescue nudge
export const STUCK_MAX_RESCUES = 3; // rescues tolerated per ball before giving up and draining it

// Launch / plunger
export const LAUNCH_CHARGE_TIME = 0.5; // s to reach full power from empty
export const LAUNCH_MIN_SPEED = 260;
export const LAUNCH_MAX_SPEED = 560;

export const FIXED_DT = 1 / 60;

// Visual-only feedback (fx.ts): hit-flash, screen shake, floating damage
// numbers. Purely cosmetic/render-side state, not simulation state - see
// fx.ts's header comment for why it lives outside World, same reasoning as
// main.ts's ball-trail Map.
export const FX_FLASH_DURATION = 0.18; // s a hit-flash overlay stays visible before fading
export const FX_FLOATER_LIFE = 0.7; // s a floating damage number stays visible before fading
export const FX_FLOATER_RISE = 26; // px a floating damage number drifts upward over its life
export const FX_SHAKE_DECAY = 90; // px/s, how fast screen shake magnitude falls off
export const FX_SHAKE_BOSS = 3; // px, direct/paint hit on the boss
export const FX_SHAKE_SHIELD = 4; // px, shield blocking a projectile
export const FX_SHAKE_BASE = 6; // px, base taking a hit (bigger - more alarming than a blocked shot)
export const FX_SHAKE_BIG = 10; // px, an overload projectile getting through (shield or base)
export const FX_SHAKE_WIN = 8; // px, boss defeated
export const FX_SHAKE_LOSE = 5; // px, base destroyed - noticeable but not disorienting (was 12, way too much for a single beat)

// Background "paint wash" particle system (bgfx.ts): a splat spawns at
// EVERY contact a ball has with anything (peg/wall/bumper/flipper - detected
// generically via a sudden ball velocity-direction change, not per-object
// special-casing) plus every boss/shield/base/win/lose fx event. Each splat
// is its own independent particle that sways sideways on a sine wave, drifts
// slowly up or down (direction randomized per splat), grows a little, and
// fades out over its lifetime - rather than being painted onto a fixed spot
// on a persistent bitmap, which can erode/blur in place but can't actually
// slide sideways. Purely cosmetic, same non-World state pattern as
// fx.ts/main.ts's trail.
export const BGFX_HIT_ALPHA = 0.4; // peak alpha of a splat
export const BGFX_HIT_RADIUS = 26; // px starting radius of a splat
export const BGFX_LIFE = 3.2; // s a splat lives before fully fading (randomized +/-30% per splat)
export const BGFX_GROWTH_PER_SEC = 0.35; // fraction of its radius a splat grows per second it's alive
export const BGFX_DRIFT_SPEED = 14; // px/s vertical drift speed (randomized direction + magnitude per splat)
export const BGFX_SWAY_AMP = 10; // px, how far a splat sways side to side
export const BGFX_SWAY_FREQ = 1.6; // rad/s, sway speed (randomized per splat)
export const BGFX_MIN_SPEED = 60; // px/s - ignore velocity changes below this (near-stationary jitter, not a real bounce)
export const BGFX_CONTACT_ANGLE = 0.6; // radians - velocity direction must swing by at least this much in one tick to count as a bounce (gravity alone only ever curves a path smoothly)

// CRT/TV overlay (crt.ts): cheap scanlines + vignette + a faint flicker,
// toggleable on-screen (dis_doc.md scope note: no texture assets, so this is
// all drawn with canvas primitives/gradients, not an image). The "curved
// tube" look is mostly free: index.html rounds the canvas element's own
// corners via CSS (toggled alongside crt.on) instead of any per-pixel warp -
// a soft off-center highlight gradient here sells the rest of the glass-
// curvature illusion for near-zero extra bytes.
export const CRT_SCANLINE_ALPHA = 0.14;
export const CRT_VIGNETTE_ALPHA = 0.45;
export const CRT_FLICKER_AMOUNT = 0.025; // +/- alpha wobble on the scanline layer
export const CRT_HIGHLIGHT_ALPHA = 0.05; // faint glass-reflection highlight, upper-left
// Real geometric "bulging glass" warp (not just a CSS corner-round): the
// whole rendered scene is drawn to an offscreen canvas, then re-drawn onto
// the visible canvas in thin strips whose scale bulges outward toward the
// center and tapers back to 1x at the edges (cosine falloff) - once for
// rows (horizontal bulge) and once for columns (vertical bulge). Cheap
// (a couple dozen drawImage calls, no per-pixel math) but reads as a
// genuinely convex, slightly-distorted old tube face.
