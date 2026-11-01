import { initSignIn } from './signin.js';

// The Cloud save sheet, its More tray button and the single nudge line.
// Only set up when src/cloud/config.js is filled in; otherwise all of it stays
// hidden and none of it runs.

const MINUTE = 60000, DAY = 86400000;
export const NUDGE_MIN_PETS = 2;
export const NUDGE_MIN_AGE = 2 * DAY;
export const NUDGE_SNOOZE = 14 * DAY;

// Once a shelf is worth losing, say so once. "Not now" buys a fortnight.
export function cloudNudgeDue(state, info, meta = {}, now = Date.now()) {
  if (!info || info.signedIn || info.status !== 'off') return false;
  if ((state?.pets || []).length < NUDGE_MIN_PETS) return false;
  if (now - (state.started || now) < NUDGE_MIN_AGE) return false;
  return now - (Number(meta.nudgeDismissedAt) || 0) >= NUDGE_SNOOZE;
}

// An email account that synced this week covers what the backup reminder is
// worried about. An anonymous one does not: clearing site data loses its key.
export function cloudCovers(info, now = Date.now()) {
  return !!info && info.signedIn && !info.anonymous && ['idle', 'syncing'].includes(info.status) &&
    info.lastSyncedAt > 0 && now - info.lastSyncedAt < 7 * DAY;
}

export function timeAgo(ts, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - ts) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes === 1 ? 'a minute ago' : minutes + ' minutes ago';
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? 'an hour ago' : hours + ' hours ago';
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : days + ' days ago';
}

export function cloudTrayLabel(info, now = Date.now()) {
  if (!info?.signedIn) return 'Off';
  if (info.status === 'conflict' || info.repairable) return 'Needs a decision';
  if (info.status === 'offline') return 'Offline';
  if (info.status === 'error') return 'Could not sync';
  if (info.status === 'syncing') return 'Syncing';
  return info.lastSyncedAt ? 'Saved ' + timeAgo(info.lastSyncedAt, now) : 'On';
}

const DEVICES = { android: 'an Android phone', iphone: 'an iPhone', ipad: 'an iPad', mac: 'a Mac', windows: 'a Windows computer',
  chromebook: 'a Chromebook', linux: 'a Linux computer', device: 'another device' };

function names(summary) {
  const list = summary.names.slice(0, 3), extra = summary.residents - list.length;
  if (extra > 0) return list.join(', ') + ' and ' + extra + ' more';
  return list.length > 1 ? list.slice(0, -1).join(', ') + ' and ' + list.at(-1) : list[0] || '';
}
export function describeShelf(summary) {
  if (!summary?.residents) return 'No residents.';
  const who = summary.residents === 1 ? '1 resident: ' : summary.residents + ' residents: ';
  return who + names(summary) + '.' + (summary.souls ? ' ' + summary.souls + (summary.souls === 1 ? ' soul.' : ' souls.') : '');
}

// Background trouble, as the status line reports it.
export function problemText(info) {
  const code = info?.error?.code;
  if (code === 'session_expired') return 'This device was signed out of cloud save. The shelf here is untouched.';
  if (code === 'too_large') return 'This shelf is too large for cloud save. Drawn residents take the most room.';
  if (code === 'corrupt_remote') return '';
  if (code === 'safety_missing') return 'The other shelf could not be read back, so nothing was swapped.';
  if (info?.status === 'offline') return 'Offline. The shelf is safe here and will be copied when the connection is back.';
  if (info?.status === 'error') return 'The cloud did not answer properly. Nothing here has changed. It will try again shortly.';
  return '';
}

// Trouble from something the player just pressed.
export function actionText(error, { emailRequest = false } = {}) {
  if (error?.offline) return 'No connection. Try again once you are back online.';
  switch (error?.code) {
    case 'invalid_email': return 'That does not look like an email address.';
    case 'email_address_invalid': return 'Use a real email inbox you can open. Example and test addresses cannot receive a code.';
    case 'email_address_not_authorized': return 'Email sign-in is not available for this address yet. Your shelf is still saved on this device.';
    case 'email_confirmation_disabled': return 'Email sign-in is not available right now. Your shelf is still saved on this device.';
    case 'invalid_code': return 'Enter the digits from the email. You do not create this code yourself.';
    case 'otp_expired': return 'That code did not work. Use the newest email, or send another.';
    case 'over_email_send_rate_limit': case 'over_request_rate_limit': return 'Too many codes at once. Wait a few minutes, then try again.';
    case 'anonymous_provider_disabled': case 'signup_disabled': case 'email_provider_disabled': case 'otp_disabled': return 'The server is not accepting new accounts right now. Nothing here has changed.';
    case 'session_expired': return 'This device was signed out of cloud save. The shelf here is untouched.';
    case 'safety_missing': return 'The other shelf could not be read back, so nothing was swapped.';
  }
  if (emailRequest && error?.status >= 500) return 'The email service could not accept the request. Try later. Your shelf is still saved on this device.';
  if (error?.status === 429) return 'Too many requests. Wait a few minutes, then try again.';
  if (error?.status === 403) return 'This cloud action is not available right now. Your shelf is still saved on this device.';
  return 'The cloud did not answer properly. Nothing here has changed. Try again in a moment.';
}

