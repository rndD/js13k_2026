// Dev-only level editor. NOT imported by main.ts / index.html, so it never
// gets pulled into the production bundle (vite build only processes
// index.html - see vite.config.ts / scripts/pack.js). Run it via the Vite
// dev server at /editor.html.
//
// Lets you visually place/move/delete every LevelData element (walls as
// polylines, pegs, bumpers, flippers, launch pads, boss, launch point) and
// export the result as a drop-in replacement for the LEVEL const in level.ts.
import { CANVAS_H, FIELD_H, FIELD_W, HUD_HEIGHT } from './constants';
import { createWorld } from './entities';
import { LEVEL, type LevelData } from './level';
import { render } from './render';
import type { Vec2 } from './types';

type Mode =
  | 'select'
  | 'wall'
  | 'peg'
  | 'bumper-paint'
  | 'bumper-energy'
  | 'launchpad'
  | 'flipper-left'
  | 'flipper-right'
  | 'boss'
  | 'launch';

type Selection =
  | { kind: 'wallPoint'; wallIndex: number; pointIndex: number }
  | { kind: 'peg'; index: number }
  | { kind: 'bumper'; index: number }
  | { kind: 'launchPad'; index: number }
  | { kind: 'flipper'; index: number }
  | { kind: 'boss' }
  | { kind: 'launch' }
  | null;

const PEG_R = 9;
const BUMPER_R = 18;
const GRAB_R = 12; // click/drag tolerance for picking a point in select mode
const GRID_STEP = 20; // px between minor grid lines, in level/playfield space
const GRID_MAJOR_EVERY = 5; // every Nth line is a brighter major line (100px)
// Must match main.ts's storage key - that's how "Play This Level" hands the
// draft off to the real game (via ?level=draft, read from localStorage).
const STORAGE_KEY = 'js13k-level-draft';

function loadStoredLevel(): LevelData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Deep clone so we never mutate the imported LEVEL module binding directly.
// Resumes a previously saved draft if one exists, so a page reload doesn't
// silently discard unsaved work.
const level: LevelData = loadStoredLevel() ?? JSON.parse(JSON.stringify(LEVEL));

const canvas = document.getElementById('c') as HTMLCanvasElement;
canvas.width = FIELD_W;
canvas.height = CANVAS_H;
const ctx = canvas.getContext('2d')!;

let mode: Mode = 'select';
let selection: Selection = null;
let dragging = false;
let wallInProgress: Vec2[] | null = null;

const toolbar = document.getElementById('toolbar')!;
toolbar.querySelectorAll<HTMLButtonElement>('button[data-mode]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (wallInProgress) finishWall();
    mode = btn.dataset.mode as Mode;
    selection = null;
    toolbar.querySelectorAll('button[data-mode]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

document.getElementById('finishWall')!.addEventListener('click', finishWall);
document.getElementById('cancelWall')!.addEventListener('click', cancelWall);
document.getElementById('deleteSelected')!.addEventListener('click', deleteSelected);
document.getElementById('exportBtn')!.addEventListener('click', exportLevel);
document.getElementById('saveBtn')!.addEventListener('click', () => saveLevel(true));
document.getElementById('playBtn')!.addEventListener('click', playLevel);

function finishWall(): void {
  if (wallInProgress && wallInProgress.length >= 2) {
    level.walls.push(wallInProgress);
  }
  wallInProgress = null;
}

function cancelWall(): void {
  wallInProgress = null;
}

function deleteSelected(): void {
  if (!selection) return;
  if (selection.kind === 'wallPoint') {
    const wall = level.walls[selection.wallIndex];
    wall.splice(selection.pointIndex, 1);
    if (wall.length < 2) level.walls.splice(selection.wallIndex, 1);
  } else if (selection.kind === 'peg') {
    level.pegs.splice(selection.index, 1);
  } else if (selection.kind === 'bumper') {
    level.bumpers.splice(selection.index, 1);
  } else if (selection.kind === 'launchPad') {
    level.launchPads.splice(selection.index, 1);
  }
  // flippers/boss/launch are required singletons - not deletable.
  selection = null;
}

function exportLevel(): void {
  const box = document.getElementById('exportBox') as HTMLTextAreaElement;
  box.value = `export const LEVEL: LevelData = ${JSON.stringify(level, null, 2)};\n`;
  box.select();
}

function saveLevel(showStatus: boolean): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(level));
  if (showStatus) {
    const status = document.getElementById('saveStatus')!;
    status.textContent = `saved at ${new Date().toLocaleTimeString()}`;
  }
}

