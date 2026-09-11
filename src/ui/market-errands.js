import { MARKET_TAGS, MARKET_STALLS, RELICS } from '../content/life.js';
import { ERRAND_ITEM_LINES, ERRAND_VENDOR_LINES } from '../content/market-errands.js';
import { deliveryOptions, bestErrandScore, errandProgress, errandPurchasePreview, maxRemainingErrands } from '../engine/market-errands.js';
import { curioSVG } from '../art/curios.js';

const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(label,action,extra='')=>'<button class="btn" data-life="'+action+'" '+extra+'>'+label+'</button>';
const tags=item=>item.tags.map(t=>'<span class="market-tag tag-'+t+'">'+MARKET_TAGS[t]+'</span>').join('');
const owner=(m,i)=>m.patrons[i]||'The household';
const itemLine=item=>ERRAND_ITEM_LINES[item.id]||item.line;
function shoppingHint(m,r){
  const progress=errandProgress(m,r);
  if(progress.delivered)return 'Delivered';
  if(progress.pairs.length)return 'A pair is ready to send home.';
  if(!progress.partners.length)return 'Find two objects: '+r.tags.map(t=>MARKET_TAGS[t]).join(' + ')+'.';
  return progress.partners.map(({item,tag})=>'Pair '+item.name+' with a '+MARKET_TAGS[tag].toLowerCase()+' object.').join(' ');
}
function purchaseHint(m,item,trade){
  const preview=errandPurchasePreview(m,item,trade||null);
  if(!preview)return '';
  if(preview.ready.length)return '<div class="market-offer-fit"><b>This purchase makes a delivery ready</b>'+preview.ready.map(({request,pair})=>'<p>'+esc(request.name)+': '+esc(pair.map(i=>i.name).join(' + '))+'.</p>').join('')+'<small>Send the pair home after buying to receive 4 buttons and free two spaces.</small></div>';
  return '<div class="market-offer-fit"><b>'+(preview.helps.length?'Useful for your list':'No unfinished errand needs this object')+'</b>'+(preview.helps.length?'<p>'+esc(preview.helps.map(r=>r.name).join('; '))+'. You will still need a separate matching object.</p>':'<p>Leftover purchases earn no points. Check the route before spending your buttons.</p>')+'</div>';
}
function errands(m,finished=false){
  const ordered=m.requests.map((r,i)=>({r,i,order:m.delivered.includes(r.id)?2:deliveryOptions(m,r).length?0:1}));
  if(!finished)ordered.sort((a,b)=>a.order-b.order||a.i-b.i);
  return '<div class="market-requests">'+ordered.map(({r,i})=>{
    const done=m.delivered.includes(r.id),pairs=deliveryOptions(m,r),receipt=m.receipts.find(x=>x.request===r.id);
    return '<article class="market-request '+(done?'fulfilled':'')+'"><span class="eyebrow">'+esc(owner(m,i))+' · '+(done?'Delivered':'+4 buttons on delivery')+'</span><b>'+esc(r.name)+'</b><div class="market-tags">'+tags(r)+'</div><p>'+esc(r.brief)+'</p>'+
      (done?'<p>'+esc(receipt.items.map(x=>x.name).join(' + '))+'</p><p class="market-delivery-comedy">'+esc(r.delivered)+'</p>':finished?'<p>Not delivered. The household will manage; it has already started discussing your route.</p>':pairs.length?pairs.map(pair=>button('Deliver '+esc(pair.map(x=>x.name).join(' + '))+' · +4 buttons','market-deliver','aria-label="Deliver '+esc(pair.map(x=>x.name).join(' + '))+' for '+esc(owner(m,i))+': '+esc(r.name)+'; receive 4 buttons" data-request="'+r.id+'" data-items="'+pair.map(x=>x.id).join(',')+'"')).join(''):'<small>'+esc(shoppingHint(m,r))+'</small>')+'</article>';
  }).join('')+'</div>';
}
function basket(m,trade){
  return '<h4>Your bag · '+m.bag.length+'/3 spaces</h4><div class="market-bag-items">'+m.bag.map(item=>'<div class="market-packed">'+curioSVG(item.shape,{literal:true})+'<div><b>'+esc(item.name)+'</b><span>'+item.tags.map(t=>MARKET_TAGS[t]).join(' / ')+'</span></div></div>').join('')+'</div>'+(!m.bag.length?'<p>The bag is empty. This is also its preferred working condition.</p>':'')+
    (!m.traded&&m.bag.length&&m.step<6?'<label class="market-trade-label">One return per trip, with a new purchase<select id="marketTrade"><option value="">Keep everything</option>'+m.bag.map(item=>'<option value="'+item.id+'" '+(trade===item.id?'selected':'')+'>Return '+esc(item.name)+' for 1 button</option>').join('')+'</select></label><p class="hint">A return only happens when you buy. Deliveries free two spaces and pay four buttons, so check your errands first. Returning an object leaves fewer objects for deliveries.</p>':m.traded?'<p>Your one return has been used.</p>':'');
}
export function marketErrandMarkup(state,m,trade,selection,panel,{workspace,stage,select}){
  if(!m)return workspace('<div class="market-welcome"><span class="eyebrow">Six stalls · Three errands · No timer</span><h3>They sent you out for two things. Each.</h3>'+stage(0)+'<p>The household has handed you ten buttons and three shopping errands. You have a three-space bag and a porter who knows the way home.</p></div><ol class="market-rules"><li><b>Check the list.</b> Every errand needs two separate objects. Their labels show what they are good for.</li><li><b>Plan six purchases.</b> Each stall allows one purchase. Completing all three errands needs all six objects, so passing or returning one reduces how many errands you can finish. The route shows every future price.</li><li><b>Send a pair home.</b> Choose an errand and deliver two matching objects. They leave your bag. The household pays you four buttons to keep shopping.</li></ol><p>Delivered objects cannot fill another errand. One return is allowed: get one button back while buying a replacement.</p><p class="hint">Aim to finish all three errands. Score: 10 per delivery + buttons brought home. Leftover purchases earn no points. These buttons belong to this outing; your residents’ needs and trust are safe.</p>',button('Get the household’s list','market-start'),'planning');
  const delivered=m.delivered.length,ready=m.requests.filter(r=>deliveryOptions(m,r).length).length;
  if(m.complete){
    const tier=delivered===3?2:delivered===2?1:0,relic=RELICS.find(r=>r.id==='market:'+tier),best=bestErrandScore(m.seed);
    return workspace('<div class="market-welcome market-results">'+curioSVG(relic.shape,{literal:true})+'<span class="eyebrow">Home with the shopping</span><h3 tabindex="-1">'+delivered+' of 3 errands delivered.</h3><p>'+(delivered===3?'Everyone got what they asked for. They are meeting to decide what they meant.':delivered?'Some of the list is done. The unfinished part has elected a spokesperson.':'You brought the list back. It was not one of the errands.')+'</p><p>'+esc(relic.name)+'</p></div><div class="market-tally"><div><b>'+m.score.requestPoints+'</b><span>Delivered errands</span></div><div><b>'+m.buttons+'</b><span>Buttons returned</span></div><div><b>'+m.score.total+'</b><span>Total points</span></div></div><p class="market-record">Best possible on this route: '+best+' points. Your best errand trip: '+(state.life.marketErrandBest||0)+'.</p>'+errands(m,true)+(m.bag.length?'<p><b>Still in the bag:</b> '+esc(m.bag.map(i=>i.name).join(', '))+'. These were not delivered and earn no points.</p>':'')+'<p class="hint">Retry uses the same stock, prices, and list. A new market gives you a fresh list. Previously earned keepsakes give no repeat discoveries.</p>',button('Retry this shopping list','market-retry')+button('New market','market-start')+button('Display keepsake','display'),'result');
  }
  const returned=!m.traded?m.bag.find(i=>i.id===trade):null,available=m.buttons+(returned?1:0),bag=returned?m.bag.filter(i=>i.id!==returned.id):m.bag;
  const selected=select(m,selection,trade),atEnd=m.step===6,full=bag.length>=3,short=selected&&selected.cost>available,possible=maxRemainingErrands(m),afterPass=maxRemainingErrands(m,true);
  const header='<div class="market-heading"><div><span class="eyebrow">'+(atEnd?'Before you go home':'Stall '+(m.step+1)+' / 6')+'</span><h3 tabindex="-1">'+(atEnd?'The porter is waiting.':esc(MARKET_STALLS[m.step].name))+'</h3></div><div class="market-purse"><b>'+m.buttons+'</b><span>buttons</span></div></div>';
  const nav='<div class="market-context-nav" aria-label="Market information">'+button('Errands '+delivered+'/3'+(ready?' · '+ready+' ready':''),'market-panel','data-panel="requests" aria-pressed="'+(panel==='requests')+'"')+button('Bag '+m.bag.length+'/3','market-panel','data-panel="bag" aria-pressed="'+(panel==='bag')+'"')+(!atEnd?button('See the route','market-panel','data-panel="route" aria-pressed="'+(panel==='route')+'"'):'')+'</div>';
  let body=header+nav+(possible<3?'<p class="market-route-status">At most '+possible+' of 3 errands can still be completed from your bag and remaining stalls. Make the most of those deliveries, then bring your spare buttons home.</p>':'')+(m.lastReceipt?'<p class="market-reaction" role="status">'+esc(m.lastReceipt)+'</p>':'');
  if(panel==='requests'||atEnd&&!panel){
    body+='<div class="market-context-panel" tabindex="-1"><h4>Send your shopping home</h4><p>Each delivery uses the two named objects, frees two bag spaces, and pays four buttons. Choose carefully if a pair could fill more than one errand.</p>'+errands(m)+'</div>';
  }else if(panel==='bag')body+='<div class="market-context-panel" tabindex="-1">'+basket(m,trade)+'</div>';
  else if(panel==='route')body+='<div class="market-context-panel market-map" tabindex="-1"><h4>The remaining route</h4><p>One purchase per stall. Deliveries do not use a stall.</p>'+m.stalls.slice(m.step).map((stock,i)=>'<article><b>'+esc(MARKET_STALLS[m.step+i].name)+(i===0?' · here':'')+'</b><div>'+stock.map(item=>'<p><strong>'+esc(item.name)+'</strong><span>'+item.cost+' buttons · '+item.tags.map(t=>MARKET_TAGS[t]).join(' / ')+'</span></p>').join('')+'</div></article>').join('')+'</div>';
  else{
    body+='<div class="market-errand-list">'+m.requests.map((r,i)=>'<p><b>'+esc(owner(m,i))+': '+esc(r.name)+'</b><span>'+(m.delivered.includes(r.id)?'✓ Delivered':deliveryOptions(m,r).length?'Pair ready to deliver':r.tags.map(t=>MARKET_TAGS[t]).join(' + '))+'</span></p>').join('')+'</div>'+stage(m.step,m.stalls[m.step])+'<p class="market-stall-line">'+esc(ERRAND_VENDOR_LINES[m.step].opening)+'</p><div class="market-offer-selector" aria-label="Choose an object">'+m.stalls[m.step].map(item=>'<button class="market-offer-pick '+(item.id===selected.id?'selected':'')+'" data-life="market-select" data-id="'+item.id+'" aria-pressed="'+(item.id===selected.id)+'"><span class="market-choice-price">'+item.cost+' buttons</span><b>'+esc(item.name)+'</b><span class="market-tags">'+tags(item)+'</span></button>').join('')+'</div><p class="market-object-line">'+esc(itemLine(selected))+'</p>'+purchaseHint(m,selected,returned?.id);
  }
  let actions;
  if(atEnd)actions='<p>You can still deliver from your bag before leaving.'+(ready?' A pair is ready: send it home for 10 points and 4 buttons.':'')+'</p>'+(ready&&panel!=='requests'&&panel?button('Send the ready pair','market-panel','data-panel="requests"'):'')+button(ready?'Leave with undelivered shopping':'Return home · '+delivered+'/3 delivered','market-leave');
  else if(panel)actions=button('Back to stall','market-panel','data-panel=""');
  else actions='<p class="market-dock-selection">'+(returned?'Return '+esc(returned.name)+' for 1 button. ':'')+'Selected: '+esc(selected.name)+'</p>'+button(full?'Bag full':short?'Need '+(selected.cost-available)+' more button'+(selected.cost-available===1?'':'s'):(returned?'Return & buy':'Buy')+' · '+selected.cost+' buttons','market-buy','data-id="'+selected.id+'" '+(full||short?'disabled':''))+'<div class="market-next-actions">'+button('Check errands'+(ready?' · pair ready':''),'market-panel','data-panel="requests"')+button(m.step===5?'Pass final stall':'Pass this stall','market-pass')+'</div>'+(full?'<p>Deliver a pair to free space'+(m.traded?'. Your return has been used.':', or open your bag to choose your one return.')+'</p>':'<p>After buying, '+(available-selected.cost<0?'you would need more buttons.':(available-selected.cost)+' button'+(available-selected.cost===1?'':'s')+' would remain. Deliver a pair to earn four back.')+'</p>')+(afterPass<possible?'<p class="market-pass-warning">Passing this stall leaves at most '+afterPass+' of 3 errands possible.</p>':'');
  return workspace(body,actions,atEnd||panel?'context':'playing');
}
