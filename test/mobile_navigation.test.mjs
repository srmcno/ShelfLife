import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Exercise real navigation handlers and owner cleanup without asserting layout.
// These are behavioural checks, not a substitute for a physical phone preview.
function navigation({widePhone=false}={}) {
  const events = new Map(), windowEvents = new Map(), observers = [], frames = [], elements = new Map();
  const make = (id, dataset = {}) => {
    const listeners = new Map(), attributes = new Map(), classes = new Set();
    const element = { id, dataset, style: {}, textContent: 'Close',
      classList: { contains: value => classes.has(value), add: value => classes.add(value), remove: (...values) => values.forEach(value => classes.delete(value)), toggle: (value, enabled) => enabled ? classes.add(value) : classes.delete(value) },
      setAttribute: (name, value) => attributes.set(name, value), getAttribute: name => attributes.get(name) ?? null, removeAttribute: name => attributes.delete(name),
      addEventListener: (name, listener) => listeners.set(name, listener), fire: (name, event) => listeners.get(name)?.(event),
      closest: () => null, querySelector: () => null, focus() {}
    };
    elements.set(id, element); return element;
  };
  const tabs = ['shelf', 'notes', 'plots'].map(name => make('tab-' + name, { tab: name }));
  const logo = make('logo'), playroom = make('playroomVeil'), play = make('playVeil'), life = make('lifeVeil'), tray = make('moreTray');
  const playClose = make('playClose'), lifeClose = make('lifeClose'), playroomButton = make('playroomBtn');
  const destination = tabIndex => ({ isConnected: true, tabIndex, focused: false, scrolled: false,
    hasAttribute: () => false, focus() { this.focused = true; }, scrollIntoView() { this.scrolled = true; } });
  const workshop = destination(-1), noteFilters = destination(0);
  play.querySelector = () => playClose; life.querySelector = () => lifeClose;
  let cleaned = 0, returned = 0;
  playClose.click = () => { cleaned++; play.classList.remove('open'); };
  lifeClose.click = () => { cleaned++; life.classList.remove('open'); };
  playroomButton.click = () => { returned++; playroom.classList.add('open'); };
  const document = {
    body: { dataset: {}, style: {} },
    getElementById: id => elements.get(id) || null,
    querySelector: selector => selector === '.household-workshop' ? workshop : selector === '#noteFilters' ? noteFilters :
      selector === '.veil.open,#moreTray.open' ? [playroom, play, life, tray].find(veil => veil.classList.contains('open')) || null : null,
    querySelectorAll: selector => selector === '.tabbar .tab[data-tab]' ? tabs : selector === '.wordmark' ? [logo] : selector === '#lifeVeil' ? [life] : selector === '.veil.open' ? [playroom, play, life].filter(veil => veil.classList.contains('open')) : [],
    addEventListener(name, listener) { const list = events.get(name) || []; list.push(listener); events.set(name, list); }
  };
  const window = { scrollY: 0, matchMedia: query => ({ matches: !widePhone || query.includes('pointer:coarse'), addEventListener() {} }), addEventListener(name, listener) { windowEvents.set(name, listener); }, scrollTo({ top }) { this.scrollY = top; } };
  const source = readFileSync(new URL('../src/ui/nav.js', import.meta.url), 'utf8').replace(/^import[^\n]+\n/m, '').replace(/export function /g, 'function ');
  const context = { document, window, requestAnimationFrame: callback => frames.push(callback), localStorage: { getItem: () => null, setItem() {} }, state: {}, onNote() {}, MutationObserver: class { constructor(callback) { this.callback = callback; } observe() { observers.push(this.callback); } } };
  runInNewContext(source + '\nglobalThis.api={setTab,currentTab};', context);
  return { ...context.api, window, logo, play, life, playroom, tray, playClose, lifeClose, workshop, noteFilters,
    flushFrames() { frames.splice(0).forEach(callback => callback()); },
    navigate(detail) { windowEvents.get('shelflife:goto')({detail}); },
    get cleaned() { return cleaned; }, get returned() { return returned; },
    flush() { observers.forEach(callback => callback()); },
    chooseGame(kind = 'chase') {
      playroom.classList.add('open');
      const activity = { dataset: { activity: kind }, closest: selector => selector === '#playroomVeil.open' ? playroom : null };
      const target = { closest: selector => selector === '[data-activity]' ? activity : null };
      for (const listener of events.get('click') || []) listener({ target });
      playroom.classList.remove('open'); (kind === 'outing' ? life : play).classList.add('open'); this.flush();
    }
  };
}

