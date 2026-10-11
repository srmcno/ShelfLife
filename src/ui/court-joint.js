// The Joint Bench in Shelf Court: friends hear the same case, rule in secret
// and compare. The studio, the lines and the episode belong to ui/court.js,
// which hands this module a `stage`; everything about hearings with a friend
// is here: the lobby section, the forms to invite or serve, reactions from the
// bench and the gallery, sealing a ruling, the reveal and replays.
//
// It plugs into the Friends sheet only through ui/social-registry.js: two
// friend actions (Serve papers, Hear a case together), a postbox source and a
// section on a friend's profile. Nothing a friend sent is markup: every name
// and title goes through esc().
import { registerFriendAction, registerPostboxSource, registerFriendsSection } from './social-registry.js';
import { createHearings, hearingText } from '../cloud/hearings.js';
import { socialText } from '../cloud/social.js';
import { COURT_CASES } from '../content/court.js';
import { REACTIONS, REACTION_IDS, FULL_BENCH_PAID, FULL_BENCH_SPENT, OUTCOMES } from '../content/court-joint.js';
import { COURT_BY_ID, docketToday, summonsReward, rotateCast } from '../engine/court.js';
import { effectiveCase, twistById } from '../engine/court-twists.js';
import {
  newSeed, jointVersion, jointCast, castAsSent, castJointEpisode, invitableCases, revealScript, benchOutcome, payFullBench, recordLine,
  addMark, marksByLine, galleryLine, sealedRuling, truthLine, MARK_LIMIT, SERVED, INVITE
} from '../engine/court-joint.js';
import { glyph } from '../art/mayhem-glyphs.js';
import { playStar, playAchievement, playError, playTone } from '../audio/sound.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const nameOf = h => h?.otherName || 'Your friend';
const titleOf = caseId => COURT_BY_ID[caseId]?.title || 'a case this edition does not know';
// The right answer by this edition's case file, or null for a case it lacks.
export function truthOf(h) {
  const base = COURT_BY_ID[h?.caseId];
  if (!base || (h.twist && !twistById(base.id, h.twist))) return null;
  return effectiveCase(base, twistById(base.id, h.twist)).truth;
}
const ROW_LIMIT = 6;

// Which hearings belong in the lobby or the postbox, most pressing first.
const showable = h => !(h.status === 'withdrawn') && !(h.status === 'expired' && h.role === 'second');
function ordered(list, needsMe) {
  return list.filter(showable).sort((a, b) => Number(needsMe(b)) - Number(needsMe(a)) || (b.ruledAt || b.createdAt) - (a.ruledAt || a.createdAt));
}
// One sentence about a hearing, as markup (names escaped).
export function rowSentence(h) {
  const who = '<b>' + esc(nameOf(h)) + '</b>', what = '<b>' + esc(titleOf(h.caseId)) + '</b>';
  if (h.status === 'open') return h.role === 'second' ? who + ' heard ' + what + ' and ruled. Sealed. Your turn.' : 'Waiting for ' + who + ' on ' + what + '. Your ruling is sealed.';
  if (h.status === 'revealed') {
    if (!h.seen) return 'The envelopes are in: ' + what + ', with ' + who + '.';
    const truth = truthOf(h);
    return what + ', with ' + who + '. ' + (truth ? esc(OUTCOMES[benchOutcome(h, truth)].title) + '.' : '');
  }
  if (h.status === 'expired') return who + ' never ruled on ' + what + '. Yours stands alone.';
  if (h.status === 'declined') return h.role === 'first' ? who + ' declined ' + what + '. Your ruling stays sealed.' : 'You declined ' + what + '.';
  return what + '.';
}

