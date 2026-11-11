// Players who live in the test process and share the fake Supabase with the
// page: each has its own cloud session and social wrappers, exactly as the
// game builds them. Browser specs use them as "the other player", and hand a
// player's session to the page to sign it in without the sign-in screens.
import { createCloud } from '../../src/cloud/client.js';
import { createSocial } from '../../src/cloud/social.js';

function memory() {
  const items = new Map();
  return { getItem: k => items.get(k) ?? null, setItem: (k, v) => items.set(k, String(v)), removeItem: k => items.delete(k) };
}

export async function socialPlayer(fake, name, shelf = { pets: [] }, { social: optIn = true, now = Date.now, email = false } = {}) {
  const cloud = createCloud({ config: fake.config, fetch: fake.fetch, storage: memory(), now });
  await cloud.signInAnonymously();
  // An email account, as the server sees it and as the page will read its session.
  const address = email ? 'player-' + cloud.userId().slice(-6) + '@example.com' : '';
  if (email) Object.assign(fake.users.get(cloud.userId()), { email: address, is_anonymous: false });
  const sessionOf = () => email ? { ...cloud.session(), user: { ...cloud.session().user, email: address, is_anonymous: false } } : cloud.session();
  const social = createSocial({ cloud, getState: () => shelf, now });
  // A player the page will become has not opened Friends anywhere yet.
  if (!optIn) return { cloud, social, shelf, name, code: '', id: cloud.userId(), session: sessionOf() };
  social.optIn();
  if (name) await social.setName(name);
  const { code } = await social.profile();
  return { cloud, social, shelf, name, code, id: cloud.userId(), session: sessionOf() };
}

// What the page keeps under shelflife.cloud once signed in.
export const pageSession = player => JSON.stringify({ session: player.session });

export const SOCIAL_RPCS = ['add_friend', 'respond_friend', 'remove_friend', 'block_user', 'report_user', 'list_friends', 'publish_shelf', 'get_shelf',
  'send_summons', 'rule_summons', 'decline_summons', 'inbox', 'mark_summons_seen', 'submit_score', 'friends_board', 'day_percentile', 'ensure_profile', 'set_display_name'];
export const socialCalls = fake => fake.requests.filter(r => SOCIAL_RPCS.some(name => r.path === '/rest/v1/rpc/' + name));
