// Shelf drag-and-drop: pointer-event handlers delegated from #cabinet.
// Wraps the original prototype's module-level `drag` variable and its four
// cabinet pointer listeners inside one init function so main.js can wire it
// up once at boot with the live state.
import { petById, propById, save } from '../state.js';
import { PROP_ART } from '../content/props.js';
import { renderAll } from './render.js';
import { openCard, openPropCard } from './card.js';

export function initDrag(state) {
  const cabinet = document.getElementById('cabinet');
  let drag = null;

  cabinet.addEventListener('pointerdown', e => {
    const piece = e.target.closest('.piece');
    if (!piece) return;
    drag = { id: piece.dataset.id, kind: piece.dataset.kind, from: Number(piece.dataset.slot), el: piece, startX: e.clientX, startY: e.clientY, moved: false, ghost: null };
    piece.setPointerCapture(e.pointerId);
  });

  cabinet.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 7) return;
    if (!drag.moved) {
      drag.moved = true;
      drag.el.classList.add('dragging');
      let g;
      if (drag.kind === 'pet') {
        g = document.createElement('img');
        g.src = petById(state, drag.id).art.body;
      } else {
        g = document.createElement('div');
        g.innerHTML = PROP_ART[propById(state, drag.id).kind];
      }
      g.className = 'ghost';
      document.body.appendChild(g);
      drag.ghost = g;
    }
    drag.ghost.style.left = e.clientX + 'px';
    drag.ghost.style.top = e.clientY + 'px';
    document.querySelectorAll('.slot.drop-target').forEach(s => s.classList.remove('drop-target'));
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const slot = under && under.closest ? under.closest('.slot') : null;
    if (slot) slot.classList.add('drop-target');
  });

  cabinet.addEventListener('pointerup', e => {
    if (!drag) return;
    const d = drag;
    drag = null;
    document.querySelectorAll('.slot.drop-target').forEach(s => s.classList.remove('drop-target'));
    if (d.ghost) d.ghost.remove();
    d.el.classList.remove('dragging');
    if (!d.moved) {
      if (d.kind === 'pet') openCard(state, d.id);
      else openPropCard(state, d.id);
      return;
    }
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const slot = under && under.closest ? under.closest('.slot') : null;
    if (!slot) return;
    const to = Number(slot.dataset.slot);
    // Re-derive the source slot at drop time instead of trusting the index
    // captured at pointerdown. Pets relocate themselves on a 30s timer
    // (runBehavior, grudge escalation, prop hoarding), so during a slow drag the
    // captured index can go stale — and blindly writing to it erased whichever
    // pet had moved into the old slot, leaving one pet duplicated in two slots
    // and another gone entirely. normalizeState cannot repair that, because it
    // only rebuilds slots when the array length is wrong.
    const from = state.slots.indexOf(d.id);
    if (from === -1) return;   // it was removed mid-drag; drop is void
    if (to === from) return;
    const tmp = state.slots[to];
    state.slots[to] = d.id;
    state.slots[from] = tmp;
    save();
    renderAll(state);
  });

  cabinet.addEventListener('pointercancel', () => {
    if (drag && drag.ghost) drag.ghost.remove();
    if (drag) drag.el.classList.remove('dragging');
    drag = null;
  });
}
