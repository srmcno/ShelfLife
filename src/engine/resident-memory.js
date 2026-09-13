// Read the record before writing the callback. These selectors never create
// history, infer a missed promise, or treat the household's win as this pet's.
import { normalizeEscapades } from '../escapade-state.js';
import { escapadeById } from '../content/escapades.js';
const traits = (pet, list) => list.some(id => pet.traits?.includes(id));
const count = n => Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
const pairKey = (a, b) => [a, b].sort().join('|');
const nearby = (state, a, b) => {
  const x = state.slots?.indexOf(a.id), y = state.slots?.indexOf(b.id);
  return x >= 0 && y >= 0 && Math.floor(x / 6) === Math.floor(y / 6) && Math.abs(x - y) <= 2;
};

export function residentVoice(pet) {
  if (traits(pet, ['clingy', 'martyr', 'socialite'])) return 'attached';
  if (traits(pet, ['feral', 'bitey', 'spiteful'])) return 'toothy';
  if (traits(pet, ['theatrical', 'narcissist', 'influencer', 'method'])) return 'dramatic';
  if (traits(pet, ['paranoid', 'cryptid', 'unblinking'])) return 'watchful';
  if (traits(pet, ['ancient', 'nihilist', 'terminal', 'undertaker'])) return 'old';
  return 'plain';
}

function voice(pet, lines) { return lines[residentVoice(pet)] || lines.plain; }

