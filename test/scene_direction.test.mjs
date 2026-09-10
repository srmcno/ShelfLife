import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sceneDirection } from '../src/content/scenes.js';
import { SCHEMES } from '../src/content/schemes.js';
import { VISITORS } from '../src/content/stories.js';
import { RELICS } from '../src/content/life.js';

const scene = (id, branch) => ({ kind: id, cast: ['resident'], title: SCHEMES.find(s => s.id === id)?.title, stage: { key: 'scheme:' + id, branch } });
const visible = (direction, id) => direction.beats.at(-1).props[id]?.opacity > 0;

test('every scheme has distinct, finite physical staging for both choices and its autonomous outcome', () => {
  assert.equal(SCHEMES.length, 26);
  for (const scheme of SCHEMES) {
    const branches = ['0', '1', 'alone'].map(branch => sceneDirection(scene(scheme.id, branch)));
    assert.equal(new Set(branches.map(result => JSON.stringify(result.beats))).size, 3, scheme.id + ' must stage three different outcomes');
    for (const result of branches) {
      assert.equal(result.key, 'scheme:' + scheme.id);
      assert.ok(result.beats.length >= 3 && result.beats.length <= 4);
      const ids = result.props.map(p => p.id);
      assert.equal(new Set(ids).size, ids.length);
      for (const beat of result.beats) {
        assert.deepEqual(Object.keys(beat.props).sort(), ids.slice().sort(), 'every prop has a state in each beat');
        for (const pose of [...beat.actors, ...Object.values(beat.props)]) {
          for (const key of ['x', 'y', 'rotate', 'scale', 'opacity']) assert.ok(Number.isFinite(pose[key]), scheme.id + ' ' + key);
          assert.ok(pose.x >= 0 && pose.x <= 100); assert.ok(pose.opacity >= 0 && pose.opacity <= 1);
        }
      }
    }
  }
});

test('legacy current outcomes recover the right branch with names containing punctuation, while ambiguous prose never invents an ending', () => {
  for (const definition of SCHEMES) for (const branch of ['0', '1', 'alone']) {
    const text = (branch === 'alone' ? definition.autonomous : definition.choices[Number(branch)].outcome).replaceAll('{p}', 'Dr. A (the second)');
    const legacy = { kind: definition.id, title: definition.title, text, cast: ['resident'] };
    assert.deepEqual(sceneDirection(legacy), sceneDirection({ ...legacy, stage: { key: 'scheme:' + definition.id, branch } }));
  }
  const unknown = sceneDirection({ kind: 'raisin', title: 'A very small funeral', text: 'An old account with an uncertain ending.', cast: ['resident'] });
  assert.ok(unknown.beats.every(b => b.props.raisin.opacity === 1));
  assert.ok(unknown.beats.every(b => b.props.grave.opacity === 0));
  const conflicting = sceneDirection({ kind: 'raisin', text: 'Buried in tissue. The raisin is in recovery.' });
  assert.ok(conflicting.beats.every(b => b.props.grave.opacity === 0));
});

test('the raisin funeral buries then eats the raisin, while recovery keeps it visibly alive', () => {
  const funeral = sceneDirection(scene('raisin', '0')), recovery = sceneDirection(scene('raisin', '1'));
  assert.ok(funeral.beats.some(b => b.props.raisin.opacity === 0 && b.props.grave.opacity === 1));
  assert.ok(funeral.beats.some(b => b.props.raisin.y > 20 && b.props.raisin.opacity === 1), 'the wake retrieves the raisin');
  assert.equal(visible(funeral, 'raisin'), false);
  assert.equal(visible(recovery, 'raisin'), true); assert.equal(visible(recovery, 'grave'), false);
  const memorial = sceneDirection(scene('exhume', '1'));
  assert.ok(memorial.beats.every(b => b.props.raisin.opacity === 0), 'the memorial does not exhume the buried raisin');
});

test('the heist actually moves and drops its crumb, and the bread tooth never becomes a literal human tooth', () => {
  const robbery = sceneDirection(scene('heist', '0'));
  assert.equal(robbery.props.find(p => p.id === 'crumb').shape, 'crumb');
  assert.ok(robbery.beats[1].props.crumb.y > 0); assert.equal(robbery.beats[2].props.crumb.y, 0); assert.ok(robbery.beats[3].props.crumb.y > 0);
  for (const branch of ['0', '1', 'alone']) {
    const tooth = sceneDirection(scene('tooth', branch));
    assert.equal(tooth.props.find(p => p.id === 'bread').shape, 'crumb');
    assert.equal(tooth.props.some(p => p.shape === 'tooth'), false);
  }
  const moth = sceneDirection(scene('moth', 'alone'));
  assert.equal(visible(moth, 'moth'), false); assert.equal(visible(moth, 'wing'), true);
});

test('visitor identity and gift shapes follow the actual guest, with the guest appended after the real resident cast', () => {
  for (const visitor of VISITORS) for (const cast of [[], ['host'], ['host', 'witness']]) {
    const result = sceneDirection({ kind: 'visitor', title: visitor.name + ' has come calling', text: 'They left ' + visitor.gift + '.', cast, stage: { key: 'visitor', guest: visitor.id, branch: 'crumbs' } });
    assert.equal(result.guest, visitor.id);
    assert.ok(result.props.some(p => p.id === 'gift' && p.label === visitor.gift));
    assert.equal(result.beats[0].actors.length, cast.length + 1);
    assert.equal(result.beats[0].actors.at(-1).x, 88);
    assert.equal(result.props.find(p => p.id === 'crumb').shape, 'crumb');
  }
  const unknown = sceneDirection({ kind: 'visitor', title: 'An unidentified caller', text: 'The original report is unclear.' });
  assert.equal(unknown.guest, undefined); assert.deepEqual(unknown.props.map(p => p.shape), ['paper']);
});

test('expedition and market replays unpack the earned relic instead of a random object', () => {
  for (const relic of RELICS) {
    const result = sceneDirection({ kind: relic.id.startsWith('market:') ? 'market' : 'outing', text: 'The trip ended.', cast: ['a', 'b'], stage: { key: relic.id.startsWith('market:') ? 'market' : 'outing', object: relic.id } });
    const displayed = result.props.find(p => p.id === 'relic');
    assert.equal(displayed.shape, relic.shape); assert.equal(displayed.label, relic.name);
    assert.equal(result.beats[0].props.relic.opacity, 0); assert.equal(result.beats.at(-1).props.relic.opacity, 1);
  }
  const source = { kind: 'outing', text: 'They brought back a prehistoric pea.', cast: ['a'] };
  const before = JSON.stringify(source); assert.equal(sceneDirection(source).props.find(p => p.id === 'relic').shape, 'pea');
  assert.equal(JSON.stringify(source), before, 'staging preserves the original account');
  const unknown = sceneDirection({ kind: 'market', text: 'No surviving inventory.' });
  assert.deepEqual(unknown.props.map(p => p.shape), ['paper']);
});
