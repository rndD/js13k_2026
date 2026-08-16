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
  cooldown: number;
}

export type Phase = 'launch' | 'battle' | 'win' | 'lose';

export interface LaunchState {
  charging: boolean;
  power: number; // 0..1
}

export interface World {
  time: number;
  phase: Phase;
  nextBallId: number;
  balls: Ball[];
  flippers: Flipper[];
  boss: Boss;
  shield: Shield;
  base: Base;
  paintBumper: Bumper;
  energyTarget: Bumper;
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
