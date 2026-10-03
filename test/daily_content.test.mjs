import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState, localDayKey } from '../src/state.js';
import { OMENS, CHORES, QUIET_LINES, DUPLICATE_LINES } from '../src/content/mayhem.js';
import { OMENS_EXTRA } from '../src/content/omens-extra.js';
import { CHORES_EXTRA } from '../src/content/chores-extra.js';
import { QUIET_EXTRA, DUPLICATE_EXTRA } from '../src/content/ambient-extra.js';
import { CASES } from '../src/content/stories.js';
import { CASES_EXTRA } from '../src/content/cases-extra.js';
import { GLYPH_NAMES } from '../src/art/mayhem-glyphs.js';
import { normalizeMayhem, QUEUE_MAX } from '../src/mayhem-state.js';
import {
  drawOmen, todaysOmen, coffinCost, queueCap, accrueMayhem, resolveEmergency, deed, ensureChores, openCoffin, addSouls,
  rewardGame, rewardCheck, rollCurio, COFFIN_COST, CHORE_SOULS, CARE_SOULS, EMERGENCY_EVERY_MS
} from '../src/engine/mayhem.js';
import { careFor, doRounds } from '../src/engine/care.js';
import {
  advanceStories, advanceCase, caseGate, caseText, currentCase, startNextCase, storyState, pickCaseKind, WEEK
} from '../src/engine/stories.js';
import { lifeState } from '../src/engine/life.js';
import { sceneDirection } from '../src/content/scenes.js';

