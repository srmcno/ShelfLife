import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRAIT_BY_ID } from '../src/content/traits.js';
import { FEUDS } from '../src/content/feuds.js';
import {
  GENERIC_EXCHANGES, TRAIT_EXCHANGES, FEUD_EXCHANGES, FEUD_TRAIT_EXCHANGES,
  REACTION_SHOTS, DIRECT_ADDRESS, TRAIT_DIRECT, FRAGMENTS, NEIGHBOUR_FRAGMENTS,
  CHORUS_EXCHANGES
} from '../src/content/dialogue.js';
import {
  MATURE_GENERIC_EXCHANGES, MATURE_TRAIT_EXCHANGES, MATURE_FEUD_EXCHANGES,
  MATURE_FEUD_TRAIT_EXCHANGES, MATURE_REACTION_SHOTS, MATURE_DIRECT_ADDRESS,
  MATURE_TRAIT_DIRECT, MATURE_FRAGMENTS, MATURE_NEIGHBOUR_FRAGMENTS,
  MATURE_CHORUS_EXCHANGES
} from '../src/content/mature.js';
import {
  pickDialogue, pickDirectAddress, pickExchange, adjacentPairs, awakePets,
  feudingPairs, feudTier, traitExchangesFor, directCategoriesFor, dialoguePools,
  formatDialogue, dialogueText, joinNames, DIRECT_CATEGORIES, DIALOGUE_KINDS, CHORUS_SPEAKER
} from '../src/engine/dialogue.js';
import { blankState, defaultNeeds } from '../src/state.js';

/* ---------------- fixtures ---------------- */

function makePet(id, traits, needs) {
  return {
    id, name: id, traits: traits || [], needs: needs || defaultNeeds(),
    bond: 0, cared: 0, grudges: 0, grudgeStage: 0
  };
}

// Places pets into consecutive slots on the first row, so every neighbouring pair is
// adjacent under neighborSlots()'s 6-wide grid.
function shelf(pets, settings) {
  const s = blankState();
  pets.forEach((p, i) => { s.pets.push(p); s.slots[i] = p.id; });
  if (settings) Object.assign(s.settings, settings);
  return s;
}

const DAY = new Date(2026, 0, 15, 13, 0, 0).getTime();   // 13:00 — isNight() false
const NIGHT = new Date(2026, 0, 15, 23, 0, 0).getTime(); // 23:00 — isNight() true

const EXCHANGE_POOLS = [
  ['GENERIC_EXCHANGES', GENERIC_EXCHANGES],
  ['TRAIT_EXCHANGES', TRAIT_EXCHANGES],
  ['FEUD_EXCHANGES[1]', FEUD_EXCHANGES[1]],
  ['FEUD_EXCHANGES[2]', FEUD_EXCHANGES[2]],
  ['FEUD_EXCHANGES[3]', FEUD_EXCHANGES[3]],
  ['FEUD_TRAIT_EXCHANGES', FEUD_TRAIT_EXCHANGES],
  ['CHORUS_EXCHANGES', CHORUS_EXCHANGES],
  ['MATURE_GENERIC_EXCHANGES', MATURE_GENERIC_EXCHANGES],
  ['MATURE_TRAIT_EXCHANGES', MATURE_TRAIT_EXCHANGES],
  ['MATURE_FEUD_EXCHANGES[1]', MATURE_FEUD_EXCHANGES[1]],
  ['MATURE_FEUD_EXCHANGES[2]', MATURE_FEUD_EXCHANGES[2]],
  ['MATURE_FEUD_EXCHANGES[3]', MATURE_FEUD_EXCHANGES[3]],
  ['MATURE_FEUD_TRAIT_EXCHANGES', MATURE_FEUD_TRAIT_EXCHANGES],
  ['MATURE_CHORUS_EXCHANGES', MATURE_CHORUS_EXCHANGES]
];

const DIRECT_POOLS = [
  ['DIRECT_ADDRESS', DIRECT_ADDRESS],
  ['MATURE_DIRECT_ADDRESS', MATURE_DIRECT_ADDRESS]
];

const TRAIT_DIRECT_POOLS = [
  ['TRAIT_DIRECT', TRAIT_DIRECT],
  ['MATURE_TRAIT_DIRECT', MATURE_TRAIT_DIRECT]
];

const REACTION_POOLS = [
  ['REACTION_SHOTS', REACTION_SHOTS],
  ['MATURE_REACTION_SHOTS', MATURE_REACTION_SHOTS]
];

