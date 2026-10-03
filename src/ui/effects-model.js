// The pure half of the Effects module: how a run of frame times becomes a
// verdict, how a verdict is remembered, and how Automatic picks a mode. No DOM,
// so it is unit tested directly (test/fx.test.mjs). ui/effects.js does the measuring.

export const BENCH_KEY = 'shelflife.perf';
export const FULL_MEDIAN_MS = 22;
export const FULL_P90_MS = 34;
export const BENCH_FRAMES = 30;
const HEAVY_SHELF = 12;     // residents; beyond this even a fast phone goes Light in Automatic

/** 'full' | 'light' from a list of frame-to-frame times in ms; null if too few to judge. */
export function classifyFrames(deltas) {
  const ok = (deltas || []).filter(d => Number.isFinite(d) && d > 0);
  if (ok.length < 12) return null;
  const sorted = ok.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const p90 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))];
  return median <= FULL_MEDIAN_MS && p90 <= FULL_P90_MS ? 'full' : 'light';
}

/** What to remember after a reading. A slow reading is believed at once; a fast one twice. */
export function nextVerdict(previous, reading) {
  if (reading !== 'full' && reading !== 'light') return previous || null;
  if (!previous || (previous.tier !== 'full' && previous.tier !== 'light')) return { tier: reading, up: 0 };
  if (reading === previous.tier) return { tier: reading, up: 0 };
  if (reading === 'light') return { tier: 'light', up: 0 };
  const up = (previous.up || 0) + 1;
  return up >= 2 ? { tier: 'full', up: 0 } : { tier: 'light', up };
}

export function effectsMode(settings, { coarse = false, memory = 8, residents = 0, tier = null } = {}) {
  const mode = settings?.effects || 'auto';
  if (mode === 'light' || mode === 'full') return mode;
  if (memory <= 2) return 'light';
  if (tier === 'light') return 'light';
  if (tier === 'full') return residents >= HEAVY_SHELF ? 'light' : 'full';
  // No verdict yet: a touch screen starts Light until it has been measured, a
  // desktop starts Full. Either is corrected within a second.
  return coarse || memory <= 4 || residents >= 8 ? 'light' : 'full';
}
