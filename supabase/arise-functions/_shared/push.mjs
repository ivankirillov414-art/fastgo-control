export function validPushEndpoint(value){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&(u.hostname==='fcm.googleapis.com'||u.hostname==='web.push.apple.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname.endsWith('.push.services.mozilla.com'));}catch{return false;}
}
export function createPushHandler({env=globalThis.Deno?.env,fetcher=fetch,requestDetails}={}){return async req=>{
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(req.method!=='POST')return json({error:'method_not_allowed'},405);
 const secret=req.headers.get('x-arise-scheduler')||'';
 if(!/^[a-f0-9]{64}$/.test(secret))return json({error:'unauthorized'},401);
 const origin=env.get('SUPABASE_URL'),key=env.get('SUPABASE_SERVICE_ROLE_KEY');
 async function rpc(name,body){const response=await fetcher(origin+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('database_error');return response.json();}
 try{
  if(!await rpc('arise_scheduler_authorized',{p_token:secret}))return json({error:'unauthorized'},401);
  const publicKey=env.get('VAPID_PUBLIC_KEY'),privateKey=env.get('VAPID_PRIVATE_KEY'),configured=Boolean(publicKey&&privateKey);
  const body=await req.json().catch(()=>({}));
  if(body.dry_run===true)return json({ok:true,configured});
  if(!configured)return json({error:'vapid_not_configured'},503);
  const items=await rpc('arise_claim_push',{});let sent=0,failed=0,expired=0;
  for(const item of items){let status='failed';
   try{
    if(!validPushEndpoint(item.endpoint)){status='expired';}
    else{
     const payload=JSON.stringify({title:'ARISE — ежедневные квесты',body:item.slot==='morning'?'Твои задания на сегодня готовы.':'До 23:00 осталось два часа. Заверши задания на сегодня.',url:'achievements.html#quests',tag:'arise-'+item.slot});
     const details=requestDetails({endpoint:item.endpoint,keys:{p256dh:item.p256dh,auth:item.auth}},payload,{vapidDetails:{subject:env.get('VAPID_SUBJECT')||'https://ivankirillov414-art.github.io/fastgo-control/achievements.html',publicKey,privateKey},TTL:3600,urgency:'normal',contentEncoding:'aes128gcm'});
     const response=await fetcher(details.endpoint,{method:'POST',headers:details.headers,body:details.body,redirect:'error',signal:AbortSignal.timeout(10000)});
     status=response.ok?'sent':[404,410].includes(response.status)?'expired':'failed';
    }
   }catch{status='failed';}
   await rpc('arise_finish_push',{p_id:item.delivery_id,p_status:status});
   if(status==='sent')sent++;else if(status==='expired')expired++;else failed++;
  }
  return json({ok:true,sent,failed,expired});
 }catch{return json({error:'scheduler_unavailable'},503);}
};}