const NOW = new Date(2026, 8, 25, 14, 0, 0).getTime();
const DAY = 86400000;
function household(count = 3) {
  const s = blankState();
  s.started = NOW - DAY; s.lastTick = NOW;
  s.pets = Array.from({ length: count }, (_, i) => ({ id: 'm' + i, name: ['Agnes', 'Pip', 'Oswald', 'Gnasher'][i], traits: ['damp'], needs: { food: 40, fuss: 40, clean: 40 }, bond: 3, cared: 0, grudges: 0, born: NOW - DAY, stats: { cute: 5, menace: 5, damp: 5, mystique: 5 } }));
  s.pets.forEach((p, i) => { s.slots[i] = p.id; });
  return s;
}
// Every character class a dash can hide in: hyphen minus, the Unicode hyphens and
// dashes, the horizontal bar and the minus sign.
const DASH = /[-‐-―−]/;
const STRAIGHT_QUOTE = /["']/;
const SENTENCE = /[.!?”]$/;
const cleanText = (text, label) => {
  assert.equal(typeof text, 'string', label);
  assert.ok(text.trim() === text && text.length > 0, label + ' has stray whitespace');
  assert.ok(!DASH.test(text), label + ' contains a dash: ' + text);
  assert.ok(!STRAIGHT_QUOTE.test(text), label + ' uses a straight quote: ' + text);
  assert.ok(!/  /.test(text), label + ' has a double space');
};

/* ---------------- omens ---------------- */
const BASE_OMEN_IDS = ['wet-hand', 'hanged-spoon', 'open-coffin', 'many-eyes', 'crowded-grave', 'patient-worm', 'smiling-moon', 'second-shadow', 'tolling-bell', 'hungry-house'];
// The first sentence is what the desk tile shows, so it must say what the omen does.
const OMEN_STEM = {
  care: /^Care pays double souls today\.$/,
  mayhem: /^Emergencies pay double souls today\.$/,
  coffin: /^Coffins are half price today\.$/,
  luck: /^Rarer curios are more likely today\.$/,
  extra: /^One more emergency can pile up today\.$/,
  chores: /^Chores pay double souls today\.$/
};

test('twenty more omens join the original ten, appended so the old order is untouched', () => {
  assert.equal(OMENS_EXTRA.length, 20);
  assert.equal(OMENS.length, 30);
  assert.deepEqual(OMENS.slice(0, 10).map(o => o.id), BASE_OMEN_IDS, 'the original ten keep their places');
  assert.deepEqual(OMENS.slice(10), OMENS_EXTRA);
});

test('every new omen is well formed, plainly worded and free of dashes', () => {
  const ids = new Set(), names = new Set(), lines = new Set();
  for (const o of OMENS) {
    assert.match(o.id, /^[a-z]+(-[a-z]+)*$/, 'omen id ' + o.id);
    assert.ok(!ids.has(o.id), 'duplicate omen id ' + o.id); ids.add(o.id);
    assert.ok(!names.has(o.name), 'duplicate omen name ' + o.name); names.add(o.name);
    assert.ok(!lines.has(o.line), 'duplicate omen line ' + o.id); lines.add(o.line);
    assert.ok(OMEN_STEM[o.effect], o.id + ' has an effect the engine does not read: ' + o.effect);
  }
  for (const o of OMENS_EXTRA) {
    cleanText(o.name, o.id + ' name'); cleanText(o.line, o.id + ' line');
    assert.match(o.name, /^The [A-Z]/, o.id + ' name');
    assert.ok(o.name.length <= 28, o.id + ' name is too long for the card face: ' + o.name);
    assert.ok(o.line.length <= 200, o.id + ' line is too long for the card: ' + o.line.length);
    assert.ok(!/[{}]/.test(o.line + o.name), o.id + ' uses a placeholder the omen card never fills');
    assert.ok(GLYPH_NAMES.includes(o.glyph), o.id + ' uses an unknown glyph ' + o.glyph);
    const first = o.line.split('.')[0] + '.';
    assert.match(first, OMEN_STEM[o.effect], o.id + ' first sentence must state the effect');
    assert.ok(o.line.length > first.length + 20, o.id + ' needs a prophecy after the effect');
    assert.match(o.line, SENTENCE, o.id + ' line must end as a sentence');
  }
});

test('the new omens keep each effect about as common as before', () => {
  const count = effect => OMENS.filter(o => o.effect === effect).length;
  for (const effect of Object.keys(OMEN_STEM)) {
    assert.ok(OMENS_EXTRA.filter(o => o.effect === effect).length >= 3, 'too few new ' + effect + ' omens');
    const share = count(effect) / OMENS.length;
    assert.ok(share >= 0.12 && share <= 0.22, effect + ' share drifted to ' + share.toFixed(2));
  }
});

test('every new omen can be drawn, survives a save round trip and keeps its effect', () => {
  for (const [i, omen] of OMENS.entries()) {
    const s = household();
    // The draw picks from every omen except last night's, so aim at this one's slot.
    const others = OMENS.filter(o => o.id !== '');
    const result = drawOmen(s, NOW + i * DAY, () => (others.findIndex(o => o.id === omen.id) + 0.5) / others.length);
    assert.equal(result.omen.id, omen.id, 'unreachable omen ' + omen.id);
    const saved = JSON.parse(JSON.stringify(s.mayhem));
    const loaded = normalizeMayhem(saved, s, NOW + i * DAY);
    assert.equal(loaded.omen.id, omen.id, omen.id + ' is dropped by the normalizer');
    s.mayhem = loaded;
    assert.equal(todaysOmen(s, NOW + i * DAY).effect, omen.effect);
  }
});

test('each new omen does what its first sentence says', () => {
  const withOmen = (s, id, now = NOW) => { const key = localDayKey(now); s.mayhem.omen = { day: key, id, streak: 1, lastDay: key, grace: 1 }; return s; };
  for (const omen of OMENS_EXTRA) {
    const id = omen.id;
    if (omen.effect === 'coffin') {
      assert.equal(coffinCost(withOmen(household(), id), NOW), COFFIN_COST / 2, id);
      assert.equal(coffinCost(household(), NOW), COFFIN_COST);
    } else if (omen.effect === 'extra') {
      assert.equal(queueCap(withOmen(household(), id), NOW), QUEUE_MAX, id);
      assert.equal(queueCap(household(), NOW), QUEUE_MAX - 1);
    } else if (omen.effect === 'care') {
      const s = withOmen(household(), id);
      assert.equal(careFor(s, s.pets[0], 'food', NOW).souls, CARE_SOULS * 2, id);
    } else if (omen.effect === 'chores') {
      const s = withOmen(household(), id);
      s.mayhem.chores = { day: localDayKey(NOW), list: [{ id: 'mayhem1', have: 0, done: false }, { id: 'feed', have: 0, done: false }, { id: 'rounds', have: 0, done: false }], bonus: false };
      assert.equal(deed(s, 'mayhem', 1, NOW)[0].souls, CHORE_SOULS * 2, id);
    } else if (omen.effect === 'mayhem') {
      const plain = household(), omened = withOmen(household(), id);
      for (const s of [plain, omened]) accrueMayhem(s, NOW, () => 0);
      const a = resolveEmergency(plain, plain.mayhem.queue[0].uid, 0, NOW, () => 0.5);
      const b = resolveEmergency(omened, omened.mayhem.queue[0].uid, 0, NOW, () => 0.5);
      assert.equal(b.souls, a.souls * 2, id);
    } else {
      // Luck: over many identical rolls the omen must hand out more than the plain draw.
      // rollCurio reads the omen against the real clock, so pin the clock to NOW.
      const rare = omened => {
        let n = 0, seed = 12345;
        const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
        const realNow = Date.now;
        Date.now = () => NOW;
        try {
          for (let i = 0; i < 1500; i++) {
            const s = household(); if (omened) withOmen(s, id);
            if (rollCurio(s, rnd, false, NOW).rarity.id !== 'common') n++;
          }
        } finally { Date.now = realNow; }
        return n;
      };
      assert.ok(rare(true) > rare(false), id + ' does not improve the odds');
    }
  }
});

/* ---------------- chores ---------------- */
// The deeds the game actually emits: care:food, care:fuss and care:clean from careFor,
// rounds from doRounds, game from the arcade, court and outings, coffin from openCoffin,
// mayhem from resolveEmergency and check from Check the shelf.
const DETECTABLE = new Set(['care:food', 'care:fuss', 'care:clean', 'care', 'mayhem', 'rounds', 'game', 'coffin', 'check']);

test('fourteen more chores join the original ten, each on a deed the game can detect', () => {
  assert.equal(CHORES_EXTRA.length, 14);
  assert.equal(CHORES.length, 24);
  assert.deepEqual(CHORES.slice(0, 10).map(c => c.id), ['feed', 'fuss', 'wash', 'mayhem', 'mayhem3', 'rounds', 'game', 'coffin', 'check', 'care5']);
  const ids = new Set(), labels = new Set();
  for (const c of CHORES) {
    assert.match(c.id, /^[a-z]+[0-9]*$/, c.id);
    assert.ok(!ids.has(c.id), 'duplicate chore id ' + c.id); ids.add(c.id);
    assert.ok(!labels.has(c.label), 'duplicate chore label ' + c.label); labels.add(c.label);
    assert.ok(DETECTABLE.has(c.deed), c.id + ' counts a deed nothing emits: ' + c.deed);
    assert.ok(Number.isInteger(c.need) && c.need >= 1 && c.need <= 6, c.id + ' need ' + c.need);
  }
  for (const c of CHORES_EXTRA) {
    cleanText(c.label, c.id + ' label'); cleanText(c.line, c.id + ' line');
    assert.ok(c.label.length <= 32, c.id + ' label is too long for a phone row: ' + c.label);
    assert.ok(c.line.length <= 40, c.id + ' line is too long for a phone row: ' + c.line);
    assert.ok(!/[{}.]/.test(c.label + c.line), c.id + ' uses a placeholder or a full stop');
    assert.ok(/\d|once|twice/.test(c.line), c.id + ' line should say how many');
  }
  for (const deedKind of DETECTABLE) assert.ok(CHORES.filter(c => c.deed === deedKind).length >= 2, 'no variety for ' + deedKind);
});

// Performs one act of the kind a chore counts, through the real entry point.
function act(s, chore, step) {
  const t = NOW + step * (EMERGENCY_EVERY_MS + 61000);
  const [kind, need] = chore.deed.split(':');
  if (kind === 'care') {
    const which = need || ['food', 'fuss', 'clean'][step % 3];
    const pet = s.pets[step % s.pets.length];
    pet.needs[which] = 20;
    careFor(s, pet, which, t);
  } else if (kind === 'rounds') doRounds(s, t);
  else if (kind === 'coffin') { addSouls(s, 100); openCoffin(s, t, () => 0.5); }
  else if (kind === 'mayhem') { accrueMayhem(s, t, () => 0); resolveEmergency(s, s.mayhem.queue[0].uid, 0, t, () => 0.5); }
  else if (kind === 'game') rewardGame(s, t);
  else if (kind === 'check') rewardCheck(s, t);
  else throw new Error('unhandled deed ' + chore.deed);
}

test('every new chore completes after exactly its count of real acts', () => {
  for (const chore of CHORES_EXTRA) {
    const s = household(3);
    const key = localDayKey(NOW);
    s.mayhem.chores = { day: key, list: [{ id: chore.id, have: 0, done: false }], bonus: false };
    // Every act takes an explicit time, and six steps of thirteen minutes stay inside the local day.
    for (let step = 0; step < chore.need; step++) {
      assert.equal(s.mayhem.chores.list[0].done, false, chore.id + ' finished early at step ' + step);
      act(s, chore, step);
    }
    assert.equal(s.mayhem.chores.list[0].done, true, chore.id + ' never completed');
    assert.equal(s.mayhem.chores.list[0].have, chore.need, chore.id);
  }
});

test('three distinct chores are drawn every day, every chore shows up, and the day is stable', () => {
  const seen = new Set();
  for (let d = 0; d < 400; d++) {
    const s = household();
    const when = NOW + d * DAY;
    const chores = ensureChores(s, when);
    assert.equal(chores.list.length, 3);
    const deeds = chores.list.map(e => CHORES.find(c => c.id === e.id).deed);
    assert.equal(new Set(deeds).size, 3, 'a day repeats a deed: ' + deeds);
    assert.ok(deeds.filter(x => x === 'mayhem').length <= 1);
    chores.list.forEach(e => seen.add(e.id));
    assert.deepEqual(ensureChores(s, when + 1000).list, chores.list, 'the day changes between loads');
    const loaded = normalizeMayhem(JSON.parse(JSON.stringify(s.mayhem)), s, when);
    assert.deepEqual(loaded.chores.list.map(e => e.id), chores.list.map(e => e.id), 'a new chore id was dropped by the normalizer');
  }
  assert.deepEqual([...seen].sort(), CHORES.map(c => c.id).sort(), 'some chore can never be drawn');
});

/* ---------------- ambient lines ---------------- */
test('the empty tray and the duplicate quips each have at least twenty four lines', () => {
  assert.ok(QUIET_LINES.length >= 24 && DUPLICATE_LINES.length >= 24, QUIET_LINES.length + ' and ' + DUPLICATE_LINES.length);
  assert.equal(QUIET_LINES.length, 5 + QUIET_EXTRA.length);
  assert.equal(DUPLICATE_LINES.length, 4 + DUPLICATE_EXTRA.length);
  assert.equal(QUIET_LINES[0], 'Nothing is on fire. Give it a minute.', 'the first line a returning player saw is still first');
  assert.equal(DUPLICATE_LINES[0], 'You already own this. It is disappointed in you.');
  for (const pool of [QUIET_LINES, DUPLICATE_LINES]) assert.equal(new Set(pool).size, pool.length, 'a line is repeated');
});

test('new ambient lines are short, whole sentences with no dashes, quotes or placeholders', () => {
  for (const line of QUIET_EXTRA) {
    cleanText(line, 'quiet line');
    assert.ok(line.length <= 90, 'quiet line too long for the calm strip: ' + line);
    assert.match(line, /^[A-Z]/); assert.match(line, SENTENCE, line);
    assert.ok(!/[{}]/.test(line));
  }
  for (const line of DUPLICATE_EXTRA) {
    cleanText(line, 'duplicate quip');
    assert.ok(line.length <= 110, 'duplicate quip too long for the toast: ' + line);
    assert.match(line, /^[A-Z]/); assert.match(line, SENTENCE, line);
    assert.ok(!/[{}]/.test(line), 'a quip cannot name the curio');
  }
});

/* ---------------- weekly case files ---------------- */
function storyHousehold(n = 2) {
  const s = blankState();
  s.lastTick = NOW;
  s.pets = Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: ['Pet 0', 'Pet 1', 'Pet 2'][i], traits: [], needs: { food: 60, fuss: 60, clean: 60 }, stats: { menace: 2 }, bond: 1, cared: 0, handshakes: 0, grudges: 0 }));
  s.pets.forEach((p, i) => { s.slots[i] = p.id; });
  return s;
}
// Walks the open file to its last beat, satisfying each gate the way a player would.
function closeCase(s, style = 'listen', now = NOW) {
  const c = s.stories.case;
  const pick = beat => (style === 'blame' && (beat === 3 || beat === 5)) ? 'blame' : 'listen';
  while (s.stories.case.beat < 6) {
    const beat = s.stories.case.beat;
    if (beat === 1) s.stories.careActions++;
    if (beat === 2 && s.slots[6] !== c.cast[0].id) { const at = s.slots.indexOf(c.cast[0].id); [s.slots[at], s.slots[6]] = [s.slots[6], s.slots[at]]; }
    if (beat === 4) s.stories.handshakes++;
    assert.equal(advanceCase(s, pick(beat), now), true, 'stuck at beat ' + beat + ' of ' + c.kind);
  }
  return s.stories.case;
}