export function initJointBench({ state, social, cloud, stage } = {}) {
  if (!social || !cloud) return null;
  const S = state;
  const hearings = createHearings({ cloud, social });
  let view = null, note = '', confirm = null, busy = false;
  const records = new Map();
  const active = () => hearings.active();
  const sheet = stage.sheet;
  const myName = () => (cloud.meta?.().socialName || '');
  const inEpisode = () => !!stage.episode();

  /* ---------------- buttons, for two hosts ----------------
     In the Court the buttons carry data-jc; in the Friends postbox they carry
     data-sx and data-sx-id, as the registry asks. */
  const button = (host, action, id, label, cls = 'btn btn-sm') => host === 'postbox'
    ? '<button class="' + cls + '" type="button" data-sx="' + action + '" data-sx-id="' + esc(id) + '">' + label + '</button>'
    : '<button class="' + cls + '" type="button" data-jc="' + action + '" data-jc-id="' + esc(id) + '">' + label + '</button>';
  function rowMarkup(h, host = 'court') {
    const b = (action, label, cls) => button(host, action, h.id, label, cls);
    let actions = [];
    if (h.status === 'open' && h.role === 'second') actions = [b('hear', 'Hear it', 'btn btn-sm btn-primary'), b('decline', 'Decline', 'btn btn-sm btn-ghost')];
    else if (h.status === 'open') actions = [b('withdraw', 'Withdraw', 'btn btn-sm btn-ghost')];
    else if (h.status === 'revealed') actions = h.seen ? [b('reveal', 'See the reveal', 'btn btn-sm'), b('replay', 'Replay', 'btn btn-sm btn-ghost')] : [b('reveal', 'Open the envelopes', 'btn btn-sm btn-primary')];
    else if (h.status === 'expired' && !h.seen) actions = [b('reveal', 'Read yours', 'btn btn-sm')];
    const incoming = h.role === 'second' || h.status === 'revealed';
    if (incoming) actions.push(b('block', 'Block', 'btn btn-sm btn-ghost jc-warn'), b('report', 'Report', 'btn btn-sm btn-ghost jc-warn'));
    const asking = confirm?.id === h.id ? confirm.kind : '';
    const box = !asking ? '' : '<div class="jc-confirm" role="group" aria-label="' + (asking === 'block' ? 'Block ' : 'Report ') + esc(nameOf(h)) + '"><p>' + (asking === 'block'
      ? '<b>Block ' + esc(nameOf(h)) + '?</b> Every hearing between you is torn up, your record with them goes, and your code stops working for them. They are not told.'
      : '<b>Report ' + esc(nameOf(h)) + '?</b> A person reads every report. They are not told who sent it.') + '</p><div class="sc-actions">' +
      b(asking + '-yes', asking === 'block' ? 'Block' : 'Send report', 'btn btn-sm jc-warn') + b('cancel', 'Cancel', 'btn btn-sm btn-ghost') + '</div></div>';
    return '<div class="jc-row' + (hearings.needsMe(h) ? ' jc-due' : '') + '" data-jc-row="' + esc(h.id) + '" data-status="' + esc(h.status) + '"><p>' + rowSentence(h) + '</p>' +
      (actions.length ? '<div class="sc-actions">' + actions.join('') + '</div>' : '') + box + '</div>';
  }

  /* ---------------- the lobby section ---------------- */
  function lobbyMarkup() {
    const { hearings: list, records: recs } = hearings.cached();
    const rows = ordered(list, hearings.needsMe).slice(0, ROW_LIMIT);
    const lines = recs.slice(0, 2).map(r => '<p class="jc-record">' + esc(recordLine(r)) + '</p>').join('');
    return '<section class="jc-bench" aria-labelledby="jcTitle"><h3 id="jcTitle">The Joint Bench</h3>' +
      (note ? '<p class="jc-note" role="status">' + esc(note) + '</p>' : '') + lines +
      (rows.length ? rows.map(h => rowMarkup(h)).join('') : recs.length ? '' : '<p class="jc-intro">Judge a case with a friend. You both hear the same episode, rule in secret, then the envelopes are opened and one of you is competent.</p>') +
      '<div class="sc-actions jc-start"><button class="btn" type="button" data-jc="invite">Hear a case with a friend</button><button class="btn" type="button" data-jc="serve">Serve papers and judge</button></div></section>';
  }
  function renderLobby() {
    const slot = !inEpisode() && sheet.querySelector('[data-jc-lobby]');
    if (!slot) return;
    const focused = slot.contains(document.activeElement) ? document.activeElement : null;
    const key = focused?.dataset.jc ? '[data-jc="' + focused.dataset.jc + '"]' + (focused.dataset.jcId ? '[data-jc-id="' + CSS.escape(focused.dataset.jcId) + '"]' : '') : null;
    slot.innerHTML = lobbyMarkup();
    if (key) (slot.querySelector(key) || slot.querySelector('button'))?.focus({ preventScroll: true });
  }
  async function refresh() {
    if (!active()) return;
    try { await hearings.list(); note = ''; }
    catch (error) { note = error?.offline ? 'Offline. The bench will keep.' : hearingText(error); }
    renderLobby();
  }

  /* ---------------- forms: pick a friend, invite, serve ---------------- */
  const back = '<button class="btn btn-ghost" type="button" data-jc="lobby">Back to the lobby</button>';
  function showView() {
    const v = view;
    if (!v) return;
    let html = '';
    const status = v.message ? '<p class="jc-note" role="status">' + esc(v.message) + '</p>' : '';
    if (v.mode === 'friends') {
      html = stage.head(v.serve ? 'Serve papers' : 'Hear a case together', 'The Joint Bench') + status +
        (v.loading ? '<p class="jc-note">Knocking on doors.</p>'
          : !v.friends?.length ? '<p class="jc-note">No friends yet. Add one in Friends with their code, then come back and judge them.</p>'
            : '<p class="jc-how">Choose a friend. ' + (v.serve ? 'One of your residents sues one of theirs.' : 'Nobody has to be sued, which is a shame.') + '</p><ul class="jc-friends">' +
              v.friends.map(f => '<li><button class="btn jc-friend" type="button" data-jc="friend" data-jc-id="' + esc(f.userId) + '">' + esc(f.name || 'A friend') + '</button></li>').join('') + '</ul>') +
        '<div class="sc-actions">' + back + '</div>';
    } else if (v.mode === 'invite') {
      const cases = invitableCases(S), f = v.form;
      const opt = (value, label, on) => '<option value="' + esc(value) + '"' + (on ? ' selected' : '') + '>' + esc(label) + '</option>';
      const others = S.pets.filter(p => p.id !== f.plaintiffId);
      html = stage.head('Hear a case together', 'With ' + (v.friend.name || 'a friend')) + status +
        '<p class="jc-how">You hear it first and rule in secret. <b>' + esc(v.friend.name || 'Your friend') + '</b> hears the identical episode, with your reactions as the gallery. Then the bailiff opens both envelopes.</p>' +
        '<div class="jc-form"><label>The case<select data-jc-field="caseId">' + cases.map(k => opt(k.id, k.title + (k.docket ? ' (today’s docket)' : ''), k.id === f.caseId)).join('') + '</select></label>' +
        '<label>Plaintiff<select data-jc-field="plaintiffId">' + S.pets.map(p => opt(p.id, p.name, p.id === f.plaintiffId)).join('') + '</select></label>' +
        '<label>Defendant<select data-jc-field="defendantId">' + (others.length ? others.map(p => opt(p.id, p.name, p.id === f.defendantId)).join('') : opt('', 'A neighbour', true)) + '</select></label></div>' +
        (v.shelf?.length ? '<p class="jc-how">' + esc(v.friend.name || 'Their') + (v.friend.name ? '’s' : '') + ' residents may be called as character witnesses.</p>' : '') +
        '<div class="sc-actions"><button class="btn btn-primary" type="button" data-jc="invite-go">Hear it first</button>' + back + '</div>';
    } else if (v.mode === 'serve') {
      const f = v.form, docket = docketToday(S);
      const opt = (value, label, on) => '<option value="' + esc(value) + '"' + (on ? ' selected' : '') + '>' + esc(label) + '</option>';
      const them = v.friend.name || 'your friend';
      html = stage.head('Serve papers', 'On ' + them) + status +
        (v.loading ? '<p class="jc-note">Wiping their doormat.</p>' : !v.shelf?.length ? '<p class="jc-note">Nothing on show on their shelf yet. Their residents appear here once they open Friends.</p>' :
          '<div class="jc-form"><label>Sue<select data-jc-field="theirId">' + v.shelf.map(r => opt(r.id, r.name, r.id === f.theirId)).join('') + '</select></label>' +
          '<label>Your resident<select data-jc-field="mineId">' + S.pets.map(p => opt(p.id, p.name, p.id === f.mineId)).join('') + '</select></label>' +
          '<label>Takes the side of<select data-jc-field="side">' + opt('p', 'The plaintiff (suing)', f.side !== 'd') + opt('d', 'The defendant (being sued)', f.side === 'd') + '</select></label>' +
          '<label>The case<select data-jc-field="caseId">' + COURT_CASES.map(k => opt(k.id, k.title + (k.id === docket.caseId ? ' (today’s docket)' : ''), k.id === f.caseId)).join('') + '</select></label></div>' +
          '<p class="jc-how"><b>Serve and judge it first:</b> you hear it, rule in secret, and ' + esc(them) + ' hears the same episode before the envelopes are opened together. <b>Serve without judging:</b> ' + esc(them) + ' hears it alone and the verdict comes back to you.</p>' +
          '<div class="sc-actions"><button class="btn btn-primary" type="button" data-jc="serve-go">Serve and judge it first</button><button class="btn" type="button" data-jc="serve-plain">Serve without judging</button></div>') +
        '<div class="sc-actions">' + back + '</div>';
    }
    stage.view('jc-view jc-' + v.mode, html);
    const target = sheet.querySelector('[data-jc-field], .jc-friend, [data-jc="lobby"]');
    target?.focus({ preventScroll: true });
  }
  async function pickFriend({ serve = false } = {}) {
    view = { mode: 'friends', serve, loading: true, friends: [] };
    showView();
    try {
      const list = (await social.friends()).filter(f => f.status === 'accepted');
      if (view?.mode !== 'friends') return;
      view = { ...view, loading: false, friends: list };
    } catch (error) { if (view?.mode === 'friends') view = { ...view, loading: false, message: socialText(error) }; }
    showView();
  }
  function invite(friend) {
    const turn = rotateCast(S, Math.random);
    const cases = invitableCases(S), docket = docketToday(S);
    view = { mode: 'invite', friend, shelf: [], form: { caseId: cases.find(k => k.id === docket.caseId)?.id || cases[0]?.id || '', plaintiffId: turn.plaintiffId, defendantId: turn.defendantId } };
    showView();
    // Their residents may be called as witnesses. Quietly: without them the case still airs.
    social.shelf(friend.userId).then(r => { if (view?.mode === 'invite' && view.friend.userId === friend.userId) view.shelf = r?.shelf?.residents || []; }).catch(() => {});
  }
  async function serve(friend) {
    view = { mode: 'serve', friend, loading: true, shelf: [], form: { caseId: docketToday(S).caseId, mineId: S.pets[0]?.id || '', theirId: '', side: 'p' } };
    showView();
    try {
      const r = await social.shelf(friend.userId);
      if (view?.mode !== 'serve' || view.friend.userId !== friend.userId) return;
      view.shelf = r?.shelf?.residents || [];
      view.form.theirId = view.shelf[0]?.id || '';
      view.loading = false;
    } catch (error) { if (view?.mode === 'serve') Object.assign(view, { loading: false, message: socialText(error) }); }
    showView();
  }
  function friendFrom(raw) { return raw && raw.userId ? { userId: raw.userId, name: raw.name || '' } : null; }

  /* ---------------- hearing as the first judge ---------------- */
  function startFirst() {
    const v = view, f = v.form, friend = v.friend;
    const kind = v.mode === 'serve' ? SERVED : INVITE;
    const theirs = kind === SERVED ? v.shelf.find(r => r.id === f.theirId) : null;
    if (!COURT_BY_ID[f.caseId] || (kind === SERVED && !theirs)) { v.message = 'Choose a case' + (kind === SERVED ? ' and whom to sue.' : '.'); showView(); return; }
    const seed = newSeed(), twist = jointVersion(S, f.caseId, seed);
    const cast = jointCast(S, { kind, caseId: f.caseId, twist, seed, plaintiffId: f.plaintiffId, defendantId: f.defendantId, mineId: f.mineId, theirs, side: f.side,
      friendShelf: v.shelf || [], friendName: friend.name, myName: myName() });
    const ep = cast && castJointEpisode(S, { kind, caseId: f.caseId, twist, seed, cast: castAsSent(cast) }, 'first');
    if (!ep) { v.message = 'That cast would not fit in the courtroom. Try another.'; showView(); return; }
    view = null;
    stage.hear(ep, { role: 'first', kind, otherName: friend.name || 'Your friend', pending: { to: friend.userId, kind, caseId: f.caseId, twist, seed, cast }, marks: [], gallery: new Map() });
  }
  async function servePlain() {
    const v = view, f = v.form, theirs = v.shelf.find(r => r.id === f.theirId), mine = S.pets.find(p => p.id === f.mineId);
    if (!theirs || !mine || busy) return;
    busy = true;
    try {
      await social.serve({ to: v.friend.userId, caseId: f.caseId, plaintiff: mine, defendant: theirs, side: f.side === 'd' ? 'd' : 'p' });
      note = 'Papers served. ' + (v.friend.name || 'Your friend') + ' hears it alone, and the verdict comes back to you.';
      view = null; stage.lobby();
    } catch (error) { v.message = socialText(error); showView(); }
    finally { busy = false; }
  }

  /* ---------------- hearing as the second judge ---------------- */
  async function hear(id) {
    if (busy) return;
    busy = true; note = 'Fetching the papers.'; renderLobby();
    try {
      const h = await hearings.get(id);
      if (h.role !== 'second' || h.status !== 'open') { note = h.status === 'open' ? 'You have already ruled on that one.' : 'That hearing is closed.'; renderLobby(); return; }
      const ep = castJointEpisode(S, h, 'second');
      if (!ep) { note = 'This edition cannot stage that version of the case yet. Update the game, or decline it.'; renderLobby(); return; }
      note = '';
      stage.hear(ep, { role: 'second', kind: h.kind, hearing: h, otherName: nameOf(h), marks: [], gallery: marksByLine(h.theirMarks) });
    } catch (error) { note = hearingText(error); renderLobby(); }
    finally { busy = false; }
  }

  /* ---------------- sealing the ruling, at the wrap ---------------- */
  const sealingLine = ctx => (ctx.role === 'first' ? 'Sealing your ruling for ' + ctx.otherName + '.' : 'Sending your ruling to the bench.');
  function wrapSlot(text, buttons = '', tone = '') {
    const line = sheet.querySelector('[data-jc-seal]'), row = sheet.querySelector('[data-jc-wrap]');
    if (line) { line.className = 'jc-seal' + (tone ? ' ' + tone : ''); line.innerHTML = text; }
    if (row) row.innerHTML = buttons;
    row?.querySelector('.btn-primary')?.focus({ preventScroll: true });
  }
  function sealed(ctx, ep, res) {
    ctx.payload = { ruling: sealedRuling(ep, res), marks: ctx.marks.slice(0, MARK_LIMIT) };
    send(ctx);
  }
  async function send(ctx) {
    const tok = stage.session();
    wrapSlot(esc(sealingLine(ctx)));
    try {
      if (ctx.role === 'first') {
        const r = await hearings.open({ ...ctx.pending, ...ctx.payload });
        ctx.id = r.id;
        if (!stage.alive(tok)) return;
        wrapSlot(glyph('soul') + esc('Sealed. ' + ctx.otherName + ' hears it next, with your reactions as the gallery. The envelopes are opened when they rule.'), '', 'sealed');
      } else {
        const h = ctx.hearing;
        const revealed = await hearings.rule(h.id, ctx.payload.ruling, ctx.payload.marks);
        const souls = summonsReward(S, h.id, 'heard');
        stage.save(); stage.refresh();
        ctx.revealed = { ...revealed, cast: revealed.cast || h.cast };
        if (!stage.alive(tok)) return;
        wrapSlot(glyph('soul') + esc((souls ? '+' + souls + ' for hearing ' + ctx.otherName + '’s case. ' : '') + 'Both envelopes are in.'),
          '<button class="btn btn-primary" type="button" data-jc="open-reveal">Open the envelopes</button>', 'sealed');
      }
    } catch (error) {
      if (!stage.alive(tok)) return;
      const closed = ['not_open', 'not_found', 'not_friends'].includes(error?.code);
      wrapSlot(esc((ctx.role === 'first' ? 'Not sealed. ' : 'Not delivered. ') + hearingText(error) + (closed ? '' : ' Your ruling is kept here until you try again.')),
        closed ? '' : '<button class="btn btn-primary" type="button" data-jc="reseal">Try again</button>', 'failed');
      ctx.retry = !closed;
    }
  }

  /* ---------------- the reveal ---------------- */
  async function reveal(id) {
    if (busy) return;
    busy = true; note = 'Opening the envelopes.'; renderLobby();
    try { const h = await hearings.reveal(id); note = ''; await stageReveal(h); }
    catch (error) { note = hearingText(error); renderLobby(); }
    finally { busy = false; }
  }
  async function stageReveal(h) {
    const ep = castJointEpisode(S, h, h.role), truth = truthOf(h);
    if (!ep || !truth) { note = 'This edition cannot stage that version of the case yet.'; stage.lobby(); return; }
    stage.stageFor(ep, { role: h.role, hearing: h, reveal: true, otherName: nameOf(h) });
    await revealIn(ep, h, truth);
  }
  async function revealIn(ep, h, truth) {
    const tok = stage.session();
    const script = revealScript(ep, h, truth, nameOf(h));
    await stage.wait(400); if (!stage.alive(tok)) return;
    await stage.play(script.lines, 'reveal'); if (!stage.alive(tok)) return;
    const paid = payFullBench(S, h.id, script.outcome);
    if (paid) { stage.save(); stage.refresh(); }
    if (script.outcome === 'full') { stage.applause(2600); playAchievement(); } else if (script.outcome === 'divided') playStar(); else playError();
    const envelope = (who, r) => '<li><b>' + esc(who) + '</b> ' + (r ? esc(r.ruling === 'both' ? 'declared them both idiots' : 'found for ' + (r.ruling === 'plaintiff' ? ep.p.name : ep.d.name)) +
      ' <span class="sc-wrap-stars" aria-label="' + r.stars + ' of 3 stars">' + stage.stars(r.stars) + '</span>' : 'did not rule') + '</li>';
    const controls = stage.controls();
    controls.hidden = false;
    controls.innerHTML = '<div class="sc-wrap jc-reveal ' + esc(script.outcome) + '" data-jc-outcome="' + esc(script.outcome) + '"><span class="sc-kicker">The Joint Bench · ' + esc(titleOf(h.caseId)) + '</span>' +
      '<h3>' + esc(script.title) + '</h3><ul class="jc-envelopes">' + envelope('You', h.mine) + envelope(nameOf(h), h.theirs) +
      '<li class="jc-truth"><b>The truth</b> ' + esc(truthLine(ep, truth)) + '</li></ul>' +
      (paid > 0 ? '<ul class="mh-rewards"><li class="souls">' + glyph('soul') + esc(FULL_BENCH_PAID.replace('{n}', paid)) + '</li></ul>' : paid < 0 ? '<p class="jc-note">' + esc(FULL_BENCH_SPENT) + '</p>' : '') +
      '<p class="jc-record" data-jc-record></p>' +
      '<div class="sc-actions">' + (h.status === 'revealed' ? '<button class="btn btn-primary" type="button" data-jc="replay" data-jc-id="' + esc(h.id) + '">Replay the hearing</button>' : '') +
      '<button class="btn" type="button" data-jc="lobby">Back to the lobby</button><button class="btn btn-ghost" type="button" data-sc="close">Back to the shelf</button></div></div>';
    controls.querySelector('.btn')?.focus({ preventScroll: true });
    try {
      await hearings.list();
      const rec = hearings.cached().records.find(r => r.userId === h.otherUser);
      const line = stage.alive(tok) && sheet.querySelector('[data-jc-record]');
      if (line && rec) line.textContent = recordLine(rec);
    } catch { /* the record shows next time */ }
  }

  /* ---------------- replays ---------------- */
  async function replay(id) {
    if (busy) return;
    busy = true;
    try {
      const h = await hearings.reveal(id);
      const ep = castJointEpisode(S, h, h.role);
      if (!ep || h.status !== 'revealed') { note = 'That hearing cannot be replayed in this edition.'; stage.lobby(); return; }
      stage.hear(ep, { role: h.role, hearing: h, replay: true, otherName: nameOf(h), marks: [], gallery: marksByLine(h.theirMarks) });
    } catch (error) { note = hearingText(error); stage.lobby(); }
    finally { busy = false; }
  }
  async function replayEnd(ctx) {
    const tok = stage.session();
    const choice = await stage.choose('<p class="sc-prompt">Both rulings are sealed. You know what is in them. Open them anyway.</p><div class="sc-choice-row"><button class="btn btn-primary" type="button" data-sc-choice="open">Open the envelopes</button></div>');
    if (!stage.alive(tok) || choice !== 'open') return;
    const ep = stage.episode(), truth = truthOf(ctx.hearing);
    if (ep && truth) await revealIn(ep, ctx.hearing, truth);
  }

  /* ---------------- reactions and the gallery ---------------- */
  function studioMarkup(ctx) {
    const live = '<p class="sr-only" aria-live="polite" data-jc-live></p>';
    if (!ctx || ctx.reveal) return live;
    if (ctx.replay) return '<p class="jc-gallery-note">A replay. The gallery is ' + esc(ctx.otherName) + '.</p>' + live;
    return '<div class="jc-react" role="group" aria-label="React from the bench"><span class="jc-react-label">' + (ctx.role === 'second' ? 'The gallery is ' + esc(ctx.otherName) + '. React back' : esc(ctx.otherName) + ' sees these') + '</span>' +
      REACTION_IDS.map(r => '<button class="btn btn-sm jc-react-btn" type="button" data-jc-react="' + r + '"><span aria-hidden="true">' + REACTIONS[r].icon + '</span> ' + esc(REACTIONS[r].label) + '</button>').join('') + '</div>' + live;
  }
  function onLine(line, ctx) {
    if (!ctx || !line?.key) return;
    ctx.lastKey = line.key;
    const marks = ctx.gallery?.get(line.key);
    if (!marks?.length) return;
    const tok = stage.session();
    marks.forEach((m, i) => stage.later(() => { if (stage.alive(tok)) showGallery(m); }, (stage.reduced() ? 0 : Math.min(m.ms, 2400)) + i * 350));
  }
  function showGallery(m) {
    const st = sheet.querySelector('[data-sc-stage]');
    if (!st || !REACTIONS[m.r]) return;
    const text = galleryLine(m.r);
    stage.layer('jc-gallery jc-' + m.r, '<span class="jc-gallery-icon" aria-hidden="true">' + REACTIONS[m.r].icon + '</span><b>' + esc(text) + '</b>', 2400);
    st.dataset.jcHeard = String(Number(st.dataset.jcHeard || 0) + 1);
    const live = sheet.querySelector('[data-jc-live]');
    if (live) live.textContent = text;
    if (!stage.reduced()) {
      const heads = st.querySelectorAll('.sc-head'), head = heads[(Number(st.dataset.jcHeard) * 4) % Math.max(1, heads.length)];
      head?.classList.add('jc-stir');
      stage.later(() => head?.classList.remove('jc-stir'), 900);
    }
    playTone(m.r === 'gavel' ? 160 : m.r === 'gasp' ? 520 : 340, { duration: 0.08, type: 'triangle', gain: 0.04 });
  }
  function react(ctx, r) {
    const line = stage.current();
    const at = line?.key || ctx.lastKey;
    if (!at || !addMark(ctx.marks, { at, r, ms: Date.now() - stage.lineAt() })) {
      const live = sheet.querySelector('[data-jc-live]');
      if (live && ctx.marks.length >= MARK_LIMIT) live.textContent = 'That is enough reacting for one episode.';
      return;
    }
    stage.layer('jc-mine jc-' + r, '<span aria-hidden="true">' + REACTIONS[r].icon + '</span>', 900);
    const st = sheet.querySelector('[data-sc-stage]');
    if (st) st.dataset.jcMarks = String(ctx.marks.length);
    if (ctx.marks.length >= MARK_LIMIT) sheet.querySelectorAll('[data-jc-react]').forEach(b => { b.disabled = true; });
  }
  function autoMark(ctx, r, at) { if (ctx && ctx.marks && !ctx.replay && !ctx.reveal) addMark(ctx.marks, { at, r, ms: 0 }); }

  /* ---------------- block and report, from wherever the mail is ---------------- */
  async function guard(host, ctx, work) {
    try { await work(); }
    catch (error) {
      const text = hearingText(error);
      if (host === 'postbox') ctx?.say?.(text); else { note = text; }
    }
  }
  async function act(action, id, host = 'court', ctx = null) {
    const h = hearings.cached().hearings.find(x => x.id === id);
    const say = text => { if (host === 'postbox') ctx?.say?.(text); else note = text; };
    const repaint = () => { if (host === 'postbox') ctx?.refresh?.(); else renderLobby(); };
    switch (action) {
      case 'hear': if (host === 'postbox') toCourt({ view: 'hear', id }); else await hear(id); return;
      case 'reveal': if (host === 'postbox') toCourt({ view: 'reveal', id }); else await reveal(id); return;
      case 'replay': if (host === 'postbox') toCourt({ view: 'replay', id }); else await replay(id); return;
      case 'decline': case 'withdraw':
        await guard(host, ctx, async () => {
          const status = await hearings.decline(id);
          say(status === 'withdrawn' ? 'Withdrawn. Your envelope goes in the bin, unopened.' : 'Declined. ' + nameOf(h) + ' can see that you declined.');
        });
        repaint(); return;
      case 'block': case 'report': confirm = { id, kind: action }; repaint(); return;
      case 'cancel': confirm = null; repaint(); return;
      case 'block-yes': case 'report-yes':
        if (!h) return;
        await guard(host, ctx, async () => {
          if (action === 'block-yes') { await social.block(h.otherUser); say('Blocked. ' + nameOf(h) + ' will not find you again.'); }
          else { await social.report(h.otherUser, 'Joint Bench: ' + titleOf(h.caseId)); say('Reported. Block them too if you would rather not hear from them.'); }
          confirm = null;
          await hearings.list().catch(() => {});
        });
        repaint(); return;
    }
  }

  /* ---------------- clicks and changes inside the Court sheet ---------------- */
  function onClick(e) {
    const reactButton = e.target.closest('[data-jc-react]');
    const ctx = stage.context();
    if (reactButton) { if (!reactButton.disabled && ctx) react(ctx, reactButton.dataset.jcReact); return true; }
    const b = e.target.closest('[data-jc]');
    if (!b || b.disabled) return false;
    const action = b.dataset.jc, id = b.dataset.jcId || '';
    switch (action) {
      case 'invite': pickFriend(); return true;
      case 'serve': pickFriend({ serve: true }); return true;
      case 'friend': { const f = view?.friends?.find(x => x.userId === id); if (f) (view.serve ? serve(f) : invite(f)); return true; }
      case 'invite-go': case 'serve-go': if (view) startFirst(); return true;
      case 'serve-plain': servePlain(); return true;
      case 'lobby': view = null; stage.lobby(); refresh(); return true;
      case 'reseal': if (ctx?.payload) send(ctx); return true;
      case 'open-reveal': if (ctx?.revealed) stageReveal(ctx.revealed); return true;
      default: act(action, id, 'court'); return true;
    }
  }
  function onChange(e) {
    const field = e.target.dataset?.jcField;
    if (!field || !view?.form) return false;
    view.form[field] = e.target.value;
    if (field === 'plaintiffId' && view.form.defendantId === view.form.plaintiffId) view.form.defendantId = S.pets.find(p => p.id !== view.form.plaintiffId)?.id || '';
    view.message = '';
    showView();
    sheet.querySelector('[data-jc-field="' + field + '"]')?.focus({ preventScroll: true });
    return true;
  }

  /* ---------------- arriving from Friends ---------------- */
  function route(r) {
    if (!r || typeof r !== 'object') return;
    const friend = friendFrom(r.friend);
    if (r.view === 'invite' && friend) invite(friend);
    else if (r.view === 'serve' && friend) serve(friend);
    else if (r.view === 'hear' && r.id) hear(r.id);
    else if (r.view === 'reveal' && r.id) reveal(r.id);
    else if (r.view === 'replay' && r.id) replay(r.id);
  }

  /* ---------------- the Friends sheet, through the registry ---------------- */
  const needsResidents = () => (S.pets.length ? true : 'You need a resident on the shelf to stage a case.');
  registerFriendAction({ id: 'serve', label: 'Serve papers', order: 10, available: needsResidents, run: friend => toCourt({ view: 'serve', friend: friendFrom(friend) }) });
  registerFriendAction({ id: 'hear-together', label: 'Hear a case together', order: 12, available: needsResidents, run: friend => toCourt({ view: 'invite', friend: friendFrom(friend) }) });
  registerPostboxSource({
    id: 'joint-bench', order: 12, label: 'The Joint Bench', poll: true,
    count: () => (active() ? hearings.count() : 0),
    async load() {
      if (!active()) return [];
      const box = await hearings.list();
      return ordered(box.hearings, hearings.needsMe).map(h => ({ id: h.id, at: h.ruledAt || h.createdAt, title: 'The Joint Bench', line: rowSentence(h).replace(/<[^>]+>/g, ''), hearing: h }));
    },
    render: item => rowMarkup(hearings.cached().hearings.find(h => h.id === item.id) || item.hearing, 'postbox'),
    onClick: (action, id, ctx) => act(action, id, 'postbox', ctx)
  });
  registerFriendsSection({
    id: 'bench-record', where: 'friend', order: 30,
    render(ctx, friend) {
      if (!active() || !friend?.userId) return '';
      const kept = records.get(friend.userId);
      if (!kept || (kept.error && Date.now() - kept.at > 60000)) {
        records.set(friend.userId, { loading: true, at: Date.now() });
        hearings.benchRecord(friend.userId).then(rec => { records.set(friend.userId, { rec, at: Date.now() }); ctx?.refresh?.(); })
          .catch(() => { records.set(friend.userId, { error: true, at: Date.now() }); ctx?.refresh?.(); });
      }
      const rec = records.get(friend.userId)?.rec;
      const recent = (rec?.recent || []).slice(0, 5);
      return '<section class="jc-section" aria-label="The Joint Bench with ' + esc(friend.name || 'this friend') + '"><h3>The Joint Bench</h3>' +
        '<p class="jc-record">' + esc(rec ? recordLine(rec) : records.get(friend.userId)?.error ? 'The record could not be fetched just now.' : 'Fetching the record.') + '</p>' +
        (recent.length ? '<ul class="jc-recent">' + recent.map(h => '<li><span>' + rowSentence(h) + '</span><button class="btn btn-sm" type="button" data-sx="replay" data-sx-id="' + esc(h.id) + '">Replay</button></li>').join('') + '</ul>' : '') + '</section>';
    },
    onClick(action, el) { if (action === 'replay' && el?.dataset?.sxId) toCourt({ view: 'replay', id: el.dataset.sxId }); }
  });

  hearings.subscribe(() => { if (stage.isOpen()) renderLobby(); });
  return {
    hearings, active, lobbyMarkup, refresh, route, onClick, onChange, studioMarkup, onLine, autoMark, sealingLine, sealed, replayEnd,
    stopped() { /* timers belong to the stage and stop with it */ }
  };
}

// Leave the Friends sheet for the Court: the Court will not open over another sheet.
export function toCourt(route) {
  const veil = typeof document !== 'undefined' ? document.getElementById('friendsVeil') : null;
  if (veil?.classList.contains('open')) {
    veil.querySelector('[data-fr="close"]')?.click();
    veil.classList.remove('open');
  }
  window.dispatchEvent(new CustomEvent('shelflife:court', { detail: { joint: route } }));
}
