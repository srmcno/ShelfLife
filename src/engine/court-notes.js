/* The judge's case notes for one episode, and the Objection that checks them.
   This file depends on nothing so both the episode (engine/court.js) and the
   Objection (engine/court-objection.js) can use it.

   A note is a clue (true, points at the truth) or a lead (a red herring that
   points the wrong way). Either may be shaky: leads always are, and so is a
   clue that came from someone who exaggerates. A shaky note earns nothing with
   the jury until it is checked. The single Objection each episode checks one:
   a lead is struck from the record and a shaky clue is confirmed. `ep.clues`
   mirrors the notes still standing, as plain text. */
export const OBJECTIONS_PER_EPISODE = 1;

export function startNotes(ep) {
  ep.notes = []; ep.clues = []; ep.spent = []; ep.objections = OBJECTIONS_PER_EPISODE;
}
export const standingNotes = ep => (ep.notes || []).filter(n => n.state !== 'struck');
function sync(ep) { ep.clues = standingNotes(ep).map(n => n.text); }

export function addNote(ep, { text, kind = 'clue', shaky = false, from = null, index = -1 }) {
  const note = { id: ep.notes.length, text, kind, shaky: !!shaky, state: '', from, index };
  ep.notes.push(note);
  sync(ep);
  return note;
}
// The notes still waiting for an Objection to settle them.
export const needsCheck = ep => (ep.notes || []).filter(n => n.shaky && !n.state);
export const settle = (ep, note, state) => { note.state = state; sync(ep); };
