import { registerNextStepExtras } from './nextstep.js';
import { claimables } from '../engine/claimables.js';

// Feeds the retention module's claimables (engine/claimables.js) into the
// single "do this next" card. Each claimable names a place; this says how a
// tap gets there.
const ROUTES = {
  almanac: { event: 'shelflife:almanac', detail: { view: 'almanac' }, verb: 'Open the Almanac' },
  collections: { event: 'shelflife:almanac', detail: { view: 'collections' }, verb: 'See the set' },
  exchange: { event: 'shelflife:almanac', detail: { view: 'exchange', tab: 'back' }, verb: 'Browse' }
};
const VERBS = { 'return-chest': 'Open it', 'weekly-chest': 'Open it', 'almanac-tier': 'Claim' };
const TARGETS = { 'return-chest': '.alm-return-chest' };

// Claimables rank 0 to 100 among themselves. On the card they sit in the band
// for extras: above the fallback "time together" suggestion, below the daily docket.
export const CLAIMABLE_BAND = 200;
const banded = priority => CLAIMABLE_BAND + Math.max(0, Math.min(99, Number(priority) || 0));

export function routeClaimable(item) {
  const route = ROUTES[item.tab];
  const extra = { id: item.id, label: item.label, hint: item.hint, priority: banded(item.priority), verb: VERBS[item.id] || route?.verb || 'Go' };
  if (route) return { ...extra, tab: 'shelf', event: route.event, detail: route.detail };
  return { ...extra, tab: item.tab, target: TARGETS[item.id] };
}

export function claimableExtras(state, now = Date.now()) {
  return claimables(state, now).map(routeClaimable);
}

registerNextStepExtras(claimableExtras);
