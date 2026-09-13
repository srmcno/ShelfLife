import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { ESCAPADES } from '../src/content/escapades.js';
import { blankEscapades, normalizeEscapades, recordEscapadeEvent } from '../src/escapade-state.js';
import { escapadeView, startEscapade, finishEscapade } from '../src/engine/escapades.js';
import { careFor, doRounds } from '../src/engine/care.js';
import { newHandshake, tapHandshake, handshakePattern, rewardHandshake } from '../src/engine/play.js';
import { newChase, updateChase } from '../src/engine/chase.js';
import { newAlibi, answerAlibi, advanceAlibi, currentRound, rewardAlibi } from '../src/engine/alibi.js';
import { newCourt, accuseCourt } from '../src/engine/court.js';
import { lifeState, awardDiscovery, startOuting, chooseOuting, startMarket, marketSnapshot, chooseMarket, leaveMarket, claimMarket } from '../src/engine/life.js';

const now = new Date(2026, 8, 1, 12).getTime();
function fixture(count = 1) {
  const state = blankState(); state.lastTick = now;
  state.pets = Array.from({ length: count }, (_, i) => ({ id: 'pet-' + i, name: ['Mabel', 'Pip', 'Oswald', 'Tilly'][i] || 'Friend ' + i,
    traits: [], needs: { food: 60, fuss: 60, clean: 60 }, stats: { cute: 5, menace: 5, damp: 5, mystique: 5 }, bond: 0, cared: 0, art: {} }));
  state.pets.forEach((pet, i) => { state.slots[i] = pet.id; });
  return state;
}
function start(state, activity = 'memory', petId = state.pets[0].id, at = now) {
  const episode = ESCAPADES.find(item => item.approaches.some(path => path.activity === activity));
  const approach = episode.approaches.find(path => path.activity === activity);
  assert.equal(startEscapade(state, { episodeId: episode.id, approachId: approach.id, petId }, at), true);
  return episode;
}
function finishMemory(state, pet = state.pets[0], at = now) {
  const game = newHandshake(pet, () => .2);
  while (!game.complete) for (const tap of handshakePattern(game)) tapHandshake(game, tap);
  return { game, reward: rewardHandshake(state, game, at) };
}
function finishEmptyMarket(state, at = now) {
  while (marketSnapshot(state).step < marketSnapshot(state).stalls.length) assert.equal(chooseMarket(state, null), true);
  if (marketSnapshot(state).version >= 3) assert.equal(leaveMarket(state), true);
  return claimMarket(state, at);
}
function progress(state, at = now) {
  const active = escapadeView(state, at).active;
  assert.equal(recordEscapadeEvent(state, { kind: 'care', petIds: [active.petId], need: active.episode.care.need }, at), true);
  assert.equal(recordEscapadeEvent(state, { kind: 'play', petIds: [active.petId], activity: active.approach.activity }, at), true);
}

test('old saves get an empty adventure journal without reconstructed rewards or history', () => {
  const state = fixture(); delete state.escapades;
  const history = shelf => ({ xp: shelf.life.xp, awards: shelf.life.awards, scenes: shelf.life.scenes, notes: shelf.notes });
  const before = history(state);
  const loaded = normalizeState(state);
  assert.deepEqual(loaded.escapades, blankEscapades());
  assert.deepEqual(history(loaded), before);
});

test('adventure views are pure and invitations reject unknown actors, paths, and overlapping stories', () => {
  const state = fixture(), before = JSON.stringify(state), episode = ESCAPADES[0];
  assert.equal(escapadeView(state, now).total, 16);
  assert.equal(JSON.stringify(state), before);
  for (const changes of [{ episodeId: '__proto__' }, { approachId: 'missing' }, { petId: 'gone' }]) {
    assert.equal(startEscapade(state, { episodeId: episode.id, approachId: episode.approaches[0].id, petId: state.pets[0].id, ...changes }, now), false);
  }
  start(state);
  assert.equal(startEscapade(state, { episodeId: episode.id, approachId: episode.approaches[0].id, petId: state.pets[0].id }, now), false);
  assert.equal(finishEscapade(state, 'unknown', now), null);
  assert.equal(state.life.xp, 0);
});

