import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { householdFixture } from './household-fixtures.mjs';
import { mayhemState } from '../src/mayhem-state.js';
import { lifeState } from '../src/engine/life.js';
import { ensureChores, accrueMayhem, drawOmen, COFFIN_COST } from '../src/engine/mayhem.js';
import { courtroomState } from '../src/court-state.js';
import { arcadeState } from '../src/arcade-state.js';
import { docketToday } from '../src/engine/court.js';
import { challengeToday } from '../src/engine/arcade.js';
import { ensureGuide, guideOf } from '../src/engine/guide.js';
import { nextStep, nextSteps, normalizeExtra, PRIORITY } from '../src/engine/nextstep.js';
import { localDayKey } from '../src/state.js';

const noon = new Date(2026, 8, 12, 12).getTime();
const ids = list => list.map(step => step.id);

// A settled household: nothing pending, so each test adds exactly the thing it checks.
function settled(count = 2) {
  const s = householdFixture('established', noon);
  s.pets = s.pets.slice(0, count); s.slots = s.slots.map(id => (s.pets.some(p => p.id === id) ? id : null));
  s.pets.forEach(p => { p.needs = { food: 90, fuss: 90, clean: 90 }; });
  const m = mayhemState(s);
  m.omen = { day: localDayKey(noon), id: 'wet-hand', streak: 3, lastDay: localDayKey(noon), grace: 1 };
  m.nextAt = noon + 600000;
  courtroomState(s).docketDay = localDayKey(noon);
  const ch = challengeToday(s, noon); arcadeState(s).daily = { day: ch.day, game: ch.game, mod: ch.mod.id, best: 0, plays: 0, claimed: true };
  s.life.welcome = { petId: s.pets[0].id, dismissed: true };
  lifeState(s); // settle the raw fixture's life record once, so later reads change nothing
  return s;
}
// Two cards waiting, as a brand new tray starts, and the next arrival far off.
const withTrouble = (s, now = noon) => { const m = mayhemState(s); m.nextAt = 0; accrueMayhem(s, now); m.nextAt = now + 600000; return m; };
const choresToday = (s, list) => { mayhemState(s).chores = { day: localDayKey(noon), list, bonus: false }; };

test('with nothing to do, the shelf suggests a little time together', () => {
  const s = settled();
  const step = nextStep(s, noon);
  assert.equal(step.id, 'play');
  assert.equal(step.action.type, 'event');
  assert.equal(step.action.name, 'shelflife:arcade');
  assert.equal(nextStep(blankState(), noon), null, 'no residents, nothing to recommend');
});

test('the order: guide, emergency, coffin, chore, need, omen, housewarming, docket, challenge, extras, play', () => {
  const s = settled();
  const m = mayhemState(s);
  s.life.welcome = null; s.life.introDone = false; // the housewarming invitation is open
  m.omen = { day: '', id: '', streak: 0, lastDay: '', grace: 1 };
  courtroomState(s).docketDay = '';
  arcadeState(s).daily = null;
  choresToday(s, [{ id: 'rounds', have: 0, done: false }, { id: 'feed', have: 2, done: false }, { id: 'wash', have: 0, done: false }]);
  s.pets[0].needs.fuss = 10;
  m.souls = COFFIN_COST;
  withTrouble(s); // fills the tray
  const extras = [{ id: 'gift', label: 'A gift is waiting', hint: 'Collect it.', priority: 250 }];
  assert.deepEqual(ids(nextSteps(s, noon, extras)), ['emergency', 'coffin', 'chore:rounds', 'need:' + s.pets[0].id, 'omen', 'welcome', 'docket', 'challenge', 'extra:gift', 'play']);
  // Take them away one at a time and the next in line steps up.
  m.queue = []; assert.equal(nextStep(s, noon, extras).id, 'coffin');
  m.souls = 0; assert.equal(nextStep(s, noon, extras).id, 'chore:rounds');
  choresToday(s, []); assert.equal(nextStep(s, noon, extras).id, 'need:' + s.pets[0].id);
  s.pets[0].needs.fuss = 90; assert.equal(nextStep(s, noon, extras).id, 'omen');
  drawOmen(s, noon); choresToday(s, [{ id: 'feed', have: 0, done: false }]); // drawing the omen also deals the day's chores
  assert.equal(nextStep(s, noon, extras).id, 'welcome');
  s.life.welcome = { petId: s.pets[0].id, dismissed: true }; assert.equal(nextStep(s, noon, extras).id, 'docket');
  courtroomState(s).docketDay = localDayKey(noon); assert.equal(nextStep(s, noon, extras).id, 'challenge');
  const ch = challengeToday(s, noon); arcadeState(s).daily = { day: ch.day, game: ch.game, mod: ch.mod.id, best: 0, plays: 0, claimed: true };
  assert.equal(nextStep(s, noon, extras).id, 'extra:gift');
  assert.equal(nextStep(s, noon, []).id, 'play');
});

