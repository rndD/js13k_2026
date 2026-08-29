// Single source of truth for the game's color palette, per dis_doc.md's art
// direction: a deep-indigo field with soft neutral geometry and a balanced
// pastel spectrum. Warm/cool complements keep combat readable without the
// previous acidic-neon look. Every draw
// call in render.ts/fx.ts/main.ts pulls its colors from here instead of
// scattering slightly-different hex literals per file.
export const BG = '#17152b'; // deep indigo field
export const HUD_BG = '#211d38';
export const STRUCTURE = '#aaa5c4'; // muted lavender neutral
export const WHITE = '#fff8ed'; // warm neutral

export const CYAN = '#72d7e8';
export const MAGENTA = '#f08bc5';
export const YELLOW = '#f6d66f';
export const LIME = '#9bdd9a';
export const VIOLET = '#b89ae8';
export const RED = '#f07878';
export const ORANGE = '#f2a36f';

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
  ctx.shadowBlur = blur * 0.4;
  draw();
  ctx.restore();
}
