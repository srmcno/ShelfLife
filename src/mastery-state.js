// Additive, versioned activity learning. Affection and legacy totals never set difficulty.
export const MASTERY_PATHS = {
 handshake: ['Echo · 2–4 moves', 'Long Echo · 2–5 moves', 'Mirror · reverse the order', 'Duet · remember your beats'],
 alibi: ['Spot the lie', 'Connect a record', 'Combine two facts'],
 court: ['Cozy · direct clues', 'Curious · exclusions', 'Tangled · linked clues'],
 market: ['One household errand', 'Three errands · tight bag', 'Merchant choices · premium deliveries'],
 expedition: ['A quiet survey', 'Crew expertise', 'Branching field routes']
};
export function normalizeMastery(raw) {
 const result={version:1};
 for(const [key,path] of Object.entries(MASTERY_PATHS)){
  const r=raw?.[key]||{},n=x=>Number.isSafeInteger(x)&&x>=0?Math.min(x,1000000):0;
  result[key]={tier:Math.min(n(r.tier),path.length-1),wins:n(r.wins),claimedSerial:n(r.claimedSerial),serial:n(r.serial),receipts:(Array.isArray(r.receipts)?r.receipts:[]).filter(x=>typeof x==='string'&&x.length<100).slice(-64)};
 }
 return result;
}
export function mastery(owner,key){owner.mastery=normalizeMastery(owner.mastery);return owner.mastery[key];}
export function masteryTicket(owner,key){const m=mastery(owner,key);m.serial++;return key+':'+m.serial;}
export function completeMastery(owner,key,tier,receipt,{success=true}={}){
 const m=mastery(owner,key);if(typeof receipt!=='string'||m.receipts.includes(receipt))return false;
 const sequence = receipt.startsWith(key+':') ? Number(receipt.slice(key.length+1)) : 0;
 if(['handshake','alibi','expedition'].includes(key) && sequence && sequence<=m.claimedSerial)return false;
 m.claimedSerial=Math.max(m.claimedSerial,sequence);
 m.receipts.push(receipt);m.receipts=m.receipts.slice(-64);if(success)m.wins++;
 if(success&&tier===m.tier)m.tier=Math.min(m.tier+1,MASTERY_PATHS[key].length-1);return true;
}
const MASTERY_GOALS={handshake:'Finish every round',alibi:'Solve all three rounds',court:'Reach the correct verdict',market:'Deliver every errand',expedition:'Finish all three stops with at least 3 points'};
export function masteryText(owner,key){const m=mastery(owner,key),path=MASTERY_PATHS[key];return 'Mastery '+(m.tier+1)+'/'+path.length+': '+path[m.tier]+'. '+(m.tier<path.length-1?MASTERY_GOALS[key]+' to unlock '+path[m.tier+1]+'.':'All lessons unlocked.')+' Beginner practice and untimed help remain available.';}

export function masteryUnlockText(key,tier){const path=MASTERY_PATHS[key];if(!path||!Number.isInteger(tier)||tier<1||tier>=path.length)return '';return 'Unlocked: '+path[tier]+'. '+(tier<path.length-1?MASTERY_GOALS[key]+' to unlock '+path[tier+1]+'.':'All lessons unlocked.');}
