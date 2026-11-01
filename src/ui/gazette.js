// The paper is a Friends plug-in. All server strings remain text and every
// async result is discarded if the account or shelf has changed.
import { registerFriendsSection } from './social-registry.js';
import { cloud, social } from '../cloud/index.js';
import { state } from '../state.js';
import { createGazetteJournal } from '../gazette-state.js';
import { guestPortrait, esc } from './friends.js';
import { timeAgo } from './cloud.js';

const STICKERS = [['candle','Candle'],['skull','Skull'],['lily','Sympathy lily'],['popcorn','Popcorn'],['rude','Rude'],['moth','Moth']];
const HEADLINES = {
  adopted: ['New resident moves in', 'Shelf gains a new tenant', 'Local household expands', 'An arrival has been reported'],
  coffin: ['Notable object found in coffin', 'Cabinet receives unusual item', 'Coffin yields evidence', 'A rare find changes hands'],
  verdict: ['Shelf Court reaches a verdict', 'Judgement delivered locally', 'Court adjourns with opinions', 'The bench has spoken'],
  arcade_best: ['Local sets a new arcade best', 'Arcade record under investigation', 'New score entered in the books', 'Player surprises arcade staff'],
  collection: ['Collection completed', 'Collector closes another case', 'Set finally accounted for', 'Cabinet reaches a milestone'],
  almanac: ['Almanac reaches a new tier', 'More progress recorded', 'Another tier enters the register', 'Almanac staff approve progress'],
  bond: ['Resident grows closer to household', 'A bond reaches new heights', 'Household trust rises', 'Resident admits to fondness']
};
const journal = typeof window !== 'undefined' ? createGazetteJournal({ cloud, getState: () => state }) : null;
let owner = null, epoch = 0, events = null, sharing = true, loading = false, problem = '', lastCtx = null, unread = 0, hasMore = false;
let portraitCache = new Map();
export const gazetteUnread = () => social.active() ? unread : 0;
function setUnread(n) {
  const value = Number.isFinite(n) ? Math.max(0, Math.min(999, Math.floor(n))) : 0;
  if (value === unread) return;
  unread = value;
  window.dispatchEvent(new CustomEvent('shelflife:gazette-unread', { detail: value }));
}
function reset() {
  if (owner === cloud.userId()) return;
  owner = cloud.userId(); epoch++; events = null; sharing = true; loading = false; problem = ''; portraitCache = new Map(); lastCtx = null; hasMore = false;
  setUnread(0); journal?.reset();
}
const alive = (id, generation) => id && cloud.userId() === id && epoch === generation && social.active();
const repaint = () => { if (lastCtx?.isCurrent?.() !== false) lastCtx?.refresh?.(); };
const title = event => { const list = HEADLINES[event.kind] || ['News from the neighbourhood']; const seed = [...String(event.id)].reduce((n, c) => n + c.charCodeAt(0), 0); return list[seed % list.length]; };
function description(e) {
  const d = e.data || {};
  if (e.kind === 'arcade_best') return 'New ' + String(d.game || '') + ' best: ' + String(d.score || 0) + '.';
  if (e.kind === 'bond') return 'Bond milestone: ' + String(d.level || 0) + '.';
  if (e.kind === 'almanac') return 'Tier ' + String(d.tier || 0) + ' reached.';
  return '';
}
function article(e) {
  const name = String(e.name || 'A neighbour').slice(0, 24), id = String(e.id || '');
  const counts = e.counts && typeof e.counts === 'object' ? e.counts : {};
  const shelf = portraitCache.get(e.actor), resident = shelf?.residents?.find(r => r.id === e.data?.resident) || shelf?.residents?.[0];
  const portrait = resident ? guestPortrait(resident) : '';
  return '<article class="gz-story"><div class="gz-story-head">' + (portrait ? '<span class="gz-portrait" aria-hidden="true">' + portrait + '</span>' : '') +
    '<div><h4>' + esc(title(e)) + '</h4><p>' + esc(name) + ' · ' + esc(timeAgo(Date.parse(e.created_at) || 0)) + '</p></div></div>' +
    (description(e) ? '<p>' + esc(description(e)) + '</p>' : '') + '<div class="gz-stickers" aria-label="Reactions">' + STICKERS.map(([key,label]) => {
      const n = Number.isFinite(Number(counts[key])) ? Math.max(0, Math.floor(Number(counts[key]))) : 0;
      return '<button type="button" data-sx="gazette-react" data-sx-id="' + esc(id) + '" data-sticker="' + key + '" aria-pressed="' + (e.my_reaction === key) + '" aria-label="' + esc(label + (n ? ', ' + n : '')) + '">' + esc(label) + (n ? ' ' + n : '') + '</button>';
    }).join('') + '</div></article>';
}
function home(ctx) {
  lastCtx = ctx;
  if (!social.active()) return '';
  if (events === null && !loading && !problem) void load(ctx);
  return '<div class="gz-paper"><p class="gz-kicker">The neighbourhood</p><h3>The Gazette</h3><p class="gz-subtitle">All the news that fits.</p>' +
    '<div class="gz-setting"><span>Print my news</span><button class="fr-switch" type="button" role="switch" data-sx="gazette-sharing" aria-label="Print my news" aria-checked="' + sharing + '"><i></i></button></div>' +
    (problem ? '<p role="status">The paper could not be delivered. <button type="button" class="btn btn-sm" data-sx="gazette-retry">Try again</button></p>' : '') +
    (loading && !events ? '<p>Checking the presses.</p>' : events?.length ? events.map(article).join('') : '<p class="gz-empty">No news. The neighbours insist this is normal.</p>') +
    (hasMore ? '<button class="btn btn-sm" type="button" data-sx="gazette-older">Older news</button>' : '') + '</div>';
}
function friendSection(ctx, friend) {
  if (!social.active() || !friend || !events) return '';
  const theirs = events.filter(e => e.actor === friend.userId);
  return '<div class="gz-paper gz-profile"><h3>In the Gazette</h3>' + (theirs.length ? theirs.map(article).join('') : '<p>No news from this household yet.</p>') + '</div>';
}
async function load(ctx, older = false) {
  const id = cloud.userId(), generation = epoch;
  if (!social.active() || loading || !id) return;
  loading = true; problem = ''; repaint();
  try {
    const before = older && events?.length ? events[events.length - 1].id : null;
    const result = await cloud.rpc('gazette_feed', { p_before: before, p_limit: 20 });
    if (!alive(id, generation) || ctx?.isCurrent?.() === false) return;
    const incoming = Array.isArray(result?.events) ? result.events.filter(e => e && typeof e.id === 'string' && typeof e.actor === 'string' && HEADLINES[e.kind]) : [];
    events = older ? [...(events || []), ...incoming.filter(e => !events.some(old => old.id === e.id))] : incoming;
    hasMore = incoming.length === 20;
    if (journal.setSharing(result?.sharing, result?.generation)) sharing = result.sharing;
    const actors = [...new Set(incoming.map(e => e.actor))].filter(actor => !portraitCache.has(actor));
    await Promise.all(actors.map(async actor => { try { const shelf = await social.shelf(actor); if (alive(id,generation)) portraitCache.set(actor,shelf?.shelf || null); } catch { if (alive(id,generation)) portraitCache.set(actor,null); } }));
    if (!alive(id, generation) || ctx?.isCurrent?.() === false) return;
    await cloud.rpc('gazette_seen');
    if (alive(id, generation)) setUnread(0);
  } catch { if (alive(id, generation)) problem = 'unavailable'; }
  finally { if (alive(id, generation)) { loading = false; repaint(); } }
}
async function handle(action, el, ctx) {
  const id = cloud.userId(), generation = epoch;
  if (action === 'gazette-retry') { events = null; problem = ''; await load(ctx); return; }
  if (action === 'gazette-older') { await load(ctx, true); return; }
  try {
    if (action === 'gazette-sharing') {
      const result = await cloud.rpc('gazette_set_sharing', { p_on: !sharing });
      if (!alive(id,generation) || !ctx.current()) return;
      if (journal.setSharing(result?.sharing, result?.generation)) sharing = result.sharing;
    } else if (action === 'gazette-react') {
      const event = events?.find(e => e.id === el.dataset.sxId), sticker = el.dataset.sticker;
      if (!event || !STICKERS.some(([key]) => key === sticker)) return;
      await cloud.rpc('gazette_react', { p_event: event.id, p_sticker: event.my_reaction === sticker ? null : sticker });
      if (!alive(id,generation) || !ctx.current()) return;
      await load(ctx);
    }
  } catch { if (alive(id,generation)) ctx.say('The Gazette could not save that. Try again.'); }
  if (alive(id,generation)) repaint();
}
registerFriendsSection({ id: 'gazette', order: 20, where: 'home', render: home, onClick: handle });
registerFriendsSection({ id: 'gazette-profile', order: 20, where: 'friend', render: friendSection, onClick: handle });

