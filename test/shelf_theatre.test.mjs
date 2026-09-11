import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState } from '../src/state.js';
import { SHELF_SCENES, SHELF_SCENE_VARIANTS } from '../src/content/shelf-theatre.js';
import { normalizeTheatre } from '../src/theatre-state.js';
import { availableShelfScenes, performShelfScene, sceneAvailability, toggleLamp, lampIsOn,
  SHELF_SCENE_INTERVAL, SHELF_ENCORE_INTERVAL, SHELF_SCENE_CARE_INTERVAL } from '../src/engine/shelf-theatre.js';
import { feudPairKey } from '../src/engine/achievements.js';

const NOW = new Date(2026, 8, 10, 12).getTime();
const random = () => 0;
const pet = (id, traits = [], needs = {}) => ({ id, name: id, traits, needs: { food: 60, fuss: 60, clean: 60, ...needs },
  art: { body: '', stamps: [] }, stats: { cute: 5, menace: 5, damp: 5, mystique: 5 }, bond: 3, cared: 1, grudges: 0 });
function shelf(people, props = [], layout = null) {
  const state = blankState(); state.pets = people; state.props = props;
  (layout || [...people.map(p => p.id), ...props.map(p => p.id)]).forEach((id, i) => { state.slots[i] = id; });
  return state;
}
const perform = (state, kind, at = NOW, extra = {}) => performShelfScene(state, { kind, manual: true, ...extra }, at, random);

test('all eight scene families have authored unique variants and real actions', () => {
  assert.equal(SHELF_SCENES.length, 8);
  const variants = SHELF_SCENES.flatMap(scene => scene.variants);
  assert.ok(variants.length >= 24);
  assert.equal(new Set(variants.map(v => v.id)).size, variants.length);
  for (const family of SHELF_SCENES) {
    assert.ok(family.variants.length >= 3); assert.equal(typeof family.requirements, 'string');
    for (const variant of family.variants) {
      assert.ok(variant.lines.length >= 2); assert.ok(variant.lines.every(line => [0, 1].includes(line.actor)));
      assert.ok(['bath','lamp','dance','tug','mirror','meal','phone','comfort','argument','makeup'].includes(variant.action));
    }
  }
});

test('scene candidates use actual awake residents within the same row and preserve source state', () => {
  const state = shelf([pet('A', ['damp']), pet('B'), pet('Sleeper', ['nocturnal'])], [{ id: 't', kind: 'tub' }], ['A', 't', 'B', null, null, 'Sleeper']);
  const before = JSON.stringify(state), candidates = availableShelfScenes(state, NOW);
  assert.equal(JSON.stringify(state), before, 'availability is read-only');
  assert.ok(candidates.some(scene => scene.kind === 'bath' && scene.actorIds.length === 2));
  assert.ok(candidates.every(scene => !scene.actorIds.includes('Sleeper')));
  state.slots = Array(18).fill(null); state.slots[5] = 't'; state.slots[6] = 'A'; state.slots[8] = 'B';
  assert.equal(availableShelfScenes(state, NOW, { propId: 't' }).length, 0, 'adjacent indices do not wrap into the next row');
  assert.equal(availableShelfScenes(state, NOW, { petId: 'Sleeper' }).length, 0);
  state.slots[5] = null;
  assert.equal(availableShelfScenes(state, NOW, { propId: 't' }).length, 0, 'put-away furniture cannot host scenes');
});

test('baths splash an actual witness, clip real care gains, and cannot grind trust or attention', () => {
  const a = pet('Bather', ['damp'], { clean: 98 }), b = pet('Witness', ['clean'], { clean: 30 });
  const state = shelf([a, b], [{ id: 't', kind: 'tub' }], ['Bather', 't', 'Witness']);
  const before = state.life.xp, event = perform(state, 'bath', NOW, { petId: 'Bather' });
  assert.equal(event.action, 'bath'); assert.equal(event.actorIds.length, 2);
  assert.ok(event.lines.every(line => event.actorIds.includes(line.actorId)));
  assert.ok(event.summary.includes('Bather') && event.summary.includes('Witness'));
  assert.equal(event.rewards.length, 2);
  assert.ok(event.rewards.every(reward => reward.need === 'clean' && reward.gain > 0 && reward.gain <= 6));
  assert.equal(a.needs.clean, 100);
  assert.deepEqual([a.bond, b.bond, a.cared, b.cared, state.life.xp], [3, 3, 1, 1, before]);
  const second = perform(state, 'bath', NOW + SHELF_ENCORE_INTERVAL);
  assert.ok(second); assert.deepEqual(second.rewards, []);
  assert.notEqual(second.variant, event.variant, 'same cast gets another authored ending');
});

