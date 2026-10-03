import {
  syncAlmanac, chapterView, nextChapter, claimTier, claimReady, claimWeekly, claimChest, weeklyView, dismissSettled, chapterAt, daysLeft
} from '../engine/almanac.js';
import { checkReturn } from '../engine/returns.js';
import { checkAchievements } from '../engine/achievements.js';
import { freezeCount, unseenNotices, markNoticesSeen, noticeText } from '../engine/streaks.js';
import { titlesOwned, activeTitle, equipTitle } from '../engine/collections.js';
import { legacyInfo } from '../engine/legacy.js';
import { TIERS, DAILY_XP_CAP, CHAPTERS } from '../content/almanac.js';
import { FREEZE_MAX } from '../almanac-state.js';
import { titleText } from '../content/collections.js';
import { almanacCurioSVG, badgeSVG, chapterBannerSVG } from '../art/almanac-art.js';
import { glyph } from '../art/mayhem-glyphs.js';
import { mayhemState } from '../mayhem-state.js';
import { save } from '../state.js';
import { esc, plural, byId, num, say, celebrate, chime, openSheet, closeSheet } from './retention-kit.js';

const CHAPTER_COUNT = CHAPTERS.length;

/* ================= THE ALMANAC: SCREENS =================
   The Today tile on the shelf desk, and one sheet with everything about the
   running chapter: the countdown, the track, the weekly challenges, the streak
   freezes and the titles. Claiming is always the player's tap: nothing is paid
   behind their back except last week's leftovers, and that is said plainly. */

let S = null, refresh = () => {};
let lastResults = [];     // what the last tap paid, shown at the top of the sheet until the next one
const shown = new WeakSet();

/* ---------- the quiet work done on every render ---------- */
// Reads the counters, notices a return, checks the new achievements and says what happened.
export function syncRetention(state, now = Date.now()) {
  // Called from every render of the shelf. Whatever goes wrong in here must never stop the shelf drawing.
  try { return syncRetentionNow(state, now); } catch { return []; }
}
function syncRetentionNow(state, now) {
  const events = syncAlmanac(state, now);
  checkReturn(state, now);
  const unlocked = checkAchievements(state, now);
  for (const e of events) {
    if (e.type === 'tier') say('Almanac tier ' + e.tier + ' reached. The reward is waiting on the Today desk.');
    else if (e.type === 'weekly') say('Weekly challenge done: ' + e.label + '. Collect it in the Almanac.');
    else if (e.type === 'spotlight') say('Court spotlight aired: +' + e.souls + ' souls and +' + e.xp + ' Almanac XP.');
    else if (e.type === 'settled') say('Last week’s unclaimed prizes were paid out: ' + e.souls + ' souls.');
  }
  for (const a of unlocked) say('Incident on file: ' + a.label + '.');
  // A freeze that saved a streak is told once, in plain words. One that was earned is told when the Almanac opens.
  for (const n of unseenNotices(state)) if (n.type === 'saved' && !shown.has(n)) { shown.add(n); say(noticeText(n)); }
  return events;
}

