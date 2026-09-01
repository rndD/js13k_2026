// Tunable constants for the pinball table and game balance. Positions/shapes
// (walls, pegs, bumpers, flippers, boss, launch point) live in level.ts
// instead - this file only holds HOW things behave (speeds, damage, timing).

export const FIELD_W = 360;
export const FIELD_H = 640;

// Reserved strip at the very top of the canvas for combat/status readouts,
// so the playfield itself starts below it instead of
// having bars overlaid on top of gameplay.
export const HUD_HEIGHT = 56;
export const CANVAS_H = FIELD_H + HUD_HEIGHT;

export const BALL_RADIUS = 6;
export const BALL_SIZE_PER_MULT = 0.035;
export const STARTING_CORE_BALLS = 3;
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
export const PAINT_MULTIPLIER_STEP = 0.5;
export const PAINT_MULTIPLIER_MAX = 8;
/** cumulative base-power bonus after 0/1/2/3 Overcharge picks */
export const OVERCHARGE_BONUSES = [0, 0.5, 1.5, 4];
export const DIRECT_DAMAGE_BASE = 10;
export const ENERGY_TARGET_MULT_BONUS = 0.2;

// Score rewards only deliberate/useful actions; passive geometry gives none.
export const POINTS_PAINT_TARGET = 20;
export const POINTS_CHARGE_TARGET = 20;
export const POINTS_BOSS_DEFEAT = 250;
export const POINTS_CORE_DRAIN_PENALTY = 50;
export const POINTS_OTHER_DRAIN_PENALTY = 25;
export const POINTS_HOSTILE_CAPTURE = 75;

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
export const BOSS_RADIUS = 22;
export const BOSS_HPS = [1000, 1400, 1800, 3000, 5000];
export const BOSS_ARMOR_COUNTS = [3, 9, 9, 18, 27];
export const BOSS_ARMOR_HPS = [120, 80, 100, 120, 150];
export const BOSS_ARMOR_ARCS = [0.72, 0.25, 0.25, 0.25, 0.25];
export const BOSS_HOSTILE_INTERVALS = [15, 11, 8, 6, 4];
export const BOSS_HIT_COOLDOWN = 0.25; // s, per-ball direct-damage cooldown while inside boss
export const BOSS_MOVE_X = 55;
export const BOSS_MOVE_Y = 12;
export const BOSS_MOVE_SPEED = 0.55;
export const BOSS_HP_TRAIL_DELAY = 0.6;
export const BOSS_HP_TRAIL_SPEED = 0.5;
export const HOSTILE_BALL_SPEED = 190;
export const HOSTILE_LIFETIME = 12;
export const ECHO_STABILITY = 5;
export const ECHO_LIFETIME = 20;
export const RECRUITER_STABILITIES = [5, 10, 20, 40];
export const RECRUITER_LIFETIMES = [20, 30, 60, 120];
export const ROLE_FLASH_DURATION = 0.25;
export const ARMOR_ORBIT_RADIUS = 38;
export const ARMOR_RING_GAP = 18;
export const ARMOR_THICKNESS = 8;
export const ARMOR_ROTATION_SPEED = 0.7;
export const ARMOR_DEFLECT_SPEED = 360;
export const ARMOR_HIT_COOLDOWN = 0.2;
export const ARMOR_DAMAGE_BASE = 15;
export const ARMOR_ACCENT_BONUS = 1.5;
export const POISON_DAMAGE = 8;
export const POISON_DELAY = 1;
export const BALL_RESTORE_TIMES = [30, 25];
export const CRITICAL_CHANCE = 0.15;
export const POINTS_ARMOR_BREAK = 75;
export const BOSS_BLAST_INTERVALS = [13, 13, 15, 11, 7];
export const BOSS_BLAST_WARNING = 1.5;
export const BOSS_BLAST_RADIUS = 95;
export const LEVEL_TRANSITION_TIME = 2;

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
export const AUTO_LAUNCH_DELAY = 10;
export const LAUNCH_MIN_SPEED = 260;
export const LAUNCH_MAX_SPEED = 560;