function everyTurn(pool, fn) {
  pool.forEach(entry => entry.turns.forEach(t => fn(t, entry)));
}

function serialize(entry) {
  return entry.turns.map(t => t[0] + '|' + t[1]).join('||') + (entry.setup ? '##' + entry.setup : '');
}

function allLines() {
  const out = [];
  EXCHANGE_POOLS.concat(DIRECT_POOLS, TRAIT_DIRECT_POOLS).forEach(([, pool]) => {
    everyTurn(pool, t => out.push(t[1]));
  });
  REACTION_POOLS.forEach(([, pool]) => {
    pool.forEach(e => { out.push(e.setup); e.turns.forEach(t => out.push(t[1])); });
  });
  return out.concat(FRAGMENTS, NEIGHBOUR_FRAGMENTS, MATURE_FRAGMENTS, MATURE_NEIGHBOUR_FRAGMENTS);
}

/* ---------------- content shape ---------------- */

test('every pool meets its size floor', () => {
  assert.ok(GENERIC_EXCHANGES.length >= 50, `GENERIC_EXCHANGES: ${GENERIC_EXCHANGES.length}`);
  assert.ok(TRAIT_EXCHANGES.length >= 100, `TRAIT_EXCHANGES: ${TRAIT_EXCHANGES.length}`);
  [1, 2, 3].forEach(l => assert.ok(FEUD_EXCHANGES[l].length >= 8, `FEUD_EXCHANGES[${l}] too small`));
  assert.ok(FEUD_TRAIT_EXCHANGES.length >= 15, `FEUD_TRAIT_EXCHANGES: ${FEUD_TRAIT_EXCHANGES.length}`);
  assert.ok(REACTION_SHOTS.length >= 18, `REACTION_SHOTS: ${REACTION_SHOTS.length}`);
  assert.ok(DIRECT_ADDRESS.length >= 60, `DIRECT_ADDRESS: ${DIRECT_ADDRESS.length}`);
  assert.ok(TRAIT_DIRECT.length >= 60, `TRAIT_DIRECT: ${TRAIT_DIRECT.length}`);
  assert.ok(FRAGMENTS.length >= 40, `FRAGMENTS: ${FRAGMENTS.length}`);
  assert.ok(NEIGHBOUR_FRAGMENTS.length >= 18, `NEIGHBOUR_FRAGMENTS: ${NEIGHBOUR_FRAGMENTS.length}`);
  assert.ok(CHORUS_EXCHANGES.length >= 20, `CHORUS_EXCHANGES: ${CHORUS_EXCHANGES.length}`);
});

test('every exchange has 2-5 turns of [who, non-empty line]', () => {
  EXCHANGE_POOLS.forEach(([name, pool]) => {
    pool.forEach(entry => {
      assert.ok(Array.isArray(entry.turns), `${name}: entry without turns`);
      assert.ok(entry.turns.length >= 2 && entry.turns.length <= 5,
        `${name}: ${entry.turns.length} turns in ${serialize(entry)}`);
      entry.turns.forEach(t => {
        assert.ok(Array.isArray(t) && t.length === 2, `${name}: malformed turn`);
        assert.equal(typeof t[0], 'string');
        assert.equal(typeof t[1], 'string');
        assert.ok(t[1].length > 0, `${name}: empty line`);
      });
    });
  });
});

test('two-hander pools only use the a/b roles; chorus adds c and all', () => {
  const twoHanders = EXCHANGE_POOLS.filter(([n]) => !n.includes('CHORUS'));
  twoHanders.forEach(([name, pool]) => {
    everyTurn(pool, t => assert.ok(t[0] === 'a' || t[0] === 'b', `${name}: bad role "${t[0]}"`));
  });
  [CHORUS_EXCHANGES, MATURE_CHORUS_EXCHANGES].forEach(pool => {
    everyTurn(pool, t => assert.ok(['a', 'b', 'c', 'all'].includes(t[0]), `chorus bad role "${t[0]}"`));
  });
});

test('reaction shots are a narrated setup plus exactly one bystander line', () => {
  REACTION_POOLS.forEach(([name, pool]) => {
    pool.forEach(e => {
      assert.equal(typeof e.setup, 'string', `${name}: missing setup`);
      assert.ok(/\{[ab]\}/.test(e.setup), `${name}: setup must name a pet: ${e.setup}`);
      assert.equal(e.turns.length, 1, `${name}: reaction shot should be one line`);
      assert.equal(e.turns[0][0], 'c', `${name}: the reaction must be spoken by 'c'`);
    });
  });
});

