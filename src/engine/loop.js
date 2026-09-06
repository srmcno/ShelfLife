import { tick, moodOf, worstNeed, isAsleep, neighborProps, neighborPets } from './tick.js';
import { activeFeuds, feudPairKey, stepFeudArc, fileGrudge, checkinStreak, FEUD_STEP_MS } from './achievements.js';
import { checkUnlocks } from './unlocks.js';
import { runBehavior, behaviorState } from './behavior.js';
import { pickDialogue, dialogueText } from './dialogue.js';
import { TRAIT_BY_ID } from '../content/traits.js';
import { DRAWN_NOTES } from '../content/care.js';
import { PROPS } from '../content/props.js';
import {
  COMPLAINTS, NEIGHBOR_COMPLAINTS, HAPPY_NOTES, EVENTS, LIST_NOTES, SILENCE_NOTES,
  PET_LIST_NOTES, PET_SILENCE_LINES, FOUND_PET_LINES, FAVOURITE_LINES, ABSENCE_LINES, RENAME_LINES,
  GONE_LINES, GRID_LINES, GRUDGE_COUNT_LINES, RECORD_LINES, BRIEFING_LINES, STRUCK_LINES,
  DIRECT_LINES, MINUTES_DOCS, SOLO_MINUTES_DOCS, CARE_RECORD_DOCS, ROTA_DOCS, STRIKE_DOCS,
  EMPTY_SHELF_NOTES, PROP_EYE_LINES, SLEEPING_NOTES
} from '../content/copy.js';
import { TRAIT_INNER, INNER_LINES, DREAM_LINES } from '../content/inner.js';
import { MATURE_COMPLAINTS_EXTRA, MATURE_HAPPY_EXTRA, MATURE_EVENTS_EXTRA } from '../content/mature.js';
import {
  pick, addNote, petById, chooseForm, reconcile, recordVisit, firstTouchCounts,
  totalGrudges, formAllowed, wasPickedRecently, rememberPick, forgetPick, HOUR, ROW_WIDTH
} from '../state.js';

export const DAY = 86400000;
export const ABSENCE_HOURS = 3;          // a gap worth remarking on
// Check the shelf gets a short restock like the rounds trolley: enough to stop a
// run of taps flooding the board, short enough never to be noticed in play.
export const CHECK_COOLDOWN_MS = 8000;
// A check runs the residents' own behaviour pass at most this often. Every tap
// used to force one, so the shelf was simulated as fast as it was clicked.
export const CHECK_BEHAVIOR_MS = 90000;
// How many feuds get a written line per check. Every active feud still steps.
export const FEUD_NOTES_PER_CHECK = 2;

export function checkWait(state, now = Date.now()) {
  return Number.isFinite(state.lastCheck) && state.lastCheck > 0 ? Math.max(0, state.lastCheck + CHECK_COOLDOWN_MS - now) : 0;
}
export const GONE_FRESH_DAYS = 7;
export const GONE_CADENCE_FRESH = 15;    // one {gone} line every N notes for a week
export const GONE_CADENCE_OLD = 60;      // and every N notes forever after
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* ================= DIALOGUE =================
   engine/dialogue.js names its forms in the spec's prose ('two-hander') and draws
   with its own rng, so two things happen at this boundary and nowhere else: the
   names are mapped onto the eight rotation tags, and the scene is put through the
   same recent-line suppression as every other pool. */
export const DIALOGUE_FORM = { 'two-hander': 'two', reaction: 'react', direct: 'direct', line: 'line', chorus: 'react' };
// Which of its scene kinds produce which rotation form, so a slot that the budget
// says should be a two-hander asks for one rather than taking whatever comes back.
export const FORM_KINDS = {
  two: ['trait', 'generic', 'feud'], react: ['reaction', 'chorus'], direct: ['direct'], line: ['fragment']
};
export const DIALOGUE_TRIES = 6;
const NEED_WORD = { food: 'left hungry', fuss: 'left lonely', clean: 'left grubby' };

