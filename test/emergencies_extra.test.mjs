import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { EMERGENCIES } from '../src/content/mayhem.js';
import { EXTRA_EMERGENCIES } from '../src/content/emergencies-extra.js';
import { TRAIT_BY_ID } from '../src/content/traits.js';
import { GLYPH_NAMES } from '../src/art/mayhem-glyphs.js';
import {
  accrueMayhem, resolveEmergency, choiceOdds, outcomeWeight, SUITED_BOOST, EMERGENCY_BY_ID, EMERGENCY_EVERY_MS
} from '../src/engine/mayhem.js';

const NOW = new Date(2026, 8, 25, 14, 0, 0).getTime();
const BASE_COUNT = EMERGENCIES.length - EXTRA_EMERGENCIES.length;
const BASE = EMERGENCIES.slice(0, BASE_COUNT);
const outcomesOf = card => card.choices.flatMap(c => c.outcomes);
const textsOf = card => [card.title, ...card.choices.flatMap(c => [c.label, ...c.outcomes.map(o => o.text)])];
const mean = list => list.reduce((a, b) => a + b, 0) / list.length;
const cardMean = card => mean(card.choices.map(c => mean(c.outcomes.map(o => o.souls))));
const mulberry = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

test('volume two ships 48 well formed cards after the base set, ids and stamps unique', () => {
  assert.equal(EXTRA_EMERGENCIES.length, 48);
  assert.equal(BASE_COUNT, 60, 'the base set is untouched');
  assert.deepEqual(EMERGENCIES.slice(BASE_COUNT), EXTRA_EMERGENCIES, 'the base array comes first, then the extras');
  assert.equal(new Set(EMERGENCIES.map(e => e.id)).size, EMERGENCIES.length, 'ids are unique across both volumes');
  for (const e of EXTRA_EMERGENCIES) {
    assert.match(e.id, /^[a-z][a-z0-9-]*$/);
    assert.equal(EMERGENCY_BY_ID[e.id], e, e.id + ' is reachable by id');
    assert.ok(GLYPH_NAMES.includes(e.art), e.id + ' glyph ' + e.art);
    assert.equal(e.choices.length, 2, e.id);
    assert.ok(e.title.length <= 105, e.id + ' title ' + e.title.length);
    assert.ok(e.pair === undefined || e.pair === true, e.id);
    for (const c of e.choices) {
      assert.ok(c.label.length <= 36, e.id + ' label ' + c.label);
      assert.ok(c.outcomes.length >= 2 && c.outcomes.length <= 3, e.id);
      assert.equal(new Set(c.outcomes.map(o => o.stamp)).size, c.outcomes.length, e.id + ' repeats a stamp inside a choice');
      for (const o of c.outcomes) {
        assert.ok(['good', 'bad', 'weird'].includes(o.tone), e.id);
        assert.ok(o.souls >= 8 && o.souls <= 24 && Number.isInteger(o.souls), e.id + ' pays ' + o.souls);
        assert.ok(o.text.length >= 60 && o.text.length <= 215, e.id + ' outcome length ' + o.text.length);
        assert.ok(o.stamp.length <= 16 && /^[A-Z][A-Z0-9 ?!’]*$/.test(o.stamp), e.id + ' stamp ' + o.stamp);
      }
    }
    assert.ok(new Set(outcomesOf(e).map(o => o.tone)).size >= 2, e.id + ' needs at least two tones');
  }
  // The base set repeats a few stamps; the new cards keep every stamp to themselves.
  const baseStamps = new Set(BASE.flatMap(e => outcomesOf(e).map(o => o.stamp)));
  const stamps = EXTRA_EMERGENCIES.flatMap(e => outcomesOf(e).map(o => o.stamp));
  assert.equal(new Set(stamps).size, stamps.length, 'every new verdict stamp is unique');
  for (const stamp of stamps) assert.ok(!baseStamps.has(stamp), 'the base set already stamps ' + stamp);
});

