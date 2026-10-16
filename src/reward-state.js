// Durable social-reward evidence is account scoped and never clipped to the
// activity display cache. Calendar keys match localDayKey, without accepting
// overflow dates which Date would silently move into another month.
export const REWARD_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const rewardRecord = value => !!value && typeof value === 'object' && !Array.isArray(value);
export function rewardDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{1,2}-\d{1,2}$/.test(value)) return '';
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1000 || month < 0 || month > 11 || day < 1 || day > 31) return '';
  const date = new Date(Date.UTC(year, month, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day ? year + '-' + month + '-' + day : '';
}
export function normalizeRewardHistory(raw) {
  const out = {};
  if (!rewardRecord(raw)) return out;
  for (const [owner, entries] of Object.entries(raw)) {
    if (!REWARD_UUID.test(owner) || !rewardRecord(entries)) continue;
    const kept = {};
    for (const [id, proof] of Object.entries(entries)) {
      const day = rewardDay(proof?.day);
      if (REWARD_UUID.test(id) && day && typeof proof?.paid === 'boolean') kept[id] = { day, paid: proof.paid };
    }
    out[owner] = kept;
  }
  return out;
}
export function rewardCount(history, owner, day) {
  return Object.values(history?.[owner] || {}).filter(proof => proof.day === day && proof.paid).length;
}
export function pendingRewardCount(state, owner, reward, day) {
  return (state.coop?.money?.pending || []).filter(op => op.owner === owner && op.preApplied === false
    && op.detail?.reward === reward && op.detail.day === day && op.detail.paid === true).length;
}
