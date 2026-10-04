import { createInboxMonitor } from '../cloud/inbox.js';

export function initSocialInbox({ cloud, social }) {
  const notice = document.getElementById('summonsNotice');
  const text = document.getElementById('summonsNoticeText');
  const open = document.getElementById('summonsNoticeOpen');
  let paused = false;
  const monitor = createInboxMonitor({ cloud, social, visible: () => !paused && !document.hidden,
    onChange: ({ cases, results }) => {
      const lines = [];
      if (cases.length) lines.push('You’ve been served. ' + cases.length + (cases.length === 1 ? ' case waits' : ' cases wait') + ' in Shelf Court.');
      if (results.length) lines.push(results.length + (results.length === 1 ? ' verdict is' : ' verdicts are') + ' ready.');
      const message = lines.join(' ');
      // Do not re-announce an unchanged inbox on every background check.
      if (text.textContent !== message) text.textContent = message;
      notice.hidden = !message;
    }
  });
  open.addEventListener('click', () => window.dispatchEvent(new CustomEvent('shelflife:court')));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) monitor.refresh(); });
  window.addEventListener('shelflife:pause', () => { paused = true; });
  window.addEventListener('shelflife:resume', () => { paused = false; monitor.refresh(); });
  window.addEventListener('pageshow', monitor.refresh);
  window.addEventListener('online', monitor.refresh);
  monitor.start();
  return monitor;
}
