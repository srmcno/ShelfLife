import { ESCAPADES, escapadeById } from '../content/escapades.js';
import { escapadeView, startEscapade, finishEscapade } from '../engine/escapades.js';
import { keepsakeSvg } from '../art/keepsakes.js';
import { renderPetSprite } from '../art/sprite.js';
import { toast } from './toast.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const say = (text, name) => String(text || '').replaceAll('{name}', () => name);
const gameNames = { 'arcade:frenzy':'Feeding Frenzy', 'arcade:stack':'Coffin Stack', 'arcade:seance':'The Séance', 'arcade:whack':'Grave Whack', outing:'Expeditions' };
const button = (action, label, extra = '', primary = false) => '<button type="button" class="btn ' + (primary ? 'btn-primary' : 'btn-ghost') + '" data-escapade="' + action + '" ' + extra + '>' + esc(label) + '</button>';
let latestState, view, previewId = '', selectedPet = '', panel = 'story', receiptKey = '', recentReceipt = null;
let hubKey = '', portraitArt = null, previousProgress = '';
let repaintPanel = () => {}, syncReturns = () => {};

function offer() {
  const chosen = escapadeById(previewId);
  if (chosen) return chosen;
  // Show every new story before suggesting its alternative ending. Nothing is
  // date-gated, so an interrupted visit and an enthusiastic encore both work.
  const entries = [...view.episodes].sort((a, b) => a.completedEndings.length - b.completedEndings.length);
  return entries[0]?.episode || ESCAPADES[0];
}
function protagonist() {
  return latestState.pets.find(p => p.id === selectedPet) || latestState.pets[(view.completions || 0) % latestState.pets.length];
}
function savedGameGuidance(active) {
  if (active.playDone) return '';
  const { activity } = active.approach, name = active.pet.name;
  if (activity === 'outing') {
    const outing = latestState.life?.outing;
    if (outing?.step === 3) return 'Plan another expedition and keep ' + name + ' in your crew.';
    if (outing && !outing.cast?.includes(active.petId)) return 'Finish the saved expedition, then plan another with ' + name + '. This adventure will wait.';
  }
  return '';
}
function steps(active, interactive = false) {
  const rows = [
    { done:active.careDone, title:active.episode.care.label, text:say(active.episode.care.line, active.pet.name), action:'care' },
    { done:active.playDone, title:active.approach.label, text:savedGameGuidance(active) || gameNames[active.approach.activity] + ' · finish a game together', action:'play' }
  ];
  return '<ol class="escapade-steps" aria-label="Adventure progress">' + rows.map((row, i) => '<li class="' + (row.done ? 'done' : '') + '"><span class="escapade-step-mark" aria-hidden="true">' + (row.done ? '✓' : i + 1) + '</span><div><b>' + esc(row.title) + '</b>' + (interactive ? '<p>' + esc(row.done ? 'A moment already shared.' : row.text) + '</p>' : '') + '<span class="sr-only">' + (row.done ? 'Complete' : 'Not yet complete') + '</span></div>' + (interactive && !row.done ? button(row.action, row.action === 'care' ? 'Spend a moment' : 'Play together', '', true) : '') + '</li>').join('') + '</ol>';
}
function dateLabel(at) {
  return new Date(at).toLocaleDateString(undefined, { month:'short', day:'numeric' });
}
function collectionCount() { return view.completed + ' / ' + view.total + ' keepsakes'; }
function mountPortrait(host, pet) {
  if (!host || !pet) return;
  host.replaceChildren(renderPetSprite(pet));
}

