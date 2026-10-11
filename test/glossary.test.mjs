import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { GLOSSARY, GLOSSARY_BY_ID, EXPEDITION_TERMS, glossaryEntry } from '../src/ui/glossary.js';

const root = new URL('..', import.meta.url).pathname;
const walk = dir => readdirSync(dir).flatMap(name => { const path = join(dir, name); return statSync(path).isDirectory() ? walk(path) : [path]; });

test('every term has a plain one-line explanation, a longer one, and a unique id', () => {
  assert.equal(new Set(GLOSSARY.map(e => e.id)).size, GLOSSARY.length);
  for (const entry of GLOSSARY) {
    assert.match(entry.id, /^[a-z-]+$/);
    assert.ok(entry.term && entry.group, entry.id + ' has a name and a heading');
    assert.ok(entry.short.length >= 25 && entry.short.length <= 120, entry.id + ' short line fits a tooltip card: ' + entry.short.length);
    assert.ok(entry.long.length >= 30 && entry.long.length <= 330, entry.id + ' long text is brief: ' + entry.long.length);
    assert.doesNotMatch(entry.term + entry.short + entry.long, /[–—]/, entry.id + ' avoids em and en dashes');
    if (entry.action) assert.ok(['cabinet'].includes(entry.action.mh) && entry.action.label, entry.id + ' action');
  }
  assert.equal(glossaryEntry('souls'), GLOSSARY_BY_ID.souls);
  assert.equal(glossaryEntry('nope'), null);
});

test('everything the brief calls jargon is explained', () => {
  for (const id of ['souls', 'rank', 'bond', 'household-trust', 'needs', 'omen', 'chores', 'coffin', 'poke', 'rounds', 'discoveries', 'stars', 'nerve', 'trail-points', 'wager', 'mastery', 'field-notes', 'calm']) {
    assert.ok(GLOSSARY_BY_ID[id], id + ' has an entry');
  }
  assert.deepEqual(EXPEDITION_TERMS.filter(id => !GLOSSARY_BY_ID[id]), []);
  assert.match(GLOSSARY_BY_ID.bond.short, /one resident/);
  assert.match(GLOSSARY_BY_ID['household-trust'].short, /every resident/i, 'the summed number is not confused with the per-resident one');
});

test('every data-gloss in the page and the code points at a real entry', () => {
  const files = [join(root, 'index.html'), ...walk(join(root, 'src')).filter(f => f.endsWith('.js'))];
  const used = new Set();
  for (const file of files) for (const m of readFileSync(file, 'utf8').matchAll(/data-gloss=\\?["']([a-z-]+)\\?["']/g)) used.add(m[1]);
  assert.ok(used.size >= 2, 'the souls and omen links exist: ' + [...used]);
  for (const id of used) assert.ok(GLOSSARY_BY_ID[id], 'data-gloss="' + id + '" has no glossary entry');
});

test('no em or en dashes in any file this feature added or fixed', () => {
  const files = ['index.html', 'src/engine/guide.js', 'src/engine/nextstep.js', 'src/ui/nextstep.js', 'src/ui/glossary.js', 'src/ui/toast.js', 'src/ui/card.js', 'css/guide.css', 'src/life-state.js'];
  for (const file of files) assert.doesNotMatch(readFileSync(join(root, file), 'utf8'), /[\u2013\u2014]/, file);
});
