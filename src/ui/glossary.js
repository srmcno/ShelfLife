import { GUIDE_STEPS, guideOf, guideView, guideCopy, resumeGuide } from '../engine/guide.js';

/* The glossary and the help sheet. Every number, meter and currency the game
   shows has an entry here, in plain language: one line a tooltip card can
   carry, and a few more words for the glossary. The help sheet (#helpVeil) has
   two parts, "First day" and "Glossary", and opens at an entry when something
   on screen asks about it. Import-safe in node: no DOM at load. */

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// group: which heading it sits under. action: an optional button on the entry or card.
export const GLOSSARY = [
  { id: 'souls', group: 'Your household', term: 'Souls', short: 'What the shelf pays you for putting up with it. Forty buys a coffin.',
    long: 'Care, emergencies, chores, the nightly omen and games all pay souls. Spend them on coffins and special orders. Nothing is ever taken away; souls only go down when you spend them.', action: { label: 'Open the Cabinet', mh: 'cabinet' } },
  { id: 'rank', group: 'Your household', term: 'Household rank', short: 'What the neighbours call your house. It rises with every soul you have ever earned.',
    long: 'Twelve titles, from Suspiciously Normal to Unspeakable. Rank counts souls earned, not souls held, so spending never lowers it. Its progress line is at the top of the Cabinet.', action: { label: 'Open the Cabinet', mh: 'cabinet' } },
  { id: 'bond', group: 'Your household', term: 'Bond', short: 'How much one resident trusts you, from 0 to 25.',
    long: 'Care when a need is below 72 counts; every three useful acts add one point. A strong bond turns disasters aside and nudges good endings along. Games and plots add at most three a day per resident.' },
  { id: 'household-trust', group: 'Your household', term: 'Household trust', short: 'Every resident’s bond added together. It unlocks furniture.',
    long: 'This is the number beside the next piece of furniture in Decorate. Care for residents one at a time to raise it; the rounds do not.' },
  { id: 'needs', group: 'Your household', term: 'Needs', short: 'Food, attention and cleanliness. A mark under a resident means that one is low.',
    long: 'Round F is food, diamond A is attention, square W is washing. They fall in real time, slower at night, and never drop to the point of harm. Tap a resident to fix them.' },
  { id: 'emergency', group: 'Your household', term: 'Emergency', short: 'Something on the shelf has gone wrong. Pick a response; every choice pays souls.',
    long: 'One arrives about every twelve minutes, and up to three wait while you are away. Who is involved changes the odds, and the card shows a plain risk read on each choice.' },
  { id: 'omen', group: 'Your household', term: 'Tonight’s omen', short: 'One free card a night: souls now, a twist for the day.',
    long: 'Turn it over once per local day. Nights in a row pay more, the seventh leaves something rare on the step, and one missed night is forgiven. It resets at your local midnight.' },
  { id: 'chores', group: 'Your household', term: 'Unholy chores', short: 'Three small jobs a day. Each pays souls; all three earn a free curio.',
    long: 'They are drawn fresh each local day, count what you do anyway, and never punish a missed day.' },
  { id: 'coffin', group: 'Your household', term: 'Coffins and curios', short: 'A coffin costs 40 souls and holds one cursed curio for the Cabinet.',
    long: 'There are 34 curios, Common to Unholy. A long run of coffins without anything cursed ends in one, and the coffin gets heavy when it is due. A special order buys a missing curio outright.', action: { label: 'Open the Cabinet', mh: 'cabinet' } },
  { id: 'poke', group: 'Your household', term: 'Poke the drawer', short: 'Pay 25 souls to start an emergency now instead of waiting.',
    long: 'It costs more than an emergency usually pays, so it is for curio hunting, not for farming.' },
  { id: 'rounds', group: 'Your household', term: 'Do the rounds', short: 'A small top-up for everyone at once. It builds no bond.',
    long: 'Adds 13 to every need, pays a few souls for the first five each day and has a short cooldown. Individual care is what builds trust.' },
  { id: 'discoveries', group: 'The workshop', term: 'Discoveries', short: 'Progress in the workshop: new games, keepsakes and visitor chapters.',
    long: 'They unlock display finishes for your cabinet of keepsakes. There is no streak to lose.' },
  { id: 'stars', group: 'The Playroom', term: 'Stars and skulls', short: 'How well a trip or a game went. Expeditions earn one to three stars; arcade runs earn up to three skulls.',
    long: 'Each arcade game has three score tiers, and each tier reached is a skull; a short run can earn none. Your best skulls stay on the game’s card. Arcade souls follow the score and the daily purse, with a bonus for a new best.' },
  { id: 'docket', group: 'The Playroom', term: 'Docket and daily challenge', short: 'One Shelf Court case and one arcade twist each day. Same for everyone on the same date.',
    long: 'Airing the docket pays souls once a day. The arcade challenge keeps its own best score, and the first scoring run each day pays a bonus that grows with your streak.' },
  { id: 'nerve', group: 'Expeditions', term: 'Nerve', short: 'How brave your crew has left, from 0 to 3. Detours spend it; the quiet route earns it back.',
    long: 'A bold detour costs one or two nerve depending on who is along. You need at least two nerve at home to finish well.' },
  { id: 'trail-points', group: 'Expeditions', term: 'Trail points', short: 'The score of a trip. Three or more teaches the next lesson.',
    long: 'Points come from the choices at each stop. A part you already have still earns points.' },
  { id: 'wager', group: 'Expeditions', term: 'Wager', short: 'An optional challenge before a trip. Meet it for two extra points; miss it and lose nothing.',
    long: 'Bold wants two detours, thrifty wants the packed tool left untouched, steady wants nerve in hand at the end.' },
  { id: 'mastery', group: 'Expeditions', term: 'Mastery', short: 'What your crew has learned about a kind of trip. Higher tiers open better routes.',
    long: 'A tier is earned by finishing trips with enough trail points. Practice runs teach without risking a part.' },
  { id: 'field-notes', group: 'Expeditions', term: 'Field notes', short: 'Pages the crew writes up on a trip. There are eight to find.',
    long: 'Each new page is a small discovery and joins the reports in your paperwork.' },
  { id: 'calm', group: 'Comfort', term: 'Calm mode', short: 'No motion, light effects, and a quieter room.',
    long: 'Switch it on in More. It stops every animation, keeps effects light, and makes the shelf still enough to read. Your device’s own reduced-motion setting always counts too.' }
];
export const GLOSSARY_BY_ID = Object.fromEntries(GLOSSARY.map(entry => [entry.id, entry]));
export const glossaryEntry = id => GLOSSARY_BY_ID[id] || null;

