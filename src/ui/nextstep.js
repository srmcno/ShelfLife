import { ensureGuide, advanceGuide, guideView, guideActive, guideOf, skipGuide, markGuideSeen, celebrateGuide } from '../engine/guide.js';
import { nextSteps } from '../engine/nextstep.js';
import { mayhemState } from '../mayhem-state.js';
import { omenPending, nextEmergencyIn } from '../engine/mayhem.js';
import { save } from '../state.js';
import { toast } from './toast.js';

/* The one "do this next" card. It replaces the brief and the competing omen
   and emergency strips for a new household, and sits above the shelf for
   everyone else. engine/nextstep.js decides; this paints it, runs the tap, and
   draws the soft ring on the exact button the first-session guide wants.

   Nothing here touches the DOM at import time (node tests load ui modules). */

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clock = ms => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

let S = null, refresh = () => {}, lastKey = '', ringEls = [], ringFrame = 0;
const providers = [];

// The retention module calls this once with a function (state, now) => extra[].
// Each extra is { id, label, hint, tab, priority }; see engine/nextstep.js.
export function registerNextStepExtras(provider) {
  if (typeof provider !== 'function') return () => {};
  providers.push(provider);
  lastKey = '';
  return () => { const i = providers.indexOf(provider); if (i >= 0) providers.splice(i, 1); lastKey = ''; };
}
function collectExtras(state, now) {
  const out = [];
  for (const provider of providers) {
    try { const list = provider(state, now); if (Array.isArray(list)) out.push(...list); } catch { /* a broken provider must not break the shelf */ }
  }
  return out;
}

// What the alarm strip above the shelf is already saying, so the card does not say it again.
export function stripCovers(state, now = Date.now()) {
  if (!state.pets.length) return [];
  if (omenPending(state, now)) return ['omen'];
  return mayhemState(state).queue.length ? ['emergency'] : [];
}

const REWARD_LINES = {
  meet: name => 'Introductions made. ' + name + ' has noted your tone.',
  feed: name => 'Fed. ' + name + ' is chewing like a witness.',
  emergency: () => 'First emergency survived. The paperwork has started.',
  omen: () => 'The omen is read. It did not look pleased.',
  note: () => 'Notes read. You were mentioned.',
  coffin: () => 'First coffin opened. The knocking continues.'
};

function celebrate(kind, anchor) {
  const fx = globalThis.ShelfFx;
  try { if (fx && typeof fx.burst === 'function') fx.burst(anchor || document.body, { kind, source: 'onboarding' }); } catch { /* the visuals module is optional */ }
  const target = anchor || $('soulsHud');
  if (!target) return;
  target.classList.remove('guide-pop');
  void target.offsetWidth;
  target.classList.add('guide-pop');
  setTimeout(() => target.classList.remove('guide-pop'), 1400);
}

function announce(state, progress) {
  const name = state.pets[0]?.name || 'Your resident';
  progress.steps.forEach(({ id, souls }) => {
    const line = (REWARD_LINES[id] || (() => 'Done.'))(name);
    toast(line + (souls ? ' +' + souls + ' souls.' : ''));
  });
  if (progress.steps.some(step => step.id === 'coffin')) celebrate('coffin', $('soulsHud'));
}

/* ---------------- the card ---------------- */

function dotsHTML(view) {
  return '<span class="ns-dots" role="img" aria-label="Step ' + Math.min(view.total, view.count + 1) + ' of ' + view.total + '">' +
    Array.from({ length: view.total }, (_, i) => '<i class="' + (i < view.count ? 'done' : i === view.count ? 'now' : '') + '"></i>').join('') + '</span>';
}

function cardMarkup(step, state, now) {
  const kind = step.kind;
  const attrs = step.action?.type === 'dom' ? Object.entries(step.action.attrs).map(([k, v]) => ' ' + k + '="' + esc(v) + '"').join('') : '';
  let kicker = 'Do this next', dots = '', extra = '';
  if (kind === 'guide') {
    const view = guideView(state);
    kicker = 'First day';
    dots = dotsHTML(view);
    extra = '<button class="ns-skip" type="button" data-ns-skip>Skip the tour</button>';
  } else if (kind === 'guide-done') {
    kicker = 'Tour finished';
  }
  return '<div class="ns-main"><span class="ns-kicker">' + kicker + dots + '</span>' +
    '<h2 class="ns-title" id="nextStepTitle">' + esc(step.label) + '</h2>' +
    (step.hint ? '<p class="ns-hint">' + esc(step.hint) + '</p>' : '') + '</div>' +
    '<div class="ns-actions"><button class="btn btn-primary ns-go" id="nextStepGo" type="button" data-ns-go' + attrs + '>' + esc(step.verb) + '</button>' + extra + '</div>';
}

// A finished tour gets one card of its own, with the reason to come back.
function doneStep(state, now) {
  const wait = nextEmergencyIn(state, now);
  return { id: 'guide-done', kind: 'guide-done', label: 'That is the tour.', hint: 'Care, trouble, souls, coffins. The next disaster is due in ' + clock(wait) + '. The desk grows over the next two days.',
    verb: 'On with it', tab: 'shelf', priority: 1000, action: { type: 'done' } };
}

