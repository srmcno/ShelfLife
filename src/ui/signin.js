// Reusable email sign-in for the cloud and Friends sheets.
import { isNative } from '../native.js';

export function mailLink(email) {
  const domain = String(email || '').toLowerCase().split('@')[1];
  if (domain === 'gmail.com' || domain === 'googlemail.com') return ['Gmail', 'https://mail.google.com/'];
  if (['outlook.com', 'hotmail.com', 'live.com', 'msn.com'].includes(domain)) return ['Outlook', 'https://outlook.live.com/mail/'];
  if (domain === 'yahoo.com' || domain?.startsWith('yahoo.')) return ['Yahoo', 'https://mail.yahoo.com/'];
  if (['icloud.com', 'me.com', 'mac.com'].includes(domain)) return ['iCloud Mail', 'https://www.icloud.com/mail/'];
  return null;
}

export function initSignIn({ root, prefix, cloud, sync, actionText, onMessage = () => {}, onSuccess = () => {}, anonymousLabel = 'Just keep a backup on this device' }) {
  root.innerHTML = `<p class="signin-pitch">Keep these residents safe, play on any device, and join Friends.</p>
    <form id="${prefix}EmailForm" class="cloud-form signin-email" novalidate>
      <label for="${prefix}Email">Your email</label><div class="cloud-row"><input type="email" id="${prefix}Email" autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" maxlength="254" placeholder="you@example.com"><button class="btn btn-primary" type="submit" id="${prefix}SendCode">Email me a code</button></div>
    </form>
    <form id="${prefix}CodeForm" class="cloud-form signin-code" novalidate hidden>
      <p class="cloud-destination"><span id="${prefix}CodeDestination"></span> <button class="btn btn-ghost signin-change" type="button" id="${prefix}ChangeEmail">Change</button></p>
      <label for="${prefix}Code">Code from your email</label><div class="cloud-row"><input type="text" id="${prefix}Code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="10" placeholder="000000"><button class="btn btn-primary" type="submit" id="${prefix}Confirm">Confirm</button></div>
      <div class="signin-links"><button class="btn btn-ghost" type="button" id="${prefix}Resend">Send another code</button><a id="${prefix}Mail" target="_blank" rel="noopener noreferrer" hidden></a></div>
    </form>
    <button class="btn signin-google" type="button" id="${prefix}Google" hidden>Continue with Google</button>
    <button class="btn signin-anon" type="button" id="${prefix}Enable"></button>`;
  const $ = id => root.querySelector('#' + prefix + id);
  const email = $('Email'), code = $('Code'), emailForm = $('EmailForm'), codeForm = $('CodeForm');
  $('Enable').textContent = anonymousLabel;
  let pending = null, busy = false, auto = 0, ticker = 0, settingsGeneration = 0;
  function render() {
    emailForm.hidden = !!pending; codeForm.hidden = !pending;
    $('Enable').hidden = sync.info().signedIn;
    const seconds = pending ? Math.max(0, Math.ceil((pending.at + 60000 - Date.now()) / 1000)) : 0;
    $('Resend').disabled = busy || seconds > 0;
    $('Resend').textContent = seconds ? 'Send another code in ' + seconds + 's' : 'Send another code';
    for (const button of root.querySelectorAll('button:not(#' + prefix + 'Resend)')) button.disabled = busy;
    if (pending) {
      $('CodeDestination').textContent = 'Sent to ' + pending.email;
      const link = mailLink(pending.email), mail = $('Mail');
      mail.hidden = !link;
      if (link) { mail.textContent = 'Open ' + link[0]; mail.href = link[1]; }
    }
  }
  function resume() {
    const p = cloud.pendingEmail(), info = sync.info();
    pending = p && Date.now() - p.at < 3600000 && (info.anonymous || (p.mode === 'signin' && !info.signedIn)) ? p : null;
    if (pending) email.value = pending.email;
    clearInterval(ticker); ticker = setInterval(render, 1000); render();
    if (!isNative() && !globalThis.location?.hostname?.endsWith('.github.io')) {
      const generation = ++settingsGeneration;
      cloud.authSettings().then(settings => { if (generation === settingsGeneration) $('Google').hidden = settings?.external?.google !== true; }, () => { if (generation === settingsGeneration) $('Google').hidden = true; });
    }
  }
  async function run(work, context = {}) {
    if (busy) return false;
    busy = true; onMessage(''); render();
    try { await work(); return true; }
    catch (error) { onMessage(actionText(error, context)); return false; }
    finally { busy = false; render(); }
  }
  async function send() {
    return run(async () => {
      let sent, switched = false;
      const owner = cloud.userId();
      try { sent = await cloud.requestEmailCode(email.value, { mode: sync.info().anonymous ? 'link' : 'signin' }); }
      catch (error) {
        if (cloud.userId() !== owner) throw Object.assign(new Error('The cloud account changed.'), { code: 'session_changed' });
        if (!sync.info().anonymous || !['email_exists', 'user_already_exists'].includes(error?.code)) throw error;
        sent = await cloud.requestEmailCode(email.value, { mode: 'signin' });
        switched = true;
      }
      pending = cloud.pendingEmail() || { ...sent, at: Date.now() }; code.value = '';
      onMessage(switched ? 'That email already has a shelf. You can choose which shelf to keep.' : 'Code requested. Check your email, including spam or junk.');
      render(); code.focus();
    }, { emailRequest: true });
  }
  async function verify() {
    clearTimeout(auto);
    await run(async () => {
      const result = await cloud.verifyEmailCode(pending?.email || email.value, code.value);
      pending = null; code.value = '';
      onMessage(result.switched ? 'Signed in. Check which shelf to keep.' : 'Signed in as ' + result.email + '.');
      await onSuccess(result);
    });
  }
  emailForm.addEventListener('submit', event => { event.preventDefault(); send(); });
  codeForm.addEventListener('submit', event => { event.preventDefault(); verify(); });
  code.addEventListener('input', () => {
    code.value = code.value.replace(/\D/g, '').slice(0, 10);
    clearTimeout(auto); if (code.value.length >= 6) auto = setTimeout(verify, 600);
  });
  $('Resend').addEventListener('click', send);
  $('ChangeEmail').addEventListener('click', () => { clearTimeout(auto); pending = null; cloud.setMeta({ pending: undefined }); code.value = ''; onMessage(''); render(); email.focus(); });
  $('Enable').addEventListener('click', () => run(async () => {
    const info = await sync.enable();
    if (!info.signedIn) throw info.error || new Error('Cloud save could not be enabled.');
    onMessage(info.status === 'idle' ? 'Cloud save is on. The shelf has been copied.' : 'Cloud save is on, but this shelf has not synced yet.');
    await onSuccess({ anonymous: true });
  }));
  $('Google').addEventListener('click', () => run(() => cloud.signInWithProvider('google')));
  return { resume, render, destroy() { clearInterval(ticker); clearTimeout(auto); settingsGeneration++; } };
}
