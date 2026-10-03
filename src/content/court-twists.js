import { TWISTS_A } from './court-twists-a.js';
import { TWISTS_B } from './court-twists-b.js';

/* Shelf Court twists. A twist is an alternate version of a case in which the
   investigation shows the truth to be different: the opening statements are
   shared, while the testimony, the case notes, the rulings and the hallway
   lines change. The data lives in two files so two writers can work in
   parallel; this index joins them. See engine/court-twists.js for how a twist
   is applied to a case and for the rules the test suite checks every twist
   against. */
export const TWISTS = { ...TWISTS_A, ...TWISTS_B };

// Every twist written for a case, in the order they were written. Possibly none.
export const twistsFor = caseId => (Object.hasOwn(TWISTS, caseId) && Array.isArray(TWISTS[caseId]) ? TWISTS[caseId] : []);
