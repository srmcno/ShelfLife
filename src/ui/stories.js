import { visitorActivityHTML } from './life.js';
import { curioSVG } from '../art/curios.js';
import { startNextCase, storyState, currentCase, caseText, caseGate, advanceCase, requestDescription, acceptRequest, relationship, brokerTruce, welcomeVisitor, inviteVisitor, farewellVisitor, INVITATION_REST, VISIT_LENGTH } from '../engine/stories.js';
import { artPersonality } from '../engine/personality.js';
import { VISITORS } from '../content/stories.js';
import { POSTCARD_CAPTIONS } from '../content/postcards.js';
import { generateCreature } from '../art/creatures.js';
import { renderPetSprite } from '../art/sprite.js';
import { save } from '../state.js';
import { toast } from './toast.js';
import { checkAchievements } from '../engine/achievements.js';
import { checkUnlocks } from '../engine/unlocks.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = n => Number.isFinite(n) ? new Date(n).toLocaleDateString(undefined, { month:'short', day:'numeric' }) : 'Earlier';

export function residentStory(state, pet) {
  const request = requestDescription(state, pet), s = storyState(state);
  let html = '<div class="resident-request"><span class="eyebrow">A personal request</span>';
  if (request) {
    html += '<p>“' + esc(request.text) + '”</p>' + (pet.refusedRequests ? '<small>It remembers the last refusal. The new form is shorter.</small>' : '') +
      (request.status === 'offered' ? '<div class="request-actions"><button class="btn btn-sm" data-request="accept" data-pet="' + pet.id + '">Promise · +1 trust on fulfilment</button><button class="btn btn-ghost btn-sm" data-request="refuse" data-pet="' + pet.id + '">Decline · −1 trust, +1 grudge</button></div>' : '<small class="accepted">Promise accepted. Complete it within ' + Math.max(1, Math.ceil((request.at + 12*3600000 - Date.now()) / 3600000)) + 'h for +1 trust.</small>');
  } else html += '<p>No outstanding promises. For once, this is comfortable silence.</p>';
  html += '</div><div class="card-section-title">Made this way</div><div class="anatomy-cards">' + artPersonality(pet).features.map(f => '<div><b>' + esc(f.name) + '</b><p>' + esc(f.text) + '</p></div>').join('') + '</div>';
  const others = state.pets.filter(p => p.id !== pet.id);
  html += '<div class="card-section-title">Relationship cards</div><div class="relationship-list">';
  html += others.length ? others.map(other => {
    const r = relationship(state, pet, other);
    return '<article><span class="relationship-tag">' + esc(r.label) + '</span><b>' + esc(other.name) + '</b><p>' + esc(r.detail) + '</p>' + (r.label === 'Rivals' && Math.min(pet.bond,other.bond) >= 3 ? '<button class="btn btn-sm" data-truce="' + other.id + '" data-pet="' + pet.id + '">Broker a truce</button>' : '') + '</article>';
  }).join('') : '<p class="hint">A solo shelf still gets visitors. Add another resident to grow lasting friendships and rivalries.</p>';
  return html + '</div>';
}
export function renderStories(state) {
  const s = storyState(state), c = currentCase(state), host = document.getElementById('caseCard');
  const focused = host.contains(document.activeElement) ? document.activeElement.dataset.caseChoice : null;
  if (!c) host.innerHTML = '<span class="eyebrow">Household case files</span><h2>A vacancy in the evidence.</h2><p>Make a resident to open your first six-part household mystery.</p>';
  else {
    const gate = caseGate(state);
    host.innerHTML = '<div class="story-card-head"><span class="eyebrow">Household case file</span><span class="file-stamp">' + (c.beat === 6 ? 'Closed' : '0' + (c.beat + 1) + ' / 06') + '</span></div><h2>' + esc(c.definition.title) + '</h2><div class="case-track" role="group" aria-label="' + c.beat + ' of 6 beats completed">' + Array.from({length:6},(_,i)=>'<i class="' + (i<c.beat?'done':'')+'"></i>').join('') + '</div><p>' + esc(c.beat === 6 ? c.outcome : caseText(state)) + '</p>' +
      (c.beat === 6 ? '<small>Filed in the Memory museum. Each file earns its trust once; replays keep their history.</small><button class="btn" data-case-next>Open another file</button>' : '<p class="case-hint">' + esc(gate.hint) + '</p><div class="case-choices"><button class="btn" data-case-choice="listen"' + (!gate.ready ? ' disabled' : '') + '>' + (c.beat === 5 ? 'Share the solution' : 'Listen & file evidence') + '</button>' + ([3,5].includes(c.beat) ? '<button class="btn btn-ghost" data-case-choice="blame">' + (c.beat === 5 ? 'Close it by decree' : 'Dismiss the testimony') + '</button>' : '') + '</div><small>Listen at least 5 times and keep a resident’s needs at 50+ for a cooperative ending (+2 witness trust). Otherwise: an awkward ending (+12 witness cleanliness).</small>');
  }
  if (focused) host.querySelector('[data-case-choice="'+focused+'"]')?.focus({preventScroll:true});
  renderVisitor(state);
  const highlight = s.highlight;
  const daily = document.getElementById('dailyCard');
  daily.hidden = !state.pets.length;
  // A real highlight from the last day, or a caption: never a copy of the note
  // that is already pinned on the board a few lines down.
  const fresh = highlight && Date.now()-highlight.at<86400000;
  const caption = POSTCARD_CAPTIONS[Math.floor((Date.now()/86400000) % POSTCARD_CAPTIONS.length)];
  const body = fresh ? highlight.text : caption;
  daily.innerHTML = '<div><span class="eyebrow">Postcard of the day</span><b>'+esc(fresh ? highlight.title : 'Wish you were smaller.')+'</b><span>'+esc(body.length>170 ? body.slice(0,168).replace(/\s+\S*$/,'')+'…' : body)+'</span></div><button class="btn btn-sm" data-proxy="postcardBtn">Make postcard ↗</button>';
  document.getElementById('museumCount').textContent = s.archive.length + (s.archive.length === 1 ? ' memory · ' : ' memories · ') + s.collection.length + (s.collection.length === 1 ? ' souvenir' : ' souvenirs');
}
function renderVisitor(state) {
  const s = storyState(state), v = s.visitor, guest = document.getElementById('visitorCard');
  const d = v && VISITORS.find(x => x.id === v.kind);
  // Preserve the host selector, keyboard focus, and the animated portrait across
  // ordinary shelf refreshes. A changed need should never close an open select.
  const inviteMinutes = Math.max(0, Math.ceil(((s.lastInvitation || 0) + INVITATION_REST - Date.now()) / 60000));
  const key = JSON.stringify([v ? 0 : inviteMinutes, v?.kind, v?.at, v?.welcomed, v?.response, v?.activityDone, state.life?.visitorEpisodes, state.pets.map(p => [p.id,p.name]), s.collection.length]);
  const hours = v ? Math.max(0, Math.ceil((v.at + VISIT_LENGTH - Date.now()) / 3600000)) : 0;
  if (guest.dataset.viewKey === key) {
    const clock = guest.querySelector('.guest-clock');
    if (clock) clock.textContent = hours + 'h left';
    return;
  }
  const selectedHost = guest.querySelector('select')?.value;
  const focused = guest.contains(document.activeElement) ? document.activeElement : null;
  const focusedId = focused?.id, focusedChoice = focused?.dataset.visitor;
  const visitKey = v ? v.kind + ':' + v.at : '';
  const sameVisitor = guest.dataset.visitKey === visitKey;
  const portrait = sameVisitor ? guest.querySelector('.guest-portrait') : null;
  guest.dataset.viewKey = key; guest.dataset.visitKey = visitKey;
  guest.classList.toggle('guest-present', !!v);
  if (!v) {
    guest.innerHTML = '<span class="eyebrow">The visiting step</span><h2>No one at the door.</h2><p>' + VISITORS.length + ' unusual callers. One questionable doorstep. Visitors stay six hours; the next arrives 8–18 hours after a departure.</p><small>No need to keep the app open. Missed visits never cost trust.</small><button class="btn btn-sm" data-visit-action="invite" ' + (inviteMinutes || !state.pets.length ? 'disabled' : '') + '>' + (inviteMinutes ? 'Calling cards rest · ' + inviteMinutes + 'm' : 'Send a calling card') + '</button><small>Invite a random guest now, once every 15 minutes.</small>';
    return;
  }
  guest.innerHTML = '<div class="guest-topline"><span class="eyebrow">' + (v.returning ? 'A familiar face · visit ' + (v.visitNumber || 2) : 'A new arrival') + '</span><span class="guest-clock">' + hours + 'h left</span></div><div class="guest-portrait" aria-hidden="true"></div><h2>' + esc(d.name) + '</h2><span class="guest-title">' + esc(d.title) + '</span><p class="guest-dialogue">' + esc(v.welcomed ? v.response || v.host + ' has welcomed ' + d.name + '. The keepsake is safe in the museum.' : v.arrival || d.line) + '</p>' +
    (v.welcomed ? '<div class="guest-receipt"><span class="eyebrow">Safely mislabelled in the museum</span><b>' + esc(d.gift) + '</b><span class="accepted">Souvenirs · ' + s.collection.length + ' / ' + VISITORS.length + '</span><button class="btn btn-ghost btn-sm" data-proxy="museumBtn">View collection ↗</button><button class="btn btn-ghost btn-sm" data-visit-action="farewell">Wave goodbye</button></div>' : '<label class="visitor-host">Choose a host<select id="visitorHost">' + state.pets.map(p => '<option value="'+p.id+'">'+esc(p.name)+'</option>').join('') + '</select></label><div class="request-actions"><button class="btn btn-sm" data-visitor="crumbs">Share crumbs · −8 host food, up to +1 trust</button><button class="btn btn-sm" data-visitor="tour">Give a tour · +8 host attention</button></div><small>Either welcome earns '+esc(d.gift.toLowerCase())+'. No shelf space needed.</small>');
  if(v.welcomed) guest.insertAdjacentHTML('beforeend',visitorActivityHTML(state));
  if (portrait) guest.querySelector('.guest-portrait').replaceWith(portrait);
  else {
    const sprite = renderPetSprite({ id: 'guest-' + d.id, art: { creature: generateCreature(d.classic ? { seed:d.seed, parts:d.parts } : { seed:d.seed, body:d.body, palette:d.palette, parts:d.parts }) } });
    sprite.classList.add('sl-mood-content');
    guest.querySelector('.guest-portrait').appendChild(sprite);
  }
  if (selectedHost && state.pets.some(p => p.id === selectedHost) && guest.querySelector('select')) guest.querySelector('select').value = selectedHost;
  if (focusedId) guest.querySelector('#' + focusedId)?.focus({preventScroll:true});
  else if (focusedChoice) {
    const button = guest.querySelector('[data-visitor="'+focusedChoice+'"]');
    if (button) button.focus({preventScroll:true});
    else { guest.tabIndex = -1; guest.focus({preventScroll:true}); }
  }
}
export function renderMuseum(state) {
  const s = storyState(state), host = document.getElementById('museumContent');
  const memorials = [...s.residents, ...(state.gone || []).filter(p=>!s.residents.some(r=>r.id===p.id))];
  host.innerHTML = '<p class="museum-intro">Nothing here is forgotten. Some of it has been mislabelled.</p><h3>Visiting curiosities <small>'+s.collection.length+' / '+VISITORS.length+'</small></h3><div class="collection-grid">'+VISITORS.map(v=>{
    const found=s.collection.find(x=>x.id===v.id); return '<article class="'+(found?'collected':'uncollected')+'"><span aria-hidden="true">'+(found?curioSVG(v.id):'◇')+'</span><b>'+esc(found?v.gift:'Unclaimed curiosity')+'</b><small>'+esc(found?v.name+' · hosted by '+found.host:'A future visitor carries this.')+'</small></article>';
  }).join('')+'</div><h3>Postcard album <small>Last six saved pictures</small></h3><div class="album">'+(s.postcards.length?s.postcards.map(p=>'<figure><img src="'+esc(p.image)+'" alt="'+esc(p.caption)+'"><figcaption>'+esc(p.caption)+'<small>'+date(p.at)+'</small></figcaption></figure>').join(''):'<p class="hint">Open today’s postcard and choose Keep in museum. A small picture is saved here; Back up preserves the album.</p>')+'</div><h3>Former residents</h3><div class="memorials">'+(memorials.length?memorials.map(p=>'<article><b>'+esc(p.name)+'</b><p>'+esc(p.grudges!=null?p.grudges+' grievances. '+(p.names||[]).map(n=>n.name).join(' → '):'Their old place is still on file.')+'</p><small>Left '+date(p.at)+'</small></article>').join(''):'<p class="hint">Nobody has left. This is not a suggestion.</p>')+'</div><h3>Names & grievances</h3>'+state.pets.map(p=>'<div class="memory-row"><b>'+esc(p.name)+'</b>'+((p.names||[]).length>1?'<span>'+esc(p.names.map(n=>n.name).join(' → '))+'</span>':'')+'<small>'+(p.grudges||0)+(p.grudges===1?' grievance · ':' grievances · ')+(p.handshakes||0)+' secret handshakes · '+(p.chases||0)+' chases'+(p.chaseBest?' · best '+p.chaseBest.score:'')+'</small></div>').join('')+'<h3>The case archive</h3><div class="memory-timeline">'+(s.archive.length?s.archive.map(m=>'<article><small>'+date(m.at)+' · '+esc(m.kind)+'</small><b>'+esc(m.title)+'</b><p>'+esc(m.text)+'</p></article>').join(''):'<p class="hint">Cases, promises, visitors and truces leave their evidence here.</p>')+'</div>';
}
export function initStories(state, refresh, refreshPet) {
  document.addEventListener('click', e => {
    if(e.target.closest('[data-case-next]')){if(startNextCase(state))refresh();return;}
    const visitAction = e.target.closest('[data-visit-action]');
    if (visitAction) {
      const changed = visitAction.dataset.visitAction === 'invite' ? inviteVisitor(state) : farewellVisitor(state);
      if (changed) refresh();
      return;
    }
    const caseButton=e.target.closest('[data-case-choice]'), request=e.target.closest('[data-request]'), truce=e.target.closest('[data-truce]'), visitor=e.target.closest('[data-visitor]');
    if (!caseButton&&!request&&!truce&&!visitor) return;
    let changed=false;
    if (caseButton) changed=advanceCase(state,caseButton.dataset.caseChoice);
    if (request) changed=acceptRequest(state,request.dataset.pet,request.dataset.request==='accept');
    if (truce) changed=brokerTruce(state,truce.dataset.pet,truce.dataset.truce);
    if (visitor) { changed=welcomeVisitor(state,document.getElementById('visitorHost')?.value,visitor.dataset.visitor); if(!changed) toast('A visitor needs to be here, and sharing needs 8 host food. A tour costs no food.'); }
    if(changed){checkAchievements(state);checkUnlocks(state);refresh();if(request||truce)refreshPet((request||truce).dataset.pet);if(caseButton)document.getElementById('caseCard').focus({preventScroll:true});}
  });
  const veil=document.getElementById('museumVeil');
  document.getElementById('museumBtn').addEventListener('click',()=>{renderMuseum(state);veil.classList.add('open');});
  document.getElementById('museumClose').addEventListener('click',()=>veil.classList.remove('open'));
  veil.addEventListener('click',e=>{if(e.target===veil)veil.classList.remove('open');});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')veil.classList.remove('open');});
}
