import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { CURIOS, RANKS } from '../src/content/mayhem.js';
import { SEASONAL_CURIOS } from '../src/content/seasons.js';
import { RELICS } from '../src/content/life.js';
import { VISITORS } from '../src/content/stories.js';
import { LEGACY_RANKS, LEGACY_LEVELS, legacyAt, LEGACY_START } from '../src/content/legacy.js';
import { SETS, SET_BY_ID, CABINET_FRAMES, PORTRAIT_FRAMES, COMMISSIONS, EXCHANGE_DECOR, TITLE_IDS, titleText, CURIO_SET } from '../src/content/collections.js';
import { CHAPTERS, ALMANAC_CURIOS } from '../src/content/almanac.js';
import { FREE_DECOR, NEW_DECOR, ROOMS, WOODS, WALLS, ACCENTS } from '../src/content/decor.js';
import { OUTINGS } from '../src/content/life.js';
import {
  setProgress, allSets, completedSetCount, claimSet, claimableSets, buyFrame, equipFrame, activeFrame, buyPortraitFrame, equipPortraitFrame,
  portraitFor, buyDecor, decorOwned, placeCommission, exchangeCatalog, titlesOwned, equipTitle, activeTitle, canAfford
} from '../src/engine/collections.js';
import { legacyInfo, legacyLevel, tokenBalance, spendTokens, legacyTitleIds } from '../src/engine/legacy.js';
import { normalizeOwned, normalizeExchange, normalizeCollections, normalizeLegacy, legacyReached, FREE_DECOR_KEYS, normalizeNudgeCats } from '../src/almanac-state.js';
import { addSouls, rankIndexFor, rankInfo } from '../src/engine/mayhem.js';
import { checkAchievements, ACHIEVEMENTS, INCIDENT_GROUPS } from '../src/engine/achievements.js';
import { normalizeMayhem } from '../src/mayhem-state.js';
import { readShelf } from '../src/cloud/social.js';

const NODASH = /[\u2013\u2014]/;
function household() {
  const s = blankState();
  s.pets = [{ id: 'c0', name: 'Agnes', traits: [], needs: { food: 50, fuss: 50, clean: 50 }, bond: 3, cared: 0, grudges: 0 }, { id: 'c1', name: 'Pip', traits: [], needs: { food: 50, fuss: 50, clean: 50 }, bond: 3, cared: 0, grudges: 0 }];
  s.slots[0] = 'c0'; s.slots[1] = 'c1';
  return s;
}
const own = (s, ...ids) => ids.forEach(id => { s.mayhem.curios[id] = 1; });

test('every curio belongs to exactly one set, and every set has four to six pieces', () => {
  const seen = new Map();
  for (const set of SETS) {
    assert.ok(set.members.length >= 4 && set.members.length <= 6, set.id + ' has ' + set.members.length);
    for (const m of set.members) if (m.startsWith('c:')) { assert.ok(!seen.has(m), 'a curio in two sets: ' + m); seen.set(m, set.id); }
    assert.ok(set.souls >= 100 && set.name && set.blurb, set.id);
  }
  for (const c of [...CURIOS, ...SEASONAL_CURIOS, ...ALMANAC_CURIOS]) assert.ok(seen.has('c:' + c.id), c.id + ' is in no set');
  assert.equal(CURIOS.length, 34);
  assert.equal(SETS.filter(s => s.group === 'cabinet').reduce((n, s) => n + s.members.length, 0), 34, 'the cabinet’s 34 are split among the cabinet sets');
  assert.equal(SETS.filter(s => s.group === 'almanac').length, 15);
  assert.equal(Object.keys(CURIO_SET).length, 34 + 6 + 60);
});

test('keepsake and souvenir members are things the game can actually give', () => {
  const routes = new Set(OUTINGS.map(o => o.id));
  for (const set of SETS) for (const m of set.members) {
    if (m.startsWith('r:')) { const relic = RELICS.find(r => r.id === m.slice(2)); assert.ok(relic, m); assert.ok(routes.has(relic.id.split(':')[0]), m + ' comes from a route that still runs'); }
    if (m.startsWith('s:')) assert.ok(VISITORS.some(v => v.id === m.slice(2)), m);
  }
});

