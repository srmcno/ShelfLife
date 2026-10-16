import { registerFriendAction, registerPostboxSource, registerFriendsSection, registerSocialView } from './social-registry.js';
import { state, save, onBeforeSave, Store } from '../state.js';
import { sync, cloud } from '../cloud/index.js';
import { saveHash } from '../cloud/sync.js';
import { coop, flushOutbox } from './coop-hire.js';
import { coopText } from '../cloud/coop.js';
import { coopState } from '../coop-state.js';
import {
  collectReport, fieldReport, setListed, stakeHeld, attemptFor, markAttempt, markSeen, duelSummary, duelLapsesAt, rememberRecords,
  STAKES, STAT_KEYS, SKILLED, applyCoopReceipts, receiptMark
} from '../engine/coop.js';
import { bindCoopMoney, captureCoopMoney, assertCoopOpening } from '../engine/coop-money.js';
import { sealLog } from '../engine/duel.js';
import { ARCADE_GAMES, ARCADE_BY_ID } from '../content/arcade.js';
import { mayhemState } from '../mayhem-state.js';
import { DUEL_CHALLENGES, DUEL_REMATCHES, DUEL_ROUND_WON, DUEL_ROUND_LOST, DUEL_ROUND_TIED, DUEL_SERIES, DUEL_STAKES, fill, pickBy } from '../content/coop.js';
import { paintDuelPanel } from './duel-run.js';
import { arcadeGlyph } from '../art/arcade-art.js';
import { renderAll } from './render.js';
import { toast } from './toast.js';

/* Co-op in the Friends sheet, through ui/social-registry.js only:
     friend action  coop-duel     "Challenge to a duel"
     friend section coop-records  duels won and lost, best rematch streak, trips together, open duels
     home section   coop-hire     who this shelf has put up for hire, and who is out on a job
     postbox        coop-duels    challenges to answer, rounds to reveal, stakes to collect
     postbox        coop-reports  field reports from friends' expeditions, with wages
   and the duel flow around the arcade (ui/duel-run.js). Everything a friend
   sent arrives through src/cloud/coop.js and is printed through esc(). */

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const gameTitle = id => ARCADE_BY_ID[id]?.title || 'the arcade';
const plural = (n, one, many = one + 's') => n + ' ' + (n === 1 ? one : many);
const hoursLeft = at => Math.max(1, Math.ceil((at - Date.now()) / 3600000));
const REPORT_REASONS = ['A rude name', 'A rude resident', 'Bothering me', 'Something else'];

/* ---------------- what the server last said ---------------- */

