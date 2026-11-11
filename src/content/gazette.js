// The Neighbourhood Gazette: headlines for what friends' households get up to.
// One is picked from the story's id, so a story keeps its headline for good.
// {who} is the resident, the curio, the case, the game or the set, when known.
export const GAZETTE_HEADLINES = {
  adopted: [
    'New resident moves in, references unavailable',
    'Household expands against all advice',
    'Arrival reported. Luggage: none. Opinions: several',
    'Shelf gains tenant, loses elbow room',
    'Neighbours peer over hedge at newcomer',
    'Vacancy filled before anyone could object',
    'Stranger given a name and a shelf, in that order',
    'Local shelf "not full", insists owner',
    'New face on the shelf. The old faces have noticed',
    'Small immortal thing adopted, paperwork to follow',
    'Housewarming planned. Nobody is bringing a gift',
    'Fresh arrival already has a grievance'
  ],
  coffin: [
    'Coffin opened, contents described as "worth it"',
    'Cabinet receives object nobody should own',
    'Curio acquired. Previous owner unavailable for comment',
    'Local opens coffin, finds something looking back',
    'Rare find leaves the ground, joins the furniture',
    'Collector "just browsing", comes home with relic',
    'Unusual item now sits where guests can see it',
    'Coffin yields evidence. Of what, nobody will say',
    'Something cursed has been given pride of place',
    'Household delighted by object that hums at night',
    'Lid lifted, standards lowered, cabinet improved',
    'Another thing dug up that could have stayed there'
  ],
  verdict: [
    'Shelf Court rules. Both parties claim victory',
    'Judgement delivered, gavel slightly damp',
    'Local resident sued, remains insufferable',
    'The bench has spoken and would like to sit down',
    'Court adjourns. The feud does not',
    'Verdict reached after very little deliberation',
    'Justice done, or something shaped like it',
    'Case closed. Grudge filed for later use',
    'Ghost gallery gasps at ruling, as rehearsed',
    'Defendant found exactly as guilty as expected',
    'Damages awarded in souls and a withering look',
    'Bailiff confirms nobody learned anything'
  ],
  arcade_best: [
    'Arcade record falls. So did several coffins',
    'New best score entered in the books, in ink',
    'Local surprises arcade staff, and themselves',
    'Personal best set. Humility not included',
    'High score under investigation by sore losers',
    'Champion crowned over light refreshments',
    'Reflexes described as "unnatural" by rivals',
    'Record broken. It was asking for it',
    'The dead applaud a very good run',
    'Scoreboard updated, bragging to follow'
  ],
  collection: [
    'Set completed. Collector briefly at peace',
    'Every piece accounted for, against the odds',
    'Cabinet reaches milestone, demands a plaque',
    'Collector closes case, opens another',
    'Full set achieved. Nobody else was counting',
    'Last piece found exactly where it was hiding',
    'Obsession rewarded with a title and some souls',
    'Shelf now officially worth insuring',
    'Complete collection described as "a start"',
    'Museum quality, says owner of museum'
  ],
  almanac: [
    'Almanac tier reached. The Almanac is unimpressed',
    'Another page turned, another prize claimed',
    'Steady progress reported. Suspiciously steady',
    'Tier climbed without visible effort',
    'Chapter advances. Residents take the credit',
    'The register records one more small triumph',
    'Month going well for one household, at least',
    'Almanac staff approve progress, grudgingly',
    'New tier, same residents, slightly smugger',
    'Prizes collected. Shelf space now in question'
  ],
  bond: [
    'Resident admits to fondness, under pressure',
    'Trust rises. Grudges hold steady',
    'Bond deepens. Resident denies everything',
    'Household closer than it would like to say',
    'Affection confirmed by sources close to the bowl',
    'Resident no longer flinches when approached',
    'Milestone reached in a very long acquaintance',
    'Local creature tolerates owner more than before',
    'Loyalty earned the slow way',
    'Relationship upgraded from "landlord"'
  ]
};

// One short line under the headline. Returns '' when there is nothing worth adding.
export function gazetteDetail(kind, { who = '', level = 0, tier = 0, score = 0 } = {}) {
  if (kind === 'adopted') return who ? who + ' has taken a shelf and is settling in loudly.' : '';
  if (kind === 'coffin') return who ? 'The find: ' + who + '.' : '';
  if (kind === 'verdict') return who ? 'On the docket: ' + who + '.' : '';
  if (kind === 'arcade_best') return who ? who + ', ' + score + '. The previous record sends its regards.' : 'A new best of ' + score + '.';
  if (kind === 'collection') return who ? 'The set: ' + who + '.' : '';
  if (kind === 'almanac') return 'Tier ' + tier + ' of 30.';
  if (kind === 'bond') return (who ? who + ' has reached' : 'Reached') + ' bond ' + level + ' of 25.';
  return '';
}

// The six reaction stickers, drawn small. Keys match the server's whitelist.
const sticker = d => '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
export const GAZETTE_STICKERS = {
  candle: sticker('<path d="M9 11h6v9H9z"/><path d="M12 11V9"/><path d="M12 3c1.6 2 2.2 3 2.2 4.2a2.2 2.2 0 0 1-4.4 0C9.8 6 10.4 5 12 3z" fill="currentColor" fill-opacity=".25"/><path d="M7 20h10"/>'),
  skull: sticker('<path d="M5 11a7 7 0 0 1 14 0c0 2.6-1.2 4-2.5 4.8V19h-9v-3.2C6.2 15 5 13.6 5 11z"/><circle cx="9.5" cy="11" r="1.6" fill="currentColor"/><circle cx="14.5" cy="11" r="1.6" fill="currentColor"/><path d="M12 13.5v1.5M10 19v-2M14 19v-2"/>'),
  lily: sticker('<path d="M12 21V12"/><path d="M12 12c-4-1-6-4-5.5-8 2.5.5 4.5 2.5 5.5 5 1-2.5 3-4.5 5.5-5 .5 4-1.5 7-5.5 8z" fill="currentColor" fill-opacity=".2"/><path d="M12 17c-2 0-3.5-1-4-2.5M12 19c2 0 3.5-1 4-2.5"/>'),
  popcorn: sticker('<path d="M7 10l1.5 11h7L17 10z"/><path d="M10 10l.5 11M14 10l-.5 11"/><path d="M7 10a2.2 2.2 0 0 1 1.8-3.6 2.6 2.6 0 0 1 4.8-.8A2.4 2.4 0 0 1 17 8.2 2 2 0 0 1 17 10" fill="currentColor" fill-opacity=".2"/>'),
  rude: sticker('<circle cx="12" cy="12" r="8.5"/><path d="M8 9.5l2.5 1M16 9.5l-2.5 1"/><path d="M9 15.5h6"/><path d="M12 15.5v2.5a1.5 1.5 0 0 0 3 0v-2.5" fill="currentColor" fill-opacity=".3"/>'),
  moth: sticker('<path d="M12 8v10"/><path d="M12 10C9 5 4 5 3.5 9c-.4 3 3 5 8.5 3.5C17.5 14 20.9 12 20.5 9 20 5 15 5 12 10z" fill="currentColor" fill-opacity=".2"/><path d="M12 13c-2 1-4 3.5-3 5.5 1.5.5 2.5-1 3-2.5.5 1.5 1.5 3 3 2.5 1-2-1-4.5-3-5.5z"/><path d="M11 6.5L9.5 4M13 6.5L14.5 4"/>')
};
