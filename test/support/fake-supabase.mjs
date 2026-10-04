// An in-memory stand-in for exactly the Supabase endpoints cloud save uses:
// GoTrue signup / otp / verify / user / token / logout, and PostgREST rpc and
// select. The rpc functions mirror supabase/migrations/0001_accounts_and_saves.sql,
// and the social ones (fake-social.mjs) mirror 0002_social.sql.
//
// Use it as a fetch replacement in Node (fake.fetch) or behind Playwright
// (page.route(fake.url + '/**', route => fake.route(route))). Every sign-in
// code is 123456. Knobs: setOffline, failNext, hangNext, expireTokens,
// revokeRefreshTokens and setRemote (another device writing a save).
import { createFakeSocial } from './fake-social.mjs';

export const FAKE_URL = 'https://fake.supabase.test';
export const FAKE_KEY = 'fake-anon-key';
export const FAKE_CODE = '123456';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-allow-headers': 'apikey, authorization, content-type, accept, x-client-info, prefer'
};

export function createFakeSupabase({ url = FAKE_URL, anonKey = FAKE_KEY, code = FAKE_CODE, now = () => Date.now(), tokenLifetime = 3600, anonymousSignIns = true, emailAutoconfirm = false } = {}) {
  const users = new Map(), saves = new Map(), profiles = new Map();
  const access = new Map(), refresh = new Map(), codes = new Map();
  const requests = [], sent = [], failures = [];
  let offline = false, hangs = 0, serial = 0;

  const uuid = () => '00000000-0000-4000-8000-' + String(++serial).padStart(12, '0');
  const json = (status, body, extra = {}) => ({ status, body: body === undefined ? '' : JSON.stringify(body), headers: { 'content-type': 'application/json', ...extra } });
  const auth = (status, error_code, msg) => json(status, { code: status, error_code, msg });
  const rest = (status, code, message) => json(status, { code, message, details: null, hint: null });
  const publicUser = u => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email || '', new_email: u.new_email || undefined,
    is_anonymous: u.is_anonymous, created_at: u.created_at });

  function issue(user) {
    const accessToken = 'at-' + (++serial), refreshToken = 'rt-' + (++serial);
    access.set(accessToken, { userId: user.id, expiresAt: now() + tokenLifetime * 1000, refreshToken });
    refresh.set(refreshToken, { userId: user.id, used: false });
    return { access_token: accessToken, token_type: 'bearer', expires_in: tokenLifetime, expires_at: Math.floor(now() / 1000) + tokenLifetime,
      refresh_token: refreshToken, user: publicUser(user) };
  }
  function makeUser(fields) {
    const user = { id: uuid(), email: '', is_anonymous: false, created_at: new Date(now()).toISOString(), ...fields };
    users.set(user.id, user);
    return user;
  }
  const byEmail = email => [...users.values()].find(u => u.email === email) || null;

  // null: no token (the anon role). false: a token the server will not accept.
  function caller(headers) {
    const header = headers.authorization || '';
    if (!header) return null;
    const entry = access.get(header.replace(/^Bearer\s+/i, ''));
    if (!entry || entry.expiresAt <= now() || !users.has(entry.userId)) return false;
    return users.get(entry.userId);
  }

  function friendCode() {
    for (;;) {
      const next = Array.from({ length: 8 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
      if (![...profiles.values()].some(p => p.friend_code === next)) return next;
    }
  }

  // The rpc functions, with the same semantics as the SQL.
  const RPC = {
    push_save(user, { p_base_rev = 0, p_data, p_device = '' }) {
      if (!p_data || typeof p_data !== 'object' || Array.isArray(p_data)) return rest(400, '22023', 'save must be a json object');
      if (JSON.stringify(p_data).length >= 6000000) return rest(400, '23514', 'new row for relation "saves" violates check constraint "saves_data_size"');
      const row = saves.get(user.id), base = Number(p_base_rev);
      const conflict = () => json(200, { ok: false, conflict: true, rev: row ? row.rev : 0, updated_at: row?.updated_at || null, device: row?.device_id || null });
      if (row ? row.rev !== base : base !== 0) return conflict();
      const next = { rev: (row?.rev || 0) + 1, data: JSON.parse(JSON.stringify(p_data)), device_id: String(p_device || '').slice(0, 100), updated_at: new Date(now()).toISOString() };
      saves.set(user.id, next);
      return json(200, { ok: true, rev: next.rev, updated_at: next.updated_at });
    },
    pull_save(user) {
      const row = saves.get(user.id);
      return json(200, row ? { rev: row.rev, data: row.data, updated_at: row.updated_at, device: row.device_id } : null);
    },
    ensure_profile(user, { p_name = '' } = {}) {
      if (!profiles.has(user.id)) profiles.set(user.id, { friend_code: friendCode(), display_name: String(p_name || '').trim().slice(0, 24), created_at: new Date(now()).toISOString() });
      const p = profiles.get(user.id);
      return json(200, { friend_code: p.friend_code, display_name: p.display_name });
    },
    set_display_name(user, { p_name = '' } = {}) {
      RPC.ensure_profile(user, {});
      const p = profiles.get(user.id);
      p.display_name = String(p_name || '').trim().slice(0, 24);
      return json(200, { friend_code: p.friend_code, display_name: p.display_name });
    },
    delete_my_account(user) {
      users.delete(user.id); saves.delete(user.id); profiles.delete(user.id); social.forget(user.id);
      for (const [token, entry] of access) if (entry.userId === user.id) access.delete(token);
      for (const [token, entry] of refresh) if (entry.userId === user.id) refresh.delete(token);
      return { status: 204, body: '', headers: {} };
    }
  };
  const social = createFakeSocial({ users, profiles, now, json, rest, uuid,
    ensureProfile: user => RPC.ensure_profile(user, {}) });
  Object.assign(RPC, social.RPC);
  const TABLES = {
    ...social.TABLES,
    saves: user => [...saves].filter(([id]) => id === user.id).map(([id, r]) => ({ user_id: id, rev: r.rev, data: r.data, device_id: r.device_id, updated_at: r.updated_at })),
    profiles: user => [...profiles].filter(([id]) => id === user.id).map(([id, p]) => ({ user_id: id, ...p }))
  };

  function handle({ method = 'GET', url: href, headers = {}, body = '' }) {
    const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    const u = new URL(href);
    const path = u.pathname;
    requests.push({ method, path, search: u.search, auth: h.authorization || '', body });
    if (offline) return { offline: true };
    if (failures.length) return rest(failures.shift(), 'fake_failure', 'An injected failure');
    if (h.apikey !== anonKey) return json(401, { message: 'Invalid API key' });
    let input = {};
    if (body) { try { input = JSON.parse(body); } catch { return rest(400, 'PGRST102', 'Invalid JSON'); } }
    const who = caller(h);

    if (path === '/auth/v1/settings' && method === 'GET') return json(200, { mailer_autoconfirm: emailAutoconfirm });
    if (path === '/auth/v1/signup' && method === 'POST') {
      if (input.email || input.phone) return auth(400, 'validation_failed', 'Password sign-ups are not part of this fake');
      if (!anonymousSignIns) return auth(422, 'anonymous_provider_disabled', 'Anonymous sign-ins are disabled');
      return json(200, issue(makeUser({ is_anonymous: true })));
    }
    if (path === '/auth/v1/otp' && method === 'POST') {
      const email = String(input.email || '').toLowerCase();
      if (!email.includes('@')) return auth(400, 'validation_failed', 'Unable to validate email address: invalid format');
      if (!byEmail(email) && !input.create_user) return auth(422, 'otp_disabled', 'Signups not allowed for otp');
      codes.set(email, { type: 'email' });
      sent.push({ email, type: 'email', code });
      return json(200, {});
    }
    if (path === '/auth/v1/verify' && method === 'POST') {
      const email = String(input.email || '').toLowerCase(), pending = codes.get(email);
      const kind = ['magiclink', 'signup'].includes(input.type) ? 'email' : input.type;
      if (!pending || pending.type !== kind || input.token !== code) return auth(403, 'otp_expired', 'Token has expired or is invalid');
      codes.delete(email);
      let user;
      if (kind === 'email_change') {
        user = users.get(pending.userId);
        if (!user) return auth(403, 'otp_expired', 'Token has expired or is invalid');
        Object.assign(user, { email, new_email: '', is_anonymous: false });
      } else user = byEmail(email) || makeUser({ email });
      return json(200, issue(user));
    }
    if (path === '/auth/v1/user') {
      if (!who) return auth(401, who === null ? 'no_authorization' : 'bad_jwt', 'invalid JWT');
      if (method === 'GET') return json(200, publicUser(who));
      if (method === 'PUT') {
        const email = String(input.email || '').toLowerCase();
        if (email && email !== who.email) {
          if (byEmail(email) && byEmail(email).id !== who.id) return auth(422, 'email_exists', 'A user with this email address has already been registered');
          who.new_email = email;
          codes.set(email, { type: 'email_change', userId: who.id });
          sent.push({ email, type: 'email_change', code });
        }
        return json(200, publicUser(who));
      }
    }
    if (path === '/auth/v1/token' && method === 'POST' && u.searchParams.get('grant_type') === 'refresh_token') {
      const entry = refresh.get(input.refresh_token);
      if (!entry || entry.used || !users.has(entry.userId)) return auth(400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found');
      entry.used = true;
      return json(200, issue(users.get(entry.userId)));
    }
    if (path === '/auth/v1/logout' && method === 'POST') {
      if (!who) return auth(401, 'bad_jwt', 'invalid JWT');
      const token = h.authorization.replace(/^Bearer\s+/i, ''), entry = access.get(token);
      const rt = refresh.get(entry.refreshToken);
      if (rt) rt.used = true;
      access.delete(token);
      return { status: 204, body: '', headers: {} };
    }

    const rpc = path.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
    const table = path.match(/^\/rest\/v1\/([a-z_]+)$/);
    if (rpc || table) {
      const name = (rpc || table)[1];
      if (who === false) return rest(401, 'PGRST303', 'JWT expired');
      if (who === null) return rest(401, '42501', 'permission denied for ' + (rpc ? 'function ' : 'table ') + name);
      if (rpc && method === 'POST') return RPC[name] ? RPC[name](who, input) : rest(404, 'PGRST202', 'Could not find the function public.' + name);
      if (table && method === 'GET') {
        if (!TABLES[name]) return rest(404, '42P01', 'relation "public.' + name + '" does not exist');
        const columns = (u.searchParams.get('select') || '*').split(',').map(c => c.trim());
        let rows = TABLES[name](who);
        for (const [key, value] of u.searchParams) {
          if (['select', 'or', 'order', 'limit'].includes(key) || !value.startsWith('eq.')) continue;
          rows = rows.filter(row => String(row[key]) === value.slice(3));
        }
        // The small PostgREST surface used by the game: keyset cursor,
        // ordered/limited rows, and aliased JSON text projections.
        const cursor = u.searchParams.get('or');
        if (cursor) {
          const m = cursor.match(/^\(created_at\.lt\."([^"]+)",and\(created_at\.eq\."\1",id\.lt\.([a-f0-9-]+)\)\)$/);
          if (!m) return rest(400, 'PGRST100', 'Unsupported filter in fake');
          rows = rows.filter(row => row.created_at < m[1] || (row.created_at === m[1] && row.id < m[2]));
        }
        const order = u.searchParams.get('order');
        if (order) {
          const keys = order.split(',').map(term => term.split('.'));
          rows.sort((a, b) => {
            for (const [key, direction] of keys) {
              const cmp = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
              if (cmp) return direction === 'desc' ? -cmp : cmp;
            }
            return 0;
          });
        }
        const limit = u.searchParams.get('limit');
        if (limit) rows = rows.slice(0, Number(limit));
        const project = (row, column) => {
          const [alias, expression] = column.includes(':') ? column.split(':') : [column, column];
          const [key, field] = expression.split('->>');
          return [alias, field ? row[key]?.[field] ?? null : row[key]];
        };
        return json(200, rows.map(row => columns.includes('*') ? row : Object.fromEntries(columns.map(c => project(row, c)))));
      }
    }
    return json(404, { message: 'Not found in the fake: ' + method + ' ' + path });
  }

  async function fakeFetch(input, init = {}) {
    const href = typeof input === 'string' ? input : input.url;
    const signal = init.signal;
    const aborted = () => Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
    if (signal?.aborted) throw aborted();
    if (hangs > 0) {
      hangs--;
      requests.push({ method: init.method || 'GET', path: new URL(href).pathname, hung: true });
      return new Promise((_, reject) => signal?.addEventListener('abort', () => reject(aborted())));
    }
    const result = handle({ method: init.method || 'GET', url: href, headers: init.headers || {}, body: typeof init.body === 'string' ? init.body : '' });
    if (result.offline) throw new TypeError('Failed to fetch');
    return new Response(result.status === 204 || !result.body ? null : result.body, { status: result.status, headers: result.headers });
  }

  // Playwright: page.route(fake.url + '/**', route => fake.route(route))
  async function route(playwrightRoute) {
    const request = playwrightRoute.request();
    if (request.method() === 'OPTIONS') return playwrightRoute.fulfill({ status: 204, headers: CORS });
    const result = handle({ method: request.method(), url: request.url(), headers: request.headers(), body: request.postData() || '' });
    if (result.offline) return playwrightRoute.abort('internetdisconnected');
    return playwrightRoute.fulfill({ status: result.status, headers: { ...result.headers, ...CORS }, body: result.body });
  }

  return {
    url, anonKey, code, config: { url, anonKey }, users, saves, profiles, requests, sent, social,
    fetch: fakeFetch, route, handle,
    setOffline(value = true) { offline = !!value; },
    failNext(count = 1, status = 500) { for (let i = 0; i < count; i++) failures.push(status); },
    hangNext(count = 1) { hangs += count; },
    expireTokens() { for (const entry of access.values()) entry.expiresAt = 0; },
    revokeRefreshTokens() { for (const entry of refresh.values()) entry.used = true; },
    userByEmail: byEmail,
    // Another device pushes a save for this user.
    setRemote(userId, data, { device = 'android-otherphone1' } = {}) {
      const row = saves.get(userId);
      const next = { rev: (row?.rev || 0) + 1, data: JSON.parse(JSON.stringify(data)), device_id: device, updated_at: new Date(now()).toISOString() };
      saves.set(userId, next);
      return next;
    },
    calls(path) { return requests.filter(r => !path || r.path === path || r.path.endsWith('/' + path)); }
  };
}
