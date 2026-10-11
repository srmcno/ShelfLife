import { coopState } from '../coop-state.js';
import { mayhemState } from '../mayhem-state.js';

// The journal observes genuine changes between saves. Replacing/importing a
// save rebases its checkpoint; a different backup's purse is never income.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMIT = 100000000;
const operationId = () => globalThis.crypto.randomUUID();

export function bindCoopMoney(state, owner) {
  if (!UUID.test(owner || '')) throw new Error('Invalid Co-op money owner');
  const c = coopState(state), m = mayhemState(state), money = c.money;
  if (!money.openings[owner]) money.openings[owner] = { souls: m.souls, after: c.ledger[owner]?.seq || 0 };
  if (money.checkpoint?.owner !== owner) money.checkpoint = { owner, souls: m.souls, lifetime: m.lifetime };
  return money.openings[owner];
}

// A different local household cannot declare or adopt this account's existing
// purse. The cloud-copy choice restores its matching opening and journal.
export function assertCoopOpening(state, owner, wallet, { conflict = false } = {}) {
  const opening = coopState(state).money.openings[owner];
  if (conflict || wallet.opening !== null && (!opening || opening.souls !== wallet.opening || opening.after !== wallet.openingSeq))
    throw Object.assign(new Error('Open Cloud save to choose your shelf. For Co-op, use the cloud copy with this account’s souls.'), { code: 'cloud_copy_required' });
}

export function captureCoopMoney(state, signedInOwner, uuid = operationId) {
  const c = coopState(state), money = c.money, checkpoint = money.checkpoint;
  if (!checkpoint) return null;
  // Signing out keeps offline changes with their existing owner. A new
  // signed-in owner starts from the shared shelf as it stands, without ever
  // submitting the previous owner's pending operations under that account.
  if (signedInOwner && checkpoint.owner !== signedInOwner) {
    bindCoopMoney(state, signedInOwner); return null;
  }
  const m = mayhemState(state), delta = m.souls - checkpoint.souls, earned = m.lifetime - checkpoint.lifetime;
  if (!delta && !earned) return null;
  if (!Number.isInteger(delta) || Math.abs(delta) > LIMIT || !Number.isInteger(earned) || earned < 0 || earned > LIMIT) throw new Error('Invalid local currency change');
  const id = uuid();
  if (!UUID.test(id || '') || money.pending.some(p => p.id === id)) throw new Error('Invalid currency operation ID');
  const op = { id, owner: checkpoint.owner, delta, earned };
  money.pending.push(op);
  money.checkpoint = { owner: checkpoint.owner, souls: m.souls, lifetime: m.lifetime };
  return op;
}

// Receipts can change both the purse and lifetime earned. Move the checkpoint
// by that exact change so the next ordinary save does not journal it again.
export function advanceCoopMoney(state, owner, soulsBefore, lifetimeBefore) {
  const c = coopState(state), p = c.money.checkpoint, m = mayhemState(state);
  if (p?.owner !== owner) return;
  p.souls += m.souls - soulsBefore; p.lifetime += m.lifetime - lifetimeBefore;
}

// Backend-idempotent rewards use a semantic identity instead of a random save
// delta. UUIDv8 carries the first128 SHA-256 bits with standard version/variant
// bits; the server can derive the same ID from the owner and source key.
export async function currencyRewardId(owner, key) {
  if (!UUID.test(owner || '') || typeof key !== 'string' || !/^[a-z0-9_:-]{1,180}$/.test(key)) throw new Error('Invalid currency reward key');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode('shelflife.currency.v1:' + owner.toLowerCase() + ':' + key));
  const bytes = new Uint8Array(digest).slice(0, 16);
  bytes[6] = (bytes[6] & 15) | 128; bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const rewardHandlers = new Map();
