import { readResident, cleanText } from '../cloud/social.js';

/* Residents visiting from a friend's shelf can be seated on the jury or called
   as a character witness. The visit itself belongs to the Friends postbox
   (state.friendVisits.guests, each { visitId, from: { userId, name }, resident,
   arrived, leaves }); the court only reads it, and reads it as if it might be
   missing, malformed or from a newer edition. A guest is seated as kind
   'visitor' so nothing in the court mistakes it for a resident of this shelf:
   it gets no trust, no grudge, no memory and no podium. */
export const COURT_GUESTS_MAX = 2;
const VISIT_ID = /^[\w-]{1,64}$/;
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);

export function visitingGuests(state, now = Date.now()) {
  // The postbox keeps guests in state.friendVisits (src/visits-state.js). An
  // older draft of the brief named it state.visits, which is still read as a
  // fallback; `visits` may also be the array of the player's own sessions, and
  // only a `guests` list on it means anything here.
  const pick = v => v && typeof v === 'object' && Array.isArray(v.guests) ? v.guests : null;
  const list = pick(state?.friendVisits)?.length ? state.friendVisits.guests : pick(state?.visits) || [];
  const out = [], seen = new Set();
  for (const g of list.slice(0, 12)) {
    if (!record(g) || typeof g.visitId !== 'string' || !VISIT_ID.test(g.visitId) || seen.has(g.visitId)) continue;
    const arrived = Number(g.arrived), leaves = Number(g.leaves);
    if ((Number.isFinite(leaves) && leaves <= now) || (Number.isFinite(arrived) && arrived > now)) continue;
    const resident = readResident(g.resident);
    if (!resident) continue;
    seen.add(g.visitId);
    out.push({ kind: 'visitor', id: 'visit-' + g.visitId, name: resident.name, from: cleanText(record(g.from) ? g.from.name : '', 24) || 'a friend', resident });
    if (out.length >= COURT_GUESTS_MAX) break;
  }
  return out;
}