export const FIXED_DT = 1 / 60;
export const WALL_SOUND_TICKS = 10; // per-ball wall/peg sound limiter
export const HIT_MULTIPLIER_COST = 0.5;
export const BULLET_SPEED = 420;
export const BULLET_LIFETIME = 1.5;
export const BULLET_INTERVALS = [0.9, 0.6, 0.6, 0.4];
export const BULLET_DAMAGES = [4, 4, 8, 24];
export const PAINT_SHOT_DAMAGES = [8, 14, 22];
export const ENERGY_ECHO_CHANCES = [0.18, 0.38, 0.6];

// Visual-only feedback (fx.ts): hit-flash, screen shake, floating damage
// numbers. Purely cosmetic/render-side state, not simulation state - see
// fx.ts's header comment for why it lives outside World, same reasoning as
// main.ts's ball-trail Map.
export const FX_FLASH_DURATION = 0.18; // s a hit-flash overlay stays visible before fading
export const FX_BURST_DURATION = 0.55; // s a non-core ball explosion remains visible
export const FX_FLOATER_LIFE = 0.7; // s a floating damage number stays visible before fading
export const FX_FLOATER_RISE = 26; // px a floating damage number drifts upward over its life
export const FX_SHAKE_DECAY = 90; // px/s, how fast screen shake magnitude falls off
export const FX_SHAKE_BOSS = 3; // px, direct/paint hit on the boss
export const FX_SHAKE_WIN = 8; // px, boss defeated
export const FX_SHAKE_LOSE = 5; // px, run lost - noticeable but not disorienting

// Background "paint wash" particle system (bgfx.ts): a splat spawns at
// EVERY contact a ball has with anything (peg/wall/bumper/flipper - detected
// generically via a sudden ball velocity-direction change, not per-object
// special-casing) plus every boss/win/lose fx event. Each splat
// is its own independent particle that sways sideways on a sine wave, drifts
// slowly up or down (direction randomized per splat), grows a little, and
// fades out over its lifetime - rather than being painted onto a fixed spot
// on a persistent bitmap, which can erode/blur in place but can't actually
// slide sideways. Purely cosmetic, same non-World state pattern as
// fx.ts/main.ts's trail.
export const BGFX_HIT_ALPHA = 0.4; // peak alpha of a splat
export const BGFX_HIT_RADIUS = 26; // px starting radius of a splat
export const BGFX_LIFE = 7; // s a splat lives before fully fading (randomized +/-30% per splat)
export const BGFX_GROWTH_PER_SEC = 0.1; // fraction of its radius a splat grows per second it's alive - kept small since BGFX_LIFE is long (up to ~9s with randomization); at 0.35 a splat nearly quadrupled in size by the end, reading as a giant blob rather than a stain
export const BGFX_DRIFT_SPEED = 14; // px/s vertical drift speed (randomized direction + magnitude per splat)
export const BGFX_SWAY_AMP = 10; // px, how far a splat sways side to side
export const BGFX_SWAY_FREQ = 1.6; // rad/s, sway speed (randomized per splat)
// A ball currently overlapping a splat carves a soft hole through it via
// destination-out compositing, as if physically parting/cutting the film as
// it flies through - rather than just passing over a static painted layer.
export const BGFX_CUT_RADIUS_MULT = 2.4; // the carved hole's radius, as a multiple of the ball's own radius
export const BGFX_CUT_ALPHA = 0.85; // how fully the hole erases at its center (1 = fully transparent)


// CRT/TV overlay (crt.ts): cheap scanlines + vignette + a faint flicker,
// toggleable on-screen (dis_doc.md scope note: no texture assets, so this is
// all drawn with canvas primitives/gradients, not an image). The "curved
// tube" look is mostly free: index.html rounds the canvas element's own
// corners via CSS (toggled alongside crt.on) instead of any per-pixel warp -
// a soft off-center highlight gradient here sells the rest of the glass-
// curvature illusion for near-zero extra bytes.
export const CRT_SCANLINE_ALPHA = 0.07;
export const CRT_VIGNETTE_ALPHA = 0.25;
export const CRT_FLICKER_AMOUNT = 0.012; // +/- alpha wobble on the scanline layer
// Real geometric "bulging glass" warp (not just a CSS corner-round): the
// whole rendered scene is drawn to an offscreen canvas, then re-drawn onto
// the visible canvas in thin strips whose scale bulges outward toward the
// center and tapers back to 1x at the edges (cosine falloff) - once for
// rows (horizontal bulge) and once for columns (vertical bulge). Cheap
// (a couple dozen drawImage calls, no per-pixel math) but reads as a
// genuinely convex, slightly-distorted old tube face.
