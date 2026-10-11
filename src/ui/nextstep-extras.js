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

export function routeClaimable(item) {
  const route = ROUTES[item.tab];
  const extra = { id: item.id, label: item.label, hint: item.hint, priority: item.priority, verb: VERBS[item.id] || route?.verb || 'Go' };
  if (route) return { ...extra, tab: 'shelf', event: route.event, detail: route.detail };
  return { ...extra, tab: item.tab, target: TARGETS[item.id] };
}

export function claimableExtras(state, now = Date.now()) {
  return claimables(state, now).map(routeClaimable);
}

registerNextStepExtras(claimableExtras);
