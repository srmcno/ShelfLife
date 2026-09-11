import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initShelfTheatre } from '../src/art/shelf-theatre.js';

// A small DOM fixture exercises the real controller and AbortSignal cleanup.
// Choreography geometry/CSS is checked separately in the browser.
function fixture(t) {
  const restore = new Map(), frames = new Map(), observers = new Set();
  let frameId = 0;
  class Node extends EventTarget {
    constructor(tag = 'div', classes = '') {
      super(); this.tagName = tag; this.className = classes; this.dataset = {}; this.children = [];
      this.textContent = ''; this.offsetWidth = 100; this.offsetHeight = 80;
      const properties = new Map();
      this.style = { setProperty: (k, v) => properties.set(k, v), getPropertyValue: k => properties.get(k) || '', removeProperty: k => properties.delete(k) };
      this.classList = { contains: name => this.className.split(' ').includes(name),
        add: (...names) => { this.className = [...new Set([...this.className.split(' '), ...names])].filter(Boolean).join(' '); },
        remove: (...names) => { this.className = this.className.split(' ').filter(n => !names.includes(n)).join(' '); },
        toggle: (name, value) => value ? this.classList.add(name) : this.classList.remove(name) };
    }
    get attributes() { return []; }
    get isConnected() { return this === document.body || !!this.parentElement?.isConnected; }
    appendChild(node) { node.parentElement = this; this.children.push(node); return node; }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(n => n !== this); this.parentElement = null; }
    setAttribute(name, value) { if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value; else this[name] = value; }
    removeAttribute(name) { if (name.startsWith('data-')) delete this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())]; else delete this[name]; }
    matches(selector) {
      if (selector === '*') return true;
      return selector.split(',').some(sel => {
        if (sel.includes(':') || sel.includes(' ')) return false;
        const tag = sel.match(/^[a-z]+/)?.[0];
        if (tag && tag !== this.tagName) return false;
        if ([...sel.matchAll(/\.([\w-]+)/g)].some(([, name]) => !this.classList.contains(name))) return false;
        for (const [, attr, value] of sel.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
          const actual = attr.startsWith('data-') ? this.dataset[attr.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] : this[attr];
          if (actual === undefined || value !== undefined && actual !== value) return false;
        }
        return true;
      });
    }
    closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
    querySelectorAll(selector) { return this.children.flatMap(c => [...(c.matches(selector) ? [c] : []), ...c.querySelectorAll(selector)]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    cloneNode(deep) { const node = new Node(this.tagName, this.className); node.dataset = { ...this.dataset }; if (deep) this.children.forEach(c => node.appendChild(c.cloneNode(true))); return node; }
    getBoundingClientRect() { return this.rect || { left: 0, top: 0, bottom: 300, width: 390, height: 300 }; }
    getClientRects() { return this.rendered === false ? [] : [this.getBoundingClientRect()]; }
  }
  function install(key, value) { restore.set(key, globalThis[key]); globalThis[key] = value; }
  const doc = new EventTarget(); doc.body = new Node(); doc.hidden = false;
  doc.createElement = tag => new Node(tag);
  doc.querySelectorAll = sel => doc.body.querySelectorAll(sel);
  doc.querySelector = sel => doc.body.querySelector(sel);
  const host = doc.body.appendChild(new Node()); host.id = 'cabinetWrap';
  const cabinet = host.appendChild(new Node()); cabinet.id = 'cabinet';
  const piece = cabinet.appendChild(new Node('button', 'pet piece'));
  piece.dataset = { id: 'a', slot: '0' }; piece.rect = { left: 10, top: 30, bottom: 160, width: 70, height: 130 };
  const sprite = piece.appendChild(new Node('div', 'sprite sl2')); sprite.dataset.pet = 'a';
  sprite.appendChild(new Node('div', 'sprite-act')).appendChild(new Node('div', 'sprite-figure'));
  const name = piece.appendChild(new Node('span', 'nameplate')); name.textContent = 'Moth';
  const prop = cabinet.appendChild(new Node('button', 'prop piece')); prop.dataset = { id: 'lamp', prop: 'lamp', slot: '1', lit: 'true' };
  prop.appendChild(new Node('svg'));
  doc.getElementById = id => id === 'cabinet' ? cabinet : id === 'cabinetWrap' ? host : null;
  const win = new EventTarget(), media = new EventTarget(); media.matches = false; win.matchMedia = () => media;
  class Observer { constructor(callback) { this.callback = callback; } observe() { observers.add(this); } disconnect() { observers.delete(this); } }
  install('document', doc); install('window', win); install('MutationObserver', Observer); install('ResizeObserver', undefined);
  install('requestAnimationFrame', callback => { frames.set(++frameId, callback); return frameId; }); install('cancelAnimationFrame', id => frames.delete(id));
  t.after(() => restore.forEach((value, key) => { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }));
  const done = [], captions = [], state = { slots: ['a', 'lamp'] };
  const controller = initShelfTheatre({ getState: () => state, onDone: (event, result) => done.push(result), onCaption: text => captions.push(text) });
  const event = { action: 'lamp', actorIds: ['a'], propId: 'lamp', before: { lit: false }, after: { lit: true }, lines: [{ actorId: 'a', text: 'Light, please.' }] };
  return { controller, event, done, captions, state, cabinet, host, sprite, prop, doc, win, media, observers, frames,
    step(time) { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time)); },
    mutate() { [...observers].forEach(o => o.callback()); }
  };
}

