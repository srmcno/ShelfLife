// The playroom describes the real activities, not a second progression system.
export const ACTIVITIES = [
  { id: 'chase', title: 'Crumb Chase', kind: 'Arcade', time: '22 seconds', icon: 'crumb', line: 'A tiny sprint. A very large snack problem.', detail: 'Steer, jump and build a streak across three venues. Gentle mode is always available.', mode: 'chase' },
  { id: 'memory', title: 'Secret handshake', kind: 'Memory', time: 'At your pace', icon: 'hand', line: 'Join a club with no plausible membership policy.', detail: 'Repeat their gestures. Slow playback, a visual trail and an encore let you set the challenge.', mode: 'memory' },
  { id: 'alibi', title: 'The Alibi', kind: 'Deduction', time: 'No timer', icon: 'eye', line: 'Three statements. An impressive disregard for facts.', detail: 'Find the lie about your own shelf. Keep the evidence notebook open as long as you like.', mode: 'alibi' },
  { id: 'outing', title: 'Beyond the shelf', kind: 'Adventure', time: '3 decisions', icon: 'map', line: 'The distance is small. The paperwork is not.', detail: 'Choose your crew and equipment, explore three routes and bring home nine possible curiosities.', life: 'outing' },
  { id: 'court', title: 'Shelf Court', kind: 'Detective', time: 'No timer', icon: 'scales', line: 'Justice, dispensed at crumb height.', detail: 'Read both clues and identify the one suspect who matches. A wrong answer explains the evidence.', life: 'court' },
  { id: 'market', title: 'The Night Market', kind: 'Strategy', time: '6 stalls', icon: 'market', line: 'Buy something questionable. Keep the receipt.', detail: 'Plan around a tiny budget, a three-item bag and a shopping request. Find combinations worth bringing home.', life: 'market' }
];

export function activityRecord(activity, state, pet) {
  if (!pet) return 'Make a resident to begin';
  const life = state.life || {};
  if (activity.id === 'chase') {
    const records = Object.values(pet.chaseRecords || {});
    const stars = records.reduce((n, r) => n + (r.stars || 0), 0);
    return records.length ? stars + '/18 venue stars · ' + (pet.chases || 0) + ' runs' : 'Three venues · two difficulty modes';
  }
  if (activity.id === 'memory') {
    const best = pet.handshakeBest?.standard;
    return best ? 'Best: ' + best.rounds + ' rounds · ' + best.mistakes + ' mistakes' : (pet.handshakes || 0) + ' handshakes completed';
  }
  if (activity.id === 'alibi') return (pet.alibiWins || 0) + ' clean wins · ' + (pet.alibis || 0) + ' games completed';
  if (activity.id === 'outing') return life.outing ? 'Expedition in progress · resume anytime' : (life.outings || 0) + ' expeditions completed';
  if (activity.id === 'court') return (life.courtWins || 0) + ' cases solved';
  return life.market && !life.market.claimed ? 'Shopping trip in progress · resume anytime' :
    (life.marketRuns ? life.marketRuns + ' trips · best haul ' + (life.marketBest || 0) : 'Your first questionable purchase awaits');
}