test('direct address entries carry a known category and only speak as p or n', () => {
  DIRECT_POOLS.forEach(([name, pool]) => {
    pool.forEach(e => {
      assert.ok(DIRECT_CATEGORIES.includes(e.category), `${name}: unknown category "${e.category}"`);
      e.turns.forEach(t => assert.ok(t[0] === 'p' || t[0] === 'n', `${name}: bad role "${t[0]}"`));
      const usesN = e.turns.some(t => t[0] === 'n' || t[1].includes('{n}'));
      assert.equal(usesN, e.needs === 'neighbor',
        `${name}: {n}/'n' usage must match needs:'neighbor' — ${serialize(e)}`);
    });
  });
  TRAIT_DIRECT_POOLS.forEach(([name, pool]) => {
    pool.forEach(e => {
      assert.ok(TRAIT_BY_ID[e.trait], `${name}: unknown trait id "${e.trait}"`);
      e.turns.forEach(t => assert.equal(t[0], 'p', `${name}: trait direct speaks only as p`));
    });
  });
});

test('every trait id referenced by a dialogue pair exists and the pair is distinct', () => {
  const paired = TRAIT_EXCHANGES.concat(FEUD_TRAIT_EXCHANGES, MATURE_TRAIT_EXCHANGES, MATURE_FEUD_TRAIT_EXCHANGES);
  paired.forEach(e => {
    assert.ok(Array.isArray(e.pair) && e.pair.length === 2, `bad pair: ${JSON.stringify(e.pair)}`);
    e.pair.forEach(id => assert.ok(TRAIT_BY_ID[id], `unknown trait id in dialogue: ${id}`));
    assert.notEqual(e.pair[0], e.pair[1], `self-paired trait: ${e.pair[0]}`);
  });
});

// A feud scene only ever fires for a pair activeFeuds() recognises, so a pair missing
// from FEUDS is dead content that no shelf can ever reach.
test('every feud-specific pair is a real FEUDS pair', () => {
  const known = new Set(FEUDS.map(([a, b]) => [a, b].sort().join('|')));
  FEUD_TRAIT_EXCHANGES.concat(MATURE_FEUD_TRAIT_EXCHANGES).forEach(e => {
    const key = e.pair.slice().sort().join('|');
    assert.ok(known.has(key), `feud dialogue for a non-feuding pair: ${e.pair.join('/')}`);
    assert.ok([1, 2, 3].includes(e.level), `bad feud level for ${e.pair.join('/')}: ${e.level}`);
  });
});

/* ---------------- placeholders ---------------- */

test('exchange lines use only {a}/{b} (chorus may add {c}); nothing else leaks', () => {
  EXCHANGE_POOLS.forEach(([name, pool]) => {
    const allowed = name.includes('CHORUS') ? /^\{[abc]\}$/ : /^\{[ab]\}$/;
    everyTurn(pool, t => {
      (t[1].match(/\{[^}]*\}/g) || []).forEach(ph => {
        assert.match(ph, allowed, `${name}: illegal placeholder ${ph} in "${t[1]}"`);
      });
    });
  });
});

test('reaction setups use only {a}/{b}, reaction lines only {a}/{b}', () => {
  REACTION_POOLS.forEach(([name, pool]) => {
    pool.forEach(e => {
      [e.setup].concat(e.turns.map(t => t[1])).forEach(text => {
        (text.match(/\{[^}]*\}/g) || []).forEach(ph => {
          assert.match(ph, /^\{[ab]\}$/, `${name}: illegal placeholder ${ph} in "${text}"`);
        });
      });
    });
  });
});

test('FRAGMENTS render raw, so they must contain no braces at all', () => {
  FRAGMENTS.concat(MATURE_FRAGMENTS).forEach(line => {
    assert.ok(!/[{}]/.test(line), `unsubstituted placeholder in fragment: ${line}`);
  });
});

test('NEIGHBOUR_FRAGMENTS all require {n} and use nothing else', () => {
  NEIGHBOUR_FRAGMENTS.concat(MATURE_NEIGHBOUR_FRAGMENTS).forEach(line => {
    assert.ok(line.includes('{n}'), `neighbour fragment missing {n}: ${line}`);
    (line.match(/\{[^}]*\}/g) || []).forEach(ph => assert.equal(ph, '{n}', `illegal ${ph} in: ${line}`));
  });
});