/* ---------- the Today tile ---------- */
export function almanacTileHTML(state, now = Date.now()) {
  if (!(state.pets || []).length) return '';
  const view = chapterView(state, now);
  if (!view.chapter) {
    const next = view.next;
    return next ? '<button class="mh-tile alm-tile" type="button" data-alm="open"><span class="mh-tile-kicker">The Almanac</span><b>Opens in ' + plural(view.opensIn, 'day') + '</b><small>' + esc(next.name) + ' comes first.</small></button>' : '';
  }
  const c = view.chapter, pct = view.next ? Math.round(view.next.have / view.next.need * 100) : 100;
  const left = view.left === 1 ? 'Last day' : view.left + ' days left';
  const ready = view.ready.length;
  return '<button class="mh-tile alm-tile' + (ready ? ' has-ready' : '') + '" type="button" data-alm="open" style="--alm-glow:' + esc(c.colors.glow) + ';--alm-a:' + esc(c.colors.a) + '">' +
    '<span class="mh-tile-kicker">Almanac · ' + esc(c.month) + (c.encore ? ' · encore' : '') + '</span>' +
    '<b>' + esc(c.name) + '</b>' +
    '<span class="alm-tile-row"><span>' + (view.done ? 'Track complete' : 'Tier ' + view.tier + ' of ' + TIERS) + '</span><span class="alm-left">' + esc(left) + '</span></span>' +
    '<span class="mh-meter"><i style="width:' + pct + '%"></i></span>' +
    '<small>' + (ready ? '<b class="alm-ready">' + plural(ready, 'reward') + ' ready to claim</b>' : view.next ? 'Next: ' + esc(view.next.reward.label) : 'Everything claimed. Back Issues are open.') + '</small></button>';
}

/* ---------- the sheet ---------- */
const sheet = () => byId('almanacSheet');
const KIND_ICON = {
  souls: () => glyph('soul'), decor: () => glyph('door'), title: () => glyph('scroll')
};
function rewardIcon(r, chapter, earned) {
  if (r.kind === 'curio') return almanacCurioSVG(r.curio, chapter, { locked: !earned });
  if (r.kind === 'badge') return badgeSVG(chapter, { earned });
  return (KIND_ICON[r.kind] || KIND_ICON.souls)();
}

function resultHTML(results) {
  if (!results.length) return '';
  const items = results.map(r => {
    const bits = [];
    if (r.souls) bits.push('+' + num(r.souls) + ' souls');
    if (r.curio) bits.push(esc(r.curio.name) + (r.duplicate ? ' (already yours, paid as souls)' : ''));
    if (r.decor && r.decor.length) bits.push('room set added to Decorate');
    if (r.title) bits.push('title: ' + esc(r.title) + (r.duplicate ? ' (already yours)' : ''));
    if (r.badge) bits.push('badge: ' + esc(r.badge));
    if (r.xp) bits.push('+' + r.xp + ' XP');
    return '<li>' + (r.tier ? '<b>Tier ' + r.tier + '</b> ' : '') + bits.join(' · ') + '</li>';
  }).join('');
  return '<div class="alm-result" role="status"><span class="mh-tile-kicker">Just collected</span><ul>' + items + '</ul></div>';
}

function weeklyHTML(state, now) {
  const w = weeklyView(state, now);
  const done = w.items.filter(c => c.done).length;
  const rows = w.items.map(c => {
    const pct = Math.round(c.have / c.need * 100);
    return '<li class="alm-weekly-row' + (c.claimed ? ' claimed' : c.done ? ' done' : '') + '"><div class="alm-weekly-text"><b>' + esc(c.label) + '</b><small>' + esc(c.line) + '</small>' +
      '<span class="mh-meter"><i style="width:' + pct + '%"></i></span></div><span class="alm-weekly-side">' +
      (c.claimed ? '<span class="alm-done" aria-label="Claimed">✓</span>' : c.done ? '<button class="btn btn-sm btn-primary" type="button" data-alm="weekly" data-id="' + esc(c.id) + '">Collect</button>' : '<em>' + c.have + '/' + c.need + '</em>') + '</span></li>';
  }).join('');
  const chest = w.chest.claimed ? '<p class="alm-chest done">The weekly chest is open. It will be back on Monday, a little smug.</p>' :
    '<div class="alm-chest' + (w.chest.ready ? ' ready' : '') + '"><span class="alm-chest-art" aria-hidden="true">' + glyph('box') + '</span><span><b>Weekly chest</b><small>' + (w.chest.ready ? 'Three done. Souls, Almanac XP and a curio roll.' : done + ' of 3 done. Finish them all to open it.') + '</small></span>' +
    (w.chest.ready ? '<button class="btn btn-primary btn-sm" type="button" data-alm="chest">Open</button>' : '') + '</div>';
  return '<section class="alm-section alm-weekly"><h3>This week <small>' + (w.endsIn === 1 ? 'ends tonight' : w.endsIn + ' days left') + '</small></h3><ul>' + rows + '</ul>' + chest + '</section>';
}

