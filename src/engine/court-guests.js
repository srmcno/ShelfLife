import { readResident, cleanText } from '../cloud/social.js';

/* Residents visiting from a friend's shelf can be seated on the jury or called
   as a character witness. The visit itself belongs to the Friends postbox
   (state.visits.guests, each { visitId, from: { userId, name }, resident,
   arrived, leaves }); the court only reads it, and reads it as if it might be
   missing, malformed or from a newer edition. A guest is seated as kind
   'visitor' so nothing in the court mistakes it for a resident of this shelf:
   it gets no trust, no grudge, no memory and no podium. */
export const COURT_GUESTS_MAX = 2;
const VISIT_ID = /^[\w-]{1,64}$/;
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);

export function visitingGuests(state, now = Date.now()) {
  const visits = state?.visits;
  const list = record(visits) && Array.isArray(visits.guests) ? visits.guests : [];
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