const cache = { user: null, duels: null, reports: null, records: null, at: 0, tried: 0, loading: null, error: '', errorCode: '' };
let confirming = null, busy = false;
const sameShelf = (owner, origin) => owner === coop.userId() && coopState(state) === origin;
onBeforeSave(s => captureCoopMoney(s, coop.userId()));
const persisted = () => { if (!save() || !Store.persistent) throw Object.assign(new Error('Your device could not save the wager. Free some storage and try again.'), { code: 'save_unavailable' }); };
function scope() {
  const user = coop.userId();
  if (user !== cache.user) Object.assign(cache, { user, duels: null, reports: null, records: null, at: 0, tried: 0, loading: null, error: '', errorCode: '' });
}
// A section asks once in a while, never in a loop when the network is down.
function refreshSoon(ctx) {
  scope();
  if (cache.loading || (cache.at && Date.now() - cache.at < 60000) || Date.now() - cache.tried < 20000) return;
  refreshCoop().then(() => ctx.refresh());
}
export function refreshCoop({ force = false } = {}) {
  scope();
  if (!coop.active()) return Promise.resolve(cache);
  if (cache.loading) return cache.loading;
  if (!force && cache.at && Date.now() - cache.at < 20000) return Promise.resolve(cache);
  const user = cache.user, origin = coopState(state);
  let request;
  cache.tried = Date.now();
  cache.loading = request = (async () => {
    await reconcileCoopWallet(user);
    await flushOutbox(state).catch(() => 0);
    if (!sameShelf(user, origin)) return cache;
    await fileWaitingRuns().catch(() => 0);
    const [duels, reports, records] = await Promise.all([coop.duels(), coop.reports(), coop.records()]);
    if (coop.userId() !== user || coopState(state) !== origin) return cache;
    Object.assign(cache, { duels, reports, records, at: Date.now(), error: '', errorCode: '' });
    rememberRecords(state, records, Date.now(), user);
    // Another device may have changed who is for hire.
    const listed = reports.listed.map(l => l.petId).filter(id => state.pets.some(p => p.id === id));
    if (coopState(state).listedOwner !== user || listed.join() !== coopState(state).listed.join()) setListed(state, listed, user);
    save();
    return cache;
  })().catch(error => { if (coop.userId() === user && coopState(state) === origin) { cache.error = coopText(error); cache.errorCode = error.code || ''; } return cache; }).finally(() => { if (cache.loading === request) cache.loading = null; });
  return cache.loading;
}
// A single reconciliation owns each cursor until its page is persisted.
// Account changes cancel it; the next owner starts a separate reconciliation.
let reconciling = null;
// The wallet transaction can be verified independently of a rendered shelf.
export const coopWalletView = { refresh: renderAll };
export const coopWalletCloud = { push: options => sync.push(options), info: () => sync.info(), meta: () => cloud.meta(), markDirty: () => sync.markDirty() };
export async function reconcileCoopWallet(owner = coop.userId()) {
  if (!owner || owner !== coop.userId()) return 0;
  const origin = coopState(state), current = () => owner === coop.userId() && coopState(state) === origin;
  const assertCurrent = () => {
    if (!current()) throw Object.assign(new Error('Your shelf or account changed. Open it again to continue.'), { code: 'state_changed' });
  };
  while (reconciling) {
    try { await reconciling; } catch (error) { if (error?.code !== 'state_changed') throw error; }
    assertCurrent();
  }
  const checkpointHousehold = async () => {
    let previousHash = '';
    for (;;) {
      coopWalletCloud.markDirty();
      persisted();
      const text = JSON.stringify(state), body = JSON.parse(text), hash = saveHash(text);
      const acknowledged = () => {
        const info = coopWalletCloud.info(), meta = coopWalletCloud.meta();
        return info.status === 'idle' && !info.conflict && meta.syncUser === owner && meta.baseRev > 0 && meta.lastPushHash === hash;
      };
      // A cloud adoption can mark a normalized/rendered shelf as clean without
      // uploading that exact body. Request a real forced checkpoint here.
      const info = await coopWalletCloud.push({ force: true });
      assertCurrent();
      if (info.conflict || info.status === 'conflict') throw Object.assign(new Error('Choose the matching household in Cloud save before continuing Co-op.'), { code: 'cloud_copy_required' });
      if (info.status !== 'idle') throw Object.assign(new Error('Co-op needs the complete shelf saved to the cloud. Finish syncing in Cloud save, then try again.'), { code: 'household_sync_required' });
      if (acknowledged()) return body;
      if (previousHash === hash) throw Object.assign(new Error('The complete household was not acknowledged by cloud save. Try syncing again.'), { code: 'household_sync_required' });
      previousHash = hash;
      // If gameplay saved while the sync queue was waiting, its newer body may
      // have been uploaded instead. Capture and acknowledge that exact body;
      // no operation is transmitted merely because a timestamp moved forward.
    }
  };
  const work = (async () => {
    const wallet = await coop.wallet();
    assertCurrent();
    assertCoopOpening(state, owner, wallet, { conflict: !!sync.info().conflict });
    const opening = bindCoopMoney(state, owner);
    persisted();
    if (wallet.opening === null) {
      await checkpointHousehold();
      assertCurrent();
      const opened = await coop.openWallet(opening.souls, opening.after);
      assertCurrent();
      assertCoopOpening(state, owner, opened);
    }
    let paid = 0;
    const download = async () => {
      let more = true;
      while (more) {
        const after = origin.ledger[owner]?.seq || 0;
        const page = await coop.receipts(after);
        assertCurrent();
        const applied = applyCoopReceipts(state, owner, page.receipts);
        if (page.more && applied.seq <= after) throw new Error('Co-op receipt page did not advance');
        if (!page.more && applied.seq !== page.lastSeq) throw new Error('Co-op receipt page was incomplete');
        paid += applied.paid;
        persisted(); more = page.more;
      }
    };
    // Another device may already have settled a semantic proposal. Its first
    // receipt determines both money and cosmetics before any local mutation.
    await download();
    do {
      persisted();
      let pending = origin.money.pending.filter(p => p.owner === owner);
      if (!pending.length) break;
      if (pending.some(p => !p.detail)) {
        const body = await checkpointHousehold();
        assertCurrent();
        pending = body.coop.money.pending.filter(p => p.owner === owner);
      }
      let retry = false;
      for (let i = 0; i < pending.length; i += 100) {
        const batch = pending.slice(i, i + 100);
        try { await coop.adjustMoney(batch); }
        catch (error) {
          if (error.code !== 'bad_op' || !batch.some(p => p.preApplied === false)) throw error;
          // The first device may have won after our preflight read. Only a
          // typed, un-applied semantic proposal can take its canonical award.
          await download();
          if (!batch.some(p => p.preApplied === false && !origin.money.pending.some(q => q.owner === owner && q.id === p.id))) throw error;
          retry = true; break;
        }
        assertCurrent();
      }
      if (retry) continue;
      await download();
      if (pending.some(p => origin.money.pending.some(q => q.owner === owner && q.id === p.id))) throw new Error('Currency receipt was missing');
    } while (origin.money.pending.some(p => p.owner === owner));
    if (current()) coopWalletView.refresh(state);
    return paid;
  })();
  reconciling = work;
  try { return await work; } finally { if (reconciling === work) reconciling = null; }
}
const summaries = () => { scope(); return (cache.duels || []).map(d => ({ d, s: duelSummary(d, cache.user) })); };
const unseenRound = ({ d, s }) => s.rounds.find(r => r.status === 'done' && !coopState(state).seen.includes(coop.userId() + ':' + d.id + ':' + r.n));
// A round already played here, waiting for a connection, does not ask again.
function duelNeedsMe(entry) {
  const t = entry.s.turn, a = attemptFor(state, entry.d.id, entry.s.last.n, coop.userId());
  if (t === 'answer' || t === 'play') return !a || a.state === 'started';
  return t === 'claim' || !!unseenRound(entry);
}

/* ---------------- lines ---------------- */

