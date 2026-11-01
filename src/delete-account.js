import { createCloud } from './cloud/client.js';
import { cloudConfig, cloudConfigured } from './cloud/config.js';
import { actionText } from './ui/cloud.js';

const $ = id => document.getElementById(id);
if (!cloudConfigured(cloudConfig())) {
  $('unconfigured').hidden = false;
} else {
  // The session made here lives only in this page, never in the game's storage.
  const items = new Map();
  const storage = { getItem: k => items.get(k) ?? null, setItem: (k, v) => { items.set(k, String(v)); }, removeItem: k => { items.delete(k); } };
  const cloud = createCloud({ config: cloudConfig(), storage });
  const say = text => { $('status').textContent = text; };
  let email = '', busy = false;
  async function act(button, work) {
    if (busy) return;
    busy = true; button.disabled = true;
    try { await work(); } catch (error) { say(actionText(error)); }
    finally { busy = false; button.disabled = false; }
  }
  $('direct').hidden = false;
  $('emailForm').addEventListener('submit', event => {
    event.preventDefault();
    act($('sendCode'), async () => {
      try {
        // create: false, so an address with no account never gets one.
        email = (await cloud.requestEmailCode($('email').value, { mode: 'signin', create: false })).email;
      } catch (error) {
        // An unknown address is answered like a known one: this page does not say who has an account.
        if (error?.status !== 422) throw error;
        email = $('email').value.trim().toLowerCase();
      }
      $('codeForm').hidden = false;
      $('code').value = '';
      $('code').focus();
      say('If an account uses ' + email + ', a code is on its way. It can take a minute, and sometimes a spam folder.');
    });
  });
  $('codeForm').addEventListener('submit', event => {
    event.preventDefault();
    act($('confirmCode'), async () => {
      const result = await cloud.verifyEmailCode(email || $('email').value, $('code').value);
      $('who').textContent = result.email;
      $('emailForm').hidden = $('codeForm').hidden = true;
      $('confirm').hidden = false;
      say('');
      $('keepAccount').focus();
    });
  });
  $('keepAccount').addEventListener('click', () => act($('keepAccount'), async () => {
    await cloud.signOut();
    $('confirm').hidden = true;
    $('emailForm').hidden = false;
    say('Nothing was deleted. This page has signed out.');
  }));
  $('deleteAccount').addEventListener('click', () => act($('deleteAccount'), async () => {
    await cloud.deleteAccount();
    $('confirm').hidden = true;
    $('done').hidden = false;
    say('');
  }));
}
