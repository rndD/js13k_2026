// Cheap, toggleable CRT/TV-style overlay: scanlines + a vignette + a faint
// flicker, drawn as an untransformed full-canvas post-process pass (after
// everything else, including screen shake) so it always reads as "glass in
// front of the tube" rather than shaking/shifting with the game field.
//
// The "curved tube" look itself isn't drawn here at all - index.html rounds
// the <canvas> element's own corners via a CSS class toggled alongside
// `on` (see main.ts), which is a free, real corner-curve instead of an
// expensive per-pixel barrel-distortion warp. This module only adds a
// faint off-center highlight gradient, which sells the rest of the "curved
// glass" illusion for one extra cached gradient.
//
// No image assets (dis_doc.md's scope rule) - the scanline texture is a
// tiny generated repeating pattern, the vignette/highlight cached radial
// gradients.
import { CANVAS_H, CRT_FLICKER_AMOUNT, CRT_HIGHLIGHT_ALPHA, CRT_SCANLINE_ALPHA, CRT_VIGNETTE_ALPHA, FIELD_W } from './constants';
import { BG, WHITE, withAlpha } from './palette';

export interface CrtState {
  on: boolean;
  scanlines: CanvasPattern;
  vignette: CanvasGradient;
  highlight: CanvasGradient;
}

function buildScanlinePattern(ctx: CanvasRenderingContext2D): CanvasPattern {
  const tile = document.createElement('canvas');
  tile.width = 1;
  tile.height = 4;
  const tctx = tile.getContext('2d')!;
  tctx.fillStyle = withAlpha(BG, CRT_SCANLINE_ALPHA);
  tctx.fillRect(0, 0, 1, 2); // top half of the tile darkened, bottom half left clear -> repeating scanlines
  return ctx.createPattern(tile, 'repeat')!;
}

function buildVignette(ctx: CanvasRenderingContext2D): CanvasGradient {
  const cx = FIELD_W / 2;
  const cy = CANVAS_H / 2;
  const g = ctx.createRadialGradient(cx, cy, CANVAS_H * 0.35, cx, cy, CANVAS_H * 0.75);
  g.addColorStop(0, withAlpha(BG, 0));
  g.addColorStop(1, withAlpha(BG, CRT_VIGNETTE_ALPHA));
  return g;
}

// Off-center soft highlight, like a glass reflection catching the light on
// a curved tube face - upper-left, small, low-alpha so it stays a subtle
// hint rather than a distracting glare.
function buildHighlight(ctx: CanvasRenderingContext2D): CanvasGradient {
  const g = ctx.createRadialGradient(FIELD_W * 0.32, CANVAS_H * 0.14, 0, FIELD_W * 0.32, CANVAS_H * 0.14, CANVAS_H * 0.55);
  g.addColorStop(0, withAlpha(WHITE, CRT_HIGHLIGHT_ALPHA));
  g.addColorStop(1, withAlpha(WHITE, 0));
  return g;
}

export function createCrtState(ctx: CanvasRenderingContext2D): CrtState {
  return {
    on: true,
    scanlines: buildScanlinePattern(ctx),
    vignette: buildVignette(ctx),
    highlight: buildHighlight(ctx),
  };
}

export function drawCrt(ctx: CanvasRenderingContext2D, crt: CrtState, time: number): void {
  if (!crt.on) return;
  const flicker = 1 + Math.sin(time * 37) * CRT_FLICKER_AMOUNT;
  ctx.globalAlpha = Math.max(0, Math.min(1, flicker));
  ctx.fillStyle = crt.scanlines;
  ctx.fillRect(0, 0, FIELD_W, CANVAS_H);
  ctx.globalAlpha = 1;

  ctx.fillStyle = crt.vignette;
  ctx.fillRect(0, 0, FIELD_W, CANVAS_H);

  ctx.fillStyle = crt.highlight;
  ctx.fillRect(0, 0, FIELD_W, CANVAS_H);
}
