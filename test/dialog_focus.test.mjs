import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initDialogs } from '../src/ui/dialogs.js';

// Exercise the shared focus/Escape controller with actual event order: targets
// can consume Escape before the document, whose later game listeners must wait.
function fixture(t) {
  const previous = { document: globalThis.document, MutationObserver: globalThis.MutationObserver, queueMicrotask: globalThis.queueMicrotask, setTimeout: globalThis.setTimeout };
  const observers = [], microtasks = [], timers = [], events = new Map();
  class Node {
    constructor(tag = 'div', id = '', classes = '') {
      this.tagName = tag.toUpperCase(); this.id = id; this.children = []; this.parentElement = null;
      this.dataset = {}; this.style = {}; this.attributes = new Map(); this.disabled = false; this.inert = false; this.hidden = false; this.visible = true;
      this.classes = new Set(classes.split(' ').filter(Boolean)); this.listeners = new Map();
      this.classList = { contains: name => this.classes.has(name), add: name => this.classes.add(name), remove: name => this.classes.delete(name),
        toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name) };
    }
    get isConnected() { return this === doc.body || !!this.parentElement?.isConnected; }
    get tabIndex() { return this.attributes.has('tabindex') ? Number(this.attributes.get('tabindex')) : ['BUTTON','INPUT','SELECT','TEXTAREA','SUMMARY','A'].includes(this.tagName) ? 0 : -1; }
    set tabIndex(value) { this.attributes.set('tabindex', String(value)); }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    hasAttribute(name) { return this.attributes.has(name); }
    append(child) { child.parentElement = this; this.children.push(child); return child; }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    remove() { this.parentElement.children = this.parentElement.children.filter(child => child !== this); this.parentElement = null; }
    matches(selector) {
      if (selector === '.sheet-head button') return this.tagName === 'BUTTON' && !!this.parentElement?.closest('.sheet-head');
      const tag = selector.match(/^[a-z][a-z0-9]*/i)?.[0];
      if (tag && this.tagName !== tag.toUpperCase()) return false;
      const id = selector.match(/#([\w-]+)/)?.[1]; if (id && this.id !== id) return false;
      if ([...selector.matchAll(/\.([\w-]+)/g)].some(([, cls]) => !this.classes.has(cls))) return false;
      for (const [, name, value] of selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
        if (name === 'inert' || name === 'hidden') { if (!this[name]) return false; }
        else if (!this.attributes.has(name) || value !== undefined && this.attributes.get(name) !== value) return false;
      }
      return true;
    }
    closest(selector) { return selector.split(',').some(part => this.matches(part.trim())) ? this : this.parentElement?.closest(selector) || null; }
    querySelectorAll(selector) {
      const all = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
      return selector === '*' ? all : all.filter(node => selector.split(',').some(part => node.matches(part.trim())));
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    getClientRects() { return this.isConnected && this.visible && !this.hidden && (!this.parentElement || this.parentElement.getClientRects().length) ? [{}] : []; }
    focus() { if (this.getClientRects().length && !this.disabled && !this.closest('[inert]')) doc.activeElement = this; }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    click() { dispatchClick(this, false); }
  }
  const doc = { body: null, activeElement: null,
    addEventListener(type, callback, capture = false) { const list = events.get(type) || []; list.push({ callback, capture }); events.set(type, list); },
    getElementById(id) { return doc.body.querySelectorAll('*').find(node => node.id === id) || null; },
    querySelectorAll(selector) { return selector === '#cabinet .piece' ? cabinet.querySelectorAll('.piece') : doc.body.querySelectorAll(selector); },
    querySelector(selector) { return doc.querySelectorAll(selector)[0] || null; }
  };
  doc.body = new Node('body'); doc.activeElement = doc.body;
  const app = doc.body.append(new Node('main', 'app')), cabinet = app.append(new Node('div', 'cabinet'));
  const makeElement = (tag, id, parent = app) => parent.append(new Node(tag, id));
  const makeButton = (id, parent = app) => makeElement('button', id, parent);
  const opener = makeButton('opener'), newPet = makeButton('newPetBtn');
  const more = makeButton('moreBtn'), tabMore = makeButton('tabMore');
  const activeTab = makeButton('activeTab'); activeTab.classes.add('tab'); activeTab.setAttribute('aria-current', 'page');
  const panel = (id, { tray = false, cancel = false } = {}) => {
    const root = doc.body.append(new Node('div', id, tray ? 'tray' : 'veil'));
    const head = root.append(new Node('div', '', tray ? 'tray-head' : 'sheet-head'));
    const title = head.append(new Node('h2'));
    const close = makeButton(tray ? 'moreClose' : cancel ? 'restoreCancel' : id + 'Close', cancel ? root : head);
    let closed = 0; close.addEventListener('click', () => { closed++; root.classList.remove('open'); });
    return { root, title, close, get closed() { return closed; } };
  };
  const card = panel('cardVeil'), play = panel('playVeil'), restore = panel('restoreVeil', { cancel: true }), tray = panel('moreTray', { tray: true });
  const event = (target, extra = {}) => ({ target, defaultPrevented: false, stopped: false, immediate: false,
    preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; },
    stopImmediatePropagation() { this.stopped = this.immediate = true; }, ...extra });
  function dispatchClick(target, trusted = true, checkpoint = false) {
    const e = event(target, { isTrusted: trusted });
    for (const listener of events.get('click') || []) if (listener.capture) listener.callback(e);
    if (checkpoint) while (microtasks.length) microtasks.shift()();
    target.listeners.get('click')?.(e);
    for (const listener of events.get('click') || []) if (!listener.capture) listener.callback(e);
  }
  globalThis.document = doc;
  globalThis.MutationObserver = class { constructor(callback) { this.callback = callback; } observe() { observers.push(this.callback); } };
  globalThis.queueMicrotask = callback => microtasks.push(callback);
  globalThis.setTimeout = callback => timers.push(callback);
  t.after(() => Object.assign(globalThis, previous));
  initDialogs();
  let hiddenGameCloses = 0;
  doc.addEventListener('keydown', e => { if (e.key === 'Escape') hiddenGameCloses++; });
  return { doc, app, cabinet, makeElement, makeButton, opener, newPet, more, tabMore, activeTab, card, play, restore, tray,
    click: dispatchClick, get hiddenGameCloses() { return hiddenGameCloses; },
    flush() { observers.forEach(callback => callback()); while (microtasks.length) microtasks.shift()(); while (timers.length) timers.shift()(); },
    open(dialog, trigger = opener) { trigger.addEventListener('click', () => dialog.root.classList.add('open')); dispatchClick(trigger); this.flush(); },
    key(target, key, values = {}) {
      const e = event(target, { key, ...values }); target.listeners.get('keydown')?.(e);
      if (!e.stopped) for (const listener of events.get('keydown') || []) { listener.callback(e); if (e.immediate) break; }
      return e;
    }
  };
}