// Words that appear on the expedition screens only once a first trip is done.
export const EXPEDITION_TERMS = ['nerve', 'trail-points', 'wager', 'mastery', 'field-notes'];

/* ---------------- the help sheet ---------------- */

const $ = id => document.getElementById(id);
let S = null, openedFrom = null;

function tourHTML(state) {
  const g = guideOf(state), view = g ? guideView(state) : null, name = state.pets[0]?.name || 'your first resident';
  const rows = GUIDE_STEPS.map((step, i) => {
    const done = !!g?.done.includes(step.id);
    const copy = guideCopy(step.id, name);
    return '<li class="' + (done ? 'done' : '') + '"><span class="gl-check" aria-hidden="true">' + (done ? '✓' : String(i + 1)) + '</span><span><b>' + esc(copy.line) + '</b><small>' + esc(copy.hint) + '</small></span><em>' + (done ? 'Done' : '') + '</em></li>';
  }).join('');
  let control = '';
  if (g?.status === 'skipped') control = '<button class="btn btn-primary" type="button" data-help-resume>Resume the tour</button>';
  else if (g?.status === 'on') control = '<p class="hint">The tour is under way. It waits for you on the shelf.</p>';
  else if (g?.status === 'done') control = '<p class="hint">You finished the tour. The glossary has the rest.</p>';
  else control = '<p class="hint">The tour is for a brand new household. This one has been around long enough to know better.</p>';
  void view;
  return '<ol class="gl-tour">' + rows + '</ol>' + control;
}

