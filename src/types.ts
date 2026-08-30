// Shared plain-data types for the whole simulation. Everything here is
// serializable (no functions, no class instances with methods) so a World
// can be deep-cloned for snapshots/tests without any special handling.

export interface Vec2 {
  x: number;
  y: number;
}

export type BallRole = 'core' | 'hostile' | 'echo';
// Upgrade IDs: 1 extra ball, 2 recruiter, 3 poison, 4 auto gun,
// 5 overcharge, 6 split all, 7 sacrifice, 8 boss magnet, 9 ball restore,
// 10 critical, 11 paint shot, 12 energy echo, 13 forever rainbow, 14 auto flippers.
export type AbilityId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Ball {
  id: number;
  role: BallRole;
  /** whether draining this core consumes one ball from stock; split clones do not */
  stocked: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** grows from paint-element hits, multiplies all damage this ball deals */
  multiplier: number;
  /** number of paint-bumper hits accumulated by this ball */
  charge: number;
  /** cosmetic/mechanical color tag, grows richer as the ball's build grows */
  color: 'white' | 'red' | 'blue' | 'rainbow';
  /** true once this ball has also picked up an energy-target accent */
  accent: boolean;
  /** seconds remaining before this ball can deal direct damage to the boss again */
  bossCooldown: number;
  armorCooldown: number;
  /** position the last time "am I actually making progress" was checked (anti-stuck) */
  anchorX: number;
  anchorY: number;
  /** seconds since the ball last moved STUCK_PROGRESS_RADIUS away from its anchor */
  stuckTimer: number;
  /** how many times this ball has already been nudged free of a stuck spot */
  rescueCount: number;
  /** useful hits remaining for an echo; zero for core/hostile balls */
  stability: number;
  /** seconds before a non-core ball bursts; zero means the core never times out */
  lifetime: number;
  /** simulation ticks remaining before this ball may emit another wall/peg sound */
  wallSoundTicks: number;
  gunTimer: number;
  roleFlash: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  damage: number;
  lifetime: number;
  paint?: boolean;
  critical?: boolean;
}

export type FlipperSide = 'left' | 'right';

export interface Flipper {
  side: FlipperSide;
  pivot: Vec2;
  length: number;
  /** current angle in radians, 0 = pointing straight toward field center */
  angle: number;
  restAngle: number;
  activeAngle: number;
  active: boolean;
}

export interface Boss {
  rank: number;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  r: number;
  hp: number;
  maxHp: number;
  trailHp: number;
  hitTimer: number;
  spawnTimer: number;
  specialTimer: number;
  warningTimer: number;
  armorArc: number;
  poisonDamage: number;
  poisonTimer: number;
  armor: ArmorNode[];
}

export interface ArmorNode {
  angle: number;
  hp: number;
  maxHp: number;
  ring: number;
}

export interface Bumper {
  x: number;
  y: number;
  r: number;
  /** which scoring effect this bumper applies on hit */
  kind: 'paint' | 'energy';
  cooldown: number;
}

/** A plain physical bounce point - no scoring/state effect, just collision. */
export interface Peg {
  x: number;
  y: number;
  r: number;
}

/**
 * A static wall segment chain the ball bounces off. Just a list of points -
 * consecutive points form segments (open polyline, not auto-closed). Gaps
 * between separate Wall entries are how drains/openings are created; there's
 * no separate "drain gap" concept, it just emerges from wherever no wall
 * covers.
 */
export type Wall = Vec2[];

/**
 * A directional one-shot boost pad (drawn as a small triangle pointing along
 * `angle`). Any ball touching it gets its velocity set along `angle` at a
 * fixed boost speed - unlike a flipper, it has no moving parts and always
 * fires in the same direction.
 */
export interface LaunchPad {
  x: number;
  y: number;
  /** direction the pad launches balls, in radians */
  angle: number;
  cooldown: number;
}

export type Phase = 'launch' | 'battle' | 'aim' | 'pick' | 'transition' | 'win' | 'lose';

export interface PickState {
  offers: AbilityId[];
  resumePhase: Exclude<Phase, 'pick' | 'win' | 'lose'>;
  timer: number;
  armed: boolean;
  selected: number | null;
}

/**
 * Discrete sound-trigger tags. sim.ts stays headless (no Audio/DOM calls of
 * its own) but pushes these plain string tags onto World.sfx at the exact
 * point-of-cause (a bumper actually being hit, a wall actually being
 * bounced off, etc) - main.ts drains/clears the array once per step() and
 * maps each tag to a playSfx() call. Pushing at the source means transient
 * contacts cannot be missed by trying to infer them from state snapshots.
 */
