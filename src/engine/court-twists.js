import { twistsFor } from '../content/court-twists.js';
import { COURT_CAST, HAPPENINGS } from '../content/court.js';

/* Twists, as pure functions. A twist (see content/court-twists.js) is a
   second, third, fourth telling of a case in which the truth is different.
   The opening statements are shared; everything the investigation turns up
   is replaced. Nothing here touches state or the DOM: the engine hands in the
   courtroom record and gets plain answers back, and the tests hand in
   whatever twists they like by writing to TWISTS. */

export const BASE = 'base';                       // the key of the original telling in the records
export const VERSION_KEY = /^[a-z0-9-]{1,40}$/;   // case ids and twist ids share this shape
const UNSEEN_WEIGHT = 3;                          // an unseen version is three times as likely as a seen one
const SPEAKERS = ['judge', 'bailiff', 'p', 'd', 'announcer', 'audience', 'jury', 'narrator', 'npc'];
const SLOTS = ['{p}', '{d}', '{j}'];
const lineSets = v => (v && Array.isArray(v.alt) ? v.alt : [v || []]);

export const versionKeys = caseId => [BASE, ...twistsFor(caseId).map(t => t.id)];
export const versionCount = caseId => 1 + twistsFor(caseId).length;
export const twistById = (caseId, id) => (id && id !== BASE ? twistsFor(caseId).find(t => t.id === id) || null : null);
// The name a version goes by in the Case Notebook: the original is just the original.
export const versionTitle = (caseId, key) => (key === BASE || !key ? 'The original' : twistById(caseId, key)?.title || 'A version this edition does not know');

