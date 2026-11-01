// In-memory Gazette RPCs used by browser tests, with the same circle boundary.
export function createFakeGazette({ social, profiles, now, json, rest, uuid }) {
  const events = [], reactions = new Map(), preferences = new Map(), requests = [];
  const fail = code => rest(400, 'P0001', code);
  const prefs = id => preferences.get(id) || { sharing: true, generation: 0, seen: -Infinity };
  const blocked = (a,b) => social.blocks.some(x => (x.blocker === a && x.blocked === b) || (x.blocker === b && x.blocked === a));
  const visible = (a,b) => !blocked(a,b) && (a === b || social.friendships.some(f => f.status === 'accepted' && ((f.requester === a && f.addressee === b) || (f.requester === b && f.addressee === a))));
  const eventVisible = (a,b) => visible(a,b) && (a === b || prefs(b).sharing);
  const valid = e => {
    if (!e || typeof e !== 'object' || !/^[0-9a-f-]{36}$/i.test(e.key || '') || !Number.isInteger(e.generation) || e.generation < 0 || e.generation > 2147483647 || !e.data || typeof e.data !== 'object' || Array.isArray(e.data)) return false;
    const d = e.data, keys = Object.keys(d).sort().join(',');
    if (e.kind === 'adopted') return keys === 'resident' && /^[A-Za-z0-9_-]{1,100}$/.test(d.resident || '');
    if (e.kind === 'bond') return keys === 'level,resident' && /^[A-Za-z0-9_-]{1,100}$/.test(d.resident || '') && [5,10,15,20,25].includes(d.level);
    if (['coffin','verdict','collection'].includes(e.kind)) return keys === 'item' && /^[a-z0-9_-]{1,40}$/.test(d.item || '');
    if (e.kind === 'almanac') return keys === 'tier' && Number.isInteger(d.tier) && d.tier > 0 && d.tier <= 30;
    if (e.kind === 'arcade_best') return keys === 'game,score' && Number.isInteger(d.score) && d.score > 0 && d.score <= ({frenzy:3000,stack:500,seance:150,whack:2500}[d.game] || 0);
    return false;
  };
  const tidy = () => { for (let i=events.length-1; i>=0; i--) if (events[i].time < now()-30*86400000) events.splice(i,1); };
  const rate = id => { for (let i=requests.length-1;i>=0;i--) if(requests[i].at < now()-3600000) requests.splice(i,1); if(requests.filter(r=>r.id===id).length>=300)return false; requests.push({id,at:now()}); return true; };
  const row = (e,id) => {
    const all = [...reactions.entries()].filter(([key]) => key.startsWith(e.id + ':') && visible(id,key.slice(e.id.length + 1))).map(([,sticker])=>sticker), counts = {};
    for (const sticker of all) counts[sticker] = (counts[sticker] || 0) + 1;
    return { id:e.id, actor:e.actor, name:profiles.get(e.actor)?.display_name || '', kind:e.kind, data:e.data, created_at:new Date(e.time).toISOString(), counts, my_reaction:reactions.get(e.id+':'+id) || null };
  };
  const RPC = {
    gazette_post(user,{p_events}={}) {
      if (!rate(user.id)) return fail('rate_limited');
      if (!Array.isArray(p_events) || p_events.length>10 || !p_events.every(valid)) return fail('bad_events');
      tidy(); const setting=prefs(user.id);
      if (!setting.sharing || p_events.some(e => e.generation !== setting.generation)) return json(200,{posted:0,sharing:setting.sharing,generation:setting.generation,stale:true});
      const fresh=p_events.filter(e=>!events.some(x=>x.actor===user.id && x.key===e.key));
      if(events.filter(e=>e.actor===user.id && e.time>now()-3600000).length+fresh.length>100) return fail('rate_limited');
      let posted=0;
      for (const e of fresh) if (!events.some(x=>x.actor===user.id && x.key===e.key)) { events.push({ ...e, actor:user.id,id:uuid(),time:now() }); posted++; }
      return json(200,{posted,sharing:true,generation:setting.generation,stale:false});
    },
    gazette_feed(user,{p_before=null,p_limit=20}={}) {
      if (!Number.isInteger(p_limit) || p_limit<1 || p_limit>50) return fail('bad_limit'); tidy();
      const list = events.filter(e=>eventVisible(user.id,e.actor)).sort((a,b)=>b.time-a.time || b.id.localeCompare(a.id));
      const index = p_before ? list.findIndex(e=>e.id===p_before) : -1;
      if (p_before && index<0) return fail('not_found');
      return json(200,{events:list.slice(index+1,index+1+p_limit).map(e=>row(e,user.id)),sharing:prefs(user.id).sharing,generation:prefs(user.id).generation});
    },
    gazette_react(user,{p_event,p_sticker=null}={}) {
      if (!rate(user.id)) return fail('rate_limited');
      if (p_sticker !== null && !['candle','skull','lily','popcorn','rude','moth'].includes(p_sticker)) return fail('bad_sticker');
      const e=events.find(e=>e.id===p_event && e.time>=now()-30*86400000);
      if(!e || !eventVisible(user.id,e.actor)) return fail('not_found');
      const key=e.id+':'+user.id; if(p_sticker===null) reactions.delete(key); else reactions.set(key,p_sticker);
      return json(200,{ok:true});
    },
    gazette_unread(user) { return json(200,events.filter(e=>e.actor!==user.id && e.time>=now()-30*86400000 && e.time>prefs(user.id).seen && eventVisible(user.id,e.actor)).length); },
    gazette_seen(user) { if(!rate(user.id))return fail('rate_limited'); preferences.set(user.id,{...prefs(user.id),seen:now()}); return json(200,{ok:true}); },
    gazette_status(user) { const p=prefs(user.id); return json(200,{sharing:p.sharing,generation:p.generation}); },
    gazette_set_sharing(user,{p_on}={}) { if(!rate(user.id))return fail('rate_limited'); if(typeof p_on!=='boolean')return fail('bad_sharing'); const p=prefs(user.id); const generation=p.generation+(p.sharing===p_on ? 0 : 1); preferences.set(user.id,{...p,sharing:p_on,generation}); return json(200,{sharing:p_on,generation}); }
  };
  function forget(id) { preferences.delete(id); for (let i=events.length-1;i>=0;i--) if(events[i].actor===id)events.splice(i,1); for(const key of reactions.keys()) if(key.endsWith(':'+id))reactions.delete(key); }
  return { RPC, events, forget };
}