export function residentMemories(state, pet, now = Date.now()) {
  if (!pet || !state.pets?.some(p => p.id === pet.id)) return [];
  const out = [], add = (key, text, evidence) => out.push({ key, text, evidence });
  const kept = normalizeEscapades(state.escapades, state, now).album.filter(r => r.petId === pet.id).at(-1);
  const replay = (state.life?.scenes || []).find(scene => scene.kind === 'escapade' && scene.cast?.includes(pet.id) && scene.at <= now);
  const episode = escapadeById(replay?.stage?.branch || kept?.episodeId);
  const ending = episode?.endings.find(e => replay ? e.keepsake === replay.stage?.object : e.id === kept?.endingId);
  if (ending) add('escapade:' + episode.id + ':' + ending.id, ending.callback.replaceAll('{name}', () => pet.name),
    ending.title + ' was made during a completed adventure with this resident.');
  const old = Array.isArray(pet.names) ? pet.names.slice(0, -1).reverse().find(n => typeof n?.name === 'string' && n.name !== pet.name) : null;
  if (old) add('renamed', voice(pet, {
    attached: 'You called me ' + old.name + '. I still turn round for it. Do not make that sad.',
    toothy: old.name + ' had the same teeth. In case the new name made you brave.',
    dramatic: old.name + ' was my early work. The body is regrettably still the original.',
    watchful: 'I remember ' + old.name + '. Changing the label did not confuse the contents.',
    old: old.name + ' is still in here. We take turns answering.',
    plain: 'I used to be ' + old.name + '. That one still owes me an apology.'
  }), 'Earlier name recorded on this resident.');
  const fed = count(pet.careLog?.food), fussed = count(pet.careLog?.fuss), washed = count(pet.careLog?.clean);
  if (fed >= 3 && fed >= fussed + 2) add('care-food', 'You have fed me ' + fed + ' times. I recognise your hand by its professional qualifications.', fed + ' recorded individual feedings.');
  if (fussed >= 3 && fussed >= washed + 2) add('care-fuss', voice(pet, {
    attached: 'You keep coming back to touch me. I have stopped pretending to be furniture.',
    toothy: 'The fussing is working. I move the teeth away before you arrive.',
    plain: 'You fuss over me more than you wash me. A relationship with a distinctive smell.'
  }), fussed + ' recorded attention actions; ' + washed + ' washes.');
  if (count(pet.fulfilledRequests)) add('promise-kept', voice(pet, {
    attached: 'You did what you said you would. I had prepared a much uglier feeling.',
    toothy: 'You kept your promise. I put the bite back.',
    watchful: 'A promise was kept. I am checking whether it was an accident.',
    plain: 'You kept a promise to me. I keep bringing it up because I liked it.'
  }), count(pet.fulfilledRequests) + ' fulfilled requests recorded.');
  if (count(pet.refusedRequests)) add('request-declined', 'You said no to my request. I respect your honesty. I dislike the rest of it.', count(pet.refusedRequests) + ' declined requests recorded; this was not a broken promise.');
  if (Number.isInteger(pet.displacedFrom) && pet.displacedFrom >= 0 && pet.displacedFrom < (state.slots?.length || 0) && pet.displacedAt > 0 && now >= pet.displacedAt && now - pet.displacedAt < 6 * 3600000) {
    const slot = String.fromCharCode(65 + Math.floor(pet.displacedFrom / 6)) + (pet.displacedFrom % 6 + 1);
    add('moved', 'You moved me away from ' + slot + '. I am letting my body finish the argument.', 'A recorded player move made this resident prefer its earlier place.');
  }
  if (count(pet.handshakes)) add('handshake', voice(pet, {
    attached: 'We have a handshake. I practise my half when your hand is elsewhere.',
    toothy: 'Our handshake contains no biting. That is the part I have to remember.',
    plain: 'I remember our handshake. My body gets there before my dignity.'
  }), count(pet.handshakes) + ' completed handshakes for this resident.');
  for (const [mode, ritual] of Object.entries(pet.handshakeRituals || {})) {
    if (!['echo','mirror','duet'].includes(mode) || !count(ritual?.completions) || !Array.isArray(ritual.opening) || !ritual.opening.length || !ritual.opening.every(n=>Number.isInteger(n)&&n>=0&&n<4)) continue;
    const opening=ritual.opening.slice(0,3).map(n=>['Knock','Wiggle','Blink','Boop'][n]).join(', ');
    add('ritual:'+mode, 'Our ' + mode + ' starts ' + opening + '. I know that bit in my body now. The rest is your problem.', 'The saved opening of this resident\'s completed ' + mode + ' ritual.');
  }
  if (count(pet.chases)) add('chase', 'We chased crumbs together. Small prey, enormous faith in your thumbs.', count(pet.chases) + ' completed chases for this resident.');
  if (count(pet.alibiWins)) add('alibi', 'You caught my alibi. I am practising a face with less information in it.', count(pet.alibiWins) + ' clean Alibi wins with this resident.');
  if (pet.playedAt?.court > 0 && pet.playedAt.court <= now) add('court', 'After court I keep trying to look innocent while eating. It uses too much face.', 'This resident has a recorded Court reward timestamp.');
  const guest = state.stories?.visitor;
  if (guest?.welcomed && guest.hostId === pet.id && typeof guest.kind === 'string') add('visitor', guest.choice === 'crumbs'
    ? 'I shared my food with the visitor. Hospitality feels exactly like having less food.'
    : 'I gave our visitor the tour. All this space, and I still showed them my bit first.', 'This resident hosted the saved visitor and chose ' + (guest.choice === 'crumbs' ? 'food' : 'a tour') + '.');
  const outing = (state.life?.scenes || []).find(scene => scene.kind === 'outing' && scene.cast?.includes(pet.id));
  if (outing) add('outing', 'I went beyond the shelf. Coming home made this ridiculous little plank look different.', 'This resident is in the recorded expedition cast.');
  for (const departed of state.stories?.residents || []) {
    if (typeof departed?.id !== 'string' || typeof departed.name !== 'string' || state.pets.some(p => p.id === departed.id)) continue;
    const shared = state.stories?.relationships?.[pairKey(pet.id, departed.id)];
    if ((shared?.time || 0) < 15 * 60000 && !count(shared?.plots)) continue;
    add('rehomed:' + departed.id, departed.name + ' is elsewhere now. We used to share this shelf. Sometimes the gap gets loud.', 'The rehome record and this pair\'s saved neighbour time or shared plots both survive.');
  }
  for (const other of state.pets || []) {
    if (other.id === pet.id || !nearby(state, pet, other)) continue;
    const key = pairKey(pet.id, other.id), scene = state.theatre?.pairs?.[key];
    if (scene?.actorIds?.includes(pet.id) && scene.actorIds.includes(other.id)) {
      if (scene.last === 'argument') add('pair-argument:' + other.id, other.name + ' and I argued. We are currently sharing the silence badly.', 'The latest recorded scene between these two was an argument.');
      if (scene.last === 'makeup') add('pair-makeup:' + other.id, other.name + ' and I got through an apology. Neither of us enjoyed the sound, but the shelf feels bigger.', 'These two performed a reconciliation scene.');
      if (scene.last === 'comfort') add('pair-comfort:' + other.id, voice(pet, {
        attached: other.name + ' and I sat together. I am trying not to turn it into a permanent arrangement.',
        toothy: other.name + ' and I kept each other company. Nobody lost any surface area.',
        plain: other.name + ' and I were quiet together. It was better than being right.'
      }), 'These two performed a comfort scene.');
    }
    const rel = state.stories?.relationships?.[key];
    if (count(rel?.plots) >= 2) add('shared-plots:' + other.id, other.name + ' knows how I look before trouble. An increasingly inconvenient friendship.', 'At least two recorded shared plots.');
  }
  return out;
}

export function rememberedExchange(state, a, b) {
  const key = pairKey(a.id, b.id), previous = state.theatre?.pairs?.[key];
  if (!previous?.actorIds?.includes(a.id) || !previous.actorIds.includes(b.id)) return null;
  if (previous.last === 'argument') return { turns: [['a', 'About our argument. I have thought of something worse to say.'], ['b', 'Keep it warm. I am enjoying the silence.']], memory: 'pair-argument' };
  if (previous.last === 'makeup') return { turns: [['a', 'I am trying not to ruin our apology.'], ['b', 'Sit here. We can be bad at it together.']], memory: 'pair-makeup' };
  if (previous.last === 'comfort') return { turns: [['a', 'We could do the quiet thing again.'], ['b', 'You make it sound filthy.'], ['a', 'It involved sitting next to you.']], memory: 'pair-comfort' };
  return null;
}
