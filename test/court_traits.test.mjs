import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState } from '../src/state.js';
import { TRAITS, TRAIT_BY_ID } from '../src/content/traits.js';
import { COURT_CASES } from '../src/content/court.js';
import { castEpisode, episodeAsk, episodeRule, episodeReceipts, episodeQuestions, episodeCase, COURT_BY_ID } from '../src/engine/court.js';
import {
  PARTY_ROLES, JUROR_ROLES, ROLE_TAG, roleTraits, partyRoles, jurorRoles, favourite, voteJury, describeCast, seatTags, castBriefing, seatOf,
  questionSource, startingRatings, TRUST_BOND, WARM_RATINGS, AFRAID, SLEEP_CHANCE, WHISPER
} from '../src/engine/court-traits.js';
import { seededRandom } from '../src/engine/arcade.js';
import { guestPet } from '../src/cloud/social.js';
import { generateCreature } from '../src/art/creatures.js';

const NOW = new Date(2026, 8, 25, 14, 0, 0).getTime();
// A shelf with exactly the residents given: [name, traits, bond].
function shelf(...residents) {
  const s = blankState();
  s.pets = residents.map(([name, traits = [], bond = 2], i) => ({ id: 'g' + i, name, traits, needs: { food: 50, fuss: 40, clean: 50 }, bond, cared: 0, grudges: 0, born: NOW - 86400000 }));
  s.pets.forEach((p, i) => { s.slots[i] = p.id; });
  return s;
}
const cast = (s, caseId = 'borrowed-coffin', extra = {}, seed = 3) => castEpisode(s, { caseId, plaintiffId: 'g0', defendantId: 'g1', now: NOW, twist: 'base', ...extra }, seededRandom(seed));
const plain = names => shelf(...names.map(n => [n, ['damp'], 2]));

test('ten effects, each tied to real traits, with no trait doing two jobs at one seat', () => {
  assert.equal(PARTY_ROLES.length + JUROR_ROLES.length + 1, 10, 'ten mechanical effects including trust');
  for (const role of [...PARTY_ROLES, ...JUROR_ROLES]) {
    assert.ok(ROLE_TAG[role], role + ' needs a tag');
    assert.ok(roleTraits(role).length >= 4, role + ' covers a handful of traits');
    for (const t of roleTraits(role)) assert.ok(TRAIT_BY_ID[t], role + ' names the unknown trait ' + t);
  }
  assert.ok(ROLE_TAG.trusts);
  const owner = group => { const seen = new Map(); for (const role of group) for (const t of roleTraits(role)) { assert.ok(!seen.has(t), t + ' is in both ' + seen.get(t) + ' and ' + role); seen.set(t, role); } return seen; };
  const party = owner(PARTY_ROLES), juror = owner(JUROR_ROLES);
  assert.ok(new Set([...party.keys(), ...juror.keys()]).size >= 40, 'the roles reach most of the sixty traits');
  assert.ok(TRAITS.length >= 60);
  assert.ok(!party.has('damp') && !juror.has('damp'), 'damp is the neutral trait the old tests use');
});

test('a neutral cast votes exactly as the old formula did', () => {
  for (const seed of [1, 2, 3, 9, 77]) {
    for (const chance of [0.12, 0.4, 0.5, 0.74, 1]) {
      const ep = cast(plain(['Agnes', 'Mort', 'Pip', 'Dot']));
      const old = ep.jury.map(() => seededRandom(seed)()).length && (() => { const r = seededRandom(seed); return ep.jury.map(() => r() < chance); })();
      const now = voteJury(ep, 'plaintiff', chance, seededRandom(seed));
      assert.deepEqual(now.votes, old, 'seed ' + seed + ' chance ' + chance);
      assert.deepEqual(now.notes, []); assert.deepEqual(now.absent, []);
    }
  }
  assert.equal(startingRatings(cast(plain(['A', 'B', 'C']))), 50);
  assert.deepEqual(describeCast(cast(plain(['A', 'B', 'C']))), []);
});