test('the first-session guide outranks everything, even a pile of emergencies', () => {
  const s = normalizeState(JSON.parse(JSON.stringify(Object.assign(blankState(), {
    started: noon, lastTick: noon, pets: [{ id: 'p0', name: 'Mabel', traits: [], bond: 0, born: noon, needs: { food: 58, fuss: 54, clean: 66 }, art: { body: '', stamps: [] } }], slots: ['p0', ...Array(17).fill(null)] }))));
  ensureGuide(s, noon);
  accrueMayhem(s, noon);
  assert.equal(mayhemState(s).queue.length, 2);
  const step = nextStep(s, noon);
  assert.equal(step.id, 'guide:meet');
  assert.equal(step.kind, 'guide');
  assert.equal(step.priority, PRIORITY.guide);
  assert.deepEqual(step.guide, { number: 1, total: 6, count: 0, step: 'meet', petId: 'p0' });
  assert.equal(nextSteps(s, noon)[1].id, 'emergency', 'the emergency is next in line');
  guideOf(s).status = 'skipped';
  assert.equal(nextStep(s, noon).id, 'emergency', 'a skipped tour gives way to the real thing');
});

test('the guide knows when its step cannot be done yet', () => {
  const s = normalizeState(JSON.parse(JSON.stringify(Object.assign(blankState(), {
    started: noon, lastTick: noon, pets: [{ id: 'p0', name: 'Mabel', traits: [], bond: 0, born: noon, needs: { food: 58, fuss: 54, clean: 66 }, art: { body: '', stamps: [] } }], slots: ['p0', ...Array(17).fill(null)] }))));
  const g = ensureGuide(s, noon);
  g.seen = ['meet', 'note']; g.done = ['meet', 'feed', 'emergency', 'omen', 'note'];
  const short = nextStep(s, noon);
  assert.equal(short.id, 'guide:coffin');
  assert.match(short.hint, /costs 40 souls and you have 0/);
  assert.equal(short.action.mh, 'quiet', 'nothing to resolve, so the drawer');
  accrueMayhem(s, noon);
  assert.equal(nextStep(s, noon).action.mh, 'emergency', 'with trouble waiting, earn the souls there');
  mayhemState(s).souls = COFFIN_COST;
  const ready = nextStep(s, noon);
  assert.deepEqual([ready.verb, ready.action], ['Open it', { type: 'guide', step: 'coffin' }]);
});

test('a pending emergency names itself and counts the pile', () => {
  const s = settled();
  const m = withTrouble(s);
  const step = nextStep(s, noon);
  assert.equal(step.kind, 'emergency');
  assert.match(step.label, /^2 things have gone wrong/);
  assert.ok(step.hint.length > 10, 'the hint is the first card’s title');
  assert.deepEqual(step.action, { type: 'mh', mh: 'emergency' });
  m.queue.length = 1;
  assert.match(nextStep(s, noon).label, /^Something has gone wrong/);
});

