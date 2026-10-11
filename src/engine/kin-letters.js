// Pen pal letters, written on the device from the pools in content/kin.js.
//
// Deterministic: the same pen pal pair (its server-issued seed), the same
// server week and the same two residents always give the same letter, on
// either shelf. Each pool is walked in a fixed order per pair, one step a
// week, so a line does not come round again until the whole pool has.
import { OPENINGS, MIDDLES, SIGNOFFS, TRAIT_PS, GENERAL_PS, REPLIES, TRAIT_REPLIES, REPLY_SIGNOFFS, REPLY_TONES } from '../content/kin.js';
import { COURT_BY_ID } from './court.js';

export const LETTER_MAX = 720;
export const REPLY_MAX = 320;
export const HISTORY_KINDS = ['hearing', 'foundling', 'twin', 'introduced', 'visit', 'trade', 'hex', 'hire'];
const MOODS = ['content', 'fine', 'annoyed', 'furious'];

function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
const gcd = (x, y) => (y ? gcd(y, x % y) : x);
// The k-th step of a walk through n items that visits every one before repeating.
export function walk(n, key, k) {
  if (n <= 1) return 0;
  const h = hash(key);
  let step = 1 + (Math.floor(h / n) % (n - 1));
  while (gcd(step, n) !== 1) step = step % (n - 1) + 1;
  return ((h % n) + ((Math.floor(k) % n) + n) % n * step) % n;
}

const name = (card, fallback) => (typeof card?.name === 'string' && card.name.trim() ? card.name.trim() : fallback);
function fill(text, values) {
  return text.replace(/\{(to|from|case|child)\}/g, (_, key) => values[key]);
}
export function caseTitle(caseId) {
  const title = COURT_BY_ID[caseId]?.title;
  return title ? '“' + title + '”' : 'our hearing';
}

export function letterPools(history, mood) {
  const kind = HISTORY_KINDS.includes(history) ? history : 'introduced';
  return {
    openings: OPENINGS.filter(o => o.mood === 'any' || o.mood === (MOODS.includes(mood) ? mood : 'fine')).map(o => o.text),
    middles: [...MIDDLES[kind], ...MIDDLES.any]
  };
}

// { seed, week, history, writer: { name, traits, mood }, reader: { name }, caseId, child }
export function writeLetter({ seed, week, history, writer, reader, caseId = '', child = '' }) {
  const key = 'pal:' + (Number(seed) >>> 0) + ':' + history;
  const k = Math.max(0, Math.floor(Number(week) || 0));
  const from = name(writer, 'Someone'), to = name(reader, 'Someone');
  const pools = letterPools(history, writer?.mood);
  const traits = (Array.isArray(writer?.traits) ? writer.traits : []).filter(t => Object.hasOwn(TRAIT_PS, t));
  const opening = pools.openings[walk(pools.openings.length, key + ':open:' + (writer?.mood || 'fine'), k)];
  const middle = pools.middles[walk(pools.middles.length, key + ':middle', k)];
  const signoff = SIGNOFFS[walk(SIGNOFFS.length, key + ':signoff', k)];
  // The quirks get every other week; the shelf's general P.S. the rest.
  const ps = traits.length && k % 2 === 0
    ? TRAIT_PS[traits[Math.floor(k / 2) % traits.length]]
    : GENERAL_PS[walk(GENERAL_PS.length, key + ':ps', k)];
  const values = { to, from, case: caseTitle(caseId), child: child || 'the foundling' };
  const body = fill(opening + ' ' + middle, values);
  const parts = { greeting: 'Dear ' + to + ',', body, signoff, from, ps: 'P.S. ' + fill(ps, values) };
  const text = [parts.greeting, parts.body, parts.signoff + '\n' + parts.from, parts.ps].join('\n\n');
  return { text: text.slice(0, LETTER_MAX), parts };
}

// The three replies a resident would plausibly write to a weekly letter:
// fond, dry and petty, with its own quirk taking the dry or petty place.
// `writer` is the one replying; `reader` the one who wrote the letter.
export function replyOptions({ seed, week, writer, reader }) {
  const key = 'reply:' + (Number(seed) >>> 0);
  const k = Math.max(0, Math.floor(Number(week) || 0));
  const from = name(writer, 'Someone'), to = name(reader, 'Someone');
  const quirks = (Array.isArray(writer?.traits) ? writer.traits : []).filter(t => Object.hasOwn(TRAIT_REPLIES, t));
  const quirk = quirks.length ? TRAIT_REPLIES[quirks[k % quirks.length]] : null;
  const quirkSlot = quirk ? 1 + (hash(key + ':slot:' + k) % 2) : -1;
  return REPLY_TONES.map((tone, i) => {
    const line = i === quirkSlot ? quirk : REPLIES[tone][walk(REPLIES[tone].length, key + ':' + tone, k)];
    const signoff = REPLY_SIGNOFFS[walk(REPLY_SIGNOFFS.length, key + ':signoff:' + tone, k)];
    const text = ['Dear ' + to + ',', line, signoff + '\n' + from].join('\n\n');
    return { tone, line, text: text.slice(0, REPLY_MAX) };
  });
}
