// Standalone size checker: run `npm run size` after a build to see the
// current dist/game.zip size against the js13kGames budget.
import { statSync } from 'node:fs';
import { resolve } from 'node:path';

const BUDGET = 13312;
const ZIP = resolve('dist', 'game.zip');

try {
  const { size } = statSync(ZIP);
  const remaining = BUDGET - size;
  console.log(`${ZIP}: ${size} bytes`);
  console.log(remaining >= 0
    ? `OK — ${remaining} bytes under budget (${BUDGET})`
    : `OVER BUDGET by ${-remaining} bytes (limit ${BUDGET})`);
} catch {
  console.error('dist/game.zip not found. Run `npm run build` first.');
  process.exit(1);
}