function stakeLine(d) { return d.stake ? fill(DUEL_STAKES.some, { stake: d.stake }) : DUEL_STAKES.none; }
function roundLine(d, s, r) {
  const vars = { friend: s.otherName || 'Your friend', n: r.n, mine: r.mine, theirs: r.theirs };
  const pool = r.result === 'won' ? DUEL_ROUND_WON : r.result === 'lost' ? DUEL_ROUND_LOST : DUEL_ROUND_TIED;
  return fill(pickBy(pool, d.id + ':' + r.n), vars);
}
function seriesLine(d, s) {
  const lapsed = s.outcome === 'void' && s.rounds.length === 1 && s.rounds[0].first && s.rounds[0].mine !== null;
  const kind = lapsed ? 'lapsed' : s.outcome || 'void';
  return fill(pickBy(DUEL_SERIES[kind], d.id + ':series'), { friend: s.otherName || 'Your friend', a: s.myWins, b: s.theirWins });
}
function challengeLine(d, s) {
  const n = s.last.n, pool = n > 1 ? DUEL_REMATCHES : DUEL_CHALLENGES;
  return fill(pickBy(pool, d.id + ':' + n), { friend: s.otherName || 'Your friend', game: gameTitle(d.game), n });
}
function roundRow(d, s, r) {
  if (r.status === 'done') return '<li data-result="' + r.result + '"><b>Round ' + r.n + '</b> You ' + r.mine + ' · ' + esc(s.otherName || 'Them') + ' ' + r.theirs + '<small>' + esc(roundLine(d, s, r)) + '</small></li>';
  if (r.status === 'void') return '<li data-result="void"><b>Round ' + r.n + '</b> Never played.</li>';
  const text = r.status === 'first' ? (r.first ? 'Your move: you play first.' : esc(s.otherName || 'They') + ' plays first. Waiting.')
    : r.first ? 'Your score is sealed. Waiting for ' + esc(s.otherName || 'them') + '.' : esc(s.otherName || 'They') + ' has played. Their score is sealed. Your move.';
  return '<li data-result="open"><b>Round ' + r.n + '</b> ' + text + '</li>';
}

/* ---------------- moderation, wherever a friend's mail appears ---------------- */

function moreBox(userId, name, key) {
  if (!userId || !name) return '';
  const open = confirming?.key === key;
  const box = !open ? '' : confirming.kind === 'block'
    ? '<div class="fr-confirm" role="group"><p><b>Block ' + esc(name) + '?</b> They are removed, open duels are called off and stakes come back. They are not told.</p><div class="fr-actions"><button class="btn fr-warn" type="button" data-sx="block-yes" data-sx-id="' + esc(key) + '">Block</button><button class="btn btn-ghost" type="button" data-sx="cancel" data-sx-id="' + esc(key) + '">Cancel</button></div></div>'
    : '<div class="fr-confirm" role="group"><p><b>Report ' + esc(name) + '?</b> A person reads every report. They are not told who sent it.</p><div class="fr-actions">' +
      REPORT_REASONS.map((r, i) => '<button class="btn btn-sm fr-warn" type="button" data-sx="report-yes" data-sx-id="' + esc(key + '|' + i) + '">' + esc(r) + '</button>').join('') +
      '<button class="btn btn-ghost btn-sm" type="button" data-sx="cancel" data-sx-id="' + esc(key) + '">Cancel</button></div></div>';
  return '<div class="co-more"><button class="btn btn-ghost btn-sm fr-warn" type="button" data-sx="block" data-sx-id="' + esc(key) + '">Block</button><button class="btn btn-ghost btn-sm fr-warn" type="button" data-sx="report" data-sx-id="' + esc(key) + '">Report</button></div>' + box;
}
function whoFor(key) {
  const [kind, id] = String(key).split(':');
  if (kind === 'duel') { const e = summaries().find(x => x.d.id === id); return e ? { userId: e.s.other, name: e.s.otherName } : null; }
  const r = (cache.reports?.reports || []).find(x => x.id === id);
  return r ? { userId: r.hirer, name: r.hirerName } : null;
}
async function moderate(action, key, ctx) {
  if (action === 'block' || action === 'report') { confirming = { key, kind: action }; ctx?.refresh(); return true; }
  if (action === 'cancel') { confirming = null; ctx?.refresh(); return true; }
  if (action !== 'block-yes' && action !== 'report-yes') return false;
  const [target, reason] = String(key).split('|'), who = whoFor(target);
  confirming = null;
  if (!who?.userId) { ctx?.refresh(); return true; }
  try {
    if (action === 'block-yes') { await coop.block(who.userId); ctx?.say(who.name + ' is blocked. Open duels are called off and stakes come back.'); }
    else { await coop.report(who.userId, 'Co-op: ' + (REPORT_REASONS[Number(reason)] || 'Something else')); ctx?.say('Reported. A person reads every report.'); }
  } catch (error) { ctx?.say(coopText(error)); }
  await refreshCoop({ force: true });
  ctx?.refresh();
  return true;
}

/* ---------------- playing a round ---------------- */

