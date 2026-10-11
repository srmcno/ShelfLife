// Feedback reports and play days, over the one cloud session. The schema is
// supabase/migrations/0006_feedback_and_play_days.sql.
//
// A signed-in player's report goes straight to submit_feedback. Anyone else's
// waits on this device under shelflife.feedback (outside the save, ten at
// most) and goes the next time there is a session: this module never signs
// anybody in. A report carries its own client id, so sending it twice after a
// lost reply files it once.
//
// Play days: one mark_play_day per local day per account, only when signed in
// and only while the player has not switched counting off. Switching it off
// calls forget_play_days, retried later if the device is offline.

import { CloudError } from './client.js';
import { socialCode, isoDay } from './social.js';
import { localDayKey } from '../state.js';

export const FEEDBACK_KEY = 'shelflife.feedback';
export const MAX_QUEUE = 10;
const KINDS = ['bug', 'confusing', 'idea', 'love', 'pulse'];
const CLIENT = /^[a-z0-9-]{8,40}$/;
// Refusals that will never succeed on a retry: the report is dropped from the queue.
const PERMANENT = new Set(['bad_feedback', 'bad_kind', 'too_large']);

export const FEEDBACK_TEXT = {
  rate_limited: 'That is ten reports today. The complaints department has gone for a lie down. Try again tomorrow.',
  too_large: 'That report is too large to send. Untick the diagnostics, or say it in fewer words.',
  refused: 'The server would not take that report. Copy it instead and send it by email.',
  offline: 'No connection. The report is kept on this device and goes when you are back online.',
  signed_out: 'Kept on this device. It goes when you sign in to cloud save.',
  storage_failed: 'This device could not keep the report. Your draft is still here. Copy it or try again.',
  unexpected: 'The cloud did not answer properly. The report is kept on this device for another try.'
};
export function feedbackCode(error) {
  if (!error) return 'unexpected';
  if (error.code === 'storage_failed') return 'storage_failed';
  if (PERMANENT.has(error.code) || (error.code === 'P0001' && PERMANENT.has(error.message))) return error.code === 'P0001' ? error.message : error.code;
  const code = socialCode(error);
  return code === 'bad_score' ? 'refused' : code;
}
export function feedbackText(error) {
  const code = feedbackCode(error);
  return FEEDBACK_TEXT[PERMANENT.has(code) ? (code === 'too_large' ? 'too_large' : 'refused') : code] || FEEDBACK_TEXT.unexpected;
}

function defaultStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}
const storageError = () => new CloudError(FEEDBACK_TEXT.storage_failed, { code: 'storage_failed' });
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);

// A queued report as the server will want it, or null if it is not one.
export function cleanReport(raw) {
  if (!record(raw) || typeof raw.client_id !== 'string' || !CLIENT.test(raw.client_id) || !KINDS.includes(raw.kind)) return null;
  const pulse = raw.kind === 'pulse';
  if (pulse && !(Number.isInteger(raw.rating) && raw.rating >= 1 && raw.rating <= 5)) return null;
  let diagnostics = record(raw.diagnostics) ? raw.diagnostics : null;
  if (diagnostics && JSON.stringify(diagnostics).length > 15500) diagnostics = null;
  return {
    client_id: raw.client_id, kind: raw.kind, body: typeof raw.body === 'string' ? raw.body.slice(0, 1000) : '',
    doing: typeof raw.doing === 'string' && /^[a-z-]{0,24}$/.test(raw.doing) ? raw.doing : '',
    rating: pulse ? raw.rating : null, moment: pulse && ['day2', 'court', 'day7'].includes(raw.moment) ? raw.moment : '',
    version: typeof raw.version === 'string' ? raw.version.slice(0, 24) : '', platform: raw.platform === 'android' ? 'android' : 'web',
    diagnostics, created: typeof raw.created === 'string' ? raw.created.slice(0, 40) : ''
  };
}

