// What a feedback report says about the device and the game, and nothing else.
//
// collectDiagnostics() is pure: everything it reads is passed in, so the unit
// tests can prove what is (and is not) in it. browserEnv() gathers the same
// inputs from a real page. Never included: the email address, the save's
// contents (residents' names, notes, drawings), or anything typed elsewhere.
// The whole object stays well under the server's 16 KB limit.

import { VERSION, BUILD, COMMIT, versionLine } from './version.js';
import { MAX_ERRORS } from './errors.js';

export const DIAGNOSTICS_LIMIT = 15000;
const DAY = 86400000;
const text = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
const int = value => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);
const round = (value, places = 2) => (Number.isFinite(value) ? Math.round(value * 10 ** places) / 10 ** places : 0);

// Sheets are reported by name, not by element id.
export const SHEET_NAMES = {
  cardVeil: 'resident card', mayhemVeil: 'emergencies and the Cabinet', arcadeVeil: 'arcade', courtVeil: 'Shelf Court',
  playroomVeil: 'Playroom', studioVeil: 'making a resident', decorVeil: 'Decorate', almanacVeil: 'Almanac', exchangeVeil: 'Collector’s Exchange',
  friendsVeil: 'Friends', cloudVeil: 'Cloud save', escapadeVeil: 'little adventure', lifeVeil: 'expeditions and the workshop',
  museumVeil: 'Memory museum', incidentsVeil: 'Incidents', helpVeil: 'Help', postcardVeil: 'postcard', transferVeil: 'moving devices',
  restoreVeil: 'restoring a backup', voiceVeil: 'narrator voice', testerVeil: 'tester panel', whatsNewVeil: 'What’s new', moreTray: 'More'
};
export function sheetName(id) {
  if (!id) return 'none';
  return SHEET_NAMES[id] || text(String(id).replace(/Veil$/, ''), 40);
}

// 'not set up' | 'off' | 'guest' | 'email'. Only whether there is an email, never which.
export function cloudState(cloud) {
  if (!cloud?.configured) return 'not set up';
  try {
    if (!cloud.signedIn()) return 'off';
    return cloud.isAnonymous() ? 'guest' : 'email';
  } catch { return 'off'; }
}

function cleanBench(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const tier = raw.tier === 'full' || raw.tier === 'light' ? raw.tier : '';
  if (!tier) return null;
  return { tier, median: round(raw.median, 1), p90: round(raw.p90, 1), run: text(raw.run, 12) };
}

/**
 * env: { platform, userAgent, screen: { width, height }, viewport: { width, height }, dpr,
 *        online, effectsMode, bench, sheet, saveBytes, clockDays }
 * state: the live save (only counts and settings are read from it)
 */
export function collectDiagnostics({ state = {}, env = {}, cloud = null, errors = [], now = Date.now(), minimal = false } = {}) {
  const settings = state.settings || {};
  const started = Number.isFinite(state.started) ? state.started : now;
  const base = {
    version: VERSION, build: BUILD, ...(COMMIT ? { commit: text(COMMIT, 12) } : {}),
    platform: env.platform === 'android' ? 'android' : 'web',
    residents: int((state.pets || []).length),
    days: int((now - started) / DAY)
  };
  if (minimal) return base;
  const out = {
    ...base,
    userAgent: text(env.userAgent, 300),
    screen: int(env.screen?.width) + 'x' + int(env.screen?.height),
    viewport: int(env.viewport?.width) + 'x' + int(env.viewport?.height),
    dpr: round(env.dpr || 1),
    effects: { setting: ['auto', 'light', 'full'].includes(settings.effects) ? settings.effects : 'auto',
      mode: env.effectsMode === 'full' ? 'full' : env.effectsMode === 'light' ? 'light' : '', benchmark: cleanBench(env.bench) },
    calm: settings.calm === true,
    saveKB: round((Number(env.saveBytes) || 0) / 1024, 1),
    sheet: sheetName(env.sheet),
    online: env.online !== false,
    cloud: cloudState(cloud),
    tester: state.tester === true,
    ...(int(env.clockDays) ? { clockDays: int(env.clockDays) } : {}),
    errors: (Array.isArray(errors) ? errors : []).slice(-MAX_ERRORS).map(e => ({
      message: text(e?.message, 300), source: text(e?.source, 120),
      at: Number.isFinite(e?.at) && e.at > 0 ? new Date(e.at).toISOString() : '', ...(e?.count > 1 ? { count: int(e.count) } : {})
    }))
  };
  // Far more than 20 long errors would be needed to get here; drop the oldest first.
  while (JSON.stringify(out).length > DIAGNOSTICS_LIMIT && out.errors.length) out.errors.shift();
  return out;
}

// The same inputs, from the page this is running in.
export function browserEnv({ state, sheet = '', native = false, clockDays = 0 } = {}) {
  const win = globalThis.window, nav = globalThis.navigator || {};
  let bench = null, saveBytes = 0;
  try { bench = JSON.parse(globalThis.localStorage?.getItem('shelflife.perf') || 'null'); } catch { /* none yet */ }
  try { saveBytes = new Blob([JSON.stringify(state)]).size; } catch { try { saveBytes = JSON.stringify(state).length; } catch { saveBytes = 0; } }
  return {
    platform: native ? 'android' : 'web', userAgent: nav.userAgent || '',
    screen: { width: win?.screen?.width, height: win?.screen?.height },
    viewport: { width: win?.innerWidth, height: win?.innerHeight },
    dpr: win?.devicePixelRatio || 1, online: nav.onLine !== false,
    effectsMode: globalThis.document?.body?.dataset?.effects || '', bench, sheet, saveBytes, clockDays
  };
}