// Asks for a scene until it offers one the corkboard has not shown lately. Returns
// null rather than repeating itself — a pet with one written scene stays quiet
// instead of saying the same thing twice in a session.
export function freshDialogue(state, opts = {}) {
  const kinds = opts.form ? FORM_KINDS[opts.form] : null;
  for (let i = 0; i < DIALOGUE_TRIES; i++) {
    // Steer the first attempts toward the form the budget asked for, then let it
    // choose freely rather than come back empty.
    const kind = kinds && i < DIALOGUE_TRIES - 2 ? kinds[i % kinds.length] : undefined;
    const d = pickDialogue(state, kind ? Object.assign({}, opts, { kind }) : opts);
    // A steered kind with no material is not the end of it: the next kind for
    // the same form, then anything, gets a go before the pet says nothing.
    if (!d) { if (kind) continue; return null; }
    const text = dialogueText(d);
    if (!text || wasPickedRecently(text)) continue;
    const form = DIALOGUE_FORM[d.form] || 'line';
    rememberPick(text);
    return { text, from: d.from, tone: d.tone || 'note', form, kind: d.kind, cast: d.cast };
  }
  return null;
}

// Whether this slot on the board should be a scene rather than a report. Decided by
// the same weight table as everything else: the two-hander is the largest share
// after the plain one-liner, so scenes are supposed to be common.
function wantsScene(state) {
  if (state.pets.length < 2) return null;
  const f = chooseForm(state, ['two', 'react', 'line']);
  return f === 'line' ? null : f;
}

/* ================= SUBSTITUTION =================
   fill() never invents. A template is only ever drawn from a pool after canFill()
   has confirmed the save file can back every placeholder in it, which is what stops
   "you went to Gary first 11 times" from appearing on a shelf that has no such
   record. Decorative numbers are banned in the content; these are the real ones. */

export function fill(text, subs) {
  return String(text).replace(/\{(\w+)\}/g, (m, k) => (subs && subs[k] != null ? String(subs[k]) : m));
}

export function canFill(text, subs) {
  const wanted = String(text).match(/\{(\w+)\}/g);
  if (!wanted) return true;
  return wanted.every(t => subs && subs[t.slice(1, -1)] != null);
}

export function fillable(pool, subs) {
  return (pool || []).filter(t => canFill(t, subs));
}

// Draws a template the shuffle bag has not used lately, then fills it. Returns
// null rather than a half-substituted string when nothing in the pool fits.
export function pickFilled(pool, subs) {
  const usable = fillable(pool, subs);
  if (!usable.length) return null;
  return fill(pick(usable), subs);
}

function weekdayOf(ts) { return WEEKDAYS[new Date(ts).getDay()]; }
function wholeDays(ms) { return Math.max(1, Math.floor(ms / DAY)); }

// Templates phrase these as "{n} days", "{n} times", "{n} visits". Withholding the
// sub at one is cheaper and better than writing every line twice: canFill() simply
// does not offer those templates yet, and a different one is drawn instead.
function plural(n) { return n >= 2 ? String(n) : null; }

/* Everything the note templates are allowed to know, read straight off the save.
   A key is only set when the value behind it is real — an absent key means the
   templates that want it are simply not offered this time. */