if (typeof window !== 'undefined') {
  let timer = null;
  const capture = () => { clearTimeout(timer); timer = setTimeout(() => { journal.capture(); void journal.flush(); }, 150); };
  window.addEventListener('shelflife:storage', capture);
  window.addEventListener('shelflife:state-replaced', () => { clearTimeout(timer); epoch++; events = null; portraitCache.clear(); journal.reset(); });
  cloud.subscribeRpc(({ name, id, userId }) => {
    if (userId !== cloud.userId() || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '')) return;
    journal.enqueue({ kind: 'verdict', data: { item: name === 'rule_summons' ? 'friend-case' : 'joint-hearing' } }, id);
    void journal.flush();
  });
  const poll = async () => {
    reset();
    const id = cloud.userId(), generation = epoch;
    if (!id || navigator.onLine === false) return;
    try {
      const status = await journal.refreshSettings();
      if (id !== cloud.userId() || generation !== epoch) return;
      if (status) { sharing = status.sharing; repaint(); }
      void journal.flush();
    } catch { /* Keep local news until the connection returns. */ }
    if (!social.active()) return;
    try { const n = await cloud.rpc('gazette_unread'); if (alive(id,generation)) setUnread(Number(n)); } catch { /* The next check retries. */ }
  };
  cloud.subscribe(() => { reset(); void poll(); });
  social.subscribe(() => { reset(); void poll(); });
  window.addEventListener('online', poll);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void poll(); });
  setInterval(() => { if (!document.hidden) void poll(); }, 60000);
  void poll();
}