test('direct address uses only {n}, and only when it declares needs:"neighbor"', () => {
  DIRECT_POOLS.concat(TRAIT_DIRECT_POOLS).forEach(([name, pool]) => {
    pool.forEach(e => e.turns.forEach(t => {
      (t[1].match(/\{[^}]*\}/g) || []).forEach(ph => {
        assert.equal(ph, '{n}', `${name}: illegal placeholder ${ph} in "${t[1]}"`);
        assert.equal(e.needs, 'neighbor', `${name}: {n} without needs:'neighbor' in "${t[1]}"`);
      });
    }));
  });
});

/* ---------------- duplicates + length ---------------- */

test('no exchange is duplicated across any dialogue pool', () => {
  const seen = new Map();
  EXCHANGE_POOLS.concat(DIRECT_POOLS, TRAIT_DIRECT_POOLS, REACTION_POOLS).forEach(([name, pool]) => {
    pool.forEach(entry => {
      const key = serialize(entry);
      assert.ok(!seen.has(key), `duplicate exchange in ${seen.get(key)} and ${name}: ${key}`);
      seen.set(key, name);
    });
  });
});

test('no fragment is duplicated', () => {
  const all = FRAGMENTS.concat(NEIGHBOUR_FRAGMENTS, MATURE_FRAGMENTS, MATURE_NEIGHBOUR_FRAGMENTS);
  const seen = new Set();
  all.forEach(line => {
    assert.ok(!seen.has(line), `duplicate fragment: ${line}`);
    seen.add(line);
  });
});

// docs/comedy-direction.md §2: 60% of strings <= 90 chars, nothing over 280, and the
// median has to stay near the existing 53 or the corkboard turns into homework.
test('dialogue keeps the house length budget', () => {
  const lens = allLines().map(l => l.length).sort((x, y) => x - y);
  const median = lens[Math.floor(lens.length / 2)];
  const short = lens.filter(n => n <= 90).length / lens.length;
  assert.ok(lens[lens.length - 1] <= 280, `a line exceeds 280 chars: ${lens[lens.length - 1]}`);
  assert.ok(median <= 60, `median line length ${median} is too long`);
  assert.ok(short >= 0.6, `only ${(short * 100).toFixed(1)}% of lines are <= 90 chars`);
});

/* ---------------- mature is strictly additive ---------------- */

test('mature dialogue pools are disjoint from the base pools', () => {
  const pairsOf = [
    [GENERIC_EXCHANGES, MATURE_GENERIC_EXCHANGES],
    [TRAIT_EXCHANGES, MATURE_TRAIT_EXCHANGES],
    [FEUD_EXCHANGES[1], MATURE_FEUD_EXCHANGES[1]],
    [FEUD_EXCHANGES[2], MATURE_FEUD_EXCHANGES[2]],
    [FEUD_EXCHANGES[3], MATURE_FEUD_EXCHANGES[3]],
    [FEUD_TRAIT_EXCHANGES, MATURE_FEUD_TRAIT_EXCHANGES],
    [REACTION_SHOTS, MATURE_REACTION_SHOTS],
    [DIRECT_ADDRESS, MATURE_DIRECT_ADDRESS],
    [TRAIT_DIRECT, MATURE_TRAIT_DIRECT],
    [CHORUS_EXCHANGES, MATURE_CHORUS_EXCHANGES]
  ];
  pairsOf.forEach(([base, extra]) => {
    const known = new Set(base.map(serialize));
    extra.forEach(e => assert.ok(!known.has(serialize(e)), `mature entry duplicates a base entry: ${serialize(e)}`));
  });
  const baseFrag = new Set(FRAGMENTS.concat(NEIGHBOUR_FRAGMENTS));
  MATURE_FRAGMENTS.concat(MATURE_NEIGHBOUR_FRAGMENTS)
    .forEach(l => assert.ok(!baseFrag.has(l), `mature fragment duplicates a base one: ${l}`));
});

test('mature mode only ever grows the pools it touches', () => {
  const base = dialoguePools(blankState());
  const mature = dialoguePools(shelf([makePet('a')], { matureMode: true }));
  ['generic', 'trait', 'feudTrait', 'reaction', 'direct', 'traitDirect', 'fragment', 'neighbourFragment', 'chorus']
    .forEach(k => {
      assert.ok(mature[k].length > base[k].length, `mature pool "${k}" added nothing`);
      base[k].forEach(entry => assert.ok(mature[k].includes(entry), `mature pool "${k}" dropped a base entry`));
    });
  [1, 2, 3].forEach(l => assert.ok(mature.feud[l].length > base.feud[l].length, `mature feud tier ${l} added nothing`));
});