export function subsFor(state, ctx = {}, now = Date.now()) {
  const s = {};
  const slots = state.slots || [];
  const ledger = state.ledger || {};
  const visits = state.visits || [];
  const pet = ctx.pet || null;

  s.G = String(totalGrudges(state));
  s.nP = String((state.pets || []).length + 1);   // the shelf always counts one too many
  s.tot = plural(visits.length);
  if (typeof ledger.meeting === 'number') s.mtg = String(ledger.meeting);
  if (typeof ledger.carried === 'number') s.carr = String(ledger.carried);
  // Only the ordinal, never a plural count: engine/achievements.js substitutes
  // {d} and nothing else, and "1 days" is how a line stops being funny.
  if (state.streak && state.streak.count > 0) s.d = String(state.streak.count);

  const counts = firstTouchCounts(state);
  let favId = null, favN = 0;
  Object.keys(counts).forEach(id => { if (counts[id] > favN) { favN = counts[id]; favId = id; } });
  if (favId) {
    const favPet = petById(state, favId);
    if (favPet) { s.fav = favPet.name; s.favN = plural(favN); }
  }

  // Real empty slots, so "four better ones were free" is never a number the save
  // file cannot back — the whole point of lever 3.
  const free = slots.filter(x => !x).length;
  if (free >= 2) s.free = String(free);

  const visit = visits[visits.length - 1];
  if (visit && visit.away >= ABSENCE_HOURS * HOUR) s.h = String(Math.round(visit.away / HOUR));

  if (pet) {
    s.p = pet.name;
    s.selfN = String(counts[pet.id] || 0);
    const idx = slots.indexOf(pet.id);
    if (idx >= 0) {
      s.slot = String(idx + 1);                   // slots are numbered from one, six to a row
      // {home} exists so "has been in slot 4 since it arrived" can never be said
      // about a pet that has since walked to slot 2.
      if ((pet.slotHist || []).length <= 1) s.home = s.slot;
    }
    if (pet.grudges > 0) s.g = String(pet.grudges);
    if (pet.bestFuss > 0) {
      s.best = String(pet.bestFuss);
      if (pet.bestFussAt) s.bestDay = weekdayOf(pet.bestFussAt);
    }
    if (pet.careLog) {
      s.food = String(pet.careLog.food || 0);
      s.fuss = String(pet.careLog.fuss || 0);
      s.clean = String(pet.careLog.clean || 0);
    }
    const names = pet.names || [];
    if (names.length > 1) {
      const prev = names[names.length - 2], cur = names[names.length - 1];
      s.old = prev.name;
      const held = cur.at - prev.at;
      if (held >= DAY) s.days = plural(wholeDays(held));
    }
    const hist = pet.slotHist || [];
    const move = hist[hist.length - 1];
    if (move && move.from != null && now - move.at < DAY) {
      s.i = String(move.from + 1);
      s.j = String(move.slot + 1);
    }
    const struckAt = (ledger.struck || {})[pet.id];
    if (struckAt) s.strk = plural(wholeDays(now - struckAt));
  }

  if (ctx.n) s.n = ctx.n.name || ctx.n;
  if (ctx.m) s.m = ctx.m.name || ctx.m;
  // Templates say "the {q}", so a prop called The Urn arrives as plain Urn.
  if (ctx.q) s.q = ((PROPS[ctx.q] && PROPS[ctx.q].name) || ctx.q).replace(/^The /, '');

  if (ctx.a && ctx.b) {
    s.a = ctx.a.name; s.b = ctx.b.name;
    const ia = slots.indexOf(ctx.a.id), ib = slots.indexOf(ctx.b.id);
    // {c} is only ever the pet physically caught between the two of them.
    if (ia >= 0 && ib >= 0 && Math.abs(ia - ib) === 2 &&
        Math.floor(ia / ROW_WIDTH) === Math.floor(ib / ROW_WIDTH)) {
      const between = petById(state, slots[(ia + ib) / 2]);
      if (between) s.c = between.name;
    }
  }

  if (ctx.gone) {
    s.gone = ctx.gone.name;
    s.goneD = plural(wholeDays(now - ctx.gone.at));
    if (ctx.gone.slot >= 0) s.slot = String(ctx.gone.slot + 1);
  }
  return s;
}

/* ================= FORM SELECTION =================
   Each note offers the forms it can actually supply content for. chooseForm() then
   applies the two rotation rules to that set. Every slot below offers at least one
   plain one-liner and three distinct other forms, which is the condition under
   which both rules are always satisfiable — see test/comedy.test.mjs. */

function offer(byForm, form, pool, subs, kind) {
  const usable = fillable(pool, subs);
  if (!usable.length) return;
  (byForm[form] || (byForm[form] = [])).push({ pool: usable, kind: kind || 'note' });
}

