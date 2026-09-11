import { bonusTrustLeft } from '../state.js';
import { playWait } from '../engine/play.js';
import { isAsleep } from '../engine/tick.js';

export function rewardPreview(pet, mode, now = Date.now(), { alibiMode = 'prove' } = {}) {
  if (isAsleep(pet, new Date(now))) return 'Practice while they sleep. Records count; care rewards return when they wake.';
  const wait = playWait(pet, now, mode);
  if (wait > 0) return 'Practice: rewards return in ' + Math.ceil(wait / 60000) + ' min. Records still count.';
  const attention = Math.max(0, Math.min(mode === 'alibi' ? 20 : 24, 100 - pet.needs.fuss));
  const trust = Math.max(0, Math.min(1, 25 - (pet.bond || 0), bonusTrustLeft(pet, now)));
  if (mode === 'alibi') {
    const attentionText = attention ? 'Find all 3 lies: up to +' + Math.ceil(attention) + ' attention.' : 'Attention is full.';
    const trustText = trust ? (alibiMode === 'prove' ? 'Prove all 3 with matching records' : 'Find all 3 lies') + ': +1 trust.'
      : pet.bond >= 25 ? 'Trust is full.' : 'Bonus trust returns tomorrow.';
    return attentionText + ' ' + trustText;
  }
  const goal = mode === 'chase' ? 'Reach the crumb goal' : 'Finish all rounds';
  return goal + ': ' + (attention ? 'up to +' + Math.ceil(attention) + ' attention' : 'attention full') +
    (trust ? ' and +1 trust.' : pet.bond >= 25 ? '. Trust is full.' : '. Bonus trust returns tomorrow.');
}

export function rewardSummary(result, { alibiMode } = {}) {
  if (!result) return 'Result recorded.';
  const cleanWin = alibiMode === 'prove' ? 'all 3 lies and their matching records' : alibiMode === 'quick' ? 'all 3 lies' : 'a clean win';
  if (result.practice && result.clean === false) return 'Practice complete. Interview recorded. A win needs ' + cleanWin + '.';
  if (result.practice) return 'Practice complete. Wins and records still count; rewards return when rested and awake.';
  const attention = result.fuss > 0 ? (Math.round(result.fuss) ? '+' + Math.round(result.fuss) + ' attention.' : 'Attention topped up.')
    : result.clean === false ? 'Attention unchanged.' : 'Attention already full.';
  const trust = result.bond > 0 ? '+' + result.bond + ' trust.'
    : result.clean === false ? 'Trust needs ' + cleanWin + '.' : 'No extra trust: your bond or today’s game bonus is full.';
  return attention + ' ' + trust;
}
