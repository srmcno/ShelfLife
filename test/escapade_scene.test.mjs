import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState } from '../src/state.js';
import { ESCAPADES } from '../src/content/escapades.js';
import { sceneDirection } from '../src/content/scenes.js';
import { keepsakeSvg } from '../src/art/keepsakes.js';
import { mountHouseholdScene, scenePropSVG } from '../src/art/household-scene.js';
import { startEscapade, finishEscapade } from '../src/engine/escapades.js';
import { recordEscapadeEvent } from '../src/escapade-state.js';

const now = new Date(2026, 8, 13, 12).getTime();
const raster = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
function completed(episode, ending) {
  const state = blankState();
  state.pets = [
    { id: 'bystander', name: 'Not the protagonist', art: {} },
    { id: 'protagonist', name: 'Ada <the second> $&', art: { body: raster, stamps: [] } }
  ];
  const petId = state.pets[1].id, approach = episode.approaches[0];
  assert.ok(startEscapade(state, { episodeId: episode.id, approachId: approach.id, petId }, now));
  assert.ok(recordEscapadeEvent(state, { kind: 'care', petIds: [petId], need: episode.care.need }, now));
  assert.ok(recordEscapadeEvent(state, { kind: 'play', petIds: [petId], activity: approach.activity }, now));
  assert.ok(finishEscapade(state, ending.id, now));
  return { state, scene: state.life.scenes[0] };
}

test('all sixteen completed adventures replay their exact earned keepsake and finite presentation', () => {
  for (const episode of ESCAPADES) for (const ending of episode.endings) {
    const { state, scene } = completed(episode, ending), before = JSON.stringify(state);
    const direction = sceneDirection(scene);
    assert.deepEqual(scene.cast, ['protagonist']);
    assert.equal(direction.key, 'escapade');
    assert.equal(direction.guest, undefined, 'a recollection does not invent another actor');
    assert.deepEqual(direction.props, [{ id: 'keepsake', shape: 'keepsake:' + ending.keepsake, label: ending.title }]);
    assert.equal(direction.beats.length, 3);
    assert.match(direction.beats.at(-1).label, /kept with the story$/);
    assert.ok(direction.beats.at(-1).label.includes(ending.title));
    assert.ok(direction.beats[1].props.keepsake.y > direction.beats[0].props.keepsake.y, 'the presentation brings the actual object forward');
    assert.equal(direction.beats.at(-1).props.keepsake.y, 0, 'the object settles back onto the shelf');
    for (const beat of direction.beats) {
      assert.equal(beat.actors.length, 1);
      assert.deepEqual(Object.keys(beat.props), ['keepsake']);
      assert.equal(beat.props.keepsake.opacity, 1);
      for (const pose of [...beat.actors, ...Object.values(beat.props)]) {
        for (const key of ['x', 'y', 'rotate', 'scale', 'opacity']) assert.ok(Number.isFinite(pose[key]), ending.keepsake + ': ' + key);
        assert.ok(pose.x >= 0 && pose.x <= 100);
      }
    }
    assert.equal(JSON.stringify(state), before, 'replaying cannot change an earned ending or its saved account');
  }
});

test('stage art uses the full original collectible and distinct endings keep distinct recollections', () => {
  const canonical = svg => svg.replace(/keepsake-\d+-/g, 'keepsake-render-');
  for (const episode of ESCAPADES) {
    const scenes = episode.endings.map(ending => {
      const { scene } = completed(episode, ending), direction = sceneDirection(scene);
      const svg = scenePropSVG(direction.props[0].shape);
      assert.equal(canonical(svg), canonical(keepsakeSvg(ending.keepsake).replace('<svg ', '<svg width="100%" height="100%" ')));
      assert.match(svg, /viewBox="0 0 160 120"/);
      assert.match(svg, /class="keepsake-art"/);
      return direction;
    });
    assert.notDeepEqual(scenes[0].beats.map(beat => beat.label), scenes[1].beats.map(beat => beat.label));
  }
});

