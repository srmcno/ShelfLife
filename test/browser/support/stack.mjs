import { expect } from 'playwright/test';
import { resumeArcadeIfPaused, waitForArcadePlay } from './arcade.mjs';

// Wait for play, then time a real input against the moving coffin.
// Perfect alignment also earns a point under the Strict inspector modifier.
export async function firstStackDrop(page) {
  await expect(page.locator('#arcadeSheet [data-ar-field]')).toBeVisible();
  await waitForArcadePlay(page);
  await dropAlignedCoffin(page);
}

export async function dropAlignedCoffin(page) {
  await resumeArcadeIfPaused(page);
  await page.waitForFunction(() => {
    const run = document.getElementById('arcadeSheet').arcadeRun;
    if (!run || run.phase !== 'play' || run.paused || run.game.over) return false;
    const g = run.game, top = g.stack.at(-1);
    if (Math.abs(g.mover.x - top.x) > 0.018 * (g.mod?.perfect ?? 1)) return false;
    // Dispatch in this frame, so automation latency cannot miss the alignment.
    run.field.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    return true;
  }, null, { polling: 'raf' });
}
