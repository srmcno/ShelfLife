import { registerFriendsSection } from './social-registry.js';
import { PUSH_GROUPS } from '../cloud/push.js';

const names = { friends: 'Friend requests', court: 'Shelf Court', gifts: 'Visits, treats and trades', games: 'Duels', covens: 'Coven invites', kin: 'Baskets and letters' };
let push = null;
let observedCloud = null, unsubscribeCloud = null, generation = 0;
const state = { user: null, loaded: false, loading: false, enabled: false, settings: null, error: '' };
function reset(user) { generation++; Object.assign(state, { user, loaded: false, loading: false, enabled: false, settings: null, error: '' }); }
function load(ctx) {
  const user = ctx.me.userId;
  if (observedCloud !== ctx.cloud) {
    unsubscribeCloud?.();
    observedCloud = ctx.cloud;
    unsubscribeCloud = ctx.cloud.subscribe(change => {
      if (change?.type === 'session' && (change.signedOut || change.userChanged)) reset(null);
    });
  }
  if (state.user !== user) reset(user);
  if (state.loaded || state.loading || !user || push.appleNeedsInstall()) return;
  const requestGeneration = generation;
  state.loading = true;
  Promise.all([push.current(), push.settings()]).then(([subscription, settings]) => {
    if (generation !== requestGeneration || state.user !== user || !ctx.isCurrent()) return;
    Object.assign(state, { enabled: !!subscription, settings, loaded: true, loading: false }); ctx.refresh();
  }, () => {
    if (generation !== requestGeneration || state.user !== user || !ctx.isCurrent()) return;
    Object.assign(state, { loading: false, loaded: true, error: 'Could not load notification settings. Try again.' }); ctx.refresh();
  });
}
registerFriendsSection({
  id: 'push', where: 'home', order: 75,
  render(ctx) {
    if (!push?.available()) return '';
    if (push.appleNeedsInstall()) return '<h3>Notifications</h3><p class="hint">On iPhone or iPad, add Shelf Life to your Home Screen to receive notifications.</p>';
    load(ctx);
    if (!state.loaded) return '<h3>Notifications</h3><p class="hint">Checking this device...</p>';
    if (state.error) return '<h3>Notifications</h3><p class="hint">Could not load notification settings.</p><button type="button" class="btn" data-sx="push-retry">Try again</button>';
    return '<h3>Notifications</h3><p class="hint">Hear when friends send something. Do not disturb still applies.</p>' +
      '<button type="button" class="btn" data-sx="push-toggle" aria-pressed="' + state.enabled + '">' + (state.enabled ? 'Turn off notifications' : 'Turn on notifications') + '</button>' +
      (state.enabled ? '<div class="push-groups">' + PUSH_GROUPS.map(group => '<button type="button" class="btn btn-sm" data-sx="push-group" data-group="' + group + '" aria-pressed="' + (state.settings?.[group] !== false) + '">' + names[group] + ': ' + (state.settings?.[group] !== false ? 'On' : 'Off') + '</button>').join('') + '</div>' : '');
  },
  async onClick(action, el, ctx) {
    if (action === 'push-retry') { state.loaded = false; state.error = ''; ctx.refresh(); return; }
    if (action === 'push-toggle') return ctx.act(async current => {
      if (state.enabled) await push.unsubscribe(); else await push.subscribe();
      if (!current()) return;
      state.enabled = !state.enabled; ctx.say(state.enabled ? 'Notifications are on for this device.' : 'Notifications are off for this device.'); ctx.refresh();
    });
    if (action === 'push-group') return ctx.act(async current => {
      const group = el.dataset.group;
      if (!PUSH_GROUPS.includes(group)) return;
      const settings = await push.set(group, state.settings?.[group] === false);
      if (!current()) return;
      state.settings = settings; ctx.refresh();
    });
  }
});
export function initPush(client) { unsubscribeCloud?.(); unsubscribeCloud = null; observedCloud = null; push?.stop?.(); push = client; reset(null); }
