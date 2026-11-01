import { isNative } from '../native.js';

export function isAppleMobile(nav = navigator) {
  return /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
}

export function initInstall(win = window, doc = document) {
  if (isNative(win)) return;
  const tray = doc.querySelector('#moreTray .tray-grid');
  if (!tray) return;
  let prompt = null;
  const apple = isAppleMobile(win.navigator);
  const standalone = () => !!win.matchMedia?.('(display-mode: standalone)').matches || win.navigator.standalone === true;
  const button = doc.createElement('button');
  button.type = 'button'; button.id = 'installBtn'; button.className = 'btn tray-item';
  button.innerHTML = '<span>Install Shelf Life</span><small>Keep the shelf on your home screen</small>';
  const steps = doc.createElement('p');
  steps.className = 'hint'; steps.hidden = true; steps.id = 'installSteps';
  steps.textContent = 'In Safari, tap Share, then Add to Home Screen.';
  button.setAttribute('aria-describedby', 'installSteps');
  tray.append(button, steps);
  const refresh = () => { button.hidden = standalone() || (!apple && !prompt); if (button.hidden) steps.hidden = true; };
  button.addEventListener('click', async () => {
    if (apple) { steps.hidden = !steps.hidden; return; }
    if (!prompt) return;
    const request = prompt; prompt = null; refresh();
    try { await request.prompt(); }
    catch {
      button.hidden = false;
      steps.textContent = 'Installation was unavailable. Use the install option in your browser menu.';
      steps.hidden = false;
    }
  });
  win.addEventListener('beforeinstallprompt', event => { event.preventDefault(); prompt = event; refresh(); });
  win.addEventListener('appinstalled', () => { prompt = null; refresh(); });
  win.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', refresh);
  refresh();
}
