import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRAITS, TRAIT_BY_ID } from '../src/content/traits.js';
import { createPersonalityDraft, normalizePersonalityDraft, resolvePersonality, creationCareRates, ORIGIN_LIMIT } from '../src/engine/creation.js';
import { decayRate } from '../src/engine/tick.js';
import { generateCreature, customizeCreature } from '../src/art/creatures.js';
import { remixCreature } from '../src/art/studio-model.js';

test('seeded personalities expose two or three distinct valid quirks before saving', () => {
  const sizes = new Set();
  const combinations = new Set();
  for (let seed = 0; seed < 200; seed++) {
    const draft = createPersonalityDraft(seed);
    assert.deepEqual(createPersonalityDraft(seed), draft);
    assert.ok(draft.traits.length === 2 || draft.traits.length === 3);
    assert.equal(new Set(draft.traits).size, draft.traits.length);
    assert.ok(draft.traits.every(id => Object.hasOwn(TRAIT_BY_ID, id)));
    sizes.add(draft.traits.length); combinations.add(draft.traits.join(','));
  }
  assert.deepEqual(sizes, new Set([2, 3]));
  assert.ok(combinations.size > 150, 'new residents offer varied personalities');
});

test('normalization repairs incomplete drafts deterministically without mutating the source', () => {
  const source = { seed: -1, traits: ['damp', 'damp', 'not-a-trait', '__proto__', 'clean', 'sugar', 'spiteful'], origin: '  Found\nunder a cup.\u0000  ' };
  const before = structuredClone(source);
  const normalized = normalizePersonalityDraft(source);
  assert.deepEqual(normalized, { seed: 4294967295, traits: ['damp', 'clean', 'sugar'], origin: 'Found under a cup.' });
  assert.deepEqual(source, before);
  assert.deepEqual(normalizePersonalityDraft(normalized), normalized);
  assert.notEqual(normalized.traits, source.traits);
  for (const value of [null, undefined, {}, { seed: NaN }, { seed: Infinity, traits: [null, {}, 'constructor'] }]) {
    const result = normalizePersonalityDraft(value);
    assert.equal(result.traits.length, 2);
    assert.equal(new Set(result.traits).size, 2);
    assert.ok(result.traits.every(id => Object.hasOwn(TRAIT_BY_ID, id)));
    assert.deepEqual(normalizePersonalityDraft(value), result);
    assert.equal(typeof resolvePersonality(value).bio, 'string');
  }
});

test('preview and saved personality have identical stats and introduction after appearance edits', () => {
  const draft = { ...createPersonalityDraft(91), origin: 'Escaped the sock drawer. Has keys.' };
  const preview = resolvePersonality(draft);
  let art = generateCreature({ seed: 'first-look' });
  art = customizeCreature(art, { tune: { eyeScale: 1.3 }, colors: { body: '#993355' } });
  art = remixCreature(art, ['body'], 'another-look');
  assert.ok(art.parts);
  assert.deepEqual(resolvePersonality(normalizePersonalityDraft(draft)), preview);
  assert.equal(preview.bio, draft.origin);
  assert.notEqual(preview.traits, draft.traits);
  const saved = JSON.parse(JSON.stringify(normalizePersonalityDraft(draft)));
  assert.deepEqual(resolvePersonality(saved), preview);
});

test('changing a quirk changes only its stat contributions, with final bounds applied', () => {
  const before = resolvePersonality({ seed: 18, traits: ['loadbearing', 'magpie'] });
  const after = resolvePersonality({ seed: 18, traits: ['loadbearing', 'magpie', 'sugar'] });
  assert.equal(after.stats.cute, Math.min(10, before.stats.cute + 3));
  assert.equal(after.stats.menace, Math.min(10, before.stats.menace + 1));
  assert.equal(after.stats.damp, before.stats.damp);
  assert.equal(after.stats.mystique, before.stats.mystique);
  assert.equal(after.bio, before.bio, 'adding a secondary quirk does not reroll the introduction');
  for (const trait of TRAITS) {
    for (let seed = 0; seed < 10; seed++) {
      const { stats } = resolvePersonality({ seed, traits: [trait.id, 'damp', 'haunted'] });
      assert.deepEqual(Object.keys(stats), ['cute', 'menace', 'damp', 'mystique']);
      assert.ok(Object.values(stats).every(value => Number.isInteger(value) && value >= 1 && value <= 10));
    }
  }
});

test('care preview matches actual daytime decay including combined quirks and Damp', () => {
  for (const traits of [['damp', 'clean'], ['nocturnal', 'clingy', 'sugar'], ['loadbearing', 'magpie']]) {
    for (let seed = 0; seed < 10; seed++) {
      const draft = { seed, traits };
      const pet = { id: 'preview', ...resolvePersonality(draft), art: { body: '', stamps: [] } };
      const shelf = { pets: [pet], props: [], slots: [pet.id, null, null, null, null, null] };
      const preview = creationCareRates(draft);
      for (const need of ['food', 'fuss', 'clean']) assert.equal(preview[need], decayRate(pet, need, shelf));
    }
  }
});

test('origins are optional and bounded; blank introductions use the same generated bio on every resolution', () => {
  const draft = createPersonalityDraft(402);
  assert.equal(normalizePersonalityDraft({ ...draft, origin: 'x'.repeat(500) }).origin.length, ORIGIN_LIMIT);
  assert.equal(resolvePersonality({ ...draft, origin: '  \n\t  ' }).bio, resolvePersonality(draft).bio);
  assert.ok(resolvePersonality(draft).bio.includes(TRAIT_BY_ID[draft.traits[0]].blurb));
  assert.equal(resolvePersonality({ ...draft, origin: '<b>Unconvinced.</b>' }).bio, '<b>Unconvinced.</b>', 'origin stays plain data for text rendering');
});
