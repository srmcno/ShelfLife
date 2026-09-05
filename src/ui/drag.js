// Shelf drag-and-drop: pointer-event handlers delegated from #cabinet.
//
// Two gestures, because a mouse and a finger do not mean the same thing.
//
// A MOUSE can start a drag the instant it moves: nothing else on a desktop
// wants that gesture, so the original 7px threshold stands.
//
// A FINGER cannot. On a phone a swipe over the shelf means "scroll the page",
// and creatures cover most of the screen. The old code claimed every touch on a
// pet via `touch-action:none`, which made the page un-scrollable anywhere a pet
// stood — and on a phone that is most places.
//
// So touch gets the home-screen contract instead: press and hold to pick up.
// Until the hold completes the browser owns the gesture and pans normally; the
// moment it completes, this module takes it back by preventing the touchmove
// itself (touch-action is latched at touchstart and cannot be tightened
// mid-gesture, so preventDefault is the only lever). Any real movement before
// the hold completes is a scroll, and the candidate drag is dropped on the spot.
import { petById, save } from '../state.js';
import { renderAll } from './render.js';
import { openCard, openPropCard } from './card.js';

const HOLD_MS = 300;      // press-and-hold before a touch becomes a pick-up
const SCROLL_TOL = 10;    // movement during the hold that means "you meant to scroll"
const MOVE_MIN = 7;       // movement after pick-up that means "you meant to move it"
const EDGE = 56;          // auto-scroll zone at each end of the run / the screen
const EDGE_MAX = 16;      // px per frame at the very edge