export function createFeedback({ cloud, storage = defaultStorage(), now = Date.now } = {}) {
  const listeners = new Set();
  let flushing = null;

  function meta(required = false) {
    try {
      const value = JSON.parse(storage.getItem(FEEDBACK_KEY) || '{}');
      return record(value) ? value : {};
    } catch { if (required) throw storageError(); return {}; }
  }
  function setMeta(patch, required = false) {
    let previous;
    // Even best-effort play-day metadata must not overwrite a queue we could
    // not read. Reports and counters share this one storage record.
    try { previous = meta(true); } catch (error) { if (required) throw error; return null; }
    const next = { ...previous, ...patch };
    Object.keys(next).forEach(key => { if (next[key] === undefined) delete next[key]; });
    try { storage.setItem(FEEDBACK_KEY, JSON.stringify(next)); } catch { if (required) throw storageError(); }
    return next;
  }
  const emit = () => listeners.forEach(fn => { try { fn({ queued: queued().length }); } catch { /* the UI's problem */ } });

  const configured = () => !!cloud?.configured;
  const signedIn = () => configured() && cloud.signedIn();
  function queued(required = false) {
    const seen = new Set(), queue = meta(required).queue;
    return (Array.isArray(queue) ? queue : []).map(cleanReport).filter(r => r && !seen.has(r.client_id) && seen.add(r.client_id)).slice(-MAX_QUEUE);
  }
  function keep(report) {
    const list = queued(true).filter(r => r.client_id !== report.client_id);
    list.push(report);
    setMeta({ queue: list.slice(-MAX_QUEUE) }, true);
    emit();
  }
  function drop(id) {
    const queue = queued(true);
    if (!queue.some(r => r.client_id === id)) return;
    setMeta({ queue: queue.filter(r => r.client_id !== id) }, true);
    emit();
  }

  async function send(report) {
    const r = await cloud.rpc('submit_feedback', {
      p_client_id: report.client_id, p_kind: report.kind, p_body: report.body, p_doing: report.doing, p_rating: report.rating,
      p_moment: report.moment, p_version: report.version, p_platform: report.platform, p_diagnostics: report.diagnostics
    });
    if (!record(r) || r.ok !== true) throw new CloudError('unexpected', { code: 'unexpected' });
    return r;
  }

  // 'sent' or 'queued'. Throws (with .code) only for a refusal a retry cannot fix
  // or the daily limit, and when this device cannot persist a queued report.
  async function submit(raw) {
    const report = cleanReport(raw);
    if (!report) throw new CloudError(FEEDBACK_TEXT.refused, { code: 'bad_feedback' });
    if (!signedIn()) { keep(report); return 'queued'; }
    try { await send(report); }
    catch (error) {
      const code = feedbackCode(error);
      if (code === 'offline' || code === 'unexpected' || code === 'signed_out') { keep(report); return 'queued'; }
      throw Object.assign(new CloudError(feedbackText(error), { code, status: error?.status || 0 }), { report });
    }
    // The server has acknowledged this id. A stuck queued copy is safe to retry
    // idempotently, and does not make the acknowledged submission fail.
    try { drop(report.client_id); } catch (error) { if (error.code !== 'storage_failed') throw error; }
    return 'sent';
  }

  // Sends what is waiting, oldest first. Stops at the first thing that says "not now".
  function flush() {
    if (flushing) return flushing;
    flushing = (async () => {
      let sent = 0;
      if (!signedIn()) return { sent, left: queued().length };
      for (const report of queued()) {
        try { await send(report); sent++; drop(report.client_id); }
        catch (error) {
          const code = feedbackCode(error);
          if (PERMANENT.has(code)) {
            try { drop(report.client_id); } catch { break; }
            continue;
          }
          break;
        }
      }
      return { sent, left: queued().length };
    })().finally(() => { flushing = null; });
    return flushing;
  }

  // ---- play days ----
  // At most one call per local day per account. Resolves to true when counted.
  async function markPlayDay({ allowed = true, dayKey = localDayKey(now()) } = {}) {
    if (!allowed || !signedIn()) return false;
    const user = cloud.userId(), day = isoDay(dayKey);
    if (!day) return false;
    const last = meta().playDay;
    if (record(last) && last.user === user && last.day === day) return false;
    try {
      await cloud.rpc('mark_play_day', { p_day: day });
      if (cloud.userId() === user) setMeta({ playDay: { user, day } });
      return true;
    } catch { return false; }
  }
  // Called when the player switches counting off. Remembered and retried if it cannot go now.
  async function forgetPlayDays() {
    if (!signedIn()) return false;
    const user = cloud.userId();
    setMeta({ forget: user, playDay: undefined });
    try {
      await cloud.rpc('forget_play_days', {});
      if (meta().forget === user) setMeta({ forget: undefined });
      return true;
    } catch { return false; }
  }
  // A forget that could not reach the server earlier, for this account.
  async function retryForget() {
    if (!signedIn() || meta().forget !== cloud.userId()) return false;
    return forgetPlayDays();
  }
  // Switched back on: forget nothing, and count today again.
  function resumePlayDays() { setMeta({ forget: undefined, playDay: undefined }); }

  return {
    configured, signedIn, submit, flush, queued, drop, markPlayDay, forgetPlayDays, retryForget, resumePlayDays, meta,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
}
