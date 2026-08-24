// Single source of truth for the game's color palette, per dis_doc.md's art
// direction: an almost-black/deep-violet field with pale-grey/white base
// geometry, and neon reserved for charged/energized things - "кислотные
// спектральные акценты": cyan, magenta, yellow, lime, violet. Every draw
// call in render.ts/fx.ts/main.ts pulls its colors from here instead of
// scattering slightly-different hex literals per file.
export const BG = '#050208'; // field/canvas background
export const HUD_BG = '#0a0612'; // HUD strip background
export const STRUCTURE = '#8888a0'; // pale grey - walls, pegs, flippers, HUD labels
export const WHITE = '#e8e8f0'; // bright neutral - fresh ball, boss face, plunger outline

export const CYAN = '#38d6ff'; // energy bumper / shield
export const MAGENTA = '#ff3bd6'; // overload/"big" projectiles
export const YELLOW = '#ffe93b'; // launch pads (speed), aim indicator, overload telegraph
export const LIME = '#9dff3b'; // bumper impact pulse rings
export const VIOLET = '#b23bff'; // launch-pad impact pulse rings, rainbow-tier accent
export const RED = '#ff3b6b'; // paint bumper / boss hp / damage
export const ORANGE = '#ff8a3b'; // base hp / normal projectiles / base-hit flash

/** The fully-charged "rainbow" ball tier cycles through this sequence. */
const SPECTRUM = [RED, YELLOW, LIME, CYAN, VIOLET, MAGENTA];

/**
 * Smoothly interpolated point on SPECTRUM, driven by world.time - the
 * rainbow ball tier should visibly cycle color instead of sitting on one
 * flat hue, per dis_doc.md: "радуга должна быть наградой за накопленную
 * силу" (the rainbow is the reward for accumulated power, so it should
 * actually read as a moving spectrum, not a static yellow).
 */
export function rainbowColor(time: number, speed = 1.4): string {
  const n = SPECTRUM.length;
  const t = (((time * speed) % n) + n) % n;
  const i = Math.floor(t);
  return lerpHex(SPECTRUM[i], SPECTRUM[(i + 1) % n], t - i);
}

function lerpHex(a: string, b: string, t: number): string {
  const ah = parseInt(a.slice(1), 16);
  const bh = parseInt(b.slice(1), 16);
  const r = Math.round(((ah >> 16) & 255) + ((((bh >> 16) & 255) - ((ah >> 16) & 255)) * t));
  const g = Math.round(((ah >> 8) & 255) + ((((bh >> 8) & 255) - ((ah >> 8) & 255)) * t));
  const bl = Math.round((ah & 255) + (((bh & 255) - (ah & 255)) * t));
  return `rgb(${r},${g},${bl})`;
}

/** Same hex color with an alpha channel, so we don't need a separate rgba()
 * literal (with hand-computed r/g/b) for every faded/dim variant of a color
 * already defined above. */
export function withAlpha(hex: string, a: number): string {
  const h = parseInt(hex.slice(1), 16);
  return `rgba(${(h >> 16) & 255},${(h >> 8) & 255},${h & 255},${a})`;
}