function drawFrom(byForm, state, subs) {
  const cands = Object.keys(byForm);
  if (!cands.length) return null;
  // The fallback is the candidate set itself: a block of prose must never widen
  // into 'doc' and pick up the typed-document treatment in ui/render.js.
  const form = chooseForm(state, cands, Math.random, cands);
  const options = byForm[form] || byForm[cands[0]];
  // Care responses and other off-board draws can exhaust the shared shuffle
  // memory before forty notes have passed. Check the actual, filled-in board
  // too, while keeping the chosen prose form and its rotation rules intact.
  const visible = new Set((state.notes || []).map(note => note.text));
  const fresh = options.map(opt => ({ ...opt, pool: opt.pool.filter(line => !visible.has(fill(line, subs))) }))
    .filter(opt => opt.pool.length);
  const opt = pick(fresh.length ? fresh : options);
  return { text: fill(pick(opt.pool), subs), kind: opt.kind, form: byForm[form] ? form : cands[0] };
}

/* ================= THE PET NOTE ================= */

export function petLine(state, pet, ctx = {}) {
  const now = ctx.now || Date.now();
  const ledger = state.ledger || {};
  const idx = (state.slots || []).indexOf(pet.id);
  const nbrs = idx >= 0 ? neighborPets(state, idx) : [];
  const neighbor = nbrs.length ? pick(nbrs) : null;
  const nearProps = idx >= 0 ? neighborProps(state, idx) : [];
  const nearProp = nearProps.length ? pick(nearProps) : null;
  const subs = subsFor(state, Object.assign({ pet, n: neighbor, q: nearProp ? nearProp.kind : undefined }, ctx), now);
  const mood = moodOf(pet);
  const need = worstNeed(pet);

  // 4b, the Briefing. A creature that was not here for any of it, quoting the total.
  if (pet.briefPending) {
    pet.briefPending = false;
    pet.briefed = true;
    const text = pickFilled(BRIEFING_LINES, subs);
    if (text) return { text, kind: 'note', form: 'direct' };
  }

  // 4a, after Item 4 is struck: this pet is barred from forms 6 and 7 for good and
  // never mentions the matter again. The absence is the joke.
  const struck = !!(ledger.struck || {})[pet.id];
  if (struck) {
    const byForm = {};
    offer(byForm, 'line', STRUCK_LINES, subs);
    offer(byForm, 'silence', PET_SILENCE_LINES, subs);
    offer(byForm, 'found', FOUND_PET_LINES, subs);
    offer(byForm, 'list', PET_LIST_NOTES, subs);
    const drawn = drawFrom(byForm, state, subs);
    if (drawn) return drawn;
  }

  // A sleeping creature is a quiet one: no complaints, no paperwork, no turning
  // round to address you. It gets the board's report of it, the silence, or — the
  // only place dreams are ever printed — form 9.
  if (ctx.asleep || isAsleep(pet, new Date(now))) {
    const dozing = {};
    offer(dozing, 'line', SLEEPING_NOTES, subs);
    offer(dozing, 'thought', DREAM_LINES, subs);
    offer(dozing, 'silence', PET_SILENCE_LINES, subs);
    const asleepDraw = drawFrom(dozing, state, subs);
    if (asleepDraw) return asleepDraw;
  }

  const byForm = {};
  const angry = mood === 'furious' || mood === 'annoyed';
  // The mood sets the tag, not the pool: a list of the things a furious creature
  // has not forgiven is an angry note, and it still turns the paper red and still
  // counts against you. Anything else lets a furious pet file a neutral note.
  const kind = angry ? 'angry' : 'note';
  const trait = TRAIT_BY_ID[pick(pet.traits || [])] || {};

  // Everyday supply. Form 1 is load-bearing and has to stay short and plentiful.
  if (angry) {
    let pool = COMPLAINTS[need][mood];
    if (state.settings && state.settings.matureMode) pool = pool.concat(MATURE_COMPLAINTS_EXTRA[need] || []);
    offer(byForm, 'line', pool, subs, kind);
    if (neighbor) offer(byForm, 'react', NEIGHBOR_COMPLAINTS[need], subs, kind);
  } else {
    if (pet.art && !pet.art.creature && pet.art.body) offer(byForm, 'line', DRAWN_NOTES, subs, kind);
    if (trait.notes) offer(byForm, 'line', trait.notes, subs, kind);
    if (subs.q) offer(byForm, 'line', PROP_EYE_LINES, subs, kind);
    if (mood === 'content') {
      let happy = HAPPY_NOTES;
      if (state.settings && state.settings.matureMode) happy = happy.concat(MATURE_HAPPY_EXTRA);
      offer(byForm, 'line', happy, subs, kind);
    }
    if (neighbor && trait.social) offer(byForm, 'react', trait.social, subs, kind);
  }

  // FORM 9, the inner voice. Its own archetypes first — a Spiteful creature and a
  // Porcelain one keep very different things to themselves — then the general
  // register for the mood it is actually in. This is the only pool in the game
  // that is not something the shelf saw or something a creature said out loud.
  (pet.traits || []).forEach(id => {
    if (TRAIT_INNER[id]) offer(byForm, 'thought', TRAIT_INNER[id], subs, kind);
  });
  offer(byForm, 'thought', INNER_LINES[mood] || INNER_LINES.fine, subs, kind);

  // Lever 3. These are rarer than the everyday pools on purpose: the accusation
  // works because the number is real and because it is not said every time.
  if (subs.fav && Number(subs.tot) >= 4) offer(byForm, 'line', FAVOURITE_LINES, subs, kind);
  if (subs.g && Number(subs.g) >= 5) offer(byForm, 'line', GRUDGE_COUNT_LINES, subs, kind);
  if (subs.old) offer(byForm, 'line', RENAME_LINES, subs, kind);
  if (subs.best && Number(subs.best) >= 2) offer(byForm, 'line', RECORD_LINES, subs, kind);
  offer(byForm, 'found', FOUND_PET_LINES, subs, kind);
  offer(byForm, 'found', GRID_LINES, subs, kind);
  offer(byForm, 'list', PET_LIST_NOTES, subs, kind);
  offer(byForm, 'silence', PET_SILENCE_LINES, subs, kind);

  // Forms 6 and 7 are gated by the caller (one document per batch, one direct
  // address per visit) and barred outright for a pet whose Item 4 was struck.
  const cared = (pet.careLog && (pet.careLog.food + pet.careLog.fuss + pet.careLog.clean)) || 0;
  if (ctx.allowDoc && !struck && cared >= 6) offer(byForm, 'doc', CARE_RECORD_DOCS, subs, kind);
  if (ctx.allowDirect && !struck) offer(byForm, 'direct', DIRECT_LINES, subs, kind);

  const drawn = drawFrom(byForm, state, subs);
  if (drawn) return drawn;
  return { text: pick(HAPPY_NOTES), kind, form: 'line' };
}

