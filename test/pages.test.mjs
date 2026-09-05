import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

test('Pages package includes the full game, excludes development files, and versions offline assets', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'shelf-life-pages-'));
  const output = join(scratch, 'site');
  try {
    execFileSync('python3', ['-c', 'import sys; from scripts.build_site import build; build(sys.argv[1])', output], { cwd: resolve('.') });
    for (const path of ['index.html', 'src/main.js', 'css/style.css', 'assets/fonts/caveat-500-normal.ttf', 'manifest.webmanifest', '.nojekyll']) {
      assert.ok(existsSync(join(output, path)), `Missing ${path}`);
    }
    for (const path of ['scripts', 'test', 'docs', '.git', '.github', 'README.md']) assert.ok(!existsSync(join(output, path)));
    const revision = JSON.parse(readFileSync(join(output, 'release.json'), 'utf8')).revision;
    assert.match(revision, /^[0-9a-f]{40}$/);
    const worker = readFileSync(join(output, 'service-worker.js'), 'utf8');
    assert.ok(worker.includes(`shelflife-${revision.slice(0, 12)}`));
    for (const match of worker.matchAll(/"\.\/([^"\n]+)"/g)) assert.ok(existsSync(join(output, match[1])), `Offline asset missing: ${match[1]}`);
    const html = readFileSync(join(output, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /(?:src|href)=["']\/(?!\/)/, 'Root-relative URLs break project Pages sites');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});
