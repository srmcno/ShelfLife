// The app's one cloud client, one sync engine and the social layer (friends,
// summonses, leaderboards) on the same session. Unconfigured, all three exist
// but stay inert: no storage reads, no requests.
import { state } from '../state.js';
import { cloudConfig, cloudConfigured } from './config.js';
import { createCloud, CloudError, CLOUD_KEY } from './client.js';
import { createSync, shelfSummary, deviceKind, SAFETY_KEY } from './sync.js';
import { createSocial } from './social.js';

export { CloudError, CLOUD_KEY, SAFETY_KEY, cloudConfigured, shelfSummary, deviceKind };

const hooks = { applyRemote: () => false, canApply: () => true };
export const cloud = createCloud({ config: cloudConfig() });
export const sync = createSync({
  cloud,
  getState: () => state,
  applyRemote: (next, detail) => hooks.applyRemote(next, detail),
  canApply: () => hooks.canApply()
});
export const social = createSocial({ cloud, getState: () => state });
// Friends see the shelf as it was last pushed. Inert until the player opts in.
sync.subscribe(info => social.syncStatus(info));

// main.js hands over the restore path once the page is built; sync starts then.
export function connectCloud({ applyRemote, canApply } = {}) {
  if (applyRemote) hooks.applyRemote = applyRemote;
  if (canApply) hooks.canApply = canApply;
  if (cloud.configured) sync.start();
  return { cloud, sync };
}
