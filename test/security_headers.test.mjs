import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const headers = JSON.parse(readFileSync('vercel.json', 'utf8')).headers.flatMap(rule => rule.headers);
const header = headers.find(item => item.key === 'Content-Security-Policy').value;
test('each page uses the same CSP as the production header, except frame-ancestors', () => {
  assert.match(header, /(?:^|;)\s*frame-ancestors 'none'/);
  const metaPolicy = header.replace(/;\s*frame-ancestors 'none'/, '');
  for (const page of ['index.html', 'move.html', 'privacy.html', 'delete-account.html']) {
    const html = readFileSync(page, 'utf8');
    const match = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
    assert.ok(match, page);
    assert.equal(match[1], metaPolicy, page);
    assert.doesNotMatch(html, /<script\b(?![^>]*\bsrc=)[^>]*>/i, page);
  }
});
test('nearby discovery can request location on this origin only', () => {
  const policy = headers.find(item => item.key === 'Permissions-Policy').value;
  assert.match(policy, /(?:^|,\s*)geolocation=\(self\)/);
  assert.match(policy, /(?:^|,\s*)camera=\(\)/);
  assert.match(policy, /(?:^|,\s*)microphone=\(\)/);
});
