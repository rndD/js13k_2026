// Single source of truth for the game's color palette, per dis_doc.md's art
// direction: saturated spectral pigments over a dark rainbow field. Colors
// are vivid but glows stay restrained, avoiding both neon and washed pastels.
// call in render.ts/fx.ts/main.ts pulls its colors from here instead of
// scattering slightly-different hex literals per file.
export const BG = '#100b1f';
export const HUD_BG = '#17102a';
export const STRUCTURE = '#b399ff';
export const WHITE = '#ffffff';

export const RED = '#ff174d';
export const ORANGE = '#ff7900';
export const YELLOW = '#ffd600';
export const LIME = '#00dc68';
export const CYAN = '#00a8ff';
export const VIOLET = '#7040ff';
export const MAGENTA = '#e000ff';

/** The fully-charged "rainbow" ball tier cycles through this sequence. */
export const SPECTRUM = [RED, ORANGE, YELLOW, LIME, CYAN, VIOLET, MAGENTA];
const NIGHT = ['#a00038', '#a74700', '#9d8100', '#008f4d', '#0079c4', '#6520df', '#b500ac'];

export function rainbowGradient(ctx: CanvasRenderingContext2D, x: number, y: number, dark = false, intensity = 1): CanvasGradient {
  const colors = dark ? NIGHT : SPECTRUM;
  const g = ctx.createLinearGradient(0, 0, x, y);
  colors.forEach((color, i) => g.addColorStop(i / (colors.length - 1), lerpHex(dark ? '#292533' : '#c8c0d6', color, intensity)));
  return g;
}

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
  ctx.shadowBlur = blur * 0.3;
  draw();
  ctx.restore();
}