test('pointer-opened dialogs return focus to the real trigger even when the browser did not focus its button', t => {
  const f = fixture(t); f.doc.activeElement = f.newPet;
  f.open(f.card);
  assert.equal(f.doc.activeElement, f.card.title); assert.equal(f.app.inert, true);
  f.card.close.click(); f.flush();
  assert.equal(f.doc.activeElement, f.opener); assert.equal(f.app.inert, false);
});

test('a native event microtask checkpoint cannot forget the opener before the target opens its sheet', t => {
  const f = fixture(t); f.doc.activeElement = f.newPet;
  f.opener.addEventListener('click', () => f.card.root.classList.add('open'));
  f.click(f.opener, true, true); f.flush();
  assert.equal(f.doc.activeElement, f.card.title);
  f.card.close.click(); f.flush();
  assert.equal(f.doc.activeElement, f.opener);
});

test('More-to-sheet handoffs preserve the original opener and choose its visible counterpart after rotation', t => {
  const f = fixture(t); f.more.visible = false;
  f.open(f.tray, f.tabMore);
  const action = f.makeButton('playroomBtn', f.tray.root);
  action.addEventListener('click', () => { f.tray.root.classList.remove('open'); f.play.root.classList.add('open'); });
  f.click(action); f.flush();
  f.tabMore.visible = false; f.more.visible = true;
  f.play.close.click(); f.flush();
  assert.equal(f.doc.activeElement, f.more);
});

test('closing a resident card follows its replacement shelf node, and disabled openers are never focus targets', t => {
  const f = fixture(t), resident = f.makeButton('old-resident', f.cabinet);
  resident.classes.add('piece'); resident.dataset.id = 'pet-one';
  f.open(f.card, resident); resident.remove();
  const replacement = f.makeButton('new-resident', f.cabinet); replacement.classes.add('piece'); replacement.dataset.id = 'pet-one';
  f.card.close.click(); f.flush(); assert.equal(f.doc.activeElement, replacement);
  f.open(f.card); f.opener.disabled = true; f.newPet.disabled = true;
  f.card.close.click(); f.flush(); assert.equal(f.doc.activeElement, f.activeTab);
});