test('receipts: a party who keeps them hands over one free clue, and the question is spent not asked', () => {
  const ep = cast(shelf(['Agnes', ['witness']], ['Mort', ['damp']], ['Pip', ['damp']], ['Dot', ['damp']]));
  assert.deepEqual(partyRoles(ep).receipts, ['p']);
  const given = episodeReceipts(ep, seededRandom(1));
  assert.equal(given.length, 1);
  assert.equal(given[0].side, 'p');
  assert.ok(given[0].lines.some(l => l.s === 'p'), 'the party speaks');
  assert.ok(given[0].lines.every(l => !/\{[a-z]+\}/.test(l.t)));
  const k = episodeCase(ep);
  const spent = ep.spent[0];
  assert.ok(k.questions[spent].clue, 'the free clue comes from a clue question');
  assert.deepEqual(ep.clues, [given[0].clue]);
  assert.equal(ep.asked.length, 0, 'it does not use up a question');
  assert.equal(episodeAsk(ep, spent, seededRandom(1)), null, 'and the question cannot be asked again');
  assert.equal(episodeQuestions(ep).find(q => q.index === spent).asked, true);
  assert.equal(ep.notes[0].shaky, false);
  // Both parties keeping receipts gives two; a household without them gives none.
  const two = cast(shelf(['Agnes', ['auditor']], ['Mort', ['hoarder']], ['Pip']));
  assert.equal(episodeReceipts(two, seededRandom(1)).length, 2);
  assert.deepEqual(episodeReceipts(cast(plain(['A', 'B', 'C']))), []);
  // A friend’s resident keeps receipts too.
  const mabel = guestPet({ id: 'x1', name: 'Mabel', traits: ['witness'], mood: 'fine', bond: 3, art: { creature: generateCreature({ seed: 'mabel' }) } });
  const visit = castEpisode(plain(['A', 'B', 'C']), { caseId: 'borrowed-coffin', defendantId: 'g1', guest: { side: 'p', pet: mabel }, now: NOW, twist: 'base' }, seededRandom(2));
  assert.deepEqual(partyRoles(visit).receipts, ['p']);
  assert.equal(episodeReceipts(visit, seededRandom(1)).length, 1);
});

test('exaggerates: a clue from an exaggerator is unconfirmed and earns no respect until checked', () => {
  const k = COURT_BY_ID['borrowed-coffin'];
  assert.equal(questionSource(k.questions[0]), 'd', 'Keith came from the defendant’s answers');
  assert.equal(questionSource(k.questions[1]), 'p');
  assert.equal(questionSource({ lines: { alt: [[['judge', 'x']]] } }), null, 'nobody at the podium, nobody to blame');
  const ep = cast(shelf(['Agnes', ['damp']], ['Mort', ['terminal']], ['Pip'], ['Dot']), 'borrowed-coffin', {}, 5);
  assert.deepEqual(partyRoles(ep).exaggerates, ['d']);
  ep.plan.order = [0, 1, 2, 3, 4, 5];
  const respect = ep.respect;
  const fromMort = episodeAsk(ep, 0, seededRandom(1));
  assert.equal(fromMort.note.shaky, true);
  assert.equal(fromMort.perks[0].id, 'exaggerates');
  assert.equal(ep.respect, respect, 'the jury does not respect an unchecked note');
  const fromAgnes = episodeAsk(ep, 1, seededRandom(1));
  assert.equal(fromAgnes.note.shaky, false);
  assert.equal(ep.respect, respect + 6);
});

test('showman: a theatrical party doubles what a zinger does for the ratings', () => {
  const dull = cast(plain(['Agnes', 'Mort', 'Pip']), 'borrowed-coffin', {}, 4), loud = cast(shelf(['Agnes', ['theatrical']], ['Mort', ['damp']], ['Pip']), 'borrowed-coffin', {}, 4);
  const a = episodeAsk(dull, 2, seededRandom(1)), b = episodeAsk(loud, 2, seededRandom(1));
  assert.deepEqual(a.perks, []);
  assert.equal(b.perks[0].id, 'showman');
  assert.equal(loud.ratings - 50, 2 * (dull.ratings - 50));
  const plainQuestion = episodeAsk(loud, 4, seededRandom(1));
  assert.deepEqual(plainQuestion.perks, [], 'only zingers');
});

