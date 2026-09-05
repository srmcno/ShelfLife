import { CASES, VISITORS } from '../content/stories.js';
import { addNote, clamp } from '../state.js';
import { neighborPets, neighborProps } from './tick.js';
import { FEUDS } from '../content/feuds.js';
import { PROPS } from '../content/props.js';
const DAY = 86400000;
export const VISIT_LENGTH = 6 * 3600000;
export const REQUEST_LENGTH = 12 * 3600000;
export const WEEK = 7 * DAY;
const safeRecord = x => x && typeof x === 'object' && !Array.isArray(x);
const cleanTime = x => Number.isFinite(x) && x >= 0 ? x : 0;
const careCount = state => state.stories?.careActions || 0;
const playCount = state => (state.stories?.handshakes || 0) + (state.stories?.chases || 0);
export function storyState(state) {
  if (!safeRecord(state.stories)) state.stories = {};
  const s = state.stories;
  for (const k of ['archive', 'collection', 'postcards', 'residents']) if (!Array.isArray(s[k])) s[k] = [];
  s.archive = s.archive.filter(x => safeRecord(x) && typeof x.text === 'string').slice(0, 100);
  s.collection = s.collection.filter(x => safeRecord(x) && VISITORS.some(v => v.id === x.id)).slice(0, VISITORS.length);
  s.postcards = s.postcards.filter(x => safeRecord(x) && typeof x.image === 'string' && x.image.startsWith('data:image/jpeg;base64,') && x.image.length < 200000).slice(0, 6);
  s.residents = s.residents.filter(x => safeRecord(x) && typeof x.name === 'string').slice(0, 36);
  for (const resident of s.residents) resident.names = (Array.isArray(resident.names) ? resident.names : []).filter(x => safeRecord(x) && typeof x.name === 'string').slice(-30);
  if (s.highlight && (!safeRecord(s.highlight) || typeof s.highlight.text !== 'string' || !Number.isFinite(s.highlight.at))) s.highlight = null;
  for (const k of ['relationships', 'requests', 'requestAt']) if (!safeRecord(s[k])) s[k] = {};
  if (s.case && (!safeRecord(s.case) || !CASES.some(c => c.id === s.case.kind) || !Number.isInteger(s.case.beat) || s.case.beat < 0 || s.case.beat > 6 || !Array.isArray(s.case.cast))) s.case = null;
  if (s.visitor && (!safeRecord(s.visitor) || !VISITORS.some(v => v.id === s.visitor.kind) || !Number.isFinite(s.visitor.at))) s.visitor = null;
  s.lastVisit = cleanTime(s.lastVisit); s.visitCount = Math.max(0, Math.floor(Number(s.visitCount) || 0));
  s.lastRelations = cleanTime(s.lastRelations);
  s.careActions = cleanTime(s.careActions); s.handshakes = cleanTime(s.handshakes); s.chases = cleanTime(s.chases);
  for (const [key, r] of Object.entries(s.relationships)) {
    if (!safeRecord(r)) { delete s.relationships[key]; continue; }
    r.time = Math.max(0, Number(r.time) || 0); r.plots = Math.max(0, Math.floor(Number(r.plots) || 0));
  }
  if (s.case) {
    s.case.cast = s.case.cast.filter(x => safeRecord(x) && typeof x.id === 'string' && typeof x.name === 'string').slice(0, 2);
    s.case.choices = Array.isArray(s.case.choices) ? s.case.choices.filter(x => ['listen', 'blame'].includes(x)).slice(0, 6) : [];
    for (const key of ['careStart', 'careClue', 'playStart', 'week']) s.case[key] = cleanTime(s.case[key]);
  }
  for (const key of Object.keys(s.requestAt)) s.requestAt[key] = cleanTime(s.requestAt[key]);
  for (const [id, r] of Object.entries(s.requests)) {
    if (!safeRecord(r) || !['food', 'play', 'prop', 'neighbor', 'room'].includes(r.kind) || !Number.isFinite(r.at) || !['offered', 'accepted'].includes(r.status)) { delete s.requests[id]; continue; }
    r.baseline = cleanTime(r.baseline);
  }
  return s;
}
export function remember(state, title, text, now = Date.now(), kind = 'event') {
  const s = storyState(state);
  s.archive.unshift({ title, text, at: now, kind }); s.archive = s.archive.slice(0, 100);
  s.highlight = { title, text, at: now };
}
export function pairKey(a, b) { return [a, b].sort().join('|'); }
function incompatible(a, b) { return FEUDS.some(([x, y]) => a.traits.includes(x) && b.traits.includes(y) || a.traits.includes(y) && b.traits.includes(x)); }
export function relationship(state, a, b) {
  const key = pairKey(a.id, b.id), arc = state.feudArcs?.[key], rel = storyState(state).relationships[key];
  if (arc?.truce) return { label: 'Uneasy allies', detail: 'A truce is on file. They can share a plank without reopening the feud.', appeal: 1 };
  if (incompatible(a, b)) return { label: 'Rivals', detail: 'Conflicting traits. Separate them, or broker a truce after both reach 3 trust.', appeal: -2 };
  if ((rel?.plots || 0) >= 2) return { label: 'Co-conspirators', detail: 'Two supervised plots shared as neighbours. They seek each other out.', appeal: 2 };
  if ((rel?.time || 0) >= 15 * 60000 && Math.min(a.bond, b.bond) >= 1) return { label: 'Friends', detail: 'At least 15 minutes as neighbours, with trust on both sides. Company is reassuring.', appeal: 1.5 };
  return { label: 'Getting acquainted', detail: 'Place them side by side and care for both. Friendship takes 15 minutes together.', appeal: 0 };
}
export function brokerTruce(state, aId, bId, now = Date.now()) {
  const a = state.pets.find(p => p.id === aId), b = state.pets.find(p => p.id === bId);
  if (!a || !b || Math.min(a.bond, b.bond) < 3 || !incompatible(a, b) || state.feudArcs?.[pairKey(aId,bId)]?.truce) return false;
  state.feudArcs ||= {}; state.feudArcs[pairKey(aId,bId)] = { level: 0, truce: true };
  const text = a.name + ' and ' + b.name + ' have signed a truce on the underside of a crumb. Neither can read it from where they stand.';
  remember(state, 'A very small peace', text, now, 'relationship'); addNote(state, text, 'the mediator', 'note'); return true;
}
export function recordSharedPlot(state, petId) {
  const s = storyState(state), pet = state.pets.find(p => p.id === petId);
  if (!pet) return;
  for (const other of neighborPets(state, state.slots.indexOf(petId))) {
    const key = pairKey(petId, other.id), r = s.relationships[key] ||= { time: 0, plots: 0 };
    r.plots = (r.plots || 0) + 1;
  }
}
export function currentCase(state) {
  const c = storyState(state).case;
  return c ? { ...c, definition: CASES.find(x => x.id === c.kind) } : null;
}
export function caseText(state) {
  const c = currentCase(state); if (!c) return '';
  return (c.definition.beats[Math.min(c.beat, 5)]).replaceAll('{p}', c.cast[0]?.name || 'the witness').replaceAll('{q}', c.cast[1]?.name || 'its own reflection');
}
export function caseGate(state) {
  const c = currentCase(state); if (!c || c.beat === 6) return { ready: false, hint: 'Case closed. A new file arrives next week.' };
  if (c.beat === 1 && careCount(state) <= c.careStart && playCount(state) <= c.playStart) return { ready: false, hint: 'Give useful individual care below 72, or win a rewarded game together.' };
  if (c.beat === 2 && state.pets.some(p => p.id === c.cast[0]?.id) && state.slots[6] !== c.cast[0].id) return { ready: false, hint: 'Move ' + c.cast[0].name + ' to B1 using its Place on shelf selector.' };
  if (c.beat === 4 && playCount(state) <= c.playStart && careCount(state) < c.careClue + 2) return { ready: false, hint: 'Win a rewarded game together, or perform two more useful care actions.' };
  return { ready: true, hint: c.beat === 2 ? 'Witness in position. The reconstruction can begin.' : 'Evidence ready to file.' };
}
export function advanceCase(state, choice = 'listen', now = Date.now()) {
  const s = storyState(state), c = s.case;
  if (!c || !caseGate(state).ready || !['listen', 'blame'].includes(choice)) return false;
  const definition = CASES.find(x => x.id === c.kind);
  c.choices ||= []; c.choices.push(choice);
  c.beat++;
  if (c.beat === 4) c.careClue = careCount(state);
  if (c.beat === 6) {
    const gentle = c.choices.filter(x => x === 'listen').length >= 5;
    const comfortable = state.pets.some(p => Math.min(...Object.values(p.needs)) >= 50);
    const cooperative = gentle && comfortable;
    c.outcome = cooperative ? definition.good : definition.messy; c.closedAt = now;
    state.pets.filter(p => c.cast.some(x => x.id === p.id)).forEach(p => {
      if (cooperative) p.bond = clamp(p.bond + 2, 0, 25);
      else p.needs.clean = clamp(p.needs.clean + 12, 0, 100);
    });
    const text = c.outcome + (cooperative ? ' Witnesses gain 2 trust.' : 'The clean-up gives witnesses +12 cleanliness.');
    remember(state, definition.title, text, now, 'case'); addNote(state, text, 'case closed', 'scheme');
  } else {
    addNote(state, caseText(state), 'case file · ' + (c.beat + 1) + '/6', 'scheme');
  }
  return true;
}
export function requestDescription(state, pet) {
  const r = storyState(state).requests[pet.id]; if (!r) return null;
  const other = state.pets.find(p => p.id === r.target);
  const text = { food: 'Feed me once. Individually. The trolley does not count.', play: 'Learn my secret handshake. No witnesses.', prop: 'Put a ' + (PROPS[r.target]?.name || 'food bowl') + ' beside me.', neighbor: 'Let me stand beside ' + (other?.name || 'another resident') + '.', room: 'Change the room to Bone Parlor. I want to look expensive.' }[r.kind];
  return { ...r, text };
}
export function acceptRequest(state, petId, accept, now = Date.now()) {
  const s = storyState(state), r = s.requests[petId], pet = state.pets.find(p => p.id === petId);
  if (!r || !pet || r.status !== 'offered') return false;
  if (now >= r.at + REQUEST_LENGTH) { delete s.requests[petId]; s.requestAt[petId] = now; return false; }
  if (accept) { r.status = 'accepted'; r.baseline = r.kind === 'food' ? pet.careLog?.food || 0 : pet.handshakes || 0; }
  else {
    pet.bond = clamp(pet.bond - 1, 0, 25); pet.grudges = (pet.grudges || 0) + 1; pet.refusedRequests = (pet.refusedRequests || 0) + 1;
    addNote(state, pet.name + ' has folded its request into a tiny step. It is now standing on the rejection.', pet.name, 'angry');
    remember(state, 'Request declined', pet.name + ': ' + requestDescription(state, pet).text, now, 'request');
    delete s.requests[petId]; s.requestAt[petId] = now;
  }
  return true;
}
function requestMet(state, pet, r) {
  const slot = state.slots.indexOf(pet.id);
  if (r.kind === 'food') return (pet.careLog?.food || 0) > r.baseline;
  if (r.kind === 'play') return (pet.handshakes || 0) > r.baseline;
  if (r.kind === 'prop') return neighborProps(state, slot).some(p => p.kind === r.target);
  if (r.kind === 'neighbor') return neighborPets(state, slot).some(p => p.id === r.target);
  return r.kind === 'room' && state.decor.room === 'parlor';
}
export function welcomeVisitor(state, hostId, choice, now = Date.now()) {
  const s = storyState(state), v = s.visitor, host = state.pets.find(p => p.id === hostId);
  if (!v || v.welcomed || now >= v.at + VISIT_LENGTH || !host || !['crumbs', 'tour'].includes(choice)) return false;
  if (choice === 'crumbs' && host.needs.food < 8) return false;
  const definition = VISITORS.find(x => x.id === v.kind);
  v.welcomed = true; v.host = host.name;
  if (choice === 'crumbs') { host.needs.food -= 8; host.bond = clamp(host.bond + 1, 0, 25); }
  else host.needs.fuss = clamp(host.needs.fuss + 8, 0, 100);
  if (!s.collection.some(x => x.id === v.kind)) s.collection.push({ id: v.kind, at: now, host: host.name });
  const text = definition.name + ' leaves ' + definition.gift.toLowerCase() + ' with ' + host.name + '. It takes up no shelf space. It has already claimed some.';
  remember(state, 'An unusual souvenir', text, now, 'visitor'); addNote(state, text, definition.name, 'arrival'); return true;
}
export function advanceStories(state, now = Date.now()) {
  const s = storyState(state); if (!state.pets.length) return;
  const week = Math.floor(now / WEEK);
  if (!s.case || s.case.beat === 6 && s.case.week < week) {
    s.case = { kind: CASES[((week % CASES.length) + CASES.length) % CASES.length].id, week, beat: 0, cast: state.pets.slice(0, 2).map(p => ({ id: p.id, name: p.name })), careStart: careCount(state), careClue: careCount(state), playStart: playCount(state), choices: [] };
    addNote(state, caseText(state), 'a new case file', 'scheme');
  }
  if (s.visitor && now >= s.visitor.at + VISIT_LENGTH) {
    const d = VISITORS.find(x => x.id === s.visitor.kind);
    remember(state, 'Visitor departed', d.name + (s.visitor.welcomed ? ' has gone. ' + s.visitor.host + ' is keeping the souvenir under imaginary lock and key.' : ' left a calling card under the dust. Another visit will come.'), now, 'visitor');
    s.visitor = null; s.lastVisit = now;
  } else if (!s.visitor && (!s.lastVisit || now - s.lastVisit >= DAY)) {
    const d = VISITORS[s.visitCount % VISITORS.length];
    s.visitor = { kind: d.id, at: now, welcomed: false }; s.visitCount++; s.lastVisit = now;
    addNote(state, d.line, d.name, 'arrival');
  }
  // Cap offline acquaintance at one hour; repeated renders add no elapsed time.
  const elapsed = s.lastRelations ? clamp(now - s.lastRelations, 0, 3600000) : 0;
  s.lastRelations = now;
  for (const a of state.pets) for (const b of neighborPets(state, state.slots.indexOf(a.id))) {
    if (a.id > b.id) continue;
    const key = pairKey(a.id, b.id), r = s.relationships[key] ||= { time: 0, plots: 0 };
    const before = relationship(state, a, b).label;
    r.time = Math.max(0, Number(r.time) || 0) + elapsed;
    const after = relationship(state, a, b).label;
    if (before !== after) remember(state, after, a.name + ' and ' + b.name + ' now share more than a plank.', now, 'relationship');
  }
  for (const pet of state.pets) {
    let r = s.requests[pet.id];
    if (r && (now >= r.at + REQUEST_LENGTH || r.kind === 'neighbor' && !state.pets.some(p => p.id === r.target))) {
      delete s.requests[pet.id]; s.requestAt[pet.id] = now; r = null;
    }
    if (r?.status === 'accepted' && requestMet(state, pet, r)) {
      pet.bond = clamp(pet.bond + 1, 0, 25); pet.fulfilledRequests = (pet.fulfilledRequests || 0) + 1;
      const text = pet.name + ' has marked its request fulfilled. The tick is larger than the form.';
      addNote(state, text, pet.name, 'note'); remember(state, 'A promise kept', text, now, 'request');
      delete s.requests[pet.id]; s.requestAt[pet.id] = now;
    } else if (!r && (!s.requestAt[pet.id] || now - s.requestAt[pet.id] >= 6 * 3600000)) {
      const others = state.pets.filter(p => p.id !== pet.id);
      const kinds = ['food', 'play', 'prop', 'room', ...(others.length ? ['neighbor'] : [])];
      const n = (pet.fulfilledRequests || 0) + (pet.refusedRequests || 0);
      const kind = kinds[n % kinds.length];
      s.requests[pet.id] = { kind, target: kind === 'neighbor' ? others[0].id : kind === 'prop' ? 'bowl' : kind === 'room' ? 'parlor' : null, status: 'offered', at: now };
    }
  }
  for (const id of Object.keys(s.requests)) if (!state.pets.some(p => p.id === id)) delete s.requests[id];
}