export type SfxEvent =
  | 'flipperClick'
  | 'paintHit'
  | 'energyChime'
  | 'bossHitThud'
  | 'hostileSpawn'
  | 'echoCapture'
  | 'ballExplode'
  | 'upgradeOpen'
  | 'upgradePick'
  | 'gunShot'
  | 'armorHit'
  | 'armorBreak'
  | 'ballDrain'
  | 'launchWhoosh'
  | 'padBoost'
  | 'wallTick'
  | 'win'
  | 'lose';

/**
 * Discrete visual-feedback tags, pushed by sim.ts alongside SfxEvent at the
 * same points-of-cause (the boss taking a hit, or the round ending) - see
 * fx.ts, which owns the actual hit-flash/screen-shake/
 * floating-damage-number render state (kept outside World, same reasoning
 * as main.ts's ball-trail Map: it's ephemeral render state, not simulation
 * state that needs to be deterministic/serializable for tests).
 */
export interface FxEvent {
  kind: 'boss' | 'armor' | 'hostileBurst' | 'echoBurst' | 'win' | 'lose';
  x: number;
  y: number;
  /** damage dealt, drawn as a floating number - omitted for win/lose */
  amount?: number;
  critical?: boolean;
  heal?: boolean;
}

/**
 * Point-of-cause tag for "the ball physically touched something", pushed
 * by sim.ts's updateBalls at each specific collision-resolution site (not
 * inferred by diffing velocity afterward) - see bgfx.ts, which spawns a
 * paint-wash splat colored by `kind` so different things the ball hits
 * leave visibly different-colored splats instead of every contact looking
 * identical. `kind` deliberately mirrors how the rest of the game already
 * groups these (see SfxEvent's single 'wallTick' covering both walls and
 * pegs, and BUMPER_COLOR keying off bumper.kind).
 */
export interface ContactEvent {
  kind: 'structure' | 'flipper' | 'paint' | 'energy' | 'pad' | 'armor';
  x: number;
  y: number;
}

export interface LaunchState {
  x: number;
  y: number;
  charging: boolean;
  power: number; // 0..1
  autoTimer: number;
}

/**
 * Active while `phase === 'aim'`: the whole simulation is frozen (boss and
 * other balls) except this sweeping aim indicator, so the
 * player gets a fully readable window to pick a launch vector for the ball
 * that just touched an active flipper. See sim.ts's updateAim/fireAimedBall.
 */
export interface AimState {
  /** which ball is frozen and waiting to be relaunched */
  ballId: number;
  /** which flipper button re-fires the ball (release-to-fire) */
  side: FlipperSide;
  /** direction (radians) the sweep is centered on - toward the boss, biased
   * partway toward straight-up; fixed for the duration of this aim window */
  centerAngle: number;
  /** +/- half-angle of the sweep around centerAngle, fixed at contact time
   * (scales with the ball's multiplier - see AIM_CONE_MIN/MAX) */
  cone: number;
  /** ping-pong progress 0..1 across the sweep cone */
  sweepT: number;
  dir: 1 | -1;
  /** seconds left before auto-firing at the current sweep angle */
  timer: number;
}

export interface World {
  time: number;
  damageLog: [number, number][];
  vibrancy: number;
  spectrumPhase: number;
  phase: Phase;
  tableIndex: number;
  transitionTimer: number;
  nextBallId: number;
  /** total core balls left, including one currently in play */
  coreBalls: number;
  restoreTimer: number;
  randomSeed: number;
  points: number;
  upgrades: number[];
  previousUpgradeGap: number;
  upgradeGap: number;
  nextUpgradeAt: number;
  pendingUpgrades: number;
  upgradeCount: number;
  pick: PickState | null;
  balls: Ball[];
  bullets: Bullet[];
  walls: Wall[];
  flippers: Flipper[];
  boss: Boss;
  bumpers: Bumper[];
  pegs: Peg[];
  pads: LaunchPad[];
  launch: LaunchState;
  aim: AimState | null;
  /** transient per-step sound-event queue, see SfxEvent - drained by main.ts, cleared by sim.ts at the start of each step() */
  sfx: SfxEvent[];
  /** transient per-step visual-feedback queue, see FxEvent - drained by fx.ts, cleared by sim.ts at the start of each step() */
  fx: FxEvent[];
  /** transient per-step ball-contact queue, see ContactEvent - drained by bgfx.ts, cleared by sim.ts at the start of each step() */
  contacts: ContactEvent[];
}

export interface ControlsState {
  left: boolean;
  right: boolean;
  launch: boolean;
  choice: number | null;
}

export const NO_CONTROLS: ControlsState = {
  left: false,
  right: false,
  launch: false,
  choice: null,
};