/* ---------------- the report itself ---------------- */

export const KINDS = [
  { id: 'bug', label: 'Bug', hint: 'Something broke or misbehaved.' },
  { id: 'confusing', label: 'Confusing', hint: 'Something did not make sense.' },
  { id: 'idea', label: 'Idea', hint: 'Something the shelf should have.' },
  { id: 'love', label: 'Love it', hint: 'Something worth keeping.' }
];
export const KIND_LABEL = Object.fromEntries([...KINDS.map(k => [k.id, k.label]), ['pulse', 'How is it going?']]);
// "What were you doing?" Short tokens go to the server; the labels stay here.
export const DOINGS = [
  ['', 'Not sure, or nothing in particular'], ['shelf', 'Looking after residents'], ['emergency', 'An emergency or the Cabinet'],
  ['create', 'Making a resident'], ['court', 'Shelf Court'], ['arcade', 'An arcade game'], ['expedition', 'An expedition'],
  ['stories', 'Stories and adventures'], ['almanac', 'The Almanac'], ['friends', 'Friends'], ['cloud', 'Cloud save or signing in'],
  ['backup', 'Backing up or moving devices'], ['other', 'Something else']
];
export const DOING_LABEL = Object.fromEntries(DOINGS);
export const MAX_BODY = 1000;

export function clientId(now = Date.now(), rnd = Math.random) {
  let tail = '';
  for (let i = 0; i < 8; i++) tail += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(rnd() * 36)];
  return 'fb-' + Math.max(0, Math.floor(now)).toString(36) + '-' + tail;
}

// Exactly what goes to the server (src/cloud/feedback.js sends these fields).
export function buildReport({ kind, body = '', doing = '', rating = null, moment = '', diagnostics = null, now = Date.now(), id } = {}) {
  const k = KIND_LABEL[kind] ? kind : 'bug';
  return {
    client_id: id || clientId(now), kind: k, body: String(body ?? '').replace(/\r/g, '').slice(0, MAX_BODY).trim(),
    doing: Object.hasOwn(DOING_LABEL, doing) ? doing : '',
    rating: k === 'pulse' && Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null,
    moment: k === 'pulse' ? text(moment, 12) : '',
    version: VERSION, platform: diagnostics?.platform === 'android' ? 'android' : 'web',
    diagnostics: diagnostics && typeof diagnostics === 'object' ? diagnostics : null,
    created: new Date(now).toISOString()
  };
}

const yes = value => (value ? 'yes' : 'no');
// The diagnostics as label and value pairs, in the order a person would read them.
export function diagnosticRows(d) {
  if (!d) return [];
  const rows = [['Version', d.version + ' (build ' + d.build + (d.commit ? ', ' + d.commit : '') + ')'], ['Platform', d.platform === 'android' ? 'Android app' : 'Web']];
  if (d.userAgent !== undefined) rows.push(['Browser', d.userAgent || 'unknown']);
  if (d.screen) rows.push(['Screen', d.screen + ' at ' + d.dpr + 'x, window ' + d.viewport]);
  if (d.effects) rows.push(['Effects', d.effects.setting + (d.effects.mode ? ', running ' + d.effects.mode : '') + (d.effects.benchmark ? '; benchmark ' + d.effects.benchmark.tier + ' (median ' + d.effects.benchmark.median + ' ms, p90 ' + d.effects.benchmark.p90 + ' ms)' : '; no benchmark yet')]);
  if (d.calm !== undefined) rows.push(['Calm mode', d.calm ? 'on' : 'off']);
  rows.push(['Residents', String(d.residents)], ['Days since the shelf started', String(d.days)]);
  if (d.saveKB !== undefined) rows.push(['Save size', d.saveKB + ' KB']);
  if (d.sheet !== undefined) rows.push(['Open at the time', d.sheet]);
  if (d.online !== undefined) rows.push(['Online', yes(d.online)]);
  if (d.cloud !== undefined) rows.push(['Cloud save', d.cloud]);
  if (d.tester !== undefined) rows.push(['Tester save', yes(d.tester)]);
  if (d.clockDays) rows.push(['Tester clock', d.clockDays + (d.clockDays === 1 ? ' day ahead' : ' days ahead')]);
  if (d.errors) rows.push(['Errors caught', d.errors.length ? String(d.errors.length) : 'none']);
  return rows;
}

// The report as plain text: the review screen, "Copy report" and the email all say this.
export function reportText(report) {
  const lines = ['Shelf Life feedback', 'Kind: ' + (KIND_LABEL[report.kind] || report.kind)];
  if (report.rating) lines.push('Rating: ' + report.rating + ' out of 5' + (report.moment ? ' (' + report.moment + ')' : ''));
  if (report.doing) lines.push('Doing: ' + DOING_LABEL[report.doing]);
  lines.push('Written: ' + report.created, '', report.body || '(nothing written)', '');
  if (!report.diagnostics) { lines.push('Diagnostics: not attached', 'Sent from ' + versionLine()); return lines.join('\n'); }
  lines.push('Diagnostics');
  for (const [label, value] of diagnosticRows(report.diagnostics)) lines.push(label + ': ' + value);
  for (const e of report.diagnostics.errors || []) lines.push('  ' + (e.at ? e.at.slice(0, 19).replace('T', ' ') + ' ' : '') + (e.source ? e.source + ' ' : '') + e.message + (e.count > 1 ? ' (x' + e.count + ')' : ''));
  lines.push('Report id: ' + report.client_id);
  return lines.join('\n');
}
