// A stand-in for the Friends hub, for browser specs only. It renders what the
// social registry holds (friend actions as [data-fr-action], sections as
// [data-fr-section], postbox rows, custom views) and routes clicks the way the
// registry contract says the hub does, using the page's own state, cloud and
// social instances. Specs mount it with:
//   await page.evaluate(() => import('/test/support/social-host.mjs').then(m => m.mountHost()))
// Once the real hub is merged, specs open the real Friends sheet instead and
// keep the same [data-fr-action] / [data-fr-section] selectors.
import { friendActions, friendsSections, postboxSources, postboxCount, socialView, renderSafely } from '/src/ui/social-registry.js';
import { state, save } from '/src/state.js';
import { cloud, social } from '/src/cloud/index.js';
import { renderAll } from '/src/ui/render.js';
import { toast } from '/src/ui/toast.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export async function mountHost() {
  document.getElementById('tradeHostVeil')?.remove();
  const veil = document.createElement('div');
  veil.className = 'veil open';
  veil.id = 'tradeHostVeil';
  veil.innerHTML = '<div class="sheet sheet-friends" id="tradeHost" role="dialog" aria-label="Friends"><div class="sheet-head"><div><span class="eyebrow" data-h-kicker></span><h2 data-h-title tabindex="-1">Friends</h2></div>' +
    '<button class="btn btn-ghost btn-sm" type="button" data-h="close">Close</button></div><p class="fr-status" role="status" aria-live="polite" data-h-status></p><div class="fr-body" data-h-body></div></div>';
  document.body.appendChild(veil);
  const sheet = veil.querySelector('#tradeHost'), body = sheet.querySelector('[data-h-body]'), status = sheet.querySelector('[data-h-status]');
  social.optIn();
  let friends = (await social.friends()).filter(f => f.status === 'accepted');
  let view = { kind: 'home' }, items = [];

  const ctx = {
    state, social, cloud,
    me: { userId: cloud.userId(), code: '', name: '' },
    friends: () => friends,
    friend: id => friends.find(f => f.userId === id) || null,
    show(v) { view = { kind: 'custom', v }; render(); },
    back() { go(view.kind === 'custom' ? view.v.back : 'main'); },
    // A repaint reloads the postbox rows, as the hub does when its mail changes.
    refresh() { if (view.kind === 'postbox') openPostbox(); else render(); },
    say(text) { status.textContent = text; },
    toast, save,
    renderAll: () => renderAll(state)
  };
  async function go(target = 'main') {
    if (target === 'postbox') return openPostbox();
    if (String(target).startsWith('friend:')) { view = { kind: 'friend', userId: target.slice(7) }; return render(); }
    view = { kind: 'home' };
    render();
  }
  async function openPostbox() {
    view = { kind: 'postbox' };
    items = [];
    render();
    const loaded = await Promise.all(postboxSources().map(async s => (await s.load(ctx).catch(() => [])).map(item => ({ ...item, source: s.id }))));
    items = loaded.flat().sort((a, b) => b.at - a.at);
    if (view.kind === 'postbox') { view.loaded = true; render(); }
  }
  function render() {
    let title = 'Friends', kicker = 'Seen by friends. Nobody else.', html = '';
    if (view.kind === 'home') {
      html = '<div class="fr-actions"><button class="btn" type="button" data-h="postbox">Postbox <span data-h-count>' + postboxCount(ctx) + '</span></button></div>' +
        '<ul class="fr-list">' + friends.map(f => '<li class="fr-friend"><div class="fr-line"><b>' + esc(f.name || f.code) + '</b><button class="btn btn-sm" type="button" data-h="friend" data-user="' + esc(f.userId) + '">Open ' + esc(f.name || f.code) + '</button></div></li>').join('') + '</ul>' +
        friendsSections('home').map(s => '<div data-fr-section="' + esc(s.id) + '">' + renderSafely(() => s.render(ctx)) + '</div>').join('');
    } else if (view.kind === 'friend') {
      const f = ctx.friend(view.userId);
      title = (f?.name || 'A friend') + '’s profile'; kicker = 'A friend';
      html = '<div class="fr-actions"><button class="btn btn-ghost" type="button" data-h="home">Back to friends</button></div><div class="fr-actions">' +
        friendActions(f, ctx).map(a => '<button class="btn" type="button" data-fr-action="' + esc(a.id) + '"' + (a.state === true ? '' : ' disabled title="' + esc(a.state) + '"') + '>' + esc(a.label) + '</button>').join('') + '</div>' +
        friendsSections('friend').map(s => '<div data-fr-section="' + esc(s.id) + '">' + renderSafely(() => s.render(ctx, f)) + '</div>').join('');
    } else if (view.kind === 'postbox') {
      title = 'Postbox'; kicker = 'Mail for the shelf';
      html = '<div class="fr-actions"><button class="btn btn-ghost" type="button" data-h="home">Back to friends</button></div>' +
        (view.loaded ? (items.length ? '<ul class="fr-list">' + items.map(item => {
          const source = postboxSources().find(s => s.id === item.source);
          return '<li class="fr-friend" data-postbox-source="' + esc(item.source) + '" data-postbox-item="' + esc(item.id) + '">' + renderSafely(() => source.render(item, ctx)) + '</li>';
        }).join('') + '</ul>' : '<p class="fr-empty" data-postbox-empty>Nothing in the postbox.</p>') : '<p data-postbox-loading>Checking the post.</p>');
    } else {
      title = view.v.title || ''; kicker = view.v.kicker || '';
      html = '<div class="fr-actions"><button class="btn btn-ghost" type="button" data-h="back">Back</button></div><div data-fr-view="' + esc(view.v.id) + '">' + view.v.html + '</div>';
    }
    sheet.querySelector('[data-h-title]').textContent = title;
    sheet.querySelector('[data-h-kicker]').textContent = kicker;
    body.innerHTML = html;
  }
  veil.addEventListener('click', async e => {
    const h = e.target.closest('[data-h]');
    if (h) {
      const what = h.dataset.h;
      if (what === 'close') { veil.remove(); return; }
      if (what === 'postbox') return openPostbox();
      if (what === 'friend') return go('friend:' + h.dataset.user);
      if (what === 'home') return go('main');
      if (what === 'back') return ctx.back();
      return;
    }
    const action = e.target.closest('[data-fr-action]');
    if (action && !action.disabled) {
      const a = friendActions(ctx.friend(view.userId), ctx).find(x => x.id === action.dataset.frAction);
      return a?.run(ctx.friend(view.userId), ctx);
    }
    const sx = e.target.closest('[data-sx]');
    if (!sx || sx.disabled) return;
    const inView = sx.closest('[data-fr-view]'), inSection = sx.closest('[data-fr-section]'), inPost = sx.closest('[data-postbox-source]');
    if (inView) return socialView(inView.dataset.frView)?.onClick?.(sx.dataset.sx, sx, ctx);
    if (inSection) {
      const s = friendsSections(view.kind === 'friend' ? 'friend' : 'home').find(x => x.id === inSection.dataset.frSection);
      return s?.onClick?.(sx.dataset.sx, sx, ctx, view.kind === 'friend' ? ctx.friend(view.userId) : undefined);
    }
    if (inPost) return postboxSources().find(s => s.id === inPost.dataset.postboxSource)?.onClick?.(sx.dataset.sx, sx.dataset.sxId, ctx);
  });
  render();
  window.__tradeHost = { ctx, go, openPostbox, friends: () => friends };
  return true;
}