test('set progress reads straight from where the game keeps things, and finishing pays once', () => {
  const s = household();
  const paper = SET_BY_ID.paper;
  assert.deepEqual([setProgress(s, paper).have, setProgress(s, paper).total], [0, 5]);
  own(s, 'damp-receipt', 'condolence-card', 'name-tag', 'map-house');
  assert.equal(setProgress(s, paper).complete, false);
  assert.equal(claimSet(s, 'paper'), null, 'not finished');
  own(s, 'named-book');
  assert.equal(setProgress(s, paper).claimable, true);
  assert.equal(claimableSets(s).length, 1);
  const souls = s.mayhem.souls;
  const r = claimSet(s, 'paper');
  assert.equal(r.souls, paper.souls); assert.equal(s.mayhem.souls, souls + paper.souls);
  assert.equal(r.title, paper.title); assert.ok(titlesOwned(s).includes('set:paper'));
  assert.equal(claimSet(s, 'paper'), null, 'once');
  assert.equal(setProgress(s, paper).claimed, true);
  assert.equal(completedSetCount(s), 1);
  // A set with a frame hands it over.
  own(s, ...SET_BY_ID.watchers.members.map(m => m.slice(2)));
  const w = claimSet(s, 'watchers');
  assert.equal(w.frame, 'Watchful Glass');
  assert.equal(equipFrame(s, 'watchful-glass'), true);
  assert.equal(activeFrame(s), 'watchful-glass');
  // Keepsakes and souvenirs count from their own homes.
  s.life.relics = ['drawer:0', 'drawer:1', 'drawer:2', 'fridge:0'];
  assert.equal(setProgress(s, SET_BY_ID['lost-property']).complete, true);
  s.stories = { collection: VISITORS.slice(0, 6).map(v => ({ id: v.id, at: 1 })) };
  assert.equal(setProgress(s, SET_BY_ID['callers-1']).complete, true);
  assert.equal(setProgress(s, SET_BY_ID['callers-2']).have, 0);
  const back = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.collections.claimed, s.collections.claimed);
  assert.equal(back.exchange.frame, 'watchful-glass');
});

test('Legacy ranks go on past Unspeakable with ever wider gaps and a title each', () => {
  assert.equal(LEGACY_RANKS.length, 30); assert.equal(LEGACY_LEVELS, 30);
  assert.equal(RANKS.length, 12 + 30);
  assert.equal(RANKS[11].title, 'Unspeakable'); assert.equal(RANKS[12].title.startsWith('Legacy I: '), true); assert.equal(RANKS.at(-1).title.startsWith('Legacy XXX: '), true);
  RANKS.forEach((r, i) => { if (i) assert.ok(r.at > RANKS[i - 1].at, 'rank ' + i + ' is further on'); });
  const gaps = LEGACY_RANKS.map((r, i) => r.at - (i ? LEGACY_RANKS[i - 1].at : LEGACY_START));
  gaps.forEach((g, i) => { if (i) assert.ok(g > gaps[i - 1], 'wider gaps'); });
  assert.equal(gaps[0], 1650); assert.equal(legacyAt(30), RANKS.at(-1).at);
  for (const r of LEGACY_RANKS) { assert.ok(!NODASH.test(r.title + r.line), r.title); assert.ok(r.short.length <= 40 && r.line.length > 30, r.title); }
  assert.equal(new Set(LEGACY_RANKS.map(r => r.short)).size, 30);
});

