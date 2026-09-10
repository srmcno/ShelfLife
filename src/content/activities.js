// The playroom describes the real activities, not a second progression system.
export const ACTIVITIES = [
  { id: 'chase', title: 'Crumb Chase', kind: 'Arcade', time: '22 seconds', icon: 'crumb', line: 'The dust has developed a taste for witnesses.', detail: 'Hop, dash through dust and catch the final gold arc. Three venues, replayable courses and a gentle pace.', mode: 'chase' },
  { id: 'memory', title: 'Secret handshake', kind: 'Memory', time: 'At your pace', icon: 'hand', line: 'The last member forgot the sequence. We have their hands.', detail: 'Repeat their gestures. Slow playback, a visual trail and an encore let you set the challenge.', mode: 'memory' },
  { id: 'alibi', title: 'The Alibi', kind: 'Deduction', time: 'No timer', icon: 'eye', line: 'Three statements. An impressive disregard for facts.', detail: 'Find the lie about your own shelf. Keep the evidence notebook open as long as you like.', mode: 'alibi' },
  { id: 'outing', title: 'Beyond the shelf', kind: 'Adventure', time: '3 decisions', icon: 'map', line: 'Bring a friend. It improves your odds of being the survivor.', detail: 'Choose your crew, ration your nerve and spend one tool at the right moment. Three routes and nine relics.', life: 'outing' },
  { id: 'court', title: 'Shelf Court', kind: 'Detective', time: 'No timer', icon: 'scales', line: 'Presumed innocent. Deeply resented for it.', detail: 'Cross-examine residents in the courtroom, challenge testimony with exhibits and deliver a verdict. Three difficulty levels.', life: 'court' },
  { id: 'market', title: 'The Night Market', kind: 'Strategy', time: '6 stalls', icon: 'market', line: 'Estate sale. The estate is still screaming.', detail: 'Plan around ten buttons, three bag spaces and three shopping requests. Preview every stall and combine purchases.', life: 'market' }
];

// Use completed games across the household, including legacy saves. A stamp
// celebrates trying a game; it never requires winning or creates another grind.
export function activityPassport(state) {
  const life = state.life || {}, stories = state.stories || {}, pets = state.pets || [];
  const count = key => Math.max(Number(stories[key]) || 0, pets.reduce((sum, pet) => sum + (Number(pet[key]) || 0), 0));
  const chaseTried = pets.some(p => Object.keys(p.chaseRecords || {}).length > 0 || p.chaseBest > 0);
  const counts = { chase:Math.max(count('chases'), chaseTried ? 1 : 0), memory:count('handshakes'), alibi:count('alibis'),
    outing:life.outings || 0, court:life.courtPlays || life.courtWins || 0, market:life.marketRuns || 0 };
  const stamps = ACTIVITIES.map(a => ({ id:a.id, title:a.title, count:counts[a.id], earned:counts[a.id] > 0 ||
    (life.awards || []).includes('game:' + (a.id === 'memory' ? 'memory' : a.id)) }));
  const resume = life.outing ? 'outing' : life.market && !life.market.claimed ? 'market' : null;
  const next = resume || stamps.find(s => !s.earned)?.id || [...stamps].sort((a,b) => a.count-b.count)[0].id;
  return { stamps, completed:stamps.filter(s => s.earned).length, next, resume:!!resume };
}

export function activityRecord(activity, state, pet) {
  if (!pet) return 'Make a resident to begin';
  const life = state.life || {};
  const count = (value, label) => value + ' ' + label + (value === 1 ? '' : 's');
  if (activity.id === 'chase') {
    const records = Object.values(pet.chaseRecords || {});
    const stars = records.reduce((n, r) => n + (r.stars || 0), 0);
    return records.length ? stars + '/18 venue stars · ' + count(pet.chases || 0, 'successful run') : 'Three venues · two difficulty modes';
  }
  if (activity.id === 'memory') {
    const best = pet.handshakeBest?.standard;
    return best ? 'Best: ' + count(best.rounds, 'round') + ' · ' + count(best.mistakes, 'mistake') : count(pet.handshakes || 0, 'handshake') + ' completed';
  }
  if (activity.id === 'alibi') return count(pet.alibiWins || 0, 'clean win') + ' · ' + count(pet.alibis || 0, 'game') + ' completed';
  if (activity.id === 'outing') return life.outing ? 'Expedition in progress · resume anytime' : count(life.outings || 0, 'expedition') + ' completed';
  if (activity.id === 'court') return count(life.courtWins || 0, 'case') + ' solved';
  return life.market && !life.market.claimed ? 'Shopping trip in progress · resume anytime' :
    (life.marketRuns ? count(life.marketRuns, 'trip') + ' · best haul ' + (life.marketBest || 0) : 'Your first questionable purchase awaits');
}
