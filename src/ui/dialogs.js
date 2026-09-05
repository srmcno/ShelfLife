// One focus boundary for every sheet, including the responsive More drawer.
export function initDialogs() {
  const panels = [...document.querySelectorAll('.veil'), document.getElementById('moreTray')];
  let active = null, returnTo = null, returnPet = null;
  let locked = [];
  const focusable = panel => [...panel.querySelectorAll('button, input, select, a[href], [tabindex]')]
    .filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
  const release = () => { locked.forEach(el => { el.inert = false; }); locked = []; };
  function sync() {
    const next = panels.find(el => el.classList.contains('open') && el.id !== 'moreTray') ||
      panels.find(el => el.classList.contains('open')) || null;
    if (next === active) return;
    release();
    if (!next) {
      active = null;
      document.body.style.overflow = '';
      if (returnPet) returnTo = [...document.querySelectorAll('#cabinet .piece')].find(el => el.dataset.id === returnPet) || returnTo;
      const target = returnTo?.isConnected && returnTo.getClientRects().length ? returnTo : document.getElementById('newPetBtn');
      target?.focus({ preventScroll: true });
      return;
    }
    if (!active) {
      returnTo = document.activeElement;
      returnPet = returnTo?.closest('.piece')?.dataset.id;
      if (returnTo?.closest('#moreTray')) returnTo = document.getElementById('moreBtn');
    }
    active = next;
    let branch = next;
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && sibling.id !== 'toast' && !sibling.inert && !['SCRIPT', 'STYLE'].includes(sibling.tagName)) {
          sibling.inert = true;
          locked.push(sibling);
        }
      }
      if (branch.parentElement === document.body) break;
      branch = branch.parentElement;
    }
    document.body.style.overflow = 'hidden';
    const title = next.querySelector('h2');
    if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
    else focusable(next)[0]?.focus();
  }
  panels.forEach(panel => {
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', ({ studioVeil: 'Make a pet', cardVeil: 'Resident details', decorVeil: 'Decorate', voiceVeil: 'Narrator voice', incidentsVeil: 'Incidents', helpVeil: 'A small field guide', restoreVeil: 'Restore a shelf', moreTray: 'Everything else' })[panel.id]);
    new MutationObserver(sync).observe(panel, { attributes: true, attributeFilter: ['class'] });
  });
  document.addEventListener('keydown', e => {
    if (!active || e.key !== 'Tab') return;
    const items = focusable(active), first = items[0], last = items.at(-1);
    if (!first) { e.preventDefault(); return; }
    if (!items.includes(document.activeElement)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}