test('crowd favourite: the audience starts warm, once per favourite', () => {
  assert.equal(cast(shelf(['A', ['sugar']], ['B', ['damp']], ['C'])).ratings, 50 + WARM_RATINGS);
  assert.equal(cast(shelf(['A', ['sugar']], ['B', ['glitter']], ['C'])).ratings, 50 + WARM_RATINGS, 'glitter is a showman, not a favourite');
  assert.equal(cast(shelf(['A', ['sugar']], ['B', ['porcelain']], ['C'])).ratings, 50 + 2 * WARM_RATINGS);
  assert.equal(cast(shelf(['A', ['socialite']], ['B', ['clean']], ['C'])).ratings, 50 + 2 * WARM_RATINGS);
  assert.equal(cast(shelf(['A', ['damp']], ['B', ['damp']], ['C', ['sugar']])).ratings, 50, 'a juror’s charm does not count');
});

test('intimidating: the jury is less likely to rule against a frightening party, and no less likely to rule for them', () => {
  const scary = cast(shelf(['Agnes', ['damp']], ['Mort', ['feral']], ['Pip'], ['Dot']));
  const calm = cast(plain(['Agnes', 'Mort', 'Pip', 'Dot']));
  const half = () => 0.5;
  const against = ruling => voteJury(scary, ruling, 0.55, half).votes.filter(Boolean).length;
  assert.equal(voteJury(calm, 'plaintiff', 0.55, half).votes.filter(Boolean).length, 6, 'a calm cast follows a 55% chance on a 50% roll');
  assert.equal(against('plaintiff'), 0, 'ruling against the feral defendant: each juror drops under the roll');
  assert.equal(against('defendant'), 6, 'ruling for them is unchanged');
  assert.equal(against('both'), 0);
  assert.ok(AFRAID > 0 && AFRAID <= 0.1);
});

test('spiteful: a juror with a quarrel votes to hurt the one it has fallen out with, whatever the dice say', () => {
  const s = shelf(['Agnes'], ['Mort'], ['Pip', ['spiteful']], ['Dot']);
  s.friction = { 'g0|g2': { n: 3, at: NOW } };
  const ep = cast(s);
  const at = ep.jury.findIndex(j => j.id === 'g2');
  assert.deepEqual(ep.cast.jury[at].dislikes, ['p']);
  assert.deepEqual(jurorRoles(ep, at), ['spiteful']);
  const always = () => 0, never = () => 0.999;
  const hurt = voteJury(ep, 'defendant', 0.5, always), spared = voteJury(ep, 'plaintiff', 0.5, never);
  assert.equal(hurt.votes[at], true, 'the ruling hurts Agnes: Pip agrees even against a roll that says no');
  assert.equal(spared.votes[at], false, 'the ruling spares Agnes: Pip refuses even on a roll that says yes');
  assert.ok(hurt.notes.some(n => n.seat === at && n.role === 'spiteful' && /Agnes/.test(n.text)));
  assert.equal(voteJury(ep, 'both', 0.5, never).votes[at], true, 'both idiots hurts everyone');
  // No quarrel, no effect: the trait sits dormant.
  const calm = cast(shelf(['Agnes'], ['Mort'], ['Pip', ['spiteful']], ['Dot']));
  assert.deepEqual(jurorRoles(calm, calm.jury.findIndex(j => j.id === 'g2')), []);
  // A feud between traits is a quarrel too; and an old quarrel has faded.
  const feud = shelf(['Agnes', ['spiteful']], ['Mort'], ['Pip', ['spiteful']], ['Dot']);
  assert.ok(cast(feud).cast.jury.every(seat => Array.isArray(seat.dislikes)));
  const faded = shelf(['Agnes'], ['Mort'], ['Pip', ['spiteful']], ['Dot']);
  faded.friction = { 'g0|g2': { n: 3, at: NOW - 5 * 86400000 } };
  assert.deepEqual(cast(faded).cast.jury.find((_, i) => faded.pets.length && cast(faded).jury[i].id === 'g2').dislikes, []);
});