test('no duplicate copy, no dashes of any kind, curly quotes only, only {a} and {b}', () => {
  const seen = new Map();
  for (const e of EMERGENCIES) {
    for (const t of [e.title, ...outcomesOf(e).map(o => o.text)]) {
      assert.ok(!seen.has(t), e.id + ' repeats the copy of ' + seen.get(t) + ': ' + t);
      seen.set(t, e.id);
    }
  }
  for (const e of EXTRA_EMERGENCIES) {
    const labels = e.choices.map(c => c.label);
    assert.equal(new Set(labels).size, 2, e.id + ' offers one choice twice');
    for (const t of textsOf(e)) {
      assert.ok(!/[‐-―−]/.test(t), e.id + ' has a dash: ' + t);
      assert.ok(!/ - | -- |--/.test(t), e.id + ' has a typed dash: ' + t);
      assert.ok(!/["'`]/.test(t), e.id + ' has a straight quote: ' + t);
      assert.equal((t.match(/“/g) || []).length, (t.match(/”/g) || []).length, e.id + ' unbalanced curly quotes: ' + t);
      for (const [slot] of t.matchAll(/\{[^}]*\}/g)) assert.ok(['{a}', '{b}'].includes(slot), e.id + ' uses ' + slot);
      assert.ok(!/\s{2,}|\s[.,;:!?]/.test(t), e.id + ' has stray spacing: ' + t);
      assert.ok(/[.?!”)]$/.test(t) || t === e.title || labels.includes(t), e.id + ' ends without punctuation: ' + t);
    }
    const all = textsOf(e).join(' ');
    if (e.pair) assert.ok(all.includes('{a}') && all.includes('{b}'), e.id + ' is a pair card that never names both');
    else assert.ok(!all.includes('{b}'), e.id + ' names {b} without a pair');
    assert.ok(e.title.includes('{a}') || e.title.includes('{b}') || e.id === 'wifi-password', e.id + ' title names no one');
  }
  assert.ok(!/[\u2013\u2014]/.test(JSON.stringify(EXTRA_EMERGENCIES)));
});

test('every effect is one the engine understands, and the trait and trust hooks are well formed', () => {
  let hooked = 0, trusting = 0;
  for (const e of EXTRA_EMERGENCIES) {
    let cardHooked = false;
    for (const o of outcomesOf(e)) {
      if (o.bond !== undefined) assert.equal(o.bond, 'a', e.id);
      if (o.curio !== undefined) assert.equal(o.curio, true, e.id);
      if (o.grudge !== undefined) { assert.ok(['a', 'b'].includes(o.grudge), e.id); if (o.grudge === 'b') assert.ok(e.pair, e.id + ' grudge b without a pair'); }
      if (o.b) assert.ok(e.pair, e.id + ' needs {b}');
      for (const who of ['a', 'b']) for (const [need, delta] of Object.entries(o[who] || {})) {
        assert.ok(['food', 'fuss', 'clean'].includes(need), e.id + ' need ' + need);
        assert.ok(Number.isFinite(delta) && Math.abs(delta) >= 10 && Math.abs(delta) <= 30, e.id + ' delta ' + delta);
        assert.ok(o.tone === 'bad' ? delta < 0 || o.a === undefined : true, e.id);
      }
      assert.ok(!(o.fits && o.bondAt), e.id + ' must not stack fits and bondAt');
      if (o.fits !== undefined) {
        assert.ok(Array.isArray(o.fits) && o.fits.length >= 3 && o.fits.length <= 10, e.id + ' fits size');
        assert.equal(new Set(o.fits).size, o.fits.length, e.id + ' repeats a trait');
        for (const id of o.fits) assert.ok(TRAIT_BY_ID[id], e.id + ' unknown trait ' + id);
        assert.ok(!o.fits.includes('damp'), e.id + ' must not use the fixture trait damp');
        cardHooked = true;
      }
      if (o.bondAt !== undefined) {
        assert.ok(Number.isInteger(o.bondAt) && o.bondAt >= 4 && o.bondAt <= 15, e.id + ' bondAt ' + o.bondAt);
        assert.equal(o.bond, 'a', e.id + ' a trusted ending is the one that earns trust');
        cardHooked = true; trusting++;
      }
    }
    if (cardHooked) hooked++;
  }
  assert.ok(hooked >= Math.ceil(EXTRA_EMERGENCIES.length / 3), 'at least a third of the cards care who is involved, got ' + hooked);
  assert.ok(trusting >= 5, 'enough cards reward trust');
});

test('the set varies: lone and pair cards, many glyphs, all three tones, callbacks to older events', () => {
  const pairs = EXTRA_EMERGENCIES.filter(e => e.pair).length;
  assert.ok(pairs >= 8 && pairs <= 14, 'pair cards ' + pairs);
  assert.ok(EXTRA_EMERGENCIES.length - pairs >= 30, 'plenty of cards for a lone resident');
  assert.ok(new Set(EXTRA_EMERGENCIES.map(e => e.art)).size >= 30, 'glyph variety');
  for (const tone of ['good', 'bad', 'weird']) {
    const share = EXTRA_EMERGENCIES.flatMap(outcomesOf).filter(o => o.tone === tone).length / EXTRA_EMERGENCIES.flatMap(outcomesOf).length;
    assert.ok(share > 0.2 && share < 0.45, tone + ' share ' + share);
  }
  // Chain setups: cards that pick up an event an older card could have caused.
  const callbacks = { 'geoffrey-planning': /Geoffrey/, 'raven-invoice': /raven/i, 'moth-charity': /moth/i, 'dentist-practice': /Victorian dentist/, 'snail-hearing': /snail/ };
  for (const [id, pattern] of Object.entries(callbacks)) assert.ok(pattern.test(textsOf(EMERGENCY_BY_ID[id]).join(' ')), id);
  const times = EXTRA_EMERGENCIES.map(e => textsOf(e).join(' ')).join(' ');
  for (const when of [/4:40/, /midnight/, /thirteen/, /bin day/, /six/]) assert.ok(when.test(times), 'a time of day: ' + when);
});