export function renderEscapades(state) {
  latestState = state; view = escapadeView(state);
  const host = document.getElementById('escapadeHub');
  if (!host) return;
  const settling = !state.life?.introDone || (state.life?.welcome && !state.life.welcome.dismissed);
  host.hidden = !view.album.length && (!state.pets.length || settling && !view.active);
  if (!host.hidden) {
    const active = view.active, episode = active?.episode || offer(), pet = active?.pet || protagonist(), last = view.album.at(-1);
    const key = JSON.stringify([active?.startedAt, active?.careDone, active?.playDone, episode.id, pet?.id, pet?.name, collectionCount(), last?.key, previewId]);
    if (hubKey !== key || portraitArt !== pet?.art) {
      hubKey = key; portraitArt = pet?.art;
      const title = active ? episode.title : pet ? pet.name + ' has a terrible idea.' : 'A small life, kept.';
      const line = active ? active.ready ? 'The preparations are done. How will this story end?' : say(episode.pitch, pet.name) : pet ? say(episode.pitch, pet.name) : 'The residents may move on. These moments stay with you.';
      host.classList.toggle('escapade-ready', !!active?.ready);
      host.innerHTML = '<div class="escapade-hub-main"><div class="escapade-portrait" aria-hidden="true"></div><div class="escapade-hub-copy"><span class="escapade-eyebrow">' + (active ? 'Your little adventure' : 'A little adventure') + '</span><h2 id="escapadeHubTitle">' + esc(title) + '</h2><p>' + esc(line) + '</p></div></div>' +
        (active ? steps(active) : '') + '<div class="escapade-hub-actions">' + (pet ? button('open', active ? active.ready ? 'Choose the ending' : 'Continue our adventure' : 'Let’s hear it', 'id="escapadeOpen"', true) : '') + button('album', collectionCount(), 'id="escapadeAlbum"') + '</div>' +
        (last ? '<button type="button" class="escapade-shelf-keepsake" data-escapade="inspect" data-key="' + esc(last.key) + '"><span class="escapade-mini-art" aria-hidden="true">' + keepsakeSvg(last.keepsake) + '</span><span><small>A memory with ' + esc(last.petName) + '</small><b>' + esc(last.ending.title) + '</b><span>' + esc(last.callback) + '</span></span><span aria-hidden="true">↗</span></button>' : '<p class="escapade-promise">A shared moment. A questionable plan. Something to keep.</p>');
      mountPortrait(host.querySelector('.escapade-portrait'), pet);
    }
  }
  const progress = view.active ? view.active.startedAt + ':' + view.active.completedSteps : '';
  if (view.active?.ready && previousProgress && previousProgress.split(':')[0] === String(view.active.startedAt) && previousProgress !== progress) toast(view.active.pet.name + ' has an ending in mind. Your little adventure is ready.');
  previousProgress = progress;
  repaintPanel(); syncReturns();
}

