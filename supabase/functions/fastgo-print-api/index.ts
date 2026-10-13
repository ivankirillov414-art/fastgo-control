const BASE=Deno.env.get('SUPABASE_URL')||'';
const KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const out=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||''));
async function adminRest(path,body){
 const r=await fetch(BASE+'/rest/v1/'+path,{method:body===undefined?'GET':'POST',headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 const j=await r.json();if(!r.ok)fail('Очередь печати временно недоступна',r.status===403?403:503);return j;
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return out({error:'Разрешён POST'},405);
 try{
  const auth=req.headers.get('authorization')||'';if(!/^Bearer [^\s]+$/i.test(auth))fail('Войдите в FastGo',401);
  const ur=await fetch(BASE+'/auth/v1/user',{headers:{apikey:KEY,Authorization:auth},signal:AbortSignal.timeout(15000)});
  if(!ur.ok)fail('Сессия истекла',401);const user=await ur.json();if(!uuid(user.id))fail('Неверная сессия',401);
  const members=await adminRest('workshop_members?profile_id=eq.'+encodeURIComponent(user.id)+'&active=eq.true&select=role');
  const role=members?.[0]?.role;if(!['developer','owner','admin','receiver','manager','mechanic'].includes(role))fail('Нет доступа к печати мастерской',403);
  if(Number(req.headers.get('content-length')||0)>4096)fail('Слишком большой запрос',413);
  const raw=await req.text();if(raw.length>4096)fail('Слишком большой запрос',413);
  let input;try{input=JSON.parse(raw);}catch{fail('Некорректный запрос');}
  const action=input.action,p=input.params||{};
  if(!['status','activate','deactivate','enqueue','claim','dispatch','complete','fail','retry'].includes(action))fail('Неизвестное действие');
  if(['activate','deactivate','retry'].includes(action)&&!['developer','owner','admin'].includes(role))fail('Назначить ноутбук может владелец или администратор',403);
  for(const key of ['station_id','id','request_id','job_id'])if(p[key]!==undefined&&!uuid(p[key]))fail('Неверный идентификатор');
  if(['claim','dispatch','complete','fail','activate'].includes(action)&&!uuid(p.station_id))fail('Укажите ноутбук');
  if(['claim','dispatch','complete','fail'].includes(action)&&!uuid(p.request_id))fail('Неверный код получателя');
  if(['dispatch','complete','fail','retry'].includes(action)&&!uuid(p.job_id))fail('Укажите задание');
  if(action==='enqueue'){
   const current=await adminRest('rpc/workshop_print_queue',{p_action:'status',p_actor:user.id});if(!current.enabled)return out({data:{enabled:false}});
   if(!uuid(p.id)||!uuid(p.request_id)||!['repair','storage'].includes(p.kind))fail('Укажите карточку');
   // Verify record access through the existing authoritative workshop API.
   const r=await fetch(BASE+'/functions/v1/fastgo-workshop-api',{method:'POST',headers:{apikey:KEY,Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({action:'get',params:{kind:p.kind,id:p.id}}),signal:AbortSignal.timeout(90000)});
   const result=await r.json();if(!r.ok||!result.data?.record)fail(result.error||'Карточка недоступна',r.status===403?403:400);
  }
  const data=await adminRest('rpc/workshop_print_queue',{p_action:action,p_actor:user.id,p_station:p.station_id||null,p_kind:p.kind||null,p_record:p.id||null,p_request:p.request_id||null,p_job:p.job_id||null,p_error:String(p.error||'').slice(0,500)});
  return out({data});
 }catch(e){return out({error:e.status?e.message:'Очередь печати временно недоступна'},e.status||503);}
});
