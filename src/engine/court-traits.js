import { TRAIT_BY_ID } from '../content/traits.js';

/* Residents matter in Shelf Court. A trait (content/traits.js) can give a
   resident a role at the podium or in the jury box, and each role changes the
   maths in one way a player can read off the screen:

     at the podium (plaintiff or defendant)
       receipts      hands over a free clue before you ask a thing
       exaggerates   their clues stay "unconfirmed" until an Objection checks them
       showman       your zingers land twice as hard
       crowd         the audience starts the episode warm
       intimidating  the jury hesitates to rule against them
     in the jury box
       spiteful      has a grudge against a party and votes to hurt them
       loyal         backs the party you are fondest of, when there is a clear one
       sleepy        may doze through the vote
       gossip        sways the juror sitting beside them
       trusts        any juror who is fond of you leans your way (from bond alone)

   Everything here is pure: the engine records who sits where in `ep.cast` when
   the episode is cast, and these functions turn that into perks, tags, one
   line of explanation each and the jury's votes. A cast with none of these
   traits (and no strong bonds or old quarrels) leaves every formula exactly
   as it was, which is what keeps the old tests valid. */

const ROLE_TRAITS = {
  receipts: ['witness', 'auditor', 'hoarder', 'complaints', 'physician'],
  exaggerates: ['terminal', 'martyr', 'narcissist', 'influencer', 'closer', 'revisionist', 'prophet', 'doom'],
  showman: ['theatrical', 'method', 'understudy', 'glitter'],
  crowd: ['sugar', 'porcelain', 'socialite', 'clean', 'freegan'],
  intimidating: ['feral', 'bitey', 'napoleon', 'fullname', 'landlord', 'bones', 'steward'],
  spiteful: ['spiteful', 'litigious', 'critic', 'minimalist'],
  loyal: ['clingy', 'lifecoach', 'heirloom', 'mourner'],
  sleepy: ['nocturnal', 'sleepwalker', 'amnesiac', 'nihilist', 'doomscroll', 'insomniac'],
  gossip: ['gossip', 'paranoid', 'taxidermy', 'hummer']
};
export const PARTY_ROLES = ['receipts', 'exaggerates', 'showman', 'crowd', 'intimidating'];
export const JUROR_ROLES = ['spiteful', 'loyal', 'sleepy', 'gossip'];
export const ROLE_TAG = {
  receipts: 'Receipts', exaggerates: 'Exaggerates', showman: 'Showman', crowd: 'Crowd favourite', intimidating: 'Intimidating',
  spiteful: 'Grudge', loyal: 'Loyal', sleepy: 'Sleepy', gossip: 'Gossip', trusts: 'Trusts you'
};
export const roleTraits = role => ROLE_TRAITS[role] || [];

export const TRUST_BOND = 10;       // a juror this fond of you leans your way
export const DEVOTED_BOND = 20;
export const LOYAL_GAP = 3;         // how much fonder of one party than the other makes a favourite
export const SLEEP_CHANCE = 0.4;
export const WARM_RATINGS = 5;      // what a crowd favourite adds to the starting ratings
export const AFRAID = 0.08;         // how much less likely a juror is to rule against an intimidating party
export const WHISPER = 0.15;        // how far a gossip moves the juror beside them

const has = (traits, role) => Array.isArray(traits) && traits.some(t => ROLE_TRAITS[role].includes(t));

// The record of one seat in an episode: enough to reason about it without the pet.
export function seatOf(pet, dislikes = []) {
  const traits = pet && Array.isArray(pet.traits) ? pet.traits.filter(t => Object.hasOwn(TRAIT_BY_ID, t)).slice(0, 8) : [];
  return { traits, bond: pet && Number.isFinite(pet.bond) ? Math.max(0, Math.min(25, pet.bond)) : 0, dislikes };
}
const NO_SEAT = { traits: [], bond: 0, dislikes: [] };
const seatAt = (ep, side) => (ep.cast && ep.cast[side]) || NO_SEAT;
const jurorAt = (ep, i) => (ep.cast && ep.cast.jury && ep.cast.jury[i]) || NO_SEAT;
const sides = ['p', 'd'];