function closeSocialSheet() {
  const veil = document.getElementById('friendsVeil');
  if (veil?.classList.contains('open')) (document.querySelector('#friendsSheet [data-fr="close"]') || { click: () => veil.classList.remove('open') }).click();
  window.dispatchEvent(new CustomEvent('shelflife:social-close'));
}
function launch(duel, turn, name, petId) {
  const owner = coop.userId();
  markAttempt(state, duel.id, turn.round, 'started', 0, { game: duel.game, seed: turn.seed }, Date.now(), owner);
  save();
  closeSocialSheet();
  window.dispatchEvent(new CustomEvent('shelflife:duel', { detail: { owner, id: duel.id, round: turn.round, seed: turn.seed, role: turn.role, game: duel.game,
    against: name || 'your friend', ghost: turn.ghost || null, petId: petId || state.pets[0]?.id || '' } }));
}
// Answering a round (or playing first in one already created): put up the
// stake if this is the opponent's first round, then play.
async function play(duelId, ctx, petId = '') {
  const entry = summaries().find(x => x.d.id === duelId);
  if (!entry || busy) return;
  const { d, s } = entry, n = s.last.n;
  const done = attemptFor(state, d.id, n, coop.userId());
  if (done && done.state !== 'started') { ctx?.say('That round is already played. Its score goes in as soon as there is a connection.'); return; }
  const staking = !s.iChallenge && n === 1 && s.turn === 'answer' && d.stake > 0 && !d.opponentStaked && !stakeHeld(state, d.id, coop.userId());
  if (staking && mayhemState(state).souls < d.stake) { ctx?.say('You need ' + d.stake + ' souls to match the stake. Come back richer, or decline.'); return; }
  busy = true;
  try {
    const owner = coop.userId(), origin = coopState(state);
    await reconcileCoopWallet(owner);
    if (!sameShelf(owner, origin)) return;
    const turn = await coop.duelPlay(d.id, d.game);
    if (!sameShelf(owner, origin)) return;
    await reconcileCoopWallet(owner);
    if (!sameShelf(owner, origin)) return;
    save();
    launch(d, turn, s.otherName, petId);
  } catch (error) { ctx?.say(error?.code ? coopText(error) : error.message); }
  finally { busy = false; }
}
async function rematch(duelId, ctx) {
  const entry = summaries().find(x => x.d.id === duelId);
  if (!entry || busy) return;
  busy = true;
  try {
    const owner = coop.userId(), origin = coopState(state);
    await reconcileCoopWallet(owner);
    if (!sameShelf(owner, origin)) return;
    const turn = await coop.duelRematch(duelId);
    if (!sameShelf(owner, origin)) return;
    launch(entry.d, { ...turn, role: 'first', ghost: null }, entry.s.otherName);
  } catch (error) { ctx?.say(coopText(error)); paintStatus(duelId, coopText(error)); }
  finally { busy = false; }
}
async function claim(duelId, ctx) {
  if (busy) return;
  busy = true;
  try {
    const owner = coop.userId(), origin = coopState(state);
    await reconcileCoopWallet(owner);
    if (!sameShelf(owner, origin)) return;
    await coop.duelClaim(duelId);
    if (!sameShelf(owner, origin)) return;
    const paid = await reconcileCoopWallet(owner);
    if (!sameShelf(owner, origin)) return;
    save(); renderAll(state);
    const line = paid ? '+' + paid + ' souls from the duel.' : 'Settled. Nothing owed, nothing taken.';
    ctx?.say(line); toast(line); paintStatus(duelId, line);
    await refreshCoop({ force: true });
  } catch (error) { ctx?.say(coopText(error)); }
  finally { busy = false; ctx?.refresh(); }
}
function paintStatus(duelId, text) {
  document.querySelectorAll('[data-duel-panel^="' + duelId + ':"] [data-duel-status]').forEach(el => { el.textContent = text; });
}

// The arcade says a duel run is over (or was left): keep the score, then file it.
async function fileRun(detail) {
  const owner = detail.owner;
  if (!owner || !attemptFor(state, detail.id, detail.round, owner)) return;
  const log = detail.role === 'first' && detail.log ? sealLog(detail.log, detail.seed) : null;
  markAttempt(state, detail.id, detail.round, 'played', detail.score, { game: detail.game, seed: detail.seed, log }, Date.now(), owner);
  save();
  await submitAttempt(attemptFor(state, detail.id, detail.round, owner), { name: detail.against, early: detail.abandoned });
}
async function submitAttempt(a, { name = '', early = false } = {}) {
  if (!a || a.owner !== coop.userId() || a.state !== 'played' || !a.game) return null;
  const owner = a.owner, origin = coopState(state);
  const who = name || 'your friend';
  try {
    const r = await coop.duelSubmit(a.duelId, a.round, a.score, a.game, a.log || null);
    if (!sameShelf(owner, origin)) return null;
    markAttempt(state, a.duelId, a.round, 'sent', a.score, {}, Date.now(), owner);
    save();
    cache.at = 0;
    if (r.status === 'done') {
      markSeen(state, a.duelId, a.round, owner); save();
      const result = a.score > r.firstScore ? 'won' : a.score < r.firstScore ? 'lost' : 'tied';
      const pool = result === 'won' ? DUEL_ROUND_WON : result === 'lost' ? DUEL_ROUND_LOST : DUEL_ROUND_TIED;
      const line = fill(pickBy(pool, a.duelId + ':' + a.round), { friend: who, n: a.round, mine: a.score, theirs: r.firstScore });
      const settled = r.settled ? ' ' + (r.outcome === 'tie' ? 'The duel is a draw.' : r.outcome === 'void' ? 'The duel is off.' : 'The duel is decided.') : '';
      const canRematch = !r.settled && a.round < 3;
      paintDuelPanel(a.duelId, a.round, { html: '<b class="ar-duel-reveal" data-result="' + result + '">' + esc(line) + '</b>' + esc(settled),
        actions: (canRematch ? '<button class="btn btn-primary" type="button" data-duel-act="rematch" data-duel-id="' + esc(a.duelId) + '">Rematch: round ' + (a.round + 1) + ', you go first</button>' : '') +
          (r.settled ? '<button class="btn btn-primary" type="button" data-duel-act="claim" data-duel-id="' + esc(a.duelId) + '">Settle the duel</button>' : '') });
    } else {
      paintDuelPanel(a.duelId, a.round, { status: (early ? 'You left early; the score at the door has been filed. ' : '') + 'Sealed and sent. ' + who + ' has 48 hours to answer.' });
    }
    return r;
  } catch (error) {
    if (['not_your_turn', 'not_open', 'not_found', 'bad_score'].includes(error?.code)) {
      if (!sameShelf(owner, origin)) return null;
    markAttempt(state, a.duelId, a.round, 'sent', a.score, {}, Date.now(), owner); save();
      paintDuelPanel(a.duelId, a.round, { status: coopText(error) });
    } else {
      paintDuelPanel(a.duelId, a.round, { status: error?.offline ? 'Kept on this phone. Your score goes in as soon as there is a connection.' : coopText(error) });
    }
    return null;
  }
}
function fileWaitingRuns() {
  const owner = coop.userId();
  const waiting = coopState(state).attempts.filter(a => a.owner === owner && a.state === 'played');
  return waiting.reduce((p, a) => p.then(() => submitAttempt(a)), Promise.resolve());
}

