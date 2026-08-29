// Dev-only level editor. NOT imported by main.ts / index.html, so it never
// gets pulled into the production bundle (vite build only processes
// index.html - see vite.config.ts / scripts/pack.js). Run it via the Vite
// dev server at /editor.html.
//
// Lets you visually place/move/delete every LevelData element (walls as
// polylines, pegs, bumpers, flippers, launch pads, boss, launch point) and
// export the result as a drop-in replacement for a table const in level.ts.
import { CANVAS_H, FIELD_H, FIELD_W, HUD_HEIGHT } from './constants';
import { createWorld } from './entities';
import { LEVEL, LEVELS, type LevelData } from './level';
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
  | { kind: 'wall'; index: number }
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
const WALL_LINE_GRAB_R = 8; // click tolerance for grabbing a whole wall by its line, not a vertex
const GRID_STEP = 20; // px between minor grid lines, in level/playfield space
const GRID_MAJOR_EVERY = 5; // every Nth line is a brighter major line (100px)
const DUPLICATE_OFFSET = 20; // px, x/y nudge applied to a duplicated element so it doesn't land exactly on top of the original
const ROTATE_STEP = Math.PI / 12; // 15 degrees per rotate keypress/button, launch pads only
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

const levelParam = new URLSearchParams(location.search).get('level');
const requested = levelParam === null ? -1 : Number(levelParam);
const builtIn = LEVELS[requested];
const exportName = ['CROSSFIRE', 'ORBIT'][requested] ?? 'LEVEL';
// An explicit ?level=0/1 starts from that built-in table. Plain editor.html
// resumes the saved draft, falling back to the compact test fixture.
const level: LevelData = JSON.parse(JSON.stringify(builtIn ?? loadStoredLevel() ?? LEVEL));

// Undo/redo history: snapshots of the whole level as JSON strings. A snapshot
// of the pre-mutation state is pushed onto undoStack right before any action
// changes the level (see pushUndo()); undo pops it back and pushes the
// current state onto redoStack so redo can restore it again. Capped so an
// unbounded editing session doesn't grow memory forever.
const HISTORY_LIMIT = 100;
let undoStack: string[] = [];
let redoStack: string[] = [];

function snapshot(): string {
  return JSON.stringify(level);
}

function pushUndo(): void {
  undoStack.push(snapshot());
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack = [];
}

function restoreLevel(json: string): void {
  const data = JSON.parse(json) as LevelData;
  Object.assign(level, data);
  selection = null;
}

function undo(): void {
  if (undoStack.length === 0) return;
  redoStack.push(snapshot());
  restoreLevel(undoStack.pop()!);
}

function redo(): void {
  if (redoStack.length === 0) return;
  undoStack.push(snapshot());
  restoreLevel(redoStack.pop()!);
}

const canvas = document.getElementById('c') as HTMLCanvasElement;
canvas.width = FIELD_W;
canvas.height = CANVAS_H;
const ctx = canvas.getContext('2d')!;

let mode: Mode = 'select';
let selection: Selection = null;
let dragging = false;
let dragAnchor: Vec2 | null = null; // last pointer position while dragging a whole wall, for incremental delta
let dragStartSnapshot: string | null = null; // pre-drag level snapshot, for folding a whole drag into one undo step
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
document.getElementById('duplicateSelected')!.addEventListener('click', duplicateSelected);
document.getElementById('flipSelected')!.addEventListener('click', flipSelected);
document.getElementById('rotateCcw')!.addEventListener('click', () => rotateSelected(-ROTATE_STEP));
document.getElementById('rotateCw')!.addEventListener('click', () => rotateSelected(ROTATE_STEP));
document.getElementById('undoBtn')!.addEventListener('click', undo);
document.getElementById('redoBtn')!.addEventListener('click', redo);
document.getElementById('exportBtn')!.addEventListener('click', exportLevel);
document.getElementById('saveBtn')!.addEventListener('click', () => saveLevel(true));
document.getElementById('playBtn')!.addEventListener('click', playLevel);
document.getElementById('loadCrossfire')!.addEventListener('click', () => location.assign('/editor.html?level=0'));
document.getElementById('loadOrbit')!.addEventListener('click', () => location.assign('/editor.html?level=1'));

function finishWall(): void {
  if (wallInProgress && wallInProgress.length >= 2) {
    pushUndo();
    level.walls.push(wallInProgress);
  }
  wallInProgress = null;
}

function cancelWall(): void {
  wallInProgress = null;
}