// A small stable string hash (FNV-1a), so two phones agree on a docket twist.
export function hashText(text) {
  let h = 0x811c9dc5;
  const s = String(text);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/* Which version to air. With a seed (the docket passes the day key) the answer
   is a pure function of the seed and the case, so friends airing the same
   docket get the same puzzle. Without one it is random, and a version the
   player has not seen yet is three times as likely as one they have.
   Returns a twist id, or null for the original. */
export function pickTwist(caseId, rnd = Math.random, seed = '', seen = []) {
  const list = twistsFor(caseId);
  if (!list.length) return null;
  const keys = [BASE, ...list.map(t => t.id)];
  let key;
  if (seed) key = keys[hashText(seed + '|' + caseId) % keys.length];
  else {
    const have = new Set(Array.isArray(seen) ? seen : []);
    const weights = keys.map(k => (have.has(k) ? 1 : UNSEEN_WEIGHT));
    let r = rnd() * weights.reduce((n, w) => n + w, 0);
    key = keys[keys.length - 1];
    for (let i = 0; i < keys.length; i++) { r -= weights[i]; if (r < 0) { key = keys[i]; break; } }
  }
  return key === BASE ? null : key;
}
export const docketTwist = (dayKey, caseId) => pickTwist(caseId, Math.random, String(dayKey || ''));

/* The case as it plays in one version. A question the twist overrides takes
   the override's lines and its clue or herring; its ask, scene, party and
   zinger flag stay as they were unless the override sets them. An override
   with neither clue nor herring turns a clue question into plain colour.
   Questions the twist does not mention are the original's, untouched. */
export function effectiveCase(k, twist) {
  if (!twist) return k;
  const questions = k.questions.map((q, i) => {
    const o = twist.questions && twist.questions[i];
    if (!o) return q;
    const next = { ask: o.ask ?? q.ask, lines: o.lines ?? q.lines };
    if (o.sass ?? q.sass) next.sass = true;
    const happen = 'happen' in o ? o.happen : q.happen, party = 'party' in o ? o.party : q.party;
    if (happen) next.happen = happen;
    if (party) next.party = party;
    if (o.clue) next.clue = o.clue;
    else if (o.herring) next.herring = o.herring;
    return next;
  });
  return { ...k, truth: twist.truth, questions, rulings: twist.rulings, hallway: twist.hallway, turn: twist.turn || null, twist: { id: twist.id, title: twist.title } };
}

// Every neighbour a version calls to the stand, including the twist's hint lines.
export const witnessesOf = k => new Set([...(k ? k.questions : []).flatMap(q => lineSets(q.lines).flat()), ...lineSets(k?.turn).flat()].filter(l => l[0] === 'npc').map(l => l[2]));
// Every neighbour any telling of a case calls, so a stand-in promised in the
// lobby is never a witness in whichever version is drawn.
export function witnessesAnywhere(k) {
  const all = witnessesOf(k);
  for (const t of twistsFor(k.id)) for (const id of witnessesOf(effectiveCase(k, t))) all.add(id);
  return all;
}

/* ---- the courtroom record, read per case ---- */

// key -> best stars, for the versions of this case that have been seen. A save
// from before versions were tracked has one airing on record, and that was the original.
export function versionRecord(c, caseId) {
  const rec = c?.versions && Object.hasOwn(c.versions, caseId) ? c.versions[caseId] : null;
  const out = {};
  for (const key of versionKeys(caseId)) if (rec && Object.hasOwn(rec, key)) out[key] = rec[key];
  if (!rec && c?.best && Object.hasOwn(c.best, caseId)) out[BASE] = c.best[caseId];
  return out;
}
export function versionView(c, caseId) {
  const rec = versionRecord(c, caseId), keys = versionKeys(caseId);
  return {
    of: keys.length, seen: keys.filter(key => Object.hasOwn(rec, key)).length,
    versions: keys.map((key, i) => ({ key, number: i + 1, title: versionTitle(caseId, key), seen: Object.hasOwn(rec, key), stars: rec[key] ?? 0 }))
  };
}
export function versionTotals(c, ids) {
  let seen = 0, of = 0, twistsSeen = 0, twists = 0;
  for (const id of ids) {
    const v = versionView(c, id);
    seen += v.seen; of += v.of; twists += v.of - 1;
    twistsSeen += v.versions.filter(x => x.key !== BASE && x.seen).length;
  }
  return { seen, of, twistsSeen, twists };
}

/* ---- validation, for the test suite and for anyone writing a twist ----
   Returns a list of problems; empty means the twist is sound. */
export function twistProblems(k, twist) {
  const bad = [];
  const where = twist && twist.id ? k.id + '/' + twist.id : k.id;
  const say = text => bad.push(where + ': ' + text);
  if (!twist || typeof twist !== 'object') { say('is not an object'); return bad; }
  if (typeof twist.id !== 'string' || !VERSION_KEY.test(twist.id) || twist.id === BASE) say('id must be kebab-case, at most 40 characters, and not "base"');
  if (typeof twist.title !== 'string' || !twist.title || twist.title.length > 40) say('title must be 1 to 40 characters');
  if (!['plaintiff', 'defendant', 'both'].includes(twist.truth)) say('truth must be plaintiff, defendant or both');
  else if (twist.truth === k.truth) say('truth must differ from the original (' + k.truth + ')');

  const checkLine = (line, label) => {
    if (!Array.isArray(line) || line.length < 2 || line.length > 3) { say(label + ' is not [speaker, text] or [npc, text, castId]'); return; }
    const [speaker, text, who] = line;
    if (!SPEAKERS.includes(speaker)) say(label + ' has the unknown speaker ' + speaker);
    if (speaker === 'npc') {
      if (!Object.hasOwn(COURT_CAST, who)) say(label + ' names the unknown cast member ' + who);
    } else if (who !== undefined) say(label + ' has a cast id but the speaker is ' + speaker);
    checkText(text, label);
  };
  const checkText = (text, label, max = 280) => {
    if (typeof text !== 'string' || !text.trim()) { say(label + ' is empty'); return; }
    if (text.length > max) say(label + ' is ' + text.length + ' characters, over ' + max);
    if (/[\u2013\u2014]/.test(text)) say(label + ' contains a dash');
    if (/["']/.test(text)) say(label + ' uses a straight quote');
    for (const [slot] of text.matchAll(/\{[^}]*\}/g)) if (!SLOTS.includes(slot)) say(label + ' uses the placeholder ' + slot);
  };
  const checkTakes = (value, label, { min = 2, maxLines = 99 } = {}) => {
    if (!value || !Array.isArray(value.alt)) { say(label + ' must be alt(take, take)'); return; }
    if (value.alt.length < min) say(label + ' needs at least ' + min + ' takes');
    const seenTakes = new Set();
    value.alt.forEach((set, i) => {
      if (!Array.isArray(set) || !set.length) { say(label + ' take ' + (i + 1) + ' is empty'); return; }
      if (set.length > maxLines) say(label + ' take ' + (i + 1) + ' has more than ' + maxLines + ' lines');
      const key = JSON.stringify(set);
      if (seenTakes.has(key)) say(label + ' repeats a take word for word');
      seenTakes.add(key);
      set.forEach((line, j) => checkLine(line, label + ' take ' + (i + 1) + ' line ' + (j + 1)));
    });
  };

  if (twist.turn !== undefined) checkTakes(twist.turn, 'turn', { min: 1, maxLines: 4 });

  const overrides = twist.questions && typeof twist.questions === 'object' ? twist.questions : null;
  if (!overrides) say('questions must be an object keyed by question index');
  else for (const [key, o] of Object.entries(overrides)) {
    const label = 'question ' + key;
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index >= k.questions.length || String(index) !== key) { say(label + ' is not a base question index'); continue; }
    if (!o || typeof o !== 'object') { say(label + ' is not an object'); continue; }
    checkTakes(o.lines, label + ' lines');
    if (o.clue !== undefined && o.herring !== undefined) say(label + ' has both a clue and a herring');
    if (o.clue !== undefined) checkText(o.clue, label + ' clue', 140);
    if (o.herring !== undefined) checkText(o.herring, label + ' herring', 140);
    if (o.ask !== undefined) checkText(o.ask, label + ' ask', 140);
    if (o.sass !== undefined && typeof o.sass !== 'boolean') say(label + ' sass must be true or false');
    if (o.party !== undefined && !['p', 'd'].includes(o.party)) say(label + ' party must be p or d');
    if (o.happen !== undefined && !Object.hasOwn(HAPPENINGS, o.happen)) say(label + ' happen names the unknown scene ' + o.happen);
  }

  if (!twist.rulings || typeof twist.rulings !== 'object') say('rulings must have plaintiff, defendant and both');
  else for (const r of ['plaintiff', 'defendant', 'both']) checkTakes(twist.rulings[r], 'ruling ' + r);

  if (!twist.hallway || typeof twist.hallway !== 'object') say('hallway must have p and d');
  else for (const side of ['p', 'd']) {
    const list = twist.hallway[side];
    if (!Array.isArray(list) || list.length !== 3) say('hallway ' + side + ' must be exactly three strings');
    else list.forEach((t, i) => checkText(t, 'hallway ' + side + ' line ' + (i + 1)));
  }

  // The invariants the engine and the old tests rely on, checked on the version as it plays.
  if (!bad.length) {
    const e = effectiveCase(k, twist);
    if (e.questions.length !== 6) say('the version has ' + e.questions.length + ' questions, not 6');
    if (e.questions.filter(q => q.clue).length < 2) say('the version needs at least two clue questions');
    if (e.questions.filter(q => !q.clue).length < 2) say('the version needs at least two questions that are not clues');
    if (!e.questions.some(q => q.sass)) say('the version needs a zinger');
    if (e.questions.filter(q => q.herring).length > 1) say('the version has more than one herring');
  }
  return bad;
}
