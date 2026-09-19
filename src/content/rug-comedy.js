import { rugMemoryFact } from '../household-echoes.js';
// The action supplies the joke. The visitor is physically present on the rug;
// callbacks require an event belonging to this resident, never a bystander.
export const RUG_LINES = Object.freeze({
 catch: [
  ['mouthful', 'It tries to swallow the ball. One seam opens. It holds the seam shut.'],
  ['applause', 'It presses the ball to its ear. “Stop that. You are a toy.”'],
  ['eggs', 'It settles over the ball. The woodlouse fetches a smaller coffin.'],
  ['teeth', 'It catches with its mouth, then spends a moment putting its mouth back.'],
  ['ownership', 'It spits on the patch you touched. Rubs it in. Watches your hand.'],
  ['pulse', 'It holds the ball very still. The woodlouse leans closer. “You can piss off.”'],
  ['burial', 'It tucks the ball under its chin. The woodlouse starts digging anyway.'],
  ['seam', 'A stitch gives. It traps the loose end under the ball. Nothing else comes out.']
 ],
 fumble: [
  ['wrist', 'Its wrist folds the wrong way. It puts it back without looking.'],
  ['elbow', 'The ball gets past. The elbow carries on catching.'],
  ['bounce', 'It reaches down for the ball and checks that both hands came back.'],
  ['panic', 'It snaps at the rebound. One tooth gets there first.'],
  ['blame', '“That was your hand.” It is speaking to its other hand.'],
  ['thread', 'It pulls a loose thread tight with its teeth. Ready again.']
 ],
 recover: [
  ['resurrection', 'It gets the ball back. The woodlouse has already nailed down one end.'],
  ['teeth-save', 'It retrieves the ball with its mouth. “Hands are for guests.”'],
  ['witness', 'It checks the rebound for witnesses. The woodlouse looks busy.'],
  ['second-life', 'It lifts the ball out of the dust. The dust hangs on.'],
  ['refund', 'The woodlouse reaches for the ball. It bites the measuring tape.'],
  ['grip', 'It cups the ball against its belly. Something inside cups it back.']
 ],
 miss: [
  ['measure', 'It lies down. The woodlouse measures it. “Leave room for the grudge.”'],
  ['mourning', 'The woodlouse opens the coffin. It opens one eye. The coffin shuts.'],
  ['dignity', 'It goes rigid beside the ball. The woodlouse tries to bend a knee.'],
  ['floor', 'It lies still until the woodlouse reaches for its teeth.'],
  ['estate', '“I want the ball buried with me.” The woodlouse measures a larger box.'],
  ['suit', 'It points at the coffin lining. “I died on better fabric than that.”'],
  ['toe', 'The woodlouse measures from the wrong end. It corrects him from the floor.'],
  ['wake', 'The woodlouse removes his hat. It asks whether there will be sandwiches.']
 ],
 refuse: [
  ['queue', 'It turns its back. “One mouth. You can see how many mouths.”'],
  ['witnesses', 'It shows you the back of its head. There is no better side.'],
  ['contract', 'It sits on its hands. Something underneath gives a satisfied click.'],
  ['second', '“You throw it. You fetch it.” It has found time to be ill.'],
  ['busy', 'It faces the wall until the extra ball has gone.'],
  ['mouth', 'It closes its mouth carefully, from both ends.']
 ],
 pop: [
  ['widow', 'It asks the next bubble whether they were close.'],
  ['lungs', 'It inhales the burst. A wet cough comes from the wrong end.'],
  ['wake', 'The woodlouse opens his box. Empty again. He checks underneath.'],
  ['tongue', 'It catches the soap on its tongue and keeps chewing after it is gone.'],
  ['faces', 'It bursts its own reflection, then checks whether that helped.'],
  ['soap', 'It licks a drop off the floor. “That used to be someone.”'],
  ['mourners', 'It gathers the surviving bubbles. The funeral becomes progressively smaller.']
 ],
 return: [
  ['invoice', 'It lets the ball go. The woodlouse chases it with the box.'],
  ['damp', 'There is a wet patch where the mouth was. On both sides.'],
  ['teeth-return', 'It counts its teeth with its tongue. Starts again.'],
  ['custody', '“Your turn to put that in your mouth.” It waits.'],
  ['lint', 'It picks a strand off its lip. The strand is still attached to the ball.'],
  ['stitch', 'It smooths the empty place against its chest. Something knocks.']
 ],
 jump: [
  ['knees', 'Its knees go first. The rest has to follow.'],
  ['gravity', 'Something inside lands after it does.'],
  ['shadow', 'The woodlouse slides the coffin under the landing spot.'],
  ['loose', 'One foot arrives pointing backwards. It sorts that out.']
 ]
});
const PERSONAL = {
 feral: ['feral-catch', 'It traps the ball in its mouth and growls at its own hands.'],
 bitey: ['bitey-catch', 'It bites down, waits for a scream, then bites somewhere else.'],
 narcissist: ['vain-catch', 'It shows the ball its good side. Holds it there until it appreciates it.'],
 theatrical: ['theatre-catch', 'It catches, clutches its chest, remembers the ball, and postpones dying.'],
 haunted: ['haunted-catch', 'It catches one-handed. Counts two hands around the ball.'],
 damp: ['damp-catch', 'It squeezes out the ball. The puddle inches back towards its feet.'],
 spiteful: ['spite-catch', 'It waits for the ball to stop moving, then gives it one more squeeze.'],
 undertaker: ['undertaker-catch', 'It straightens the ball’s seams. The woodlouse watches a professional.'],
 porcelain: ['porcelain-catch', 'It catches with a clink. Checks the floor for pieces of itself.'],
 fungal: ['fungal-catch', 'It holds the ball against the growth on its back. The growth grips.'],
 swarm: ['swarm-catch', 'The ball disappears between them. The argument stays outside.'],
 suspicious: ['suspicious-catch', 'It checks the seam for a way in. Then for a way out.']
};
export function rugReaction(event, pet, facts = [], used = []) {
 const pool = [...(RUG_LINES[event.type] || [])];
 const has = kind => facts.some(f => f.kind === kind && f.petId === pet.id);
 const visibleProp=rugMemoryFact(facts,pet.id);
 if(event.type==='catch') { const trait=(pet.traits||[]).find(t=>PERSONAL[t]); if(trait)pool.unshift(PERSONAL[trait]); }
 if(event.type==='return' && has('miss'))pool.unshift(['coffin-refund','It nudges the empty coffin back. “Refund. I am still using all of this.”']);
 if(event.type==='catch' && visibleProp?.kind==='court')pool.unshift(['convict-ball','It eyes the mourning hat. “I have done enough apologizing today.”']);
 if(event.type==='pop' && has('bath'))pool.unshift(['bath-bubble','It sniffs the soap. “You came off me. Do not take that tone.”']);
 if(event.type==='refuse' && visibleProp?.kind==='market')pool.unshift(['market-break','It turns towards the shopping bag. Something inside turns away.']);
 const item=pool.find(([id])=>!used.includes(id)) || pool.find(([id])=>id!==used.at(-1)) || pool[0];
 return item ? {id:item[0],text:item[1]} : null;
}