/* ================= THE SHELF NOTE ================= */

export function shelfNote(state, ctx = {}, now = Date.now()) {
  const subs = subsFor(state, ctx, now);
  const byForm = {};
  let events = EVENTS;
  if (state.settings && state.settings.matureMode) events = events.concat(MATURE_EVENTS_EXTRA);
  offer(byForm, 'line', events.filter(l => l.length <= 90), subs);
  offer(byForm, 'found', events, subs);
  offer(byForm, 'list', LIST_NOTES, subs);
  offer(byForm, 'silence', SILENCE_NOTES, subs);
  if (subs.h) {
    offer(byForm, 'line', ABSENCE_LINES, subs);
    if (ctx.allowDoc) offer(byForm, 'doc', ROTA_DOCS, subs);
  }
  if (ctx.gone) offer(byForm, 'found', GONE_LINES, subs);
  const carried = Number(subs.carr || 0);
  if (ctx.allowDoc && carried >= 2) {
    if (ctx.a && ctx.b) offer(byForm, 'doc', MINUTES_DOCS, subs);
    else if ((state.pets || []).length === 1 && ctx.pet) offer(byForm, 'doc', SOLO_MINUTES_DOCS, subs);
  }
  return drawFrom(byForm, state, subs);
}

// Kept as the historical entry point. The random swap-with-a-neighbor and the
// thief's snack raid both live in engine/behavior.js now, where they are one
// motive among many rather than the only two things a pet ever does on its own.
export function autonomy(state, now = Date.now()) {
  return runBehavior(state, now, { force: true });
}

