// The directory shows only people who explicitly choose to be listed.
import { registerFriendsSection, registerSocialView } from './social-registry.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = 20;
let owner = null, serial = 0;
let state = fresh();
function fresh() { return { listed: false, nearby: false, mode: 'all', query: '', offset: 0, players: [], more: false, loading: false, error: '', notice: '' }; }
function valid(ctx, user, token) {
  return ctx.isCurrent() && owner === user && token === serial && !!document.querySelector('[data-fr-view="discovery"]');
}
function paint(ctx, focus) {
  if (!ctx.isCurrent()) return;
  const results = state.loading ? '<p role="status">Looking for players...</p>' : state.players.length
    ? '<ul class="di-list">' + state.players.map(player => '<li><span>' + esc(player.name) + (player.band ? '<small>' + (player.band === 'local' ? 'Same broad area' : 'Nearby region') + '</small>' : '') + '</span><button type="button" class="btn btn-sm" data-sx="discovery-request" data-user="' + esc(player.id) + '">Send request</button></li>').join('') + '</ul>'
    : '<p class="hint">' + (state.mode === 'nearby' ? 'No nearby players found. Check back later.' : 'No players found. Try another name or check back later.') + '</p>';
  const html = '<div class="di-directory"><p>Find players who have chosen to be listed. A request does not make you friends until it is accepted.</p>' +
    '<section class="di-privacy"><h3>Your listing</h3><p>When listed, any signed-in player can see your display name and send you a request. Your friend code and shelf stay private until you become friends.</p>' +
    '<button type="button" class="btn" data-sx="discovery-toggle" ' + (state.loading ? 'disabled ' : '') + 'aria-pressed="' + state.listed + '">' + (state.listed ? 'Remove my listing' : 'List me in the directory') + '</button>' +
    '<small>Set a display name in Friends before listing yourself. Blocking someone hides you from each other.</small></section>' +
    '<section class="di-privacy"><h3>Find nearby players</h3><p>Optional. When you choose to share, your device reduces its location to a broad area of roughly 100 km before sending it. Other listed players sharing their area can see your name and an approximate distance band, and may infer your broad area. The app never sends or stores exact coordinates. There is no background tracking.</p>' +
    '<button type="button" class="btn" data-sx="discovery-location" ' + (state.loading || (!state.listed && !state.nearby) ? 'disabled' : '') + '>' + (state.nearby ? 'Remove my area' : 'Share my approximate area') + '</button><small>' + (state.listed ? 'Remove your area at any time. Turning off your listing also removes it. After sharing, wait 24 hours to change or share an area again, even after removal. Distance bands are estimates.' : 'List yourself first to share an area. After sharing, wait 24 hours to change or share an area again, even after removal.') + '</small></section>' +
    '<div class="di-modes"><button type="button" class="btn btn-sm" data-sx="discovery-all" aria-pressed="' + (state.mode === 'all') + '">All players</button><button type="button" class="btn btn-sm" data-sx="discovery-nearby" aria-pressed="' + (state.mode === 'nearby') + '" ' + (!state.nearby ? 'disabled' : '') + '>Nearby players</button></div>' +
    (state.mode === 'nearby' ? '<p class="hint">Nearby results use broad areas, so distances are approximate.</p>' : '<form data-discovery-search><label for="diQuery">Search display names</label><div class="di-search"><input class="fr-input" id="diQuery" name="query" type="search" maxlength="24" value="' + esc(state.query) + '" placeholder="Leave blank to browse"><button class="btn btn-primary" type="submit">Search</button></div></form>') +
    (state.error ? '<p class="di-error" role="alert">' + esc(state.error) + '</p><button type="button" class="btn btn-sm" data-sx="discovery-retry">Try again</button>' : '') +
    (state.notice ? '<p role="status">' + esc(state.notice) + '</p>' : '') + results +
    '<div class="di-pages">' + (state.offset ? '<button type="button" class="btn btn-sm" data-sx="discovery-prev">Previous</button>' : '') +
    (state.more ? '<button type="button" class="btn btn-sm" data-sx="discovery-next">More players</button>' : '') + '</div></div>';
  ctx.show({ id: 'discovery', kicker: 'Friends', title: 'Find players', html, back: 'main', ...(focus ? { focus } : {}) });
}
async function load(ctx, { settings = false, focus } = {}) {
  const user = owner, token = ++serial;
  state.loading = true; state.error = ''; paint(ctx, focus);
  try {
    const [result, prefs] = await Promise.all([
      state.mode === 'nearby' ? ctx.cloud.rpc('discovery_nearby', { p_offset: state.offset }) : ctx.cloud.rpc('discovery_find', { p_query: state.query, p_offset: state.offset }),
      settings ? ctx.cloud.rpc('discovery_status') : Promise.resolve(null)
    ]);
    if (!valid(ctx,user,token)) return;
    if (!Array.isArray(result?.players) || result.players.length > PAGE + 1 || (settings && (typeof prefs?.listed !== 'boolean' || typeof prefs?.nearby !== 'boolean'))) throw new Error('Invalid directory response');
    const players = result.players.filter(p => UUID.test(p?.user_id || '') && typeof p?.display_name === 'string' && p.display_name.trim()).map(p => ({ id:p.user_id, name:p.display_name.slice(0,24), band: ['local','regional'].includes(p.distance_band) ? p.distance_band : '' }));
    state.players = players.slice(0,PAGE); state.more = players.length > PAGE && state.offset < 1000;
    if (settings) { state.listed = prefs.listed; state.nearby = prefs.nearby; if (!state.nearby) state.mode = 'all'; }
  } catch {
    if (valid(ctx,user,token)) state.error = 'The directory is unavailable. Try again.';
  } finally {
    if (valid(ctx,user,token)) { state.loading = false; paint(ctx, focus); }
  }
}
function open(ctx) {
  const user = ctx.me.userId;
  if (owner !== user) { owner = user; state = fresh(); }
  state.notice = ''; state.offset = 0;
  return load(ctx, { settings: true });
}
registerFriendsSection({
  id: 'discovery', where: 'home', order: 5,
  render: () => '<div class="di-entry"><h3>Find players</h3><p>Meet people who chose to be listed.</p><button type="button" class="btn" data-sx="discovery-open">Open player directory</button></div>',
  onClick(action, el, ctx) { if (action === 'discovery-open') return open(ctx); }
});
registerSocialView('discovery', {
  async onSubmit(form, ctx) {
    if (!form.matches('[data-discovery-search]')) return;
    state.query = String(new FormData(form).get('query') || '').trim().slice(0,24); state.offset = 0; state.notice = '';
    await load(ctx, { focus: '#diQuery' });
  },
  async onClick(action, el, ctx) {
    const user = owner, token = serial;
    if (action === 'discovery-next' || action === 'discovery-prev') {
      state.offset = Math.max(0, Math.min(1000, state.offset + (action === 'discovery-next' ? PAGE : -PAGE))); state.notice = '';
      await load(ctx); return;
    }
    if (action === 'discovery-retry') { await load(ctx, { settings: true }); return; }
    if (action === 'discovery-toggle') {
      if (state.loading) return;
      try {
        const result = await ctx.cloud.rpc('discovery_set', { p_on: !state.listed });
        if (!valid(ctx,user,token)) return;
        if (typeof result?.listed !== 'boolean') throw new Error('Invalid directory response');
        state.listed = result.listed; if (!state.listed) { state.nearby = false; state.mode = 'all'; } state.error = '';
        state.notice = result.listed ? 'Your display name is listed.' : 'Your listing has been removed.';
      } catch (error) {
        if (!valid(ctx,user,token)) return;
        state.error = error?.message?.includes('name_required') || error?.code === 'name_required' ? 'Set your display name in Friends first.' : 'Could not change your listing. Try again.';
      }
      if (valid(ctx,user,token)) { if (!state.listed) await load(ctx); else paint(ctx, '[data-sx="discovery-toggle"]'); }
      return;
    }
    if (action === 'discovery-all' || action === 'discovery-nearby') {
      if (action === 'discovery-nearby' && !state.nearby) return;
      state.mode = action === 'discovery-nearby' ? 'nearby' : 'all'; state.offset = 0; state.notice = '';
      await load(ctx); return;
    }
    if (action === 'discovery-location') {
      if (state.loading) return;
      if (globalThis.navigator?.onLine === false) { state.error = 'Connect to the internet to change your shared area.'; paint(ctx); return; }
      state.loading = true; state.error = ''; paint(ctx);
      try {
        let args = { p_lat_band: null, p_lon_band: null };
        if (!state.nearby) {
          const cell = await locate(() => valid(ctx,user,token));
          if (!valid(ctx,user,token)) return;
          args = { p_lat_band: cell.lat, p_lon_band: cell.lon };
        }
        const result = await ctx.cloud.rpc('discovery_location_set', args);
        if (!valid(ctx,user,token)) return;
        if (typeof result?.nearby !== 'boolean') throw new Error('invalid');
        state.nearby = result.nearby; state.mode = result.nearby ? 'nearby' : 'all'; state.offset = 0;
        state.notice = result.nearby ? 'Your approximate area is shared.' : 'Your shared area has been removed.';
        await load(ctx); return;
      } catch (error) {
        if (!valid(ctx,user,token)) return;
        state.error = error?.message?.includes('location_cooldown') || error?.code === 'location_cooldown' ? 'Wait 24 hours after your last shared area before sharing another.' : error?.message === 'unsupported' ? 'Location is unavailable on this device or connection.' : error?.code === 1 || error?.code === 'OS-PLUG-GLOC-0003' || error?.message === 'denied' ? 'Location permission was denied. Allow it in your device or browser settings to share an area.' : 'Could not get or update your area. Check location services and try again.';
      } finally { if (valid(ctx,user,token)) { state.loading = false; paint(ctx); } }
      return;
    }
    if (action === 'discovery-request') {
      const id = el.dataset.user;
      if (!UUID.test(id || '') || !state.players.some(p => p.id === id)) return;
      try {
        const answer = await ctx.cloud.rpc('discovery_request', { p_user:id });
        if (!valid(ctx,user,token)) return;
        if (!answer?.ok && !['already_asked', 'already_friends'].includes(answer?.error)) {
          state.error = answer?.error === 'rate_limited' ? 'Too many requests. Try again later.' : 'That player is no longer available.';
        } else {
          state.players = state.players.filter(player => player.id !== id);
          // A request removes a row from the server's result set. Refill this
          // page before allowing another offset, including after a retry.
          state.more = false;
          state.notice = answer?.status === 'accepted' ? 'You are friends now.' : 'Friend request sent.'; state.error = '';
          try { await ctx.refreshFriends(); } catch { /* The next Friends opening retries the list. */ }
          if (!valid(ctx,user,token)) return;
          await load(ctx);
          return;
        }
      } catch { if (valid(ctx,user,token)) state.error = 'The request could not be sent. Try again.'; }
      if (valid(ctx,user,token)) paint(ctx);
    }
  }
});

export function coarseCell(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) throw new Error('invalid location');
  const lat = Math.min(179, Math.floor(latitude + 90));
  const columns = Math.max(1, Math.floor(360 * Math.cos((lat - 89.5) * Math.PI / 180)));
  const lon = Math.min(columns - 1, Math.floor((longitude + 180) / 360 * columns));
  return { lat, lon };
}
async function locate(stillCurrent) {
  const native = globalThis.Capacitor?.isNativePlatform?.() === true;
  if (native) {
    const geo = globalThis.Capacitor?.Plugins?.Geolocation;
    if (!geo) throw new Error('unsupported');
    const permission = await geo.requestPermissions({ permissions: ['coarseLocation'] });
    if (!stillCurrent()) throw new Error('cancelled');
    if (permission?.coarseLocation !== 'granted') throw new Error('denied');
    const { coords } = await geo.getCurrentPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 0 });
    return coarseCell(coords.latitude, coords.longitude);
  }
  if (!globalThis.isSecureContext || !globalThis.navigator?.geolocation) throw new Error('unsupported');
  const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy:false, timeout:15000, maximumAge:0 }));
  return coarseCell(position.coords.latitude, position.coords.longitude);
}