test('nine more weekly case files join the original three, appended after them', () => {
  assert.equal(CASES_EXTRA.length, 9);
  assert.equal(CASES.length, 12);
  assert.deepEqual(CASES.slice(0, 3).map(c => c.id), ['crumb', 'rattle', 'lint'], 'the original three keep their places');
  assert.deepEqual(CASES.slice(3), CASES_EXTRA);
  assert.equal(new Set(CASES.map(c => c.id)).size, 12);
  assert.equal(new Set(CASES.map(c => c.title)).size, 12, 'a title is shared, so archive and scene lookups would collide');
  assert.equal(new Set(CASES.map(c => c.object)).size, 12, 'two files are about the same thing');
});

test('each new case file has six gated beats and two endings that never need a name', () => {
  for (const c of CASES_EXTRA) {
    assert.match(c.id, /^[a-z]+$/, c.id);
    cleanText(c.title, c.id + ' title'); cleanText(c.object, c.id + ' object');
    assert.ok(c.title.length <= 45, c.id + ' title: ' + c.title);
    assert.equal(c.beats.length, 6, c.id);
    c.beats.forEach((beat, i) => {
      cleanText(beat, c.id + ' beat ' + i);
      assert.ok(beat.length >= 100 && beat.length <= 280, c.id + ' beat ' + i + ' is ' + beat.length + ' characters');
      assert.match(beat, SENTENCE, c.id + ' beat ' + i);
      for (const [slot] of beat.matchAll(/\{[^}]*\}/g)) assert.ok(['{p}', '{q}'].includes(slot), c.id + ' beat ' + i + ' uses ' + slot);
    });
    assert.ok(c.beats[0].includes('{p}') || c.beats[0].includes('{q}'), c.id + ' opens without the cast');
    // The gates in engine/stories.js ask for these things, so the copy has to as well.
    assert.match(c.beats[1], /useful care or (?:a|play a) game/, c.id + ' beat 1 must ask for care or a game');
    assert.match(c.beats[2], /Move \{p\} there/, c.id + ' beat 2 must move the witness');
    assert.match(c.beats[2], /\bB1\b/, c.id + ' beat 2 must name B1');
    assert.match(c.beats[4], /a game, or two more useful care actions/, c.id + ' beat 4 must name its gate');
    assert.ok(c.beats[3].includes('{p}') && c.beats[3].includes('{q}'), c.id + ' beat 3 needs two accounts to choose between');
    assert.match(c.beats[5], /Decide /, c.id + ' beat 5 must end on a verdict');
    for (const ending of [c.good, c.messy]) {
      cleanText(ending, c.id + ' ending');
      assert.ok(ending.length >= 90 && ending.length <= 280, c.id + ' ending length ' + ending.length);
      assert.ok(!/[{}]/.test(ending), c.id + ' ending shows no names, so it cannot use a placeholder');
      assert.match(ending, SENTENCE);
    }
    assert.notEqual(c.good, c.messy);
  }
});

