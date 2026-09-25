import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Exercise the real document handlers without a browser. These checks cover
// gesture cancellation, not viewport layout or physical-device behaviour.
function sheetGesture({id='',mode=''}={}) {
  const events = new Map(), classes = new Set();
  let closed = 0;
  const sheet = {
    scrollTop: 0, style: {},
    classList: { add: name => classes.add(name), remove: name => classes.delete(name) }
  };
  const veil = { id, classList:{contains:name=>name===mode}, querySelector: () => ({ click: () => closed++ }) };
  const head = { closest: name => name === '.sheet' ? sheet : name === '.veil' ? veil : null };
  const target = { closest: name => name === '.sheet-head' ? head : null };
  const document = {
    body: { dataset: {}, style: {} },
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener(name, listener) {
      const list = events.get(name) || [];
      list.push(listener); events.set(name, list);
    }
  };
  const source = readFileSync(new URL('../src/ui/nav.js', import.meta.url), 'utf8')
    .replace(/^import[^\n]+\n/m, '')
    .replace(/export function /g, 'function ');
  runInNewContext(source, {
    document,
    window: { matchMedia: () => ({ matches: true, addEventListener() {} }), addEventListener() {}, scrollTo() {} },
    localStorage: { getItem: () => null, setItem() {} },
    state: {}, onNote() {}
  });
  return {
    sheet, classes,
    get closed() { return closed; },
    fire(name, values = {}) {
      const e = { target, pointerType: 'touch', isPrimary: true, pointerId: 1, clientX: 150, clientY: 100, ...values };
      for (const listener of events.get(name) || []) listener(e);
    }
  };
}

test('cancelling a long sheet pull leaves the game open and restores its position', () => {
  const g = sheetGesture();
  g.fire('pointerdown');
  g.fire('pointermove', { clientY: 250 });
  assert.equal(g.sheet.style.transform, 'translateY(150px)');
  g.fire('pointercancel', { clientY: 250 });
  assert.equal(g.closed, 0);
  assert.equal(g.sheet.style.transform, '');
  assert.equal(g.classes.has('sheet-dragging'), false);
});

test('an intentional downward pull still closes through the game close button', () => {
  const g = sheetGesture();
  g.fire('pointerdown');
  g.fire('pointermove', { clientY: 240 });
  g.fire('pointerup', { clientY: 240 });
  assert.equal(g.closed, 1);
  assert.equal(g.sheet.style.transform, '');
});

test('full-screen game workspaces cannot be pulled away while using their headers', () => {
  for(const config of [{id:'arcadeVeil'},{id:'playroomVeil'},{id:'lifeVeil',mode:'life-game-mode'}]){
    const g=sheetGesture(config);
    g.fire('pointerdown');g.fire('pointermove',{clientY:280});g.fire('pointerup',{clientY:280});
    assert.equal(g.closed,0,config.id+' '+config.mode);
    assert.equal(g.sheet.style.transform,undefined);
    assert.equal(g.classes.has('sheet-dragging'),false);
  }
});

test('a horizontal browser edge gesture cannot become an accidental sheet dismissal', () => {
  const g = sheetGesture();
  g.fire('pointerdown');
  g.fire('pointermove', { clientX: 200, clientY: 106 });
  g.fire('pointermove', { clientX: 210, clientY: 300 });
  g.fire('pointerup', { clientX: 210, clientY: 300 });
  assert.equal(g.closed, 0);
  assert.equal(g.sheet.style.transform, '');
});

test('a second touch cannot replace a sheet pull or leave its transform stranded', () => {
  const g = sheetGesture();
  g.fire('pointerdown');
  g.fire('pointermove', { clientY: 150 });
  g.fire('pointerdown', { pointerId: 2, isPrimary: false });
  g.fire('pointermove', { pointerId: 2, clientY: 300, isPrimary: false });
  g.fire('pointerup', { pointerId: 2, clientY: 300, isPrimary: false });
  assert.equal(g.sheet.style.transform, 'translateY(50px)');
  g.fire('pointerup', { clientY: 150 });
  assert.equal(g.closed, 0);
  assert.equal(g.sheet.style.transform, '');
});
