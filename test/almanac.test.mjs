import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState, localDayKey } from '../src/state.js';
import { CHAPTERS, TRACK, TIERS, XP_RULES, DAILY_XP_CAP, WEEKLY_POOL, WEEKLY_FAMILIES, ALMANAC_CURIOS, EDITION_RARITY, TRACK_XP_PER_DAY, WEEKLY_SOULS, CHEST_SOULS } from '../src/content/almanac.js';
import { WALLS, ROOMS, WOODS, NEW_DECOR } from '../src/content/decor.js';
import { GLYPH_NAMES } from '../src/art/mayhem-glyphs.js';
import { CURIO_FORMS } from '../src/art/almanac-art.js';
import { blankAlmanac, normalizeAlmanac } from '../src/almanac-state.js';
import { COURT_CASES } from '../src/content/court.js';
import {
  chapterAt, nextChapter, daysLeft, tierCosts, tierThresholds, tierFor, chapterView, syncAlmanac, claimTier, claimReady, readyCount,
  weeklyChallenges, weeklyView, claimWeekly, claimChest, weekNumber, backIssues, buyBackIssue, grantXp, isClaimed, decorKeys, chapterHook
} from '../src/engine/almanac.js';
import { addSouls, resolveEmergency, openCoffin, drawOmen, accrueMayhem, CURIO_BY_ID, RARITY_BY_ID } from '../src/engine/mayhem.js';
import { careFor } from '../src/engine/care.js';
import { COURT_BY_ID } from '../src/engine/court.js';
import { finishRun } from '../src/engine/arcade.js';

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
const DAY = 86400000;
const NOW = at(2026, 10, 5);   // a Monday, in the first chapter
function household(count = 3, when = NOW) {
  const s = blankState();
  s.started = when - 5 * DAY; s.lastTick = when;
  s.pets = Array.from({ length: count }, (_, i) => ({ id: 'a' + i, name: ['Agnes', 'Pip', 'Oswald', 'Gnasher'][i], traits: ['damp'], needs: { food: 20, fuss: 20, clean: 20 }, bond: 3, cared: 0, grudges: 0, born: when - 5 * DAY, stats: { cute: 5, menace: 5, damp: 5, mystique: 5 } }));
  s.pets.forEach((p, i) => { s.slots[i] = p.id; });
  return s;
}
const NODASH = /[\u2013\u2014]/;

test('the calendar covers October 2026 to December 2027 without a gap or an overlap', () => {
  assert.equal(CHAPTERS.length, 15);
  assert.equal(CHAPTERS[0].from, '2026-10-01');
  assert.equal(CHAPTERS.at(-1).to, '2027-12-31');
  for (let i = 1; i < CHAPTERS.length; i++) {
    const prev = new Date(CHAPTERS[i - 1].to + 'T12:00:00Z').getTime() + DAY;
    assert.equal(new Date(CHAPTERS[i].from + 'T12:00:00Z').getTime(), prev, CHAPTERS[i].id + ' starts the day after ' + CHAPTERS[i - 1].id);
  }
  CHAPTERS.forEach((c, i) => assert.equal(c.no, i + 1));
  // Every day from 1 October 2026 to 31 December 2027 has exactly one chapter.
  for (let t = at(2026, 10, 1); t <= at(2027, 12, 31); t += DAY) assert.ok(chapterAt(t), localDayKey(t));
});

