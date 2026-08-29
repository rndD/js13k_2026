// Cheap CRT/TV-style overlay: scanlines + a vignette + a faint
// flicker + a soft corner highlight, drawn as a post-process pass over the
// already-rendered frame. A geometric "bulging glass" warp (strip-scaled
// drawImage passes) was tried and reverted - it never looked convincing
// (either barely visible or clearly distorted depending on amount/anchor),
// and the user preferred keeping just the crisp scanline/vignette look over
// continuing to chase the bulge. Kept simple: draws straight onto whatever
// context it's given, no offscreen buffers needed.
//
// No image assets (dis_doc.md's scope rule) - the scanline texture is a
// tiny generated repeating pattern, the vignette/highlight cached radial
// gradients.
import {
  CANVAS_H,
  CRT_FLICKER_AMOUNT,
  CRT_SCANLINE_ALPHA,
  CRT_VIGNETTE_ALPHA,
  FIELD_W,
} from './constants';
import { BG, withAlpha } from './palette';

export interface CrtState {
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
  return {
    scanlines: buildScanlinePattern(ctx),
    vignette: buildVignette(ctx),
  };
}

/** Call once per frame after the scene has finished drawing onto `ctx`. */
export function drawCrtFrame(ctx: CanvasRenderingContext2D, crt: CrtState, time: number): void {
  const flicker = 1 + Math.sin(time * 37) * CRT_FLICKER_AMOUNT;
  ctx.globalAlpha = Math.max(0, Math.min(1, flicker));
  ctx.fillStyle = crt.scanlines;
  ctx.fillRect(0, 0, FIELD_W, CANVAS_H);
  ctx.globalAlpha = 1;

  ctx.fillStyle = crt.vignette;
  ctx.fillRect(0, 0, FIELD_W, CANVAS_H);

}


