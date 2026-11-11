// A sealed, two-player question. The other choice is revealed only on answering.
import { registerFriendAction, registerPostboxSource, registerSocialView } from './social-registry.js';
import { PARLOUR_CARDS } from '../content/parlour.js';
import { CloudError } from '../cloud/client.js';
import { refreshWeekly, weeklyServerReady } from './weekly-case.js';

// A server that has not yet taken this release's schema accepts only the first
// eighteen questions. Until it shows it has (the weekly count answers), a new
// question is drawn from those; every card can still be read and answered.
const CLASSIC = 18;
const deck = () => weeklyServerReady() ? PARLOUR_CARDS.length : Math.min(CLASSIC, PARLOUR_CARDS.length);

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const choice = n => Number.isInteger(n) && n >= 0 && n < 3;
const prompt = n => Number.isInteger(n) && n >= 0 && n < PARLOUR_CARDS.length;
const rows = new Map();
let draft = null;
const messages = { parlour_wait:'You have sent this friend a question in the last 24 hours. Try again later.',
  dnd:'Your friend has Do not disturb on. Try again later.', not_friends:'This is available to accepted friends only.',
  rate_limited:'Too many requests. Try again later.', already_answered:'This question has already been answered. Check your postbox.',
  not_found:'That question is no longer available.', bad_parlour:'The question could not be sent. Nothing changed.' };