test('manual and autonomous pacing share a clock and repeat care waits twenty minutes across scene families', () => {
  const a = pet('A', ['damp', 'socialite']), b = pet('B');
  const state = shelf([a,b], [{ id: 't', kind: 'tub' }], ['A','t','B']);
  assert.ok(perform(state, 'bath'));
  assert.equal(perform(state, 'pair', NOW + SHELF_ENCORE_INTERVAL - 1), null);
  assert.match(sceneAvailability(state, { manual: true }, NOW + 1000), /7 seconds/);
  assert.ok(perform(state, 'pair', NOW + SHELF_ENCORE_INTERVAL));
  assert.deepEqual(state.theatre.careAt, { A: NOW, B: NOW });
  assert.equal(performShelfScene(state, {}, NOW + SHELF_ENCORE_INTERVAL + SHELF_SCENE_INTERVAL - 1, random), null);
  assert.ok(performShelfScene(state, {}, NOW + SHELF_ENCORE_INTERVAL + SHELF_SCENE_INTERVAL, random));
  assert.deepEqual(perform(state, 'bath', NOW + SHELF_SCENE_CARE_INTERVAL - 1).rewards, []);
  assert.ok(perform(state, 'bath', NOW + SHELF_SCENE_CARE_INTERVAL + SHELF_ENCORE_INTERVAL).rewards.length);
});

test('lamp choices persist as booleans and disagreement ends with the second actor’s actual preference', () => {
  const state = shelf([pet('Shade', ['haunted']), pet('Light', ['clingy'])], [{ id: 'l', kind: 'lamp' }], ['Shade','l','Light']);
  assert.equal(lampIsOn(state, 'l'), true);
  const first = perform(state, 'lamp');
  assert.deepEqual(first.actorIds, ['Shade','Light']);
  assert.equal(first.before.lit, true); assert.equal(first.after.lit, true);
  assert.equal(state.theatre.lamps.l, true); assert.equal(first.variant, 'lamp:dispute-on');
  assert.equal(toggleLamp(state, 'l', NOW + 1), false, 'a direct switch responds immediately without rewards');
  assert.equal(toggleLamp(state, 'l', NOW + 2), true, 'two quick clicks restore the original state');
  assert.equal(toggleLamp(state, 'l', NOW + SHELF_ENCORE_INTERVAL), false);
  assert.equal(lampIsOn(state, 'l'), false);
  const next = perform(state, 'lamp', NOW + SHELF_ENCORE_INTERVAL * 2);
  assert.equal(next.before.lit, false); assert.equal(next.after.lit, true);
  const normalized = normalizeTheatre(JSON.parse(JSON.stringify(state.theatre)), state, NOW + SHELF_ENCORE_INTERVAL * 2);
  assert.equal(normalized.lamps.l, true);
  assert.equal(toggleLamp(state, 'missing', NOW + 60000), null);
});

test('solo lamps honor shade preferences and explain why a settled light has no scene', () => {
  const state = shelf([pet('Shade', ['haunted'])], [{id:'l',kind:'lamp'}]);
  const event = perform(state, 'lamp');
  assert.equal(event.after.lit, false); assert.equal(event.actorIds.length, 1);
  assert.equal(perform(state, 'lamp', NOW + SHELF_ENCORE_INTERVAL), null);
  assert.match(sceneAvailability(state, { kind:'lamp',manual:true }, NOW + SHELF_ENCORE_INTERVAL), /already have the light/);
});

