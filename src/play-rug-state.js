const object = value => value && typeof value === 'object' && !Array.isArray(value);
const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value)
  && !['__proto__', 'prototype', 'constructor'].includes(value);

export const RUG_TRICKS = Object.freeze([
  { id: 'first-catch', label: 'A very good catch', hint: 'Let your resident catch a tossed ball.', line: 'caught the ball, then checked whether you had noticed. You had.' },
  { id: 'high-catch', label: 'A little airborne', hint: 'Try a high toss. Catch it together with a jump.', line: 'left the ground for a ball. Gravity has filed a polite objection.' },
  { id: 'bounce-catch', label: 'On the rebound', hint: 'Try a bounce pass and let your resident collect it.', line: 'caught a bouncing ball. The floor has requested partial credit.' },
  { id: 'first-bubble', label: 'An important pop', hint: 'Pop a bubble, or let your resident investigate one.', line: 'discovered that bubbles are briefly excellent company. You stayed longer.' },
  { id: 'group-burst', label: 'A small commotion', hint: 'Pop three bubbles yourself within a second and a half.', line: 'watched you pop three bubbles in a flurry. This is now an approved form of weather.' },
  { id: 'five-catches', label: 'One more, please', hint: 'Share five catches during one visit to the rug.', line: 'brought the ball back five times. It had stopped pretending this was an accident.' }
].map(trick => Object.freeze(trick)));

export function blankRug() { return { version: 1, residents: [] }; }

// The rug keeps six permanent moments per current resident. Toy positions,
// live sessions, and event receipts are deliberately not save data.
export function normalizeRug(raw, state = {}, now = Date.now()) {
  const out = blankRug(), source = object(raw) ? raw : {};
  const atNow = Number.isFinite(now) && now >= 0 ? now : Date.now();
  const pets = (Array.isArray(state?.pets) ? state.pets : []).filter(pet => safeId(pet?.id)).slice(0, 18);
  const allowedPets = new Set(pets.map(pet => pet.id)), allowedTricks = new Set(RUG_TRICKS.map(trick => trick.id));
  const found = new Map();
  for (const entry of (Array.isArray(source.residents) ? source.residents : []).slice(0, 72)) {
    if (!object(entry) || !allowedPets.has(entry.petId)) continue;
    const tricks = found.get(entry.petId) || new Map();
    for (const item of (Array.isArray(entry.tricks) ? entry.tricks : []).slice(0, 24)) {
      if (!object(item) || !allowedTricks.has(item.id) || !Number.isFinite(item.at) || item.at < 0 || item.at > atNow) continue;
      if (!tricks.has(item.id) || item.at < tricks.get(item.id)) tricks.set(item.id, item.at);
    }
    found.set(entry.petId, tricks);
  }
  for (const pet of pets) {
    if (out.residents.some(entry => entry.petId === pet.id)) continue;
    const tricks = found.get(pet.id);
    if (tricks?.size) out.residents.push({ petId: pet.id, tricks: RUG_TRICKS.filter(trick => tricks.has(trick.id)).map(trick => ({ id: trick.id, at: tricks.get(trick.id) })) });
  }
  return out;
}

export function rugProgress(state, petId, now = Date.now()) {
  const journal = normalizeRug(state?.rug, state, now), entry = journal.residents.find(item => item.petId === petId);
  const earned = new Map((entry?.tricks || []).map(trick => [trick.id, trick.at]));
  const tricks = RUG_TRICKS.map(trick => ({ ...trick, earned: earned.has(trick.id), at: earned.get(trick.id) ?? null }));
  return { earned: earned.size, total: RUG_TRICKS.length, tricks, next: tricks.find(trick => !trick.earned) || null };
}
