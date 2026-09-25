import { COURT_CASES, COURT_CAST, COURT_PATIENCE, WRONG_EVIDENCE, WRONG_TAUNTS, PRESS_TAUNTS, GALLERY_GASPS, LOSE_LINES } from '../content/court.js';
import { courtroomState } from '../court-state.js';
import { grantBonusTrust, petById } from '../state.js';
import { payGameSouls, deed } from './mayhem.js';
import { recordGameLife, recordScene } from './life.js';
import { recordEscapadeEvent } from '../escapade-state.js';

/* Shelf Court, as a pure state machine. The UI owns a `trial` object and
   feeds it presses and presentations; every call returns the lines to play
   next. Nothing here touches the DOM, so the whole trial can be tested. */

export const COURT_BY_ID = Object.fromEntries(COURT_CASES.map(c => [c.id, c]));
const pick = (list, rnd) => list[Math.floor(rnd() * list.length) % list.length];
export const fillName = (text, name) => String(text || '').replace(/\{d\}/g, name || 'the defendant');
const lines = (list, name) => (list || []).map(line => ({ s: line.s, t: fillName(line.t, name) }));

export function courtCases(state) {
  const c = courtroomState(state);
  const next = COURT_CASES.find(k => !c.solved.includes(k.id))?.id || '';
  return COURT_CASES.map((k, i) => ({ id: k.id, number: i + 1, title: k.title, blurb: k.blurb, solved: c.solved.includes(k.id), flawless: c.flawless.includes(k.id), next: k.id === next }));
}

export function courtStart(state, { caseId, petId } = {}) {
  const k = COURT_BY_ID[caseId] || COURT_BY_ID[courtCases(state).find(x => x.next)?.id] || COURT_CASES[0];
  const pet = petById(state, petId) || state.pets?.[0] || null;
  return {
    caseId: k.id, petId: pet?.id || '', name: pet?.name || 'the defendant',
    witness: 0, statement: 0, patience: COURT_PATIENCE, mistakes: 0, presses: 0,
    evidence: k.evidence.map(e => e.id), phase: 'opening', done: false, won: false,
    opening: lines(k.opening, pet?.name)
  };
}

export const trialCase = trial => COURT_BY_ID[trial.caseId];
export const trialWitness = trial => trialCase(trial).witnesses[trial.witness];
export function witnessInfo(trial) {
  const w = trialWitness(trial);
  return w ? { ...COURT_CAST[w.who], who: w.who, title: w.title, count: w.testimony.length } : null;
}
export function evidenceList(trial) {
  const k = trialCase(trial);
  return trial.evidence.map(id => k.evidence.find(e => e.id === id) || k.evidenceLater?.[id]).filter(Boolean)
    .map(e => ({ ...e, name: fillName(e.name, trial.name), text: fillName(e.text, trial.name) }));
}
export function statementText(trial, index = trial.statement) {
  return fillName(trialWitness(trial)?.testimony[index]?.t, trial.name);
}

// The witness takes the stand: their introduction, then testimony begins.
export function courtCallWitness(trial) {
  trial.phase = 'testimony'; trial.statement = 0;
  return lines(trialWitness(trial).intro, trial.name);
}

export function courtMove(trial, delta) {
  const count = trialWitness(trial).testimony.length;
  trial.statement = (trial.statement + delta + count) % count;
  return trial.statement;
}

// Press the current statement. Lying statements make the witness sweat,
// which is the only hint the court gives.
export function courtPress(trial, rnd = Math.random) {
  const s = trialWitness(trial).testimony[trial.statement];
  trial.presses++;
  const out = { lines: [], added: null, sweat: !!s.lie };
  if (s.press) out.lines = lines(s.press, trial.name);
  else out.lines = [{ s: 'you', t: 'Are you absolutely sure about that?' }, { s: 'witness', t: pick(['Completely sure. Write it down. In ink.', 'I have never been surer of anything. Except death. And taxes. Mostly death.', 'Yes. Next question. Please. Quickly.'], rnd) }];
  if (s.adds && !trial.evidence.includes(s.adds)) {
    trial.evidence.push(s.adds);
    out.added = evidenceList(trial).find(e => e.id === s.adds) || null;
  }
  if (rnd() < 0.3) out.lines.push({ s: 'prosecutor', t: pick(PRESS_TAUNTS, rnd) });
  return out;
}

