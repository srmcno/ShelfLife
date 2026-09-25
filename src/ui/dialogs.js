// One focus boundary for every sheet, including the responsive More drawer.
export function initDialogs({ onOpen } = {}) {
  const panels = [...document.querySelectorAll('.veil'), document.getElementById('moreTray')].filter(Boolean);
  let active = null, returnTo = null, returnPet = null, returnId = null, pendingTrigger = null;
  let triggerGeneration = 0;
  let locked = [];
  const controls = 'button, input, select, textarea, summary, a[href], [tabindex]';
  function usable(el) {
    if (!el?.isConnected || el.disabled || el.closest('[hidden],[inert]') || !el.getClientRects().length) return false;
    // Some browsers retain layout rectangles for collapsed details content.
    // Only the first summary (and controls inside it) survives that boundary.
    for (let ancestor = el.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.tagName !== 'DETAILS' || ancestor.open) continue;
      const summary = [...ancestor.children].find(child => child.tagName === 'SUMMARY');
      if (!summary?.contains(el)) return false;
    }
    return true;
  }
  const focusable = panel => [...panel.querySelectorAll(controls)].filter(el => usable(el) && el.tabIndex >= 0);
  // A pointer click need not focus a button (notably in Safari). Remember the
  // real opener before a proxy calls a hidden More action programmatically.
  document.addEventListener('click', e => {
    if (!e.isTrusted) return;
    pendingTrigger = e.target.closest?.(controls) || null;
    const generation = ++triggerGeneration;
    // WebKit can drain microtasks between capture and target listeners. Keep
    // the trusted opener until this event task finishes, after the target has
    // opened the dialog and its MutationObserver has captured the return path.
    setTimeout(() => {
      if (generation === triggerGeneration) pendingTrigger = null;
    }, 0);
  }, true);
  const release = () => { locked.forEach(el => { el.inert = false; }); locked = []; };
  function restoreFocus() {
    const resident = returnPet && [...document.querySelectorAll('#cabinet .piece')].find(el => el.dataset.id === returnPet);
    const replacement = returnId && document.getElementById(returnId);
    const more = returnId === 'moreBtn' || returnId === 'tabMore';
    const candidates = [resident, replacement, returnTo,
      ...(more ? [document.getElementById('tabMore'), document.getElementById('moreBtn')] : []),
      document.getElementById('newPetBtn'), document.querySelector('.tab[aria-current="page"]')];
    const target = candidates.find(el => usable(el) && el !== document.body && !el.closest('.veil,#moreTray'));
    target?.focus({ preventScroll: true });
    returnTo = returnPet = returnId = null;
  }
  function sync() {
    const next = panels.find(el => el.classList.contains('open') && el.id !== 'moreTray') ||
      panels.find(el => el.classList.contains('open')) || null;
    if (next === active) return;
    // Shelf remarks belong to the previous screen. Fresh messages produced
    // inside the active sheet remain visible through its ordinary redraws.
    if (next) onOpen?.();
    release();
    document.body.classList.toggle('dialog-open', !!next);
    document.body.dataset.activeDialog = next?.id || '';
    if (!next) {
      active = null;
      document.body.style.overflow = '';
      restoreFocus();
      return;
    }
    if (!active) {
      returnTo = pendingTrigger || document.activeElement;
      returnPet = returnTo?.closest('.piece')?.dataset.id;
      if (returnTo?.closest('#moreTray')) returnTo = [document.getElementById('tabMore'), document.getElementById('moreBtn')].find(usable);
      returnId = returnTo?.id || null;
    }
    active = next;
    let branch = next;
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && sibling.id !== 'toast' && sibling.id !== 'trayScrim' && !sibling.inert && !['SCRIPT', 'STYLE'].includes(sibling.tagName)) {
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
    if (panel.id === 'hangoutVeil') panel.setAttribute('aria-labelledby', 'rugTitle');
    panel.setAttribute('aria-label', ({ escapadeVeil: 'Little adventures', playroomVeil: 'The playroom', lifeVeil: 'Your small world', museumVeil: 'Memory museum', playVeil: 'Play together', studioVeil: 'Make a pet', cardVeil: 'Resident details', decorVeil: 'Decorate', voiceVeil: 'Narrator voice', incidentsVeil: 'Incidents', mayhemVeil: 'Emergencies and curios', arcadeVeil: 'The arcade', courtVeil: 'Shelf Court', helpVeil: 'A small field guide', restoreVeil: 'Restore a shelf', transferVeil: 'Email or share your shelf', postcardVeil: 'A postcard', moreTray: 'Everything else' })[panel.id] || 'Dialog');
    new MutationObserver(sync).observe(panel, { attributes: true, attributeFilter: ['class'] });
  });
  document.addEventListener('keydown', e => {
    if (!active) return;
    if (e.key === 'Escape') {
      // Target-level controls (such as inline renaming) handle Escape first.
      // Native selects and IME composition keep their own dismissal behaviour.
      // Only this active sheet's owner may run cleanup; hidden game listeners
      // must not reset games when Escape closes a different dialog.
      e.stopImmediatePropagation();
      if (e.defaultPrevented || e.isComposing || e.repeat || e.target.closest?.('select,[aria-expanded="true"][role="combobox"]')) return;
      const close = active.id === 'moreTray' ? document.getElementById('moreClose') :
        active.id === 'restoreVeil' ? document.getElementById('restoreCancel') : active.querySelector('.sheet-head button');
      if (close && !close.disabled) { e.preventDefault(); close.click(); }
      return;
    }
    if (e.key !== 'Tab' || e.defaultPrevented || e.isComposing) return;
    const items = focusable(active), first = items[0], last = items.at(-1);
    if (!first) { e.preventDefault(); return; }
    if (!items.includes(document.activeElement)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}
