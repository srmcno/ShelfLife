import test from 'node:test';
import assert from 'node:assert/strict';
import { householdFixture } from './household-fixtures.mjs';
import { chapterAt, syncAlmanac, tierThresholds, weekNumber, weeklyChallenges } from '../src/engine/almanac.js';
import { CURIOS } from '../src/content/mayhem.js';

const NOW = new Date('2026-10-19T20:00:00Z').getTime();

test('claiming an edition curio paints the newly completed weekly challenge immediately', async () => {
  const realNow = Date.now; Date.now = () => NOW;
  try {
    const handlers = new Map(), sheet = { innerHTML: '', style: { setProperty() {} }, scrollTo() {} };
    globalThis.document = { getElementById: id => id === 'almanacSheet' ? sheet : null, addEventListener: (name, handler) => handlers.set(name, handler) };
    globalThis.window = { addEventListener() {} };
    const { initAlmanac } = await import('../src/ui/almanac.js');
    const state = householdFixture('established', NOW), chapter = chapterAt(NOW);
    const challenge = weeklyChallenges(weekNumber(NOW)).find(item => item.kind === 'curio');
    state.mayhem.curios = Object.fromEntries(CURIOS.slice(0, challenge.need - 1).map(curio => [curio.id, 1]));
    state.almanac.init = 0; syncAlmanac(state, NOW);
    state.almanac.week.counts.curio = challenge.need - 1;
    state.almanac.chapters[chapter.key] = { xp: tierThresholds(chapter.days)[4], claimed: 15, badge: 0, spot: 0 };
    // The application refresh synchronizes shelf data but does not repaint an open Almanac sheet.
    const ui = initAlmanac(state, () => syncAlmanac(state, NOW));
    ui.render();
    assert.equal(sheet.innerHTML.includes('data-id="' + challenge.id + '"'), false);
    const control = { dataset: { alm: 'claim', tier: '5' }, closest: () => ({}) };
    handlers.get('click')({ target: { closest: () => control } });
    assert.equal(state.almanac.week.counts.curio, challenge.need);
    assert.ok(state.almanac.week.done.includes(challenge.id));
    assert.ok(sheet.innerHTML.includes('data-alm="weekly" data-id="' + challenge.id + '"'), 'the existing sheet offers Collect without reopening');
  } finally { Date.now = realNow; }
});