/* ---------------- views ---------------- */

function newDuelView(friend) {
  const souls = mayhemState(state).souls, name = friend.name || 'your friend';
  const games = ARCADE_GAMES.map((g, i) => '<label class="co-game" style="--ar-accent:' + esc(g.accent) + '"><input type="radio" name="coGame" value="' + g.id + '"' + (i ? '' : ' checked') + '>' +
    '<span class="co-game-art" aria-hidden="true">' + arcadeGlyph(g.glyph) + '</span><span><b>' + esc(g.title) + '</b><small>' + esc(g.hook) + '</small></span></label>').join('');
  const stakes = STAKES.map((n, i) => '<label class="co-stake"><input type="radio" name="coStake" value="' + n + '"' + (i ? '' : ' checked') + (n > souls ? ' disabled' : '') + '><span>' + (n ? n + ' souls' : 'No stake') + '</span></label>').join('');
  return { id: 'coop-duel-new', kicker: 'Against ' + name, title: 'A duel at the arcade', back: 'friend:' + friend.userId,
    html: '<form class="co-form" data-co-form="duel" data-friend="' + esc(friend.userId) + '">' +
      '<p>You play first, on a seed the server picks. ' + esc(name) + ' plays the same seed against your ghost, and both scores reveal together. Best of three, if you both want more.</p>' +
      '<fieldset class="co-games"><legend class="fr-label">The game</legend>' + games + '</fieldset>' +
      '<fieldset class="co-stakes"><legend class="fr-label">A small wager</legend>' + stakes + '<p class="hint">You have ' + plural(souls, 'soul') + '. Both stake the same; the winner takes both, and a draw or a lapse returns them.</p></fieldset>' +
      '<label class="fr-label" for="coDuelPet">Who plays</label><select class="fr-input" id="coDuelPet">' + state.pets.map(p => '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>').join('') + '</select>' +
      '<div class="fr-actions"><button class="btn btn-primary" type="button" data-sx="duel-go" data-sx-id="' + esc(friend.userId) + '"' + (state.pets.length ? '' : ' disabled') + '>Issue the challenge and play</button></div>' +
      '<p class="co-status" role="status" data-co-status></p></form>' };
}
async function issueChallenge(form, ctx) {
  if (busy || !form) return;
  const to = form.dataset.friend, game = form.querySelector('[name="coGame"]:checked')?.value || 'stack';
  const stake = Number(form.querySelector('[name="coStake"]:checked')?.value || 0), petId = form.querySelector('#coDuelPet')?.value || '';
  const status = form.querySelector('[data-co-status]');
  if (stake > mayhemState(state).souls) { status.textContent = 'You need ' + stake + ' souls for that stake.'; return; }
  busy = true; status.textContent = 'Asking the server for a seed.';
  try {
    const owner = coop.userId(), origin = coopState(state);
    await reconcileCoopWallet(owner);
    if (!sameShelf(owner, origin)) return;
    const made = await coop.duelCreate(to, game, stake);
    if (!sameShelf(owner, origin)) return;
    await reconcileCoopWallet(owner);
    if (!sameShelf(owner, origin)) return;
    save(); renderAll(state);
    const name = ctx?.friend?.(to)?.name || '';
    cache.at = 0;
    launch({ id: made.id, game }, { round: 1, seed: made.seed, role: 'first', ghost: null }, name, petId);
  } catch (error) { status.textContent = coopText(error); }
  finally { busy = false; }
}

