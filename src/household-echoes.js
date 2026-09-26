const KINDS = ['opening','welcome','miss','fumble','recover','catch','bath','chase','court','market','expedition'];
const validVariant = event => event.kind==='welcome' ? ['share','keep','sleep-share','sleep-keep'].includes(event.variant) : event.kind==='court' && ['convicted','witness'].includes(event.variant);
export function normalizeEchoes(raw, pets=[], now=Date.now()) {
 const ids=new Set(pets.map(p=>p.id));
 const events=(Array.isArray(raw?.events)?raw.events:[]).filter(e=>e&&KINDS.includes(e.kind)&&ids.has(e.petId)&&Number.isFinite(e.at)&&e.at>=0&&e.at<=now&&typeof e.id==='string').slice(-24).map(e=>({id:e.id.slice(0,120),kind:e.kind,petId:e.petId,at:e.at,...(validVariant(e)?{variant:e.variant}:{})}));
 return {version:1,events,openingDone:raw?.openingDone===true};
}
export function rememberEcho(state,kind,petId,id,now=Date.now(),variant=null) {
 if(!KINDS.includes(kind)||!state.pets.some(p=>p.id===petId)||!Number.isFinite(now)||now<0)return false;
 const journal=state.householdEchoes=normalizeEchoes(state.householdEchoes,state.pets,now);
 if(journal.events.some(e=>e.id===id))return false;
 const last=journal.events.findLast(e=>e.kind===kind&&e.petId===petId);
 if(last&&now-last.at<30000)return false;
 journal.events.push({id,kind,petId,at:now,...(validVariant({kind,variant})?{variant}:{})});journal.events=journal.events.slice(-24);
 if(kind==='opening'||kind==='welcome')journal.openingDone=true;
 return true;
}
export function householdAftermath(state,petId=null) {
 const journal=normalizeEchoes(state.householdEchoes,state.pets);
 const event=journal.events.filter(e=>!petId||e.petId===petId).at(-1);
 if(!event)return null;
 const pet=state.pets.find(p=>p.id===event.petId);if(!pet)return null;
 const lines={opening:['Crumb funeral','spat one crumb into a matchbox coffin. A visiting woodlouse measured it, then tried to measure the mourner.'],
 miss:['Premature arrangements','is disputing a coffin invoice. The woodlouse says standing up is an optional extra.'],
 fumble:['Loose wrist','has tied a thread around the loose wrist. It tests the knot with its teeth before putting any weight on it.'],
 recover:['Funeral cancelled','rescued the ball. The woodlouse is eating the condolence sandwiches anyway.'],
 catch:['Something rattles','keeps turning the ball over. It is looking for the end the noise came from.'],
 bath:['Uninvited bathwater','has put a cup over the bathwater. The cup is moving towards the door.'],
 chase:['After the chase','is picking dust out of a seam. The woodlouse has put a saucer underneath to catch any useful bits.'],
 court:['Back from court','is practising the judge’s voice into an empty cup. Something at the bottom says “Objection.”'],
 market:['The market bag','has turned the shopping bag inside out. It is checking the seams before putting a hand back in.'],
 expedition:['Back through the crack','is shaking dirt out of its soles. The woodlouse is checking whether anything brought its own feet.']};
 const welcomeLines={
  share:['No mourners left','is looking for the crumb’s mourners. Madam Moth ate them first. She offers to conduct the search from inside the bowl.'],
  keep:['A bowl-sized coffin','has kept the serving. Madam Moth’s coffin quote is still beside the bowl, doubled after the spat crumb.'],
  'sleep-share':['A sleepy funeral','slept through Madam Moth’s funeral march for the spoonful. The spoon is empty; she is still humming.'],
  'sleep-keep':['One sleeve shorter','slept through Madam Moth eating her own loose sleeve-thread. She has left the other sleeve beside the bowl, looking expectant.']
 };
 const courtLines={convicted:['The mourning hat','has put on a mourning hat after the conviction. It pulls the brim down when the woodlouse points at it.'],witness:['A witness comes home','has kept its court seat warm with a borrowed hat. The woodlouse is checking the hat for an owner.']};
 const [title,line]=event.kind==='welcome'?(welcomeLines[event.variant]||['Madam Moth was here','still has the visitor’s empty spoon beside the bowl.']):event.kind==='court'?(courtLines[event.variant]||lines.court):lines[event.kind];return {...event,title,text:pet.name+' '+line};
}
