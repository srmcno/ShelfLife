// Friends' residents staying on this shelf, and ours staying elsewhere.
//
// Guests sit on a spare plank under the cabinet, never in its slots: they are
// not residents, so the household, drag and drop, behaviour, achievements,
// rank and the arcade never see them. Tapping one opens its card, where the
// host can feed, fuss and wash it (the server counts each, and nothing can
// hurt a guest) and it answers in its own manner. Ours that are away keep
// their place at home with a small "away at Bea’s" tag: only a copy went.
import { guestSprite, MOOD_LINES, traitNames, esc } from './friends.js';
import { activeGuests, careCounts, recordCare, reactionLine, timesWord, dropDepartedGuests, awayFor } from '../engine/visits.js';
import { CARE_WORDS } from '../content/postbox.js';
import { leftWords } from './postbox.js';

const CARE_DONE = { food: 'fed', fuss: 'fussed over', clean: 'washed' };
export function careLine(c) {
  const parts = [['food', c.food], ['fuss', c.fuss], ['clean', c.clean]].filter(([, n]) => n > 0).map(([k, n]) => CARE_DONE[k] + ' it ' + timesWord(n));
  if (!parts.length) return 'You have not laid a finger on it yet. Its owner will hear about that too.';
  return 'So far you have ' + (parts.length === 1 ? parts[0] : parts.slice(0, -1).join(', ') + ' and ' + parts.at(-1)) + '. Its owner gets a postcard about all of it.';
}
export function plankMarkup(guests, now = Date.now()) {
  if (!guests.length) return '';
  return '<div class="gp-head"><span class="eyebrow">The spare plank</span><small>Visitors from friends. Feed them, do not keep them.</small></div>' +
    '<div class="gp-row">' + guests.map(g => '<button class="gp-guest" type="button" data-guest="' + esc(g.visitId) + '" aria-haspopup="dialog" aria-label="' +
      esc(g.resident.name + ', visiting from ' + (g.from.name || 'a friend') + ', leaves in ' + leftWords(g.leaves - now) + '. Look after it') + '">' +
      '<span class="gp-art" data-guest-art="' + esc(g.visitId) + '"></span><span class="gp-name">' + esc(g.resident.name) + '</span>' +
      '<span class="gp-tag">visiting from ' + esc(g.from.name || 'a friend') + '</span></button>').join('') + '</div><div class="gp-plank" aria-hidden="true"></div>';
}