test('a player saving for special orders is not nagged to open a coffin first', () => {
  const s = settled();
  const m = mayhemState(s);
  m.souls = COFFIN_COST;
  assert.equal(nextStep(s, noon).id, 'coffin');
  m.souls = COFFIN_COST * 3;
  courtroomState(s).docketDay = ''; arcadeState(s).daily = null;
  const list = ids(nextSteps(s, noon));
  assert.ok(list.indexOf('coffin') > list.indexOf('challenge'), 'rich players see the day’s errands first: ' + list);
  assert.equal(nextSteps(s, noon).find(x => x.id === 'coffin').priority, PRIORITY.challenge - 50);
});

test('a chore is recommended only when exactly one action finishes it and that action is possible now', () => {
  const s = settled();
  choresToday(s, [{ id: 'rounds', have: 0, done: false }, { id: 'check', have: 0, done: false }, { id: 'feed', have: 1, done: false }]);
  assert.equal(nextSteps(s, noon).some(x => x.kind === 'chore'), true, 'rounds and check are each one action from done');
  assert.deepEqual(nextSteps(s, noon).filter(x => x.kind === 'chore').map(x => [x.id, x.action.selector]), [['chore:rounds', '#roundsBtn']]);
  s.lastRounds = noon - 1000;
  assert.equal(nextSteps(s, noon).filter(x => x.kind === 'chore')[0].id, 'chore:check', 'rounds are cooling down, so the next chore');
  s.lastCheck = noon - 1000;
  assert.equal(nextSteps(s, noon).some(x => x.kind === 'chore'), false, 'both on cooldown, and the feeding is two away');
  choresToday(s, [{ id: 'feed', have: 2, done: false }, { id: 'care5', have: 4, done: false }, { id: 'wash', have: 1, done: false }]);
  s.pets[1].needs.food = 20;
  const feed = nextSteps(s, noon).filter(x => x.kind === 'chore');
  assert.equal(feed[0].id, 'chore:feed');
  assert.deepEqual(feed[0].action, { type: 'care', petId: s.pets[1].id });
  assert.match(feed[0].verb, new RegExp('Feed ' + s.pets[1].name));
  choresToday(s, [{ id: 'feed', have: 3, done: true }, { id: 'fuss', have: 3, done: true }, { id: 'wash', have: 2, done: true }]);
  assert.equal(nextSteps(s, noon).some(x => x.kind === 'chore'), false, 'finished chores are not recommended');
  mayhemState(s).chores = { day: 'yesterday', list: [{ id: 'rounds', have: 0, done: false }], bonus: false };
  assert.equal(nextSteps(s, noon).some(x => x.kind === 'chore'), false, 'yesterday’s chores are not today’s');
});

test('a resident properly in need outranks tonight’s omen, but a mild need does not', () => {
  const s = settled();
  mayhemState(s).omen = { day: '', id: '', streak: 0, lastDay: '', grace: 1 };
  s.pets[0].needs.clean = 55;
  assert.equal(nextStep(s, noon).id, 'omen');
  s.pets[0].needs.clean = 12;
  const step = nextStep(s, noon);
  assert.equal(step.kind, 'need');
  assert.match(step.label, /grubby/);
  assert.deepEqual(step.action, { type: 'care', petId: s.pets[0].id });
});

test('today’s docket and challenge disappear once they are done', () => {
  const s = settled();
  courtroomState(s).docketDay = '';
  arcadeState(s).daily = null;
  const list = nextSteps(s, noon);
  const docket = list.find(x => x.id === 'docket'), challenge = list.find(x => x.id === 'challenge');
  assert.ok(docket && challenge);
  assert.match(docket.hint, /\+20 souls/);
  assert.match(challenge.hint, /\+25 souls/);
  assert.equal(docket.action.name, 'shelflife:court');
  assert.equal(challenge.action.detail.game, challengeToday(s, noon).game);
  assert.equal(docketToday(s, noon).done, false);
  courtroomState(s).docketDay = localDayKey(noon);
  assert.equal(nextSteps(s, noon).some(x => x.id === 'docket'), false);
});