// Present evidence against the current statement.
export function courtPresent(trial, evidenceId, rnd = Math.random) {
  const s = trialWitness(trial).testimony[trial.statement];
  const ev = evidenceList(trial).find(e => e.id === evidenceId);
  if (!ev || trial.done) return null;
  if (s.lie?.[evidenceId]) {
    const out = {
      correct: true, shout: fillName(s.lie[evidenceId], trial.name),
      lines: [...lines(s.crack, trial.name), { s: 'gallery', t: pick(GALLERY_GASPS, rnd) }]
    };
    if (trial.witness + 1 < trialCase(trial).witnesses.length) {
      trial.witness++; trial.statement = 0; trial.phase = 'between';
      out.next = 'witness';
      out.lines.push({ s: 'prosecutor', t: pick(['Hmph. A lucky guess. The prosecution calls its next witness!', 'Fine! FINE! We have another witness. A better one. Probably.', 'That witness was a warm-up. The next one is a professional.'], rnd) });
    } else {
      trial.phase = 'verdict'; trial.done = true; trial.won = true;
      out.next = 'verdict';
      out.lines.push(...lines(trialCase(trial).verdict, trial.name));
    }
    return out;
  }
  trial.patience = Math.max(0, trial.patience - 1); trial.mistakes++;
  const out = {
    correct: false, lost: trial.patience === 0,
    lines: [{ s: 'judge', t: pick(WRONG_EVIDENCE, rnd).replace(/\{ev\}/g, ev.name) }, { s: 'prosecutor', t: pick(WRONG_TAUNTS, rnd) }]
  };
  if (out.lost) { trial.phase = 'verdict'; trial.done = true; trial.won = false; out.lines.push(...lines(LOSE_LINES, trial.name)); }
  return out;
}

// Settle the trial. Pays once per trial, whatever the outcome.
export function courtFinish(state, trial, now = Date.now()) {
  if (!trial?.done || trial.settled) return null;
  trial.settled = true;
  const c = courtroomState(state), k = trialCase(trial);
  const pet = petById(state, trial.petId) || state.pets?.[0] || null;
  const firstSolve = trial.won && !c.solved.includes(k.id);
  const flawless = trial.won && trial.mistakes === 0;
  const firstFlawless = flawless && !c.flawless.includes(k.id);
  c.trials++; c.last = k.id;
  if (trial.won) {
    c.wins++;
    if (firstSolve) c.solved.push(k.id);
    if (firstFlawless) c.flawless.push(k.id);
  }
  const souls = payGameSouls(state, trial.won ? 20 + 10 * trial.patience + (firstSolve ? 15 : 0) : 5, now);
  deed(state, 'game', 1, now);
  let trust = 0;
  if (pet) {
    if (trial.won) trust = grantBonusTrust(pet, 1, now);
    pet.courtCases = (pet.courtCases || 0) + 1;
    recordGameLife(state, pet, 'court', now, false);
    recordEscapadeEvent(state, { kind: 'play', petIds: [pet.id], activity: 'court' }, now);
    recordScene(state, 'court', k.title,
      trial.won ? pet.name + ' walked free from ' + k.title + '. The real culprit is sitting near a lamp thinking about what they did.'
        : pet.name + ' was found guilty in ' + k.title + ' and is being dusted weekly for all eternity. It is appealing.',
      [pet.id], now, { key: 'court', branch: trial.won ? 'witness' : 'convicted' });
  }
  return { won: trial.won, souls, trust, firstSolve, flawless, firstFlawless, patience: trial.patience, solved: c.solved.length, total: COURT_CASES.length };
}
