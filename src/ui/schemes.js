import { currentScheme, schemeState, resolveScheme, SCHEME_WAIT, SCHEME_DEADLINE } from '../engine/schemes.js';
import { save } from '../state.js';
import { checkUnlocks } from '../engine/unlocks.js';
import { checkAchievements } from '../engine/achievements.js';
import { reactTo } from '../art/animator.js';
import { toast } from './toast.js';
import { renderPetSprite } from '../art/sprite.js';

const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clock = ms => Math.max(0, Math.ceil(ms / 60000)) + ' min';
const labels = { food: 'Food', fuss: 'Attention', clean: 'Cleanliness' };
export function renderScheme(state) {
  const host = document.getElementById('schemeCard');
  if (!host) return;
  const focused = host.contains(document.activeElement) ? document.activeElement.dataset.schemeChoice : null;
  const plan = currentScheme(state), history = schemeState(state);
  if (!plan) {
    const cooling = history.lastAt && Date.now() - history.lastAt < SCHEME_WAIT;
    const aftermath = cooling && typeof history.lastResult?.text === 'string';
    host.innerHTML = '<span class="eyebrow">Small conspiracies</span><h2>' + (aftermath ? 'The aftermath.' : state.pets.length ? 'Suspiciously quiet.' : 'Trouble needs a tenant.') + '</h2><p>' +
      (aftermath ? esc(history.lastResult.text) : cooling ? 'They are lying low.' : state.pets.length ? 'The residents are resting. Schemes resume when someone is awake.' : 'Make a creature. Before long, it will have an idea you should probably supervise.') + '</p>' +
      (cooling ? '<p class="scheme-clock">Another questionable idea in about ' + clock(history.lastAt + SCHEME_WAIT - Date.now()) + '.</p>' : '') +
      '<div class="scheme-tally">' + history.completed + (history.completed === 1 ? ' incident survived' : ' incidents survived') + '</div>';
    return;
  }
  const effects = choice => Object.entries(choice.changes).map(([k, n]) => labels[k] + ' ' + (n > 0 ? '+' : '−') + Math.abs(n)).concat('Trust +' + choice.bond).join(' · ');
  host.innerHTML = '<div class="scheme-heading"><span class="eyebrow">Small conspiracies</span><span class="live-dot">In progress</span></div><div class="scheme-portrait" aria-hidden="true"></div><h2>' + esc(plan.definition.title) + '</h2>' +
    '<p>' + esc(plan.definition.intro.replaceAll('{p}', plan.pet.name)) + '</p><div class="scheme-choices">' +
    plan.definition.choices.map((choice, i) => '<button class="scheme-choice" data-scheme-choice="' + i + '"><span>' + esc(choice.label) + '</span><small>' + effects(choice) + '</small></button>').join('') +
    '</div><button class="scheme-alone" title="They will amuse themselves at the cost of some food and cleanliness. No trust reward." data-scheme-choice="alone">Leave them to it</button><p class="scheme-clock">They will act without you in about ' + clock(plan.at + SCHEME_DEADLINE - Date.now()) + '.</p>';
  // The culprit, in a small frame, so the card reads as a wanted poster.
  const frame = host.querySelector('.scheme-portrait');
  if (frame) { const sprite = renderPetSprite(plan.pet); sprite.classList.add('sl-mood-fine', 'sl-plotting'); frame.appendChild(sprite); }
  if (focused != null) host.querySelector('[data-scheme-choice="' + focused + '"]')?.focus({ preventScroll: true });
}
export function initSchemeUI(state, refresh) {
  document.getElementById('schemeCard').addEventListener('click', e => {
    const button = e.target.closest('[data-scheme-choice]');
    if (!button) return;
    const choice = button.dataset.schemeChoice;
    const result = resolveScheme(state, choice === 'alone' ? choice : Number(choice));
    if (!result) return;
    if (navigator.vibrate) navigator.vibrate(12);
    checkUnlocks(state);
    checkAchievements(state);
    save();
    refresh();
    reactTo(result.petId, choice === 'alone' ? 'rounds' : 'fuss');
    toast(result.text);
    document.getElementById('schemeCard').focus({ preventScroll: true });
  });
}