test('phone tabs preserve separate reading positions and an explicit top action resets only the active pane', () => {
  const nav = navigation(); nav.window.scrollY = 185;
  nav.setTab('notes'); assert.equal(nav.window.scrollY, 0);
  nav.window.scrollY = 470; nav.setTab('plots'); nav.window.scrollY = 90;
  nav.setTab('notes'); assert.equal(nav.window.scrollY, 470);
  nav.setTab('shelf'); assert.equal(nav.window.scrollY, 185);
  nav.setTab('shelf', { top: true }); assert.equal(nav.window.scrollY, 0);
  nav.setTab('plots'); assert.equal(nav.window.scrollY, 90);
});

test('the logo returns from a hidden notes pane to the shelf instead of following an invisible anchor', () => {
  const nav = navigation(); nav.setTab('notes'); nav.window.scrollY = 300;
  let prevented = false; nav.logo.fire('click', { preventDefault() { prevented = true; } });
  assert.equal(prevented, true); assert.equal(nav.currentTab(), 'shelf'); assert.equal(nav.window.scrollY, 0);
});

test('Back to games runs the game close handler once before reopening the catalogue', () => {
  const nav = navigation(); nav.chooseGame('outing');
  assert.equal(nav.lifeClose.textContent, 'Back to games');
  nav.lifeClose.click(); nav.flush();
  assert.equal(nav.cleaned, 1); assert.equal(nav.returned, 1);
  assert.equal(nav.playroom.classList.contains('open'), true); assert.equal(nav.lifeClose.textContent, 'Close');
  nav.flush(); assert.equal(nav.returned, 1);
});

test('wide phone landscape keeps the same return to games without switching the shelf panes', () => {
  const nav=navigation({widePhone:true});nav.chooseGame('outing');
  assert.equal(nav.lifeClose.textContent,'Back to games');
  nav.lifeClose.click();nav.flush();
  assert.equal(nav.cleaned,1);assert.equal(nav.returned,1);
});

test('a game opened directly from a resident closes normally without an invented return destination', () => {
  const nav = navigation(); nav.life.classList.add('open'); nav.flush();
  assert.equal(nav.lifeClose.textContent, 'Close'); nav.lifeClose.click(); nav.flush();
  assert.equal(nav.cleaned, 1); assert.equal(nav.returned, 0);
});

test('returning home from an expedition reveals the workshop instead of reopening the catalogue', () => {
  const nav = navigation(); nav.setTab('plots'); nav.chooseGame('outing');
  nav.lifeClose.click();
  nav.navigate({tab:'shelf', target:'.household-workshop'});
  assert.equal(nav.workshop.focused, false, 'wait for dialog inert and opener cleanup');
  nav.flush();
  nav.flushFrames();
  assert.equal(nav.currentTab(), 'shelf');
  assert.equal(nav.cleaned, 1); assert.equal(nav.returned, 0);
  assert.equal(nav.playroom.classList.contains('open'), false);
  assert.equal(nav.lifeClose.textContent, 'Close');
  assert.equal(nav.workshop.focused, true);
  assert.equal(nav.workshop.scrolled, true);
});

test('a pending destination cannot steal focus from a newly opened dialog', () => {
  const nav = navigation();
  nav.navigate({tab:'shelf', target:'.household-workshop'});
  nav.play.classList.add('open'); nav.flush(); nav.flushFrames();
  assert.equal(nav.workshop.focused, false);
});

test('the latest navigation request wins and existing controls remain in the tab order', () => {
  const nav = navigation();
  nav.navigate({ tab: 'shelf', target: '.household-workshop' });
  nav.navigate({ tab: 'notes', target: '#noteFilters' });
  nav.flushFrames();
  assert.equal(nav.currentTab(), 'notes');
  assert.equal(nav.workshop.focused, false); assert.equal(nav.workshop.scrolled, false);
  assert.equal(nav.noteFilters.focused, true); assert.equal(nav.noteFilters.scrolled, true);
  assert.equal(nav.noteFilters.tabIndex, 0, 'navigation must not remove an existing control from keyboard order');
});

test('opening More prevents a pending destination from scrolling or focusing its inert background', () => {
  const nav = navigation();
  nav.navigate({ tab: 'shelf', target: '.household-workshop' });
  nav.tray.classList.add('open');
  nav.flushFrames();
  assert.equal(nav.workshop.focused, false); assert.equal(nav.workshop.scrolled, false);
});
