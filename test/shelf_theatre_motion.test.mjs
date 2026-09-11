import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shelfSceneFrame, SHELF_SCENE_MS, bathWaterPlacement, furnitureSceneX } from '../src/art/shelf-theatre.js';
import { reserveShelfAnimation } from '../src/art/animator.js';
const actions = ['bath', 'lamp', 'dance', 'tug', 'mirror', 'meal', 'phone', 'comfort', 'argument', 'makeup'];

test('furniture scenes leave the object visible between actors on phone and desktop', () => {
  for (const [width, center, actorSize, propWidth] of [[390, 170, 86, 60], [778, 215, 150, 90]]) {
    const left = furnitureSceneX(center, -1, actorSize, propWidth, width);
    const right = furnitureSceneX(center, 1, actorSize, propWidth, width);
    assert.ok(left + actorSize / 2 < center - propWidth / 2);
    assert.ok(right - actorSize / 2 > center + propWidth / 2);
  }
  assert.equal(furnitureSceneX(35, -1, 100, 60, 320), 50, 'a prop at the edge cannot push an actor outside the row');
  assert.equal(furnitureSceneX(285, 1, 100, 60, 320), 270);
});

test('each shelf scene approaches, interacts and returns every resident home', () => {
  for (const action of actions) {
    const start = shelfSceneFrame(action, 0), middle = shelfSceneFrame(action, 4200), end = shelfSceneFrame(action, SHELF_SCENE_MS);
    assert.ok(start.actors.every(a => a.travel === 0), action + ' starts at its actual slot');
    assert.ok(middle.actors.every(a => a.travel === 1), action + ' reaches its shared scene');
    assert.equal(middle.active, true);
    assert.ok(end.actors.every(a => a.travel === 0 && !a.moving && a.lift === 0 && a.scale === 1 && !a.pose), action + ' ends at rest');
    assert.equal(end.done, true); assert.equal(start.done, false);
  }
});
test('bath crosses above the rim, submerges only inside, then jumps back out', () => {
  const entry = shelfSceneFrame('bath', 1100), soaking = shelfSceneFrame('bath', 4500), exit = shelfSceneFrame('bath', 9700);
  assert.ok(entry.actors[0].lift > .5 && entry.actors[0].airborne); assert.equal(entry.bathInside, false);
  assert.equal(soaking.bathInside, true); assert.equal(soaking.splash, true);
  assert.equal(soaking.actors[0].pose, 'wash'); assert.ok(soaking.actors[0].scale < 1);
  assert.ok(exit.actors[0].lift > .5 && exit.actors[0].airborne);
  assert.equal(exit.bathInside, false); assert.equal(exit.splash, false);
});
test('bath seating exposes low faces while keeping the lower body under the same waterline', () => {
  for (const eyesAboveFeet of [20, 30, 50, 70]) {
    const { lift, clip } = bathWaterPlacement(100, 125, eyesAboveFeet);
    const waterDepth = 125 * 22 / 60;
    assert.ok(lift + eyesAboveFeet * .82 > waterDepth, 'the eyes remain above water');
    assert.ok(clip >= 8, 'part of the body remains immersed');
    assert.ok(Math.abs(lift + clip - waterDepth) < .001, 'the crop stays at the stationary tub rim');
  }
});
test('partner scenes have distinct shared physical responses', () => {
  const tug = shelfSceneFrame('tug', 4300), comfort = shelfSceneFrame('comfort', 4300), mirror = shelfSceneFrame('mirror', 4300), dance = shelfSceneFrame('dance', 4300);
  assert.ok(tug.actors[0].angle < 0 && tug.actors[1].angle > 0, 'both pull away from the rope');
  assert.deepEqual(comfort.actors.map(a => a.pose), ['comfort', 'receive']);
  assert.notEqual(mirror.actors[0].angle, mirror.actors[1].angle, 'the partner follows a little later');
  assert.ok(Math.abs(dance.actors[0].angle + dance.actors[1].angle) < .0001, 'dance partners counterbalance');
});
test('manual reduced-motion scenes retain their tableau without travel or splashes', () => {
  for (const action of actions) {
    const start = shelfSceneFrame(action, 0, true), later = shelfSceneFrame(action, 7300, true);
    assert.deepEqual(start.actors, later.actors, action + ' remains still between captions');
    assert.ok(start.actors.every(a => !a.moving && !a.airborne && a.lift === 0));
    assert.equal(later.splash, false); assert.notEqual(start.caption, later.caption);
  }
});
test('scene coordinates remain finite and bounded across a complete timeline', () => {
  for (const action of actions) for (let t = -50; t <= SHELF_SCENE_MS + 300; t += 137) {
    for (const actor of shelfSceneFrame(action, t).actors) {
      for (const key of ['travel', 'lift', 'offset', 'angle', 'scale']) assert.ok(Number.isFinite(actor[key]));
      assert.ok(actor.travel >= 0 && actor.travel <= 1); assert.ok(actor.scale >= .8 && actor.scale <= 1);
    }
  }
});
test('reserving a shelf clears old clips and releases its ownership idempotently', () => {
  const act = { style: { animation: 'old-clip 2s' }, onanimationend() {} };
  const sprite = { dataset: { pet: 'a' }, style: { removeProperty() {} }, querySelector: () => act, classList: { remove() {} } };
  let removed = 0;
  const root = { dataset: {}, querySelectorAll(selector) {
    if (selector === '.sprite.sl2') return [sprite];
    if (selector === '.pet') return [];
    return [{ remove() { removed++; } }];
  } };
  const release = reserveShelfAnimation(root);
  assert.equal(root.dataset.slTheatre, '1'); assert.equal(sprite.dataset.slReserved, '1');
  assert.equal(act.style.animation, ''); assert.equal(act.onanimationend, null); assert.equal(removed, 1);
  release(); release();
  assert.equal(root.dataset.slTheatre, undefined); assert.equal(sprite.dataset.slReserved, undefined);
});