test('the new cards do not inflate the economy', () => {
  const baseMean = mean(BASE.flatMap(outcomesOf).map(o => o.souls));
  const extraMean = mean(EXTRA_EMERGENCIES.flatMap(outcomesOf).map(o => o.souls));
  assert.ok(Math.abs(extraMean - baseMean) / baseMean <= 0.05, 'extras ' + extraMean.toFixed(2) + ' vs base ' + baseMean.toFixed(2));
  const all = mean(EMERGENCIES.flatMap(outcomesOf).map(o => o.souls));
  assert.ok(Math.abs(all - baseMean) / baseMean <= 0.05, 'combined ' + all.toFixed(2));
  for (const e of EXTRA_EMERGENCIES) assert.ok(cardMean(e) >= 12 && cardMean(e) <= 21, e.id + ' averages ' + cardMean(e).toFixed(1));
  // Guaranteed curios are worth about a coffin each, so they stay as rare as they are in the base set.
  const share = list => list.flatMap(outcomesOf).filter(o => o.curio).length / list.flatMap(outcomesOf).length;
  assert.ok(Math.abs(share(EXTRA_EMERGENCIES) - share(BASE)) < 0.05, 'curio share ' + share(EXTRA_EMERGENCIES).toFixed(3) + ' vs ' + share(BASE).toFixed(3));
});

const plain = { stats: { cute: 5, menace: 5, mystique: 5 }, bond: 0, traits: ['sugar'] };
test('a trait or trust hook makes an ending three times as likely and leaves every other ending alone', () => {
  const fitted = { tone: 'good', fits: ['theatrical', 'terminal'] }, trusted = { tone: 'bad', bondAt: 8 }, ordinary = { tone: 'good' };
  assert.equal(outcomeWeight(plain, fitted), 1, 'a stranger to the trait rolls as before');
  assert.equal(outcomeWeight({ ...plain, traits: ['sugar', 'terminal'] }, fitted), SUITED_BOOST);
  assert.equal(outcomeWeight({ ...plain, traits: ['theatrical'] }, ordinary), 1, 'endings without a hook ignore traits');
  assert.equal(outcomeWeight({ ...plain, bond: 7 }, trusted), 1 * (1 - 0.02 * 7));
  assert.equal(outcomeWeight({ ...plain, bond: 8 }, trusted), SUITED_BOOST * (1 - 0.02 * 8));
  assert.equal(outcomeWeight({ stats: {} }, fitted), 1, 'a pet with no traits or bond is plain');
  assert.equal(outcomeWeight({ traits: 'terminal' }, fitted), 1, 'hostile trait data is ignored');
  assert.equal(outcomeWeight({ traits: ['terminal'], bond: 'x' }, { tone: 'weird', bondAt: 4, fits: ['terminal'] }), SUITED_BOOST, 'fitting twice does not stack');
  const choice = { outcomes: [{ tone: 'good', fits: ['terminal'] }, { tone: 'bad' }] };
  const calm = choiceOdds(choice, plain), drawn = choiceOdds(choice, { ...plain, traits: ['terminal'] });
  assert.ok(drawn.good > calm.good && drawn.bad < calm.bad, 'the risk read moves with the hook');
  assert.ok(Math.abs(drawn.good + drawn.bad + drawn.weird - 1) < 1e-9);
});

test('the same dice give a theatrical resident and a plain one different endings on a card written for them', () => {
  // library-book, second choice: the moan (good, suits the stagey) against the doors (weird).
  const tally = (over, rolls = 300) => {
    let good = 0;
    for (let i = 0; i < rolls; i++) {
      const s = household(1, over);
      s.mayhem.queue = [{ uid: 1, id: 'library-book', a: 'm0', at: NOW }];
      s.mayhem.serial = 1;
      if (resolveEmergency(s, 1, 1, NOW, () => (i + 0.5) / rolls).tone === 'good') good++;
    }
    return good;
  };
  const stagey = tally({ traits: ['theatrical'] }), ordinary = tally({ traits: ['sugar'] });
  assert.ok(stagey > ordinary + 60, 'stagey ' + stagey + ' vs ordinary ' + ordinary);
  // bin-day, first choice: a trusted resident is more likely to be met with "I knew you would come".
  const fished = bond => {
    let good = 0;
    for (let i = 0; i < 300; i++) {
      const s = household(1, { bond });
      s.mayhem.queue = [{ uid: 1, id: 'bin-day', a: 'm0', at: NOW }];
      s.mayhem.serial = 1;
      if (resolveEmergency(s, 1, 0, NOW, () => (i + 0.5) / 300).tone === 'good') good++;
    }
    return good;
  };
  assert.ok(fished(12) > fished(2) + 60, 'trust turns the odds');
  // The card tells the player: the risk read for the first choice differs between the two residents.
  const info = bond => choiceOdds(EMERGENCY_BY_ID['bin-day'].choices[0], { ...plain, bond });
  assert.ok(info(12).bad < info(2).bad);
});

