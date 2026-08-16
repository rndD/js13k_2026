import { describe, expect, it } from 'vitest';
import {
  clampSpeed,
  integrate,
  overlapsCircle,
  resolveBumper,
  resolveFlipper,
  resolveWalls,
} from '../src/physics';
import { createFlippers } from '../src/entities';
import type { Flipper } from '../src/types';

describe('clampSpeed', () => {
  it('leaves slow velocities untouched', () => {
    const m = { x: 0, y: 0, vx: 10, vy: 0, r: 5 };
    clampSpeed(m, 100);
    expect(m.vx).toBe(10);
  });

  it('scales down velocities over the max speed, preserving direction', () => {
    const m = { x: 0, y: 0, vx: 300, vy: 400, r: 5 }; // speed 500
    clampSpeed(m, 100);
    expect(Math.hypot(m.vx, m.vy)).toBeCloseTo(100, 5);
    expect(m.vx / m.vy).toBeCloseTo(300 / 400, 5);
  });
});

describe('integrate', () => {
  it('applies gravity to velocity and moves position', () => {
    const m = { x: 0, y: 0, vx: 10, vy: 0, r: 5 };
    integrate(m, 1, { x: 0, y: 100 });
    expect(m.vy).toBe(100);
    expect(m.y).toBe(100);
    expect(m.x).toBe(10);
  });
});

describe('resolveWalls', () => {
  it('bounces off the left wall', () => {
    const m = { x: -1, y: 300, vx: -50, vy: 0, r: 5 };
    const result = resolveWalls(m, 360, 640);
    expect(result).toBe('bounced');
    expect(m.x).toBe(5);
    expect(m.vx).toBeGreaterThan(0);
  });

  it('bounces off the right wall', () => {
    const m = { x: 365, y: 300, vx: 50, vy: 0, r: 5 };
    const result = resolveWalls(m, 360, 640);
    expect(result).toBe('bounced');
    expect(m.x).toBe(355);
    expect(m.vx).toBeLessThan(0);
  });

  it('bounces off the top wall', () => {
    const m = { x: 180, y: -1, vx: 0, vy: -50, r: 5 };
    const result = resolveWalls(m, 360, 640);
    expect(result).toBe('bounced');
    expect(m.y).toBe(5);
    expect(m.vy).toBeGreaterThan(0);
  });

  it('drains a ball that falls through the drain gap', () => {
    const m = { x: 180, y: 700, vx: 0, vy: 50, r: 5 }; // center x is inside the drain gap
    const result = resolveWalls(m, 360, 640);
    expect(result).toBe('drained');
  });

  it('bounces off the bottom apron outside the drain gap', () => {
    const m = { x: 10, y: 700, vx: 0, vy: 50, r: 5 }; // near the left edge, outside drain
    const result = resolveWalls(m, 360, 640);
    expect(result).toBe('bounced');
    expect(m.vy).toBeLessThan(0);
  });

  it('lets a ball in the drain gap keep falling past a raised apron instead of vanishing instantly', () => {
    // Regression: when apronY (the compact play area boundary) is raised well
    // above drainY (the true bottom of the field), a ball inside the drain
    // gap must NOT be removed the instant it clears the apron - it should
    // keep falling visibly until it actually reaches drainY.
    const apronY = 500;
    const drainY = 640;
    const m = { x: 180, y: apronY + 5 + 5, vx: 0, vy: 50, r: 5 }; // just past the apron, still well above drainY
    const result = resolveWalls(m, 360, apronY, drainY);
    expect(result).toBe('none'); // still falling, not drained, not bounced
    expect(m.y).toBe(apronY + 10); // position untouched, no snap-back

    // Once it actually reaches the true bottom, it drains.
    const bottom = { x: 180, y: drainY + 10, vx: 0, vy: 50, r: 5 };
    expect(resolveWalls(bottom, 360, apronY, drainY)).toBe('drained');
  });
});