function trackHTML(view, chapter) {
  const nextUp = view.rewards.filter(r => r.state !== 'claimed').slice(0, 3);
  const row = r => '<li class="alm-row ' + r.state + (r.kind === 'curio' || r.kind === 'badge' || r.kind === 'decor' || r.kind === 'title' ? ' special' : '') + '" data-tier="' + r.tier + '">' +
    '<span class="alm-no">' + r.tier + '</span><span class="alm-ico">' + rewardIcon(r, chapter, r.state === 'claimed') + '</span>' +
    '<span class="alm-label"><b>' + esc(r.label) + '</b><small>' + (r.state === 'locked' ? num(r.xpAt - view.xp) + ' XP to go' : r.state === 'ready' ? 'Ready' : 'Claimed') + '</small></span>' +
    '<span class="alm-state">' + (r.state === 'ready' ? '<button class="btn btn-sm btn-primary" type="button" data-alm="claim" data-tier="' + r.tier + '">Claim</button>' : r.state === 'claimed' ? '<span class="alm-done" aria-label="Claimed">✓</span>' : '<span class="alm-lock" aria-label="Locked">' + glyph('door') + '</span>') + '</span></li>';
  return '<section class="alm-section"><h3>Next up</h3><ul class="alm-track">' + (nextUp.map(row).join('') || '<li class="alm-empty">Every reward on this track is yours. The Back Issues shelf is open.</li>') + '</ul>' +
    '<details class="alm-all"><summary>All ' + TIERS + ' tiers</summary><ul class="alm-track">' + view.rewards.map(row).join('') + '</ul></details></section>';
}

function cuiosHTML(view, state) {
  const c = view.chapter, owned = id => (mayhemState(state).curios[id] || 0) > 0;
  const items = c.curios.map(k => '<li class="' + (owned(k.id) ? 'got' : 'missing') + '"><span class="alm-curio-frame">' + almanacCurioSVG(k, c, { locked: !owned(k.id) }) + '</span><b>' + (owned(k.id) ? esc(k.name) : '???') + '</b><small>' + (owned(k.id) ? 'In the cabinet' : 'Tier ' + view.rewards.find(r => r.curio && r.curio.id === k.id).tier) + '</small></li>').join('');
  return '<section class="alm-section"><h3>Limited curios <small>' + c.curios.filter(k => owned(k.id)).length + '/4</small></h3><ul class="alm-curios">' + items + '</ul>' +
    '<p class="hint">Only handed out while the chapter runs. Miss one and it comes back in Back Issues, for more souls than it was worth.</p></section>';
}

function freezeHTML(state) {
  const n = freezeCount(state), notices = unseenNotices(state);
  const pips = Array.from({ length: FREEZE_MAX }, (_, i) => '<i class="' + (i < n ? 'on' : '') + '"></i>').join('');
  return '<section class="alm-section alm-freeze"><h3>Streak freezes <small>' + n + ' of ' + FREEZE_MAX + '</small></h3><div class="alm-freeze-row"><span class="alm-pips" aria-hidden="true">' + pips + '</span>' +
    '<p>Seven days running on the omen, the docket or the daily challenge earns one. A freeze covers one missed day, on its own, without being asked.</p></div>' +
    notices.map(x => '<p class="alm-notice ' + x.type + '">' + esc(noticeText(x)) + '</p>').join('') + '</section>';
}