/* A rehomed pet keeps generating notes forever: state.gone is never pruned, and
   ui/card.js has always told the player "It does not come back." Roughly one note
   in fifteen for the first week, one in sixty thereafter. */
function goneDue(state, now) {
  const gone = state.gone || [];
  if (!gone.length) return null;
  const rec = pick(gone);
  const fresh = now - rec.at < GONE_FRESH_DAYS * DAY;
  const due = fresh ? GONE_CADENCE_FRESH : GONE_CADENCE_OLD;
  if ((state.noteCount || 0) - (state.lastGoneNote || 0) < due) return null;
  return rec;
}

// Another meeting held, another meeting at which you were Item 4 and Item 4 was
// carried forward. The player has been watching this number climb without being
// told it was a countdown.
export function convene(state) {
  state.ledger.meeting = (state.ledger.meeting || 1) + 1;
  state.ledger.carried = (state.ledger.carried || 0) + 1;
}

export function checkShelf(state, now = Date.now()) {
  tick(state, now);
  state.lastCheck = now;
  reconcile(state, now);
  const visit = recordVisit(state, now);
  const batch = { doc: 0 };
  const allowDirect = () => !visit.direct;
  const useDirect = () => { visit.direct = true; };
  const allowDoc = () => batch.doc < 1;
  const useDoc = () => { batch.doc++; };

  if (!state.pets.length) {
    addNote(state, pick(EMPTY_SHELF_NOTES), 'the shelf', 'note');
    return;
  }

  // Every active feud steps (escalation and truces are rate-limited per pair in
  // achievements.js); only the pairs that have gone longest without a line get
  // one this time, so a busy shelf stays readable.
  const allFeuds = activeFeuds(state);
  const feuds = allFeuds.slice().sort((x, y) => {
    const ax = state.feudArcs[feudPairKey(x[0].id, x[1].id)], ay = state.feudArcs[feudPairKey(y[0].id, y[1].id)];
    return ((ax && ax.notedAt) || 0) - ((ay && ay.notedAt) || 0);
  }).slice(0, FEUD_NOTES_PER_CHECK);
  feuds.forEach(([a, b]) => {
    const key = feudPairKey(a.id, b.id);
    stepFeudArc(state, key, a, b, now);
    if (state.feudArcs[key]) state.feudArcs[key].notedAt = now;
  });
  allFeuds.forEach(pair => {
    if (feuds.includes(pair)) return;
    const [a, b] = pair;
    const key = feudPairKey(a.id, b.id);
    const arc = state.feudArcs[key] || (state.feudArcs[key] = { level: 0, truce: false });
    if (arc.truce) return;
    // Silent step: the arc can still move without spending a note on it.
    stepFeudArcQuietly(state, key, now);
  });

  // 4a. The moment a grudge goes terminal, Item 4 is moved, seconded and struck.
  state.pets.forEach(pet => {
    if (pet.grudgeStage < 3) return;
    if ((state.ledger.struck || {})[pet.id]) return;
    if (!allowDoc() || !formAllowed(state, 'doc')) return;   // it will keep. It has time.
    const other = state.pets.find(p => p.id !== pet.id) || null;
    const subs = subsFor(state, { pet, b: other ? other : null, a: pet }, now);
    if (other) subs.b = other.name;
    const text = pickFilled(STRIKE_DOCS, subs);
    if (!text) return;
    state.ledger.struck[pet.id] = now;
    useDoc();
    addNote(state, text, pet.name, 'feud', 'doc');
  });

  const occupied = state.slots.map((id, i) => (id ? i : -1)).filter(i => i >= 0);
  const chosen = occupied.slice().sort(() => Math.random() - 0.5).slice(0, 4);
  chosen.forEach(i => {
    const pet = petById(state, state.slots[i]);
    if (!pet) return;
    if (isAsleep(pet, new Date(now)) && Math.random() < 0.5) {
      addNote(state, 'Asleep. Has left a note reading "later".', pet.name, 'note');
      return;
    }
    // Lever 1: put a second creature in the room. This is the highest-value slot
    // in the game for it, because it is the one the player reads most.
    const want = wantsScene(state);
    if (want) {
      const scene = freshDialogue(state, { now, form: want });
      if (scene && formAllowed(state, scene.form) && !(scene.form === 'direct' && !allowDirect())) {
        if (scene.form === 'direct') useDirect();
        addNote(state, scene.text, scene.from, scene.tone, scene.form);
        return;
      }
      if (scene) forgetPick(scene.text);          // turned down by the rotation: not told
    }
    const near = neighborProps(state, i);
    if (near.length && moodOf(pet) !== 'furious' && Math.random() < 0.42) {
      const pr = pick(near);
      addNote(state, fill(pick(PROPS[pr.kind].lines), { p: pet.name }), PROPS[pr.kind].name, 'note');
      return;
    }
    const line = petLine(state, pet, {
      now,
      allowDoc: allowDoc() && Math.random() < 0.7,
      allowDirect: allowDirect() && Math.random() < 0.5
    });
    if (line.form === 'doc') useDoc();
    if (line.form === 'direct') useDirect();
    // The note goes on the board before the reckoning does: checkGrudgeEscalation
    // adds a note of its own, and slipping it in between choosing this form and
    // using it would put two identical form tags next to each other.
    // A note that says the pet's name out loud is somebody else's observation of
    // it; bylining it with that same name reads as a creature introducing itself.
    const from = line.text.indexOf(pet.name) >= 0 ? 'observed' : pet.name;
    addNote(state, line.text, from, line.kind, line.form);
    if (line.kind === 'angry' && fileGrudge(state, pet, NEED_WORD[worstNeed(pet)] || 'neglected', now)) convene(state);
  });

  // One more chance at a scene per batch. The two-hander is the second-largest
  // share in the budget and four pet slots cannot carry it on their own.
  if (state.pets.length >= 2 && Math.random() < 0.6) {
    const scene = freshDialogue(state, { now, form: formAllowed(state, 'two') ? 'two' : 'react' });
    if (scene && formAllowed(state, scene.form) && !(scene.form === 'direct' && !allowDirect())) {
      if (scene.form === 'direct') useDirect();
      addNote(state, scene.text, scene.from, scene.tone, scene.form);
    } else if (scene) forgetPick(scene.text);
  }

  if (state.props.length && Math.random() < 0.35) {
    const pr = pick(state.props);
    addNote(state, pick(PROPS[pr.kind].ambient), PROPS[pr.kind].name, 'note');
  }

  const gone = goneDue(state, now);
  if (Math.random() < 0.55 || gone) {
    const feud = feuds.length ? feuds[0] : null;
    const note = shelfNote(state, {
      now, gone,
      a: feud ? feud[0] : null,
      b: feud ? feud[1] : null,
      pet: state.pets[0] || null,
      allowDoc: allowDoc() && Math.random() < 0.6
    }, now);
    if (note) {
      // Only reset the cadence when the vacancy was actually mentioned.
      if (gone && note.text.indexOf(gone.name) >= 0) state.lastGoneNote = state.noteCount || 0;
      if (note.form === 'doc') useDoc();
      convene(state);
      addNote(state, note.text, 'the shelf', 'note', note.form);
    }
  }

  // The residents' own pass runs with the check, but not with every check.
  runBehavior(state, now, { force: now - (behaviorState(state).lastRun || 0) >= CHECK_BEHAVIOR_MS });
  checkinStreak(state, now);
  checkUnlocks(state);
  reconcile(state, now);
}

// A feud that got no line this check can still move: same odds and cooldown as
// a written step, minus the note. Truces from a quiet step are announced at
// the next written step through the arc itself.
function stepFeudArcQuietly(state, key, now) {
  const arc = state.feudArcs[key];
  if (!arc || arc.truce) return;
  if (now - (arc.steppedAt || 0) < FEUD_STEP_MS) return;
  arc.steppedAt = now;
  const roll = Math.random();
  if (arc.level >= 2 && roll < 0.12) arc.truce = true;
  else if (roll < 0.35) arc.level += 1;
}
