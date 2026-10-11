// A small stand-in for the Friends hub, for browser specs only. It renders
// whatever src/ui/social-registry.js holds (friend actions, sections, postbox
// sources and custom views) in a sheet of its own, with the same markup
// conventions the real hub uses: [data-fr-action="<id>"] for actions,
// [data-fr-section="<id>"] for sections, [data-fr-source="<id>"] for postbox
// rows, and [data-sx] clicks handed to their owners. Loaded in the page with
// import('/test/support/hub-harness.js'); never shipped.
import { friendActions, postboxSources, friendsSections, socialView } from '/src/ui/social-registry.js';
import { state, save } from '/src/state.js';
import { cloud, social } from '/src/cloud/index.js';
import { renderAll } from '/src/ui/render.js';
import { toast } from '/src/ui/toast.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let veil = null, body = null, status = null, titleEl = null, kickerEl = null;
let friends = [], screen = { kind: 'main' }, items = new Map();

export const ctx = {
  get state() { return state; },
  social, cloud,
  me: { userId: '', code: '', name: '' },
  friends: () => friends,
  friend: id => friends.find(f => f.userId === id) || null,
  show(view) { screen = { kind: 'view', id: view.id, back: view.back || 'main' }; paint(view.title, view.kicker, '<div data-hub-view="' + esc(view.id) + '">' + view.html + '</div>', true); },
  back() { go(screen.back || 'main'); },
  refresh() { if (screen.kind === 'postbox') openPostbox(); else if (screen.kind === 'friend') openFriend(screen.userId); },
  say(text) { if (status) status.textContent = text; },
  toast, save, renderAll: () => renderAll(state)
};

function build() {
  if (veil) { veil.classList.add('open'); return; }
  veil = document.createElement('div');
  veil.className = 'veil open';
  veil.id = 'hubVeil';
  veil.innerHTML = '<div class="sheet sheet-friends" id="hubSheet" role="dialog" aria-modal="true" aria-labelledby="hubTitle"><div class="sheet-head"><div>' +
    '<span class="eyebrow" data-hub-kicker></span><h2 id="hubTitle" data-hub-title tabindex="-1">Friends</h2></div>' +
    '<button class="btn btn-ghost btn-sm" type="button" data-hub="close">Close</button></div><p class="fr-status" role="status" aria-live="polite" data-hub-status></p><div class="fr-body" data-hub-body></div></div>';
  document.body.appendChild(veil);
  body = veil.querySelector('[data-hub-body]'); status = veil.querySelector('[data-hub-status]');
  titleEl = veil.querySelector('[data-hub-title]'); kickerEl = veil.querySelector('[data-hub-kicker]');
  veil.addEventListener('click', onClick);
}
function paint(title, kicker, html, back = false) {
  titleEl.textContent = title || 'Friends';
  kickerEl.textContent = kicker || '';
  body.innerHTML = (back ? '<div class="fr-actions fr-back"><button class="btn btn-ghost" type="button" data-hub="back">Back</button></div>' : '') + html;
}
function go(target) {
  if (target === 'postbox') return openPostbox();
  if (String(target).startsWith('friend:')) return openFriend(String(target).slice(7));
  screen = { kind: 'main' };
  paint('Friends', '', '<ul class="fr-list">' + friends.map(f => '<li class="fr-friend"><button class="btn" type="button" data-hub="friend" data-user="' + esc(f.userId) + '">' + esc(f.name || 'A friend') + '</button></li>').join('') + '</ul>' +
    '<button class="btn" type="button" data-hub="postbox">Postbox</button>');
}

export async function openHub() {
  build();
  social.optIn();
  friends = (await social.friends()).filter(f => f.status === 'accepted');
  await social.publish({ force: true }).catch(() => {});
  go('main');
}
export async function openFriend(userId) {
  if (!veil) await openHub();
  const friend = ctx.friend(userId);
  screen = { kind: 'friend', userId };
  const actions = friendActions(friend, ctx).map(a => '<button class="btn" type="button" data-fr-action="' + esc(a.id) + '"' + (a.state === true ? '' : ' disabled') + '>' + esc(a.label) + '</button>' +
    (typeof a.state === 'string' ? '<small data-fr-action-reason="' + esc(a.id) + '">' + esc(a.state) + '</small>' : '')).join('');
  const sections = friendsSections('friend').map(s => '<div data-fr-section="' + esc(s.id) + '">' + s.render(ctx, friend) + '</div>').join('');
  paint((friend?.name || 'A friend') + '’s profile', 'Friend', '<div class="fr-actions" data-hub-actions>' + actions + '</div>' + sections, false);
}
export async function openPostbox() {
  if (!veil) await openHub();
  screen = { kind: 'postbox' };
  paint('Postbox', 'Loading', '<p class="hint">Sorting the post.</p>');
  items = new Map();
  let html = '';
  for (const source of postboxSources()) {
    const list = await source.load(ctx).catch(() => []);
    for (const item of list) {
      items.set(source.id + ':' + item.id, item);
      html += '<li data-fr-source="' + esc(source.id) + '" data-fr-item="' + esc(item.id) + '">' + source.render(item, ctx) + '</li>';
    }
  }
  if (screen.kind === 'postbox') paint('Postbox', '', '<ul class="fr-list" data-hub-postbox>' + (html || '<li class="hint" data-hub-empty>Nothing in the post.</li>') + '</ul>');
}
export function closeHub() { veil?.classList.remove('open'); }
export function counts() { return Object.fromEntries(postboxSources().map(s => [s.id, s.count ? s.count(ctx) : 0])); }

async function onClick(e) {
  const hubButton = e.target.closest('[data-hub]');
  if (hubButton) {
    const what = hubButton.dataset.hub;
    if (what === 'close') closeHub();
    if (what === 'back') ctx.back();
    if (what === 'friend') openFriend(hubButton.dataset.user);
    if (what === 'postbox') openPostbox();
    return;
  }
  const action = e.target.closest('[data-fr-action]');
  if (action && !action.disabled) {
    const friend = ctx.friend(screen.userId);
    const found = friendActions(friend, ctx).find(a => a.id === action.dataset.frAction);
    found?.run(friend, ctx);
    return;
  }
  const el = e.target.closest('[data-sx]');
  if (!el || el.disabled) return;
  const viewEl = el.closest('[data-hub-view]');
  if (viewEl) { socialView(viewEl.dataset.hubView)?.onClick?.(el.dataset.sx, el, ctx); return; }
  const row = el.closest('[data-fr-source]');
  if (row) {
    const source = postboxSources().find(s => s.id === row.dataset.frSource);
    source?.onClick?.(el.dataset.sx, el.dataset.sxId || row.dataset.frItem, ctx);
    return;
  }
  const section = el.closest('[data-fr-section]');
  if (section) {
    const s = friendsSections('friend').find(x => x.id === section.dataset.frSection);
    s?.onClick?.(el.dataset.sx, el, ctx, ctx.friend(screen.userId));
  }
}
