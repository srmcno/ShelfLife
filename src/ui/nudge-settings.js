import { NUDGE_CATEGORY_LABELS, nudgesAvailable, syncNudges } from '../notify.js';
import { NUDGE_CATEGORIES, normalizeNudgeCats } from '../almanac-state.js';
import { save } from '../state.js';
import { esc, byId } from './retention-kit.js';

/* Per-category opt-out for the installed app's nudges (More, under Sound and motion).
   Four switches: emergencies, coming back, the Almanac and the weekly chest. They
   only show where nudges exist and are turned on. */
export function initNudgeSettings(state) {
  const box = byId('nudgeCats');
  if (!box) return { render() {} };
  function render() {
    box.hidden = !nudgesAvailable() || !state.settings.nudges;
    if (box.hidden) return;
    const cats = state.settings.nudgeCats = normalizeNudgeCats(state.settings.nudgeCats);
    box.innerHTML = '<span class="tray-sublabel">Which nudges</span>' + NUDGE_CATEGORIES.map(id => {
      const [label, line] = NUDGE_CATEGORY_LABELS[id];
      return '<button class="btn tray-item" type="button" data-nudge-cat="' + id + '" aria-pressed="' + (cats[id] !== false) + '"><span>' + esc(label) + '</span><small>' + esc(line) + '</small></button>';
    }).join('');
  }
  box.addEventListener('click', event => {
    const b = event.target.closest('[data-nudge-cat]');
    if (!b) return;
    const cats = state.settings.nudgeCats = normalizeNudgeCats(state.settings.nudgeCats);
    cats[b.dataset.nudgeCat] = cats[b.dataset.nudgeCat] === false;
    save(); render(); syncNudges(state);
  });
  window.addEventListener('shelflife:nudges', render);
  render();
  return { render };
}
