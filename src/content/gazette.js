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