test('only the accepted resident, requested personal moment and chosen activity advance objectives', () => {
  const state = fixture(2), episode = start(state), id = state.pets[0].id;
  for (const event of [
    { kind: 'care', petIds: ['pet-1'], need: episode.care.need },
    { kind: 'care', petIds: [id], need: ['food', 'clean'].find(need => need !== episode.care.need) },
    { kind: 'play', petIds: [id], activity: 'chase' },
    { kind: 'launch', petIds: [id], activity: 'memory' },
    { kind: 'play', petIds: id, activity: 'memory' }
  ]) assert.equal(recordEscapadeEvent(state, event, now), false);
  assert.equal(recordEscapadeEvent(state, { kind: 'play', petIds: [id], activity: 'memory' }, now - 1), false);
  assert.equal(escapadeView(state, now).active.completedSteps, 0);
  assert.equal(recordEscapadeEvent(state, { kind: 'play', petIds: [id], activity: 'memory' }, now), true);
  assert.equal(recordEscapadeEvent(state, { kind: 'play', petIds: [id], activity: 'memory' }, now), false);
  assert.equal(escapadeView(state, now).active.completedSteps, 1);
});

for (const asleep of [false, true]) test('personal care counts at full comfort without waiting' + (asleep ? ', including sleeping residents' : ''), () => {
  const state = fixture(), pet = state.pets[0], episode = start(state);
  pet.traits = asleep ? ['nocturnal'] : [];
  pet.needs[episode.care.need] = 100;
  assert.equal(careFor(state, pet, episode.care.need, now).gain, 0);
  assert.equal(escapadeView(state, now).active.careDone, true);
  assert.equal(pet.bond, 0);
});

test('household rounds and unused game setup never substitute for a personal moment or a finished activity', () => {
  const state = fixture(), episode = start(state);
  doRounds(state, now);
  assert.equal(rewardHandshake(state, newHandshake(state.pets[0]), now), null);
  assert.equal(escapadeView(state, now).active.completedSteps, 0);
  assert.equal(finishEscapade(state, episode.endings[0].id, now), null);
});

for (const activityFirst of [true, false]) test('objectives survive reload in either order and wait for an explicit finale: ' + activityFirst, () => {
  let state = fixture(); const episode = start(state);
  const care = () => careFor(state, state.pets[0], episode.care.need, now);
  const play = () => finishMemory(state);
  (activityFirst ? play : care)();
  state = normalizeState(state);
  assert.equal(escapadeView(state, now).active.completedSteps, 1);
  (activityFirst ? care : play)();
  const before = { xp: state.life.xp, notes: state.notes.length, scenes: state.life.scenes.length };
  state = normalizeState(state);
  assert.equal(escapadeView(state, now).active.ready, true);
  assert.equal(state.life.xp, before.xp);
  const result = finishEscapade(state, episode.endings[0].id, now);
  assert.equal(result.discoveries, 2); assert.equal(result.fresh, true);
  assert.equal(state.life.xp, before.xp + 2);
  assert.equal(state.notes.length, before.notes + 1);
  assert.equal(state.life.scenes.length, before.scenes + 1);
  assert.equal(result.record.petName, 'Mabel'); assert.ok(result.text.includes('Mabel'));
  assert.equal(escapadeView(state, now).active, null);
  assert.equal(finishEscapade(state, episode.endings[0].id, now), null);
});

test('replayed endings cannot mint discoveries even after the rolling award ledger forgets them', () => {
  const state = fixture(), episode = start(state); progress(state);
  const first = finishEscapade(state, episode.endings[0].id, now);
  for (let i = 0; i < 190; i++) awardDiscovery(state, 'test:' + i, 1, now);
  assert.equal(state.life.awards.includes('escapade:' + first.record.key), false);
  const before = state.life.xp;
  state.pets[0].name = 'Renamed'; start(state, 'memory', state.pets[0].id, now + 1); progress(state, now + 1);
  const replay = finishEscapade(state, episode.endings[0].id, now + 1);
  assert.equal(replay.fresh, false); assert.equal(replay.discoveries, 0); assert.equal(state.life.xp, before);
  assert.equal(state.escapades.completions, 2); assert.equal(state.escapades.album.length, 1);
  assert.equal(replay.record.petName, 'Mabel'); assert.ok(replay.text.includes('Renamed'));
});

test('resident names are literal text in final scenes and album callbacks', () => {
  const state = fixture(); state.pets[0].name = 'Dear $& <friend>';
  const episode = start(state); progress(state);
  const result = finishEscapade(state, episode.endings[0].id, now);
  assert.ok(result.text.includes('Dear $& <friend>'));
  assert.ok(result.callback.includes('Dear $& <friend>'));
  assert.equal(result.text.includes('{name}'), false);
});