test('no beat or ending is repeated across the twelve files', () => {
  const seen = new Map();
  for (const c of CASES) for (const text of [...c.beats, c.good, c.messy]) {
    assert.ok(!seen.has(text), c.id + ' repeats a line from ' + seen.get(text));
    seen.set(text, c.id);
  }
});

test('every new file plays from the first beat to a good or a messy ending, once, with its names filled in', () => {
  for (const c of CASES_EXTRA) {
    for (const lone of [false, true]) {
      const s = storyHousehold(lone ? 1 : 2);
      advanceStories(s, NOW);
      s.stories.case.kind = c.id;
      const names = ['Pet 0', 'Pet 1'];
      for (let beat = 0; beat < 6; beat++) {
        const text = caseText(s);
        assert.ok(!/[{}]/.test(text), c.id + ' beat ' + beat + ' left a placeholder: ' + text);
        assert.ok(text.includes(names[0]) || text.includes(names[1]) || text.includes('The Reflection') || !c.beats[beat].includes('{'), c.id + ' beat ' + beat);
        if (lone && c.beats[beat].includes('{q}')) assert.ok(text.includes('The Reflection'), c.id + ' beat ' + beat + ' on a shelf of one');
        if (beat < 5) {
          if (beat === 1) s.stories.careActions++;
          if (beat === 2) [s.slots[0], s.slots[6]] = [s.slots[6], s.slots[0]];
          if (beat === 4) s.stories.handshakes++;
          assert.equal(advanceCase(s, 'listen', NOW), true, c.id + ' beat ' + beat);
        }
      }
    }
    const kind = c.id;
    // Gentle: five listens and a comfortable resident.
    const warm = storyHousehold(2); advanceStories(warm, NOW); warm.stories.case.kind = kind;
    assert.equal(closeCase(warm, 'listen').outcome, c.good, kind);
    assert.equal(warm.pets[0].bond, 3, kind + ' pays +2 trust once');
    assert.deepEqual(warm.stories.caseTrust, [kind]);
    assert.ok(warm.stories.archive[0].text.startsWith(c.good), kind);
    assert.equal(warm.stories.archive[0].title, c.title);
    assert.ok(lifeState(warm).awards.includes('case:' + kind), kind + ' is recorded as closed');
    // Rushed: two dismissals.
    const rough = storyHousehold(2); advanceStories(rough, NOW); rough.stories.case.kind = kind;
    assert.equal(closeCase(rough, 'blame').outcome, c.messy, kind);
    assert.equal(rough.pets[0].bond, 1);
    assert.equal(rough.pets[0].needs.clean, 72);
  }
});

