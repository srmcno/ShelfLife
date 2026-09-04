// Phone chrome: the "More" tray and the back-to-the-shelf return.
//
// Design note. None of this MOVES a node. The toolbar's eleven buttons live in
// two wrappers in index.html and are relocated purely by CSS — `display:contents`
// on a desktop (so the flat row is untouched), a fixed dock plus a bottom sheet
// on a phone. Other modules query every one of those buttons by id, so the ids,
// the nodes and their listeners all have to survive; the only thing this module
// does is toggle classes.
//
// Everything here no-ops above the phone breakpoint, and unwinds itself if the
// window is resized past it (rotating a phone into landscape, mostly).

const PHONE = window.matchMedia('(max-width:640px)');

const tray = document.getElementById('moreTray');
const moreBtn = document.getElementById('moreBtn');
const scrim = document.getElementById('trayScrim');
const wrap = document.getElementById('cabinetWrap');
const toShelf = document.getElementById('toShelfBtn');

// ---------------------------------------------------------------------------
// The "More" tray
// ---------------------------------------------------------------------------

let trayOpen = false;

function setTray(open) {
  if (!tray || !moreBtn) return;
  trayOpen = open;
  tray.classList.toggle('open', open);
  moreBtn.setAttribute('aria-expanded', String(open));
  if (scrim) scrim.hidden = !open;
  // A veil (card, studio, decor) sets this too. The tray always closes BEFORE a
  // veil opens — see the capture-phase listener below — so the veil's own
  // `hidden` lands after this restore rather than being wiped by it.
  document.body.style.overflow = open ? 'hidden' : '';
}

// COUPLING, DELIBERATE AND EASY TO MISS: this listener is NOT width-gated, and
// css/style.css relies on that. The art-direction pass gives the desktop the
// same disclosure — three verbs and a More — and renders .tb-rest as a drawer
// under the toolbar at >=641px. That drawer is opened by exactly this click and
// dimmed by the same #trayScrim. Gate this on PHONE.matches and eight settings
// become unreachable on a desktop with no visible error.
if (moreBtn) {
  moreBtn.addEventListener('click', () => setTray(!trayOpen));
}
if (scrim) {
  scrim.addEventListener('click', () => setTray(false));
}
if (tray) {
  // Capture phase, so the tray is already shut (and the scroll lock already
  // released) by the time Decorate/Incidents/Voice open their own veil.
  tray.addEventListener('click', e => {
    if (!trayOpen) return;
    if (e.target.closest('button')) setTray(false);
  }, true);
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && trayOpen) setTray(false);
});

// ---------------------------------------------------------------------------
// Back to the shelf
// ---------------------------------------------------------------------------
// The notes wall is long. Once it has scrolled the shelf off the top there was
// no way back to the creatures except a lot of thumb.

let pending = false;

function syncReturn() {
  pending = false;
  if (!toShelf || !wrap) return;
  if (!PHONE.matches) { toShelf.hidden = true; return; }
  toShelf.hidden = wrap.getBoundingClientRect().bottom > 56;
}

if (toShelf && wrap) {
  toShelf.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toShelf.hidden = true;
  });
  window.addEventListener('scroll', () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(syncReturn);
  }, { passive: true });
  syncReturn();
}

// Rotating into landscape crosses the breakpoint: the dock and the tray stop
// existing as fixed furniture, so anything left open would be stranded.
function onBreakpoint() {
  if (!PHONE.matches && trayOpen) setTray(false);
  syncReturn();
}
if (PHONE.addEventListener) PHONE.addEventListener('change', onBreakpoint);
else if (PHONE.addListener) PHONE.addListener(onBreakpoint);