test('every chapter is well formed: four curios, a room set, a title and a badge', () => {
  const ids = new Set(), pairs = new Set();
  for (const c of CHAPTERS) {
    assert.equal(c.curios.length, 4, c.id);
    assert.ok(c.name && c.blurb && c.title && c.badge && c.month, c.id);
    for (const hex of Object.values(c.colors)) assert.match(hex, /^#[0-9A-Fa-f]{6}$/);
    assert.ok(c.hooks.length >= 2 && (!c.flagship || c.hooks.length >= 8), c.id + ' hooks');
    assert.ok(c.spotlight.length >= 1 && c.spotlight.every(id => COURT_CASES.some(k => k.id === id)), c.id + ' spotlight');
    assert.ok(WALLS[c.decor.wall], c.id + ' wall');
    assert.ok(ROOMS[c.decor.room.id] && WOODS[c.decor.wood.id], c.id + ' room and wood');
    for (const k of c.curios) {
      assert.ok(!ids.has(k.id), 'duplicate curio ' + k.id); ids.add(k.id);
      assert.ok(CURIO_FORMS.includes(k.form), k.id + ' form ' + k.form);
      const [kind, name] = k.mark.split(':');
      if (kind === 'g') assert.ok(GLYPH_NAMES.includes(name), k.id + ' glyph ' + name);
      else assert.equal(kind, 'c');
      const pair = k.form + '|' + k.mark;
      assert.ok(!pairs.has(pair), 'two curios look the same: ' + pair); pairs.add(pair);
      assert.ok(k.name.length <= 40 && k.text.length <= 200 && k.text.length >= 40, k.id + ' text length ' + k.text.length);
    }
  }
  assert.equal(ALMANAC_CURIOS.length, 60);
  assert.ok(CHAPTERS.filter(c => c.flagship).length === 2 && CHAPTERS[0].flagship && CHAPTERS[12].flagship, 'two Halloween flagships');
  for (const c of CHAPTERS.filter(c => c.flagship)) assert.equal(c.season, 'thin-season');
});

test('no dash of any kind appears anywhere a player can read, and quotes are curly', () => {
  const text = JSON.stringify([CHAPTERS, TRACK, WEEKLY_POOL]);
  assert.ok(!NODASH.test(text), 'no em or en dashes');
  for (const c of CHAPTERS) for (const s of [c.blurb, c.title, c.badge, ...c.hooks, ...c.curios.flatMap(k => [k.name, k.text])]) {
    assert.ok(!/'/.test(s), 'straight apostrophe in: ' + s);
    assert.ok(!/ - /.test(s), 'spaced hyphen in: ' + s);
  }
});

test('the track pays what the brief says: souls, four curios, a room set, a title and a badge', () => {
  assert.equal(TRACK.length, TIERS);
  TRACK.forEach((t, i) => assert.equal(t.tier, i + 1));
  assert.deepEqual(TRACK.filter(t => t.kind === 'curio').map(t => t.index), [0, 1, 2, 3]);
  assert.equal(TRACK.filter(t => t.kind === 'decor').length, 1);
  assert.equal(TRACK.filter(t => t.kind === 'title').length, 1);
  assert.equal(TRACK.at(-1).kind, 'badge');
  for (const t of TRACK) if (t.kind === 'souls') assert.ok(t.amount >= 25 && t.amount <= 90);
  const souls = TRACK.reduce((n, t) => n + (t.amount || 0), 0);
  assert.ok(souls > 1000 && souls < 1800, 'a full track pays ' + souls + ' souls');
});

test('tier costs add up to the chapter’s XP and the long months cost more than the short ones', () => {
  for (const days of [28, 31, 33]) {
    const costs = tierCosts(days);
    assert.equal(costs.length, TIERS);
    assert.equal(costs.reduce((a, b) => a + b, 0), Math.round(days * TRACK_XP_PER_DAY));
    assert.ok(costs.every(c => c > 0) && costs.at(-1) >= costs[0], 'later tiers are no cheaper');
  }
  assert.ok(tierThresholds(31).at(-1) > tierThresholds(28).at(-1));
  assert.equal(tierFor(0, 31), 0);
  assert.equal(tierFor(tierThresholds(31)[4], 31), 5);
  assert.equal(tierFor(1e6, 31), TIERS);
});

test('the calendar encores after the last chapter, so there is always a chapter to be in', () => {
  assert.equal(chapterAt(at(2026, 9, 30)), null, 'the Almanac begins on 1 October 2026');
  assert.equal(nextChapter(at(2026, 9, 30)).id, 'thin-2026');
  assert.equal(chapterAt(at(2026, 11, 2)).id, 'thin-2026');
  assert.equal(chapterAt(at(2026, 11, 3)).id, 'fog-2026');
  assert.equal(daysLeft(chapterAt(at(2026, 10, 5)), at(2026, 10, 5)), 29);
  const jan = chapterAt(at(2028, 1, 10));
  assert.equal(jan.id, 'resolve-2027'); assert.equal(jan.encore, true); assert.equal(jan.key, 'resolve-2027~2028');
  assert.equal(chapterAt(at(2028, 2, 29)).id, 'valentine-2027', 'leap day');
  assert.equal(chapterAt(at(2028, 10, 20)).id, 'thin-2027');
  assert.equal(chapterAt(at(2031, 7, 4)).id, 'dogdays-2027');
  for (let t = at(2028, 1, 1); t <= at(2030, 12, 31); t += 3 * DAY) assert.ok(chapterAt(t), localDayKey(t));
});

test('a household from before the Almanac starts level: no windfall for the past', () => {
  const s = household();
  s.mayhem.resolved = 40; s.mayhem.coffins = 12; s.pets[0].careLog = { food: 30, fuss: 20, clean: 10 };
  delete s.almanac;
  const back = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(back.almanac.init, 0);
  assert.deepEqual(syncAlmanac(back, NOW), []);
  assert.equal(back.almanac.init, 1);
  assert.equal(chapterView(back, NOW).xp, 0, 'forty emergencies in the past are worth nothing');
  assert.equal(back.almanac.seen.resolved, 40);
  back.mayhem.resolved = 41;
  syncAlmanac(back, NOW + 1000);
  assert.equal(chapterView(back, NOW).xp, XP_RULES.emergency.per);
});

test('XP follows the things the game already counts, and each source has a daily cap', () => {
  const s = household();
  syncAlmanac(s, NOW);
  s.mayhem.resolved = 3; s.mayhem.coffins = 2;
  const events = syncAlmanac(s, NOW);
  const xp = events.find(e => e.type === 'xp').amount;
  assert.equal(xp, 3 * XP_RULES.emergency.per + 2 * XP_RULES.coffin.per);
  // Twenty more emergencies the same day pay only up to the source cap.
  s.mayhem.resolved = 23;
  syncAlmanac(s, NOW);
  assert.equal(s.almanac.by.emergency, XP_RULES.emergency.cap);
  assert.equal(chapterView(s, NOW).xp, XP_RULES.emergency.cap + 2 * XP_RULES.coffin.per);
  // The next day pays again.
  s.mayhem.resolved = 26;
  syncAlmanac(s, NOW + DAY);
  assert.equal(s.almanac.by.emergency, 3 * XP_RULES.emergency.per);
});

test('the whole day is capped too, whatever mix of things is done', () => {
  const s = household();
  syncAlmanac(s, NOW);
  s.mayhem.resolved = 99; s.mayhem.coffins = 99; s.courtroom.episodes = 99; s.pets.forEach(p => { p.arcadeRuns = 99; }); s.life.outings = 99;
  s.pets[0].careLog = { food: 90, fuss: 90, clean: 90 };
  s.mayhem.omen = { day: localDayKey(NOW), id: 'wet-hand', streak: 1, lastDay: localDayKey(NOW), grace: 1 };
  s.mayhem.chores = { day: localDayKey(NOW), list: [{ id: 'feed', have: 3, done: true }, { id: 'fuss', have: 3, done: true }, { id: 'wash', have: 2, done: true }], bonus: true };
  s.courtroom.docketDay = localDayKey(NOW); s.arcade.dailyLastDay = localDayKey(NOW);
  syncAlmanac(s, NOW);
  assert.equal(s.almanac.xp, DAILY_XP_CAP);
  assert.equal(chapterView(s, NOW).xp, DAILY_XP_CAP);
  assert.ok(Object.entries(XP_RULES).reduce((n, [, r]) => n + r.cap, 0) > DAILY_XP_CAP, 'the sources could sum past the cap, so the cap is what holds');
});

test('winding the clock back does not refill the day, and a count that falls pays nothing', () => {
  const s = household();
  syncAlmanac(s, NOW);
  s.mayhem.resolved = 5;
  syncAlmanac(s, NOW);
  const spent = s.almanac.by.emergency;
  assert.equal(spent, 5 * XP_RULES.emergency.per);
  // Yesterday’s date on the device: the ledger is still today’s, so nothing is refilled.
  s.mayhem.resolved = 12;
  syncAlmanac(s, NOW - 2 * DAY);
  assert.equal(s.almanac.by.emergency, XP_RULES.emergency.cap, 'the cap held');
  assert.equal(s.almanac.day, localDayKey(NOW), 'the day did not move backwards');
  // A restore that lowers a counter re-bases it rather than paying or going negative.
  const xp = chapterView(s, NOW).xp;
  s.mayhem.resolved = 2;
  syncAlmanac(s, NOW);
  assert.equal(chapterView(s, NOW).xp, xp, 'a fall pays nothing');
  s.mayhem.resolved = 3;
  syncAlmanac(s, NOW + DAY);
  assert.equal(s.almanac.by.emergency, XP_RULES.emergency.per, 'one more emergency, a fresh day');
});

test('real play pays real XP: care, an emergency, a coffin and the omen, through the actual functions', () => {
  const s = household();
  syncAlmanac(s, NOW);
  accrueMayhem(s, NOW, () => 0);
  careFor(s, s.pets[0], 'food', NOW);
  drawOmen(s, NOW, () => 0.5);
  const uid = s.mayhem.queue[0].uid;
  resolveEmergency(s, uid, 0, NOW, () => 0.5);
  addSouls(s, 200);
  openCoffin(s, NOW, () => 0.5);
  const events = syncAlmanac(s, NOW);
  const by = s.almanac.by;
  assert.ok(by.care >= 1 && by.emergency === XP_RULES.emergency.per && by.coffin === XP_RULES.coffin.per && by.omen === XP_RULES.omen.per, JSON.stringify(by));
  assert.ok(events.some(e => e.type === 'xp'));
  // No pets, no XP.
  const empty = blankState();
  assert.deepEqual(syncAlmanac(empty, NOW), []);
});

test('claiming a tier pays once and only once it is reached', () => {
  const s = household();
  syncAlmanac(s, NOW);
  const chapter = chapterAt(NOW);
  assert.equal(claimTier(s, chapter, 1, NOW), null, 'not reached yet');
  grantXp(s, 5000, NOW);
  const souls = s.mayhem.souls;
  const first = claimTier(s, chapter, 1, NOW);
  assert.equal(first.souls, 25); assert.equal(s.mayhem.souls, souls + 25);
  assert.equal(claimTier(s, chapter, 1, NOW), null, 'claimed once');
  assert.ok(isClaimed(s.almanac.chapters[chapter.key], 1));
  assert.equal(readyCount(s, NOW), TIERS - 1);
  const rest = claimReady(s, NOW);
  assert.equal(rest.length, TIERS - 1);
  assert.equal(readyCount(s, NOW), 0);
  assert.equal(s.almanac.stats.tiers, TIERS);
  assert.equal(s.almanac.stats.badges, 1);
  assert.equal(s.almanac.chapters[chapter.key].badge, 1);
  // The four curios, the room set and the title all arrived.
  for (const k of chapter.curios) assert.equal(s.mayhem.curios[k.id], 1);
  for (const key of decorKeys(chapter)) assert.ok(s.decor.owned.includes(key) || !NEW_DECOR[key], key);
  assert.ok(s.exchange.titles.includes('ch:' + chapter.id));
  const total = TRACK.reduce((n, t) => n + (t.amount || 0), 0);
  assert.equal(s.mayhem.souls, souls + total);
  const back = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.almanac.chapters[chapter.key], s.almanac.chapters[chapter.key]);
  for (const k of chapter.curios) assert.equal(back.mayhem.curios[k.id], 1, 'chapter curios survive a reload');
});

test('chapter curios are real curios: known to the cabinet, never dropped by coffins, never ordered', () => {
  for (const c of ALMANAC_CURIOS) { assert.equal(CURIO_BY_ID[c.id].id, c.id); assert.equal(c.rarity, 'edition'); }
  assert.equal(RARITY_BY_ID.edition, EDITION_RARITY);
  const s = household();
  addSouls(s, 5000);
  for (let i = 0; i < 60; i++) { const r = openCoffin(s, at(2026, 9, 1), () => (i % 10) / 10); assert.ok(!ALMANAC_CURIOS.some(c => c.id === r.curio.id)); }
});

test('an encore pays souls for what you already have, so a claim is never empty', () => {
  const s = household(3, at(2028, 1, 10));
  const when = at(2028, 1, 10);
  syncAlmanac(s, when);
  const chapter = chapterAt(when);
  s.mayhem.curios[chapter.curios[0].id] = 1;
  grantXp(s, 5000, when);
  const before = s.mayhem.souls;
  const r = claimTier(s, chapter, 5, when);
  assert.equal(r.duplicate, true);
  assert.equal(r.souls, EDITION_RARITY.refund);
  assert.equal(s.mayhem.souls, before + EDITION_RARITY.refund);
});

test('weekly challenges are the same for everyone on a week, come from three families and rotate', () => {
  const seen = new Set();
  for (let wk = 2900; wk < 2960; wk++) {
    const list = weeklyChallenges(wk);
    assert.equal(list.length, 3);
    assert.deepEqual(list.map(c => c.id), weeklyChallenges(wk).map(c => c.id));
    const families = list.map(c => WEEKLY_FAMILIES.findIndex(f => f.includes(c.kind)));
    assert.equal(new Set(families).size, 3, 'three different families');
    list.forEach(c => seen.add(c.id));
  }
  assert.ok(seen.size >= 16, 'rotation uses most of the pool: ' + seen.size);
  assert.equal(weekNumber(at(2026, 10, 5)), weekNumber(at(2026, 10, 11)), 'Monday to Sunday is one week');
  assert.equal(weekNumber(at(2026, 10, 11)) + 1, weekNumber(at(2026, 10, 12)));
});

test('finishing three weekly challenges opens a chest; unclaimed prizes are paid when the week turns', () => {
  const s = household();
  syncAlmanac(s, NOW);
  const wk = weekNumber(NOW), list = weeklyChallenges(wk);
  const bump = {
    emergency: () => { s.mayhem.resolved += 30; }, coffin: () => { s.mayhem.coffins += 10; }, care: () => { s.pets[0].careLog = { food: 100, fuss: 100, clean: 100 }; },
    chore: () => {}, omen: () => {}, court: () => { s.courtroom.episodes += 9; }, arcade: () => { s.pets.forEach(p => { p.arcadeRuns = 50; }); }, daily: () => {}, docket: () => {},
    expedition: () => { s.life.outings += 5; }, curio: () => { for (let i = 0; i < 9; i++) s.mayhem.curios['fake' + i] = 1; }
  };
  // Kinds that depend on daily flags are driven across several days.
  for (let d = 0; d < 6; d++) {
    const t = NOW + d * DAY;
    if (weekNumber(t) !== wk) break;
    for (const c of list) bump[c.kind]();
    if (list.some(c => ['omen', 'chore', 'daily', 'docket'].includes(c.kind))) {
      s.mayhem.omen = { day: localDayKey(t), id: 'wet-hand', streak: d + 1, lastDay: localDayKey(t), grace: 1 };
      s.mayhem.chores = { day: localDayKey(t), list: [{ id: 'feed', have: 3, done: true }, { id: 'fuss', have: 3, done: true }, { id: 'wash', have: 2, done: true }], bonus: false };
      s.courtroom.docketDay = localDayKey(t); s.arcade.dailyLastDay = localDayKey(t);
    }
    syncAlmanac(s, t);
  }
  const view = weeklyView(s, NOW);
  assert.ok(view.items.every(c => c.done), JSON.stringify(view.items.map(c => [c.id, c.have, c.need])));
  assert.equal(view.chest.ready, true);
  const souls = s.mayhem.souls;
  const one = claimWeekly(s, list[0].id, NOW);
  assert.equal(one.souls, WEEKLY_SOULS);
  assert.equal(claimWeekly(s, list[0].id, NOW), null, 'once');
  assert.equal(claimWeekly(s, 'not-a-challenge', NOW), null);
  const chest = claimChest(s, NOW, () => 0.5);
  assert.equal(chest.souls, CHEST_SOULS); assert.ok(chest.curio.curio);
  assert.equal(claimChest(s, NOW), null, 'once');
  assert.ok(s.mayhem.souls >= souls + WEEKLY_SOULS + CHEST_SOULS);
  assert.equal(s.almanac.stats.chests, 1);
  // Two challenges left unclaimed are paid when the week turns, and nothing is lost.
  const pending = list.slice(1).filter(c => !s.almanac.week.claimed.includes(c.id)).length;
  assert.equal(pending, 2);
  const before = s.mayhem.souls;
  const next = syncAlmanac(s, NOW + 7 * DAY);
  assert.ok(next.some(e => e.type === 'settled'));
  assert.equal(s.mayhem.souls - before >= 2 * WEEKLY_SOULS, true);
  assert.ok(s.almanac.settled.text.length > 10);
  assert.deepEqual(s.almanac.week.done, [], 'a fresh week');
});

test('Back Issues sell only what has finished, at a price that is a sink, with one weekly mark-down', () => {
  const s = household();
  const early = at(2026, 10, 20);
  assert.deepEqual(backIssues(s, early).curios, [], 'nothing has finished yet');
  const later = at(2027, 1, 15);
  const list = backIssues(s, later);
  assert.equal(list.curios.length, 4 * 3, 'the three finished chapters');
  assert.ok(list.curios.every(c => ['thin-2026', 'fog-2026', 'night-2026'].includes(c.chapter)));
  assert.ok(!list.curios.some(c => c.chapter === 'resolve-2027'), 'the running chapter is not for sale');
  const base = list.curios.filter(c => !c.bargain);
  assert.ok(base.every(c => c.cost === 450));
  assert.equal(list.curios.filter(c => c.bargain).length, 1);
  assert.equal(list.bargain.cost, 270);
  assert.equal(backIssues(s, later).bargain.id, list.bargain.id, 'the same all week');
  assert.equal(buyBackIssue(s, base[0].id, later), null, 'no souls, no sale');
  addSouls(s, 3000);
  const souls = s.mayhem.souls;
  const bought = buyBackIssue(s, base[0].id, later);
  assert.equal(bought.cost, 450);
  assert.equal(s.mayhem.souls, souls - 450);
  assert.equal(s.mayhem.curios[base[0].id], 1);
  assert.equal(buyBackIssue(s, base[0].id, later), null, 'you cannot buy what you own');
  assert.equal(backIssues(s, later).curios.length, 11);
  const decor = backIssues(s, later).decor;
  assert.equal(decor.length, 3);
  const set = buyBackIssue(s, decor[0].id, later);
  assert.equal(set.cost, 1200);
  assert.ok(decorKeys(CHAPTERS[0]).every(k => !NEW_DECOR[k] || s.decor.owned.includes(k)));
  assert.equal(backIssues(s, later).decor.length, 2);
  assert.equal(s.almanac.stats.bought, 2);
});

test('the Court spotlight pays once per case per chapter, outside the daily cap', () => {
  const s = household();
  syncAlmanac(s, NOW);
  const chapter = chapterAt(NOW);
  s.mayhem.resolved = 99; // spend the day’s cap on something else first
  for (const id of ['fake-seance', 'haunted-sock']) {
    s.courtroom.episodes += 1; s.courtroom.last = id;
    const events = syncAlmanac(s, NOW);
    assert.ok(events.some(e => e.type === 'spotlight' && e.caseId === id), id);
  }
  s.courtroom.episodes += 1; s.courtroom.last = 'fake-seance';
  assert.ok(!syncAlmanac(s, NOW).some(e => e.type === 'spotlight'), 'paid once');
  s.courtroom.episodes += 1; s.courtroom.last = 'tontine';
  assert.ok(!syncAlmanac(s, NOW).some(e => e.type === 'spotlight'), 'a case that is not the spotlight');
  assert.ok(chapter.spotlight.every(id => COURT_BY_ID[id]));
});

test('flavour hooks: flagship chapters always have one, others on every other emergency', () => {
  const flagship = chapterAt(NOW), plain = chapterAt(at(2027, 3, 10));
  for (let i = 0; i < 8; i++) assert.ok(chapterHook(flagship, i, 'Agnes', 'Pip').length > 10);
  const lines = [0, 1, 2, 3].map(i => chapterHook(plain, i, 'Agnes'));
  assert.equal(lines.filter(Boolean).length, 2);
  assert.ok(!lines.join('').includes('{a}'));
  assert.equal(chapterHook(null, 1), '');
});

test('the Almanac state is bounded, idempotent and survives hostile input', () => {
  const blank = blankAlmanac();
  assert.deepEqual(normalizeAlmanac(blank), blank);
  const odd = normalizeAlmanac({
    init: 1, seen: { care: -5, resolved: 'x', coffins: 1e99 }, day: 'nonsense', xp: 99999, by: { care: 5, bogus: 7, __proto__: { x: 1 } },
    chapters: { 'thin-2026': { xp: 1e99, claimed: -1, badge: 7, spot: 99 }, '../bad': { xp: 1 }, 'ok~2028': 'x' },
    week: { no: 'a', counts: { care: 5, nope: 9 }, done: ['care-18', 'nope', 'care-18'], claimed: 7, chest: 5 },
    settled: { text: 7 }, stats: { tiers: -1, badges: 'x' }
  });
  assert.equal(odd.seen.care, 0); assert.equal(odd.seen.resolved, 0); assert.ok(odd.seen.coffins <= 1e9);
  assert.equal(odd.day, ''); assert.ok(odd.xp <= 1000);
  assert.deepEqual(Object.keys(odd.by), ['care']);
  assert.deepEqual(Object.keys(odd.chapters), ['thin-2026']);
  assert.ok(odd.chapters['thin-2026'].claimed >= 0 && odd.chapters['thin-2026'].badge === 0);
  assert.deepEqual(odd.week.done, ['care-18']); assert.deepEqual(odd.week.claimed, []); assert.equal(odd.week.chest, 0);
  assert.equal(odd.settled, null);
  assert.deepEqual(normalizeAlmanac(odd), odd, 'idempotent');
  assert.equal(normalizeAlmanac(undefined).init, 0, 'an older save is re-based on first sync');
  assert.ok(JSON.stringify(blankAlmanac()).length < 400, 'a blank Almanac is tiny');
});

test('a save with sixty old chapter records still records the new one, whatever the keys sort like', () => {
  const s = household();
  const key = chapterAt(NOW).key;
  s.almanac.chapters = {};
  for (let i = 0; i < 60; i++) s.almanac.chapters['zz-old-' + String(i).padStart(2, '0')] = { xp: 1, claimed: 0, badge: 0, spot: 0 };
  assert.ok(key < 'zz', 'the live key sorts before every old one, the case that used to delete it');
  assert.doesNotThrow(() => grantXp(s, 10, NOW));
  assert.ok(s.almanac.chapters[key] && s.almanac.chapters[key].xp > 0, 'the new record is kept');
  assert.equal(Object.keys(s.almanac.chapters).length, 60, 'and the oldest one made room');
  assert.ok(!('zz-old-00' in s.almanac.chapters));
});

test('reload keeps the newest sixty chapters and the active encore with its claims', () => {
  const raw = blankAlmanac(), keys = [];
  for (let y = 2026; y <= 2032; y++) for (let m = 1; m <= (y === 2032 ? 5 : 12); m++) {
    const chapter = chapterAt(at(y, m, 15));
    if (!chapter) continue;
    keys.push(chapter.key);
    raw.chapters[chapter.key] = { xp: keys.length * 100, claimed: 31, badge: 0, spot: 2 };
  }
  const now = at(2032, 5, 15), active = chapterAt(now).key;
  assert.ok(keys.length > 60);
  const loaded = normalizeAlmanac(JSON.parse(JSON.stringify(raw)), now);
  assert.deepEqual(Object.keys(loaded.chapters), keys.slice(-60));
  assert.deepEqual(loaded.chapters[active], raw.chapters[active]);
  assert.deepEqual(normalizeAlmanac(JSON.parse(JSON.stringify(loaded)), now), loaded);
});

test('reload explicitly protects the active chapter even when it was inserted first', () => {
  for (const now of [at(2026, 11, 1), at(2032, 2, 29), at(2032, 11, 1)]) {
    const raw = blankAlmanac(), active = chapterAt(now).key;
    raw.chapters[active] = { xp: 1234, claimed: 31, badge: 0, spot: 2 };
    for (let i = 0; i < 60; i++) raw.chapters['zz-old-' + i] = { xp: 1 };
    const loaded = normalizeAlmanac(raw, now);
    assert.equal(Object.keys(loaded.chapters).length, 60);
    assert.deepEqual(loaded.chapters[active], raw.chapters[active]);
    assert.ok(!('zz-old-0' in loaded.chapters));
  }
});

test('the weekly Back Issues markdown stays on one curio: buying it does not move it to another', () => {
  const s = household();
  addSouls(s, 5000);
  const later = at(2027, 1, 15);
  const list = backIssues(s, later);
  assert.ok(list.bargain, 'there is a bargain this week');
  const id = list.bargain.id;
  assert.ok(buyBackIssue(s, id, later), 'it can be bought');
  const after = backIssues(s, later);
  assert.equal(after.bargain, null, 'once it is owned the week has no markdown left');
  assert.equal(after.curios.filter(c => c.bargain).length, 0);
  assert.ok(after.curios.every(c => c.cost === 450), 'every other curio stays at full price');
  const next = backIssues(s, later + 7 * DAY);
  assert.ok(next.bargain === null || next.bargain.id !== id, 'a new week picks again');
});

test('a zero-score arcade run is a warm-up: it earns no Almanac XP and no weekly progress, a scoring run does', () => {
  const s = household();
  syncAlmanac(s, NOW);
  const chapter = chapterAt(NOW), xp = () => (s.almanac.chapters[chapter.key]?.xp || 0), arcadeWeek = () => s.almanac.week.counts.arcade || 0;
  for (let i = 0; i < 5; i++) finishRun(s, 'frenzy', 0, s.pets[0].id, NOW + (i + 1) * 61000, () => 0.5);
  syncAlmanac(s, NOW + 6 * 61000);
  assert.equal(xp(), 0, 'five warm-ups paid nothing');
  assert.equal(arcadeWeek(), 0, 'and counted for no weekly challenge');
  finishRun(s, 'frenzy', 25, s.pets[0].id, NOW + 7 * 61000, () => 0.5);
  syncAlmanac(s, NOW + 8 * 61000);
  assert.ok(xp() > 0, 'a run that scored pays');
  assert.equal(arcadeWeek(), 1);
});
