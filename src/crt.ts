// Cheap, toggleable CRT/TV-style overlay: scanlines + a vignette + a faint
// flicker + a real geometric "bulging glass" warp, drawn as a post-process
// pass over the fully-rendered scene.
//
// The bulge is genuine geometry, not a CSS trick: main.ts renders the whole
// playfield (bgfx/trails/render/fx, shake and all) onto `CrtState.sceneCtx`
// - an offscreen canvas - instead of directly onto the visible canvas. Once
// per frame, `drawCrtFrame` re-draws that finished scene onto the visible
// canvas in thin strips whose scale bulges outward toward the center and
// tapers back to 1x at the edges (cosine falloff): one pass over rows for
// horizontal bulge (scene -> scratch), one pass over columns for vertical
// bulge (scratch -> visible canvas). No per-pixel math, just ~2x
// CRT_BULGE_STRIPS drawImage calls - cheap, and reads as a genuinely convex
// old tube face instead of a flat rectangle. When `on` is false, the scene
// is instead blitted straight across with a single drawImage (zero extra
// cost - "easy to turn off" per the original ask), and the scanline/
// vignette/highlight overlay is skipped entirely.
//
// No image assets (dis_doc.md's scope rule) - the scanline texture is a
// tiny generated repeating pattern, the vignette/highlight cached radial
// gradients.
import {
  CANVAS_H,
  CRT_BULGE_AMOUNT,
  CRT_BULGE_STRIPS,
  CRT_FLICKER_AMOUNT,
  CRT_HIGHLIGHT_ALPHA,
  CRT_SCANLINE_ALPHA,
  CRT_VIGNETTE_ALPHA,
  FIELD_W,
} from './constants';
import { BG, WHITE, withAlpha } from './palette';

export interface CrtState {
  on: boolean;
  scanlines: CanvasPattern;
  vignette: CanvasGradient;
  highlight: CanvasGradient;
  /** Offscreen canvas the rest of the game draws its whole frame onto,
   * instead of the visible canvas - so this module can re-draw it warped. */
  scene: HTMLCanvasElement;
  sceneCtx: CanvasRenderingContext2D;
  /** Scratch buffer holding the result of the horizontal warp pass, before
   * the vertical pass draws it onto the visible canvas. */
  scratch: HTMLCanvasElement;
  scratchCtx: CanvasRenderingContext2D;
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

function makeOffscreen(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = FIELD_W;
  canvas.height = CANVAS_H;
  return { canvas, ctx: canvas.getContext('2d')! };
}

export function createCrtState(ctx: CanvasRenderingContext2D): CrtState {
  const scene = makeOffscreen();
  const scratch = makeOffscreen();
  return {
    on: true,
    scanlines: buildScanlinePattern(ctx),
    vignette: buildVignette(ctx),
    highlight: buildHighlight(ctx),
    scene: scene.canvas,
    sceneCtx: scene.ctx,
    scratch: scratch.canvas,
    scratchCtx: scratch.ctx,
  };
}

/** Bulges `src` onto `dst` one axis at a time: strips scale up toward the
 * center (cosine falloff) and back to 1x at the edges, so the whole image
 * balloons outward in the middle instead of shifting as a flat rectangle. */
function warpRows(src: CanvasImageSource, dst: CanvasRenderingContext2D, w: number, h: number): void {
  const stripH = h / CRT_BULGE_STRIPS;
  for (let i = 0; i < CRT_BULGE_STRIPS; i++) {
    const ny = ((i + 0.5) / CRT_BULGE_STRIPS) * 2 - 1; // -1..1, 0 at vertical center
    const scale = 1 + CRT_BULGE_AMOUNT * Math.cos((ny * Math.PI) / 2);
    const srcY = i * stripH;
    const destW = w * scale;
    dst.drawImage(src, 0, srcY, w, stripH, (w - destW) / 2, srcY, destW, stripH);
  }
}

function warpCols(src: CanvasImageSource, dst: CanvasRenderingContext2D, w: number, h: number): void {
  const stripW = w / CRT_BULGE_STRIPS;
  for (let i = 0; i < CRT_BULGE_STRIPS; i++) {
    const nx = ((i + 0.5) / CRT_BULGE_STRIPS) * 2 - 1; // -1..1, 0 at horizontal center
    const scale = 1 + CRT_BULGE_AMOUNT * Math.cos((nx * Math.PI) / 2);
    const srcX = i * stripW;
    const destH = h * scale;
    dst.drawImage(src, srcX, 0, stripW, h, srcX, (h - destH) / 2, stripW, destH);
  }
}

/** Call once per frame with the VISIBLE canvas's context, after the rest of
 * the game has finished drawing onto `crt.sceneCtx` for this frame. */
export function drawCrtFrame(ctx: CanvasRenderingContext2D, crt: CrtState, time: number): void {
  if (!crt.on) {
    ctx.drawImage(crt.scene, 0, 0); // zero-cost passthrough when disabled
    return;
  }

  warpRows(crt.scene, crt.scratchCtx, FIELD_W, CANVAS_H);
  warpCols(crt.scratch, ctx, FIELD_W, CANVAS_H);

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

