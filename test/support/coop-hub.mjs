// A stand-in for the Friends hub, for browser specs only. It renders whatever
// is registered through src/ui/social-registry.js with the hub's own
// selectors ([data-fr-action="<id>"], [data-fr-section="<id>"]) and hands the
// registrants the same ctx the hub promises, so a feature can be driven
// before (or without) the real hub. Load it in the page with
//   await page.evaluate(() => import('./test/support/coop-hub.mjs').then(m => m.openHub()))
import { friendActions, friendsSections, postboxSources, socialView, renderSafely } from '../../src/ui/social-registry.js';
import { state, save } from '../../src/state.js';
import { cloud, social } from '../../src/cloud/index.js';
import { renderAll } from '../../src/ui/render.js';
import { toast } from '../../src/ui/toast.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let root = null, view = { kind: 'home' }, history = [], friends = [], me = { userId: '', code: '', name: '' }, mail = {}, message = '';

const ctx = {
  state, social, cloud,
  get me() { return me; },
  friends: () => friends,
  friend: id => friends.find(f => f.userId === id) || null,
  show(next) { history.push(view); view = { kind: 'custom', custom: next }; paint(); },
  back() {
    const to = view.custom?.back || 'main';
    view = to.startsWith('friend:') ? { kind: 'friend', friendId: to.slice(7) } : to === 'postbox' ? { kind: 'postbox' } : { kind: 'home' };
    paint();
  },
  refresh: () => paint(),
  say(text) { message = String(text || ''); const s = root?.querySelector('[data-hub-status]'); if (s) s.textContent = message; },
  toast, save, renderAll: () => renderAll(state)
};

async function loadPostbox() {
  mail = {};
  for (const source of postboxSources()) {
    try { mail[source.id] = await source.load(ctx); } catch (error) { mail[source.id] = []; }
  }
}
function body() {
  if (view.kind === 'friend') {
    const f = ctx.friend(view.friendId);
    if (!f) return '<p>Gone.</p>';
    const actions = friendActions(f, ctx).map(a => '<button class="btn" type="button" data-fr-action="' + esc(a.id) + '"' + (a.state === true ? '' : ' disabled title="' + esc(a.state) + '"') + '>' + esc(a.label) + '</button>').join('');
    const sections = friendsSections('friend').map(s => '<div data-fr-section="' + esc(s.id) + '">' + renderSafely(() => s.render(ctx, f)) + '</div>').join('');
    return '<div class="fr-actions"><button class="btn btn-ghost" type="button" data-hub="home">Back</button></div><h3>' + esc(f.name) + '</h3><div class="fr-actions">' + actions + '</div>' + sections;
  }
  if (view.kind === 'postbox') {
    return '<div class="fr-actions"><button class="btn btn-ghost" type="button" data-hub="home">Back</button></div>' + postboxSources().map(s =>
      '<section data-hub-source="' + esc(s.id) + '"><h3>' + esc(s.label || s.id) + '</h3><ul class="fr-list">' + (mail[s.id] || []).map(item => renderSafely(() => s.render(item, ctx))).join('') + '</ul></section>').join('');
  }
  if (view.kind === 'custom') {
    const v = view.custom;
    return '<div class="fr-actions"><button class="btn btn-ghost" type="button" data-hub="back">Back</button></div><div data-hub-view="' + esc(v.id) + '"><span class="eyebrow">' + esc(v.kicker) + '</span><h3>' + esc(v.title) + '</h3>' + v.html + '</div>';
  }
  return '<div class="fr-actions"><button class="btn" type="button" data-hub="postbox">Postbox</button></div><ul class="fr-list">' +
    friends.map(f => '<li class="fr-friend"><button class="btn" type="button" data-hub="friend" data-user="' + esc(f.userId) + '">' + esc(f.name) + '</button></li>').join('') + '</ul>' +
    friendsSections('home').map(s => '<div data-fr-section="' + esc(s.id) + '">' + renderSafely(() => s.render(ctx)) + '</div>').join('');
}
function paint() {
  if (!root) return;
  root.querySelector('[data-hub-body]').innerHTML = body();
  root.querySelector('[data-hub-status]').textContent = message;
  root.dataset.view = view.kind + (view.custom ? ':' + view.custom.id : '');
}

export async function openHub() {
  if (!root) {
    root = document.createElement('div');
    root.id = 'coopHub';
    root.className = 'veil open';
    root.innerHTML = '<div class="sheet sheet-friends" role="dialog" aria-label="Friends"><div class="sheet-head"><div><span class="eyebrow">Test hub</span><h2>Friends</h2></div>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-hub="close">Close</button></div><p class="fr-status" role="status" data-hub-status></p><div class="fr-body" data-hub-body></div></div>';
    document.body.appendChild(root);
    root.addEventListener('click', async e => {
      const hub = e.target.closest('[data-hub]');
      if (hub) {
        const go = hub.dataset.hub;
        if (go === 'close') return closeHub();
        if (go === 'friend') view = { kind: 'friend', friendId: hub.dataset.user };
        if (go === 'home') view = { kind: 'home' };
        if (go === 'back') return ctx.back();
        if (go === 'postbox') { view = { kind: 'postbox' }; await loadPostbox(); }
        return paint();
      }
      const action = e.target.closest('[data-fr-action]');
      if (action) { const f = ctx.friend(view.friendId); friendActions(f, ctx).find(a => a.id === action.dataset.frAction)?.run(f, ctx); return; }
      const sx = e.target.closest('[data-sx]');
      if (!sx) return;
      const section = sx.closest('[data-fr-section]'), source = sx.closest('[data-hub-source]'), custom = sx.closest('[data-hub-view]');
      if (section) friendsSections(view.kind === 'friend' ? 'friend' : 'home').find(s => s.id === section.dataset.frSection)?.onClick?.(sx.dataset.sx, sx, ctx, ctx.friend(view.friendId));
      else if (source) { const s = postboxSources().find(x => x.id === source.dataset.hubSource); await s?.onClick?.(sx.dataset.sx, sx.dataset.sxId, ctx); if (view.kind === 'postbox') { await loadPostbox(); paint(); } }
      else if (custom) socialView(custom.dataset.hubView)?.onClick?.(sx.dataset.sx, sx, ctx);
    });
    root.addEventListener('submit', e => { e.preventDefault(); const custom = e.target.closest('[data-hub-view]'); if (custom) socialView(custom.dataset.hubView)?.onSubmit?.(e.target, ctx); });
    window.addEventListener('shelflife:social-close', closeHub);
  }
  social.optIn();
  const p = await social.profile();
  me = { userId: cloud.userId(), code: p.code, name: p.name };
  friends = (await social.friends()).filter(f => f.status === 'accepted');
  root.classList.add('open');
  view = { kind: 'home' };
  paint();
  return true;
}
export function closeHub() { root?.classList.remove('open'); }
export const hubCtx = ctx;