export function initEscapades(state, refresh) {
  const veil = document.getElementById('escapadeVeil'), content = document.getElementById('escapadeContent'), title = document.getElementById('escapadeTitle');
  let panelKey = '';
  function close() { veil.classList.remove('open'); }
  function focusTitle() { title.tabIndex = -1; title.focus({ preventScroll:true }); content.scrollTop = 0; }
  function open(mode = 'story') {
    // Ask each existing dialog to run its own close cleanup before handing off.
    const other = document.querySelector('.veil.open:not(#escapadeVeil)');
    other?.querySelector('.sheet-head button')?.click();
    panel = mode; panelKey = '';
    latestState = state; view = escapadeView(state);
    paint(true); veil.classList.add('open');
    focusTitle();
  }
  function paint(force = false) {
    if (!view || !force && !veil.classList.contains('open')) return;
    const active = view.active, episode = active?.episode || offer(), pet = active?.pet || protagonist();
    const receipt = recentReceipt?.key === receiptKey ? recentReceipt : view.album.find(r => r.key === receiptKey);
    if (panel === 'receipt' && !receipt) panel = 'album';
    const key = JSON.stringify([panel, receiptKey, episode.id, active?.startedAt, active?.careDone, active?.playDone, view.completed, pet?.id, state.pets.map(p => [p.id, p.name])]);
    if (key === panelKey && !force) return;
    panelKey = key;
    const focusedId = content.contains(document.activeElement) ? document.activeElement.id : '';
    if (panel === 'album') {
      title.textContent = 'The things we kept';
      content.innerHTML = '<div class="escapade-album-intro"><p>Small objects. Suspiciously large feelings.</p><span>' + esc(collectionCount()) + '</span></div><div class="escapade-album-grid">' + ESCAPADES.map(e => '<section class="escapade-album-chapter"><h3>' + esc(e.title) + '</h3><div>' + e.endings.map(ending => {
        const record = view.album.find(r => r.episodeId === e.id && r.endingId === ending.id);
        return record ? '<button type="button" class="escapade-album-item" data-escapade="inspect" data-key="' + esc(record.key) + '"><span aria-hidden="true">' + keepsakeSvg(ending.keepsake) + '</span><b>' + esc(ending.title) + '</b><small>With ' + esc(record.petName) + '</small></button>' : '<div class="escapade-album-blank"><span aria-hidden="true">✧</span><b>An ending to discover</b><small>Make a different choice.</small></div>';
      }).join('') + '</div></section>').join('') + '</div><div class="escapade-footer">' + (state.pets.length ? button('open', active ? 'Back to our adventure' : 'Start a little adventure', '', true) : '') + '<p>No missing days. Your collection stays.</p></div>';
    } else if (panel === 'receipt') {
      title.textContent = receipt.ending.title;
      content.innerHTML = '<article class="escapade-receipt"><div class="escapade-receipt-art" aria-hidden="true">' + keepsakeSvg(receipt.keepsake) + '</div><span class="escapade-eyebrow">Kept with ' + esc(receipt.petName) + ' · ' + esc(dateLabel(receipt.at)) + '</span><h3>' + esc(receipt.episode.title) + '</h3><p>' + esc(receipt.text) + '</p><blockquote>' + esc(receipt.callback) + '</blockquote><span class="escapade-receipt-stamp">' + (receipt.replayed ? 'A familiar keepsake · a new moment together' : 'A moment made permanent') + '</span></article><div class="escapade-footer">' + button('album', 'The keepsake album') + (state.pets.length ? button('next', active ? 'Continue our adventure' : 'Another terrible idea', '', true) : '') + '</div>';
    } else if (!pet) {
      title.textContent = 'A little adventure';
      content.innerHTML = '<p>Every terrible idea needs someone small to have it.</p>' + button('create', 'Make a resident', '', true) + button('album', 'Open the keepsake album');
    } else if (active) {
      title.textContent = episode.title;
      content.innerHTML = '<div class="escapade-story-heading"><div class="escapade-dialog-portrait" aria-hidden="true"></div><div><span class="escapade-eyebrow">Starring ' + esc(pet.name) + '</span><p>' + esc(say(episode.pitch, pet.name)) + '</p></div></div>' + steps(active, true) +
        (active.ready ? '<section class="escapade-finale"><span class="escapade-eyebrow">And then?</span><h3>You get to choose the ending.</h3><p>Both endings leave something worth keeping.</p><div class="escapade-choices">' + episode.endings.map(ending => '<button type="button" class="escapade-choice" data-escapade="finish" data-ending="' + esc(ending.id) + '"><span class="escapade-choice-art" aria-hidden="true">' + keepsakeSvg(ending.keepsake) + '</span><b>' + esc(ending.label) + '</b><span>' + (view.album.some(r => r.episodeId === episode.id && r.endingId === ending.id) ? 'Revisit this memory' : 'Discover a new keepsake · +2 discoveries') + '</span></button>').join('') + '</div></section>' : '<p class="escapade-rest-note">Any finished attempt counts. Win, wobble or practise.<br>Your place is saved for whenever you come back.</p>') + '<div class="escapade-footer">' + button('album', 'Open the keepsake album') + '</div>';
      mountPortrait(content.querySelector('.escapade-dialog-portrait'), pet);
    } else {
      title.textContent = episode.title;
      content.innerHTML = '<div class="escapade-story-heading"><div class="escapade-dialog-portrait" aria-hidden="true"></div><div><span class="escapade-eyebrow">A proposal of questionable wisdom</span><p>' + esc(say(episode.pitch, pet.name)) + '</p></div></div><label class="escapade-cast">The resident with the plan<select id="escapadeResident">' + state.pets.map(p => '<option value="' + esc(p.id) + '" ' + (p.id === pet.id ? 'selected' : '') + '>' + esc(p.name) + '</option>').join('') + '</select></label><div class="escapade-preparation"><span aria-hidden="true">♡</span><p>A small moment together.<br><b>' + esc(say(episode.care.line, pet.name)) + '</b></p></div><h3 class="escapade-question">How shall we go about it?</h3><div class="escapade-choices">' + episode.approaches.map(approach => '<button type="button" class="escapade-choice escapade-approach" data-escapade="start" data-approach="' + esc(approach.id) + '"><span class="escapade-eyebrow">' + esc(gameNames[approach.activity]) + '</span><b>' + esc(approach.label) + '</b><span>' + esc(say(approach.line, pet.name)) + '</span><em>Make this our plan ↗</em></button>').join('') + '</div><div class="escapade-footer">' + button('shuffle', 'Hear another idea') + button('album', collectionCount()) + '</div><p class="escapade-rest-note">One personal moment. One completed game. Either order is fine.<br>No deadline; your adventure waits for you.</p>';
      mountPortrait(content.querySelector('.escapade-dialog-portrait'), pet);
    }
    if (focusedId) document.getElementById(focusedId)?.focus({ preventScroll:true });
  }
  repaintPanel = () => paint();
  function action(e) {
    const control = e.target.closest?.('[data-escapade]');
    if (!control || control.disabled) return;
    const kind = control.dataset.escapade;
    view = escapadeView(state); latestState = state;
    if (kind === 'open') { receiptKey = ''; recentReceipt = null; open(); }
    if (kind === 'album') { recentReceipt = null; open('album'); }
    if (kind === 'inspect') { recentReceipt = null; receiptKey = control.dataset.key; open('receipt'); }
    if (kind === 'next') { previewId = ''; receiptKey = ''; recentReceipt = null; panelKey = ''; open(); }
    if (kind === 'shuffle') { previewId = ESCAPADES[(ESCAPADES.indexOf(offer()) + 1) % ESCAPADES.length].id; renderEscapades(state); paint(true); focusTitle(); }
    if (kind === 'start') {
      const pet = protagonist();
      if (!pet || !startEscapade(state, { episodeId:offer().id, approachId:control.dataset.approach, petId:pet.id })) return;
      refresh(); paint(true); focusTitle();
    }
    if (kind === 'care' || kind === 'play') {
      const active = view.active; if (!active) return;
      close();
      if (kind === 'care') window.dispatchEvent(new CustomEvent('shelflife:care', { detail:{ petId:active.petId } }));
      else {
        const activity = active.approach.activity;
        if (activity.startsWith('arcade:')) window.dispatchEvent(new CustomEvent('shelflife:arcade', { detail:{ petId:active.petId, game:activity.slice(7) } }));
        else window.dispatchEvent(new CustomEvent('shelflife:activity', { detail:{ petId:active.petId, action:activity } }));
      }
    }
    if (kind === 'finish') {
      const active = view.active;
      const result = finishEscapade(state, control.dataset.ending); if (!result) return;
      // The album preserves its first maker. A replay still belongs to the
      // resident who just lived it, so show that real result before the album.
      recentReceipt = { ...result.record, petId:active.petId, petName:active.petName, at:Date.now(), text:result.text, callback:result.callback, replayed:!result.fresh };
      receiptKey = result.record.key; panel = 'receipt'; previewId = ''; refresh(); paint(true); focusTitle();
      toast(result.fresh ? result.ending.title + ' kept · +2 discoveries' : 'A familiar ending. The memory stays.');
    }
    if (kind === 'create') { close(); document.getElementById('newPetBtn').click(); }
  }
  document.addEventListener('click', action);
  content.addEventListener('change', e => { if (e.target.id === 'escapadeResident') { selectedPet = e.target.value; paint(true); } });
  document.getElementById('escapadeClose').addEventListener('click', close);
  veil.addEventListener('click', e => { if (e.target === veil) close(); });
  window.addEventListener('shelflife:escapade', () => open());
  // Offer the story ending directly from the real game's result. Its Close
  // control remains first so Escape still invokes that game's own cleanup.
  syncReturns = () => {
    for (const id of ['lifeVeil']) {
      const game = document.getElementById(id), head = game?.querySelector('.sheet-head');
      if (!head) continue;
      let link = head.querySelector('.escapade-return');
      if (!link && view?.active?.ready) {
        link = document.createElement('button'); link.type = 'button'; link.className = 'btn btn-primary btn-sm escapade-return'; link.dataset.escapade = 'open'; link.textContent = 'Our story’s ending ↗'; head.append(link);
      }
      if (link) link.hidden = !view?.active?.ready;
    }
  };
  for (const id of ['lifeVeil']) new MutationObserver(syncReturns).observe(document.getElementById(id), { attributes:true, attributeFilter:['class'] });
}