function duelView(duelId) {
  const entry = summaries().find(x => x.d.id === duelId);
  if (!entry) return { id: 'coop-duel', kicker: 'Duel', title: 'That duel has gone', back: 'postbox', html: '<p>It lapsed, or was settled and collected. The arcade has moved on, and so should we.</p>' };
  const { d, s } = entry, name = s.otherName || 'A friend';
  for (const r of s.rounds) if (r.status === 'done') markSeen(state, d.id, r.n, coop.userId());
  save();
  const lapses = duelLapsesAt(d);
  const buttons = s.turn === 'answer' || (s.turn === 'play' && !attemptFor(state, d.id, s.last.n, coop.userId()))
    ? '<button class="btn btn-primary" type="button" data-sx="play" data-sx-id="' + esc(d.id) + '">' + (s.turn === 'answer' && !s.iChallenge && s.last.n === 1 && d.stake && !d.opponentStaked && !stakeHeld(state, d.id, coop.userId()) ? 'Match the ' + d.stake + ' souls and play' : 'Play round ' + s.last.n) + '</button>' +
      (s.turn === 'answer' && !s.last.started ? '<button class="btn" type="button" data-sx="decline" data-sx-id="' + esc(d.id) + '">Decline</button>' : s.turn === 'play' ? '<button class="btn" type="button" data-sx="decline" data-sx-id="' + esc(d.id) + '">Withdraw</button>' : '')
    : s.turn === 'rematch' ? '<button class="btn btn-primary" type="button" data-sx="rematch" data-sx-id="' + esc(d.id) + '">Rematch: round ' + (s.last.n + 1) + ', you go first</button>'
    : s.turn === 'claim' ? '<button class="btn btn-primary" type="button" data-sx="claim" data-sx-id="' + esc(d.id) + '">' + (d.payout ? 'Collect ' + d.payout + ' souls' : 'Close the duel') + '</button>' : '';
  return { id: 'coop-duel', kicker: 'Duel · ' + gameTitle(d.game), title: 'You v ' + name, back: 'postbox',
    html: '<section class="co-duel" data-co-duel="' + esc(d.id) + '"><p class="co-series"><span>You <b>' + s.myWins + '</b></span><span>' + esc(name) + ' <b>' + s.theirWins + '</b></span><small>first to two rounds</small></p>' +
      '<p>' + esc(stakeLine(d)) + '</p><ol class="co-rounds">' + s.rounds.map(r => roundRow(d, s, r)).join('') + '</ol>' +
      (d.status === 'settled' ? '<p class="co-verdict">' + esc(seriesLine(d, s)) + '</p>' : lapses ? '<p class="hint">The waiting round lapses in about ' + plural(hoursLeft(lapses), 'hour') + '.</p>' : '') +
      (buttons ? '<div class="fr-actions">' + buttons + '</div>' : '') + moreBox(s.other, name, 'duel:' + d.id) + '</section>' };
}
function reportView(item, souls) {
  return { id: 'coop-report', kicker: 'A field report', title: item.name + ' is home', back: 'postbox',
    html: '<article class="co-report"><p>' + esc(fieldReport(item)) + '</p>' + (souls ? '<p class="co-wages">+' + souls + ' souls in wages.</p>' : '') +
      (state.pets.some(p => p.id === item.petId) ? '<p class="hint">' + esc(item.name) + ' will remember this. Look in its card, under what it remembers.</p>' : '') + '</article>' +
      moreBox(item.hirer, item.hirerName, 'hire:' + item.id) };
}

/* ---------------- registrations ---------------- */

registerFriendAction({
  id: 'coop-duel', label: 'Challenge to a duel', order: 30,
  available: () => !coop.active() ? false : !state.pets.length ? 'You need a resident to play' : true,
  run: (friend, ctx) => ctx.show(newDuelView(friend))
});
registerSocialView('coop-duel-new', {
  onClick(action, el, ctx) { if (action === 'duel-go') issueChallenge(el.closest('form'), ctx); },
  onSubmit(form, ctx) { issueChallenge(form, ctx); }
});
async function duelAction(action, id, ctx) {
  if (await moderate(action, id, ctx)) return;
  if (action === 'play') return play(id, ctx);
  if (action === 'rematch') return rematch(id, ctx);
  if (action === 'claim') return claim(id, ctx);
  if (action === 'decline') {
    try { await coop.duelDecline(id); ctx?.say('Declined. Any stake goes back to its owner.'); } catch (error) { ctx?.say(coopText(error)); }
    await refreshCoop({ force: true }); ctx?.refresh();
    return;
  }
  if (action === 'open') { ctx.show(duelView(id)); ctx.refresh?.(); }
}
registerSocialView('coop-duel', { onClick: (action, el, ctx) => duelAction(action, el.dataset.sxId, ctx).then(() => { if (['decline', 'claim'].includes(action)) ctx.show(duelView(el.dataset.sxId)); }) });
registerSocialView('coop-report', { onClick: (action, el, ctx) => moderate(action, el.dataset.sxId, ctx) });