export function initGuests({ state, postbox, social, save = () => {} }) {
  const pane = document.getElementById('paneShelf'), stage = pane?.querySelector('.stage');
  const veil = document.getElementById('guestVeil'), sheet = document.getElementById('guestSheet');
  if (!stage || !veil || !sheet) return null;
  veil.setAttribute('aria-label', 'A guest');
  const plank = document.createElement('section');
  plank.className = 'guest-plank';
  plank.id = 'guestPlank';
  plank.setAttribute('aria-label', 'Guests from friends');
  plank.hidden = true;
  stage.after(plank);
  const sprites = new Map();
  let drawn = '', openId = '', reaction = '', busy = false, tags = '';

  const sprite = g => { let el = sprites.get(g.visitId); if (!el) { el = guestSprite(g.resident); sprites.set(g.visitId, el); } return el; };
  function renderPlank() {
    const now = Date.now(), guests = activeGuests(state, now);
    const key = JSON.stringify(guests.map(g => [g.visitId, g.resident.name, g.from.name, Math.round((g.leaves - now) / 3600000)]));
    if (key !== drawn) {
      drawn = key;
      plank.hidden = !guests.length;
      plank.innerHTML = plankMarkup(guests, now);
      for (const g of guests) plank.querySelector('[data-guest-art="' + CSS.escape(g.visitId) + '"]')?.appendChild(sprite(g));
      for (const id of [...sprites.keys()]) if (!guests.some(g => g.visitId === id)) sprites.delete(id);
    }
    if (openId && !guests.some(g => g.visitId === openId) && veil.classList.contains('open')) close();
    tagAway(now);
  }
  // Ours away keep their seat; a tag says where the copy went.
  function tagAway(now) {
    const pieces = [...document.querySelectorAll('#cabinet .piece.pet')];
    const want = pieces.map(el => [el, awayFor(state, el.dataset.id, now)]);
    const key = want.map(([el, a]) => el.dataset.id + ':' + (a ? a.status + a.host.name : '')).join('|');
    if (key === tags && want.every(([el, a]) => !!el.querySelector('.away-tag') === !!a)) return;
    tags = key;
    for (const [el, a] of want) {
      let tag = el.querySelector('.away-tag');
      if (!a) { tag?.remove(); continue; }
      if (!tag) { tag = document.createElement('span'); tag.className = 'away-tag'; el.appendChild(tag); }
      const text = (a.status === 'pending' ? 'packed for ' : 'away at ') + (a.host.name || 'a friend') + '’s';
      if (tag.textContent !== text) tag.textContent = text;
    }
  }

  function cardMarkup(g) {
    const c = careCounts(state, g.visitId), r = g.resident, now = Date.now();
    const why = !navigator.onLine ? 'No connection. The guest will wait; it has nowhere else to be.'
      : !social?.active() || !postbox ? 'Sign in to cloud save and open Friends to look after guests.' : '';
    return '<div class="sheet-head"><div><span class="eyebrow">A guest, from ' + esc(g.from.name || 'a friend') + '’s</span><h2 id="guestTitle" tabindex="-1">' + esc(r.name) + '</h2></div>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-gc="close">Close</button></div>' +
      '<div class="gc-body"><span class="gc-art" data-gc-art></span><div class="gc-facts"><p class="gc-stay">Leaves in ' + esc(leftWords(g.leaves - now)) + '.</p>' +
      '<p>' + esc(MOOD_LINES[r.mood] || MOOD_LINES.fine) + '</p>' + (r.traits.length ? '<p class="gc-traits">' + esc(traitNames(r.traits)) + '</p>' : '') + '</div></div>' +
      '<p class="gc-reaction" role="status" aria-live="polite">' + esc(reaction) + '</p>' +
      '<div class="gc-care" role="group" aria-label="Look after ' + esc(r.name) + '">' + ['food', 'fuss', 'clean'].map(k =>
        '<button class="btn' + (k === 'food' ? ' btn-primary' : '') + '" type="button" data-gc="' + k + '"' + (why || busy ? ' disabled' : '') + '>' + CARE_WORDS[k] + '</button>').join('') + '</div>' +
      (why ? '<p class="gc-why">' + esc(why) + '</p>' : '') +
      '<p class="gc-count">' + esc(careLine(c)) + '</p><p class="hint">Nothing you do can harm a guest. Its home shelf keeps its real needs; this is hospitality, and gossip.</p>';
  }
  function renderCard(focus = null) {
    const g = activeGuests(state).find(x => x.visitId === openId);
    if (!g) { close(); return; }
    const active = document.activeElement?.dataset?.gc;
    sheet.innerHTML = cardMarkup(g);
    sheet.querySelector('[data-gc-art]')?.appendChild(guestSprite(g.resident));
    const target = sheet.querySelector(focus || (active ? '[data-gc="' + active + '"]' : '[data-gc="food"]'));
    if (target && !target.disabled) target.focus({ preventScroll: true });
    else sheet.querySelector('h2')?.focus({ preventScroll: true });
  }
  function open(id) { openId = id; reaction = ''; veil.classList.add('open'); renderCard('[data-gc="food"]'); }
  function close() { veil.classList.remove('open'); openId = ''; reaction = ''; }

  async function care(kind) {
    const g = activeGuests(state).find(x => x.visitId === openId);
    if (!g || busy) return;
    busy = true; renderCard();
    try {
      const counts = await postbox.care(g.visitId, kind);
      recordCare(state, g.visitId, counts);
      save();
      const total = counts.fed + counts.fussed + counts.washed;
      reaction = reactionLine(g.resident, kind, total);
      sheet.querySelector('[data-gc-art]')?.classList.add('gc-react');
    } catch (error) {
      reaction = error?.message || 'That did not go through.';
    } finally {
      busy = false;
      if (openId) renderCard('[data-gc="' + kind + '"]');
    }
  }

  plank.addEventListener('click', e => { const b = e.target.closest('[data-guest]'); if (b) open(b.dataset.guest); });
  sheet.addEventListener('click', e => {
    const b = e.target.closest('[data-gc]');
    if (!b || b.disabled) return;
    if (b.dataset.gc === 'close') close();
    else care(b.dataset.gc);
  });
  veil.addEventListener('click', e => { if (e.target === veil) close(); });
  const refresh = () => renderPlank();
  window.addEventListener('shelflife:guests', refresh);
  window.addEventListener('shelflife:storage', refresh);
  window.addEventListener('online', () => { if (openId) renderCard(); });
  window.addEventListener('offline', () => { if (openId) renderCard(); });
  // Guests leave on time even with nobody signed in.
  setInterval(() => { if (dropDepartedGuests(state)) save(); renderPlank(); }, 60000);
  postbox?.subscribe(refresh);
  renderPlank();
  return { refresh, open, close };
}
