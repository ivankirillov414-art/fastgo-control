// Authenticated replica transport only. Cannot edit primary business records.
const BASE=Deno.env.get('SUPABASE_URL')||'',KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function db(path,body){const r=await fetch(BASE+'/rest/v1/'+path,{method:body===undefined?'GET':'POST',headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('DB');return r.json();}
Deno.serve(async req=>{
 if(req.method!=='POST')return reply({error:'POST required'},405);
 try{
  const token=req.headers.get('x-fastgo-sync-key')||'';if(!token)return reply({error:'Нет доступа'},401);
  const c=(await db('workshop_backend_config?id=eq.1&select=sheets_api_secret'))?.[0];if(!c?.sheets_api_secret)return reply({error:'Синхронизация не настроена'},503);
  const hash=async x=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x)));const [a,b]=await Promise.all([hash(token),hash(c.sheets_api_secret)]);let different=0;for(let i=0;i<a.length;i++)different|=a[i]^b[i];if(different)return reply({error:'Нет доступа'},401);
  if(Number(req.headers.get('content-length')||0)>4000000)return reply({error:'Большой пакет'},413);
  const reader=req.body?.getReader();let n=0;const chunks=[];while(reader){const v=await reader.read();if(v.done)break;n+=v.value.length;if(n>4000000){await reader.cancel();return reply({error:'Большой пакет'},413);}chunks.push(v.value);}
  const bytes=new Uint8Array(n);let at=0;for(const v of chunks){bytes.set(v,at);at+=v.length;}const input=JSON.parse(new TextDecoder().decode(bytes)),p=input.params||{};
  if(input.action==='claim')return reply({data:await db('rpc/workshop_native_claim',{})});
  if(input.action==='ack'){if(!Number.isSafeInteger(p.id)||!/^[a-f0-9-]{36}$/i.test(p.lease||''))return reply({error:'Неверное подтверждение'},400);return reply({data:await db('rpc/workshop_native_ack',{p_id:p.id,p_lease:p.lease,p_error:p.error?'Повтор после неподтверждённого ответа Google':null})});}
  if(input.action==='verify')return reply({data:await db('rpc/workshop_native_verify',{p_snapshot:p.snapshot})});
  return reply({error:'Операция не поддерживается'},400);
 }catch{return reply({error:'Синхронизация временно недоступна. Очередь сохранена.'},503);}
});
