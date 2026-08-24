// Bootstrap: sets up the canvas, input, and a fixed-timestep game loop that
// drives sim.step(). This is the only file that touches requestAnimationFrame
// / the DOM canvas — everything else (sim.ts, physics.ts) is headless and
// unit-testable on its own.
import { BALL_RADIUS, CANVAS_H, FIELD_W, FIXED_DT, HUD_HEIGHT } from './constants';
import { createWorld } from './entities';
import { bindInput } from './input';
import { COLOR_HEX, render } from './render';
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

// Short neon afterimage per ball (dis_doc.md's trail/juice suggestion),
// tracked by ball id so a ball's own trail cleanly disappears once it drains
// instead of leaving orphaned points. Kept here (not in World/sim.ts) since
// it's pure render state, not simulation state - World must stay a plain,
// serializable snapshot for tests.
const TRAIL_LEN = 6;
interface TrailPoint { x: number; y: number; color: string }
const trails = new Map<number, TrailPoint[]>();

function updateTrails(): void {
  const liveIds = new Set(world.balls.map((b) => b.id));
  for (const id of trails.keys()) if (!liveIds.has(id)) trails.delete(id);
  for (const ball of world.balls) {
    let pts = trails.get(ball.id);
    if (!pts) { pts = []; trails.set(ball.id, pts); }
    pts.push({ x: ball.x, y: ball.y, color: COLOR_HEX[ball.color] });
    if (pts.length > TRAIL_LEN) pts.shift();
  }
}

function drawTrails(): void {
  ctx.save();
  ctx.translate(0, HUD_HEIGHT);
  for (const pts of trails.values()) {
    pts.forEach((p, i) => {
      ctx.globalAlpha = ((i + 1) / pts.length) * 0.5;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

let acc = 0;
let last = performance.now();

function frame(now: number): void {
  acc += Math.min(0.25, (now - last) / 1000); // clamp to avoid spiral of death on tab switch
  last = now;

  while (acc >= FIXED_DT) {
    step(world, controls, FIXED_DT);
    // sim.ts pushes sound-event tags onto world.sfx at the exact point each
    // event actually happens (see types.ts's SfxEvent) instead of us trying
    // to infer them by diffing stats before/after - diffing missed events
    // with no lasting stat change (e.g. an energy bumper hit while the
    // shield is already fully charged).
    for (const name of world.sfx) playSfx(name);
    acc -= FIXED_DT;
  }
  updateTrails();

  // Full opaque reset every frame - no leftover "dirt" from previous frames
  // - then an explicit, deliberately-faded trail drawn underneath the crisp
  // current frame, instead of relying on an imperfect translucent overlay
  // that technically never fully clears (it only asymptotically approaches
  // the background color).
  ctx.fillStyle = '#050208';
  ctx.fillRect(0, 0, FIELD_W, CANVAS_H);
  drawTrails();
  render(ctx, world);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
