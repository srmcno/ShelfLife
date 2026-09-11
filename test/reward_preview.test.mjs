import test from 'node:test';
import assert from 'node:assert/strict';
import { rewardPreview, rewardSummary } from '../src/ui/reward-summary.js';
import { localDayKey } from '../src/state.js';
const now = new Date(2026, 8, 10, 12).getTime();
const pet = () => ({ needs: { fuss: 90 }, bond: 0, traits: [] });
test('game briefing previews only available attention and trust without mutating the resident', () => {
  const p = pet(), before = structuredClone(p);
  assert.match(rewardPreview(p, 'memory', now), /up to \+10 attention and \+1 trust/);
  assert.deepEqual(p, before);
  p.needs.fuss = 100; p.bond = 25;
  assert.match(rewardPreview(p, 'memory', now), /attention full. Trust is full/);
  p.bond = 4; p.bonusTrust = { day: localDayKey(now), n: 100 };
  assert.match(rewardPreview(p, 'alibi', now), /Bonus trust returns tomorrow/);
});
test('practice briefing distinguishes sleeping from this game cooldown', () => {
  const p = pet(); p.traits = ['nocturnal'];
  assert.match(rewardPreview(p, 'memory', now), /while they sleep/);
  p.traits = []; p.playedAt = { memory: now - 60000 };
  assert.match(rewardPreview(p, 'memory', now), /return in 4 min/);
  assert.doesNotMatch(rewardPreview(p, 'alibi', now), /Practice/);
  assert.doesNotMatch(rewardPreview(p, 'memory', now + 240000), /Practice/);
});
test('reward summary does not mistake a full bond for a daily cap or promise more care trust', () => {
  assert.match(rewardSummary({ fuss: 0, bond: 0 }), /Attention already full/);
  assert.match(rewardSummary({ fuss: 10, bond: 0 }), /bond or today’s game bonus is full/);
  assert.match(rewardSummary({ fuss: 10, bond: 1 }), /\+10 attention. \+1 trust/);
  assert.equal(rewardSummary({ fuss: 0.01, bond: 1 }), 'Attention topped up. +1 trust.');
});

test('Alibi explains the distinct attention and proof requirements without changing casual rules', () => {
  const p = pet(); p.needs.fuss = 40;
  const prove = rewardPreview(p, 'alibi', now, { alibiMode: 'prove' });
  assert.match(prove, /Find all 3 lies: up to \+20 attention/);
  assert.match(prove, /Prove all 3 with matching records: \+1 trust/);
  const casual = rewardPreview(p, 'alibi', now, { alibiMode: 'quick' });
  assert.match(casual, /Find all 3 lies: \+1 trust/);
  assert.doesNotMatch(casual, /Prove|matching records/);
  assert.match(rewardPreview(p, 'chase', now), /^Reach the crumb goal:/);
  assert.doesNotMatch(rewardPreview(p, 'chase', now), /rounds/);
});

test('Alibi results explain missing trust and never call an unsuccessful practice a win', () => {
  const partial = { fuss: 13, bond: 0, clean: false };
  assert.match(rewardSummary(partial, { alibiMode: 'prove' }), /\+13 attention. Trust needs all 3 lies and their matching records/);
  assert.match(rewardSummary(partial, { alibiMode: 'quick' }), /Trust needs all 3 lies\./);
  assert.doesNotMatch(rewardSummary(partial, { alibiMode: 'quick' }), /records/);
  const practice = rewardSummary({ ...partial, practice: true }, { alibiMode: 'prove' });
  assert.match(practice, /Interview recorded/);
  assert.match(practice, /A win needs all 3 lies and their matching records/);
  assert.doesNotMatch(practice, /Wins and records still count/);
});
