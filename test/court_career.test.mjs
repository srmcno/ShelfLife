import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { COURT_CASES } from '../src/content/court.js';
import { BENCH_RANKS, BENCH_MAX, BENCH_UNLOCKS } from '../src/content/court-career.js';
import { careerStars, rankIndexFor, benchPromotion, dressFor, careerView } from '../src/engine/court-career.js';
import { castEpisode, episodeRule, courtFinish, COURT_BY_ID } from '../src/engine/court.js';
import { courtroomState, normalizeCourtroom } from '../src/court-state.js';
import { ACHIEVEMENTS, checkAchievements } from '../src/engine/achievements.js';
import { seededRandom } from '../src/engine/arcade.js';
import { DRESS_ART, GALLERY_REGULARS, LAUREL, dressClasses, benchDressing, stageDressing } from '../src/art/court-dress.js';

const NOW = new Date(2026, 8, 25, 14, 0, 0).getTime();
function household(n = 3) {
  const s = blankState();
  s.pets = ['Agnes', 'Mort', 'Pip', 'Dot'].slice(0, n).map((name, i) => ({ id: 'g' + i, name, traits: ['damp'], needs: { food: 50, fuss: 40, clean: 50 }, bond: 2, cared: 0, grudges: 0, born: NOW - 86400000 }));
  s.pets.forEach((p, i) => { s.slots[i] = p.id; });
  return s;
}
// Air a case and force the stars it earns.
function air(s, caseId, stars, now = NOW) {
  const ep = castEpisode(s, { caseId, plaintiffId: 'g0', defendantId: 'g1' }, seededRandom(3));
  episodeRule(ep, COURT_BY_ID[caseId].truth, seededRandom(2));
  ep.stars = stars;
  return courtFinish(s, ep, now);
}