function playLevel(): void {
  saveLevel(false);
  window.open('/?level=draft', '_blank');
}

function toField(clientX: number, clientY: number): Vec2 {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * FIELD_W,
    y: ((clientY - rect.top) / rect.height) * CANVAS_H - HUD_HEIGHT,
  };
}

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Find the closest draggable/deletable point under the cursor, in select mode. */
function pickAt(p: Vec2): Selection {
  let best: Selection = null;
  let bestDist = GRAB_R;

  level.walls.forEach((wall, wi) => {
    wall.forEach((pt, pi) => {
      const d = dist(p, pt);
      if (d < bestDist) {
        bestDist = d;
        best = { kind: 'wallPoint', wallIndex: wi, pointIndex: pi };
      }
    });
  });
  level.pegs.forEach((peg, i) => {
    const d = dist(p, peg);
    if (d < bestDist) { bestDist = d; best = { kind: 'peg', index: i }; }
  });
  level.bumpers.forEach((b, i) => {
    const d = dist(p, b);
    if (d < bestDist) { bestDist = d; best = { kind: 'bumper', index: i }; }
  });
  level.launchPads.forEach((pad, i) => {
    const d = dist(p, pad);
    if (d < bestDist) { bestDist = d; best = { kind: 'launchPad', index: i }; }
  });
  level.flippers.forEach((f, i) => {
    const d = dist(p, f.pivot);
    if (d < bestDist) { bestDist = d; best = { kind: 'flipper', index: i }; }
  });
  if (dist(p, level.boss) < bestDist) { bestDist = dist(p, level.boss); best = { kind: 'boss' }; }
  if (dist(p, level.launch) < bestDist) { bestDist = dist(p, level.launch); best = { kind: 'launch' }; }

  return best;
}

function moveSelection(p: Vec2): void {
  if (!selection) return;
  if (selection.kind === 'wallPoint') {
    const pt = level.walls[selection.wallIndex][selection.pointIndex];
    pt.x = p.x; pt.y = p.y;
  } else if (selection.kind === 'peg') {
    Object.assign(level.pegs[selection.index], p);
  } else if (selection.kind === 'bumper') {
    Object.assign(level.bumpers[selection.index], p);
  } else if (selection.kind === 'launchPad') {
    Object.assign(level.launchPads[selection.index], p);
  } else if (selection.kind === 'flipper') {
    Object.assign(level.flippers[selection.index].pivot, p);
  } else if (selection.kind === 'boss') {
    Object.assign(level.boss, p);
  } else if (selection.kind === 'launch') {
    Object.assign(level.launch, p);
  }
}