registerPostboxSource({
  id: 'coop-duels', order: 30, label: 'Duels', poll: true,
  count: () => summaries().filter(duelNeedsMe).length,
  async load() {
    await refreshCoop({ force: true });
    return summaries().filter(duelNeedsMe).map(({ d, s }) => {
      const unseen = unseenRound({ d, s });
      const title = s.turn === 'claim' ? 'Duel over: ' + gameTitle(d.game) : unseen ? 'Round ' + unseen.n + ' is in' : s.turn === 'play' ? 'Your move: ' + gameTitle(d.game) : 'A duel: ' + gameTitle(d.game);
      const line = s.turn === 'claim' ? seriesLine(d, s) : unseen ? 'Both scores are in. You and ' + (s.otherName || 'your friend') + ' can look together.'
        : s.turn === 'play' ? 'Round ' + s.last.n + ' waits for you to play first.' : challengeLine(d, s) + ' ' + stakeLine(d);
      return { id: 'duel:' + d.id, at: d.updatedAt, title, line, turn: unseen && s.turn !== 'claim' ? 'reveal' : s.turn, duelId: d.id, payout: d.payout, stake: d.stake,
        started: s.last.started, opponentStaked: d.opponentStaked, other: s.otherName };
    });
  },
  render(item) {
    const id = esc(item.duelId);
    const buttons = item.turn === 'answer' || item.turn === 'play'
      ? '<button class="btn btn-sm btn-primary" type="button" data-sx="play" data-sx-id="' + id + '">' + (item.turn === 'answer' && item.stake && !item.opponentStaked && !stakeHeld(state, item.duelId, coop.userId()) && !item.started ? 'Match ' + item.stake + ' and play' : 'Play') + '</button>' +
        (item.turn === 'answer' && !item.started ? '<button class="btn btn-sm" type="button" data-sx="decline" data-sx-id="' + id + '">Decline</button>' : '') +
        '<button class="btn btn-sm btn-ghost" type="button" data-sx="open" data-sx-id="' + id + '">Details</button>'
      : item.turn === 'claim' ? '<button class="btn btn-sm btn-primary" type="button" data-sx="claim" data-sx-id="' + id + '">' + (item.payout ? 'Collect ' + item.payout + ' souls' : 'Dismiss') + '</button>'
      : '<button class="btn btn-sm btn-primary" type="button" data-sx="open" data-sx-id="' + id + '">See the result</button>';
    return '<div class="co-mail" data-co-mail="' + esc(item.id) + '"><b>' + esc(item.title) + '</b><p>' + esc(item.line) + '</p><div class="fr-actions">' + buttons + '</div>' +
      moreBox(whoFor('duel:' + item.duelId)?.userId, item.other, 'duel:' + item.duelId) + '</div>';
  },
  onClick: (action, itemId, ctx) => duelAction(action, String(itemId), ctx)
});

registerPostboxSource({
  id: 'coop-reports', order: 40, label: 'Field reports', poll: true,
  count: () => { scope(); return (cache.reports?.reports || []).filter(r => !coopState(state).done.includes(receiptMark('h', r.id, coop.userId()))).length; },
  async load() {
    await refreshCoop({ force: true });
    return (cache.reports?.reports || []).map(r => ({ id: 'hire:' + r.id, at: r.finishedAt, title: r.name + ' is back from ' + (r.hirerName || 'a friend') + '’s shelf',
      line: fieldReport(r).split('. ')[0] + '.', hireId: r.id, wages: r.wages }));
  },
  render(item) {
    return '<div class="co-mail" data-co-mail="' + esc(item.id) + '"><b>' + esc(item.title) + '</b><p>' + esc(item.line) + '</p><div class="fr-actions">' +
      '<button class="btn btn-sm btn-primary" type="button" data-sx="read" data-sx-id="' + esc(item.hireId) + '">' + (item.wages ? 'Read it · collect ' + item.wages + ' souls' : 'Read the report') + '</button></div>' +
      moreBox(whoFor('hire:' + item.hireId)?.userId, whoFor('hire:' + item.hireId)?.name, 'hire:' + item.hireId) + '</div>';
  },
  async onClick(action, itemId, ctx) {
    if (await moderate(action, String(itemId), ctx)) return;
    const id = String(itemId);
    if (action !== 'read' || busy) return;
    const item = (cache.reports?.reports || []).find(r => r.id === id);
    if (!item) return;
    busy = true;
    try {
      const owner = coop.userId(), origin = coopState(state);
      await reconcileCoopWallet(owner);
      if (!sameShelf(owner, origin)) return;
      await coop.collect(id);
      if (!sameShelf(owner, origin)) return;
      const wages = await reconcileCoopWallet(owner);
      if (!sameShelf(owner, origin)) return;
      const out = collectReport(state, item, 0, Date.now(), owner);
      out.souls = wages;
      save(); renderAll(state);
      cache.reports.reports = cache.reports.reports.filter(r => r.id !== id);
      ctx.show(reportView(item, out.souls));
      if (out.souls) ctx.toast?.('+' + out.souls + ' souls in wages');
    } catch (error) { ctx.say(coopText(error)); }
    finally { busy = false; ctx.refresh(); }
  }
});

