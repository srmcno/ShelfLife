const KINDS = ['opening','welcome','miss','fumble','recover','catch','bath','chase','court','market','expedition'];
export function normalizeEchoes(raw, pets=[], now=Date.now()) {
 const ids=new Set(pets.map(p=>p.id));
 const events=(Array.isArray(raw?.events)?raw.events:[]).filter(e=>e&&KINDS.includes(e.kind)&&ids.has(e.petId)&&Number.isFinite(e.at)&&e.at>=0&&e.at<=now&&typeof e.id==='string').slice(-24).map(e=>({id:e.id.slice(0,120),kind:e.kind,petId:e.petId,at:e.at,...(e.kind==='welcome'&&['share','keep','sleep-share','sleep-keep'].includes(e.variant)?{variant:e.variant}:{})}));
 return {version:1,events,openingDone:raw?.openingDone===true,callbacks:(Array.isArray(raw?.callbacks)?raw.callbacks:[]).filter(v=>typeof v==='string').slice(-24)};
}
export function rememberEcho(state,kind,petId,id,now=Date.now(),variant=null) {
 if(!KINDS.includes(kind)||!state.pets.some(p=>p.id===petId)||!Number.isFinite(now)||now<0)return false;
 const journal=state.householdEchoes=normalizeEchoes(state.householdEchoes,state.pets,now);
 if(journal.events.some(e=>e.id===id))return false;
 const last=journal.events.findLast(e=>e.kind===kind&&e.petId===petId);
 if(last&&now-last.at<30000)return false;
 journal.events.push({id,kind,petId,at:now,...(kind==='welcome'?{variant}:{})});journal.events=journal.events.slice(-24);
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
 fumble:['Loose wrist','has tied a black ribbon around the offending wrist. It is still attached and deeply insulted.'],
 recover:['Funeral cancelled','rescued the ball. The woodlouse is eating the condolence sandwiches anyway.'],
 catch:['Something rattles','keeps shaking the ball to see whether the applause is still inside.'],
 bath:['Uninvited bathwater','has put a cup over the bathwater. The cup is moving towards the door.'],
 chase:['Breakfast memorial','brought the crumbs home in a matchbox. The woodlouse has booked the chapel by weight.'],
 court:['Apology duty','has brought home the court’s mourning hat. It keeps apologizing to the biscuit packet.'],
 market:['Something in the bag','has hung the shopping bag up. The bag is quietly trying on the curtains.'],
 expedition:['Evidence from outside','has laid out the recovered objects. The woodlouse is measuring the largest one for a bed.']};
 const welcomeLines={
  share:['No mourners left','is looking for the crumb’s mourners. Madam Moth ate them first. She offers to conduct the search from inside the bowl.'],
  keep:['A bowl-sized coffin','has kept the serving. Madam Moth’s coffin quote is still beside the bowl, doubled after the spat crumb.'],
  'sleep-share':['A sleepy funeral','slept through Madam Moth’s funeral march for the spoonful. The spoon is empty; she is still humming.'],
  'sleep-keep':['One sleeve shorter','slept through Madam Moth eating her own loose sleeve-thread. She has left the other sleeve beside the bowl, looking expectant.']
 };
 const [title,line]=event.kind==='welcome'?(welcomeLines[event.variant]||['Madam Moth was here','still has the visitor’s empty spoon beside the bowl.']):lines[event.kind];return {...event,title,text:pet.name+' '+line};
}
