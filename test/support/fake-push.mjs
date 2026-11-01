// In-memory subscription and preference RPCs. This fake does not send push.
const GROUPS = ['friends', 'court', 'gifts', 'games', 'covens', 'kin'];
const endpointOK = value => typeof value === 'string' && value.length <= 2048 && /^https:\/\/(?:fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|(?:[a-z0-9-]+\.)+push\.apple\.com|(?:[a-z0-9-]+\.)+notify\.windows\.com)\/[^\s#]*$/.test(value);
export function createFakePush({ json, rest }) {
  const subscriptions = new Map(), prefs = new Map();
  const reject = code => rest(400, 'P0001', code);
  const settings = uid => ({ ...Object.fromEntries(GROUPS.map(g => [g, true])), ...(prefs.get(uid) || {}) });
  const RPC = {
    push_subscribe(user, { p_endpoint, p_p256dh, p_auth }) {
      if (!endpointOK(p_endpoint) || !/^[A-Za-z0-9_-]{87}$/.test(p_p256dh || '') || !/^[A-Za-z0-9_-]{22}$/.test(p_auth || '')) return reject('bad_subscription');
      const old = subscriptions.get(p_endpoint);
      if (old && old.user !== user.id) return reject('subscription_in_use');
      if (!old && [...subscriptions.values()].filter(s => s.user === user.id).length >= 5) return reject('too_many_subscriptions');
      subscriptions.set(p_endpoint, { user: user.id, p256dh: p_p256dh, auth: p_auth }); return json(200, true);
    },
    push_unsubscribe(user, { p_endpoint }) {
      if (!endpointOK(p_endpoint)) return reject('bad_subscription');
      if (subscriptions.get(p_endpoint)?.user === user.id) subscriptions.delete(p_endpoint);
      return json(200, true);
    },
    push_settings(user) { return json(200, settings(user.id)); },
    push_set(user, { p_group, p_on }) {
      if (!GROUPS.includes(p_group) || typeof p_on !== 'boolean') return reject('bad_push_setting');
      prefs.set(user.id, { ...settings(user.id), [p_group]: p_on }); return json(200, settings(user.id));
    }
  };
  function forget(id) { prefs.delete(id); for (const [endpoint, sub] of subscriptions) if (sub.user === id) subscriptions.delete(endpoint); }
  return { RPC, subscriptions, prefs, forget };
}