test('loyal: a juror backs the party you are clearly fondest of', () => {
  const s = shelf(['Agnes', [], 12], ['Mort', [], 4], ['Pip', ['clingy']], ['Dot']);
  const ep = cast(s);
  assert.equal(favourite(ep), 'p');
  const at = ep.jury.findIndex(j => j.id === 'g2');
  assert.deepEqual(jurorRoles(ep, at), ['loyal']);
  assert.equal(voteJury(ep, 'plaintiff', 0, () => 0.999).votes[at], true, 'for Agnes, whatever the chance');
  assert.equal(voteJury(ep, 'defendant', 1, () => 0).votes[at], false, 'against Agnes, even at certainty');
  assert.equal(voteJury(ep, 'both', 1, () => 0).votes[at], false);
  const close = cast(shelf(['Agnes', [], 6], ['Mort', [], 5], ['Pip', ['clingy']], ['Dot']));
  assert.equal(favourite(close), null, 'a gap of one is not a favourite');
  assert.deepEqual(jurorRoles(close, close.jury.findIndex(j => j.id === 'g2')), []);
});

test('sleepy: a juror may doze through the vote and is counted absent', () => {
  const ep = cast(shelf(['Agnes'], ['Mort'], ['Pip', ['nocturnal']], ['Dot']));
  const at = ep.jury.findIndex(j => j.id === 'g2');
  assert.deepEqual(jurorRoles(ep, at), ['sleepy']);
  const rolls = [];
  const r = seededRandom(8);
  const out = voteJury(ep, 'plaintiff', 1, () => { const v = r(); rolls.push(v); return v; });
  assert.equal(rolls.length, ep.jury.length + 1, 'a sleepy juror costs exactly one more roll');
  const asleep = out.absent.includes(at);
  assert.equal(asleep, rolls[at + 1] < SLEEP_CHANCE);
  let dozed = 0, trials = 400;
  for (let i = 0; i < trials; i++) if (voteJury(ep, 'plaintiff', 1, seededRandom(i + 1)).absent.includes(at)) dozed++;
  assert.ok(Math.abs(dozed / trials - SLEEP_CHANCE) < 0.08, 'about two in five (' + dozed + ' of ' + trials + ')');
  const dozing = [...Array(60).keys()].map(i => voteJury(ep, 'plaintiff', 1, seededRandom(i + 1))).find(v => v.absent.length);
  assert.equal(dozing.votes[dozing.absent[0]], false);
  assert.ok(dozing.notes.some(n => n.role === 'sleepy'));
});

test('gossip: the juror beside a gossip tends to vote the way the gossip did', () => {
  const ep = cast(shelf(['Agnes'], ['Mort'], ['Pip', ['gossip']], ['Dot'], ['Eve'], ['Fay']));
  const at = ep.jury.findIndex(j => j.id === 'g2');
  assert.ok(at >= 0 && at < ep.jury.length - 1);
  // Rolls are scripted by seat: everyone rolls 0.5 unless told otherwise.
  const script = (over = {}) => { let n = -1; return () => { n++; return over[n] ?? 0.5; }; };
  const none = voteJury(ep, 'plaintiff', 0.52, script());
  assert.equal(none.votes[at + 1], true, 'a 0.5 roll against 52% is a yes, with nothing in the way');
  // The gossip votes no (roll 0.9): the next juror, who would have said yes, is pulled below the line.
  const down = voteJury(ep, 'plaintiff', 0.52, script({ [at]: 0.9 }));
  assert.equal(down.votes[at], false);
  assert.equal(down.votes[at + 1], false, '0.52 less the whisper is 0.37, under a 0.5 roll');
  assert.ok(down.notes.some(n => n.role === 'gossip' && n.seat === at + 1), 'and the seat is named');
  assert.equal(down.votes[at + 2], true, 'the whisper goes one seat and no further');
  // The gossip votes yes: the next juror, who would have said no, is pulled up.
  const up = voteJury(ep, 'plaintiff', 0.4, script({ [at]: 0.1, [at + 1]: 0.5 }));
  assert.equal(up.votes[at], true);
  assert.equal(up.votes[at + 1], true, '0.4 plus the whisper is 0.55, over a 0.5 roll');
  assert.equal(up.votes[at + 2], false);
  assert.equal(WHISPER, 0.15);
});

