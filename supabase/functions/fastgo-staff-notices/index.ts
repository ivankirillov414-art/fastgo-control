// Device credentials can only read/acknowledge the assignee's pending notices.
// They never authorize catalogue prices, repairs, inventory or payment APIs.
const BASE=Deno.env.get('SUPABASE_URL')||'',KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const out=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const uuid=v=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(v||''));
async function db(table,q='',method='GET',body){const r=await fetch(BASE+'/rest/v1/'+table+(q?'?'+q:''),{method,headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('database');return r.status===204?null:await r.json();}
Deno.serve(async req=>{
 if(req.method!=='POST')return out({error:'POST required'},405);
 try{
  const token=req.headers.get('x-fastgo-notice-token')||'';
  if(!/^[-_A-Za-z0-9]{43}$/.test(token))return out({error:'Unauthorized'},401);
  if(Number(req.headers.get('content-length')||0)>4096)return out({error:'Too large'},413);
  const reader=req.body?.getReader();if(!reader)return out({error:'Invalid request'},400);
  let size=0;const chunks=[];try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>4096){await reader.cancel();return out({error:'Too large'},413);}chunks.push(r.value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  let p;try{p=JSON.parse(new TextDecoder().decode(bytes));}catch{return out({error:'Invalid request'},400);}
  if(!p||typeof p!=='object'||Array.isArray(p))return out({error:'Invalid request'},400);
  if(!uuid(p.device_id)||!/^[-_A-Za-z0-9]{43}$/.test(token))return out({error:'Unauthorized'},401);
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const device=(await db('workshop_task_devices','id=eq.'+p.device_id+'&revoked_at=is.null&select=profile_id,token_hash'))?.[0];
  let diff=0;for(let i=0;i<64;i++)diff|=(device?.token_hash||'')[i]?.charCodeAt(0)^hash.charCodeAt(i);
  if(!device||diff!==0||!(await db('workshop_members','profile_id=eq.'+device.profile_id+'&active=eq.true&select=profile_id'))?.length)return out({error:'Unauthorized'},401);
  if(p.revoke===true){await db('workshop_task_devices','id=eq.'+p.device_id+'&token_hash=eq.'+hash,'PATCH',{revoked_at:new Date().toISOString()});return out({data:{ok:true}});}
  if(p.ack){if(!uuid(p.ack))return out({error:'Invalid notice'},400);await db('workshop_staff_tasks','id=eq.'+p.ack+'&assignee_id=eq.'+device.profile_id+'&notice_device=eq.'+p.device_id+'&notice_posted_at=is.null','PATCH',{notice_posted_at:new Date().toISOString()});return out({data:{ok:true}});}
  const tasks=p.claim===true?await db('rpc/workshop_claim_task_notices','','POST',{p_actor:device.profile_id,p_device:p.device_id}):await db('workshop_staff_tasks','assignee_id=eq.'+device.profile_id+'&status=eq.open&notice_posted_at=is.null&notice_opened_at=is.null&or=(notice_device.is.null,notice_device.eq.'+p.device_id+')&select=id,title,description&order=created_at&limit=10');
  return out({data:{items:(tasks||[]).map(t=>({id:t.id,title:t.title,body:t.description,route:'#task?id='+t.id}))}});
 }catch{return out({error:'Notice service unavailable'},503);}
});
