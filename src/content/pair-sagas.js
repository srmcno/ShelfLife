// These incidents are filed only after the household has earned the next beat.
// The report describes what happens now; earlier events come from the save.
export const PAIR_SAGAS = {
  bureau: {
    name: 'The Department of Missing Crumbs',
    chapters: [
      { title: 'The department opens', text: '{a} and {b} open a missing-crumbs office. Their first client is a crumb. It goes missing during intake. Business is excellent.' },
      { title: 'The inquest', text: '{a} and {b} investigate their own office. The evidence is one oat flake under the desk. Both sign a statement saying the desk was framed.' },
      { title: 'The pardon', text: '{a} and {b} close the case after sitting together in silence. They pardon the oat flake, then eat the only copy of the pardon.' }
    ]
  },
  seance: {
    name: 'A Séance for Something Small',
    chapters: [
      { title: 'The first sitting', text: '{a} and {b} hold a séance for a dead housefly. The fly is on the windowsill, alive, watching two amateurs divide up its estate.' },
      { title: 'A message from beyond', text: '{a} and {b} receive a message from the other side: "Move your elbow." The voice comes from beneath the minutes of their last plot.' },
      { title: 'A kinder haunting', text: '{a} and {b} sit together until the ghost finally leaves. It was the shadow of their hands. They keep the empty chair anyway.' }
    ]
  },
  garden: {
    name: 'The Memorial Garden',
    chapters: [
      { title: 'A grave responsibility', text: '{a} and {b} plant a memorial garden for a lost piece of lint. The lint is found in the seed packet. The service continues; everyone dressed up.' },
      { title: 'The garden grows', text: '{a} and {b} discover the memorial has sprouted something damp. They form a committee to decide whether the deceased should be told.' },
      { title: 'A place to rest', text: '{a} and {b} make room beside the little garden for one another. The fungus gets the good chair. Neither argues.' }
    ]
  },
  pageant: {
    name: 'The Innocence Pageant',
    chapters: [
      { title: 'Opening night', text: '{a} and {b} stage a pageant for Most Convincingly Innocent. The trophy is a polished tooth. Neither will say whose.' },
      { title: 'The judges deliberate', text: '{a} and {b} submit each other as character witnesses. Both statements begin "I was elsewhere." There is only one shelf.' },
      { title: 'Joint custody', text: '{a} and {b} share the tooth trophy after a quiet scene together. It fits in neither mouth. This has never stopped a ceremony.' }
    ]
  },
  feud: {
    name: 'The War of Two Inches',
    openingAfterTruce: '{a} and {b} draw the border promised in their truce. It is two inches wide. Both cross it to dispute the pen.',
    chapters: [
      { title: 'A border is drawn', text: '{a} and {b} declare the gap between their slots a demilitarised zone. It is two inches wide. Both have already crossed it to complain.' },
      { title: 'The crumb treaty', text: '{a} and {b} amend their truce on the underside of a crumb. Clause one forbids staring. They spend the afternoon defining staring.' },
      { title: 'A common enemy', text: '{a} and {b} rehearse an apology, then file a joint complaint against the mediator. It is the first thing they have agreed to sign.' }
    ]
  }
};
