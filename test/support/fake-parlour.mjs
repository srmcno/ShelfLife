const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createFakeParlour({ social, postbox, profiles, now, json, rest }) {
  const rounds = new Map(), attempts = [];
  const fail = code => rest(400,'P0001',code);
  const valid = (a,b) => social.friendships.some(f=>f.status==='accepted' && ((f.requester===a && f.addressee===b)||(f.requester===b && f.addressee===a))) && !social.blocks.some(x=>(x.blocker===a&&x.blocked===b)||(x.blocker===b&&x.blocked===a));
  const integer = (v,max) => Number.isInteger(v)&&v>=0&&v<=max;
  const rate = user => { if(attempts.filter(x=>x.id===user&&x.at>now()-3600000).length>=100) return false; attempts.push({id:user,at:now()}); return true; };
  const dnd = id => postbox.prefs.get(id)?.dnd === true;
  const iso = t => new Date(t).toISOString();
  return { RPC: {
    parlour_send(user,{p_id,p_to,p_prompt,p_choice}={}) {
      if(!UUID.test(p_id||'')||!UUID.test(p_to||'')||!integer(p_prompt,63)||!integer(p_choice,2)) return fail('bad_parlour');
      if(!valid(user.id,p_to)) return fail('not_friends');
      const old=rounds.get(p_id);
      if(old) return old.from_user===user.id&&old.to_user===p_to&&old.prompt===p_prompt&&old.first===p_choice ? json(200,{id:p_id,sent:true}) : fail('bad_parlour');
      if(!rate(user.id)) return fail('rate_limited'); if(dnd(p_to)) return fail('dnd');
      const recent=[...rounds.values()].filter(r=>r.from_user===user.id&&r.created>now()-86400000);
      if(recent.length>=12) return fail('rate_limited'); if(recent.some(r=>r.to_user===p_to)) return fail('parlour_wait');
      rounds.set(p_id,{id:p_id,from_user:user.id,to_user:p_to,prompt:p_prompt,first:p_choice,second:null,created:now(),answered:null,declined:null,seen:false,recipient_seen:false});
      return json(200,{id:p_id,sent:true});
    },
    parlour_reply(user,{p_id,p_choice}={}) {
      if(!UUID.test(p_id||'')||!integer(p_choice,2)) return fail('bad_parlour'); if(!rate(user.id)) return fail('rate_limited');
      const r=rounds.get(p_id); if(!r||r.to_user!==user.id||r.created<now()-14*86400000) return fail('not_found');
      if(!valid(user.id,r.from_user)) return fail('not_friends'); if(dnd(r.from_user)) return fail('dnd');
      if(r.declined!==null || (r.second!==null&&r.second!==p_choice)) return fail('already_answered');
      r.second=p_choice; r.answered??=now(); return json(200,{id:r.id,prompt:r.prompt,first:r.first,second:r.second});
    },
    parlour_decline(user,{p_id}={}) {
      if(!UUID.test(p_id||'')) return fail('bad_parlour'); if(!rate(user.id)) return fail('rate_limited'); const r=rounds.get(p_id);
      if(!r||r.to_user!==user.id||r.created<now()-14*86400000) return fail('not_found'); if(!valid(r.from_user,r.to_user)) return fail('not_friends');
      if(r.second!==null) return fail('already_answered'); r.declined??=now(); return json(200,true);
    },
    parlour_inbox(user) {
      return json(200,[...rounds.values()].filter(r=>valid(r.from_user,r.to_user)&&((r.to_user===user.id&&r.second===null&&r.declined===null&&r.created>now()-14*86400000)||(r.from_user===user.id&&(r.second!==null||r.declined!==null)&&!r.seen)||(r.to_user===user.id&&r.second!==null&&!r.recipient_seen)))
        .sort((a,b)=>b.created-a.created).slice(0,50).map(r=>({id:r.id,from_user:r.from_user,to_user:r.to_user,prompt:r.prompt,first:r.second===null?null:r.first,second:r.second,created_at:iso(r.created),answered_at:r.answered===null?null:iso(r.answered),declined:r.declined!==null,name:profiles.get(r.from_user===user.id?r.to_user:r.from_user)?.display_name||''})));
    },
    parlour_seen(user,{p_id}={}) {
      if(!rate(user.id)) return fail('rate_limited'); const r=rounds.get(p_id); if(!r||![r.from_user,r.to_user].includes(user.id)||(r.second===null&&!(r.from_user===user.id&&r.declined!==null))) return fail('not_found');
      if(!valid(r.from_user,r.to_user)) return fail('not_friends'); if(r.from_user===user.id) r.seen=true; else r.recipient_seen=true; return json(200,true);
    }
  }, wrap(rpc) { const output={}; for(const name of ['block_user','remove_friend']) output[name]=(user,args)=>{ const result=rpc[name](user,args); if(result.status===200) for(const [k,r] of rounds) if((r.from_user===user.id&&r.to_user===args.p_user)||(r.to_user===user.id&&r.from_user===args.p_user)) rounds.delete(k); return result; }; return output; }, forget(id) { for(const [k,r] of rounds) if(r.from_user===id||r.to_user===id) rounds.delete(k); } };
}