test('a new file survives a save round trip and its memory replay does not fall over', () => {
  for (const c of CASES_EXTRA) {
    const s = storyHousehold(2); advanceStories(s, NOW); s.stories.case.kind = c.id; s.stories.case.beat = 3;
    const loaded = normalizeState(JSON.parse(JSON.stringify(s)));
    assert.equal(currentCase(loaded).kind, c.id, c.id + ' dropped by the story normalizer');
    assert.equal(currentCase(loaded).definition.title, c.title);
    for (const branch of ['good', 'messy']) {
      const direction = sceneDirection({ kind: 'case', title: c.title, text: c[branch], cast: ['p0', 'p1'], stage: { key: 'case:' + c.id, branch } });
      assert.ok(direction && direction.beats.length >= 3, c.id + ' ' + branch + ' has no replay');
    }
  }
});

test('the weekly rotation reaches the new files before it repeats an old one', () => {
  const week0 = Math.ceil(NOW / WEEK / CASES.length) * CASES.length;   // a week where the plain rotation starts at the first file
  const at = w => w * WEEK + 3 * DAY;
  // A household that has closed the original three meets a new file next, wherever the week lands.
  for (let offset = 0; offset < CASES.length; offset++) {
    const s = storyHousehold(2);
    for (const id of ['crumb', 'rattle', 'lint']) lifeState(s).awards.push('case:' + id);
    advanceStories(s, at(week0 + offset));
    assert.ok(CASES_EXTRA.some(c => c.id === s.stories.case.kind), 'week ' + offset + ' served ' + s.stories.case.kind);
  }
  // A new household plays twelve weeks and sees twelve different files; the thirteenth is the plain rotation.
  const s = storyHousehold(2);
  const seen = [];
  for (let w = 0; w < CASES.length; w++) {
    advanceStories(s, at(week0 + w));
    seen.push(s.stories.case.kind);
    closeCase(s, 'listen', at(week0 + w));
  }
  assert.equal(new Set(seen).size, CASES.length, seen.join(' '));
  advanceStories(s, at(week0 + CASES.length));
  assert.equal(s.stories.case.kind, CASES[0].id, 'with every file closed it is the plain rotation');
  // The plain rotation is what a household with nothing closed gets, so existing weeks keep their file.
  const fresh = storyHousehold(2);
  advanceStories(fresh, at(week0 + 5));
  assert.equal(fresh.stories.case.kind, CASES[5].id);
});