function glossaryHTML() {
  const groups = [...new Set(GLOSSARY.map(entry => entry.group))];
  return groups.map(group => '<section class="gl-group"><h3>' + esc(group) + '</h3><dl>' + GLOSSARY.filter(entry => entry.group === group).map(entry =>
    '<div class="gl-entry" id="gl-' + entry.id + '" tabindex="-1"><dt>' + esc(entry.term) + '</dt><dd><p class="gl-short">' + esc(entry.short) + '</p><p>' + esc(entry.long) + '</p>' +
    (entry.action ? '<button class="btn btn-sm" type="button" data-gl-action="' + entry.id + '">' + esc(entry.action.label) + '</button>' : '') + '</dd></div>').join('') + '</dl></section>').join('');
}

function selectTab(name) {
  const tab = ['glossary', 'testers'].includes(name) ? name : 'first-day';
  document.querySelectorAll('#helpVeil [role="tab"]').forEach(button => {
    const on = button.dataset.helpTab === tab;
    button.setAttribute('aria-selected', String(on));
    button.tabIndex = on ? 0 : -1;
  });
  document.querySelectorAll('#helpVeil [role="tabpanel"]').forEach(panel => { panel.hidden = panel.dataset.helpPanel !== tab; });
}

// Closes any other open sheet that would sit above the help sheet in focus order.
function closeOthers() {
  document.querySelectorAll('.veil.open').forEach(veil => {
    if (veil.id === 'helpVeil') return;
    veil.querySelector('.sheet-head button')?.click();
  });
}

export function openHelp({ tab = 'first-day', entry = '', from = null } = {}) {
  const veil = $('helpVeil');
  if (!veil) return;
  if (document.querySelector('.veil.open:not(#helpVeil)')) closeOthers();
  if (S) {
    const tour = $('helpTour'); if (tour) tour.innerHTML = tourHTML(S);
  }
  const list = $('helpGlossary'); if (list && !list.dataset.ready) { list.innerHTML = glossaryHTML(); list.dataset.ready = '1'; }
  selectTab(entry ? 'glossary' : tab);
  openedFrom = from;
  veil.classList.add('open');
  if (entry) {
    const target = $('gl-' + entry);
    requestAnimationFrame(() => {
      if (!target) return;
      target.scrollIntoView({ block: 'start', behavior: 'auto' });
      target.classList.remove('gl-flash'); void target.offsetWidth; target.classList.add('gl-flash');
      target.focus({ preventScroll: true });
    });
  }
}
export function closeHelp() { $('helpVeil')?.classList.remove('open'); }

/* ---------------- the tooltip card ---------------- */

let card = null, cardAnchor = null;
function ensureCard() {
  if (card) return card;
  card = document.createElement('div');
  card.id = 'glossCard';
  card.className = 'gloss-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'false');
  card.hidden = true;
  document.body.appendChild(card);
  card.addEventListener('click', event => {
    const action = event.target.closest('[data-gl-more],[data-gl-act],[data-gl-close]');
    if (!action) return;
    const id = card.dataset.id;
    if (action.hasAttribute('data-gl-more')) {
      // Focus goes back to the term that asked, so Help returns there when it closes, not to
      // this card's hidden button. Help opens once this click is over, when the dialog
      // controller has stopped treating the card's button as the opener.
      const anchor = cardAnchor;
      hideGloss(true);
      setTimeout(() => openHelp({ entry: id, from: anchor }), 0);
    }
    else if (action.hasAttribute('data-gl-act')) { hideGloss(false); window.dispatchEvent(new CustomEvent('shelflife:mayhem', { detail: { open: GLOSSARY_BY_ID[id]?.action?.mh } })); }
    else hideGloss(true);
  });
  return card;
}
export function showGloss(id, anchor = null) {
  const entry = GLOSSARY_BY_ID[id];
  if (!entry) return false;
  const el = ensureCard();
  cardAnchor = anchor;
  // Inside an open sheet the card lives in the sheet's veil, so it is not behind it and not inert.
  const home = anchor?.closest?.('.veil') || document.body;
  if (el.parentElement !== home) home.appendChild(el);
  el.dataset.id = id;
  el.setAttribute('aria-label', entry.term);
  const inSheet = home !== document.body;
  el.innerHTML = '<b class="gloss-term">' + esc(entry.term) + '</b><p>' + esc(entry.short) + '</p><div class="gloss-actions">' +
    (entry.action && !inSheet ? '<button class="btn btn-sm btn-primary" type="button" data-gl-act>' + esc(entry.action.label) + '</button>' : '') +
    '<button class="btn btn-sm" type="button" data-gl-more>More in the glossary</button><button class="btn btn-sm btn-ghost" type="button" data-gl-close>Got it</button></div>';
  el.hidden = false;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  el.querySelector('[data-gl-close]')?.focus({ preventScroll: true });
  return true;
}
export function hideGloss(restoreFocus = false) {
  if (!card || card.hidden) return;
  card.hidden = true; card.classList.remove('show');
  // A mark that is not itself focusable (a need pip) hands focus to the control around it.
  const home = cardAnchor?.closest?.('button,a[href],[tabindex]:not([tabindex="-1"]),[role="button"]');
  if (restoreFocus && home?.isConnected) home.focus?.({ preventScroll: true });
  cardAnchor = null;
}