test('finishing a real controller removes clones, restores actors and stops animation work', t => {
  const f = fixture(t);
  assert.equal(f.controller.play(f.event), true);
  assert.equal(f.sprite.classList.contains('sl-theatre-source'), true);
  f.step(0); assert.equal(f.prop.dataset.theatreLit, 'false');
  f.step(3200); assert.equal(f.prop.dataset.theatreLit, 'true');
  f.step(8000); assert.equal(f.prop.dataset.theatreLit, 'true', 'a solo switch must not toggle back');
  f.step(11300);
  assert.deepEqual(f.done, [{ cancelled: false, reason: 'complete' }]);
  assert.equal(f.controller.isPlaying(), false);
  assert.equal(f.sprite.classList.contains('sl-theatre-source'), false);
  assert.equal(f.prop.dataset.theatreLit, undefined);
  assert.equal(f.cabinet.dataset.slTheatre, undefined);
  assert.equal(f.host.querySelectorAll('.shelf-theatre').length, 0);
  assert.equal(f.frames.size, 0); assert.equal(f.observers.size, 0);
});

test('resize, drag start, visibility and motion changes cancel without leaving ownership behind', t => {
  const f = fixture(t);
  for (const [target, type] of [[f.win, 'resize'], [f.cabinet, 'pointerdown'], [f.doc, 'visibilitychange'], [f.media, 'change']]) {
    assert.equal(f.controller.play(f.event), true); f.step(0);
    target.dispatchEvent(new Event(type));
    assert.equal(f.controller.isPlaying(), false);
    assert.equal(f.frames.size, 0); assert.equal(f.observers.size, 0);
    assert.equal(f.sprite.classList.contains('sl-theatre-source'), false);
    assert.equal(f.prop.dataset.theatreLit, undefined);
  }
  assert.equal(f.done.length, 4);
  assert.ok(f.done.every(result => result.cancelled));
});

test('a changed shelf layout cancels and repeated stop cannot notify twice', t => {
  const f = fixture(t);
  f.controller.play(f.event); f.step(0);
  f.state.slots.reverse(); f.mutate();
  f.controller.stop(); f.controller.stop();
  assert.equal(f.done.length, 1); assert.equal(f.done[0].cancelled, true);
  assert.equal(f.host.querySelectorAll('.shelf-theatre').length, 0);
  assert.equal(f.frames.size, 0);
});

test('missing participants and hidden shelves do not acquire the animation room', t => {
  const f = fixture(t);
  assert.equal(f.controller.play({ ...f.event, actorIds: ['missing'] }), false);
  f.doc.hidden = true;
  assert.equal(f.controller.play(f.event), false);
  assert.equal(f.cabinet.dataset.slTheatre, undefined);
  assert.equal(f.frames.size, 0); assert.equal(f.done.length, 0);
});

test('CSS-hidden phone shelves cancel, while a still-visible desktop shelf may continue beside Notes', t => {
  const f = fixture(t);
  f.controller.play(f.event); f.step(0);
  f.doc.body.dataset.tab = 'notes'; f.mutate();
  assert.equal(f.controller.isPlaying(), true, 'desktop still displays the shelf beside Notes');
  f.cabinet.rendered = false; f.mutate();
  assert.equal(f.controller.isPlaying(), false, 'phone navigation hides the shelf through CSS');
  assert.equal(f.frames.size, 0); assert.equal(f.observers.size, 0);
  assert.equal(f.controller.play(f.event), false, 'a hidden tab cannot start another scene');
});
