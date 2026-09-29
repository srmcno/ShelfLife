import { SEASONS } from '../content/seasons.js';

const md = (month, day) => month * 100 + day;

// The season whose window includes this date, or null. Windows may wrap the new year.
export function activeSeason(now = Date.now()) {
  const d = new Date(now), today = md(d.getMonth(), d.getDate());
  return SEASONS.find(s => {
    const from = md(...s.from), to = md(...s.to);
    return from <= to ? today >= from && today <= to : today >= from || today <= to;
  }) || null;
}

// Which of a season's curios are in the cabinet.
export function seasonProgress(mayhem, season) {
  const total = season.curios.length;
  const owned = season.curios.filter(c => mayhem.curios[c.id]).length;
  return { owned, total };
}

// The next day the season opens, as a Date, for "returns in October" lines.
export function seasonReturns(season, now = Date.now()) {
  const d = new Date(now);
  const year = md(d.getMonth(), d.getDate()) > md(...season.to) ? d.getFullYear() + 1 : d.getFullYear();
  return new Date(year, season.from[0], season.from[1]);
}
