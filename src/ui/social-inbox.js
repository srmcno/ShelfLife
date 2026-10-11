import { createInboxMonitor } from '../cloud/inbox.js';
import { postboxSources, socialContext } from './social-registry.js';

const COURT = ['summons', 'verdicts'];
// Everything waiting in the postbox that is not Court mail (that has its own words).
export function otherMail(ctx) {
  if (!ctx) return 0;
  return postboxSources().filter(s => !COURT.includes(s.id) && s.count).reduce((n, s) => {
    try { return n + (Number(s.count(ctx)) || 0); } catch { return n; }
  }, 0);
}

export function initSocialInbox({ cloud, social, postbox = null }) {
  const notice = document.getElementById('summonsNotice');
  const text = document.getElementById('summonsNoticeText');
  const open = document.getElementById('summonsNoticeOpen');
  let paused = false, court = false;
  // The 30 second check also asks every postbox source that wants to be polled.
  const poll = () => {
    const ctx = socialContext();
    if (!ctx) return null;
    return Promise.allSettled(postboxSources().filter(s => s.poll).map(s => s.load(ctx)));
  };
  const monitor = createInboxMonitor({ cloud, social, visible: () => !paused && !document.hidden, poll,
    watch: postbox ? [fn => postbox.subscribe(fn)] : [],
    onChange: ({ cases, results }) => {
      const lines = [];
      if (cases.length) lines.push('You’ve been served. ' + cases.length + (cases.length === 1 ? ' case waits' : ' cases wait') + ' in Shelf Court.');
      if (results.length) lines.push(results.length + (results.length === 1 ? ' verdict is' : ' verdicts are') + ' ready.');
      const other = social.active() ? otherMail(socialContext()) : 0;
      if (other) lines.push(other + (other === 1 ? ' thing waits' : ' things wait') + ' in your postbox.');
      court = !!(cases.length || results.length);
      const label = court || !other ? 'Open Shelf Court' : 'Open the postbox';
      if (open.textContent !== label) open.textContent = label;
      const message = lines.join(' ');
      // Do not re-announce an unchanged inbox on every background check.
      if (text.textContent !== message) text.textContent = message;
      notice.hidden = !message;
    }
  });
  open.addEventListener('click', () => window.dispatchEvent(new CustomEvent(court ? 'shelflife:court' : 'shelflife:postbox')));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) monitor.refresh(); });
  window.addEventListener('shelflife:pause', () => { paused = true; });
  window.addEventListener('shelflife:resume', () => { paused = false; monitor.refresh(); });
  window.addEventListener('pageshow', monitor.refresh);
  window.addEventListener('online', monitor.refresh);
  monitor.start();
  return monitor;
}