test('trust: a juror who is fond of you leans your way, and only just', () => {
  const ep = cast(shelf(['Agnes'], ['Mort'], ['Pip', [], TRUST_BOND], ['Dot', [], 20], ['Eve', [], 9]));
  const seats = id => ep.jury.findIndex(j => j.id === id);
  assert.deepEqual(jurorRoles(ep, seats('g2')), ['trusts']);
  assert.deepEqual(jurorRoles(ep, seats('g4')), []);
  const edge = voteJury(ep, 'plaintiff', 0.5, () => 0.54);
  assert.equal(edge.votes[seats('g2')], true, 'a 5 point lean at bond 10');
  assert.equal(edge.votes[seats('g3')], true);
  assert.equal(edge.votes[seats('g4')], false, 'bond 9 gets no lean');
  const deep = voteJury(ep, 'plaintiff', 0.5, () => 0.57);
  assert.equal(deep.votes[seats('g2')], false); assert.equal(deep.votes[seats('g3')], true, 'devotion at bond 20 leans eight points');
});

test('the cast explains itself: tags for each seat, a line for each effect, and a short briefing', () => {
  const s = shelf(['Agnes', ['theatrical', 'witness']], ['Mort', ['feral', 'terminal']], ['Pip', ['clingy'], 6], ['Dot', ['nocturnal'], 12], ['Eve', ['gossip']]);
  s.pets[0].bond = 14;
  const ep = cast(s);
  const lines = describeCast(ep);
  assert.ok(lines.length >= 5);
  for (const line of lines) assert.ok(line.text.length > 20 && !/[\u2013\u2014]/.test(line.text) && line.tag, JSON.stringify(line));
  assert.deepEqual(seatTags(ep, 'p').map(t => t.role).sort(), ['receipts', 'showman']);
  assert.deepEqual(seatTags(ep, 'd').map(t => t.role).sort(), ['exaggerates', 'intimidating']);
  const dot = ep.jury.findIndex(j => j.id === 'g3');
  assert.ok(seatTags(ep, dot).some(t => t.role === 'sleepy'));
  const brief = castBriefing(ep);
  assert.equal(brief.length, 3);
  assert.match(brief[0], /Agnes keeps receipts/);
  assert.equal(castBriefing(ep, 10).length, lines.length);
  assert.ok(castBriefing(ep, 10).some(t => /trusts? you/.test(t)));
  assert.deepEqual(seatOf({ traits: ['nope', 'damp'], bond: 99 }), { traits: ['damp'], bond: 25, dislikes: [] });
});

test('every case still plays with a cast full of traits, and the stars still add up', () => {
  const traits = ['witness', 'terminal', 'theatrical', 'sugar', 'feral', 'spiteful', 'clingy', 'nocturnal', 'gossip'];
  for (const k of COURT_CASES) {
    const s = shelf(...Array.from({ length: 6 }, (_, i) => ['R' + i, [traits[i], traits[(i + 3) % traits.length]], 3 + i * 4]));
    s.friction = { 'g0|g2': { n: 4, at: NOW }, 'g1|g3': { n: 4, at: NOW } };
    const ep = cast(s, k.id, {}, k.id.length);
    const rnd = seededRandom(k.id.length);
    episodeReceipts(ep, rnd);
    for (const q of episodeQuestions(ep).filter(x => !x.asked).slice(0, 3)) {
      const r = episodeAsk(ep, q.index, rnd);
      assert.ok(r.lines.length);
    }
    const result = episodeRule(ep, k.truth, rnd);
    assert.equal(result.correct, true);
    assert.equal(result.stars, (result.correct ? 1 : 0) + (ep.ratings >= 70 ? 1 : 0) + (result.agree >= 5 ? 1 : 0));
    assert.equal(result.votes.length, 6);
    for (const line of [...result.jury, ...result.ruling]) assert.ok(!/\{[a-z]+\}|undefined/.test(line.t), line.t);
  }
});
