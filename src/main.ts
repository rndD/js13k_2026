// Bootstrap: sets up the canvas, input, and a fixed-timestep game loop that
// drives sim.step(). This is the only file that touches requestAnimationFrame
// / the DOM canvas — everything else (sim.ts, physics.ts) is headless and
// unit-testable on its own.
import { CANVAS_H, FIELD_W, FIXED_DT } from './constants';
import { createWorld } from './entities';
import { bindInput } from './input';
import { render } from './render';
import { step } from './sim';

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
const world = createWorld();

let acc = 0;
let last = performance.now();

function frame(now: number): void {
  acc += Math.min(0.25, (now - last) / 1000); // clamp to avoid spiral of death on tab switch
  last = now;

  while (acc >= FIXED_DT) {
    step(world, controls, FIXED_DT);
    acc -= FIXED_DT;
  }

  // Darken instead of clear so balls/projectiles leave a short neon trail
  // (afterimage effect from dis_doc.md), without a second FX canvas. The HUD
  // bar redraws itself opaquely every frame, so this doesn't smear it.
  ctx.fillStyle = 'rgba(5,2,8,0.35)';
  ctx.fillRect(0, 0, FIELD_W, CANVAS_H);
  render(ctx, world);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