test('Escape invokes only the active owner cleanup, including safe Cancel for restore previews', t => {
  const f = fixture(t); f.open(f.play);
  const e = f.key(f.play.close, 'Escape'); f.flush();
  assert.equal(e.defaultPrevented, true); assert.equal(f.play.closed, 1); assert.equal(f.hiddenGameCloses, 0);
  assert.equal(f.doc.activeElement, f.opener);
  f.open(f.restore);
  f.key(f.restore.title, 'Escape'); f.flush();
  assert.equal(f.restore.closed, 1); assert.equal(f.hiddenGameCloses, 0);
  f.open(f.tray, f.more); f.key(f.tray.title, 'Escape'); f.flush();
  assert.equal(f.tray.closed, 1); assert.equal(f.doc.activeElement, f.more);
});

test('Escape respects native choices, composition, held keys and an inline control’s own dismissal', t => {
  const f = fixture(t); f.open(f.card);
  const choice = f.makeButton('choice', f.card.root); choice.tagName = 'SELECT';
  assert.equal(f.key(choice, 'Escape').defaultPrevented, false, 'the native choice can dismiss itself');
  f.key(f.card.close, 'Escape', { isComposing: true });
  f.key(f.card.close, 'Escape', { repeat: true });
  const rename = f.makeButton('renameField', f.card.root);
  let cancelled = 0; rename.addEventListener('keydown', e => { e.preventDefault(); e.stopPropagation(); cancelled++; });
  f.key(rename, 'Escape');
  assert.equal(cancelled, 1); assert.equal(f.card.closed, 0); assert.equal(f.hiddenGameCloses, 0);
});

test('Tab stays inside the active dialog and skips disabled and hidden controls', t => {
  const f = fixture(t), last = f.makeButton('last', f.card.root), hidden = f.makeButton('hidden', f.card.root);
  hidden.hidden = true; f.open(f.card);
  f.key(f.card.title, 'Tab'); assert.equal(f.doc.activeElement, f.card.close);
  f.key(f.card.close, 'Tab', { shiftKey: true }); assert.equal(f.doc.activeElement, last);
  f.key(last, 'Tab'); assert.equal(f.doc.activeElement, f.card.close);
  last.disabled = true;
  f.key(f.card.close, 'Tab'); assert.equal(f.doc.activeElement, f.card.close);
});

test('Tab skips collapsed details content even when it retains rectangles, while keeping the first summary usable', t => {
  const f = fixture(t), details = f.makeElement('details', 'replayOptions', f.play.root);
  const summary = f.makeElement('summary', 'replaySummary', details);
  const summaryControl = f.makeButton('summaryControl', summary);
  const encore = f.makeButton('playEncore', details);
  const secondSummary = f.makeElement('summary', 'secondSummary', details);
  const nested = f.makeElement('details', 'nestedOptions', details); nested.open = true;
  const nestedSummary = f.makeElement('summary', 'nestedSummary', nested);
  const nestedControl = f.makeButton('nestedControl', nested);
  f.open(f.play);
  assert.equal(encore.getClientRects().length, 1, 'reproduce retained layout rectangles for collapsed content');
  f.key(f.play.close, 'Tab', { shiftKey: true });
  assert.equal(f.doc.activeElement, summaryControl, 'only the first summary subtree remains in the focus boundary');
  f.key(summaryControl, 'Tab'); assert.equal(f.doc.activeElement, f.play.close);
  summaryControl.disabled = true;
  f.key(f.play.close, 'Tab', { shiftKey: true }); assert.equal(f.doc.activeElement, summary);
  details.open = true;
  f.play.close.focus();
  f.key(f.play.close, 'Tab', { shiftKey: true }); assert.equal(f.doc.activeElement, nestedControl, 'expanding restores descendant controls');
  nested.open = false;
  f.play.close.focus();
  f.key(f.play.close, 'Tab', { shiftKey: true }); assert.equal(f.doc.activeElement, nestedSummary, 'nested collapsed content obeys its own boundary');
  details.open = false;
  secondSummary.focus();
  f.key(secondSummary, 'Tab'); assert.equal(f.doc.activeElement, f.play.close, 'later summaries do not bypass the closed boundary');
});