test('ten ranks climb in order and name what they pay and unlock', () => {
  assert.equal(BENCH_RANKS.length, 10);
  assert.equal(BENCH_MAX, 9);
  assert.equal(BENCH_RANKS[0].name, 'Courtroom Sweeper');
  assert.equal(BENCH_RANKS[9].name, 'Lord Chief Gavel');
  assert.equal(new Set(BENCH_RANKS.map(r => r.name)).size, 10);
  BENCH_RANKS.forEach((r, i) => {
    if (i) { assert.ok(r.stars > BENCH_RANKS[i - 1].stars, 'thresholds climb'); assert.ok(r.souls > 0 && r.unlock, 'every promotion pays and unlocks'); }
    else assert.deepEqual([r.stars, r.souls, r.unlock], [0, 0, null]);
    for (const t of [r.name, r.blurb, r.unlock?.name || '', r.unlock?.blurb || '']) assert.ok(!/[–—]/.test(t) && !/["']/.test(t), t);
  });
  assert.equal(BENCH_RANKS.reduce((n, r) => n + r.souls, 0), 580);
  assert.equal(BENCH_UNLOCKS.length, 9);
  assert.equal(new Set(BENCH_UNLOCKS.map(u => u.id)).size, 9);
  assert.ok(BENCH_RANKS.at(-1).stars <= 24 * 3 * 3, 'reachable by one lap of every version at three stars');
  assert.deepEqual([0, 3, 4, 9, 10, 17, 18, 29, 30, 170, 999].map(rankIndexFor), [0, 0, 1, 1, 2, 2, 3, 3, 4, 9, 9]);
});

test('lifetime stars add up, and an older save is credited with the best stars it already has', () => {
  assert.equal(careerStars({ best: {}, stars: 0 }), 0);
  assert.equal(careerStars({ best: { a: 3, b: 2, c: 1 }, stars: 0 }), 6);
  assert.equal(careerStars({ best: { a: 3 }, stars: 40 }), 40);
  assert.equal(careerStars({ best: { a: 'x', b: 2 } }), 2);
  assert.equal(careerStars(null), 0);
  const s = household();
  s.courtroom = normalizeCourtroom({ episodes: 12, justice: 10, best: Object.fromEntries(COURT_CASES.slice(0, 12).map(k => [k.id, 3])) });
  assert.equal(careerStars(courtroomState(s)), 36);
  assert.equal(careerView(courtroomState(s)).name, BENCH_RANKS[4].name, 'thirty-six stars is the fourth rank up');
  // The first airing after the update absorbs that credit once and pays every promotion it missed.
  const before = s.mayhem.souls;
  const res = air(s, COURT_CASES[12].id, 2);
  assert.equal(courtroomState(s).stars, 38, 'the credit is absorbed, then the new stars are added once');
  assert.equal(res.promotion.from, 0); assert.equal(res.promotion.to, 4);
  assert.equal(res.promotion.souls, 15 + 20 + 30 + 40);
  assert.equal(courtroomState(s).rank, 4);
  assert.ok(s.mayhem.souls - before >= 105 + res.souls - 1);
  assert.equal(res.promotion.unlocks.length, 4);
  const again = air(s, COURT_CASES[13].id, 1);
  assert.equal(again.promotion, null, 'a promotion pays once');
  assert.equal(courtroomState(s).stars, 39);
});

test('each promotion pays its souls once, outside the daily purse, and reports what it unlocked', () => {
  const s = household();
  let souls = s.mayhem.souls, purse = s.mayhem.gameSouls;
  const seen = [];
  let stars = 0;
  for (let i = 0; i < 60 && courtroomState(s).rank < BENCH_MAX; i++) {
    const caseId = COURT_CASES[i % COURT_CASES.length].id;
    const res = air(s, caseId, 3, NOW + Math.floor(i / 24) * 86400000);
    stars += 3;
    assert.equal(courtroomState(s).stars, stars);
    if (res.promotion) {
      seen.push(res.promotion);
      const expected = res.promotion.ranks.reduce((n, r) => n + BENCH_RANKS[r].souls, 0);
      assert.equal(res.promotion.souls, expected);
      assert.equal(res.career.rank, res.promotion.to);
    }
  }
  assert.equal(courtroomState(s).rank, BENCH_MAX);
  assert.deepEqual(seen.flatMap(p => p.ranks), [1, 2, 3, 4, 5, 6, 7, 8, 9], 'every promotion happened, in order, once');
  assert.equal(seen.reduce((n, p) => n + p.souls, 0), 580);
  assert.ok(s.mayhem.souls > souls + 580, 'the souls arrived on top of the game purse');
  assert.ok(s.mayhem.gameSouls >= purse);
  assert.equal(air(s, COURT_CASES[0].id, 3).promotion, null, 'nothing above the top');
  assert.equal(careerView(courtroomState(s)).max, true);
  assert.equal(careerView(courtroomState(s)).next, null);
});

test('the career view says where you are, how far to go and what is next', () => {
  const view = stars => careerView({ best: {}, stars });
  const none = view(0);
  assert.deepEqual([none.rank, none.name, none.toNext, none.progress, none.max], [0, 'Courtroom Sweeper', 4, 0, false]);
  assert.equal(none.next.name, 'Gavel Polisher');
  assert.equal(none.nextUnlock.name, 'Brass gavel');
  const mid = view(7);
  assert.deepEqual([mid.rank, mid.toNext, Math.round(mid.progress * 100)], [1, 3, 50]);
  assert.equal(mid.nextUnlock.name, 'Brass nameplate');
  assert.deepEqual(mid.unlocked.map(u => u.id), ['gavel-brass']);
  assert.equal(view(500).progress, 1);
  assert.equal(view(500).nextUnlock, null);
  assert.equal(view(500).unlocked.length, 9);
});

test('what the courtroom wears at each rank: the best unlock in each slot', () => {
  assert.deepEqual(dressFor(0), { gavel: 'oak', plate: '', bench: '', banner: '', wig: 'plain', audience: '', spotlight: false });
  assert.equal(dressFor(1).gavel, 'brass');
  assert.equal(dressFor(2).plate, 'plate');
  assert.equal(dressFor(3).bench, 'drape');
  assert.equal(dressFor(4).banner, 'crest');
  assert.equal(dressFor(5).wig, 'gilt');
  assert.equal(dressFor(6).audience, 'regulars');
  assert.equal(dressFor(7).gavel, 'ebony', 'a later gavel replaces the earlier one');
  assert.equal(dressFor(8).bench, 'velvet');
  assert.deepEqual([dressFor(9).wig, dressFor(9).spotlight], ['laurel', true]);
  assert.equal(dressFor(9).banner, 'crest', 'and nothing is ever taken away');
  assert.equal(dressClasses(dressFor(0)), 'sc-gavel-oak sc-wig-plain');
  assert.match(dressClasses(dressFor(9)), /sc-gavel-ebony.*sc-wig-laurel.*sc-bench-velvet.*sc-has-banner.*sc-has-plate.*sc-has-regulars.*sc-has-spot/);
});

// The dressing is injected as innerHTML, so a malformed string fails silently.
function assertWellFormed(id, markup) {
  const tagRe = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+\s*=\s*"[^"<>]*")*)\s*(\/?)>/g;
  const stack = [];
  let cursor = 0, m;
  while ((m = tagRe.exec(markup)) !== null) {
    assert.equal(m.index, cursor, id + ' has stray or malformed markup at ' + cursor + ': ' + JSON.stringify(markup.slice(cursor, m.index + 24)));
    cursor = tagRe.lastIndex;
    const [, closing, tag, , selfClosing] = m;
    if (closing) assert.equal(stack.pop(), tag, id + ' closes </' + tag + '> out of order');
    else if (!selfClosing) stack.push(tag);
  }
  assert.equal(cursor, markup.length, id + ' has trailing content');
  assert.deepEqual(stack, [], id + ' left tags unclosed');
  for (const [, d] of markup.matchAll(/\sd="([^"]*)"/g)) assert.ok(!/--|NaN|undefined/.test(d), id + ' has a broken path: ' + d.slice(0, 60));
  for (const [, v] of markup.matchAll(/\s(?:cx|cy|rx|ry|r|x|y|width|height|transform)="([^"]*)"/g)) assert.ok(!/NaN|undefined|Infinity/.test(v), id + ' has a bad number: ' + v);
}

test('every piece of dressing is well-formed SVG, and the whole wardrobe can be put on the stage', () => {
  for (const [id, art] of Object.entries(DRESS_ART)) { assert.ok(art.startsWith('<svg ') && art.endsWith('</svg>'), id); assertWellFormed('DRESS_ART.' + id, art); }
  GALLERY_REGULARS.forEach((art, i) => assertWellFormed('regular ' + i, art));
  assertWellFormed('LAUREL', '<svg>' + LAUREL + '</svg>');
  assert.ok(LAUREL.includes('class="sc-laurel"') && (LAUREL.match(/<ellipse/g) || []).length >= 16);
  const full = dressFor(9);
  for (const [id, html] of Object.entries({ bench: benchDressing(full), stage: stageDressing(full) })) assertWellFormed(id, '<div>' + html + '</div>');
  assert.equal(benchDressing(dressFor(0)), ''); assert.equal(stageDressing(dressFor(0)), '');
  assert.match(stageDressing(dressFor(8)), /sc-candle l.*sc-candle r/);
  assert.doesNotMatch(stageDressing(dressFor(8)), /sc-spot/);
  assert.match(stageDressing(full), /sc-spot/);
});

test('flawless runs: three stars in a row builds the streak and anything less ends it', () => {
  const s = household();
  air(s, COURT_CASES[0].id, 3); air(s, COURT_CASES[1].id, 3); air(s, COURT_CASES[2].id, 3);
  assert.deepEqual([courtroomState(s).flawless, courtroomState(s).flawlessBest], [3, 3]);
  air(s, COURT_CASES[3].id, 2);
  assert.deepEqual([courtroomState(s).flawless, courtroomState(s).flawlessBest], [0, 3]);
  air(s, COURT_CASES[4].id, 3);
  assert.deepEqual([courtroomState(s).flawless, courtroomState(s).flawlessBest], [1, 3]);
  const back = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual([back.courtroom.flawless, back.courtroom.flawlessBest, back.courtroom.stars, back.courtroom.rank], [1, 3, 14, 2]);
  assert.deepEqual(normalizeCourtroom({ flawless: 5, flawlessBest: 2, rank: 99, stars: -3 }), { ...normalizeCourtroom(null), flawless: 5, flawlessBest: 5, rank: BENCH_MAX });
});

test('a promotion in the record is a thing the achievements can see', () => {
  const ids = ACHIEVEMENTS.map(a => a.id);
  assert.equal(new Set(ids).size, ids.length);
  const court = ACHIEVEMENTS.filter(a => a.id.startsWith('bench-') || a.id.startsWith('court-') || a.id.startsWith('twist'));
  assert.ok(court.length >= 8, 'the court has its own incidents');
  for (const a of court) {
    for (const key of ['label', 'desc', 'hint', 'toastLine']) { assert.equal(typeof a[key], 'string'); assert.ok(!/[–—]/.test(a[key]) && !/["']/.test(a[key]), a.id + ' ' + key); }
    assert.equal(a.check(blankState()), false, a.id + ' is not given away to an empty shelf');
  }
  const by = id => ACHIEVEMENTS.find(a => a.id === id);
  const s = household();
  assert.equal(by('bench-5').check(s), false);
  s.courtroom = normalizeCourtroom({ stars: 45 });
  assert.equal(by('bench-5').check(s), true);
  assert.equal(by('bench-10').check(s), false);
  s.courtroom = normalizeCourtroom({ stars: 170 });
  assert.equal(by('bench-10').check(s), true);
  s.courtroom = normalizeCourtroom({ flawlessBest: 3 });
  assert.equal(by('court-streak-3').check(s), true);
  assert.equal(by('court-streak-5').check(s), false);
  s.courtroom = normalizeCourtroom({ best: { 'borrowed-coffin': 3, 'snoring-wall': 3, 'stolen-slot': 3 } });
  assert.equal(by('bench-5').check(s), false, 'nine stars are not enough');
  assert.ok(checkAchievements(household()) !== null);
});