test('mature content is off unless the toggle is on', () => {
  const s = shelf([makePet('a', ['gossip']), makePet('b', ['spiteful'])]);
  assert.equal(s.settings.matureMode, false);
  assert.equal(dialoguePools(s).generic.length, GENERIC_EXCHANGES.length);
});

/* ---------------- shelf inspection ---------------- */

test('adjacentPairs finds each neighbouring pair exactly once', () => {
  const s = shelf([makePet('a'), makePet('b'), makePet('c')]);
  const pairs = adjacentPairs(s, DAY).map(([x, y]) => [x.id, y.id].sort().join('|')).sort();
  assert.deepEqual(pairs, ['a|b', 'b|c']);
});

test('adjacentPairs skips sleeping pets and non-adjacent slots', () => {
  const s = shelf([makePet('a'), makePet('sleeper', ['nocturnal']), makePet('c')]);
  assert.deepEqual(adjacentPairs(s, DAY), []);           // nocturnal pet is asleep at 13:00
  assert.equal(adjacentPairs(s, NIGHT).length, 2);        // and awake at 23:00

  const gap = blankState();
  const p = makePet('a'), q = makePet('b');
  gap.pets.push(p, q); gap.slots[0] = 'a'; gap.slots[4] = 'b';
  assert.deepEqual(adjacentPairs(gap, DAY), []);
});

test('awakePets ignores pets that are not on the shelf', () => {
  const s = shelf([makePet('a')]);
  s.pets.push(makePet('boxed'));                          // in state.pets, in no slot
  assert.deepEqual(awakePets(s, DAY).map(p => p.id), ['a']);
});

test('feudingPairs reports the arc tier, and feudTier clamps to 1-3', () => {
  const s = shelf([makePet('a', ['gossip']), makePet('b', ['spiteful'])]);
  let found = feudingPairs(s, DAY);
  assert.equal(found.length, 1);
  assert.equal(found[0].level, 1);
  s.feudArcs['a|b'] = { level: 5, truce: false };
  assert.equal(feudingPairs(s, DAY)[0].level, 3);
  assert.deepEqual([0, 1, 2, 3, 4, 99].map(feudTier), [1, 1, 2, 2, 3, 3]);
});

test('traitExchangesFor orients the scene so a holds pair[0]', () => {
  const s = shelf([makePet('lc', ['lifecoach']), makePet('un', ['undertaker'])]);
  const [a, b] = adjacentPairs(s, DAY)[0];
  const matches = traitExchangesFor(s, a, b);
  assert.ok(matches.length >= 1);
  matches.forEach(m => {
    assert.ok(m.a.traits.includes(m.entry.pair[0]), 'role a must hold pair[0]');
    assert.ok(m.b.traits.includes(m.entry.pair[1]), 'role b must hold pair[1]');
  });
});

test('traitExchangesFor returns nothing when the pets share no written pairing', () => {
  const s = shelf([makePet('a', ['loadbearing']), makePet('b', ['haunted'])]);
  const [a, b] = adjacentPairs(s, DAY)[0];
  assert.deepEqual(traitExchangesFor(s, a, b), []);
});

test('directCategoriesFor tracks mood, grudges, bond and the hour', () => {
  const furious = makePet('f', [], { food: 2, fuss: 2, clean: 2 });
  assert.ok(directCategoriesFor(shelf([furious]), furious, DAY).includes('threat'));
  const content = makePet('c', [], { food: 95, fuss: 95, clean: 95 });
  assert.ok(directCategoriesFor(shelf([content]), content, DAY).includes('lovebomb'));
  const fond = makePet('d', [], { food: 60, fuss: 60, clean: 60 });
  fond.bond = 20;
  assert.ok(directCategoriesFor(shelf([fond]), fond, DAY).includes('lovebomb'));
  assert.ok(directCategoriesFor(shelf([fond]), fond, NIGHT).includes('confession'));
  directCategoriesFor(shelf([fond]), fond, NIGHT)
    .forEach(c => assert.ok(DIRECT_CATEGORIES.includes(c), `unknown category ${c}`));
});

/* ---------------- selection ---------------- */

