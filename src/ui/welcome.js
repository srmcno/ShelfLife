import { welcomeView, unpackWelcome, chooseWelcome, welcomeScene } from '../engine/welcome.js';
import { lifeState } from '../engine/life.js';
import { mountHouseholdScene } from '../art/household-scene.js';
import { save } from '../state.js';

const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let scenePlayer = null, lastKey = '';
export function welcomeRewardLabel(reward) {
  const parts = [];
  if (reward.food) parts.push('+' + reward.food + ' food');
  if (reward.fuss) parts.push('+' + reward.fuss + ' attention');
  if (!parts.length) parts.push('Needs already full');
  parts.push(reward.discovery ? '+1 discovery' : 'Memory kept');
  return parts.join(' · ');
}
export function renderWelcome(state) {
  const host = document.getElementById('welcomePanel'); if (!host) return;
  const v = welcomeView(state);
  const dismissed = lifeState(state).welcome?.dismissed;
  host.hidden = !v || dismissed === true;
  if (host.hidden) { scenePlayer?.destroy(); scenePlayer = null; lastKey = ''; return; }
  const key = JSON.stringify([v.stage,v.pet.id,v.pet.name,v.reason,v.choice,v.asleep,v.text,v.stage==='ready'?v.rewards:null]);
  if (key === lastKey) return; lastKey = key;
  scenePlayer?.destroy(); scenePlayer = null;
  host.innerHTML = '<div class="welcome-copy"><span class="eyebrow">'+(v.stage==='finished'?'Your first household memory':'A housewarming, of sorts')+'</span><h2 id="welcomeTitle">'+esc(v.stage==='offered'?v.pet.name+' has company.':v.stage==='ready'?'Who gets the first bite?':'A beginning they can remember.')+'</h2><p>'+esc(v.stage==='offered'?v.line:v.stage==='ready'?'Madam Moth is only visiting. Share a serving for company, or let your resident eat it all. The bowl stays on the shelf.':v.text)+'</p></div>';
  if (v.stage === 'offered') host.insertAdjacentHTML('beforeend','<div class="welcome-actions"><button class="btn btn-primary" data-welcome="unpack" '+(v.reason?'disabled':'')+'>Unpack the housewarming bowl</button><button class="btn btn-ghost" data-welcome="skip">Just us for now</button></div><p class="hint">'+esc(v.reason||'One short visit. No permanent resident added. You can make a neighbour whenever you choose.')+'</p>');
  else {
    host.insertAdjacentHTML('beforeend','<div id="welcomeStage"></div>');
    scenePlayer=mountHouseholdScene(host.querySelector('#welcomeStage'),state,welcomeScene(state),{mini:v.stage==='ready'});
    if(v.stage==='ready')host.insertAdjacentHTML('beforeend','<div class="welcome-actions"><button class="btn btn-primary" data-welcome="share" '+(v.reason?'disabled':'')+'>Share the serving<small>'+esc(welcomeRewardLabel(v.rewards.share))+'</small></button><button class="btn" data-welcome="keep" '+(v.reason?'disabled':'')+'>Keep the first bite<small>'+esc(welcomeRewardLabel(v.rewards.keep))+'</small></button></div><p class="hint">'+esc(v.reason||'Both choices use one real serving and discover a household memory. Sleeping care has half effect.')+'</p>');
    else host.insertAdjacentHTML('beforeend','<div class="welcome-actions"><button class="btn btn-primary" data-welcome="neighbour">Make a permanent neighbour</button><button class="btn" data-welcome="play">Play together</button><button class="btn btn-ghost" data-welcome="dismiss">Back to the shelf</button></div><p class="hint">Your choice is saved. Appearance and names can change later; their history stays.</p>');
  }
}
export function initWelcome(state, refresh) {
  document.getElementById('welcomePanel')?.addEventListener('click', e => {
    const action=e.target.closest('[data-welcome]')?.dataset.welcome;if(!action)return;
    if(action==='unpack')unpackWelcome(state);
    else if(['share','keep'].includes(action))chooseWelcome(state,action);
    else if(action==='skip'){const l=lifeState(state);l.introDone=true;l.welcome={petId:state.pets[0]?.id,dismissed:true};}
    else if(['dismiss','neighbour','play'].includes(action)){
      const petId=lifeState(state).welcome.petId;
      lifeState(state).welcome.dismissed=true;
      scenePlayer?.destroy();scenePlayer=null;
      if(action==='dismiss')window.dispatchEvent(new CustomEvent('shelflife:goto',{detail:{tab:'shelf',target:'#cabinet'}}));
      if(action==='neighbour')document.getElementById('newPetBtn').click();
      if(action==='play')window.dispatchEvent(new CustomEvent('shelflife:play',{detail:{petId}}));
    }
    save();refresh();
  });
  // The same cleanup contract as other finite scenes, including dialog handoffs.
  document.addEventListener('visibilitychange',()=>{if(document.hidden)scenePlayer?.pause?.();});
}
