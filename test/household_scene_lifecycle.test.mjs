import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mountHouseholdScene } from '../src/art/household-scene.js';

// Exercise the real director with controlled visibility and timers. This checks
// lifecycle behavior, not browser rendering or animation geometry.
function fixture(t, { modal = false, reduced = false, intersections = true } = {}) {
  const restore = new Map(), timers = new Map(), mutations = [], views = [];
  let nextTimer = 0;
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
    append(...nodes) { nodes.forEach(node => this.appendChild(node)); }
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

  function install(key, value) { restore.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, writable: true, configurable: true }); }
  const doc = new EventTarget(); doc.body = new Node(); doc.hidden = false;
  doc.createElement = tag => new Node(tag);
  doc.querySelectorAll = selector => doc.body.querySelectorAll(selector);
  const dialog = doc.body.appendChild(new Node('div', 'veil' + (modal ? ' open' : '')));
  const host = (modal ? dialog : doc.body).appendChild(new Node());
  const media = new EventTarget(); media.matches = reduced;
  class Mutation { constructor(callback) { this.callback = callback; this.targets = []; mutations.push(this); } observe(node) { this.targets.push(node); } disconnect() { this.targets = []; } }
  class Intersection { constructor(callback) { this.callback = callback; views.push(this); } observe(node) { this.target = node; } disconnect() { this.target = null; } }
  install('document', doc); install('window', { matchMedia: () => media });
  install('MutationObserver', Mutation); install('IntersectionObserver', intersections ? Intersection : undefined);
  install('setTimeout', callback => { const id = ++nextTimer; timers.set(id, callback); return id; });
  install('clearTimeout', id => timers.delete(id));
  t.after(() => { player.destroy(); for (const [key, descriptor] of restore) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
  const player = mountHouseholdScene(host, { pets: [] }, { title: 'A domestic dispute', cast: [], stage: { key: 'scheme:raisin', branch: '0' } });
  const root = host.children[0];
  return { player, root, doc, dialog, timers, media, mutations, views,
    mutate: () => mutations.forEach(observer => observer.callback([])),
    visible: value => views.forEach(observer => observer.callback([{ target: root, isIntersecting: value }])) };
}

test('inline scenes stop behind a dialog and require deliberate replay', t => {
  const f = fixture(t); assert.ok(f.timers.size > 0);
  f.dialog.classList.add('open'); f.mutate();
  assert.equal(f.timers.size, 0); assert.ok(f.root.classList.contains('is-paused'));
  const beat = f.root.dataset.beat;
  f.player.play(); f.player.step(); assert.equal(f.root.dataset.beat, beat); assert.equal(f.timers.size, 0);
  f.dialog.classList.remove('open'); f.mutate(); assert.equal(f.timers.size, 0);
  f.player.play(); assert.ok(f.timers.size > 0);
});

test('offscreen scenes cancel all work and release both observers on destroy', t => {
  const f = fixture(t); f.visible(false); assert.equal(f.timers.size, 0);
  f.player.play(); f.player.step(); assert.equal(f.timers.size, 0);
  f.visible(true); assert.equal(f.timers.size, 0);
  f.player.play(); assert.ok(f.timers.size > 0);
  f.player.destroy(); assert.equal(f.timers.size, 0);
  assert.equal(f.mutations[0].targets.length, 0); assert.equal(f.views[0].target, null);
  f.visible(true); f.player.play(); assert.equal(f.timers.size, 0);
});

test('scene inside its own open dialog can play, then stops when closed', t => {
  const f = fixture(t, { modal: true }); assert.ok(f.timers.size > 0);
  f.dialog.classList.remove('open'); f.mutate(); assert.equal(f.timers.size, 0);
  f.player.play(); assert.equal(f.timers.size, 0);
});

test('hidden tabs stop and reduced-motion manual beats schedule no animation', t => {
  const f = fixture(t); f.doc.hidden = true; f.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(f.timers.size, 0); f.player.step(); assert.equal(f.timers.size, 0);
  f.doc.hidden = false; f.media.matches = true; f.media.dispatchEvent(new Event('change'));
  const beat = f.root.dataset.beat;
  f.player.step(); assert.equal(f.root.dataset.beat, beat + 1); assert.equal(f.timers.size, 0); assert.equal(f.root.classList.contains('is-moving'), false);
});

test('dialog interruption works without IntersectionObserver support', t => {
  const f = fixture(t, { intersections: false }); assert.ok(f.timers.size > 0);
  f.dialog.classList.add('open'); f.mutate(); assert.equal(f.timers.size, 0);
});

test('light effects preserve a requested scene timeline and still stop when its dialog closes', t => {
  const f = fixture(t, { modal: true });
  f.player.pause(); f.doc.body.dataset.effects = 'light'; f.mutate();
  f.player.play(); assert.ok(f.timers.size > 0); assert.equal(f.root.classList.contains('is-moving'), true);
  f.dialog.classList.remove('open'); f.mutate(); assert.equal(f.timers.size, 0);
});
