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
import { BG } from './palette';
import { ballColor, render } from './render';
import { step } from './sim';
import { playSfx } from './sound';
import type { LevelData } from './level';

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
function loadLevelOverride(): LevelData | undefined {
  if (new URLSearchParams(location.search).get('level') !== 'draft') return undefined;
  const raw = localStorage.getItem('js13k-level-draft');
  return raw ? JSON.parse(raw) : undefined;
}

const world = createWorld(loadLevelOverride());

// Short tapered neon line per ball (dis_doc.md's trail/juice suggestion),
// tracked by ball id so a ball's own trail cleanly disappears once it drains
// instead of leaving orphaned points. Kept here (not in World/sim.ts) since
// it's pure render state, not simulation state - World must stay a plain,
// serializable snapshot for tests.
const TRAIL_LEN = 10;
interface TrailPoint { x: number; y: number; color: string }
const trails = new Map<number, TrailPoint[]>();

function updateTrails(): void {
  const liveIds = new Set(world.balls.map((b) => b.id));
  for (const id of trails.keys()) if (!liveIds.has(id)) trails.delete(id);
  for (const ball of world.balls) {
    let pts = trails.get(ball.id);
    if (!pts) { pts = []; trails.set(ball.id, pts); }
    pts.push({ x: ball.x, y: ball.y, color: ballColor(ball.color, world.time) });
    if (pts.length > TRAIL_LEN) pts.shift();
  }
}

function drawTrails(): void {
  ctx.save();
  ctx.translate(0, HUD_HEIGHT);
  for (const pts of trails.values()) {
    ctx.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) {
      const t = i / (pts.length - 1);
      ctx.globalAlpha = t * 0.5;
      ctx.strokeStyle = pts[i].color;
      ctx.lineWidth = 1 + t * 3;
      ctx.beginPath();
      ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
      ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

const fx = createFxState();
const bgFx = createBgFx();
const crt = createCrtState(ctx);

// Toggle button (see index.html) - kept as a plain DOM element rather than
// a canvas hit-zone so it never competes with the gameplay touch zones.
document.getElementById('crtBtn')?.addEventListener('click', () => {
  crt.on = !crt.on;
});

let acc = 0;
let last = performance.now();

function frame(now: number): void {
  const frameDt = Math.min(0.25, (now - last) / 1000); // clamp to avoid spiral of death on tab switch
  acc += frameDt;
  last = now;

  while (acc >= FIXED_DT) {
    step(world, controls, FIXED_DT);
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
  render(ctx, world);
  drawFx(ctx, fx, world);
  ctx.restore();

  // CRT overlay is drawn last and untransformed (no shake) so it always
  // reads as glass in front of the tube, not part of the shaking field.
  drawCrtFrame(ctx, crt, world.time);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