test('each furniture scene has a suitable cast and produces only actor-bound rewards', () => {
  const cases = [['musicbox','socialite','dance'], ['yarn','feral','tug'], ['mirror','narcissist','mirror'], ['phone','gossip','phone'], ['bowl','sugar','meal']];
  for (const [kind, trait, action] of cases) {
    const state = shelf([pet('A',[trait]), pet('B')], [{id:'p',kind}], ['A','p','B']);
    const event = perform(state, kind);
    assert.ok(event, kind); assert.equal(event.action, action);
    assert.ok(event.rewards.every(reward => event.actorIds.includes(reward.petId)));
    assert.ok(event.lines.every(line => event.actorIds.includes(line.actorId)));
  }
  const unsupported = shelf([pet('A')], [{id:'p',kind:'musicbox'}]);
  assert.equal(perform(unsupported, 'musicbox'), null);
  assert.match(sceneAvailability(unsupported, {kind:'musicbox'}), /Two awake/);
});

test('the bowl shares real serving and refill state; an empty-bowl scene cannot invent food', () => {
  const a = pet('A',['sugar'],{food:20}), state = shelf([a], [{id:'b',kind:'bowl'}]);
  assert.equal(perform(state, 'bowl').rewards[0].gain, 5);
  perform(state, 'bowl', NOW + SHELF_SCENE_CARE_INTERVAL);
  assert.ok(state.behavior.props.b.emptyUntil > NOW + SHELF_SCENE_CARE_INTERVAL);
  const empty = perform(state, 'bowl', NOW + SHELF_SCENE_CARE_INTERVAL * 2);
  assert.equal(empty.variant, 'bowl:empty'); assert.deepEqual(empty.rewards, []); assert.equal(a.needs.food, 30);
  const again = perform(state, 'bowl', state.behavior.props.b.emptyUntil);
  assert.ok(again.rewards.length); assert.equal(a.needs.food, 35);
});

test('pair arcs follow mood changes without creating or clearing actual feuds', () => {
  const a = pet('A',[],{food:25,fuss:20,clean:25}), b = pet('B');
  const state = shelf([a,b]);
  assert.equal(perform(state, 'pair').action, 'argument');
  assert.deepEqual(state.feudArcs, {}); assert.equal(state.friction?.['A|B'], undefined);
  a.needs = {food:70,fuss:60,clean:70};
  const makeup = perform(state, 'pair', NOW + SHELF_ENCORE_INTERVAL);
  assert.equal(makeup.action, 'makeup'); assert.equal(state.theatre.pairs['A|B'].last, 'makeup');
  assert.equal(perform(state, 'pair', NOW + SHELF_ENCORE_INTERVAL * 2).action, 'comfort');
  const feud = shelf([pet('Actor',['theatrical']),pet('Manager',['management'])]);
  const key = feudPairKey('Actor','Manager'); feud.feudArcs[key] = {level:2,truce:false};
  assert.equal(perform(feud,'pair').action,'argument');
  assert.deepEqual(feud.feudArcs[key],{level:2,truce:false});
  assert.equal(perform(feud,'pair',NOW + SHELF_ENCORE_INTERVAL).action,'argument','a scene does not reset an actual feud');
  const solitary = shelf([pet('Private',['cryptid']),pet('Guest')]);
  assert.equal(perform(solitary,'pair'),null,'untrusted company does not disregard an explicit solitude preference');
});

test('manual encores collect variants without flooding notes or growing history unboundedly', () => {
  const state = shelf([pet('A',['damp']),pet('B')], [{id:'t',kind:'tub'}], ['A','t','B']);
  const variants = new Set();
  for (let i=0;i<25;i++) {
    const event = perform(state,'bath',NOW+i*SHELF_ENCORE_INTERVAL);
    assert.ok(event); variants.add(event.variant);
  }
  assert.equal(variants.size,2); assert.equal(state.theatre.recent.length,12);
  assert.equal(state.theatre.seen.length,2); assert.equal(state.theatre.serial,25);
  assert.equal(state.notes.length,1,'new performances within the note gap remain in theatre history only');
});

