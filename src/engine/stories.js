import { lifeState, awardDiscovery, recordScene } from './life.js';
import { CASES, VISITORS } from '../content/stories.js';
import { addNote, clamp, grantBonusTrust } from '../state.js';
import { fileGrudge } from './achievements.js';
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
const playCount = state => (state.stories?.handshakes || 0) + (state.stories?.chases || 0) + (state.stories?.alibiWins || 0);
export const residentWins = pet => (pet.handshakes || 0) + (pet.chases || 0) + (pet.alibiWins || 0);
const roll = rng => clamp(Number(rng()) || 0, 0, 0.999999999);
export const VISIT_GAP_MIN = 8 * 3600000;
export const VISIT_GAP_MAX = 18 * 3600000;
// Validate once per synchronous story transaction. Independent public reads still
// repair imported or edited data; nested lookups share the already checked record.
const storyTransactions = new WeakMap();
export function withStories(state, work) {
  if (storyTransactions.has(state)) return work(storyTransactions.get(state));
  const stories = storyState(state);
  storyTransactions.set(state, stories);
  try { return work(stories); } finally { storyTransactions.delete(state); }
}
export function storyState(state) {
  if (storyTransactions.has(state)) return storyTransactions.get(state);
  if (!safeRecord(state.stories)) state.stories = {};
  const s = state.stories;
  for (const k of ['archive', 'collection', 'postcards', 'residents']) if (!Array.isArray(s[k])) s[k] = [];
  s.archive = s.archive.filter(x => safeRecord(x) && typeof x.text === 'string').slice(0, 100);
  s.collection = [...new Map(s.collection.filter(x => safeRecord(x) && VISITORS.some(v => v.id === x.id)).map(x => [x.id, x])).values()];
  s.visitBag = [...new Set((Array.isArray(s.visitBag) ? s.visitBag : []).filter(id => VISITORS.some(v => v.id === id)))];
  if (!safeRecord(s.visitStats)) s.visitStats = {};
  for (const id of Object.keys(s.visitStats)) {
    if (!VISITORS.some(v => v.id === id) || !safeRecord(s.visitStats[id])) { delete s.visitStats[id]; continue; }
    for (const key of ['visits', 'welcomes']) s.visitStats[id][key] = Math.floor(cleanTime(s.visitStats[id][key]));
  }
  s.nextVisitAt = cleanTime(s.nextVisitAt); s.lastInvitation = cleanTime(s.lastInvitation);
  s.postcards = s.postcards.filter(x => safeRecord(x) && typeof x.image === 'string' && x.image.startsWith('data:image/jpeg;base64,') && x.image.length < 200000).slice(0, 6);
  s.residents = s.residents.filter(x => safeRecord(x) && typeof x.name === 'string').slice(0, 36);
  for (const resident of s.residents) resident.names = (Array.isArray(resident.names) ? resident.names : []).filter(x => safeRecord(x) && typeof x.name === 'string').slice(-30);
  if (s.highlight && (!safeRecord(s.highlight) || typeof s.highlight.text !== 'string' || !Number.isFinite(s.highlight.at))) s.highlight = null;
  for (const k of ['relationships', 'requests', 'requestAt']) if (!safeRecord(s[k])) s[k] = {};
  if (s.case && (!safeRecord(s.case) || !CASES.some(c => c.id === s.case.kind) || !Number.isInteger(s.case.beat) || s.case.beat < 0 || s.case.beat > 6 || !Array.isArray(s.case.cast))) s.case = null;
  if (s.visitor && (!safeRecord(s.visitor) || !VISITORS.some(v => v.id === s.visitor.kind) || !Number.isFinite(s.visitor.at))) s.visitor = null;
  if(s.visitor){s.visitor.activityDone=s.visitor.activityDone===true;s.visitor.activityResponse=typeof s.visitor.activityResponse==='string'?s.visitor.activityResponse.slice(0,1200):'';}
  s.lastVisit = cleanTime(s.lastVisit); s.visitCount = Math.max(0, Math.floor(Number(s.visitCount) || 0));
  s.lastRelations = cleanTime(s.lastRelations);
  s.careActions = cleanTime(s.careActions); s.handshakes = cleanTime(s.handshakes); s.chases = cleanTime(s.chases); s.alibiWins = cleanTime(s.alibiWins);
  for (const [key, r] of Object.entries(s.relationships)) {
    if (!safeRecord(r)) { delete s.relationships[key]; continue; }
    r.time = Math.max(0, Number(r.time) || 0); r.plots = Math.max(0, Math.floor(Number(r.plots) || 0));
  }
  if (s.case) {
    s.case.cast = s.case.cast.filter(x => safeRecord(x) && typeof x.id === 'string' && typeof x.name === 'string').slice(0, 2);
    s.case.choices = Array.isArray(s.case.choices) ? s.case.choices.filter(x => ['listen', 'blame'].includes(x)).slice(0, 6) : [];
    for (const key of ['careStart', 'careClue', 'playStart', 'playClue', 'week']) s.case[key] = cleanTime(s.case[key]);
  }
  for (const key of Object.keys(s.requestAt)) s.requestAt[key] = cleanTime(s.requestAt[key]);
  for (const [id, r] of Object.entries(s.requests)) {
    if (!safeRecord(r) || !['food', 'fuss', 'clean', 'play', 'prop', 'neighbor', 'room'].includes(r.kind) || !Number.isFinite(r.at) || !['offered', 'accepted'].includes(r.status)) { delete s.requests[id]; continue; }
    r.baseline = cleanTime(r.baseline);
    if (r.kind === 'play' && r.status === 'accepted' && !r.winBaseline) {
      const pet = state.pets.find(p => p.id === id);
      r.baseline += (pet?.chases || 0) + (pet?.alibiWins || 0);
      r.winBaseline = true;
    }
    r.offeredAt = cleanTime(r.offeredAt);
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
// The witnesses, read live: a rename shows up, and a case that opened on a
// shelf of one fills its second seat the moment somebody else moves in. Slots
// that cannot be filled fall back to a proper name, so the copy still parses.
export const REFLECTION = 'The Reflection';
function castMembers(state, c) {
  const live = id => state.pets.find(p => p.id === id);
  const cast = Array.isArray(c.cast) ? c.cast : (c.cast = []);
  const taken = new Set(cast.map(x => x.id));
  const spare = [...state.pets].sort((a, b) => (b.stats?.mystique || 0) - (a.stats?.mystique || 0)).filter(p => !taken.has(p.id));
  while (cast.length < 2 && spare.length) { const p = spare.shift(); cast.push({ id: p.id, name: p.name }); }
  return [0, 1].map(i => {
    const entry = cast[i];
    if (!entry) return null;
    const pet = live(entry.id);
    if (pet && pet.name !== entry.name) entry.name = pet.name;
    return entry;
  });
}
export function currentCase(state) {
  const c = storyState(state).case;
  if (!c) return null;
  castMembers(state, c);
  return { ...c, definition: CASES.find(x => x.id === c.kind) };
}
export function caseNames(state) {
  const c = storyState(state).case; if (!c) return { p: 'the witness', q: REFLECTION };
  const [a, b] = castMembers(state, c);
  return { p: a?.name || 'the witness', q: b?.name || REFLECTION };
}
export function caseText(state) {
  const c = currentCase(state); if (!c) return '';
  const names = caseNames(state);
  return (c.definition.beats[Math.min(c.beat, 5)]).replaceAll('{p}', names.p).replaceAll('{q}', names.q);
}
export function caseGate(state) {
  const c = currentCase(state); if (!c || c.beat === 6) return { ready: false, hint: 'Case closed. A new file arrives next week.' };
  if (c.beat === 1 && careCount(state) <= c.careStart && playCount(state) <= c.playStart) return { ready: false, hint: 'Give useful individual care below 72, or complete a game together.' };
  if (c.beat === 2 && state.pets.some(p => p.id === c.cast[0]?.id) && state.slots[6] !== c.cast[0].id) return { ready: false, hint: 'Move ' + caseNames(state).p + ' to B1 using its Place on shelf selector.' };
  if (c.beat === 4 && playCount(state) <= (c.playClue ?? c.playStart) && careCount(state) < c.careClue + 2) return { ready: false, hint: 'Complete a game together, or perform two more useful care actions.' };
  return { ready: true, hint: c.beat === 2 ? 'Witness in position. The reconstruction can begin.' : 'Evidence ready to file.' };
}
export function advanceCase(state, choice = 'listen', now = Date.now()) {
  const s = storyState(state), c = s.case;
  if (!c || !caseGate(state).ready || !['listen', 'blame'].includes(choice)) return false;
  const definition = CASES.find(x => x.id === c.kind);
  c.choices ||= []; c.choices.push(choice);
  c.beat++;
  if (c.beat === 4) { c.careClue = careCount(state); c.playClue = playCount(state); }
  if (c.beat === 6) {
    const gentle = c.choices.filter(x => x === 'listen').length >= 5;
    const comfortable = state.pets.some(p => Math.min(...Object.values(p.needs)) >= 50);
    const cooperative = gentle && comfortable;
    c.outcome = cooperative ? definition.good : definition.messy; c.closedAt = now;
    const rewarded = awardDiscovery(state, 'case:'+c.kind, 4, now);
    state.pets.filter(p => c.cast.some(x => x.id === p.id)).forEach(p => {
      if (cooperative && rewarded) p.bond = clamp(p.bond + 2, 0, 25);
      else if (!cooperative) p.needs.clean = clamp(p.needs.clean + 12, 0, 100);
    });
    const text = c.outcome + (cooperative ? (rewarded ? ' Witnesses gain 2 trust.' : ' This file’s trust was already earned; the shared history remains.') : ' The clean-up gives witnesses +12 cleanliness.');
    recordScene(state,'case',definition.title,text,c.cast.map(p=>p.id),now);
    remember(state, definition.title, text, now, 'case'); addNote(state, text, 'case closed', 'scheme');
  } else {
    addNote(state, caseText(state), 'case file · ' + (c.beat + 1) + '/6', 'scheme');
  }
  return true;
}
export function requestDescription(state, pet) {
  const r = storyState(state).requests[pet.id]; if (!r) return null;
  const other = state.pets.find(p => p.id === r.target);
  const text = { food: 'Feed me once, individually. I have started thinking of the shelf as a serving suggestion.', fuss: 'Give me some individual attention. I am too small to haunt you from this distance.', clean: 'Wash me individually. Something in the crust has started charging rent.', play: 'Win a rewarded Handshake, Crumb Chase or Alibi with me. I need a shared incident.', prop: 'Put a ' + (PROPS[r.target]?.name || 'food bowl') + ' beside me. I need a neighbour with fewer opinions.', neighbor: 'Let me stand beside ' + (other?.name || 'another resident') + '. I have something small and incriminating to say.', room: 'Change the room to Bone Parlor. I want to look expensive.' }[r.kind];
  return { ...r, text };
}
export function acceptRequest(state, petId, accept, now = Date.now()) {
  const s = storyState(state), r = s.requests[petId], pet = state.pets.find(p => p.id === petId);
  if (!r || !pet || r.status !== 'offered') return false;
  if (now >= r.at + REQUEST_LENGTH) { delete s.requests[petId]; s.requestAt[petId] = now; return false; }
  if (accept) { r.status = 'accepted'; r.offeredAt = r.at; r.at = now; r.baseline = ['food', 'fuss', 'clean'].includes(r.kind) ? pet.careLog?.[r.kind] || 0 : residentWins(pet); r.winBaseline = true; }
  else {
    pet.bond = clamp(pet.bond - 1, 0, 25); pet.refusedRequests = (pet.refusedRequests || 0) + 1;
    fileGrudge(state, pet, 'you declined its request', now, { force: true });
    addNote(state, pet.name + ' has folded its request into a tiny step. It is now standing on the rejection.', pet.name, 'angry');
    remember(state, 'Request declined', pet.name + ': ' + requestDescription(state, pet).text, now, 'request');
    delete s.requests[petId]; s.requestAt[petId] = now;
  }
  return true;
}
function requestMet(state, pet, r) {
  const slot = state.slots.indexOf(pet.id);
  if (['food', 'fuss', 'clean'].includes(r.kind)) return (pet.careLog?.[r.kind] || 0) > r.baseline;
  if (r.kind === 'play') return (r.winBaseline ? residentWins(pet) : pet.handshakes || 0) > r.baseline;
  if (r.kind === 'prop') return neighborProps(state, slot).some(p => p.kind === r.target);
  if (r.kind === 'neighbor') return neighborPets(state, slot).some(p => p.id === r.target);
  return r.kind === 'room' && state.decor.room === 'parlor';
}
export const INVITATION_REST = 15 * 60000;
export function inviteVisitor(state, now = Date.now(), rng = Math.random) {
  return withStories(state, s => {
    if (!state.pets.length || s.visitor || s.lastInvitation && now < s.lastInvitation + INVITATION_REST) return false;
    s.lastInvitation = now; s.nextVisitAt = now;
    advanceStories(state, now, rng);
    return !!s.visitor;
  });
}
export function farewellVisitor(state, now = Date.now()) {
  const s = storyState(state), v = s.visitor;
  if (!v?.welcomed) return false;
  const guest = VISITORS.find(d => d.id === v.kind);
  s.lastVisitor = v.kind; s.lastVisit = now; s.nextVisitAt = now + VISIT_GAP_MIN;
  s.visitor = null;
  remember(state, 'Until the next small disaster', guest.name + ' leaves with a wave. The souvenir refuses to follow.', now, 'visitor');
  return true;
}

export function welcomeVisitor(state, hostId, choice, now = Date.now()) {
  const s = storyState(state), v = s.visitor, host = state.pets.find(p => p.id === hostId);
  if (!v || v.welcomed || now >= v.at + VISIT_LENGTH || !host || !['crumbs', 'tour'].includes(choice)) return false;
  if (choice === 'crumbs' && host.needs.food < 8) return false;
  const definition = VISITORS.find(x => x.id === v.kind);
  v.welcomed = true; v.host = host.name; v.hostId = host.id; v.choice = choice;
  if (choice === 'crumbs') { host.needs.food -= 8; grantBonusTrust(host, 1, now); }
  else host.needs.fuss = clamp(host.needs.fuss + 8, 0, 100);
  if (!s.collection.some(x => x.id === v.kind)) s.collection.push({ id: v.kind, at: now, host: host.name });
  const stats = s.visitStats[v.kind] ||= { visits: 1, welcomes: 0 };
  stats.welcomes++;
  const context = host.needs.clean < 35 ? ' ' + host.name + ' is asked whether the crust is a hat.' : host.needs.fuss < 35 ? ' ' + host.name + ' follows the visitor with its whole face.' : host.bond >= 8 ? ' ' + host.name + ' introduces you as the house giant. Fondly.' : '';
  const text = definition[choice] + context + ' ' + host.name + ' keeps ' + definition.gift.toLowerCase() + '.';
  v.response = text;
  const life=lifeState(state);
  if (awardDiscovery(state, "guest:"+v.kind, 3, now) && life.displayed.length<3) life.displayed.push(v.kind);
  recordScene(state,"visitor",definition.name+" has come calling",text,[host.id],now);
  remember(state, 'An unusual souvenir', text, now, 'visitor'); addNote(state, text, definition.name, 'arrival'); return true;
}
export function advanceStories(state, now = Date.now(), rng = Math.random) {
  return withStories(state, () => advanceStoryTransaction(state, now, rng));
}
function advanceStoryTransaction(state, now, rng) {
  const s = storyState(state); if (!state.pets.length || state.life?.introStarted && !state.life.introDone) return;
  const week = Math.floor(now / WEEK);
  if (!s.case || s.case.beat === 6 && s.case.week < week) {
    // Mystique attracts case files: the two most mysterious residents are the witnesses.
    const witnesses = [...state.pets].sort((a, b) => (b.stats?.mystique || 0) - (a.stats?.mystique || 0)).slice(0, 2);
    s.case = { kind: CASES[((week % CASES.length) + CASES.length) % CASES.length].id, week, beat: 0, cast: witnesses.map(p => ({ id: p.id, name: p.name })), careStart: careCount(state), careClue: careCount(state), playStart: playCount(state), choices: [] };
    addNote(state, caseText(state), 'a new case file', 'scheme');
  }
  if (s.visitor && now >= s.visitor.at + VISIT_LENGTH) {
    const d = VISITORS.find(x => x.id === s.visitor.kind);
    remember(state, 'Visitor departed', d.name + (s.visitor.welcomed ? ' has gone. The souvenir remains. It is already taking liberties.' : ' leaves without a welcome. No trust is lost; the calling card bears a tiny, judgemental crease.'), now, 'visitor');
    s.lastVisitor = s.visitor.kind;
    s.visitor = null; s.lastVisit = now;
    // Schedule from the observed departure. Offline time never floods the shelf.
    s.nextVisitAt = now + VISIT_GAP_MIN + Math.floor(roll(rng) * (VISIT_GAP_MAX - VISIT_GAP_MIN));
  } else if (!s.visitor && now >= (s.nextVisitAt || (s.lastVisit ? s.lastVisit + VISIT_GAP_MIN : 0))) {
    if (!s.visitBag.length) {
      s.visitBag = VISITORS.map(d => d.id);
      for (let i = s.visitBag.length - 1; i > 0; i--) {
        const j = Math.floor(roll(rng) * (i + 1));
        [s.visitBag[i], s.visitBag[j]] = [s.visitBag[j], s.visitBag[i]];
      }
    }
    if (s.visitBag[0] === s.lastVisitor && s.visitBag.length > 1) s.visitBag.push(s.visitBag.shift());
    const visitorId = s.visitBag.shift();
    const d = VISITORS.find(d => d.id === visitorId);
    const stats = s.visitStats[d.id] ||= { visits: s.collection.some(x => x.id === d.id) ? 1 : 0, welcomes: 0 };
    const returning = stats.visits > 0;
    stats.visits++;
    s.visitor = { kind: d.id, at: now, welcomed: false, returning, visitNumber: stats.visits, arrival: returning ? d.returnLine : d.line };
    s.visitCount++; s.lastVisit = now; s.nextVisitAt = 0;
    addNote(state, s.visitor.arrival, d.name, 'arrival');
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
      const endings = { food: 'has eaten the requested meal and most of the receipt.', fuss: 'got the promised attention. It is trying to look less pleased than its entire body.', clean: 'is clean as promised. The old dirt has been given a very small notice period.', play: 'got the promised victory. It has requested shared custody of the triumph.', prop: 'has its requested furnishing nearby. It is explaining the house rules to it.', neighbor: 'is beside its requested neighbour. Both are suddenly speaking much more quietly.', room: 'has the room it asked for. Its reflection is becoming unbearable.' };
      const text = pet.name + ' ' + endings[r.kind];
      addNote(state, text, pet.name, 'note'); remember(state, 'A promise kept', text, now, 'request');
      delete s.requests[pet.id]; s.requestAt[pet.id] = now;
    } else if (!r && (!s.requestAt[pet.id] || now - s.requestAt[pet.id] >= 6 * 3600000)) {
      const candidate = chooseRequest(state, pet);
      if (candidate) s.requests[pet.id] = { ...candidate, status: 'offered', at: now };
    }
  }
  for (const id of Object.keys(s.requests)) if (!state.pets.some(p => p.id === id)) delete s.requests[id];
}

// Needs take priority; comfortable residents ask for a useful change they do not
// already have. A fulfilled request cannot pay again on the next render.
export function chooseRequest(state, pet) {
  const needs = ['food', 'fuss', 'clean'].sort((a,b) => pet.needs[a] - pet.needs[b]);
  if (pet.needs[needs[0]] < 45) return { kind: needs[0], target: null };
  const candidates = needs.filter(k => pet.needs[k] < 72).map(kind => ({ kind, target: null }));
  candidates.push({ kind: 'play', target: null });
  const slot = state.slots.indexOf(pet.id), nearPets = neighborPets(state, slot), nearProps = neighborProps(state, slot);
  const wanted = state.pets.filter(p => p.id !== pet.id && !nearPets.some(n => n.id === p.id))
    .map(p => ({ p, appeal: relationship(state, pet, p).appeal })).filter(x => x.appeal >= 0)
    .sort((a,b) => b.appeal - a.appeal || a.p.id.localeCompare(b.p.id));
  if (wanted.length) candidates.push({ kind: 'neighbor', target: wanted[0].p.id });
  const furnishings = { food: 'bowl', fuss: 'yarn', clean: 'tub' };
  const target = furnishings[needs[0]];
  const hasRoom = state.slots.some(x => !x) || state.props.some(p => p.kind === target);
  const unlocked = state.pets.reduce((n,p) => n + p.bond, 0) >= PROPS[target].at;
  if (hasRoom && unlocked && !nearProps.some(p => p.kind === target)) candidates.push({ kind: 'prop', target });
  if (state.decor.room !== 'parlor') candidates.push({ kind: 'room', target: 'parlor' });
  const n = (pet.fulfilledRequests || 0) + (pet.refusedRequests || 0);
  return candidates[n % candidates.length];
}

export function startNextCase(state, now=Date.now()) {
 const s=storyState(state); if(!state.pets.length||!s.case||s.case.beat!==6)return false;
 const index=(CASES.findIndex(c=>c.id===s.case.kind)+1)%CASES.length;
 const cast=[...state.pets].sort((a,b)=>(b.stats?.mystique||0)-(a.stats?.mystique||0)).slice(0,2).map(p=>({id:p.id,name:p.name}));
 s.case={kind:CASES[index].id,week:Math.floor(now/WEEK),beat:0,cast,careStart:careCount(state),careClue:careCount(state),playStart:playCount(state),choices:[]};
 addNote(state,caseText(state),'a new case file','scheme');return true;
}