describe('overlapsCircle', () => {
  it('detects overlap', () => {
    expect(overlapsCircle({ x: 0, y: 0, r: 5 }, { x: 8, y: 0, r: 5 })).toBe(true);
  });
  it('detects no overlap', () => {
    expect(overlapsCircle({ x: 0, y: 0, r: 5 }, { x: 20, y: 0, r: 5 })).toBe(false);
  });
});

describe('resolveBumper', () => {
  it('pushes the ball away from the bumper center at impulseSpeed', () => {
    const m = { x: 10, y: 0, vx: 0, vy: 0, r: 5 };
    const hit = resolveBumper(m, { x: 0, y: 0, r: 10 }, 300);
    expect(hit).toBe(true);
    expect(m.vx).toBeCloseTo(300, 5);
    expect(m.x).toBeGreaterThanOrEqual(15);
  });

  it('does nothing when not overlapping', () => {
    const m = { x: 100, y: 0, vx: 0, vy: 0, r: 5 };
    const hit = resolveBumper(m, { x: 0, y: 0, r: 10 }, 300);
    expect(hit).toBe(false);
    expect(m.vx).toBe(0);
  });
});

describe('resolveFlipper', () => {
  function makeFlipper(active: boolean): Flipper {
    return {
      side: 'left',
      pivot: { x: 100, y: 500 },
      length: 60,
      angle: active ? -0.55 : 0.55,
      restAngle: 0.55,
      activeAngle: -0.55,
      active,
    };
  }

  /** Place a ball just touching the flipper's midpoint, approaching from
   * directly above, so the collision normal is well-defined (not degenerate
   * like it would be if placed exactly on the segment's tip). */
  function ballTouchingMidpoint(f: Flipper, r: number, thickness: number, vy: number) {
    const tipX = f.pivot.x + Math.cos(f.angle) * f.length;
    const tipY = f.pivot.y + Math.sin(f.angle) * f.length;
    const midX = (f.pivot.x + tipX) / 2;
    const midY = (f.pivot.y + tipY) / 2;
    const dx = tipX - f.pivot.x;
    const dy = tipY - f.pivot.y;
    const segLen = Math.hypot(dx, dy);
    let nx = -dy / segLen;
    let ny = dx / segLen;
    if (ny > 0) { nx = -nx; ny = -ny; } // pick the perpendicular pointing upward (approaching from above)
    const contactDist = (r + thickness) * 0.9; // just inside the collision radius
    return { x: midX + nx * contactDist, y: midY + ny * contactDist, vx: 0, vy, r };
  }

  it('gives a strong boost when the flipper is active', () => {
    const f = makeFlipper(true);
    const m = ballTouchingMidpoint(f, 6, 8, 10);
    const hit = resolveFlipper(m, f, 500, 8);
    expect(hit).toBe(true);
    expect(Math.hypot(m.vx, m.vy)).toBeGreaterThan(100);
  });

  it('passively reflects when the flipper is at rest', () => {
    const f = makeFlipper(false);
    const m = ballTouchingMidpoint(f, 6, 8, 100);
    const hit = resolveFlipper(m, f, 500, 8);
    expect(hit).toBe(true);
    expect(m.vy).toBeLessThanOrEqual(0);
  });

  it('mirrors the right flipper toward the field center (regression: double-mirroring bug)', () => {
    // createFlippers() already mirrors the right flipper's angle (Math.PI - restAngle).
    // The tip must point toward the center of the table, same as the left flipper's
    // tip does but reflected - NOT in the same absolute direction as the left one.
    const [left, right] = createFlippers();

    const leftTipX = left.pivot.x + Math.cos(left.angle) * left.length;
    const rightTipX = right.pivot.x + Math.cos(right.angle) * right.length;

    // Left flipper's tip is to the right of its own pivot (toward center).
    expect(leftTipX).toBeGreaterThan(left.pivot.x);
    // Right flipper's tip must be to the LEFT of its own pivot (toward center),
    // i.e. mirrored, not pointing further right like the left flipper does.
    expect(rightTipX).toBeLessThan(right.pivot.x);
  });
});