test('theatre saves reject stale references and malformed data while keeping the collection and cooldowns', () => {
  const state = shelf([pet('A',['haunted']),pet('B',['clingy'])], [{id:'l',kind:'lamp'}], ['A','l','B']);
  perform(state,'lamp');
  const original = JSON.stringify(state.theatre);
  state.theatre = normalizeTheatre(JSON.parse(original),state,NOW);
  assert.deepEqual(perform(state,'lamp',NOW+SHELF_ENCORE_INTERVAL).rewards,[],'save round-trip cannot repay care');
  const bad = { ...state.theatre, serial:Infinity, lastAt:Infinity, lastNoteAt:-2,
    lamps: JSON.parse('{"l":false,"missing":true,"__proto__":false}'),
    careAt:{A:NOW+999999,B:-1,missing:NOW}, pairs:{bad:{actorIds:['A','missing'],last:'argument',at:NOW}},
    seen:['lamp:off','lamp:off','unknown','__proto__',['lamp:off'],['lamp:off'],{toString:null}],
    recent:[{variant:'__proto__'},{variant:['lamp:off']},{variant:{toString:null}},...state.theatre.recent] };
  const before = JSON.stringify(bad), clean = normalizeTheatre(bad,state,NOW);
  assert.equal(JSON.stringify(bad),before,'normalization never mutates uploaded data');
  assert.deepEqual(clean.lamps,{l:false}); assert.deepEqual(clean.seen,['lamp:off']);
  assert.deepEqual(clean.careAt,{A:NOW,B:0}); assert.deepEqual(clean.pairs,{});
  assert.equal(clean.serial,0); assert.equal(clean.lastAt,0); assert.equal(clean.lastNoteAt,0);
  assert.ok(clean.recent.every(scene => Object.hasOwn(SHELF_SCENE_VARIANTS,scene.variant)));
  const oneActor = normalizeTheatre(clean,{...state,pets:state.pets.slice(0,1)},NOW);
  assert.deepEqual(oneActor.recent,[],'a two-person performance cannot retain a missing speaker');
  state.pets=[]; state.props=[];
  const empty = normalizeTheatre(clean,state,NOW);
  assert.deepEqual(empty.recent,[]); assert.deepEqual(empty.careAt,{}); assert.deepEqual(empty.lamps,{});
  assert.deepEqual(empty.seen,['lamp:off'],'observed scene collection outlives the actors');
});

test('malformed requested scene kinds cannot coerce into a catalog key or start another scene', () => {
  const state = shelf([pet('A',['haunted'])], [{id:'l',kind:'lamp'}]);
  const before = JSON.stringify(state);
  for (const kind of [['lamp'], {toString:null}, {}, 0, false, '']) {
    assert.match(sceneAvailability(state,{kind},NOW), /not in this collection/);
    assert.equal(performShelfScene(state,{kind,manual:true},NOW,random),null);
  }
  assert.equal(JSON.stringify(state),before);
});

test('a preselected visible cast is exact and ordered, with no substitute actors or invalid-input mutation', () => {
  const setup = () => shelf([pet('A',['damp']),pet('B'),pet('C',[],{clean:10})], [{id:'t',kind:'tub'}], ['A','t','B','C']);
  const state = setup();
  assert.ok(availableShelfScenes(state,NOW).some(scene => scene.kind === 'bath' && scene.actorIds.join('|') === 'B|C'));
  const requested = ['B','C'];
  const event = perform(state,'bath',NOW,{propId:'t',actorIds:requested});
  assert.deepEqual(event.actorIds,requested,'the random selection cannot switch to the first A/B candidate');
  assert.deepEqual(requested,['B','C'],'the supplied cast is not changed');
  assert.equal(state.pets[0].needs.clean,60,'an unselected resident receives no effect');
  const untouched = setup(), before = JSON.stringify(untouched);
  for (const actorIds of [[],['A'],['A','C'],['B','A'],['A','A'],['A','B','C'],['A','missing'],['A',1],['A',{}],null,'A']) {
    assert.equal(perform(untouched,'bath',NOW,{propId:'t',actorIds}),null);
    assert.equal(JSON.stringify(untouched),before,'a rejected cast does not alter care, notes, collection or timers');
  }
  const solo = shelf([pet('Solo',['damp'])],[{id:'t',kind:'tub'}]);
  assert.deepEqual(perform(solo,'bath',NOW,{actorIds:['Solo']}).actorIds,['Solo']);
});