test('all sixteen authored endings can be collected with a bounded chronological album and no time gates', () => {
  const state = fixture(); let at = now;
  for (const episode of ESCAPADES) for (const ending of episode.endings) {
    at += 60000;
    assert.equal(startEscapade(state, { episodeId: episode.id, approachId: episode.approaches[0].id, petId: state.pets[0].id }, at), true);
    progress(state, at);
    assert.equal(finishEscapade(state, ending.id, at).discoveries, 2);
  }
  const view = escapadeView(state, at);
  assert.equal(view.completed, 16); assert.equal(state.life.xp, 32);
  assert.equal(new Set(view.album.map(item => item.keepsake)).size, 16);
  assert.ok(view.album.every((item, i) => !i || item.at >= view.album[i - 1].at));
  assert.ok(view.episodes.every(item => item.complete));
  assert.equal(normalizeState(state).escapades.album.length, 16);
});

test('no absence expires an accepted adventure or awards an unfinished one', () => {
  const state = fixture(); start(state); const future = now + 365 * 86400000;
  assert.equal(escapadeView(state, future).active.completedSteps, 0);
  assert.equal(state.life.xp, 0);
  assert.equal(recordEscapadeEvent(state, { kind: 'play', petIds: ['pet-0'], activity: 'memory' }, future), true);
  assert.equal(escapadeView(state, future).active.playDone, true);
});

test('rehoming the active resident retires that invitation while completed names remain in the album', () => {
  const state = fixture(2), episode = start(state); progress(state); finishEscapade(state, episode.endings[0].id, now);
  start(state); state.pets.shift();
  const before = JSON.stringify(state.escapades);
  assert.equal(escapadeView(state, now).active, null); assert.equal(JSON.stringify(state.escapades), before);
  assert.equal(escapadeView(state, now).album[0].petName, 'Mabel');
  assert.equal(startEscapade(state, { episodeId: episode.id, approachId: episode.approaches[0].id, petId: 'pet-1' }, now), true);
  const loaded = normalizeState(state);
  assert.equal(loaded.escapades.active.petId, 'pet-1'); assert.equal(loaded.escapades.album[0].petId, 'pet-0');
});

test('malformed imports are whitelisted, progress cannot predate acceptance, and receipts never execute rewards', () => {
  const state = fixture(), episode = start(state), active = state.escapades.active;
  active.careAt = now - 1; active.playAt = Date.now() + 100000; active.ready = true; active.reward = 999;
  const receipt = { episodeId: episode.id, approachId: episode.approaches[0].id, endingId: episode.endings[0].id, petId: 'departed', petName: 'Old\nFriend', at: now, reward: 999 };
  state.escapades.album = [receipt, receipt, { ...receipt, endingId: 'unknown' }, { ...receipt, petId: '__proto__' }];
  state.escapades.completions = Infinity;
  const loaded = normalizeState(state);
  assert.deepEqual(Object.keys(loaded.escapades.active).sort(), ['episodeId', 'approachId', 'petId', 'petName', 'startedAt', 'careAt', 'playAt'].sort());
  assert.equal(loaded.escapades.active.careAt, null); assert.equal(loaded.escapades.active.playAt, null);
  assert.equal(loaded.escapades.album.length, 1); assert.equal(loaded.escapades.album[0].petName, 'Old Friend');
  assert.equal(loaded.escapades.album[0].reward, undefined); assert.equal(loaded.escapades.completions, 1);
  assert.equal(loaded.life.xp, 0); assert.equal(loaded.notes.length, 0);
  for (const value of [null, [], 3, { active: [] }, { album: {} }, { active: { ...active, petId: 'gone' } }]) {
    assert.equal(normalizeEscapades(value, state, now).active, null);
  }
});

test('finished practice handshakes advance without changing existing trust and duplicate-claim rules', () => {
  const state = fixture(), pet = state.pets[0]; finishMemory(state);
  const before = pet.bond; start(state);
  const { game, reward } = finishMemory(state);
  assert.equal(reward.practice, true); assert.equal(pet.bond, before); assert.equal(pet.handshakes, 2);
  assert.equal(escapadeView(state, now).active.playDone, true);
  assert.equal(rewardHandshake(state, game, now), null);
});