function assertValidResult(r) {
  assert.ok(r, 'expected a dialogue result');
  assert.ok(DIALOGUE_KINDS.includes(r.kind), `unknown kind ${r.kind}`);
  assert.ok(['two-hander', 'reaction', 'direct', 'line', 'chorus'].includes(r.form), `unknown form ${r.form}`);
  assert.equal(typeof r.from, 'string');
  assert.ok(r.from.length > 0);
  assert.ok(['note', 'feud', 'angry'].includes(r.tone), `unknown tone ${r.tone}`);
  assert.ok(Array.isArray(r.turns) && r.turns.length > 0);
  assert.ok(Array.isArray(r.cast) && r.cast.length > 0);
  r.turns.forEach(t => {
    assert.equal(typeof t.speaker, 'string');
    assert.ok(t.speaker.length > 0, `turn with no speaker: ${JSON.stringify(t)}`);
    assert.equal(typeof t.line, 'string');
    assert.ok(t.line.length > 0);
    assert.ok(!/[{}]/.test(t.line), `unsubstituted placeholder rendered: ${t.line}`);
  });
  if (r.setup !== null) {
    assert.equal(typeof r.setup, 'string');
    assert.ok(!/[{}]/.test(r.setup), `unsubstituted placeholder in setup: ${r.setup}`);
  }
}

test('pickDialogue returns a valid structure across many randomised draws', () => {
  const s = shelf([
    makePet('Doreen', ['gossip', 'martyr']),
    makePet('Gnash', ['spiteful', 'feral'], { food: 10, fuss: 10, clean: 10 }),
    makePet('Wretch', ['undertaker']),
    makePet('Pudding', ['lifecoach'], { food: 95, fuss: 95, clean: 95 }),
    makePet('Moth', ['porcelain', 'bitey'])
  ]);
  for (let i = 0; i < 400; i++) assertValidResult(pickDialogue(s, { now: i % 2 ? DAY : NIGHT }));
});

test('pickDialogue works in mature mode too', () => {
  const s = shelf([
    makePet('Doreen', ['hoarder']), makePet('Gnash', ['minimalist']), makePet('Wretch', ['nihilist'])
  ], { matureMode: true });
  for (let i = 0; i < 300; i++) assertValidResult(pickDialogue(s, { now: DAY }));
});

test('every form produces a valid structure when its cast requirement is met', () => {
  const s = shelf([
    makePet('Doreen', ['gossip']), makePet('Gnash', ['spiteful']),
    makePet('Wretch', ['undertaker']), makePet('Pudding', ['lifecoach'])
  ]);
  ['feud', 'trait', 'generic', 'reaction', 'direct', 'fragment', 'chorus'].forEach(kind => {
    for (let i = 0; i < 40; i++) {
      const r = pickDialogue(s, { kind, now: DAY });
      assertValidResult(r);
      assert.equal(r.kind, kind);
    }
  });
});

test('a feud scene is tagged feud/observed and reports its tier', () => {
  const s = shelf([makePet('Doreen', ['gossip']), makePet('Gnash', ['spiteful'])]);
  s.feudArcs['Doreen|Gnash'] = { level: 4, truce: false };
  for (let i = 0; i < 30; i++) {
    const r = pickDialogue(s, { kind: 'feud', now: DAY });
    assert.equal(r.tone, 'feud');
    assert.equal(r.from, 'observed');
    assert.equal(r.meta.level, 3);
  }
});

test('a trait pairing is preferred over the generic pool for those two pets', () => {
  const s = shelf([makePet('Doreen', ['lifecoach']), makePet('Wretch', ['undertaker'])]);
  const seen = new Set();
  for (let i = 0; i < 60; i++) seen.add(pickDialogue(s, { kind: 'trait', now: DAY }).meta.pair.join('/'));
  assert.ok(seen.size > 0);
  seen.forEach(p => assert.ok(p.includes('lifecoach') && p.includes('undertaker'), `wrong pairing drawn: ${p}`));
});

test('reaction shots always name a third pet as the speaker', () => {
  const s = shelf([makePet('Doreen'), makePet('Gnash'), makePet('Wretch')]);
  for (let i = 0; i < 40; i++) {
    const r = pickDialogue(s, { kind: 'reaction', now: DAY });
    assert.equal(r.cast.length, 3);
    assert.equal(r.turns.length, 1);
    assert.equal(r.turns[0].speaker, r.cast[2].name);
    assert.ok(r.setup && r.setup.length > 0);
  }
});

