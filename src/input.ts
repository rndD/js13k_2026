// Unified input: Pointer Events (multi-touch friendly, works for mouse too)
// mapped onto three bottom zones (left flipper / shield / right flipper) plus
// an upper-right launch zone, with keyboard fallback for desktop. Produces a
// single mutable ControlsState object that main.ts reads every frame.
//
// This file is intentionally the only place that touches the DOM for input;
// sim.ts only ever sees the plain ControlsState shape, which is what makes
// it possible to drive the simulation from scripted tests instead.
import { CANVAS_H, FIELD_H, FIELD_W, HUD_HEIGHT } from './constants';
import type { ControlsState } from './types';

type Zone = 'left' | 'right' | 'shield' | 'launch' | null;

function zoneAt(x: number, y: number): Zone {
  if (y < 0) return null; // touch landed in the HUD strip, not the playfield
  if (y > FIELD_H * 0.6) {
    if (x < FIELD_W * 0.33) return 'left';
    if (x > FIELD_W * 0.67) return 'right';
    return 'shield';
  }
  if (x > FIELD_W * 0.8) return 'launch';
  return null;
}

export function bindInput(canvas: HTMLCanvasElement): ControlsState {
  const controls: ControlsState = { left: false, right: false, shield: false, launch: false };
  const pointerZones = new Map<number, Zone>();
  const keys = { left: false, right: false, shield: false, launch: false };

  canvas.style.touchAction = 'none';

  function recompute(): void {
    let left = keys.left;
    let right = keys.right;
    let shield = keys.shield;
    let launch = keys.launch;
    for (const zone of pointerZones.values()) {
      if (zone === 'left') left = true;
      else if (zone === 'right') right = true;
      else if (zone === 'shield') shield = true;
      else if (zone === 'launch') launch = true;
    }
    controls.left = left;
    controls.right = right;
    controls.shield = shield;
    controls.launch = launch;
  }

  function toLogical(clientX: number, clientY: number): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * FIELD_W,
      y: ((clientY - rect.top) / rect.height) * CANVAS_H - HUD_HEIGHT,
    };
  }

  canvas.addEventListener('pointerdown', (e) => {
    const { x, y } = toLogical(e.clientX, e.clientY);
    pointerZones.set(e.pointerId, zoneAt(x, y));
    // Capture is just so a finger/mouse dragging off-canvas still delivers
    // pointerup here instead of getting silently lost - it's not essential
    // to the zone tracking itself, so a failure here (e.g. no genuine active
    // pointer, as with some synthetic/test-dispatched events) must never
    // skip recompute() below, or controls would silently stop updating.
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore - see comment above */
    }
    recompute();
  });
  canvas.addEventListener('pointerup', (e) => {
    pointerZones.delete(e.pointerId);
    recompute();
  });
  canvas.addEventListener('pointercancel', (e) => {
    pointerZones.delete(e.pointerId);
    recompute();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') keys.left = true;
    else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') keys.right = true;
    else if (e.key === ' ') keys.shield = true;
    else if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') keys.launch = true;
    else return;
    recompute();
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') keys.left = false;
    else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') keys.right = false;
    else if (e.key === ' ') keys.shield = false;
    else if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') keys.launch = false;
    else return;
    recompute();
  });

  return controls;
}