export function renderNextStep(state, now = Date.now()) {
  S = state;
  const host = $('nextStep');
  if (!host) return;
  if (!state.pets.length) { host.hidden = true; document.body.dataset.guide = ''; lastKey = ''; return; }
  ensureGuide(state, now);
  const progress = advanceGuide(state, now);
  if (progress) announce(state, progress);
  const guide = guideOf(state);
  document.body.dataset.guide = guide?.status === 'on' ? 'on' : '';
  const covered = stripCovers(state, now);
  const all = nextSteps(state, now, collectExtras(state, now));
  let step;
  if (guide?.status === 'done' && !guide.celebrated) step = doneStep(state, now);
  else step = all.find(item => item.kind === 'guide') || all.find(item => !covered.includes(item.kind)) || all[0];
  if (!step) { host.hidden = true; return; }
  host.hidden = false;
  host.dataset.kind = step.kind;
  host.dataset.step = step.id;
  const markup = cardMarkup(step, state, now);
  const key = step.id + '|' + markup;
  if (key !== lastKey) {
    lastKey = key;
    const hadFocus = host.contains(document.activeElement) ? document.activeElement.id || (document.activeElement.hasAttribute('data-ns-skip') ? 'skip' : '') : '';
    host.innerHTML = markup;
    host.__step = step;
    if (hadFocus === 'nextStepGo') $('nextStepGo')?.focus({ preventScroll: true });
    else if (hadFocus === 'skip') host.querySelector('[data-ns-skip]')?.focus({ preventScroll: true });
  } else host.__step = step;
  scheduleRing();
}

/* ---------------- doing the step ---------------- */

function fire(name, detail = {}) { window.dispatchEvent(new CustomEvent(name, { detail })); }

function perform(step) {
  const action = step.action || {};
  switch (action.type) {
    case 'guide': {
      const petId = S.pets[0]?.id;
      if (action.step === 'meet' || action.step === 'feed') fire('shelflife:care', { petId });
      else if (action.step === 'note') fire('shelflife:goto', { tab: 'notes' });
      else fire('shelflife:mayhem', { open: action.step === 'coffin' ? 'coffin' : action.step });
      break;
    }
    case 'mh': fire('shelflife:mayhem', { open: action.mh }); break;
    case 'care': fire('shelflife:care', { petId: action.petId }); break;
    case 'click': document.querySelector(action.selector)?.click(); break;
    case 'goto': fire('shelflife:goto', { tab: action.tab, target: action.target }); break;
    case 'event': fire(action.name, action.detail || {}); break;
    case 'done': if (celebrateGuide(S)) { save(); refresh(); } break;
    default: break; // 'dom' steps carry their own data attributes; the owning module hears the click
  }
}

/* ---------------- the ring on the exact button ---------------- */

const visible = el => !!el && el.isConnected && el.getClientRects().length > 0 && !el.closest('[hidden],[inert]');
const first = selector => [...document.querySelectorAll(selector)].find(visible) || null;

function ringTargets() {
  if (!S || !guideActive(S)) return [];
  const view = guideView(S), step = view?.step;
  if (!step) return [];
  const go = first('#nextStepGo');
  const one = el => (el ? [el] : []);
  switch (step.id) {
    case 'meet': return one(first('#cabinet .pet[data-id="' + CSS.escape(step.petId) + '"]') || go);
    case 'feed': return one(first('#cardSheet [data-care="food"]:not([disabled])') || first('#cardSheet [data-care]:not([disabled])') || go);
    // Every choice pays, so the ring does not recommend one over the other.
    case 'emergency': { const choices = [...document.querySelectorAll('#mayhemSheet .mh-choice')].filter(visible); return choices.length ? choices : one(go); }
    case 'omen': return one(first('#mayhemSheet [data-mh="flip"]') || go);
    case 'note': return one(document.body.dataset.tab === 'notes' ? first('#checkBtn:not([disabled])') : first('.tabbar .tab[data-tab="notes"]') || go);
    case 'coffin': return one(first('#mayhemSheet [data-mh="pry"]:not([disabled])') || go);
    default: return one(go);
  }
}
function syncRing() {
  ringFrame = 0;
  const next = ringTargets();
  if (next.length === ringEls.length && next.every((el, i) => el === ringEls[i])) return;
  ringEls.forEach(el => el.classList.remove('guide-ring'));
  ringEls = next;
  ringEls.forEach(el => el.classList.add('guide-ring'));
}
function scheduleRing() {
  if (ringFrame) return;
  ringFrame = requestAnimationFrame(syncRing);
}

/* ---------------- wiring ---------------- */

function watchScreen() {
  const poke = () => {
    if (!S || !guideActive(S)) { scheduleRing(); return; }
    let changed = false;
    if ($('cardVeil')?.classList.contains('open') && $('cardSheet')?.querySelector('[data-care]')) changed = markGuideSeen(S, 'meet') || changed;
    if (document.body.dataset.tab === 'notes') changed = markGuideSeen(S, 'note') || changed;
    if (changed) { save(); refresh(); } else scheduleRing();
  };
  const watch = (el, options) => { if (el) new MutationObserver(poke).observe(el, options); };
  watch(document.body, { attributes: true, attributeFilter: ['data-tab', 'data-active-dialog'] });
  watch($('cardSheet'), { childList: true });
  watch($('mayhemSheet'), { childList: true });
  watch($('cardVeil'), { attributes: true, attributeFilter: ['class'] });
  watch($('mayhemVeil'), { attributes: true, attributeFilter: ['class'] });
  poke();
}

export function initNextStep(state, onRefresh) {
  S = state;
  refresh = onRefresh || refresh;
  const host = $('nextStep');
  host?.addEventListener('click', event => {
    if (event.target.closest('[data-ns-skip]')) {
      if (skipGuide(S)) { save(); toast('Tour skipped. Help brings it back if you change your mind.'); refresh(); }
      return;
    }
    if (event.target.closest('[data-ns-go]') && host.__step) perform(host.__step);
  });
  window.addEventListener('shelflife:guide-resumed', () => { lastKey = ''; save(); refresh(); });
  watchScreen();
}