test('extras are accepted in their agreed shape, ranked by priority and made safe', () => {
  const s = settled();
  const fake = [
    { id: 'daily-gift', label: 'Your daily gift is waiting', hint: 'It will not wait forever.', tab: 'plots', priority: 950 },
    { id: 'low', label: 'A small errand', priority: 1 },
    { id: 'no-priority', label: 'Defaults sit between the challenge and play' },
    { id: 'bad id!', label: 'dropped for its id' }, { id: 'nolabel', label: '   ' }, null, 'text', { label: 'no id' },
    { id: 'evt', label: 'Opens something', event: 'shelflife:court', priority: 260, verb: 'Look' },
    { id: 'evil', label: 'x'.repeat(500), hint: 'y'.repeat(500), tab: 'nowhere', priority: 'high' }
  ];
  const list = nextSteps(s, noon, fake);
  assert.deepEqual(ids(list).filter(id => id.startsWith('extra:')), ['extra:daily-gift', 'extra:evt', 'extra:no-priority', 'extra:evil', 'extra:low']);
  const gift = list.find(x => x.id === 'extra:daily-gift');
  assert.deepEqual([gift.kind, gift.tab, gift.priority, gift.verb], ['extra', 'plots', 950, 'Go']);
  assert.deepEqual(gift.action, { type: 'goto', tab: 'plots' });
  assert.equal(list[0].id, 'extra:daily-gift', 'a high priority beats the whole built-in list while nothing is urgent');
  const evil = list.find(x => x.id === 'extra:evil');
  assert.equal(evil.label.length, 80);
  assert.equal(evil.hint.length, 160);
  assert.equal(evil.tab, 'shelf');
  assert.equal(evil.priority, PRIORITY.extra);
  assert.deepEqual(list.find(x => x.id === 'extra:evt').action, { type: 'event', name: 'shelflife:court', detail: {} });
  assert.equal(normalizeExtra({ id: 'e', label: 'x', event: 'javascript:alert(1)' }).action.type, 'goto', 'only game events are accepted');
  assert.equal(normalizeExtra({ id: 'e', label: 'x', target: '#paneNotes' }).action.target, '#paneNotes');
  assert.equal(nextSteps(s, noon, 'not a list').length > 0, true, 'a malformed list is ignored');
});

test('an urgent real thing still beats a high-priority extra only when it is urgent enough', () => {
  const s = settled();
  withTrouble(s);
  assert.equal(nextStep(s, noon, [{ id: 'a', label: 'A', priority: 950 }]).id, 'extra:a', 'an extra can choose to outrank an emergency');
  assert.equal(nextStep(s, noon, [{ id: 'a', label: 'A', priority: 850 }]).id, 'emergency');
});

test('recommending is read-only and repeatable', () => {
  const s = settled();
  withTrouble(s);
  const frozen = JSON.stringify(s);
  const first = nextSteps(s, noon, [{ id: 'x', label: 'X' }]);
  assert.equal(JSON.stringify(s), frozen);
  assert.deepEqual(nextSteps(s, noon, [{ id: 'x', label: 'X' }]), first);
  assert.equal(lifeState(s).guide, null);
  ensureChores; // chores are created by the desk, not by asking what to do
});

test('every recommendation is a complete step with a verb and no banned punctuation', () => {
  const s = settled();
  s.life.welcome = null; s.life.introDone = false;
  courtroomState(s).docketDay = ''; arcadeState(s).daily = null;
  withTrouble(s);
  s.pets[0].needs.food = 5;
  mayhemState(s).souls = 500;
  choresToday(s, [{ id: 'rounds', have: 0, done: false }, { id: 'check', have: 0, done: false }, { id: 'wash', have: 1, done: false }]);
  for (const step of nextSteps(s, noon, [{ id: 'x', label: 'X', hint: 'Y' }])) {
    assert.ok(step.id && step.kind && step.label && step.verb && step.action?.type, step.id + ' is complete');
    assert.ok(Number.isFinite(step.priority));
    assert.doesNotMatch(step.label + step.hint + step.verb, /[–—]/, step.id + ' avoids em and en dashes');
    assert.ok(step.label.length <= 80 && step.hint.length <= 170, step.id + ' fits a phone card');
  }
});
