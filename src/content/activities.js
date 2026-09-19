// The playroom describes the real activities, not a second progression system.
export const ACTIVITIES = [
  { id: 'chase', title: 'Crumb Chase', kind: 'Arcade', time: '22s or 3 acts', icon: 'crumb', line: 'The dust has developed a taste for witnesses.', detail: 'Quick Chase or a three-act Midnight Run. Beat contracts, choose lasting upgrades, dodge broom sweeps and chase the gold finale.', mode: 'chase' },
  { id: 'memory', title: 'Secret handshake', kind: 'Memory', time: 'At your pace', icon: 'hand', line: 'The last member forgot the sequence. We have their hands.', detail: 'Learn short Echo, longer sequences, Mirror reversals, then alternating Duet beats. Slow demonstrations and five-round encores.', mode: 'memory' },
  { id: 'alibi', title: 'The Alibi', kind: 'Deduction', time: 'No timer', icon: 'eye', line: 'Three statements. An impressive disregard for facts.', detail: 'Learn to spot a lie, support it with a true record, then combine two facts to disprove a claim. Casual play and an untimed evidence notebook.', mode: 'alibi' },
  { id: 'outing', title: 'Beyond the shelf', kind: 'Adventure', time: '3 decisions', icon: 'map', line: 'Bring a friend. It improves your odds of being the survivor.', detail: 'Recover two distinct parts to build a Button Lift, Midnight Larder or Thimble Bath. Ration nerve, pack the right tool, and return home when the objective is secured. Parts persist between trips.', life: 'outing' },
  { id: 'court', title: 'Shelf Court', kind: 'Detective', time: 'No timer', icon: 'scales', line: 'Presumed innocent. Deeply resented for it.', detail: 'Inspect the crime clues, compare each suspect’s verified facts and clear anyone who conflicts with a clue. Accuse the one who fits every clue. No timer; mistakes are explained and progress is saved.', life: 'court' },
  { id: 'market', title: 'The Night Market', kind: 'Strategy', time: '8 stalls', icon: 'market', line: 'A household list. One very opinionated bag.', detail: 'Buy pairs for household errands. Deliver them to free bag space and earn shopping money. Learn one errand first, then manage three errands and unlock premium merchant choices. Earlier saved routes keep their original stops.', life: 'market' }
];

// Use completed games across the household, including legacy saves. A stamp
// celebrates trying a game; it never requires winning or creates another grind.
export function activityPassport(state) {
  const life = state.life || {}, stories = state.stories || {}, pets = state.pets || [];
  const count = key => Math.max(Number(stories[key]) || 0, pets.reduce((sum, pet) => sum + (Number(pet[key]) || 0), 0));
  const chaseTried = pets.some(p => Object.keys(p.chaseRecords || {}).length > 0 ||
    Number.isFinite(p.chaseBest?.score) || p.chaseBest > 0);
  const counts = { chase:Math.max(count('chases'), chaseTried ? 1 : 0), memory:count('handshakes'), alibi:count('alibis'),
    outing:life.outings || 0, court:life.courtPlays || life.courtWins || 0, market:life.marketRuns || 0 };
  const stamps = ACTIVITIES.map(a => ({ id:a.id, title:a.title, count:counts[a.id], earned:counts[a.id] > 0 ||
    (life.awards || []).includes('game:' + (a.id === 'memory' ? 'memory' : a.id)) }));
  const resume = life.court && !life.court.claimed ? 'court' : life.outing ? 'outing' : life.market && !life.market.claimed ? 'market' : null;
  const next = resume || stamps.find(s => !s.earned)?.id || [...stamps].sort((a,b) => a.count-b.count)[0].id;
  return { stamps, completed:stamps.filter(s => s.earned).length, next, resume:!!resume };
}

export function activityRecord(activity, state, pet) {
  if (!pet) return 'Make a resident to begin';
  const life = state.life || {};
  const count = (value, label) => value + ' ' + label + (value === 1 ? '' : 's');
  if (activity.id === 'chase') {
    const records = Object.entries(pet.chaseRecords || {}).filter(([key]) => !key.startsWith('run:')).map(([,record]) => record);
    const runs = Object.entries(pet.chaseRecords || {}).filter(([key]) => key.startsWith('run:')).map(([,record]) => record);
    const stars = records.reduce((n, r) => n + (r.stars || 0), 0);
    const midnight = runs.length ? 'Midnight best: ' + Math.max(...runs.map(r => r.score || 0)) : '';
    if (records.length) return stars + '/18 venue stars · ' + (midnight ? midnight + ' · ' : '') + count(pet.chases || 0, 'successful run');
    if (midnight) return midnight + ' · ' + count(pet.chases || 0, 'successful run');
    if (Number.isFinite(pet.chaseBest?.score)) return 'Quick Chase best: ' + pet.chaseBest.score + ' · ' + count(pet.chases || 0, 'successful run');
    return 'Three venues · two difficulty modes';
  }
  if (activity.id === 'memory') {
    const best = pet.handshakeBest?.standard;
    return best ? 'Best: ' + count(best.rounds, 'round') + ' · ' + count(best.mistakes, 'mistake') : count(pet.handshakes || 0, 'handshake') + ' completed';
  }
  if (activity.id === 'alibi') return count(pet.alibiWins || 0, 'clean win') + ' · ' + count(pet.alibis || 0, 'game') + ' completed';
  if (activity.id === 'outing') return life.outing ? 'Expedition in progress · resume anytime' : count(life.outings || 0, 'expedition') + ' completed';
  if (activity.id === 'court') return life.court && !life.court.claimed ? 'Case in progress · resume anytime' : count(life.courtWins || 0, 'case') + ' solved' + (life.courtBest ? ' · best ' + life.courtBest : '');
  return life.market && !life.market.claimed ? 'Shopping trip in progress · resume anytime' :
    (life.marketRuns ? count(life.marketRuns, 'trip') + (life.marketErrandBest ? ' · errand best ' + life.marketErrandBest : ' · legacy best ' + (life.marketBest || 0)) : 'Your first questionable purchase awaits');
}
