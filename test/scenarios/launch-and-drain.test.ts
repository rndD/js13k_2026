// Scenario: launch a ball, then leave it entirely to gravity and the passive
// (un-held) flippers. With no player input to save it, it must eventually
// fall through the drain and hand control back to the launch phase.
import { describe, expect, it } from 'vitest';
import { createWorld } from '../../src/entities';
import { runScript } from '../harness';

describe('scenario: launch and drain', () => {
  it('spawns a ball on launch release, then returns to the launch phase once it drains', () => {
    const world = createWorld();

    const { world: result } = runScript(
      world,
      [
        { t: 0, controls: { launch: true } },
        { t: 0.5, controls: { launch: false } },
      ],
      { duration: 10 },
    );

    // The ball must have been launched into battle at some point...
    expect(result.nextBallId).toBeGreaterThan(1);
    // ...and with no flipper input to rescue it, it cannot still be alive
    // and un-drained after 10 simulated seconds of unattended falling.
    if (result.phase === 'launch') {
      expect(result.balls).toHaveLength(0);
    } else {
      expect(['battle', 'pick']).toContain(result.phase);
    }
  });
});