test('tokens are worked out from lifetime souls, can only be spent once and never paid twice', () => {
  const s = household();
  assert.equal(legacyLevel(s), 0); assert.equal(tokenBalance(s), 0);
  addSouls(s, LEGACY_START - 1);
  assert.equal(legacyLevel(s), 0);
  addSouls(s, 1 + 1650);
  assert.equal(rankIndexFor(s.mayhem.lifetime), 12);
  assert.equal(legacyLevel(s), 1); assert.equal(tokenBalance(s), 1);
  assert.equal(s.mayhem.rank, 12, 'the stored rank follows the ladder past 11');
  assert.equal(spendTokens(s, 2), false);
  assert.equal(spendTokens(s, 1), true); assert.equal(tokenBalance(s), 0);
  assert.equal(spendTokens(s, 1), false);
  // Spending souls does not lose a rank or a token.
  s.mayhem.souls = 0;
  assert.equal(legacyLevel(s), 1);
  const info = legacyInfo(s);
  assert.equal(info.level, 1); assert.equal(info.earned, 1); assert.equal(info.spent, 1); assert.equal(info.balance, 0);
  assert.ok(info.toNext > 0 && info.progress >= 0 && info.progress < 1);
  assert.deepEqual(legacyTitleIds(s), ['lg:1']);
  assert.equal(titleText('lg:1'), 'Previously Unspeakable');
  // A reload keeps the spend and cannot invent tokens.
  const back = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(back.legacy.spent, 1); assert.equal(tokenBalance(back), 0);
  const hacked = normalizeState({ ...JSON.parse(JSON.stringify(s)), legacy: { spent: 30 } });
  assert.equal(hacked.legacy.spent, 1, 'spent is clamped to what was earned');
  addSouls(s, 1e6);
  assert.equal(legacyLevel(s), 30);
  assert.equal(legacyInfo(s).next, null);
  assert.equal(legacyInfo(s).progress, 1);
});

test('the rank clamps follow the ladder safely, in the save and from a friend', () => {
  const m = normalizeMayhem({ rank: 999, lifetime: 5, souls: 5 }, household(), Date.now());
  assert.equal(m.rank, RANKS.length - 1);
  assert.equal(normalizeMayhem({ rank: 3 }, household()).rank, 3, 'ordinary ranks are untouched');
  assert.equal(readShelf({ name: 'x', rank: 999, curios: 0, residents: [] }).rank, RANKS.length - 1);
  assert.equal(readShelf({ name: 'x', rank: 20, curios: 0, residents: [] }).rank, 20);
  assert.equal(rankInfo(Object.assign(household(), {})).next.title, 'Mildly Damp');
});

test('the Exchange sells frames for souls and tokens, refuses what you cannot pay and never sells a reward', () => {
  const s = household();
  assert.equal(buyFrame(s, 'tin'), null, 'no souls');
  addSouls(s, 5000);
  const before = s.mayhem.souls;
  assert.equal(buyFrame(s, 'tin').id, 'tin');
  assert.equal(s.mayhem.souls, before - 250);
  assert.equal(buyFrame(s, 'tin'), null, 'owned');
  assert.equal(buyFrame(s, 'seance-felt'), null, 'a set reward is not for sale');
  assert.equal(buyFrame(s, 'obsidian'), null, 'no tokens');
  assert.equal(equipFrame(s, 'gilt'), false, 'not owned');
  assert.equal(equipFrame(s, 'tin'), true); assert.equal(activeFrame(s), 'tin');
  assert.equal(equipFrame(s, 'plain'), true);
  assert.equal(buyFrame(s, 'nonsense'), null);
  s.mayhem.lifetime = legacyAt(2); s.mayhem.souls = 0;
  assert.equal(tokenBalance(s), 2);
  assert.equal(canAfford(s, { tokens: 2 }), true);
  assert.equal(buyFrame(s, 'obsidian').id, 'obsidian');
  assert.equal(tokenBalance(s), 0);
});

test('portrait frames are bought once and worn by the resident you choose', () => {
  const s = household();
  addSouls(s, 2000);
  assert.equal(buyPortraitFrame(s, 'cameo').cost, 300);
  assert.equal(equipPortraitFrame(s, 'c0', 'cameo'), true);
  assert.equal(portraitFor(s, 'c0'), 'cameo'); assert.equal(portraitFor(s, 'c1'), 'plain');
  assert.equal(equipPortraitFrame(s, 'c1', 'doily'), false, 'not owned');
  assert.equal(equipPortraitFrame(s, 'ghost', 'cameo'), false, 'no such resident');
  const back = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(portraitFor(back, 'c0'), 'cameo');
  back.pets = back.pets.filter(p => p.id !== 'c0');
  assert.equal(normalizeExchange(back.exchange, back.pets).portrait.c0, undefined, 'a rehomed resident’s frame is dropped');
  equipPortraitFrame(s, 'c0', 'plain');
  assert.equal(portraitFor(s, 'c0'), 'plain');
});