// Who has which role at the podium.
export function partyRoles(ep) {
  const out = {};
  for (const role of PARTY_ROLES) out[role] = sides.filter(side => has(seatAt(ep, side).traits, role));
  return out;
}
// The favourite, if one party is clearly fonder-of-you than the other.
export function favourite(ep) {
  const p = seatAt(ep, 'p').bond, d = seatAt(ep, 'd').bond;
  return p - d >= LOYAL_GAP ? 'p' : d - p >= LOYAL_GAP ? 'd' : null;
}
// The roles a juror is actually playing in this episode (a role with nothing to act on is dormant).
export function jurorRoles(ep, i) {
  const seat = jurorAt(ep, i), roles = [];
  if (has(seat.traits, 'sleepy')) roles.push('sleepy');
  if (has(seat.traits, 'spiteful') && seat.dislikes.length) roles.push('spiteful');
  if (has(seat.traits, 'loyal') && favourite(ep)) roles.push('loyal');
  if (has(seat.traits, 'gossip')) roles.push('gossip');
  if (seat.bond >= TRUST_BOND) roles.push('trusts');
  return roles;
}
export const trustLean = bond => (bond >= DEVOTED_BOND ? 0.08 : bond >= TRUST_BOND ? 0.05 : 0);

// A ruling helps a party if it goes their way, and hurts them if it goes the other or to nobody.
const hurts = (ruling, side) => ruling === 'both' || ruling === (side === 'p' ? 'defendant' : 'plaintiff');
const helps = (ruling, side) => ruling === (side === 'p' ? 'plaintiff' : 'defendant');

// The party a clue question is mostly about: whoever speaks most in its answers.
export function questionSource(q) {
  const sets = q && q.lines && Array.isArray(q.lines.alt) ? q.lines.alt : [q?.lines || []];
  let p = 0, d = 0;
  for (const line of sets.flat()) { if (line[0] === 'p') p++; else if (line[0] === 'd') d++; }
  return p > d ? 'p' : d > p ? 'd' : null;
}

// Does a clue from this question arrive unconfirmed because of who is telling it?
export const exaggerated = (ep, q) => {
  const side = questionSource(q);
  return !!side && has(seatAt(ep, side).traits, 'exaggerates');
};
// Zingers land twice as hard with a showman at a podium.
export const showmanBonus = ep => partyRoles(ep).showman.length > 0;
export const startingRatings = ep => 50 + WARM_RATINGS * partyRoles(ep).crowd.length;

/* ---- the jury's vote ----
   One roll per juror, as before, against the same base chance; a role moves
   the chance, decides the vote outright, or makes the juror absent. Returns the
   votes and a note for each juror a role touched, for the lines and the seats. */