function household(count = 4, over = {}) {
  const s = blankState();
  s.started = NOW - 86400000; s.lastTick = NOW;
  const roster = [
    { name: 'Agnes', traits: ['theatrical', 'sugar'], stats: { cute: 6, menace: 4, damp: 5, mystique: 6 }, bond: 8 },
    { name: 'Pip', traits: ['feral', 'bitey'], stats: { cute: 5, menace: 8, damp: 5, mystique: 3 }, bond: 2 },
    { name: 'Oswald', traits: ['ancient', 'haunted'], stats: { cute: 3, menace: 4, damp: 5, mystique: 9 }, bond: 14 },
    { name: 'Gnasher', traits: ['clean', 'etiquette'], stats: { cute: 8, menace: 3, damp: 5, mystique: 5 }, bond: 20 }
  ];
  s.pets = roster.slice(0, count).map((r, i) => ({ id: 'm' + i, needs: { food: 40, fuss: 40, clean: 40 }, cared: 0, grudges: 0, born: NOW - 86400000, ...r, ...over }));
  s.pets.forEach((p, i) => { s.slots[i] = p.id; });
  return s;
}

function drawMany(count, seed) {
  const rnd = mulberry(seed), s = household(4), seen = new Map();
  let souls = 0;
  for (let i = 0; i < count; i++) {
    s.mayhem.queue.length = 0;
    s.mayhem.nextAt = NOW + i * EMERGENCY_EVERY_MS;
    accrueMayhem(s, NOW + i * EMERGENCY_EVERY_MS, rnd);
    const entry = s.mayhem.queue[0];
    assert.ok(entry, 'a card was drawn');
    seen.set(entry.id, (seen.get(entry.id) || 0) + 1);
    souls += resolveEmergency(s, entry.uid, rnd() < 0.5 ? 0 : 1, NOW + i * EMERGENCY_EVERY_MS, rnd).souls;
  }
  return { seen, average: souls / count };
}

test('2,000 draws show every new card and an average payout within 5% of the base set alone', () => {
  const withExtras = drawMany(2000, 7);
  for (const e of EXTRA_EMERGENCIES) assert.ok(withExtras.seen.get(e.id) > 5, e.id + ' was drawn ' + (withExtras.seen.get(e.id) || 0) + ' times');
  const extraDraws = EXTRA_EMERGENCIES.reduce((n, e) => n + withExtras.seen.get(e.id), 0);
  assert.ok(extraDraws / 2000 > 0.38 && extraDraws / 2000 < 0.5, 'extras are about 44% of draws, got ' + extraDraws / 2000);
  const saved = EMERGENCIES.splice(BASE_COUNT);
  let baseOnly;
  try { baseOnly = drawMany(2000, 7); } finally { EMERGENCIES.push(...saved); }
  assert.equal(EMERGENCIES.length, 108, 'the card list is restored');
  for (const e of EXTRA_EMERGENCIES) assert.ok(!baseOnly.seen.has(e.id));
  assert.ok(Math.abs(withExtras.average - baseOnly.average) / baseOnly.average <= 0.05,
    'average souls per emergency ' + withExtras.average.toFixed(2) + ' vs ' + baseOnly.average.toFixed(2));
});

test('saves that hold a volume two card survive a reload, and unknown cards are still dropped', () => {
  const s = household(3);
  const ids = ['library-book', 'charity-shop', 'bin-day'];
  s.mayhem.queue = ids.map((id, i) => ({ uid: i + 1, id, a: 'm0', ...(EMERGENCY_BY_ID[id].pair ? { b: 'm1' } : {}), at: NOW }));
  s.mayhem.serial = 3;
  s.mayhem.recent = [...ids, 'not-a-card'];
  const back = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.mayhem.queue.map(q => q.id), ids);
  assert.deepEqual(back.mayhem.recent, ids);
  assert.equal(back.mayhem.queue.find(q => q.id === 'charity-shop').b, 'm1');
});