test('Open another file offers the next unseen file in order and tolerates a full archive', () => {
  const s = storyHousehold(2); advanceStories(s, NOW);
  const first = s.stories.case.kind;
  closeCase(s, 'listen');
  assert.equal(startNextCase(s, NOW), true);
  const second = s.stories.case.kind;
  assert.notEqual(second, first);
  assert.equal(CASES.findIndex(c => c.id === second), (CASES.findIndex(c => c.id === first) + 1) % CASES.length, 'the next file in order when it is unseen');
  // Close every file but one by hand: the last one is what is offered.
  const t = storyHousehold(2); advanceStories(t, NOW);
  for (const c of CASES.slice(0, -1)) lifeState(t).awards.push('case:' + c.id);
  t.stories.case.kind = CASES[0].id; closeCase(t, 'listen');
  assert.equal(startNextCase(t, NOW), true);
  assert.equal(t.stories.case.kind, CASES.at(-1).id);
  // Archive and trust records count as closed too, for households whose awards list rolled over.
  const u = storyHousehold(2); advanceStories(u, NOW);
  const s2 = storyState(u);
  s2.caseTrust.push('crumb');
  s2.archive.unshift({ kind: 'case', title: CASES[1].title, text: 'closed', at: NOW });
  assert.equal(pickCaseKind(u, s2, 0), CASES[2].id);
  assert.equal(pickCaseKind(u, s2, -1), CASES[11].id, 'negative starts wrap');
});
