import { expect } from 'playwright/test';

// A stalled browser frame deliberately pauses the game. Continue through the
// same control a player uses, keeping that protection active in browser tests.
export async function resumeArcadeIfPaused(page) {
  const resume = page.locator('#arcadeSheet .ar-paused');
  if (await resume.count()) {
    await resume.click();
    await page.locator('#arcadeSheet [data-ar-field]').focus();
  }
}

export async function waitForArcadePlay(page, timeout = 20_000) {
  await expect.poll(async () => {
    await resumeArcadeIfPaused(page);
    return page.evaluate(() => document.getElementById('arcadeSheet').arcadeRun?.phase);
  }, { timeout }).toBe('play');
}
