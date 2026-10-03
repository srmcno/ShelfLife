import { HEADLINES, QUEUE_LINES, RESIDENT_LINES, BOARD_LINES, CHAPTER_LINE, CHEST_LINE } from '../content/returns.js';
import { RETURN_XP_PER_DAY } from '../content/almanac.js';
import { returnsState } from '../almanac-state.js';
import { mayhemState } from '../mayhem-state.js';
import { localDayKey } from '../state.js';
import { addSouls } from './mayhem.js';
import { grantXp, chapterAt, daysLeft } from './almanac.js';

/* ================= WHILE YOU WERE AWAY =================
   Come back after 16 hours or more (a skipped day, not a night’s sleep) and the shelf has a card for you: what it
   got up to, and a chest. The chest grows with the days away, up to seven, and
   is claimed once per return, once per day. There is no penalty for being gone
   and no copy that suggests one. Being away is allowed.

   The clock is the device’s, as for the omen and the docket. A chest is a few
   hundred souls at most and one a day, so there is nothing to gain by lying to it. */

export const RETURN_AFTER_MS = 16 * 3600000;
export const RETURN_MAX_DAYS = 7;
const DAY = 86400000;

// Whole days away, as far as the chest is concerned: capped at a week.
export function daysAway(ms) { return Math.min(RETURN_MAX_DAYS, Math.floor(ms / DAY)); }
export function chestFor(days) { return { souls: 20 + 40 * days, xp: days ? RETURN_XP_PER_DAY * days : 5 }; }

function pickFrom(list, n) { return list[Math.abs(Math.floor(n)) % list.length]; }
const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : '{' + k + '}'));

// The card’s lines. They use only what the shelf already knows, so a household with
// one resident, or no scenes, still reads naturally.
export function awayLines(state, from, to, days, serial, now = to) {
  const pets = state.pets || [], m = mayhemState(state), lines = [];
  const bucket = days >= 3 ? 'many' : days >= 1 ? 'few' : 'short';
  lines.push(pickFrom(HEADLINES[bucket], serial));
  const n = m.queue.length;
  lines.push(fill(pickFrom(QUEUE_LINES[n === 0 ? 'none' : n === 1 ? 'one' : 'many'], serial + 1), { n }));
  if (pets.length) {
    // The resident with the most to say is the one in the most need; ties go to whoever is next in line.
    const need = p => Math.min(...Object.values(p.needs || { x: 100 }));
    const sorted = pets.slice().sort((x, y) => need(x) - need(y));
    const a = sorted[serial % Math.min(sorted.length, 3)], others = pets.filter(p => p.id !== a.id);
    const b = others.length ? others[(serial + 1) % others.length] : null;
    const line = pickFrom(RESIDENT_LINES.filter(l => b || !l.includes('{b}')), serial * 3 + 2);
    lines.push(fill(line, { a: a.name, b: b ? b.name : 'the lamp' }));
  }
  const scenes = (state.life?.scenes || []).filter(s => s && s.at > from);
  const notes = (state.notes || []).filter(x => x && x.at > from).length;
  lines.push(scenes.length ? fill(BOARD_LINES.scene, { t: scenes[0].title }) : notes > 1 ? fill(BOARD_LINES.notes, { n: notes }) : BOARD_LINES.quiet);
  const chapter = chapterAt(now);
  if (chapter) { const left = daysLeft(chapter, now); lines.push(fill(CHAPTER_LINE, { name: chapter.name, n: left, days: left === 1 ? 'day' : 'days' })); }
  return lines;
}

/* Notice a return. Call on every render: it is cheap, and the first call after a
   long gap is the one that notices. Returns the pending card, or null. */
export function checkReturn(state, now = Date.now()) {
  const r = returnsState(state), pets = state.pets || [];
  if (!pets.length) { r.seenAt = now; r.pending = null; return null; }
  // A household with no recorded visit has nothing to welcome back from yet.
  if (!r.seenAt || now < r.seenAt) { r.seenAt = now; return r.pending; }
  const away = now - r.seenAt, day = localDayKey(now);
  if (away >= RETURN_AFTER_MS && r.claimedDay !== day) {
    const days = daysAway(away), chest = chestFor(days);
    if (r.pending) {
      // Gone again before opening the last one: the chest keeps the longer absence rather than stacking.
      const longer = Math.max(r.pending.days, days), c = chestFor(longer);
      r.pending = { ...r.pending, days: longer, souls: c.souls, xp: c.xp, to: now, day };
    } else {
      r.serial += 1;
      r.pending = { id: r.serial, from: r.seenAt, to: now, days, souls: chest.souls, xp: chest.xp, day, lines: awayLines(state, r.seenAt, now, days, r.serial, now) };
    }
  }
  r.seenAt = now;
  return r.pending;
}

export function pendingReturn(state) { return returnsState(state).pending; }
export function chestLine(p) { return fill(CHEST_LINE, { souls: p.souls, xp: p.xp }); }

export function claimReturn(state, now = Date.now()) {
  const r = returnsState(state), p = r.pending;
  if (!p) return null;
  r.pending = null;
  r.claimedDay = localDayKey(now);
  r.claimed += 1;
  const rankUp = addSouls(state, p.souls);
  grantXp(state, p.xp, now);
  return { souls: p.souls, xp: p.xp, days: p.days, rankUp };
}
// Closing the card without claiming keeps the chest for the next visit; it is not discarded.
