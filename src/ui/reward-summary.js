export function rewardSummary(result) {
  if (!result) return 'Result recorded.';
  if (result.practice) return 'Practice complete. Wins and records still count; rewards return when rested and awake.';
  const attention = result.fuss > 0 ? '+' + Math.round(result.fuss) + ' attention.'
    : result.clean === false ? 'Attention unchanged.' : 'Attention already full.';
  const trust = result.bond > 0 ? '+' + result.bond + ' trust.'
    : result.clean === false ? 'Trust needs a clean win.' : 'Daily bonus trust limit reached. Useful care can still build trust.';
  return attention + ' ' + trust;
}