test('everything the game gave away free stays free and owned, and only new things are sold', () => {
  const old = normalizeState({ pets: household().pets, decor: { room: 'parlor', wall: 'dots', wood: 'bone', accent: 'mint' } });
  assert.deepEqual(old.decor.owned.slice().sort(), [...FREE_DECOR_KEYS].sort());
  assert.equal(FREE_DECOR.room.length, 6); assert.equal(FREE_DECOR.wall.length, 7); assert.equal(FREE_DECOR.wood.length, 7); assert.equal(FREE_DECOR.accent.length, 6);
  for (const kind of ['room', 'wall', 'wood', 'accent']) for (const id of FREE_DECOR[kind]) assert.ok(decorOwned(old, kind + ':' + id));
  assert.equal(old.decor.room, 'parlor', 'their choice is untouched');
  // Even a save that lost the list keeps the free things.
  const stripped = household(); stripped.decor = { room: 'aubergine', wall: 'damask', wood: 'rosewood', accent: 'blood' };
  assert.ok(decorOwned(stripped, 'room:midnight'));
  assert.equal(decorOwned(stripped, 'room:catacomb-chic'), false);
  assert.equal(decorOwned(stripped, 'room:pumpkin-hollow'), false);
  assert.deepEqual(normalizeOwned(['room:catacomb-chic', 'room:made-up', 7]).filter(k => !FREE_DECOR_KEYS.includes(k)), ['room:catacomb-chic']);
  // Selling.
  const s = normalizeState(JSON.parse(JSON.stringify(stripped)));
  addSouls(s, 3000);
  assert.equal(buyDecor(s, 'room:midnight'), null, 'free things are not sold');
  assert.equal(buyDecor(s, 'room:pumpkin-hollow'), null, 'chapter sets come from the track or Back Issues');
  const before = s.mayhem.souls;
  assert.equal(buyDecor(s, 'room:catacomb-chic').cost, 800);
  assert.equal(s.mayhem.souls, before - 800); assert.ok(decorOwned(s, 'room:catacomb-chic'));
  assert.equal(buyDecor(s, 'room:catacomb-chic'), null);
  const back = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.ok(back.decor.owned.includes('room:catacomb-chic'));
  assert.equal(JSON.stringify(normalizeState(JSON.parse(JSON.stringify(back))).decor), JSON.stringify(back.decor), 'idempotent');
});

test('every new room, wood, wall and accent has art and a source', () => {
  for (const [key, item] of Object.entries(NEW_DECOR)) {
    const table = { room: ROOMS, wood: WOODS, wall: WALLS, accent: ACCENTS }[item.kind];
    assert.ok(table[item.id], key + ' is in the catalogue');
    assert.ok(item.source === 'chapter' || item.source === 'exchange');
    if (item.source === 'exchange') assert.ok(item.cost > 0 || item.tokens > 0, key + ' has a price');
  }
  for (const r of Object.values(ROOMS)) assert.equal(Object.keys(r.vars).length, 13);
  assert.ok(Object.keys(NEW_DECOR).length >= 15 * 2 + 12);
});

test('commissions cost a lot, leave a document and a title, and can be placed once', () => {
  const s = household();
  assert.equal(COMMISSIONS.length, 10);
  const costs = COMMISSIONS.map(c => c.cost);
  assert.deepEqual(costs, costs.slice().sort((a, b) => a - b), 'dearer as they go');
  assert.ok(costs[0] >= 1000 && costs.at(-1) >= 15000);
  assert.equal(placeCommission(s, 'portrait', 1), null, 'no souls');
  addSouls(s, 2000);
  const c = placeCommission(s, 'portrait', 1);
  assert.equal(c.id, 'portrait');
  assert.equal(s.mayhem.souls, 500);
  assert.equal(s.notes[0].from, 'the commissions office'); assert.ok(s.notes[0].text.includes('portrait'));
  assert.ok(titlesOwned(s).includes('cm:portrait'));
  assert.equal(placeCommission(s, 'portrait', 2), null, 'once');
  assert.equal(placeCommission(s, 'nonsense', 3), null);
  assert.equal(equipTitle(s, 'cm:portrait'), true); assert.equal(activeTitle(s), 'cm:portrait');
  assert.equal(equipTitle(s, 'cm:letter'), false);
  assert.equal(equipTitle(s, ''), true); assert.equal(activeTitle(s), '');
  for (const x of COMMISSIONS) assert.ok(!NODASH.test(x.name + x.blurb + x.done + x.title) && x.done.length > 80, x.id);
});

