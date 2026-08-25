// Cheap, toggleable CRT/TV-style overlay: scanlines + a vignette + a faint
// flicker, drawn as an untransformed full-canvas post-process pass (after
// everything else, including screen shake) so it always reads as "glass in
// front of the tube" rather than shaking/shifting with the game field.
//
// No image assets (dis_doc.md's scope rule) - the scanline texture is a
// tiny generated repeating pattern, the vignette a cached radial gradient.
import { CANVAS_H, CRT_FLICKER_AMOUNT, CRT_SCANLINE_ALPHA, CRT_VIGNETTE_ALPHA, FIELD_W } from './constants';
import { BG, withAlpha } from './palette';

export interface CrtState {
  on: boolean;
  scanlines: CanvasPattern;
  vignette: CanvasGradient;
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

export function createCrtState(ctx: CanvasRenderingContext2D): CrtState {
  return { on: true, scanlines: buildScanlinePattern(ctx), vignette: buildVignette(ctx) };
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
}