// Joining the cast names here put the dissenter inside the chorus that overrules them
// ("Pudding, Old Nan and Doreen: It's Tuesday." / "Pudding: It's Thursday."), which
// reads as one pet arguing with itself. A fixed label is always correct.
test('a chorus attributes its "all" lines to the group, never to a name list', () => {
  const s = shelf([makePet('Doreen'), makePet('Gnash'), makePet('Wretch')]);
  let sawAll = false;
  for (let i = 0; i < 80; i++) {
    const r = pickDialogue(s, { kind: 'chorus', now: DAY });
    assert.equal(r.cast.length, 3);
    r.turns.filter(t => t.who === 'all').forEach(t => {
      sawAll = true;
      assert.equal(t.speaker, CHORUS_SPEAKER);
    });
    r.turns.filter(t => t.who !== 'all').forEach(t => {
      assert.ok(r.cast.some(p => p.name === t.speaker), `unknown chorus speaker "${t.speaker}"`);
    });
  }
  assert.ok(sawAll, 'no chorus line used the "all" role in 80 draws');
});

test('joinNames reads as a sentence for 1, 2 and 3 names', () => {
  assert.equal(joinNames([]), '');
  assert.equal(joinNames(['Doreen']), 'Doreen');
  assert.equal(joinNames(['Doreen', 'Gnash']), 'Doreen and Gnash');
  assert.equal(joinNames(['Doreen', 'Gnash', 'Wretch']), 'Doreen, Gnash and Wretch');
});

// Individual turns like "No." recur legitimately across scenes, so these two check the
// whole exchange signature rather than any one line.
function drawnSignature(result) {
  return result.turns.map(t => t.who + '|' + t.line).join('||');
}

test('night-only entries never fire during the day', () => {
  const s = shelf([makePet('Doreen'), makePet('Gnash'), makePet('Wretch')]);
  const nightOnly = new Set(GENERIC_EXCHANGES.filter(e => e.night).map(serialize));
  assert.ok(nightOnly.size > 0, 'fixture assumes some night-only generic exchanges exist');
  let sawOneAtNight = false;
  for (let i = 0; i < 400; i++) {
    const sig = drawnSignature(pickDialogue(s, { kind: 'generic', now: DAY }));
    assert.ok(!nightOnly.has(sig), `night-only scene fired at 13:00: ${sig}`);
    if (nightOnly.has(drawnSignature(pickDialogue(s, { kind: 'generic', now: NIGHT })))) sawOneAtNight = true;
  }
  assert.ok(sawOneAtNight, 'night-only scenes never fired at 23:00 either');
});

test('a mood-tagged exchange only fires when somebody is in that mood', () => {
  const contentOnly = new Set(GENERIC_EXCHANGES.filter(e => e.mood === 'content').map(serialize));
  assert.ok(contentOnly.size > 0, 'fixture assumes some content-only exchanges exist');
  const starving = shelf([
    makePet('Doreen', [], { food: 2, fuss: 2, clean: 2 }),
    makePet('Gnash', [], { food: 2, fuss: 2, clean: 2 })
  ]);
  for (let i = 0; i < 400; i++) {
    const sig = drawnSignature(pickDialogue(starving, { kind: 'generic', now: DAY }));
    assert.ok(!contentOnly.has(sig), `content-only scene fired on a furious shelf: ${sig}`);
  }
  const happy = shelf([
    makePet('Doreen', [], { food: 95, fuss: 95, clean: 95 }),
    makePet('Gnash', [], { food: 95, fuss: 95, clean: 95 })
  ]);
  let sawContent = false;
  for (let i = 0; i < 400; i++) {
    if (contentOnly.has(drawnSignature(pickDialogue(happy, { kind: 'generic', now: DAY })))) sawContent = true;
  }
  assert.ok(sawContent, 'content-only scenes never fired on a content shelf');
});

/* ---------------- graceful degradation ---------------- */

test('an empty shelf produces no dialogue', () => {
  assert.equal(pickDialogue(blankState(), { now: DAY }), null);
  assert.equal(pickDialogue(null, { now: DAY }), null);
});

test('a shelf where everyone is asleep produces no dialogue', () => {
  const s = shelf([makePet('a', ['nocturnal']), makePet('b', ['nocturnal'])]);
  assert.equal(pickDialogue(s, { now: DAY }), null);
  assertValidResult(pickDialogue(s, { now: NIGHT }));
});

test('a one-pet shelf still talks, using only the forms that need no second pet', () => {
  const s = shelf([makePet('Doreen', ['undertaker'])]);
  for (let i = 0; i < 200; i++) {
    const r = pickDialogue(s, { now: DAY });
    assertValidResult(r);
    assert.ok(['direct', 'fragment'].includes(r.kind), `unexpected form on a one-pet shelf: ${r.kind}`);
    assert.equal(r.cast.length, 1);
  }
});

