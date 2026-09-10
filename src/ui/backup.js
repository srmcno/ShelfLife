import { createBackup, backupEmail, shareBackup } from '../backup.js';

export function initBackupTransfer({ state, download, markBackup }) {
  const veil = document.getElementById('transferVeil');
  const share = document.getElementById('transferShare');
  const downloadButton = document.getElementById('transferDownload');
  const email = document.getElementById('transferEmail');
  const status = document.getElementById('transferStatus');
  const filename = document.getElementById('transferFilename');
  let busy = false;
  const close = () => veil.classList.remove('open');

  document.getElementById('transferBtn').addEventListener('click', () => {
    veil.classList.add('open');
  });
  document.getElementById('transferClose').addEventListener('click', close);
  veil.addEventListener('click', event => { if (event.target === veil) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });

  downloadButton.addEventListener('click', () => {
    try {
      const backup = createBackup(state);
      download(backup.text, backup.name);
      markBackup(backup.created);
      filename.textContent = backup.name;
      email.href = backupEmail(backup.name);
      email.hidden = false;
      status.textContent = 'Download requested. Once the file is saved, open an email draft and attach it yourself. If no email app opens, use your usual email website.';
    } catch {
      status.textContent = 'The download could not start. Try again before opening an email draft.';
    }
  });

  share.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    share.disabled = downloadButton.disabled = true;
    status.textContent = 'Choose your email app, another device, or Files in the share menu.';
    try {
      const backup = createBackup(state);
      const result = await shareBackup(backup);
      if (result === 'shared') {
        markBackup(backup.created);
        status.textContent = 'Backup handed to the share menu. Finish saving or sending it in the app you chose; Shelf Life cannot confirm delivery.';
      } else if (result === 'cancelled') {
        status.textContent = 'Sharing cancelled or no receiving app was available. You can try again or download a copy below.';
      } else {
        status.textContent = 'File sharing is unavailable here. Download a copy below, then attach it to an email to yourself.';
      }
    } catch {
      status.textContent = 'The backup could not be prepared. Try downloading a copy below.';
    } finally {
      busy = false;
      share.disabled = downloadButton.disabled = false;
    }
  });
}