test('there is always something to save for: the Exchange alone holds months of income', () => {
  const cat = exchangeCatalog(household());
  const sum = list => list.reduce((n, i) => n + (i.cost || 0), 0);
  const total = sum(cat.frames) + sum(cat.portraits) + sum(cat.decor) + sum(cat.commissions);
  assert.ok(total > 80000, 'the Exchange alone sells ' + total + ' souls of things');
  const tokens = [...cat.frames, ...cat.portraits, ...cat.decor].reduce((n, i) => n + (i.tokens || 0), 0);
  assert.ok(tokens >= 30, 'tokens: ' + tokens + ' on offer against 30 to earn');
  assert.equal(cat.souls, 0);
  assert.ok(cat.frames.some(f => f.locked) && cat.frames.some(f => f.active));
});

test('title ids are all real, and titles read in the game’s voice', () => {
  for (const id of TITLE_IDS) { assert.ok(titleText(id), id); assert.ok(!NODASH.test(titleText(id))); }
  assert.equal(titleText('ch:thin-2026'), 'Warden of the Thin Part');
  assert.equal(titleText('bogus:1'), '');
  const odd = normalizeExchange({ frames: ['tin', 'tin', 'nope', 'plain'], frame: 'gilt', portraits: ['cameo'], portrait: { c0: 'doily' }, commissions: ['portrait', 'x'], titles: ['ch:thin-2026', 'zz'], title: 'ch:fog-2026' }, household().pets);
  assert.deepEqual(odd.frames, ['tin']); assert.equal(odd.frame, 'plain', 'not owned, so not worn');
  assert.deepEqual(odd.portrait, {}); assert.deepEqual(odd.titles, ['ch:thin-2026']); assert.equal(odd.title, '');
  assert.deepEqual(normalizeCollections({ claimed: ['paper', 'paper', 'bogus', 3] }).claimed, ['paper']);
  assert.deepEqual(normalizeNudgeCats({ away: false, bogus: false, chest: 'no' }), { emergency: true, away: false, almanac: true, chest: true });
  assert.equal(normalizeLegacy({ spent: 99 }).spent, 30);
  assert.equal(legacyReached(1e9), 30);
});

test('the thirteen long-game achievements exist, are grouped and unlock from the state', () => {
  const ids = ['cabinet-10', 'cabinet-full', 'set-first', 'set-five', 'rank-legend', 'legacy-one', 'coffins-50', 'omen-14', 'tiers-10', 'badge-first', 'weekly-first', 'weekly-five', 'freeze-saved'];
  for (const id of ids) {
    const a = ACHIEVEMENTS.find(x => x.id === id);
    assert.ok(a && a.label && a.hint && a.desc && a.toastLine, id);
    assert.ok(!NODASH.test(a.label + a.hint + a.desc + a.toastLine));
    assert.ok(INCIDENT_GROUPS.some(g => g.ids.includes(id)), id + ' is in a group');
  }
  const s = household();
  assert.equal(checkAchievements(s).filter(a => ids.includes(a.id)).length, 0);
  own(s, ...CURIOS.map(c => c.id));
  s.mayhem.coffins = 50; s.mayhem.omen.streak = 14; s.mayhem.rank = 6; s.mayhem.lifetime = legacyAt(1);
  s.almanac.stats = { tiers: 10, badges: 1, weekly: 6, chests: 5, bought: 0 }; s.streaks.used = 1;
  for (const set of SETS.filter(x => x.group === 'cabinet').slice(0, 5)) own(s, ...set.members.map(m => m.slice(2)));
  const got = checkAchievements(s).map(a => a.id);
  for (const id of ids) assert.ok(got.includes(id), id + ' did not unlock; got ' + got.join());
});