export function initCloudUI({ cloud, sync, getState, onChange = () => {} }) {
  if (!cloud?.configured) return null;
  const $ = id => document.getElementById(id);
  const veil = $('cloudVeil'), status = $('cloudStatus');
  const trayButton = $('cloudBtn'), traySub = $('cloudBtnSub');
  const nudge = $('cloudNudge'), backupBanner = $('backupBanner');
  const parts = {
    conflict: $('cloudConflict'), repair: $('cloudRepair'), anon: $('cloudAnon'),
    signin: $('cloudSignin'), account: $('cloudAccount'), undo: $('cloudUndo'), remove: $('cloudDelete')
  };
  let busy = false, message = '', sawBackupBanner = false, confirmSignOut = false;
  const signin = initSignIn({ root: parts.signin, prefix: 'cloud', cloud, sync, actionText,
    onMessage: text => { message = text; status.textContent = text; }, onSuccess: () => render() });
  trayButton.hidden = false;

  const isOpen = () => veil.classList.contains('open');
  function keepFocus() {
    if (!isOpen()) return;
    const active = document.activeElement;
    if (active && veil.contains(active) && active !== veil && active.getClientRects().length && !active.disabled) return;
    veil.querySelector('h2')?.focus({ preventScroll: true });
  }

  function renderNudge(info) {
    if (backupBanner && !backupBanner.hidden) sawBackupBanner = true;
    const conflict = info.status === 'conflict';
    // One reminder per visit: never straight after the backup banner has asked.
    const due = conflict || (!sawBackupBanner && cloudNudgeDue(getState(), info, cloud.meta()));
    nudge.hidden = !due;
    if (!due) return;
    $('cloudNudgeText').textContent = conflict ? 'This shelf and its cloud copy disagree. Someone has to choose.'
      : 'These residents live in one browser. Cloud save can keep a spare copy elsewhere.';
    $('cloudNudgeOpen').textContent = conflict ? 'Choose' : 'Cloud save';
    $('cloudNudgeLater').hidden = conflict;
  }

  function render() {
    const info = sync.info(), now = Date.now();
    traySub.textContent = cloudTrayLabel(info, now);
    renderNudge(info);
    onChange(info);
    const on = info.signedIn, conflict = !!info.conflict;
    const show = (el, visible) => { el.hidden = !visible; };
    show(parts.conflict, conflict);
    show(parts.repair, on && info.repairable);
    show(parts.anon, on && info.anonymous && !conflict);
    show(parts.signin, (!on || info.anonymous) && !conflict);
    show(parts.account, on && !conflict);
    show(parts.undo, !!info.safetyCopy && !conflict);
    show(parts.remove, on && !conflict);
    if (parts.remove.hidden) $('cloudDeleteConfirm').hidden = true;
    signin.render();
    $('cloudEmailShown').textContent = info.email || 'None yet. This browser is the only way in.';
    $('cloudSynced').textContent = info.status === 'syncing' ? 'Syncing now' : info.lastSyncedAt ? timeAgo(info.lastSyncedAt, now) : 'Not yet';
    $('cloudSignOut').hidden = $('cloudSignOutHint').hidden = false;
    $('cloudSignOut').textContent = confirmSignOut && info.anonymous ? 'Sign out and lose access' : 'Sign out of this device';
    $('cloudSignOutHint').textContent = info.anonymous ? 'This browser holds your only key. Add an email first to keep access to your friends and cloud copy.' : 'Signing out stops the copying. The shelf on this device stays put.';
    $('cloudDeleteStart').textContent = info.anonymous ? 'Turn off and delete the cloud copy' : 'Delete my cloud data and account';
    if (conflict) {
      $('cloudLocalSummary').textContent = describeShelf(info.conflict.local) + ' Here, now.';
      const remote = info.conflict.remote;
      $('cloudRemoteSummary').textContent = describeShelf(remote) + ' Saved from ' + (DEVICES[remote.device] || DEVICES.device) +
        (remote.lastSaved ? ' ' + timeAgo(remote.lastSaved, now) : '') + '.';
    }
    if (info.safetyCopy) {
      const until = new Date(info.safetyCopy.until).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
      const who = info.safetyCopy.residents ? ' (' + names(info.safetyCopy) + ')' : '';
      $('cloudUndoText').textContent = 'The other shelf' + who + ' is kept on this device until ' + until + '. Undo swaps the two back.';
    }
    status.textContent = message || problemText(info);
    veil.querySelectorAll('.cloud-part:not(#cloudSignin) button').forEach(button => { button.disabled = busy; });
    keepFocus();
  }

  async function act(work, working = '', errorContext = {}) {
    if (busy) return;
    busy = true;
    message = working;
    render();
    try { await work(); }
    catch (error) {
      message = actionText(error, errorContext);
    } finally { busy = false; render(); }
  }
  const after = (info, ok) => { message = info.status === 'idle' ? ok : ''; };

  function open() {
    signin.resume();
    message = '';
    $('cloudDeleteConfirm').hidden = true;
    render();
    veil.classList.add('open');
  }
  function close() {
    veil.classList.remove('open');
    $('cloudDeleteConfirm').hidden = true;
    confirmSignOut = false;
    render();
  }

  trayButton.addEventListener('click', open);
  $('cloudNudgeOpen').addEventListener('click', open);
  $('cloudNudgeLater').addEventListener('click', () => { cloud.setMeta({ nudgeDismissedAt: Date.now() }); render(); });
  $('cloudClose').addEventListener('click', close);
  veil.addEventListener('click', e => { if (e.target === veil) close(); });

  $('cloudSyncNow').addEventListener('click', () => act(async () => after(await sync.syncNow(), 'Synced just now.')));
  $('cloudSignOut').addEventListener('click', () => {
    if (sync.info().anonymous && !confirmSignOut) { confirmSignOut = true; message = 'Signing out without an email loses access to this cloud account and its friends.'; render(); return; }
    confirmSignOut = false;
    act(async () => { await sync.signOut(); message = 'Signed out of this device. The shelf stays here, uncopied.'; });
  });
  $('cloudDeleteStart').addEventListener('click', () => { $('cloudDeleteConfirm').hidden = false; $('cloudDeleteCancel').focus(); });
  $('cloudDeleteCancel').addEventListener('click', () => { $('cloudDeleteConfirm').hidden = true; $('cloudDeleteStart').focus(); });
  $('cloudDeleteConfirmBtn').addEventListener('click', () => act(async () => {
    await sync.deleteAccount();
    $('cloudDeleteConfirm').hidden = true;
    message = 'Deleted. The cloud copy and the account are gone. This shelf is still here.';
  }));
  $('cloudKeepLocal').addEventListener('click', () => act(async () => {
    const info = await sync.resolve('local');
    message = info.status === 'offline' ? 'Kept this device. It will be copied to the cloud when the connection is back.'
      : info.status !== 'idle' ? '' : info.safetyCopyFailed ? 'Kept this device. This browser was too full to keep the cloud copy as a spare.'
      : 'Kept this device. The cloud copy now matches it.';
  }));
  $('cloudUseRemote').addEventListener('click', () => act(async () => {
    const info = await sync.resolve('cloud');
    message = info.status === 'conflict' || info.repairable ? '' : info.safetyCopyFailed
      ? 'Now using the cloud copy. This browser was too full to keep the old shelf as a spare, so there is no undo.'
      : 'Now using the cloud copy. The old shelf is kept for a week in case you change your mind.';
  }));
  $('cloudUndoBtn').addEventListener('click', () => act(async () => {
    const info = await sync.undo();
    message = info.error?.code === 'safety_missing' ? '' : 'Swapped back.';
  }));
  $('cloudRepairBtn').addEventListener('click', () => act(async () => after(await sync.resolve('local'), 'Replaced the cloud copy with this shelf.')));

  sync.subscribe(() => { if (!busy) render(); });
  window.addEventListener('shelflife:storage', () => { if (!busy) renderNudge(sync.info()); });
  // Keeps "Saved 3 minutes ago" honest while the game sits open.
  setInterval(() => { traySub.textContent = cloudTrayLabel(sync.info()); }, MINUTE);
  render();
  return { refresh: render, nudge: () => renderNudge(sync.info()), covers: () => cloudCovers(sync.info()), open, showError(error) { open(); message = error?.code === 'provider_failed' ? error.message : actionText(error); render(); } };
}