export function registerCoopReward(reward, { normalize, apply, key }) {
  if (!/^[a-z_]{1,40}$/.test(reward || '') || typeof normalize !== 'function' || typeof apply !== 'function') throw new Error('Invalid currency reward handler');
  rewardHandlers.set(reward, { normalize, apply, key });
}
export function readCoopRewardDetail(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const handler = rewardHandlers.get(raw.reward);
  if (!handler) return null;
  const clean = handler.normalize(raw);
  return clean ? { ...clean, reward: raw.reward } : null;
}
export function sameCoopReward(a, b) {
  const first = readCoopRewardDetail(a), second = readCoopRewardDetail(b);
  if (!first || !second || first.reward !== second.reward) return false;
  const key = rewardHandlers.get(first.reward).key;
  if (typeof key !== 'function') return false;
  const source = key(first);
  return typeof source === 'string' && source.length > 0 && source === key(second);
}

// Save a proposal before asking the server; no provisional cash, ranks or
// cosmetic effects enter the shelf. The first immutable receipt is authority.
export function queueCoopReward(state, { id, owner, delta, earned, detail }) {
  const clean = readCoopRewardDetail(detail);
  if (!UUID.test(id || '') || !UUID.test(owner || '') || !clean || !sameCoopReward(clean, clean) || !Number.isInteger(delta) || Math.abs(delta) > LIMIT
    || !Number.isInteger(earned) || earned < 0 || earned > LIMIT) throw new Error('Invalid currency reward proposal');
  const c = coopState(state);
  if (c.money.rewards[owner]?.includes(id)) return null;
  const old = c.money.pending.find(p => p.owner === owner && p.id === id);
  if (old) {
    if (old.preApplied !== false || !sameCoopReward(old.detail, clean)) throw new Error('Currency reward already recorded');
    return old;
  }
  bindCoopMoney(state, owner);
  const proposal = { id, owner, delta, earned, detail: clean, preApplied: false };
  c.money.pending.push(proposal); return proposal;
}

export function applyCoopReward(state, owner, raw) {
  const detail = readCoopRewardDetail(raw);
  if (!detail) throw new Error('Unknown currency reward detail');
  rewardHandlers.get(detail.reward).apply(state, owner, detail);
}

// Call bindCoopMoney BEFORE the existing award, and this after its money and
// non-currency effects have been applied. Only that exact award is excluded
// from the ordinary save journal; other gameplay deltas remain observable.
export function hasCoopReward(state, owner, id) {
  const c = coopState(state);
  return !!c.money.rewards[owner]?.includes(id) || c.money.pending.some(p => p.owner === owner && p.id === id);
}
export function coopRewardReceipt(state, owner, id) {
  const receipt = coopState(state).money.received[owner]?.[id];
  if (!receipt) return null;
  const detail = readCoopRewardDetail(receipt.detail);
  return detail ? { delta: receipt.delta, earned: receipt.earned, detail } : null;
}

export function recordCoopReward(state, { id, owner, delta, earned, detail }) {
  const c = coopState(state), checkpoint = c.money.checkpoint;
  const clean = readCoopRewardDetail(detail);
  if (!UUID.test(id || '') || !UUID.test(owner || '') || checkpoint?.owner !== owner || !clean
    || !Number.isInteger(delta) || Math.abs(delta) > LIMIT || !Number.isInteger(earned) || earned < 0 || earned > LIMIT) throw new Error('Invalid currency reward operation');
  if (c.money.rewards[owner]?.includes(id)) throw new Error('Currency reward already received');
  const op = { id, owner, delta, earned, detail: clean }, old = c.money.pending.find(p => p.owner === owner && p.id === id);
  if (old) {
    if (old.delta !== delta || old.earned !== earned || JSON.stringify(old.detail) !== JSON.stringify(clean)) throw new Error('Currency reward changed on retry');
    throw new Error('Currency reward already recorded');
  }
  c.money.pending.push(op); checkpoint.souls += delta; checkpoint.lifetime += earned;
  return op;
}