function explain(error) {
  const line=messages[error?.message];
  return line ? new CloudError(line,{ code:error.code, status:error.status }) : error;
}
function makeId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b=crypto.getRandomValues(new Uint8Array(16)); b[6]=(b[6]&15)|64; b[8]=(b[8]&63)|128;
  const s=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');
  return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20);
}
const key = (user, friend) => 'shelflife.parlour.pending.' + user + '.' + friend;
function pending(user, friend) {
  try {
    const x = JSON.parse(localStorage.getItem(key(user, friend)) || 'null');
    return x && uuid(x.id) && x.to === friend && prompt(x.prompt) && choice(x.choice) ? x : null;
  } catch { return null; }
}
function store(user, data) {
  try { localStorage.setItem(key(user, data.to), JSON.stringify(data)); return true; } catch { return false; }
}
function remove(user, data) {
  try { const old = pending(user, data.to); if (old?.id === data.id) localStorage.removeItem(key(user, data.to)); } catch { /* A retry is idempotent. */ }
}
function card(n) { return PARLOUR_CARDS[n]; }
function buttons(n, selected, action) {
  return '<div class="pr-options">' + card(n).choices.map((text, i) => '<button type="button" class="btn" data-sx="' + action + '" data-choice="' + i + '" aria-pressed="' + (selected === i) + '">' + esc(text) + '</button>').join('') + '</div>';
}
function resultHTML(n, first, second, firstName, secondName) {
  const c = card(n);
  return '<div class="pr-game"><h3>' + esc(c.question) + '</h3><div class="pr-result"><p><b>' + esc(firstName) + ':</b> ' + esc(c.choices[first]) + '</p><p><b>' + esc(secondName) + ':</b> ' + esc(c.choices[second]) + '</p><p>' + esc(first === second ? c.same : c.different) + '</p></div></div>';
}
function sendView(ctx, friend, data) {
  const c = card(data.prompt);
  ctx.show({ id:'parlour-send', back:'friend:' + friend.userId, title:'Parlour predictions', kicker:friend.name || 'A friend',
    html:'<div class="pr-game"><p>Choose an answer, then invite your friend to answer the same question. Both answers stay sealed until they reply.</p><h3>' + esc(c.question) + '</h3>' + buttons(data.prompt,data.choice,'parlour-pick') +
      '<div class="fr-actions"><button type="button" class="btn" data-sx="parlour-next"' + (data.locked ? ' disabled' : '') + '>Another question</button><button type="button" class="btn btn-primary" data-sx="parlour-send"' + (choice(data.choice) ? '' : ' disabled') + '>Send question</button></div>' +
      (data.locked ? '<p class="hint">A previous send needs confirmation. Send it again to finish safely.</p>' : '') + '</div>' });
}
function answerView(ctx, item, selected = null) {
  ctx.show({ id:'parlour-answer', back:'postbox', title:'Parlour predictions', kicker:item.name || 'A friend',
    html:'<div class="pr-game"><p>' + esc(item.name || 'A friend') + ' has already answered. Choose yours to reveal both.</p><h3>' + esc(card(item.prompt).question) + '</h3>' + buttons(item.prompt,selected,'parlour-answer-pick') +
      '<button type="button" class="btn btn-primary" data-sx="parlour-answer-send"' + (choice(selected) ? '' : ' disabled') + '>Reveal answers</button></div>' });
}
const lookup = (ctx,id) => (rows.get(ctx.me.userId) || []).find(x => x.id === id);
registerFriendAction({
  id:'parlour', label:'Play parlour predictions', order:18,
  icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M9 10a3 3 0 1 1 4 2.8c-.7.3-1 .8-1 1.5M12 17h.01" stroke-linecap="round"/></svg>',
  available: (_friend,ctx) => ctx.online() ? true : 'Connect to invite a friend.',
  run(friend,ctx) {
    const saved = pending(ctx.me.userId,friend.userId);
    if (!weeklyServerReady()) void refreshWeekly();
    const initial=(Math.floor(Date.now()/86400000)+[...friend.userId].reduce((n,c)=>n+c.charCodeAt(0),0))%deck();
    draft = { friend, prompt:saved?.prompt ?? initial, choice:saved?.choice ?? null, locked:!!saved };
    sendView(ctx,friend,draft);
  }
});
registerSocialView('parlour-send', { async onClick(action,el,ctx) {
  if (!draft || !ctx.friend(draft.friend.userId)) return;
  if (action === 'parlour-next' && !draft.locked) { draft.prompt=(draft.prompt+1)%deck(); draft.choice=null; sendView(ctx,draft.friend,draft); return; }
  if (action === 'parlour-pick' && !draft.locked) { const n=Number(el.dataset.choice); if (choice(n)) { draft.choice=n; sendView(ctx,draft.friend,draft); } return; }
  if (action !== 'parlour-send' || !choice(draft.choice)) return;
  const user=ctx.me.userId, friend=draft.friend;
  const saved=pending(user,friend.userId);
  const data=saved || { id:makeId(), to:friend.userId, prompt:draft.prompt, choice:draft.choice };
  if (!saved && !store(user,data)) { ctx.say('This browser could not save the request. Nothing was sent.'); return; }
  draft.locked=true;
  await ctx.act(async current => {
    try { await ctx.cloud.rpc('parlour_send',{p_id:data.id,p_to:data.to,p_prompt:data.prompt,p_choice:data.choice}); }
    catch (error) {
      // A retry may follow a committed send whose response was lost. Keep it
      // until the server confirms it, even if a later request is refused.
      if (current() && !saved && ['parlour_wait','dnd','not_friends','bad_parlour','rate_limited'].includes(error?.message)) { remove(user,data); draft.locked=false; }
      if (saved) throw new CloudError('The earlier send could not be confirmed. Your question is saved here for another retry.', { code:error?.code, status:error?.status });
      throw explain(error);
    }
    if (!current()) return;
    remove(user,data); ctx.back(); ctx.say('Question sent. The answers will appear after your friend replies.');
  });
} });
registerSocialView('parlour-answer', { async onClick(action,el,ctx) {
  const item=draft?.item; if (!item || !lookup(ctx,item.id)) return;
  if (action === 'parlour-answer-pick') { const n=Number(el.dataset.choice); if (choice(n)) { draft.selected=n; answerView(ctx,item,n); } return; }
  if (action !== 'parlour-answer-send' || !choice(draft.selected)) return;
  const n=draft.selected;
  await ctx.act(async current => {
    let r;
    try { r=await ctx.cloud.rpc('parlour_reply',{p_id:item.id,p_choice:n}); } catch (error) { throw explain(error); }
    if (!current()) return;
    if (!r || !prompt(r.prompt) || !choice(r.first) || !choice(r.second)) throw new Error('The answer could not be read.');
    rows.set(ctx.me.userId,(rows.get(ctx.me.userId)||[]).filter(x=>x.id!==item.id));
    ctx.show({id:'parlour-result',back:'postbox',title:'Both answers',html:resultHTML(r.prompt,r.first,r.second,item.name || 'Your friend','You') + '<button class="btn" type="button" data-sx="parlour-result-done" data-id="' + esc(item.id) + '">Done</button>'});
  });
} });
registerSocialView('parlour-result', { async onClick(action,el,ctx) {
  const id=el.dataset.id; if (action!=='parlour-result-done' || !uuid(id)) return;
  await ctx.act(async current=>{ await ctx.cloud.rpc('parlour_seen',{p_id:id}); if (!current()) return; await ctx.openPostbox(); });
} });
registerPostboxSource({
  id:'parlour', label:'Parlour predictions', order:35, poll:true,
  count(ctx) { return (rows.get(ctx.me.userId)||[]).length; },
  async load(ctx) {
    if (!ctx.social.active()) return [];
    const user=ctx.me.userId, raw=await ctx.cloud.rpc('parlour_inbox');
    if (!ctx.isCurrent() || user!==ctx.me.userId) return [];
    const clean=(Array.isArray(raw)?raw:[]).slice(0,50).filter(r=>uuid(r.id)&&uuid(r.from_user)&&uuid(r.to_user)&&prompt(r.prompt)&&
      ((r.to_user===user && r.second===null && r.first===null && !r.declined) || ([r.to_user,r.from_user].includes(user) && choice(r.first)&&choice(r.second)) || (r.from_user===user && r.declined===true && r.first===null && r.second===null)))
      .map(r=>({id:r.id,from:r.from_user===user?r.to_user:r.from_user,name:typeof r.name==='string'?r.name.slice(0,24):'',prompt:r.prompt,first:r.first,second:r.second,at:Date.parse(r.answered_at||r.created_at)||0,incoming:r.to_user===user && r.second===null,sender:r.from_user===user,declined:r.declined===true}));
    rows.set(user,clean);
    return clean.map(x=>({...x,unread:true,title:x.incoming?'A question for your shelf':x.declined?'Question declined':'Both answers are in',line:card(x.prompt).question}));
  },
  render(item) {
    const body=item.incoming ? '<p>' + esc(item.line) + '</p><div class="fr-actions"><button class="btn btn-sm btn-primary" type="button" data-sx="parlour-answer" data-sx-id="' + esc(item.id) + '">Choose your answer</button><button class="btn btn-sm" type="button" data-sx="parlour-decline" data-sx-id="' + esc(item.id) + '">Decline</button></div>' :
      (item.declined ? '<p>' + esc((item.name || 'Your friend') + ' declined this question.') + '</p>' : resultHTML(item.prompt,item.first,item.second,item.sender?'You':item.name || 'Your friend',item.sender?item.name || 'Your friend':'You')) + '<button class="btn btn-sm" type="button" data-sx="parlour-seen" data-sx-id="' + esc(item.id) + '">Done</button>';
    return '<p class="pb-title"><span class="pb-kind">Parlour</span><b>' + esc(item.title) + '</b></p>' + body;
  },
  async onClick(action,id,ctx) {
    const item=lookup(ctx,id); if (!item) return;
    if (action==='parlour-answer' && item.incoming) { draft={item,selected:null}; answerView(ctx,item); return; }
    if (action==='parlour-decline' && item.incoming) await ctx.act(async current=>{ try { await ctx.cloud.rpc('parlour_decline',{p_id:id}); } catch (error) { throw explain(error); } if (!current()) return; rows.set(ctx.me.userId,(rows.get(ctx.me.userId)||[]).filter(x=>x.id!==id)); await ctx.reloadMail(); ctx.say('Question declined.'); });
    if (action==='parlour-seen' && !item.incoming) await ctx.act(async current=>{ await ctx.cloud.rpc('parlour_seen',{p_id:id}); if (!current()) return; rows.set(ctx.me.userId,(rows.get(ctx.me.userId)||[]).filter(x=>x.id!==id)); await ctx.reloadMail(); });
  }
});
