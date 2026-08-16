// Integration test harness: feed a scripted timeline of ControlsState
// changes into sim.step() and collect World snapshots along the way.
//
// A script is a list of { t, controls } entries: "from time t onward, merge
// `controls` into the current controls state". The harness runs fixed-dt
// ticks from 0 up to `duration`, applying script entries as their time is
// reached, and returns a snapshot after every tick (or just the final one,
// depending on what the caller needs).
import { getSnapshot, step } from '../src/sim';
import type { ControlsState, World } from '../src/types';
import { NO_CONTROLS } from '../src/types';

export interface ScriptEntry {
  /** seconds from the start of the script at which this control change takes effect */
  t: number;
  controls: Partial<ControlsState>;
}

export interface RunScriptOptions {
  duration: number;
  dt?: number;
  /** collect a snapshot after every tick instead of just returning the final world */
  recordEvery?: boolean;
}

export interface RunScriptResult {
  world: World;
  snapshots: World[];
}

export function runScript(world: World, script: ScriptEntry[], options: RunScriptOptions): RunScriptResult {
  const dt = options.dt ?? 1 / 60;
  const sorted = [...script].sort((a, b) => a.t - b.t);
  const controls: ControlsState = { ...NO_CONTROLS };
  const snapshots: World[] = [];

  let time = 0;
  let scriptIndex = 0;

  while (time < options.duration) {
    while (scriptIndex < sorted.length && sorted[scriptIndex].t <= time) {
      Object.assign(controls, sorted[scriptIndex].controls);
      scriptIndex += 1;
    }

    step(world, controls, dt);
    time += dt;

    if (options.recordEvery) {
      snapshots.push(getSnapshot(world));
    }
  }

  return { world, snapshots };
}