registerFriendsSection({
  id: 'coop-records', where: 'friend', order: 40,
  render(ctx, friend) {
    if (!coop.active() || !friend) return '';
    refreshSoon(ctx);
    const c = coopState(state), r = c.recordsOwner === coop.userId() ? c.records[friend.userId] : null, name = friend.name || 'them';
    const open = summaries().filter(x => x.s.other === friend.userId && x.d.status === 'open');
    const stats = r ? '<dl class="co-records"><div><dt>Duels</dt><dd>' + r.won + ' won · ' + r.lost + ' lost' + (r.tied ? ' · ' + r.tied + ' drawn' : '') + '</dd></div>' +
      '<div><dt>Best rematch streak</dt><dd>' + (r.best ? plural(r.best, 'round') + ' in a row' : 'None yet') + '</dd></div>' +
      '<div><dt>Hired-help trips together</dt><dd>' + r.trips + '</dd></div></dl>'
      : '<p class="hint">No duels or trips with ' + esc(name) + ' yet. Challenge them, or hire one of their residents for an expedition.</p>';
    return '<section class="co-section" aria-labelledby="coRecordsTitle"><h3 id="coRecordsTitle">Co-op with ' + esc(name) + '</h3>' + stats +
      (open.length ? '<ul class="co-open">' + open.map(({ d, s }) => '<li><span>' + esc(gameTitle(d.game)) + ' · you ' + s.myWins + ', ' + esc(name) + ' ' + s.theirWins + '</span>' +
        '<button class="btn btn-sm" type="button" data-sx="open" data-sx-id="' + esc(d.id) + '">' + (s.turn === 'answer' || s.turn === 'play' ? 'Your move' : 'Details') + '</button></li>').join('') + '</ul>' : '') + '</section>';
  },
  onClick: (action, el, ctx) => duelAction(action, el.dataset.sxId, ctx)
});

registerFriendsSection({
  id: 'coop-hire', where: 'home', order: 60,
  render(ctx) {
    if (!coop.active()) return '';
    refreshSoon(ctx);
    const c = coopState(state), listed = c.listedOwner === coop.userId() ? c.listed : [], away = cache.reports?.away || [];
    const rows = state.pets.map(p => {
      const on = listed.includes(p.id), skilled = STAT_KEYS.filter(k => (p.stats?.[k] || 0) >= SKILLED);
      return '<li><button class="btn btn-sm co-toggle" type="button" data-sx="hire-toggle" data-sx-id="' + esc(p.id) + '" aria-pressed="' + on + '"' + (!on && listed.length >= 2 ? ' disabled' : '') + '>' +
        '<b>' + esc(p.name) + '</b><small>' + esc(skilled.length ? 'good for ' + skilled.join(' and ') : 'no specialities, plenty of opinions') + '</small><span>' + (on ? 'For hire' : 'At home') + '</span></button></li>';
    }).join('');
    return '<section class="co-section" aria-labelledby="coHireHomeTitle"><h3 id="coHireHomeTitle">Hired help</h3>' +
      (cache.error ? '<p role="status">' + esc(cache.error) + '</p>' + (['cloud_copy_required', 'household_sync_required'].includes(cache.errorCode) ? '<button class="btn btn-sm" type="button" data-sx="cloud-copy">Open cloud save</button>' : '') : '') +
      '<p>Put up to two residents up for hire. A friend can take one on an expedition: you get a field report and wages, your resident gets a story, and nothing else about it changes.</p>' +
      (away.length ? '<p class="co-away">' + away.map(a => esc(a.name) + ' is out on ' + esc(a.hirerName || 'a friend') + '’s expedition.').join(' ') + '</p>' : '') +
      '<details class="co-hire-list"' + (listed.length ? '' : ' open') + '><summary>' + (listed.length ? 'For hire: ' + esc(listed.map(id => state.pets.find(p => p.id === id)?.name).filter(Boolean).join(' and ')) : 'Nobody is for hire. They have been told this is a compliment.') + '</summary>' +
      '<ul class="co-listing">' + rows + '</ul></details></section>';
  },
  async onClick(action, el, ctx) {
    if (action === 'cloud-copy') { ctx.close(); document.getElementById('cloudBtn')?.click(); await sync.requestCopyChoice(); return; }
    if (action !== 'hire-toggle' || busy) return;
    const id = el.dataset.sxId, c = coopState(state), listed = c.listedOwner === coop.userId() ? c.listed : [];
    const next = listed.includes(id) ? listed.filter(x => x !== id) : [...listed, id].slice(0, 2);
    busy = true;
    try {
      const owner = coop.userId();
      const done = await coop.setHires(next.map(x => state.pets.find(p => p.id === x)).filter(Boolean));
      if (owner !== coop.userId()) return;
      setListed(state, done, owner); save();
      ctx.say(done.length ? 'For hire: ' + done.map(x => state.pets.find(p => p.id === x)?.name).join(' and ') + '.' : 'Nobody is for hire now.');
    } catch (error) { ctx.say(coopText(error)); }
    finally { busy = false; ctx.refresh(); }
  }
});

/* ---------------- outside the sheet ---------------- */

if (typeof window !== 'undefined') {
  window.addEventListener('shelflife:duel-done', e => { if (e.detail?.id) fileRun(e.detail); });
  // Buttons on the arcade's duel panel.
  document.addEventListener('click', e => {
    const b = e.target.closest?.('[data-duel-act]');
    if (!b || b.disabled) return;
    const id = b.dataset.duelId;
    b.disabled = true;
    refreshCoop({ force: true }).then(() => b.dataset.duelAct === 'rematch' ? rematch(id, null) : claim(id, null)).finally(() => { b.disabled = false; });
  });
  window.addEventListener('online', () => refreshCoop({ force: true }));
  window.addEventListener('shelflife:state-replaced', () => {
    Object.assign(cache, { duels: null, reports: null, records: null, at: 0, tried: 0, loading: null, error: '', errorCode: '' });
    if (coop.active()) refreshCoop({ force: true });
  });
  // Reports and scores left over from last time go in once the cloud is ready.
  setTimeout(() => { if (coop.active()) refreshCoop(); }, 4000);
}

export const coopCache = cache;
