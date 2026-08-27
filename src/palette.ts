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

export const CYAN = '#38d6ff'; // energy bumper / charged ball
export const MAGENTA = '#ff3bd6'; // spectral accent
export const YELLOW = '#ffe93b'; // launch pads (speed), aim indicator
export const LIME = '#9dff3b'; // build-power / multiplier readout
export const VIOLET = '#b23bff'; // rainbow-tier spectrum accent, active-flipper glow
export const RED = '#ff3b6b'; // paint bumper / boss hp / damage
export const ORANGE = '#ff8a3b'; // warm hostile accent

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
  // Real hex (not rgb(...)), so withAlpha() below - which only understands
  // '#rrggbb' - can be applied to a rainbowColor() result. This bit us once
  // already: bgfx.ts's iridescent film bands passed rainbowColor() straight
  // into withAlpha(), which silently parsed the old "rgb(r,g,b)" string as
  // garbage hex (NaN -> 0), rendering every band as invisible black instead
  // of throwing - a hard-to-spot bug since nothing errored, the sheen just
  // never appeared.
  const toHex2 = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex2(r)}${toHex2(g)}${toHex2(bl)}`;
}

/** Same hex color with an alpha channel, so we don't need a separate rgba()
 * literal (with hand-computed r/g/b) for every faded/dim variant of a color
 * already defined above. */
export function withAlpha(hex: string, a: number): string {
  const h = parseInt(hex.slice(1), 16);
  return `rgba(${(h >> 16) & 255},${(h >> 8) & 255},${h & 255},${a})`;
}

/**
 * Runs `draw` with a soft colored light-bleed behind it (canvas shadow, not
 * a real glow shader - cheap and js13k-standard). This is the one thing a
 * flat saturated fill can't give us on a near-black field: real neon reads
 * as *emitting* light, not just being a bright color. Deliberately a
 * save/restore-scoped wrapper (not a bare ctx.shadowBlur= toggle) so a
 * caller can never forget to reset it and accidentally bleed glow onto
 * unrelated later draws.
 *
 * Reserved for "charged/energized" things only (balls, bumpers,
 * boss, launch pads, pulses) - structural geometry (walls/pegs/flippers)
 * and HUD text stay flat, per dis_doc.md's "effects must never come before
 * readability" rule.
 */
export function withGlow(ctx: CanvasRenderingContext2D, color: string, blur: number, draw: () => void): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  draw();
  ctx.restore();
}