/* ---------------- wiring ---------------- */

export function initHelp(state) {
  S = state;
  const veil = $('helpVeil');
  if (!veil) return;
  // Focus returns to #quickHelp through the shared dialog controller; every
  // opener below adds the class inside the click that asked for it.
  $('quickHelp')?.addEventListener('click', () => openHelp({ from: 'quickHelp' }));
  $('helpBtn')?.addEventListener('click', () => openHelp({ from: 'helpBtn' }));
  $('helpClose')?.addEventListener('click', closeHelp);
  $('helpPlayroom')?.addEventListener('click', () => { closeHelp(); $('playroomBtn')?.click(); });
  veil.addEventListener('click', event => {
    if (event.target === veil) { closeHelp(); return; }
    const tab = event.target.closest('[data-help-tab]');
    if (tab) { selectTab(tab.dataset.helpTab); tab.focus({ preventScroll: true }); return; }
    if (event.target.closest('[data-help-resume]')) { if (resumeGuide(S)) { closeHelp(); window.dispatchEvent(new CustomEvent('shelflife:guide-resumed')); } return; }
    const act = event.target.closest('[data-gl-action]');
    if (act) { closeHelp(); window.dispatchEvent(new CustomEvent('shelflife:mayhem', { detail: { open: GLOSSARY_BY_ID[act.dataset.glAction]?.action?.mh } })); }
  });
  veil.addEventListener('keydown', event => {
    const tabs = [...veil.querySelectorAll('[role="tab"]')];
    const at = tabs.indexOf(document.activeElement);
    if (at < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const to = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (at + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[to].click();
  });
  // Anything marked data-gloss explains itself: a link in a sheet, a mark under a resident.
  const explain = event => {
    let trigger = event.target.closest?.('[data-gloss]');
    // A resident holds pointer capture while it is pressed, so a tap on one of its need marks
    // arrives aimed at the resident. Ask what is actually under the finger.
    if (!trigger && event.detail !== 0 && event.target.closest?.('#cabinet .pet')) {
      trigger = document.elementsFromPoint(event.clientX, event.clientY).find(el => el.matches?.('.pip[data-gloss]')) || null;
    }
    if (!trigger || !GLOSSARY_BY_ID[trigger.dataset.gloss] || trigger.closest('#glossCard')) return false;
    event.preventDefault();
    event.stopPropagation();
    showGloss(trigger.dataset.gloss, trigger);
    return true;
  };
  document.addEventListener('click', explain, true);
  // Marks that are not buttons by nature (role="button") answer the keyboard as well.
  document.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches?.('[data-gloss][role="button"]')) explain(event);
  }, true);
  new MutationObserver(() => hideGloss(false)).observe(document.body, { attributes: true, attributeFilter: ['data-active-dialog'] });
  document.addEventListener('pointerdown', event => { if (card && !card.hidden && !event.target.closest('#glossCard') && !event.target.closest('[data-gloss]')) hideGloss(false); }, true);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && card && !card.hidden) { event.stopImmediatePropagation(); hideGloss(true); } }, true);
}