function titlesHTML(state) {
  const owned = titlesOwned(state), active = activeTitle(state);
  if (!owned.length) return '<section class="alm-section"><h3>Titles</h3><p class="hint">None yet. Chapters, collections, Legacy ranks and commissions each pay one. Wear one and it is printed under your rank.</p></section>';
  const chips = ['<button class="filter-chip" type="button" data-alm="title" data-id="" aria-pressed="' + (!active) + '">None</button>']
    .concat(owned.map(id => '<button class="filter-chip" type="button" data-alm="title" data-id="' + esc(id) + '" aria-pressed="' + (active === id) + '">' + esc(titleText(id)) + '</button>')).join('');
  return '<section class="alm-section"><h3>Titles <small>' + owned.length + '</small></h3><div class="alm-chips">' + chips + '</div></section>';
}

function renderSheet(state, now = Date.now()) {
  const el = sheet();
  if (!el) return;
  const view = chapterView(state, now), a = state.almanac;
  const head = chapter => '<div class="sheet-head"><div><span class="eyebrow">' + (chapter ? (chapter.encore ? 'Almanac · Encore' : 'Almanac · Chapter ' + chapter.no + ' of ' + CHAPTER_COUNT) : 'The Almanac') + '</span><h2>' + esc(chapter ? chapter.name : 'Not yet open') + '</h2></div><button class="btn btn-ghost btn-sm" type="button" data-alm="close">Close</button></div>';
  if (!view.chapter) {
    el.className = 'sheet sheet-almanac';
    el.innerHTML = head(null) + '<p class="alm-blurb">The first chapter opens on 1 October 2026. The calendar is already written, all fifteen months of it. It is waiting for you to be there.</p>';
    return;
  }
  const c = view.chapter, pct = view.next ? Math.round(view.next.have / view.next.need * 100) : 100;
  const left = view.left === 1 ? 'Last day' : view.left + ' days left';
  const legacy = legacyInfo(state);
  el.className = 'sheet sheet-almanac' + (c.flagship ? ' flagship' : '');
  el.style.setProperty('--alm-a', c.colors.a); el.style.setProperty('--alm-b', c.colors.b); el.style.setProperty('--alm-glow', c.colors.glow);
  el.innerHTML = head(c) +
    resultHTML(lastResults) +
    (a.settled ? '<div class="alm-notice settled"><p>' + esc(a.settled.text) + '</p><button class="btn btn-ghost btn-sm" type="button" data-alm="settled">Noted</button></div>' : '') +
    '<section class="alm-hero"><div class="alm-banner">' + chapterBannerSVG(c) + '<div class="alm-banner-text"><span class="alm-month">' + esc(c.month) + (c.flagship ? ' · Halloween' : '') + '</span><span class="alm-countdown"><b>' + esc(left) + '</b></span></div></div>' +
    '<p class="alm-blurb">' + esc(c.blurb) + '</p>' +
    '<div class="alm-progress"><div class="alm-tier"><b>' + (view.done ? 'Complete' : 'Tier ' + view.tier) + '</b><span> of ' + TIERS + '</span><span class="alm-xp">' + num(view.xp) + ' XP</span></div>' +
    '<span class="mh-meter big"><i style="width:' + pct + '%"></i></span>' +
    '<small>' + (view.next ? num(view.next.have) + ' of ' + num(view.next.need) + ' XP to tier ' + view.next.tier + '. Next reward: ' + esc(view.next.reward.label) + '.' : 'Every tier reached. The badge is on the wall.') + '</small></div>' +
    (view.ready.length ? '<button class="btn btn-primary alm-claim-all" type="button" data-alm="claim-all">Claim ' + plural(view.ready.length, 'reward') + '</button>' : '') +
    '<p class="alm-today">Today: ' + view.today.xp + ' of ' + DAILY_XP_CAP + ' XP. Care, emergencies, the omen, chores, Shelf Court, the arcade and expeditions all count, a little each, up to a limit every day. Nothing can be farmed.</p>' +
    (c.spotlight.length ? '<p class="alm-spotlight"><b>Court spotlight:</b> air ' + (c.spotlight.length > 1 ? 'either of two cases' : 'the case') + ' for a bonus, once.</p>' : '') + '</section>' +
    weeklyHTML(state, now) + cuiosHTML(view, state) + trackHTML(view, c) + freezeHTML(state) + titlesHTML(state) +
    '<section class="alm-section alm-links"><h3>More</h3><div class="alm-link-row"><button class="btn" type="button" data-alm="exchange" data-tab="back">Back Issues</button><button class="btn" type="button" data-alm="collections">Collections</button><button class="btn" type="button" data-alm="exchange" data-tab="legacy">Legacy' + (legacy.level ? ' ' + legacy.level : '') + '</button></div></section>';
}