test('unknown, mismatched and unrecorded keepsakes preserve only the account', () => {
  const first = ESCAPADES[0], other = ESCAPADES[1];
  for (const stage of [
    undefined,
    { key: 'escapade', branch: first.id, object: 'not-a-keepsake' },
    { key: 'escapade', branch: first.id, object: other.endings[0].keepsake },
    { key: 'escapade', branch: 'missing', object: first.endings[0].keepsake },
    { key: 'escapade', branch: first.id, object: '__proto__' },
    { key: 'escapade', branch: [first.id], object: first.endings[0].keepsake }
  ]) {
    const direction = sceneDirection({ kind: 'escapade', title: first.endings[0].title, text: first.endings[0].text, cast: ['protagonist'], stage });
    assert.deepEqual(direction.props.map(prop => prop.shape), ['paper']);
    assert.equal(direction.guest, undefined);
  }
  for (const key of ['', 'missing', '__proto__', '<svg onload="alert(1)">']) assert.equal(scenePropSVG('keepsake:' + key), '');
});

// A small DOM fixture exercises the real still-preview mounting and resident
// sprite path. Timeline interruptions are covered by household_scene_lifecycle.
function miniatureDOM(t) {
  const previous = new Map();
  class Node extends EventTarget {
    constructor(tag = 'div') {
      super(); this.tagName = tag; this.className = ''; this.dataset = {}; this.children = []; this.style = { setProperty() {} };
      this.classList = {
        contains: name => this.className.split(' ').includes(name),
        add: (...names) => { this.className = [...new Set([...this.className.split(' '), ...names])].filter(Boolean).join(' '); },
        remove: (...names) => { this.className = this.className.split(' ').filter(name => !names.includes(name)).join(' '); },
        toggle: (name, value) => value ? this.classList.add(name) : this.classList.remove(name)
      };
    }
    appendChild(node) { node.parentElement = this; this.children.push(node); return node; }
    append(...nodes) { nodes.forEach(node => this.appendChild(node)); }
    setAttribute(name, value) { this[name] = value; }
    closest() { return null; }
  }
  const document = new EventTarget(); document.body = new Node(); document.createElement = tag => new Node(tag);
  const media = new EventTarget(); media.matches = true;
  for (const [key, value] of Object.entries({ document, window: { matchMedia: () => media } })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  t.after(() => { for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
  return document.body.appendChild(new Node());
}

const descendants = node => node.children.flatMap(child => [child, ...descendants(child)]);
test('the still preview presents the recorded resident’s own art and name beside the keepsake', t => {
  const host = miniatureDOM(t), episode = ESCAPADES[0], ending = episode.endings[1];
  const { state, scene } = completed(episode, ending), before = JSON.stringify(state);
  const player = mountHouseholdScene(host, state, scene, { mini: true });
  const nodes = descendants(host), actors = nodes.filter(node => node.classList.contains('household-actor'));
  assert.equal(actors.length, 1);
  assert.equal(actors[0].classList.contains('former-resident'), false);
  assert.equal(nodes.find(node => node.classList.contains('sprite')).dataset.pet, 'protagonist');
  assert.equal(nodes.find(node => node.tagName === 'img').src, raster);
  assert.equal(nodes.find(node => node.classList.contains('household-name')).textContent, 'Ada <the second> $&');
  const keepsake = nodes.find(node => node.classList.contains('household-prop'));
  assert.equal(keepsake.dataset.object, 'keepsake:' + ending.keepsake);
  assert.match(keepsake.innerHTML, /class="keepsake-art"/);
  assert.equal(keepsake.title, ending.title);
  assert.equal(host.children[0].dataset.beat, 2, 'a still preview is the finite timeline’s final pose');
  player.destroy();
  assert.equal(JSON.stringify(state), before);
});
