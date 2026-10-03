import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { createCloud } from '../src/cloud/client.js';
import { createSocial, readCase, readInbox, guestPet } from '../src/cloud/social.js';
import { generateCreature } from '../src/art/creatures.js';
import { createFakeSupabase } from './support/fake-supabase.mjs';
import { castEpisode, episodeRule, courtFinish, slotVerdict, COURT_BY_ID } from '../src/engine/court.js';
import { seededRandom } from '../src/engine/arcade.js';

/* A sender chooses which side their resident takes. The server is not asked
   to change: the side rides inside the plaintiff object it already accepts, and
   an older client that ignores it simply plays the sender's resident as the plaintiff. */
const T0 = Date.UTC(2026, 8, 29, 12);
function memory() {
  const items = new Map();
  return { getItem: k => items.has(k) ? items.get(k) : null, setItem: (k, v) => { items.set(k, String(v)); }, removeItem: k => { items.delete(k); } };
}
function household(names) {
  const s = blankState();
  s.pets = names.map((name, i) => ({ id: 'p' + i, name, traits: ['damp'], needs: { food: 80, fuss: 80, clean: 80 }, bond: 3, art: { body: '', stamps: [], creature: generateCreature({ seed: 'c' + i }) } }));
  s.pets.forEach((p, i) => { s.slots[i] = p.id; });
  return normalizeState(s);
}
async function player(fake, name, shelf) {
  const cloud = createCloud({ config: fake.config, fetch: fake.fetch, storage: memory(), now: () => T0 });
  await cloud.signInAnonymously();
  const social = createSocial({ cloud, getState: () => shelf, now: () => T0 });
  social.optIn();
  await social.setName(name);
  const me = await social.profile();
  return { social, shelf, id: cloud.userId(), code: me.code };
}

test('the side a sender chooses travels in the plaintiff object and is read back, and only 1 of 2 values is ever trusted', async () => {
  const fake = createFakeSupabase({ now: () => T0 });
  const ada = await player(fake, 'Ada', household(['Mabel', 'Gladys']));
  const bea = await player(fake, 'Bea', household(['Pip', 'Snag']));
  await ada.social.addFriend(bea.code);
  await bea.social.respond(ada.id, true);
  await bea.social.publish({ force: true });
  const [pip] = (await ada.social.shelf(bea.id)).shelf.residents;
  await ada.social.serve({ to: bea.id, caseId: 'borrowed-coffin', plaintiff: ada.shelf.pets[0], defendant: pip });
  await ada.social.serve({ to: bea.id, caseId: 'tontine', plaintiff: ada.shelf.pets[0], defendant: pip, side: 'd' });
  await ada.social.serve({ to: bea.id, caseId: 'snoring-wall', plaintiff: ada.shelf.pets[0], defendant: pip, side: 'nonsense' });
  const stored = [...fake.social.summons.values()];
  assert.equal(stored[0].plaintiff.side, undefined, 'the usual summons is exactly what it always was');
  assert.equal(stored[1].plaintiff.side, 'd');
  assert.equal(stored[2].plaintiff.side, undefined, 'an unknown side is the usual one');
  const { cases } = await bea.social.inbox();
  const bySide = Object.fromEntries(cases.map(c => [c.caseId, c.side]));
  assert.deepEqual(bySide, { 'borrowed-coffin': 'p', tontine: 'd', 'snoring-wall': 'p' });
  assert.equal(cases.find(c => c.caseId === 'tontine').plaintiff.name, 'Mabel', 'the sender’s resident is still the one that travels');
});

test('hostile side values never reach the court', () => {
  const base = { id: '00000000-0000-4000-8000-000000000001', from_user: '00000000-0000-4000-8000-000000000002', case_id: 'tontine', from_name: 'Ada',
    defendant: { id: 'p1', name: 'Pip' } };
  const read = side => readCase({ ...base, plaintiff: { id: 'p0', name: 'Mabel', ...(side === undefined ? {} : { side }) } })?.side;
  assert.equal(read(undefined), 'p'); assert.equal(read('d'), 'd'); assert.equal(read('p'), 'p');
  for (const bad of ['D', 'defendant', 1, null, {}, ['d'], '__proto__']) assert.equal(read(bad), 'p', JSON.stringify(bad));
  assert.deepEqual(readInbox({ cases: [{ ...base, plaintiff: { id: 'p0', name: 'Mabel', side: 'd' } }], results: [] }).cases.map(c => c.side), ['d']);
});

test('a visitor who is the defendant is seated at the defendant’s podium and the home resident sues', () => {
  const s = household(['Agnes', 'Mort', 'Pip']);
  const mabel = guestPet({ id: 'g1', name: 'Mabel', traits: ['spiteful'], mood: 'fine', bond: 3, art: { creature: generateCreature({ seed: 'mabel' }) } });
  const ep = castEpisode(s, { caseId: 'tontine', plaintiffId: 'p2', guest: { side: 'd', pet: mabel } }, seededRandom(2));
  assert.deepEqual([ep.p.kind, ep.p.name, ep.d.kind, ep.d.name, ep.guest], ['pet', 'Pip', 'guest', 'Mabel', 'd']);
  assert.ok(!ep.jury.some(j => j.id === 'p2'), 'the home resident does not also sit on the jury');
  assert.equal(ep.cast.d.traits[0], 'spiteful', 'the visitor’s traits come with them');
  episodeRule(ep, COURT_BY_ID.tontine.truth, seededRandom(3));
  const res = courtFinish(s, ep, T0);
  assert.equal(res.guest, true);
  assert.equal(s.courtroom.episodes, 0);
});

test('the verdict goes back in the server’s terms: the sender’s resident is always the plaintiff slot', () => {
  for (const ruling of ['plaintiff', 'defendant', 'both']) assert.equal(slotVerdict('p', ruling), ruling, 'a visiting plaintiff changes nothing');
  assert.equal(slotVerdict('d', 'plaintiff'), 'defendant', 'the home resident sued and won, so the visitor lost');
  assert.equal(slotVerdict('d', 'defendant'), 'plaintiff', 'the visiting defendant won');
  assert.equal(slotVerdict('d', 'both'), 'both');
});
