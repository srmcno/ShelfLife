import { BENCH_RANKS, BENCH_MAX } from '../content/court-career.js';

/* The bench career, as pure functions of the courtroom record. Lifetime stars
   (one to three per episode you air yourself) climb ten ranks. A save from
   before the career existed is credited with the best star count it already
   has on every case, so nobody starts again from Courtroom Sweeper. */

// Lifetime stars, with the old saves' floor.
export function careerStars(c) {
  const best = Object.values(c?.best || {}).reduce((n, s) => n + (Number.isFinite(s) ? s : 0), 0);
  return Math.max(Number.isFinite(c?.stars) ? c.stars : 0, best);
}
export function rankIndexFor(stars) {
  let rank = 0;
  BENCH_RANKS.forEach((r, i) => { if (stars >= r.stars) rank = i; });
  return rank;
}
// The ranks climbed between two rank indexes, with what they pay and unlock.
export function benchPromotion(from, to) {
  if (!(to > from)) return null;
  const ranks = [];
  for (let i = from + 1; i <= Math.min(to, BENCH_MAX); i++) ranks.push(i);
  return {
    from, to, ranks, souls: ranks.reduce((n, i) => n + BENCH_RANKS[i].souls, 0),
    name: BENCH_RANKS[to].name, unlocks: ranks.map(i => BENCH_RANKS[i].unlock).filter(Boolean)
  };
}

// The courtroom as it is dressed at a rank: the best unlock in each slot.
export function dressFor(rank) {
  const dress = { gavel: 'oak', plate: '', bench: '', banner: '', wig: 'plain', audience: '', spotlight: false };
  BENCH_RANKS.forEach((r, i) => {
    if (i > rank || !r.unlock) return;
    dress[r.unlock.slot] = r.unlock.style;
    if (r.unlock.style === 'laurel') dress.spotlight = true;
  });
  return dress;
}

export function careerView(c) {
  const stars = careerStars(c), rank = rankIndexFor(stars), here = BENCH_RANKS[rank], next = BENCH_RANKS[rank + 1] || null;
  const span = next ? next.stars - here.stars : 1;
  const nextUnlock = BENCH_RANKS.slice(rank + 1).find(r => r.unlock)?.unlock || null;
  return {
    stars, rank, name: here.name, blurb: here.blurb, max: rank >= BENCH_MAX,
    next: next ? { name: next.name, stars: next.stars, souls: next.souls, unlock: next.unlock } : null,
    toNext: next ? next.stars - stars : 0,
    progress: next ? Math.max(0, Math.min(1, (stars - here.stars) / span)) : 1,
    nextUnlock, dress: dressFor(rank),
    unlocked: BENCH_RANKS.slice(0, rank + 1).filter(r => r.unlock).map(r => r.unlock)
  };
}
