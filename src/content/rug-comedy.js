// Event-specific physical beats. Facts and callbacks are supplied by the real journal.
export const RUG_LINES = Object.freeze({
 catch: [
  ['mouthful','It tries to swallow the ball. The seams say no.'],
  ['applause','It holds the ball against its ribs and shakes itself for applause.'],
  ['eggs','It cradles the ball. Someone will have to tell it about eggs.'],
  ['teeth','A clean catch. It counts its teeth, then counts the ball’s.'],
  ['ownership','It licks every patch before returning it. Ownership is a wet business.'],
  ['pulse','It checks the ball for a pulse. “Still time for soup.”']
 ],
 fumble: [
  ['wrist','The ball slips through. It glares at the wrist responsible.'],
  ['elbow','It catches with an elbow. The elbow resigns immediately.'],
  ['bounce','It drops the ball and tries to look as though it is burying it.'],
  ['panic','Both hands blame each other. The ball escapes during the hearing.']
 ],
 recover: [
  ['resurrection','It scoops the ball up before the funeral can start. No refunds.'],
  ['teeth-save','It retrieves the ball with its teeth. The hands demand a recount.'],
  ['witness','It saves the rebound, then checks who witnessed the first part.'],
  ['second-life','The ball is back. It charges for a second christening.']
 ],
 miss: [
  ['measure','It lies down beside the missed ball. A woodlouse begins measuring it.'],
  ['mourning','It points at the ball. The woodlouse removes its hat.'],
  ['dignity','It misses, then limps on a leg that was nowhere near the incident.'],
  ['floor','It tells the floor to throw it back. The floor keeps its mouth shut.'],
  ['estate','It declares the ball dead and immediately asks about the estate.'],
  ['suit','It searches the dust for its dignity. Finds somebody else’s tooth.']
 ],
 refuse: [
  ['queue','It folds its arms. “One mouth. Finish what you’ve started.”'],
  ['witnesses','It turns its back on the extra ball. The woodlouse applauds the back.'],
  ['contract','It sits on its hands. The hands appear relieved.']
 ],
 pop: [
  ['widow','A bubble bursts. It asks the next bubble whether they were close.'],
  ['lungs','It inhales the remains and announces it has inherited lungs.'],
  ['wake','It holds a wake lasting exactly as long as its attention span.'],
  ['tongue','It tries to save a bubble on its tongue. A tiny, soapy autopsy.'],
  ['faces','It accuses the bubbles of copying its face. Deletes the witnesses.']
 ],
 return: [
  ['invoice','It throws the ball back. The woodlouse follows with a coffin invoice.'],
  ['damp','Returned slightly heavier. Best not to ask with what.'],
  ['teeth-return','It returns the ball and checks whether any teeth went with it.'],
  ['custody','It releases the ball. “You explain the stains to its mother.”']
 ],
 jump: [
  ['knees','Its knees go first. The rest follows under protest.'],
  ['gravity','It leaps. Something inside it lands a moment later.'],
  ['shadow','It briefly escapes its shadow. The shadow takes the opportunity to stretch.']
 ]
});
const PERSONAL = {
 feral: ['feral-catch','It traps the ball in its mouth and growls at its own hands.'],
 narcissist: ['vain-catch','It presents its good side. The ball is stuck to the other one.'],
 haunted: ['haunted-catch','Something behind its eyes catches first. They dispute whose turn it was.'],
 damp: ['damp-catch','It wrings out the ball. The rug drinks before anyone can object.'],
 spiteful: ['spite-catch','It squeezes the ball until it squeaks, then demands an apology.']
};
export function rugReaction(event, pet, facts = [], used = []) {
 const pool = [...(RUG_LINES[event.type] || [])];
 if(event.type==='catch') { const trait=(pet.traits||[]).find(t=>PERSONAL[t]); if(trait)pool.unshift(PERSONAL[trait]); }
 if(event.type==='return' && facts.some(f=>f.kind==='miss'&&f.petId===pet.id))pool.unshift(['coffin-refund','Alive after all. It demands a refund on the coffin, including the measuring.']);
 if(event.type==='catch' && facts.some(f=>f.kind==='court'))pool.unshift(['convict-ball','It catches the ball and holds it up like evidence. Nobody is lending it the hammer again.']);
 if(event.type==='pop' && facts.some(f=>f.kind==='bath'))pool.unshift(['bath-bubble','It recognizes the smell from the bath. The bubble refuses to discuss parentage.']);
 const item=pool.find(([id])=>!used.includes(id)) || pool[used.length%Math.max(pool.length,1)];
 return item ? {id:item[0],text:item[1]} : null;
}
