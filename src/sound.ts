// Thin wrapper around the vendored ZzFX engine (see zzfx.ts). All presets
// below were generated with the official ZzFX Sound Designer
// (https://killedbyapixel.github.io/ZzFX/) using its built-in Blip/Pickup/
// Note/Jump/Hit/Shoot/Powerup/Explosion generators, then lightly normalized
// (volume balanced across presets, ball-drain's slide flipped negative for
// a "falling" rather than "rising" feel) - not hand-tuned from scratch, per
// dis_doc.md's "Звук" scope (a few short procedural effects, no music/audio
// files). Each is just the flat parameter array zzfx() expects.
import { zzfx, zzfxX } from './zzfx';
import type { SfxEvent } from './types';

type SfxParams = number[];

const SFX: Record<SfxEvent, SfxParams> = {
  // Flipper: ZzFX "Blip" preset - short percussive click.
  flipperClick: [0.8, , 17, 0.02, 0.03, 0.03, , 3.7, -47, 1, -413, 0.02, , , 13, 0.1, , 0.9, 0.02, , -694],
  // Paint bumper hit (charges + damages the boss): ZzFX "Pickup" preset.
  paintHit: [1.4, , 682, 0.01, 0.04, 0.28, 1, 3, , , 211, 0.1, , , , , , 0.58, 0.03, , 452],
  // Energy target hit: ZzFX "Powerup" preset (sine, with a pitch jump at
  // 0.08s) - brighter/shimmery, distinct from the old flat "Note" chime.
  energyChime: [0.8, , 673, , 0.21, 0.23, , 2.9, , , 400, 0.08, 0.11, , , , , 0.72, 0.21, , 774],
  // Direct pass-through boss damage (no paint charge involved): ZzFX "Hit" preset.
  bossHitThud: [1.4, , 112, 0.01, 0.06, 0.19, 4, 3.2, , , , , , 1.1, 22, , 0.14, 0.58, , , 1099],
  hostileSpawn: [0.8, , 180, 0.02, 0.08, 0.16, 2, 1.4, -3, -35, , , , 0.7],
  echoCapture: [1.1, , 720, 0.01, 0.08, 0.18, , 2.2, , 90, , , , , , , , 0.7],
  ballExplode: [0.75, , 110, 0.01, 0.06, 0.18, 4, 1.7, , -55, , , , 0.8, , 0.15, 0.03, 0.5],
  upgradeOpen: [0.6, , 420, 0.02, 0.1, 0.2, , 1.6, , 120, , , , , , , , 0.65],
  upgradePick: [0.9, , 760, 0.01, 0.08, 0.22, , 2.2, , 180, , 0.06, , , , , , 0.7],
  gunShot: [0.08, , 980, 0.01, 0.01, 0.035, 2, 2.2, , -120],
  armorHit: [0.8, , 150, 0.01, 0.03, 0.12, 4, 2.5, , -20],
  armorBreak: [1.1, , 90, 0.01, 0.08, 0.24, 4, 1.8, , -40, , , , 0.8],
  // Ball lost to a drain: ZzFX "Jump" preset with deltaSlide negated (was
  // +63, rising/triumphant) so it falls instead - fits losing a ball.
  ballDrain: [0.5, , 421, , 0.03, 0.09, 5, 1.27, , -63, , , , 0.9, , , , 0.95, 0.02, , -1500],
  // Ball launch / aim-fire release: ZzFX "Shoot" preset, volume normalized down from 1.8.
  launchWhoosh: [1.3, , 374, 0.01, , 0.09, 1, , -20, 34, , , , , 49, 0.4, 0.3, 0.72, 0.05, , -964],
  // Launch pad boost (yellow triangles): ZzFX "Jump" preset (bright, ascending, un-flipped - fits an upward boost).
  padBoost: [1.4, , 498, 0.01, 0.03, 0.07, , 3.6, , 156, , , , 0.7, , , 0.05, 0.76, 0.03, , -1458],
  // Plain non-scoring bounce off a wall/peg: ZzFX "Blip" preset, a second distinct roll from flipperClick.
  wallTick: [0.5, , 128, 0.01, 0.03, 0.009, 1, 1.9, 3, 36, -391, 0.07, , , , , , 0.53, , 0.03, -1382],
  // Boss defeated (win): ZzFX "Powerup" preset.
  win: [, , 610, 0.07, 0.16, 0.23, 1, 1.5, 5, , , , , , , 0.1, , 0.55, 0.12],
  // Run lost: ZzFX "Explosion" preset, shortened + quieted
  // (was 1.6 volume / 0.76s tail - way too much for what should be a clean
  // "round over" beat, not a war-movie explosion).
  lose: [0.9, , 33, 0.08, 0.1, 0.25, 1, 0.6, , , , , , 0.9, , 0.3, 0.06, 0.31, 0.11, , -2208],
};

export function playSfx(name: SfxEvent): void {
  zzfx(...SFX[name]);
}

// Browsers suspend a freshly-created AudioContext until a real user gesture
// resumes it (autoplay policy) - call this from the very first
// pointerdown/keydown the game sees (see input.ts) so every later playSfx()
// call actually produces sound instead of silently no-op'ing.
export function unlockAudio(): void {
  if (zzfxX.state === 'suspended') zzfxX.resume();
}
