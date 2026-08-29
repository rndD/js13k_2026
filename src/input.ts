// Unified input: Pointer Events (multi-touch friendly, works for mouse too)
// mapped onto the two bottom flipper zones plus the upper-right third for launch,
// with keyboard fallback for desktop. Produces a
// single mutable ControlsState object that main.ts reads every frame.
//
// This file is intentionally the only place that touches the DOM for input;
// sim.ts only ever sees the plain ControlsState shape, which is what makes
// it possible to drive the simulation from scripted tests instead.
import { CANVAS_H, FIELD_H, FIELD_W, HUD_HEIGHT } from './constants';
import { unlockAudio } from './sound';
import type { ControlsState } from './types';

type Zone = 'left' | 'right' | 'launch' | null;

function zoneAt(x: number, y: number): Zone {
  if (y < 0) return null; // touch landed in the HUD strip, not the playfield
  if (y > FIELD_H * 0.6) {
    if (x < FIELD_W * 0.33) return 'left';
    if (x > FIELD_W * 0.67) return 'right';
    return null;
  }
  if (x > FIELD_W * 0.67) return 'launch';
  return null;
}

export function bindInput(canvas: HTMLCanvasElement): ControlsState {
  const controls: ControlsState = { left: false, right: false, launch: false, choice: null };
  const pointerZones = new Map<number, Zone>();
  const pointerChoices = new Map<number, number>();
  const keys = { left: false, right: false, launch: false, choice: null as number | null };

  canvas.style.touchAction = 'none';

  function recompute(): void {
    let left = keys.left;
    let right = keys.right;
    let launch = keys.launch;
    for (const zone of pointerZones.values()) {
      if (zone === 'left') left = true;
      else if (zone === 'right') right = true;
      else if (zone === 'launch') launch = true;
    }
    controls.left = left;
    controls.right = right;
    controls.launch = launch;
    controls.choice = keys.choice ?? pointerChoices.values().next().value ?? null;
  }

  function toLogical(clientX: number, clientY: number): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * FIELD_W,
      y: ((clientY - rect.top) / rect.height) * CANVAS_H - HUD_HEIGHT,
    };
  }

  canvas.addEventListener('pointerdown', (e) => {
    unlockAudio(); // first real user gesture - browsers require this before any Web Audio playback
    const { x, y } = toLogical(e.clientX, e.clientY);
    pointerZones.set(e.pointerId, zoneAt(x, y));
    if (y >= 185 && y <= 375) pointerChoices.set(e.pointerId, Math.max(0, Math.min(2, Math.floor(x / (FIELD_W / 3)))));
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
    pointerChoices.delete(e.pointerId);
    recompute();
  });
  canvas.addEventListener('pointercancel', (e) => {
    pointerZones.delete(e.pointerId);
    pointerChoices.delete(e.pointerId);
    recompute();
  });

  window.addEventListener('keydown', (e) => {
    unlockAudio(); // harmless no-op once already resumed, see pointerdown above
    if (e.key === 'ArrowLeft') keys.left = true;
    else if (e.key === 'ArrowRight') keys.right = true;
    else if (e.key === 'ArrowUp') keys.launch = true;
    else if (e.key === '1' || e.key === '2' || e.key === '3') keys.choice = Number(e.key) - 1;
    else return;
    recompute();
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') keys.left = false;
    else if (e.key === 'ArrowRight') keys.right = false;
    else if (e.key === 'ArrowUp') keys.launch = false;
    else if (e.key === '1' || e.key === '2' || e.key === '3') keys.choice = null;
    else return;
    recompute();
  });

  return controls;
}