export function initDrag(state) {
  const cabinet = document.getElementById('cabinet');
  cabinet.addEventListener('click', e => {
    if (e.detail !== 0) return;
    const piece = e.target.closest('.piece');
    if (!piece) return;
    if (piece.dataset.kind === 'pet') openCard(state, piece.dataset.id);
    else openPropCard(state, piece.dataset.id);
  });
  let drag = null;
  let raf = 0, vx = 0, vy = 0;

  // ---- auto-scroll ---------------------------------------------------------
  // Carrying a creature to a row that is off the bottom of the screen would
  // otherwise be impossible, because a drag in progress deliberately stops the
  // page scrolling. Holding it near an edge walks the page (or, if the cabinet
  // ever does overflow horizontally, the run) toward the drop.

  function stopScrolling() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0; vx = 0; vy = 0;
  }

  function step() {
    raf = 0;
    if (!drag || !drag.engaged) return;
    if (vx) cabinet.scrollLeft += vx;
    if (vy) window.scrollBy(0, vy);
    if (vx || vy) raf = requestAnimationFrame(step);
  }

  function aim(x, y) {
    vx = 0; vy = 0;
    const r = cabinet.getBoundingClientRect();
    if (cabinet.scrollWidth - cabinet.clientWidth > 2) {
      if (x < r.left + EDGE) vx = -Math.min(EDGE_MAX, (r.left + EDGE - x) / 3);
      else if (x > r.right - EDGE) vx = Math.min(EDGE_MAX, (x - (r.right - EDGE)) / 3);
    }
    // Only when there is actually cabinet off-screen to reach for.
    if (r.top < 0 || r.bottom > window.innerHeight) {
      if (y < EDGE) vy = -Math.min(EDGE_MAX, (EDGE - y) / 3);
      else if (y > window.innerHeight - EDGE) vy = Math.min(EDGE_MAX, (y - (window.innerHeight - EDGE)) / 3);
    }
    if ((vx || vy) && !raf) raf = requestAnimationFrame(step);
  }

  // ---- picking a creature up ----------------------------------------------

  function lift(d) {
    d.engaged = true;
    d.el.classList.add('dragging');
    const g = document.createElement('div');
    g.className = 'ghost';
    // Clone what is actually standing in the slot rather than rebuilding it from
    // pet.art.body: a generated (vector) creature has no raster body at all and
    // used to lift as a broken image. The clone keeps its limbs moving, too.
    const art = d.el.querySelector('.sprite, svg');
    if (art) {
      g.appendChild(art.cloneNode(true));
    } else if (d.kind === 'pet') {
      const pet = petById(state, d.id);
      const img = document.createElement('img');
      img.src = (pet && pet.art && pet.art.body) || '';
      g.appendChild(img);
    }
    g.style.left = d.x + 'px';
    g.style.top = d.y + 'px';
    document.body.appendChild(g);
    d.ghost = g;
    // "Did it move" is measured from the lift, not from the press, so a finger
    // that drifted a few pixels while holding still does not count as a move.
    d.startX = d.x; d.startY = d.y;
  }

  function clear(d) {
    if (d.hold) clearTimeout(d.hold);
    if (d.ghost) d.ghost.remove();
    d.el.classList.remove('dragging');
    document.querySelectorAll('.slot.drop-target').forEach(s => s.classList.remove('drop-target'));
    stopScrolling();
  }

  cabinet.addEventListener('pointerdown', e => {
    const piece = e.target.closest('.piece');
    if (!piece || drag || e.button !== 0) return;
    const d = {
      id: piece.dataset.id, kind: piece.dataset.kind,
      el: piece, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY,
      touch: e.pointerType === 'touch', engaged: false, movedFar: false, ghost: null, hold: 0
    };
    drag = d;
    if (d.touch) d.hold = setTimeout(() => { d.hold = 0; if (drag === d) lift(d); }, HOLD_MS);
    // Last, and guarded: capture throws NotFoundError if the pointer is already
    // gone, and losing the hold timer to that would leave a finger that can
    // never pick anything up.
    try { piece.setPointerCapture(e.pointerId); } catch (err) { /* pointer already released */ }
  });

  cabinet.addEventListener('pointermove', e => {
    if (!drag) return;
    drag.x = e.clientX; drag.y = e.clientY;
    if (!drag.engaged) {
      const travel = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
      if (drag.hold) {
        // Still deciding. Movement now means the finger is panning, not lifting:
        // hand the gesture back to the browser and forget this one entirely, so
        // the pointerup at the end of a scroll cannot open a card either.
        if (travel > SCROLL_TOL) { clearTimeout(drag.hold); drag = null; }
        return;
      }
      if (drag.touch) return;            // a touch whose hold never completed
      if (travel < MOVE_MIN) return;
      lift(drag);
    }
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) >= MOVE_MIN) drag.movedFar = true;
    drag.ghost.style.left = e.clientX + 'px';
    drag.ghost.style.top = e.clientY + 'px';
    document.querySelectorAll('.slot.drop-target').forEach(s => s.classList.remove('drop-target'));
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const slot = under && under.closest ? under.closest('.slot') : null;
    if (slot) slot.classList.add('drop-target');
    aim(e.clientX, e.clientY);
  });

  // touch-action is latched when the finger lands, so it cannot be tightened
  // once a hold completes — preventing the touchmove is the only way to stop the
  // page and the shelf panning underneath a creature being carried. Nothing has
  // been scrolled yet at that point (the hold requires a stationary finger), so
  // the browser still honours it.
  cabinet.addEventListener('touchmove', e => {
    if (drag && drag.engaged) e.preventDefault();
  }, { passive: false });

  // A long press otherwise raises the selection/context menu on top of the
  // creature you are trying to pick up.
  cabinet.addEventListener('contextmenu', e => {
    if (e.target.closest && e.target.closest('.piece')) e.preventDefault();
  });

  cabinet.addEventListener('pointerup', e => {
    if (!drag) return;
    const d = drag;
    drag = null;
    clear(d);
    // A tap opens the card — and so does a pick-up put straight back down, since
    // a slow tapper trips the 300ms hold without ever meaning to move anything
    // and "nothing happened" is the wrong answer for them.
    if (!d.movedFar) {
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
    if (!drag) return;
    const d = drag;
    drag = null;
    clear(d);
  });
}