test('a losing finished Chase advances the adventure without becoming a win or granting trust', () => {
  const state = fixture(), episode = start(state, 'chase'), game = newChase(state.pets[0], { seed: 1 });
  assert.equal(rewardHandshake(state, game, now), null);
  assert.equal(escapadeView(state, now).active.playDone, false);
  while (!game.finished) updateChase(game, { axis: -1 }, .25);
  assert.equal(game.complete, false);
  assert.equal(rewardHandshake(state, game, now), null);
  assert.equal(escapadeView(state, now).active.playDone, true);
  assert.equal(state.pets[0].chases || 0, 0); assert.equal(state.pets[0].bond, 0); assert.equal(state.life.xp, 0);
  careFor(state, state.pets[0], episode.care.need, now); finishEscapade(state, episode.endings[0].id, now);
  start(state, 'chase'); rewardHandshake(state, game, now);
  assert.equal(escapadeView(state, now).active.playDone, false);
});

test('an imperfect Alibi finishes the objective while preserving its honest loss and practice rewards', () => {
  const state = fixture(), pet = state.pets[0]; pet.traits = ['nocturnal']; start(state, 'alibi');
  const game = newAlibi(state, pet, () => .2);
  assert.equal(rewardAlibi(state, game, now), null);
  while (!game.complete) { const round = currentRound(game); answerAlibi(game, (round.lie + 1) % round.statements.length); advanceAlibi(game); }
  const result = rewardAlibi(state, game, now);
  assert.equal(result.clean, false); assert.equal(result.practice, true);
  assert.equal(escapadeView(state, now).active.playDone, true);
  assert.equal(pet.alibiWins || 0, 0); assert.equal(pet.bond, 0);
});

test('Shelf Court reports the actual host only and counts a final imperfect legacy verdict', () => {
  const state = fixture(2); start(state, 'court', 'pet-1');
  let game = newCourt(state, () => .2);
  accuseCourt(state, game, (game.answer + 1) % game.suspects.length, now);
  assert.equal(escapadeView(state, now).active.playDone, false);
  state.pets.reverse(); game = newCourt(state, () => .2);
  assert.equal(accuseCourt(state, game, (game.answer + 1) % game.suspects.length, now).correct, false);
  assert.equal(escapadeView(state, now).active.playDone, true); assert.equal(state.life.courtWins, 0);
});

test('an expedition advances only at return and only for its real crew', () => {
  const state = fixture(3); start(state, 'outing', 'pet-2');
  assert.equal(startOuting(state, 'drawer', 'thread', ['pet-0', 'pet-1']), true);
  chooseOuting(state, 0, now); chooseOuting(state, 0, now); chooseOuting(state, 0, now);
  assert.equal(escapadeView(state, now).active.playDone, false);
  state.life.outing = null;
  assert.equal(startOuting(state, 'drawer', 'thread', ['pet-1', 'pet-2']), true);
  chooseOuting(state, 0, now); chooseOuting(state, 0, now);
  assert.equal(escapadeView(state, now).active.playDone, false);
  assert.equal(chooseOuting(state, 0, now).complete, true);
  assert.equal(escapadeView(state, now).active.playDone, true);
});

test('Night Market includes a selected fourth resident and credits all actual current patrons at claim', () => {
  const state = fixture(4); start(state, 'market', 'pet-3');
  assert.equal(startMarket(state, { errands: true, petId: 'pet-3' }), true);
  assert.deepEqual(state.life.market.patronIds, ['pet-3', 'pet-0', 'pet-1']);
  assert.deepEqual(state.life.market.patrons, ['Tilly', 'Mabel', 'Pip']);
  assert.equal(escapadeView(state, now).active.playDone, false);
  const result = finishEmptyMarket(state);
  assert.equal(result.score.fulfilled.filter(Boolean).length, 0);
  assert.equal(escapadeView(state, now).active.playDone, true);
  const before = state.life.xp; assert.equal(claimMarket(state, now), null); assert.equal(state.life.xp, before);
  assert.equal(startMarket(state, { replay: true, errands: true, petId: 'pet-2' }), true);
  assert.deepEqual(state.life.market.patronIds, ['pet-3', 'pet-0', 'pet-1']);
});

test('market saves without participant identities never assign an adventure to a matching display name', () => {
  for (const version of [1, 3]) {
    const state = fixture(); start(state, 'market');
    startMarket(state, { errands: version === 3 });
    if (version === 3) { state.life.market.version = 3; delete state.life.market.patronIds; }
    finishEmptyMarket(state);
    assert.equal(escapadeView(state, now).active.playDone, false);
  }
});

test('a rehomed market patron cannot transfer credit to a replacement with the same name', () => {
  const state = fixture(2); startMarket(state, { errands: true });
  state.pets[0] = { ...state.pets[0], id: 'replacement' };
  start(state, 'market', 'replacement'); finishEmptyMarket(state);
  assert.equal(escapadeView(state, now).active.playDone, false);
});