test('forcing an unavailable form returns null rather than a wrong one', () => {
  const solo = shelf([makePet('Doreen')]);
  ['feud', 'trait', 'generic', 'reaction', 'chorus'].forEach(kind => {
    assert.equal(pickDialogue(solo, { kind, now: DAY }), null, `${kind} should be unavailable`);
  });
  const noFeud = shelf([makePet('a', ['loadbearing']), makePet('b', ['haunted'])]);
  assert.equal(pickDialogue(noFeud, { kind: 'feud', now: DAY }), null);
  assert.equal(pickDialogue(noFeud, { kind: 'trait', now: DAY }), null);
  assertValidResult(pickDialogue(noFeud, { kind: 'generic', now: DAY }));
  assert.equal(pickDialogue(solo, { kind: 'nonsense', now: DAY }), null);
});

test('pets with no traits at all still get generic scenes and direct address', () => {
  const s = shelf([makePet('a'), makePet('b')]);
  for (let i = 0; i < 200; i++) assertValidResult(pickDialogue(s, { now: DAY }));
});

test('a pet with every trait at once does not break selection', () => {
  const everything = makePet('Kitchen Sink', Object.keys(TRAIT_BY_ID).filter(id => id !== 'nocturnal'));
  const s = shelf([everything, makePet('b', ['nihilist']), makePet('c', ['clean'])]);
  for (let i = 0; i < 200; i++) assertValidResult(pickDialogue(s, { now: DAY }));
});

/* ---------------- targeted helpers ---------------- */

test('pickDirectAddress speaks as the named pet and refuses a sleeping one', () => {
  const s = shelf([makePet('Doreen', ['hoarder']), makePet('Gnash')]);
  for (let i = 0; i < 60; i++) {
    const r = pickDirectAddress(s, s.pets[0], { now: DAY });
    assertValidResult(r);
    assert.equal(r.kind, 'direct');
    assert.equal(r.from, 'Doreen');
    assert.equal(r.cast[0].id, 'Doreen');
  }
  const sleepy = shelf([makePet('Owl', ['nocturnal'])]);
  assert.equal(pickDirectAddress(sleepy, sleepy.pets[0], { now: DAY }), null);
  assert.equal(pickDirectAddress(s, null, { now: DAY }), null);
});

test('a needs:"neighbor" direct scene never renders without its neighbour', () => {
  const solo = shelf([makePet('Doreen', [])]);
  for (let i = 0; i < 200; i++) {
    const r = pickDirectAddress(solo, solo.pets[0], { now: DAY });
    assertValidResult(r);
    assert.equal(r.cast.length, 1);
    r.turns.forEach(t => assert.equal(t.who, 'p'));
  }
});

test('pickExchange prefers the written pairing and falls back to generic', () => {
  const s = shelf([makePet('Doreen', ['minimalist']), makePet('Gnash', ['hoarder'])]);
  const r = pickExchange(s, s.pets[0], s.pets[1], { now: DAY });
  assertValidResult(r);
  assert.equal(r.kind, 'trait');

  const plain = shelf([makePet('a', ['loadbearing']), makePet('b', ['haunted'])]);
  const g = pickExchange(plain, plain.pets[0], plain.pets[1], { now: DAY });
  assertValidResult(g);
  assert.equal(g.kind, 'generic');
  assert.equal(pickExchange(plain, null, plain.pets[1], { now: DAY }), null);
});

/* ---------------- render helpers ---------------- */

test('formatDialogue prefixes each turn with its speaker, setup first', () => {
  const s = shelf([makePet('Doreen'), makePet('Gnash'), makePet('Wretch')]);
  const r = pickDialogue(s, { kind: 'reaction', now: DAY });
  const lines = formatDialogue(r);
  assert.equal(lines.length, r.turns.length + 1);
  assert.equal(lines[0], r.setup);
  assert.match(lines[1], /^Doreen: |^Gnash: |^Wretch: /);
  assert.equal(dialogueText(r), lines.join('\n'));
  assert.deepEqual(formatDialogue(null), []);
});

test('every dialogue result survives being rendered to a note string', () => {
  const s = shelf([
    makePet('Doreen', ['gossip']), makePet('Gnash', ['spiteful']),
    makePet('Wretch', ['bones']), makePet('Pudding', ['clean'])
  ], { matureMode: true });
  for (let i = 0; i < 300; i++) {
    const text = dialogueText(pickDialogue(s, { now: i % 2 ? DAY : NIGHT }));
    assert.ok(text.length > 0);
    assert.ok(!/[{}]/.test(text), `braces survived into a note: ${text}`);
    assert.ok(text.length <= 400, `note far too long for the corkboard: ${text}`);
  }
});
