// Foreground mail checks never acknowledge verdicts or pay Court rewards.
// Only the Friends/Court screens do that when the player reads the result.
export const INBOX_CHECK_MS = 30000;

export function createInboxMonitor({ cloud, social, onChange = () => {}, visible = () => true,
  schedule = setInterval, cancel = clearInterval } = {}) {
  let timer = null, watching = null, started = false, unsubscribe = [];
  const enabled = () => cloud?.configured && social?.active();
  function refresh() {
    if (!started || !enabled() || !visible()) return Promise.resolve(false);
    // A failed background check leaves the last known notice intact. The next
    // timer/resume/reconnect retries; opening Court shows its normal error UI.
    return social.inbox().then(() => true, () => false);
  }
  function update() {
    onChange(enabled() ? social.inboxState() : { cases: [], results: [] });
    const uid = enabled() ? cloud.userId() : null;
    if (uid === watching) return;
    watching = uid;
    if (timer !== null) { cancel(timer); timer = null; }
    if (uid) { timer = schedule(refresh, INBOX_CHECK_MS); refresh(); }
  }
  function start() {
    if (started || !cloud?.configured) return;
    started = true;
    unsubscribe = [cloud.subscribe(update), social.subscribe(update)];
    update();
  }
  function stop() {
    started = false; watching = null;
    if (timer !== null) { cancel(timer); timer = null; }
    unsubscribe.forEach(fn => fn()); unsubscribe = [];
  }
  return { start, stop, refresh };
}
