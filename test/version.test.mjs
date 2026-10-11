// One version source: src/version.js. The Android build and package.json
// must agree with it, and the release notes must be in the game's voice.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION, BUILD, COMMIT, CHANGES, compareVersions, versionParts, versionCode, versionLine, changesSince } from '../src/version.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('the Android versionName is src/version.js, read by build.gradle itself', () => {
  const gradle = read('android/app/build.gradle');
  const pattern = gradle.match(/rootProject\.file\('\.\.\/src\/version\.js'\)\.text =~ \/(.+?)\/\n/);
  assert.ok(pattern, 'build.gradle reads src/version.js');
  // The same regular expression Gradle uses, run on the real file.
  const found = read('src/version.js').match(new RegExp(pattern[1]));
  assert.equal(found?.[1], VERSION, 'Gradle finds the same VERSION the game shows');
  assert.match(gradle, /versionName appVersion\b/);
  assert.match(gradle, /versionCode appVersionCode\b/);
  assert.match(gradle, /appVersionParts\[0\] \* 10000 \+ appVersionParts\[1\] \* 100 \+ appVersionParts\[2\]/);
  assert.equal(versionCode(VERSION), versionParts(VERSION)[0] * 10000 + versionParts(VERSION)[1] * 100 + versionParts(VERSION)[2]);
});

test('package.json and its lock carry the same version', () => {
  assert.equal(JSON.parse(read('package.json')).version, VERSION);
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(lock.version, VERSION);
  assert.equal(lock.packages[''].version, VERSION);
});

test('the version, build and line are well formed', () => {
  assert.match(VERSION, /^\d{1,3}\.\d{1,2}\.\d{1,2}$/);
  assert.match(BUILD, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(!Number.isNaN(Date.parse(BUILD)));
  assert.equal(COMMIT, '', 'the repository copy is unstamped; scripts/build_site.py stamps the packaged one');
  assert.equal(versionLine(), 'Shelf Life ' + VERSION + ' · build ' + BUILD);
  assert.equal(versionLine({ commit: 'abc1234' }), 'Shelf Life ' + VERSION + ' · build ' + BUILD + ' (abc1234)');
  assert.match(read('scripts/build_site.py'), /export const COMMIT = /);
});

test('versions compare as numbers, not strings', () => {
  assert.ok(compareVersions('1.10.0', '1.9.9') > 0);
  assert.ok(compareVersions('1.1.0', '1.1.1') < 0);
  assert.equal(compareVersions('2.0.0', '2.0.0'), 0);
  assert.deepEqual(versionParts('nonsense'), [0, 0, 0]);
  assert.equal(versionCode('1.2.3'), 10203);
});

test('release notes: this version has some, newest first, short and in the house style', () => {
  assert.equal(CHANGES[0].version, VERSION, 'the current version has notes');
  for (let i = 1; i < CHANGES.length; i++) assert.ok(compareVersions(CHANGES[i - 1].version, CHANGES[i].version) > 0, 'newest first');
  for (const release of CHANGES) {
    assert.ok(release.items.length >= 1 && release.items.length <= 8, 'a short sheet');
    for (const item of release.items) {
      assert.ok(item.title.length <= 40, item.title);
      assert.ok(item.text.length <= 240, item.title + ' is short');
      assert.doesNotMatch(item.title + item.text, /[\u2013\u2014]/, 'no en or em dashes');
      assert.doesNotMatch(item.title + item.text, /[!]/, 'deadpan, not shouting');
      assert.doesNotMatch(item.text, /'/, 'curly apostrophes');
    }
  }
  assert.doesNotMatch(read('src/version.js'), /Integrator: append/, 'release notes contain the finished feature descriptions');
});

test('changesSince shows what is newer than the last version seen, at most two releases', () => {
  const changes = [{ version: '1.3.0', items: [] }, { version: '1.2.0', items: [] }, { version: '1.1.0', items: [] }, { version: '1.0.0', items: [] }];
  assert.deepEqual(changesSince('1.2.0', { current: '1.3.0', changes }).map(c => c.version), ['1.3.0']);
  assert.deepEqual(changesSince('1.0.0', { current: '1.3.0', changes }).map(c => c.version), ['1.3.0', '1.2.0']);
  assert.deepEqual(changesSince('', { current: '1.2.0', changes }).map(c => c.version), ['1.2.0', '1.1.0'], 'never notes for a version not yet released');
  assert.deepEqual(changesSince('1.3.0', { current: '1.3.0', changes }), []);
});
