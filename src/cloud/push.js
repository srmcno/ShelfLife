// Browser push is opt-in and never requests permission during startup.
import { isNative } from '../native.js';

export const PUSH_GROUPS = ['friends', 'court', 'gifts', 'games', 'covens', 'kin'];
export const PUSH_CLEANUP_KEY = 'shelflife.push.cleanup';
const UNKNOWN = Symbol('push subscription unknown');
function defaultStorage() { try { return globalThis.localStorage || null; } catch { return null; } }
export function isAppleMobile(nav = globalThis.navigator) {
  return /iPhone|iPad|iPod/i.test(nav?.userAgent || '') || (nav?.platform === 'MacIntel' && Number(nav?.maxTouchPoints) > 1);
}
export function isStandalone(nav = globalThis.navigator, match = globalThis.matchMedia) {
  return nav?.standalone === true || !!match?.('(display-mode: standalone)').matches;
}
function decode(value) {
  const str = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}
export function createPush({ cloud, publicKey, nav = globalThis.navigator, notification = globalThis.Notification, pushManager = globalThis.PushManager, match = globalThis.matchMedia, native = isNative, registrationTimeoutMs = 3000, storage = defaultStorage(), events = globalThis } = {}) {
  const appleNeedsInstall = () => isAppleMobile(nav) && !isStandalone(nav, match);
  const available = () => !!cloud?.configured && !!publicKey && !native() && (appleNeedsInstall() || (!!nav?.serviceWorker && !!notification && !!pushManager));
  const identity = () => cloud?.userId?.();
  const requireOwner = user => { if (!user || identity() !== user) throw new Error('The account changed. Try again.'); };
  let volatilePending = '', cleanupInFlight = null, started = false, unsubscribeCloud = null;
  function pending() {
    try { return volatilePending || storage?.getItem(PUSH_CLEANUP_KEY) || ''; }
    catch { return UNKNOWN; }
  }
  function markPending() {
    const marker = Date.now().toString(36) + ':' + Math.random().toString(36).slice(2);
    volatilePending = marker;
    try {
      storage?.setItem(PUSH_CLEANUP_KEY, marker);
      const persisted = storage?.getItem(PUSH_CLEANUP_KEY) === marker;
      if (persisted) volatilePending = '';
      return { marker, persisted };
    } catch { return { marker, persisted: false }; }
  }
  function clearPending(marker) {
    if (pending() !== marker) return false;
    try { storage?.removeItem(PUSH_CLEANUP_KEY); }
    catch { return false; }
    volatilePending = '';
    return !pending();
  }
  async function bounded(operation) {
    let timer;
    try { return await Promise.race([Promise.resolve().then(operation), new Promise(resolve => { timer = setTimeout(() => resolve(UNKNOWN), registrationTimeoutMs); })]); }
    catch { return UNKNOWN; }
    finally { clearTimeout(timer); }
  }
  async function registration(waitForReady = false) {
    const worker = nav.serviceWorker;
    return bounded(async () => {
      if (typeof worker.getRegistration === 'function') {
        const existing = await worker.getRegistration();
        if (existing || !waitForReady) return existing || null;
      }
      return worker.ready;
    });
  }
  async function inspect() {
    const reg = await registration();
    if (reg === UNKNOWN || (reg && !reg.pushManager)) return UNKNOWN;
    return reg ? bounded(() => reg.pushManager.getSubscription()) : null;
  }
  async function cleanupPending() {
    if (!pending()) return true;
    if (cleanupInFlight) return cleanupInFlight;
    cleanupInFlight = (async () => {
      const marker = pending();
      if (!marker) return true;
      if (marker === UNKNOWN || native() || !nav?.serviceWorker || appleNeedsInstall()) return false;
      const old = await inspect();
      if (old === UNKNOWN) return false;
      if (old && await bounded(() => old.unsubscribe()) !== true) return false;
      return clearPending(marker);
    })().finally(() => { cleanupInFlight = null; });
    return cleanupInFlight;
  }
  const retryCleanup = () => cleanupPending();
  const onRetry = () => { void retryCleanup(); };
  function start() {
    if (!started) {
      started = true;
      events?.addEventListener?.('online', onRetry);
      events?.addEventListener?.('storage', onRetry);
      unsubscribeCloud = cloud?.subscribe?.(onRetry) || null;
    }
    return retryCleanup();
  }
  function stop() {
    if (!started) return;
    started = false;
    events?.removeEventListener?.('online', onRetry);
    events?.removeEventListener?.('storage', onRetry);
    unsubscribeCloud?.(); unsubscribeCloud = null;
  }
  async function current() {
    if (!available() || appleNeedsInstall()) return null;
    if (!await cleanupPending()) throw new Error('Could not clear an earlier notification on this device. Try again.');
    const sub = await inspect();
    if (sub === UNKNOWN) throw new Error('Notifications are not ready on this device. Try again.');
    return sub;
  }
  async function subscribe() {
    if (!available() || appleNeedsInstall()) throw new Error('Install Shelf Life on your Home Screen first.');
    const owner = identity(); requireOwner(owner);
    if (!await cleanupPending()) throw new Error('Could not clear an earlier notification on this device. Try again.');
    requireOwner(owner);
    const permission = await notification.requestPermission(); requireOwner(owner);
    if (permission !== 'granted') throw new Error('Notifications were not allowed. Check this device’s notification settings.');
    const reg = await registration(true); requireOwner(owner);
    if (reg === UNKNOWN || !reg?.pushManager) throw new Error('Notifications are not ready on this device. Try again.');
    let subscription = await bounded(() => reg.pushManager.getSubscription()); requireOwner(owner);
    if (subscription === UNKNOWN) throw new Error('Notifications are not ready on this device. Try again.');
    let created = false;
    if (!subscription) { subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decode(publicKey) }); created = true; }
    try {
      requireOwner(owner);
      if (pending()) throw new Error('The account changed. Try again.');
      const data = subscription.toJSON();
      if (!data.endpoint || !data.keys?.p256dh || !data.keys?.auth) throw new Error('This device returned an incomplete subscription.');
      await cloud.rpc('push_subscribe', { p_endpoint: data.endpoint, p_p256dh: data.keys.p256dh, p_auth: data.keys.auth });
      requireOwner(owner);
      if (pending()) throw new Error('The account changed. Try again.');
      return true;
    } catch (error) {
      if (created || identity() !== owner || pending()) {
        const { marker } = markPending();
        if (await bounded(() => subscription.unsubscribe()) === true) clearPending(marker);
      }
      throw error;
    }
  }
  async function unsubscribe() {
    if (native() || !nav?.serviceWorker || appleNeedsInstall()) return true;
    const owner = identity(); requireOwner(owner);
    const { marker, persisted } = markPending();
    const subscription = await inspect(); requireOwner(owner);
    if (subscription === UNKNOWN) {
      if (!persisted && globalThis.document) throw new Error('Could not safely clear notifications on this device. Try again.');
      return { cleanupPending: true };
    }
    if (!subscription) { clearPending(marker); return true; }
    let removedFromServer = false;
    try { await cloud.rpc('push_unsubscribe', { p_endpoint: subscription.endpoint }); removedFromServer = true; }
    catch (error) { if (identity() !== owner) throw error; }
    requireOwner(owner);
    const removedLocally = await bounded(() => subscription.unsubscribe()) === true;
    if (removedLocally) clearPending(marker);
    else if (!persisted && globalThis.document) throw new Error('Could not safely clear notifications on this device. Try again.');
    return { removedFromServer, removedLocally, ...(!removedLocally ? { cleanupPending: true } : {}) };
  }
  async function settings() { const owner = identity(); requireOwner(owner); const data = await cloud.rpc('push_settings'); requireOwner(owner); return data; }
  async function set(group, enabled) {
    if (!PUSH_GROUPS.includes(group) || typeof enabled !== 'boolean') throw new Error('Invalid notification setting.');
    const owner = identity(); requireOwner(owner); const result = await cloud.rpc('push_set', { p_group: group, p_on: enabled }); requireOwner(owner); return result;
  }
  return { available, appleNeedsInstall, current, subscribe, unsubscribe, settings, set, start, stop, retryCleanup };
}
