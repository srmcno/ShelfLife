// Backups remain ordinary JSON, including when a share target needs .txt.
export const PLAY_URL = 'https://srmcno.github.io/ShelfLife/';

export function createBackup(state, now = Date.now()) {
  const stamp = new Date(now).toISOString().replace(/[:.]/g, '-');
  return {
    name: 'shelf-life-backup-' + stamp + '.json',
    text: JSON.stringify({ ...state, lastBackup: now }),
    created: now
  };
}

export function transferInstructions(name) {
  return 'My Shelf Life backup: ' + name + '\n\n' +
    'On the other device:\n1. Save the attached backup file. Keep its .json or .txt extension.\n' +
    '2. Open ' + PLAY_URL + '\n3. Choose More → Restore and select the saved file.\n' +
    '4. Check the preview before replacing the shelf. Back up any shelf already on that device first.\n\n' +
    'This is a snapshot, not automatic sync. To move back, send a new backup from the device you last played on.';
}

export function backupEmail(name) {
  // A mailto link cannot attach a local file. The UI asks the player to attach it.
  return 'mailto:?subject=' + encodeURIComponent('My Shelf Life backup') +
    '&body=' + encodeURIComponent('Attach ' + name + ' from Downloads or Files before sending this email to yourself.\n\n' + transferInstructions(name));
}

export function shareableBackup(backup, nav = globalThis.navigator, FileType = globalThis.File) {
  if (!nav?.share || !nav?.canShare || !FileType) return null;
  for (const [name, type] of [[backup.name, 'application/json'], [backup.name.replace(/\.json$/, '.txt'), 'text/plain']]) {
    const file = new FileType([backup.text], name, { type });
    try { if (nav.canShare({ files: [file] })) return file; } catch { /* Try the portable text form. */ }
  }
  return null;
}

// Called directly by the click handler, with no async work before nav.share.
export async function shareBackup(backup, nav = globalThis.navigator, FileType = globalThis.File) {
  const file = shareableBackup(backup, nav, FileType);
  if (!file) return 'unsupported';
  try {
    await nav.share({ files: [file], title: 'My Shelf Life backup', text: transferInstructions(file.name) });
    return 'shared';
  } catch (error) {
    return error?.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}
