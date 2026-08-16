// Shared plain-data types for the whole simulation. Everything here is
// serializable (no functions, no class instances with methods) so a World
// can be deep-cloned for snapshots/tests without any special handling.

export interface Vec2 {
  x: number;
  y: number;
}

export interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** direct damage dealt per boss pass-through, before multiplier */
  damage: number;
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

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  damage: number;
  big: boolean;
}

export interface Boss {
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  shootTimer: number;
  overloadTimer: number;
  overloadCharging: boolean;
  overloadProgress: number; // 0..1
}

export interface Shield {
  energy: number;
  maxEnergy: number;
  hp: number;
  maxHp: number;
  active: boolean;
}

export interface Base {
  hp: number;
  maxHp: number;
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

export type Phase = 'launch' | 'battle' | 'win' | 'lose';

export interface LaunchState {
  x: number;
  y: number;
  charging: boolean;
  power: number; // 0..1
}

export interface World {
  time: number;
  phase: Phase;
  nextBallId: number;
  balls: Ball[];
  walls: Wall[];
  flippers: Flipper[];
  boss: Boss;
  shield: Shield;
  base: Base;
  bumpers: Bumper[];
  pegs: Peg[];
  launchPads: LaunchPad[];
  projectiles: Projectile[];
  launch: LaunchState;
}

export interface ControlsState {
  left: boolean;
  right: boolean;
  shield: boolean;
  launch: boolean;
}

export const NO_CONTROLS: ControlsState = {
  left: false,
  right: false,
  shield: false,
  launch: false,
};
