// The feedback and play-day functions of
// supabase/migrations/0006_feedback_and_play_days.sql, in memory, for
// test/support/fake-supabase.mjs. Same arguments, same answers, same refusals
// (errcode P0001 with a token as the message). test/feedback_sql.test.mjs
// checks the real SQL against the same rules. Neither table is readable
// through the fake's PostgREST either: there is no TABLES entry for them.

const DAY = 86400000;
const KINDS = ['bug', 'confusing', 'idea', 'love', 'pulse'];
const MOMENTS = ['day2', 'court', 'day7'];
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const bytes = value => new TextEncoder().encode(JSON.stringify(value)).length;
const cleanText = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const cleanNote = (value, max) => String(value ?? '').replace(/\r/g, '').replace(/[\u0001-\u0009\u000b-\u001f\u007f]/g, ' ')
  .replace(/\n{3,}/g, '\n\n').replace(/^[\s]+|[\s]+$/g, '').slice(0, max);

export function createFakeFeedback({ now, json, rest }) {
  const feedback = [], playDays = [];
  const optouts = new Set(), forgetHooks = [];
  const refuse = token => rest(400, 'P0001', token);
  let serial = 0;

  // Mirrors private.score_day: YYYY-M-D, a real date.
  function day(value) {
    const m = typeof value === 'string' && value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m) return null;
    const [y, mo, d] = m.slice(1).map(Number), date = new Date(Date.UTC(y, mo - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
    return date.toISOString().slice(0, 10);
  }
  const today = () => new Date(now()).toISOString().slice(0, 10);
  const gap = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / DAY);

  const RPC = {
    submit_feedback(user, { p_client_id, p_kind, p_body = '', p_doing = '', p_rating = null, p_moment = '', p_version = '', p_platform = '', p_diagnostics = null }) {
      const kind = String(p_kind ?? '').toLowerCase(), moment = String(p_moment ?? '').toLowerCase();
      if (typeof p_client_id !== 'string' || !/^[a-z0-9-]{8,40}$/.test(p_client_id)) return refuse('bad_feedback');
      if (!KINDS.includes(kind)) return refuse('bad_kind');
      if (feedback.some(f => f.user_id === user.id && f.client_id === p_client_id)) return json(200, { ok: true, duplicate: true });
      if (feedback.filter(f => f.user_id === user.id && f.at > now() - DAY).length >= 10) return refuse('rate_limited');
      if (String(p_body ?? '').length > 4000) return refuse('too_large');
      if (p_diagnostics !== null && (!record(p_diagnostics) || bytes(p_diagnostics) >= 16000)) return refuse('too_large');
      if (kind === 'pulse') {
        if (!Number.isInteger(p_rating) || p_rating < 1 || p_rating > 5 || !MOMENTS.includes(moment)) return refuse('bad_feedback');
      } else if (p_rating !== null || moment !== '') return refuse('bad_feedback');
      const doing = String(p_doing ?? '').toLowerCase(), platform = String(p_platform ?? '').toLowerCase();
      feedback.push({ id: ++serial, user_id: user.id, client_id: p_client_id, kind, body: cleanNote(p_body, 1000),
        doing: /^[a-z-]{0,24}$/.test(doing) ? doing : '', rating: kind === 'pulse' ? p_rating : null, moment: kind === 'pulse' ? moment : '',
        app_version: cleanText(p_version, 24), platform: ['web', 'android'].includes(platform) ? platform : '',
        diagnostics: p_diagnostics === null ? null : JSON.parse(JSON.stringify(p_diagnostics)), at: now(), created_at: new Date(now()).toISOString() });
      for (let i = feedback.length - 1; i >= 0; i--) if (feedback[i].at < now() - 365 * DAY) feedback.splice(i, 1);
      return json(200, { ok: true });
    },
    mark_play_day(user, { p_day }) {
      const d = day(p_day);
      if (!d || Math.abs(gap(d, today())) > 1) return refuse('bad_day');
      optouts.delete(user.id); // counting a day is the switch being on again
      const added = !playDays.some(p => p.user_id === user.id && p.day === d);
      if (added) playDays.push({ user_id: user.id, day: d });
      for (let i = playDays.length - 1; i >= 0; i--) if (playDays[i].user_id === user.id && gap(today(), playDays[i].day) > 400) playDays.splice(i, 1);
      return json(200, { ok: true, counted: added });
    },
    forget_play_days(user) {
      let removed = 0;
      for (let i = playDays.length - 1; i >= 0; i--) if (playDays[i].user_id === user.id) { playDays.splice(i, 1); removed++; }
      // The same switch covers coven active days (as 0006 now does), and stops both counting.
      optouts.add(user.id);
      for (const hook of forgetHooks) hook(user.id);
      return json(200, { ok: true, removed });
    }
  };

  // What delete_my_account cascades away.
  function forget(userId) {
    for (const list of [feedback, playDays]) for (let i = list.length - 1; i >= 0; i--) if (list[i].user_id === userId) list.splice(i, 1);
  }

  return { RPC, forget, feedback, playDays, optouts, onForgetPlayDays: hook => forgetHooks.push(hook) };
}
