// Game shortcuts never borrow keystrokes from editing, browser commands, or a
// control that already handled the event.
export function acceptsGameShortcut(event) {
  return !event.defaultPrevented && !event.altKey && !event.ctrlKey && !event.metaKey &&
    !event.target?.isContentEditable && !event.target?.closest?.('input,select,textarea,[contenteditable]:not([contenteditable="false"])');
}

export function chaseSettingsLocked(phase) {
  return !['setup', 'result'].includes(phase);
}

export function chaseKeyAction(event, { running, paused, visible = true }) {
  if (!visible || !acceptsGameShortcut(event)) return null;
  const key = String(event.key).toLowerCase();
  // Native Space/Enter activation belongs to the focused button, including
  // Hop, Resume and Restart. It must not also become a game action.
  if ([' ', 'enter'].includes(key) && event.target?.closest?.('button')) return null;
  if (key === 'p' && !event.repeat && (running || paused)) return paused ? 'resume' : 'pause';
  if (!running) return null;
  if (event.repeat && [' ', 'arrowup', 'w', 'x'].includes(key)) return 'suppress';
  if (['arrowleft', 'a'].includes(key)) return 'left';
  if (['arrowright', 'd'].includes(key)) return 'right';
  if ([' ', 'arrowup', 'w'].includes(key)) return 'hop';
  if (key === 'x') return 'dash';
  return null;
}
