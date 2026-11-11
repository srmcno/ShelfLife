// In-memory stand-in for the Case of the Week RPCs (0016_weekly_case.sql).
const DAY = 86400000, CASE = /^[a-z0-9_-]{1,40}$/, VERDICTS = ['plaintiff', 'defendant', 'both'];
export function createFakeWeekly({ now, json, rest }) {
  const rulings = [];
  const fail = token => rest(400, 'P0001', token);
  const week = () => Math.floor((Math.floor(now() / DAY) + 3) / 7);
  const counts = (w, c, user) => {
    const rows = rulings.filter(r => r.week === w && r.case === c), n = v => rows.filter(r => r.verdict === v).length;
    return json(200, { week: w, case: c, plaintiff: n('plaintiff'), defendant: n('defendant'), both: n('both'), mine: rows.find(r => r.user === user)?.verdict ?? null });
  };
  return { rulings, week, RPC: {
    weekly_rule(user, { p_week, p_case, p_verdict } = {}) {
      if (p_week !== week()) return fail('bad_week');
      if (!CASE.test(p_case || '') || !VERDICTS.includes(p_verdict)) return fail('bad_ruling');
      if (!rulings.some(r => r.week === p_week && r.user === user.id)) rulings.push({ week: p_week, user: user.id, case: p_case, verdict: p_verdict });
      return counts(p_week, p_case, user.id);
    },
    weekly_tally(user, { p_week, p_case } = {}) {
      if (!Number.isInteger(p_week) || p_week < week() - 1 || p_week > week()) return fail('bad_week');
      if (!CASE.test(p_case || '')) return fail('bad_ruling');
      return counts(p_week, p_case, user.id);
    }
  } };
}