canvas.addEventListener('pointerdown', (e) => {
  const p = toField(e.clientX, e.clientY);

  if (mode === 'select') {
    selection = pickAt(p);
    dragging = selection !== null;
    return;
  }
  if (mode === 'wall') {
    if (!wallInProgress) wallInProgress = [];
    wallInProgress.push(p);
    return;
  }
  if (mode === 'peg') {
    level.pegs.push({ x: p.x, y: p.y, r: PEG_R });
    return;
  }
  if (mode === 'bumper-paint') {
    level.bumpers.push({ x: p.x, y: p.y, r: BUMPER_R, kind: 'paint' });
    return;
  }
  if (mode === 'bumper-energy') {
    level.bumpers.push({ x: p.x, y: p.y, r: BUMPER_R, kind: 'energy' });
    return;
  }
  if (mode === 'launchpad') {
    // Point the new pad at the boss by default; drag its wall-point-less
    // angle later isn't supported yet, but you can edit the exported JSON.
    const angle = Math.atan2(level.boss.y - p.y, level.boss.x - p.x);
    level.launchPads.push({ x: p.x, y: p.y, angle });
    return;
  }
  if (mode === 'flipper-left') {
    level.flippers[0].pivot = { x: p.x, y: p.y };
    return;
  }
  if (mode === 'flipper-right') {
    level.flippers[1].pivot = { x: p.x, y: p.y };
    return;
  }
  if (mode === 'boss') {
    level.boss.x = p.x; level.boss.y = p.y;
    return;
  }
  if (mode === 'launch') {
    level.launch.x = p.x; level.launch.y = p.y;
    return;
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragging || mode !== 'select') return;
  moveSelection(toField(e.clientX, e.clientY));
});

canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointerleave', () => { dragging = false; });

window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') finishWall();
  else if (e.key === 'Escape') cancelWall();
  else if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
});

function drawGrid(): void {
  ctx.save();
  ctx.translate(0, HUD_HEIGHT);
  for (let x = 0; x <= FIELD_W; x += GRID_STEP) {
    // Major lines are phase-shifted one cell left so one of them lands
    // exactly on the centerline (FIELD_W/2=180 isn't a multiple of the
    // major spacing on its own - shifting the pattern by +1 cell fixes that).
    const major = (x / GRID_STEP + 1) % GRID_MAJOR_EVERY === 0;
    ctx.strokeStyle = major ? 'rgba(136,136,160,0.35)' : 'rgba(136,136,160,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, FIELD_H);
    ctx.stroke();
  }
  for (let y = 0; y <= FIELD_H; y += GRID_STEP) {
    const major = (y / GRID_STEP) % GRID_MAJOR_EVERY === 0;
    ctx.strokeStyle = major ? 'rgba(136,136,160,0.35)' : 'rgba(136,136,160,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(FIELD_W, y + 0.5);
    ctx.stroke();
  }

  ctx.restore();
}

function drawOverlay(): void {
  ctx.save();
  ctx.translate(0, HUD_HEIGHT);

  if (wallInProgress && wallInProgress.length > 0) {
    ctx.strokeStyle = '#ffe93b';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    wallInProgress.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.setLineDash([]);
    for (const p of wallInProgress) {
      ctx.fillStyle = '#ffe93b';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (mode === 'select') {
    ctx.fillStyle = 'rgba(56,214,255,0.5)';
    for (const wall of level.walls) {
      for (const p of wall) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  if (selection) {
    const p = selectionPoint(selection);
    if (p) {
      ctx.strokeStyle = '#ffe93b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, GRAB_R, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();

  ctx.fillStyle = '#e8e8f0';
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`mode: ${mode}`, 8, CANVAS_H - 8);
}

function selectionPoint(sel: NonNullable<Selection>): Vec2 | null {
  if (sel.kind === 'wallPoint') return level.walls[sel.wallIndex][sel.pointIndex];
  if (sel.kind === 'peg') return level.pegs[sel.index];
  if (sel.kind === 'bumper') return level.bumpers[sel.index];
  if (sel.kind === 'launchPad') return level.launchPads[sel.index];
  if (sel.kind === 'flipper') return level.flippers[sel.index].pivot;
  if (sel.kind === 'boss') return level.boss;
  if (sel.kind === 'launch') return level.launch;
  return null;
}

function frame(): void {
  const world = createWorld(level);
  // render() never clears the canvas itself (main.ts does a trail-darken
  // fillRect before calling it) - the editor wants a hard clear every
  // frame instead, or dragged points/overlays would smear.
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  render(ctx, world);
  drawOverlay();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
