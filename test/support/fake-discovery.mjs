// In-memory stand-in for the opt-in directory RPCs.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createFakeDiscovery({ profiles, social, now, json, rest, users = null }) {
  const listings = new Map(), areas = new Map(), areaChanges = new Map(), attempts = [], directoryRequests = new Set();
  const fail = token => rest(400, 'P0001', token);
  const blocked = (a,b) => social.blocks.some(x => (x.blocker===a && x.blocked===b) || (x.blocker===b && x.blocked===a));
  const related = (a,b) => social.friendships.some(x => (x.requester===a && x.addressee===b) || (x.requester===b && x.addressee===a));
  // Find players needs an email account (0015_hardening.sql). A refusal counts no attempt.
  const guest = id => !!users && users.get(id)?.is_anonymous !== false;
  const rate = (id,kind,maximum) => {
    if (attempts.filter(x=>x.id===id && x.kind===kind && x.at>now()-3600000).length>=maximum) return false;
    attempts.push({id,kind,at:now()}); return true;
  };
  const marker = (a,b) => a + ':' + b;
  return { RPC: {
    discovery_status(user) { return json(200,{listed:listings.get(user.id)===true,nearby:areas.has(user.id)}); },
    discovery_set(user,{p_on}={}) {
      if (typeof p_on !== 'boolean') return fail('bad_discovery');
      if (p_on && guest(user.id)) return fail('account_required');
      if (p_on && !rate(user.id,'setting',30)) return fail('rate_limited');
      if (p_on && !profiles.get(user.id)?.display_name?.trim()) return fail('name_required');
      listings.set(user.id,p_on); if(!p_on) areas.delete(user.id); return json(200,{listed:p_on});
    },
    discovery_location_set(user,{p_lat_band,p_lon_band}={}) {
      if (p_lat_band===null && p_lon_band===null) { areas.delete(user.id); return json(200,{nearby:false}); }
      if (guest(user.id)) return fail('account_required');
      if (!rate(user.id,'setting',30)) return fail('rate_limited');
      if (!Number.isInteger(p_lat_band) || p_lat_band<0 || p_lat_band>179 || !Number.isInteger(p_lon_band)) return fail('bad_discovery');
      const n=Math.max(1,Math.floor(360*Math.cos((p_lat_band-89.5)*Math.PI/180)));
      if (p_lon_band<0 || p_lon_band>=n) return fail('bad_discovery');
      if (!listings.get(user.id)) return fail('listing_required');
      const old=areas.get(user.id);
      if (old?.lat===p_lat_band && old?.lon===p_lon_band) return json(200,{nearby:true});
      if (areaChanges.has(user.id) && areaChanges.get(user.id)>now()-86400000) return fail('location_cooldown');
      areas.set(user.id,{lat:p_lat_band,lon:p_lon_band,n}); areaChanges.set(user.id,now()); return json(200,{nearby:true});
    },
    discovery_nearby(user,{p_offset=0}={}) {
      if (!Number.isInteger(p_offset) || p_offset<0 || p_offset>1000) return fail('bad_discovery');
      if (guest(user.id)) return fail('account_required');
      if (!rate(user.id,'search',120)) return fail('rate_limited');
      const own=areas.get(user.id); if (!own || !listings.get(user.id)) return fail('location_required');
      const radians=x=>x*Math.PI/180;
      const center=x=>({lat:radians(x.lat-89.5),lon:radians(-180+(x.lon+0.5)*360/x.n)});
      const me=center(own), players=[];
      for (const [id,cell] of areas) {
        if (id===user.id || !listings.get(id) || blocked(id,user.id) || related(id,user.id) || !profiles.get(id)?.display_name?.trim()) continue;
        const other=center(cell), k=6371*Math.acos(Math.min(1,Math.max(-1,Math.sin(me.lat)*Math.sin(other.lat)+Math.cos(me.lat)*Math.cos(other.lat)*Math.cos(me.lon-other.lon))));
        if (k<250) players.push({user_id:id,display_name:profiles.get(id).display_name,distance_band:k<120?'local':'regional',k});
      }
      players.sort((a,b)=>a.distance_band.localeCompare(b.distance_band) || a.display_name.toLowerCase().localeCompare(b.display_name.toLowerCase()) || a.user_id.localeCompare(b.user_id));
      return json(200,{players:players.slice(p_offset,p_offset+21).map(({k,...p})=>p),offset:p_offset});
    },
    discovery_find(user,{p_query='',p_offset=0}={}) {
      if (typeof p_query !== 'string' || p_query.length>24 || /[\u0000-\u001f\u007f]/.test(p_query) || !Number.isInteger(p_offset) || p_offset<0 || p_offset>1000) return fail('bad_discovery');
      if (guest(user.id)) return fail('account_required');
      if (!rate(user.id,'search',120)) return fail('rate_limited');
      const query=p_query.trim().toLowerCase();
      const players=[...listings].filter(([id,on])=>on && id!==user.id && !blocked(id,user.id) && !related(id,user.id) && profiles.get(id)?.display_name?.trim() && profiles.get(id).display_name.toLowerCase().includes(query))
        .map(([id])=>({user_id:id,display_name:profiles.get(id).display_name})).sort((a,b)=>a.display_name.toLowerCase().localeCompare(b.display_name.toLowerCase()) || a.user_id.localeCompare(b.user_id)).slice(p_offset,p_offset+21);
      return json(200,{players,offset:p_offset});
    },
    discovery_request(user,{p_user}={}) {
      if (!UUID.test(p_user || '') || p_user===user.id) return fail('bad_discovery');
      if (guest(user.id)) return fail('account_required');
      if (!rate(user.id,'request',40)) return fail('rate_limited');
      if (!listings.get(p_user) || blocked(user.id,p_user) || !profiles.get(p_user)?.display_name?.trim()) return json(200,{ok:false,error:'not_found'});
      const result=social.RPC.add_friend(user,{p_code:profiles.get(p_user).friend_code});
      const answer=JSON.parse(result.body);
      if (answer.ok && answer.status==='pending') directoryRequests.add(marker(user.id,p_user));
      return json(200,{ok:!!answer.ok,status:answer.status || null,error:answer.error || null});
    }
  }, listFriends(user,args) {
    const result=social.RPC.list_friends(user,args), rows=JSON.parse(result.body);
    // Mirror the database foreign key cleanup after a friendship is deleted.
    for (const key of directoryRequests) {
      const [a,b]=key.split(':');
      if (!social.friendships.some(f=>f.requester===a && f.addressee===b)) directoryRequests.delete(key);
    }
    for (const row of rows) {
      const isDirectory=directoryRequests.has(marker(user.id,row.user_id)) || directoryRequests.has(marker(row.user_id,user.id));
      if (isDirectory) {
        row.directory_request=true;
        if (row.status==='pending') { row.friend_code=''; row.display_name=profiles.get(row.user_id)?.display_name || ''; }
      }
    }
    return json(200,rows);
  }, forget(id) { listings.delete(id); areas.delete(id); areaChanges.delete(id); for(const key of directoryRequests) if(key.split(':').includes(id)) directoryRequests.delete(key); } };
}
