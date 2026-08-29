// Bootstrap: sets up the canvas, input, and a fixed-timestep game loop that
// drives sim.step(). This is the only file that touches requestAnimationFrame
// / the DOM canvas — everything else (sim.ts, physics.ts) is headless and
// unit-testable on its own.
import { CANVAS_H, FIELD_W, FIXED_DT, HUD_HEIGHT } from './constants';
import { createWorld } from './entities';
import { createBgFx, drawBgFx, spawnBgFx, updateBgFx } from './bgfx';
import { createCrtState, drawCrtFrame } from './crt';
import { createFxState, drawFx, shakeOffset, updateFx } from './fx';
import { bindInput } from './input';
import { BG, CYAN, ORANGE } from './palette';
import { ballColor, render } from './render';
import { step } from './sim';
import { playSfx } from './sound';
import { LEVELS, type LevelData } from './level';

const canvas = document.getElementById('c') as HTMLCanvasElement;
canvas.width = FIELD_W;
canvas.height = CANVAS_H;

function resize(): void {
  const scale = Math.min(window.innerWidth / FIELD_W, window.innerHeight / CANVAS_H);
  canvas.style.width = `${FIELD_W * scale}px`;
  canvas.style.height = `${CANVAS_H * scale}px`;
}
window.addEventListener('resize', resize);
resize();

const ctx = canvas.getContext('2d')!;
const controls = bindInput(canvas);

// Dev workflow only: the level editor's "Play" button saves its draft to
// localStorage and opens this page with ?level=draft, so `LEVEL` can be
// swapped for the draft without a rebuild. Storage key must match
// leveleditor.ts's STORAGE_KEY. Harmless/inert for a normal play session.
function loadLevelOverride(): [LevelData | undefined, number] {
  const value = new URLSearchParams(location.search).get('level');
  if (value === 'draft') {
    const raw = localStorage.getItem('js13k-level-draft');
    return [raw ? JSON.parse(raw) : undefined, -1];
  }
  const index = value === null ? Math.floor(Math.random() * LEVELS.length) : Number(value);
  return [LEVELS[index], index];
}

let world = createWorld(...loadLevelOverride());
let started = false;
let waitForRelease = false;
let endedAt = 0;
function start(): void {
  if (!started) {
    started = true;
    waitForRelease = true;
  }
}
canvas.addEventListener('pointerdown', start);
window.addEventListener('keydown', start);

// Short tapered neon line per ball (dis_doc.md's trail/juice suggestion),
// tracked by ball id so a ball's own trail cleanly disappears once it drains
// instead of leaving orphaned points. Kept here (not in World/sim.ts) since
// it's pure render state, not simulation state - World must stay a plain,
// serializable snapshot for tests.
const TRAIL_LEN = 10;
interface TrailPoint { x: number; y: number; color: string; role: string; rainbow: boolean }
const trails = new Map<number, TrailPoint[]>();

function updateTrails(): void {
  const liveIds = new Set(world.balls.map((b) => b.id));
  for (const id of trails.keys()) if (!liveIds.has(id)) trails.delete(id);
  for (const ball of world.balls) {
    let pts = trails.get(ball.id);
    if (pts?.length && pts[pts.length - 1].role !== ball.role) pts = [];
    if (!pts) { pts = []; trails.set(ball.id, pts); }
    const color = ball.role === 'hostile' ? ORANGE : ball.role === 'echo' ? CYAN : ballColor(ball.color, world.time);
    pts.push({ x: ball.x, y: ball.y, color, role: ball.role, rainbow: ball.color === 'rainbow' });
    const maxLen = ball.color === 'rainbow' ? 20 : ball.role === 'core' ? TRAIL_LEN : ball.role === 'echo' ? 7 : 5;
    while (pts.length > maxLen) pts.shift();
  }
}

function drawTrails(): void {
  ctx.save();
  ctx.translate(0, HUD_HEIGHT);
  for (const pts of trails.values()) {
    ctx.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) {
      const t = i / (pts.length - 1);
      const roleAlpha = pts[i].rainbow ? 0.7 : pts[i].role === 'core' ? 0.5 : pts[i].role === 'echo' ? 0.3 : 0.45;
      ctx.globalAlpha = t * roleAlpha;
      ctx.strokeStyle = pts[i].rainbow ? ballColor('rainbow', world.time + i * 0.35) : pts[i].color;
      ctx.lineWidth = 1 + t * (pts[i].rainbow ? 4 : 3);
      ctx.beginPath();
      ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
      ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

let fx = createFxState();
let bgFx = createBgFx();
const crt = createCrtState(ctx);

function restart(): void {
  if ((world.phase !== 'win' && world.phase !== 'lose') || performance.now() - endedAt < 2000) return;
  world = createWorld(...loadLevelOverride());
  fx = createFxState();
  bgFx = createBgFx();
  trails.clear();
  acc = 0;
  last = performance.now();
  endedAt = 0;
  waitForRelease = true;
}
canvas.addEventListener('pointerdown', restart);
window.addEventListener('keydown', restart);

let acc = 0;
let last = performance.now();

function frame(now: number): void {
  const frameDt = Math.min(0.25, (now - last) / 1000); // clamp to avoid spiral of death on tab switch
  acc += frameDt;
  last = now;

  while (acc >= FIXED_DT) {
    if (started && !waitForRelease) step(world, controls, FIXED_DT);
    if (waitForRelease && !controls.left && !controls.right && !controls.launch && controls.choice === null) waitForRelease = false;
    // sim.ts pushes sound-event tags onto world.sfx at the exact point each
    // event actually happens (see types.ts's SfxEvent) instead of us trying
    // to infer transient contacts by diffing stats before/after.
    for (const name of world.sfx) playSfx(name);
    // Same point-of-cause push pattern as sfx, but carrying position/damage
    // payload for hit-flash/screen-shake/floating-damage-number feedback -
    // see fx.ts.
    updateFx(fx, world, FIXED_DT);
    // Splats onto the persistent background wash - spawned per fixed step
    // (not per rendered frame) for the same reason sfx is drained here: a
    // dropped/slow frame that runs multiple fixed steps must not miss hits.
    spawnBgFx(bgFx, world);
    acc -= FIXED_DT;
  }
  if (!endedAt && (world.phase === 'win' || world.phase === 'lose')) endedAt = now;
  updateTrails();
  // Age/drift/fade every splat at a constant real-world rate, independent
  // of how many fixed steps ran this frame (unlike spawnBgFx above, which
  // wants sim time so no contact is missed on a slow/catch-up frame).
  updateBgFx(bgFx, frameDt);

  // Full opaque reset every frame - no leftover "dirt" from previous frames
  // - then an explicit, deliberately-faded trail drawn underneath the crisp
  // current frame, instead of relying on an imperfect translucent overlay
  // that technically never fully clears (it only asymptotically approaches
  // the background color).
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, FIELD_W, CANVAS_H);

  // Screen shake only offsets the actual drawing below, not the opaque
  // clear above - so a shaking frame reveals the same flat background at
  // its edges instead of visible seams/gaps.
  const shake = shakeOffset(fx);
  ctx.save();
  ctx.translate(shake.x, shake.y);
  drawBgFx(ctx, bgFx, world);
  drawTrails();
  render(ctx, world, !started);
  drawFx(ctx, fx, world);
  ctx.restore();

  // CRT overlay is drawn last and untransformed (no shake) so it always
  // reads as glass in front of the tube, not part of the shaking field.
  drawCrtFrame(ctx, crt, world.time);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