function deleteSelected(): void {
  if (!selection) return;
  pushUndo();
  if (selection.kind === 'wall') {
    level.walls.splice(selection.index, 1);
  } else if (selection.kind === 'wallPoint') {
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

/** Clones the selected peg/bumper/launch pad/wall (offset by DUPLICATE_OFFSET
 * so it doesn't land exactly on the original), then selects the copy so it
 * can be dragged into place right away. Singletons (flipper/boss/launch)
 * can't be duplicated - the sim assumes exactly one of each. */
function duplicateSelected(): void {
  if (!selection) return;
  pushUndo();
  if (selection.kind === 'wall') {
    const clone = level.walls[selection.index].map((p) => ({ x: p.x + DUPLICATE_OFFSET, y: p.y + DUPLICATE_OFFSET }));
    level.walls.push(clone);
    selection = { kind: 'wall', index: level.walls.length - 1 };
  } else if (selection.kind === 'wallPoint') {
    const wall = level.walls[selection.wallIndex];
    const clone = wall.map((p) => ({ x: p.x + DUPLICATE_OFFSET, y: p.y + DUPLICATE_OFFSET }));
    level.walls.push(clone);
    selection = { kind: 'wallPoint', wallIndex: level.walls.length - 1, pointIndex: selection.pointIndex };
  } else if (selection.kind === 'peg') {
    const src = level.pegs[selection.index];
    level.pegs.push({ ...src, x: src.x + DUPLICATE_OFFSET, y: src.y + DUPLICATE_OFFSET });
    selection = { kind: 'peg', index: level.pegs.length - 1 };
  } else if (selection.kind === 'bumper') {
    const src = level.bumpers[selection.index];
    level.bumpers.push({ ...src, x: src.x + DUPLICATE_OFFSET, y: src.y + DUPLICATE_OFFSET });
    selection = { kind: 'bumper', index: level.bumpers.length - 1 };
  } else if (selection.kind === 'launchPad') {
    const src = level.launchPads[selection.index];
    level.launchPads.push({ ...src, x: src.x + DUPLICATE_OFFSET, y: src.y + DUPLICATE_OFFSET });
    selection = { kind: 'launchPad', index: level.launchPads.length - 1 };
  }
  // flippers/boss/launch are required singletons - not duplicable.
}

/** Mirrors the selected element's x coordinate about the field's horizontal
 * centerline (FIELD_W/2) - handy for building a symmetric table by placing
 * one side then flipping a copy across. Launch pad angles are mirrored too
 * (angle -> PI - angle), since flipping x reverses the pad's horizontal
 * aim while keeping its vertical aim the same. */
function flipSelected(): void {
  if (!selection) return;
  pushUndo();
  if (selection.kind === 'wall') {
    for (const p of level.walls[selection.index]) p.x = FIELD_W - p.x;
    return;
  }
  const p = selectionPoint(selection);
  if (!p) return;
  p.x = FIELD_W - p.x;
  if (selection.kind === 'launchPad') {
    level.launchPads[selection.index].angle = Math.PI - level.launchPads[selection.index].angle;
  }
}

/** Rotates the selected launch pad's aim by `delta` radians. No-op for any
 * other selection kind since nothing else has a rotatable angle. */
function rotateSelected(delta: number): void {
  if (!selection || selection.kind !== 'launchPad') return;
  pushUndo();
  level.launchPads[selection.index].angle += delta;
}

function exportLevel(): void {
  const box = document.getElementById('exportBox') as HTMLTextAreaElement;
  box.value = `export const ${exportName}: LevelData = ${JSON.stringify(level, null, 2)};\n`;
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

/** Find the closest draggable/deletable point under the cursor, in select
 * mode. Whole walls take priority over their individual vertices on a fresh
 * click, so a wall made of many closely-spaced points can still be grabbed
 * and dragged as a unit. Once a wall is selected (whole, or already drilled
 * into one of its points), clicking any of its OTHER vertices drills/jumps
 * straight to that point too - it stays "sticky" in point-editing mode so
 * you can move several points of the same wall one after another without
 * re-selecting the wall each time. Click the wall's line (not a vertex) to
 * go back to whole-wall selection, or click empty space/another element to
 * leave it entirely. */
function pickAt(p: Vec2): Selection {
  // Sticky drill-down: a wall is already the active selection (whole or one
  // of its points) and the click landed on one of that same wall's
  // vertices - edit that point instead of (re)selecting the whole wall.
  const activeWallIndex =
    selection?.kind === 'wall' ? selection.index :
    selection?.kind === 'wallPoint' ? selection.wallIndex :
    -1;
  if (activeWallIndex >= 0) {
    const wall = level.walls[activeWallIndex];
    if (wall) {
      let bestPi = -1;
      let bestPd = GRAB_R;
      wall.forEach((pt, pi) => {
        const d = dist(p, pt);
        if (d < bestPd) { bestPd = d; bestPi = pi; }
      });
      if (bestPi >= 0) return { kind: 'wallPoint', wallIndex: activeWallIndex, pointIndex: bestPi };
    }
  }

  let best: Selection = null;
  let bestDist = GRAB_R;

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

  // Whole-wall hit test: within GRAB_R of any vertex, or within
  // WALL_LINE_GRAB_R of any segment. Checked after the small fixed-size
  // elements above (so those stay individually pickable) but takes priority
  // over ever returning a single wallPoint on a first click.
  let bestWallDist = Math.max(GRAB_R, WALL_LINE_GRAB_R);
  level.walls.forEach((wall, wi) => {
    wall.forEach((pt) => {
      const d = dist(p, pt);
      if (d < GRAB_R && d < bestWallDist) { bestWallDist = d; best = { kind: 'wall', index: wi }; }
    });
    for (let i = 0; i < wall.length - 1; i++) {
      const d = distToSegment(p, wall[i], wall[i + 1]);
      if (d < WALL_LINE_GRAB_R && d < bestWallDist) { bestWallDist = d; best = { kind: 'wall', index: wi }; }
    }
  });

  return best;
}

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  let t = lenSq > 0 ? ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

function moveSelection(p: Vec2): void {
  if (!selection) return;
  if (selection.kind === 'wall') {
    if (dragAnchor) {
      const dx = p.x - dragAnchor.x;
      const dy = p.y - dragAnchor.y;
      for (const pt of level.walls[selection.index]) { pt.x += dx; pt.y += dy; }
    }
    dragAnchor = p;
    return;
  }
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
    dragAnchor = selection && selection.kind === 'wall' ? p : null;
    // Snapshot before the drag so pointerup can turn it into a single undo
    // step (only if the drag actually changed anything).
    dragStartSnapshot = dragging ? snapshot() : null;
    return;
  }
  if (mode === 'wall') {
    if (!wallInProgress) wallInProgress = [];
    wallInProgress.push(p);
    return;
  }
  if (mode === 'peg') {
    pushUndo();
    level.pegs.push({ x: p.x, y: p.y, r: PEG_R });
    return;
  }
  if (mode === 'bumper-paint') {
    pushUndo();
    level.bumpers.push({ x: p.x, y: p.y, r: BUMPER_R, kind: 'paint' });
    return;
  }
  if (mode === 'bumper-energy') {
    pushUndo();
    level.bumpers.push({ x: p.x, y: p.y, r: BUMPER_R, kind: 'energy' });
    return;
  }
  if (mode === 'launchpad') {
    // Point the new pad at the boss by default; drag its wall-point-less
    // angle later isn't supported yet, but you can edit the exported JSON.
    pushUndo();
    const angle = Math.atan2(level.boss.y - p.y, level.boss.x - p.x);
    level.launchPads.push({ x: p.x, y: p.y, angle });
    return;
  }
  if (mode === 'flipper-left') {
    pushUndo();
    level.flippers[0].pivot = { x: p.x, y: p.y };
    return;
  }
  if (mode === 'flipper-right') {
    pushUndo();
    level.flippers[1].pivot = { x: p.x, y: p.y };
    return;
  }
  if (mode === 'boss') {
    pushUndo();
    level.boss.x = p.x; level.boss.y = p.y;
    return;
  }
  if (mode === 'launch') {
    pushUndo();
    level.launch.x = p.x; level.launch.y = p.y;
    return;
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragging || mode !== 'select') return;
  moveSelection(toField(e.clientX, e.clientY));
});

/** Ends a select-mode drag, folding the whole drag into a single undo step
 * (rather than one per pointermove tick) - but only if it actually moved
 * something, so plain clicks-to-select don't clutter the undo history. */
function finalizeDrag(): void {
  if (dragging && dragStartSnapshot !== null) {
    const after = snapshot();
    if (after !== dragStartSnapshot) {
      undoStack.push(dragStartSnapshot);
      if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
      redoStack = [];
    }
  }
  dragging = false;
  dragAnchor = null;
  dragStartSnapshot = null;
}

canvas.addEventListener('pointerup', finalizeDrag);
canvas.addEventListener('pointerleave', finalizeDrag);

window.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && (e.key === 'z' || e.key === 'Z')) {
    e.preventDefault();
    if (e.shiftKey) redo(); else undo();
  } else if (mod && (e.key === 'y' || e.key === 'Y')) {
    e.preventDefault();
    redo();
  } else if (e.key === 'Enter') finishWall();
  else if (e.key === 'Escape') cancelWall();
  else if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
  else if (e.key === 'd' || e.key === 'D') { e.preventDefault(); duplicateSelected(); }
  else if (e.key === 'f' || e.key === 'F') flipSelected();
  else if (e.key === '[') rotateSelected(-ROTATE_STEP);
  else if (e.key === ']') rotateSelected(ROTATE_STEP);
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

  if (selection && selection.kind === 'wall') {
    const wall = level.walls[selection.index];
    if (wall) {
      ctx.strokeStyle = '#ffe93b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      wall.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    }
  } else if (selection) {
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