export function voteJury(ep, ruling, chance, rnd) {
  const roles = partyRoles(ep), n = ep.jury.length;
  const afraid = sides.some(side => roles.intimidating.includes(side) && hurts(ruling, side));
  const fav = favourite(ep);
  const votes = [], notes = [], absent = [];
  let whisper = 0;
  for (let i = 0; i < n; i++) {
    const seat = jurorAt(ep, i), active = jurorRoles(ep, i), name = ep.jury[i].name;
    const roll = rnd();
    const delta = (active.includes('trusts') ? trustLean(seat.bond) : 0) - (afraid ? AFRAID : 0);
    const plain = delta === 0 && whisper === 0;
    const chanceHere = plain ? chance : Math.max(0, Math.min(1, chance + delta + whisper));
    let vote = roll < chanceHere;
    const swayed = whisper !== 0 && vote !== (roll < Math.max(0, Math.min(1, chance + delta)));
    if (active.includes('spiteful')) {
      const against = seat.dislikes, hurt = against.every(side => hurts(ruling, side));
      vote = hurt;
      const named = (hurt ? against : against.filter(side => !hurts(ruling, side))).map(side => ep[side].name).join(' and ');
      notes.push({ seat: i, role: 'spiteful', text: name + ' votes ' + (vote ? 'with' : 'against') + ' the ruling because it ' + (vote ? 'hurts ' : 'spares ') + named + '. It has been waiting.' });
    } else if (active.includes('loyal')) {
      vote = helps(ruling, fav);
      notes.push({ seat: i, role: 'loyal', text: name + ' backs ' + ep[fav].name + ', and votes ' + (vote ? 'with' : 'against') + ' the ruling on that basis alone.' });
    } else if (swayed) notes.push({ seat: i, role: 'gossip', text: name + ' was told what to think by the juror next door, and thought it.' });
    if (active.includes('sleepy') && rnd() < SLEEP_CHANCE) {
      vote = false; absent.push(i);
      notes.push({ seat: i, role: 'sleepy', text: name + ' sleeps through the vote and is marked absent.' });
    }
    votes.push(vote);
    whisper = active.includes('gossip') ? (vote ? WHISPER : -WHISPER) : 0;
  }
  return { votes, notes, absent };
}

/* ---- what the player is told ---- */

// Every role in play, with the words that explain it. `side` is p, d or j (a juror).
export function describeCast(ep) {
  const out = [];
  const name = side => ep[side].name;
  const roles = partyRoles(ep);
  const party = {
    receipts: side => name(side) + ' keeps receipts: one free clue before you ask a thing.',
    exaggerates: side => name(side) + ' exaggerates: clues from their answers stay unconfirmed until an Objection checks them.',
    showman: side => name(side) + ' plays to the room: your zingers land twice as hard.',
    crowd: side => name(side) + ' is a crowd favourite: the audience starts the show warm.',
    intimidating: side => name(side) + ' is intimidating: the jury hesitates to rule against them.'
  };
  for (const role of PARTY_ROLES) for (const side of roles[role]) out.push({ role, side, seat: -1, name: name(side), tag: ROLE_TAG[role], text: party[role](side) });
  const fav = favourite(ep);
  ep.jury.forEach((j, i) => {
    const text = {
      spiteful: () => j.name + ' has it in for ' + jurorAt(ep, i).dislikes.map(side => name(side)).join(' and ') + ' and backs any ruling that hurts them.',
      loyal: () => j.name + ' backs ' + name(fav) + ', whom you like best, and votes for any ruling in their favour.',
      sleepy: () => j.name + ' is on the jury and may doze through the vote.',
      gossip: () => j.name + ' gossips: the juror beside them tends to vote the way they do.'
    };
    for (const role of jurorRoles(ep, i)) {
      if (role === 'trusts') continue;
      out.push({ role, side: 'j', seat: i, name: j.name, tag: ROLE_TAG[role], text: text[role]() });
    }
  });
  const fond = ep.jury.filter((_, i) => jurorRoles(ep, i).includes('trusts'));
  if (fond.length) out.push({ role: 'trusts', side: 'j', seat: -1, name: '', tag: ROLE_TAG.trusts, count: fond.length,
    text: (fond.length === 1 ? fond[0].name + ' trusts you' : fond.length + ' jurors trust you') + ' (bond ' + TRUST_BOND + ' or more) and lean your way.' });
  return out;
}
// Tags for one seat: side 'p' or 'd' for a podium, or a jury index for a juror.
export function seatTags(ep, who) {
  return describeCast(ep).filter(x => (typeof who === 'number' ? x.side === 'j' && x.seat === who : x.side === who)).map(x => ({ role: x.role, tag: x.tag, text: x.text }));
}
// The lobby's "Why this cast matters": the lines that matter most, at most `limit`.
export function castBriefing(ep, limit = 3) {
  const all = describeCast(ep), order = [...PARTY_ROLES, 'spiteful', 'loyal', 'sleepy', 'gossip', 'trusts'];
  return all.sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role)).slice(0, limit).map(x => x.text);
}
