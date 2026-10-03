/* The bench career: ten ranks that Judge Mortis climbs on lifetime Shelf Court
   stars. Every promotion pays souls and, from the second rank up, dresses the
   courtroom: a gavel, a nameplate, a drape, a banner, a wig, the gallery. The
   cosmetics are drawn in art/court-dress.js and worn automatically; each slot
   shows the best thing unlocked for it. `stars` is the lifetime total needed.
   Souls come to 580 across the nine promotions, roughly fourteen coffins. */
export const BENCH_RANKS = [
  { name: 'Courtroom Sweeper', stars: 0, souls: 0, blurb: 'You sweep. Nobody has said why the floor is always damp.', unlock: null },
  { name: 'Gavel Polisher', stars: 4, souls: 15, blurb: 'You may now touch the gavel, briefly, with a cloth.',
    unlock: { id: 'gavel-brass', slot: 'gavel', style: 'brass', name: 'Brass gavel', blurb: 'Polished until it has opinions.' } },
  { name: 'Docket Clerk', stars: 10, souls: 20, blurb: 'You hold the list. The list holds you responsible.',
    unlock: { id: 'plate', slot: 'plate', style: 'plate', name: 'Brass nameplate', blurb: 'J. MORTIS. The J stands for nothing. He checked.' } },
  { name: 'Usher of Mild Order', stars: 18, souls: 30, blurb: 'You can say “quiet, please” and about a third of the room does.',
    unlock: { id: 'bench-drape', slot: 'bench', style: 'drape', name: 'Bench drape', blurb: 'Burgundy velvet with gold fringe. It hides a stain. Several.' } },
  { name: 'Unpaid Magistrate', stars: 30, souls: 40, blurb: 'The title is real. The pay is the exposure.',
    unlock: { id: 'banner', slot: 'banner', style: 'crest', name: 'Court banner', blurb: 'A crest behind the bench. The motto is Latin for “probably”.' } },
  { name: 'Circuit Judge, Allegedly', stars: 45, souls: 55, blurb: 'Nobody has checked the circuit. It may be a cupboard.',
    unlock: { id: 'wig-gilt', slot: 'wig', style: 'gilt', name: 'Gilt wig', blurb: 'Powdered in actual gold. The moths have been warned.' } },
  { name: 'Recorder of Small Wrongs', stars: 65, souls: 70, blurb: 'You write the little wrongs down. The big ones write themselves.',
    unlock: { id: 'regulars', slot: 'audience', style: 'regulars', name: 'Gallery regulars', blurb: 'Two ghosts now come every day. One of them brings sandwiches.' } },
  { name: 'High Court Wig', stars: 90, souls: 90, blurb: 'The wig is promoted first. You follow, at a respectful distance.',
    unlock: { id: 'gavel-ebony', slot: 'gavel', style: 'ebony', name: 'Ebony gavel', blurb: 'Black as a verdict, with silver bands. It is heavier than it looks.' } },
  { name: 'Master of the Rolls', stars: 125, souls: 110, blurb: 'The rolls are a legal record. Somebody also brought bread.',
    unlock: { id: 'bench-velvet', slot: 'bench', style: 'velvet', name: 'Velvet bench', blurb: 'Deep red, with two candles that are not for the case.' } },
  { name: 'Lord Chief Gavel', stars: 170, souls: 150, blurb: 'There is nothing above you but the ceiling, and it has been consulted.',
    unlock: { id: 'wig-laurel', slot: 'wig', style: 'laurel', name: 'Laurel wig and a spotlight', blurb: 'A wreath on the wig and a spot that follows you. Nobody asked it to.' } }
];
export const BENCH_MAX = BENCH_RANKS.length - 1;
export const BENCH_UNLOCKS = BENCH_RANKS.map((r, rank) => (r.unlock ? { ...r.unlock, rank } : null)).filter(Boolean);