export function openAlmanac(state = S, now = Date.now()) {
  if (!state) return;
  lastResults = [];
  syncAlmanac(state, now);
  renderSheet(state, now);
  openSheet('almanacVeil');
  // Reading the news marks it read: a freeze earned stops being a prompt.
  markNoticesSeen(state);
  save();
  byId('almanacSheet')?.scrollTo?.({ top: 0 });
}

function afterClaim(results, kind = 'tier') {
  lastResults = results;
  checkAchievements(S);
  save();
  renderSheet(S);
  chime(results.some(r => r.curio && !r.duplicate) ? 'curio' : kind);
  celebrate(kind, { results });
  refresh();
  byId('almanacSheet')?.scrollTo?.({ top: 0, behavior: 'smooth' });
}

export function initAlmanac(state, onRefresh) {
  S = state;
  refresh = onRefresh || refresh;
  document.addEventListener('click', event => {
    const control = event.target.closest?.('[data-alm]');
    if (!control || !S) return;
    const action = control.dataset.alm;
    if (action === 'open') { openAlmanac(S); return; }
    if (control.closest('#almanacVeil') === null) return;
    if (action === 'close') { closeSheet('almanacVeil'); lastResults = []; refresh(); return; }
    const now = Date.now(), chapter = chapterAt(now);
    if (action === 'claim') { const r = claimTier(S, chapter, Number(control.dataset.tier), now); if (r) afterClaim([r]); return; }
    if (action === 'claim-all') { const rs = claimReady(S, now); if (rs.length) afterClaim(rs); return; }
    if (action === 'weekly') { const r = claimWeekly(S, control.dataset.id, now); if (r) afterClaim([{ souls: r.souls, xp: r.xp, tier: 0 }], 'souls'); return; }
    if (action === 'chest') {
      const r = claimChest(S, now);
      if (r) afterClaim([{ souls: r.souls, xp: r.xp, curio: r.curio.curio, duplicate: r.curio.duplicate }], 'chest');
      return;
    }
    if (action === 'title') { equipTitle(S, control.dataset.id); save(); renderSheet(S); refresh(); return; }
    if (action === 'settled') { dismissSettled(S); save(); renderSheet(S); return; }
    if (action === 'exchange') window.dispatchEvent(new CustomEvent('shelflife:almanac', { detail: { view: 'exchange', tab: control.dataset.tab } }));
    if (action === 'collections') window.dispatchEvent(new CustomEvent('shelflife:almanac', { detail: { view: 'collections' } }));
  });
  // Anything that wants the Almanac, the Collections or the Exchange asks by event.
  window.addEventListener('shelflife:almanac', event => { if ((event.detail?.view || 'almanac') === 'almanac') openAlmanac(S); });
  byId('almanacBtn')?.addEventListener('click', () => openAlmanac(S));
  byId('almanacVeil')?.addEventListener('click', event => { if (event.target === byId('almanacVeil')) { closeSheet('almanacVeil'); refresh(); } });
  const veil = byId('almanacVeil');
  if (veil) { veil.setAttribute('aria-label', 'The Almanac'); }
  return { open: () => openAlmanac(S), render: () => renderSheet(S) };
}

export { nextChapter, daysLeft };
