import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The polish pass: the copy, the scale on :root and the stylesheet that applies it.
const root = new URL('..', import.meta.url).pathname;
const read = file => readFileSync(join(root, file), 'utf8');
function sources(dir) {
  return readdirSync(join(root, dir)).flatMap(name => {
    const path = join(dir, name);
    return statSync(join(root, path)).isDirectory() ? sources(path) : path.endsWith('.js') ? [path] : [];
  });
}

test('no em or en dash appears in any string the game shows', () => {
  const found = [];
  for (const file of sources('src')) {
    // Block comments are blanked line for line, so the numbers still point at the source.
    const text = read(file).replace(/\/\*[\s\S]*?\*\//g, c => c.replace(/[^\n]/g, ' '));
    text.split('\n').forEach((line, i) => {
      const code = line.trim();
      if (/^(\/\/|\*|\/\*)/.test(code)) return; // comments are not shown to anyone
      // A dash inside a quoted string, on a line that is not a comment.
      if (/['"`][^'"`]*[\u2013\u2014]/.test(line.replace(/\/\/.*$/, ''))) found.push(file + ':' + (i + 1));
    });
  }
  for (const page of ['index.html', 'privacy.html', 'delete-account.html', 'manifest.webmanifest']) {
    if (/[\u2013\u2014]/.test(read(page))) found.push(page);
  }
  assert.deepEqual(found, []);
});

test('feature names keep one capitalisation', () => {
  const shown = sources('src').map(read).join('\n') + read('index.html');
  assert.doesNotMatch(shown, /The playroom|Open the playroom|the memory museum/);
});

test('the scale lives on :root and the polish sheet loads last and offline', () => {
  const style = read('css/style.css');
  const tokens = style.slice(style.indexOf(':root{'), style.indexOf('}', style.indexOf(':root{')));
  for (const name of ['--space-1', '--space-4', '--radius-sm', '--radius-sheet', '--text-xs', '--text-body', '--shadow-1', '--shadow-3', '--dur-press', '--dur-quick'])
    assert.match(tokens, new RegExp(name + ':'), name + ' is defined on :root');
  const html = read('index.html');
  const sheets = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m => m[1]);
  assert.equal(sheets.at(-1), 'css/polish.css');
  assert.match(read('service-worker.js'), /"\.\/css\/polish\.css"/);
  const polish = read('css/polish.css');
  assert.doesNotMatch(polish, /[\u2013\u2014]/);
  // Small print is lifted onto the scale, never below it.
  for (const m of polish.matchAll(/font-size:\s*([\d.]+)px/g)) assert.ok(Number(m[1]) >= 11, 'font-size ' + m[1] + 'px');
});

test('the first frame preloads the faces it is set in, and every preload is in the offline shell', () => {
  const html = read('index.html'), shell = read('service-worker.js');
  const preloads = [...html.matchAll(/<link rel="preload" href="([^"]+)" as="font" type="font\/woff2" crossorigin>/g)].map(m => m[1]);
  assert.ok(preloads.length >= 2);
  for (const href of preloads) {
    assert.ok(!href.startsWith('/'), 'relative URL');
    assert.ok(shell.includes('"./' + href + '"'), href + ' is cached for offline');
    assert.match(read('css/fonts.css'), new RegExp(href.replace(/^assets\/fonts\//, '').replace('.', '\\.')));
  }
});
