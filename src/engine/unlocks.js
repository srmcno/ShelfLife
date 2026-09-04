import { BASE_STAMPS, UNLOCK_STAMPS } from '../art/stamps.js';
import { addNote } from '../state.js';

export function totalBond(state) {
  return state.pets.reduce((n, p) => n + p.bond, 0);
}

export function unlockedStampKinds(state) {
  const bond = totalBond(state);
  let out = BASE_STAMPS.slice();
  UNLOCK_STAMPS.forEach(u => { if (bond >= u.at) out = out.concat(u.stamps); });
  return out;
}

export function checkUnlocks(state) {
  const bond = totalBond(state);
  const newly = [];
  UNLOCK_STAMPS.forEach(u => {
    const key = 'stamps:' + u.at;
    if (bond >= u.at && !state.seenUnlocks.includes(key)) {
      state.seenUnlocks.push(key);
      addNote(state, 'They trust you enough for ' + u.label + ' in the studio.', 'the shelf', 'arrival');
      newly.push({ key, label: u.label });
    }
  });
  return newly;
}
