import {records,alerts,history,analytics,defaults} from './model.js';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type,apikey','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const out=(x,status=200)=>new Response(JSON.stringify(x),{status,headers});
export function createOperationsHandler({base,key,fetcher=fetch}){return async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return out({error:'Метод не поддерживается'},405);
 try{
  const auth=req.headers.get('authorization');if(!auth?.startsWith('Bearer '))return out({error:'Войдите в FastGo'},401);
  const userResponse=await fetcher(base+'/auth/v1/user',{headers:{apikey:key,Authorization:auth},signal:AbortSignal.timeout(10000)});if(!userResponse.ok)return out({error:'Войдите в FastGo'},401);const user=await userResponse.json();
  const service={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
  const db=async(path,method='GET',body)=>{const r=await fetcher(base+'/rest/v1/'+path,{method,headers:service,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Сервис временно недоступен');return r.status===204?null:r.json();};
  const member=(await db('workshop_members?profile_id=eq.'+encodeURIComponent(user.id)+'&active=eq.true&select=role'))[0];if(!member||member.role==='seller')return out({error:'Нет доступа'},403);
  const raw=await req.text();if(raw.length>12000)return out({error:'Слишком большой запрос'},400);const p=JSON.parse(raw),owner=['owner','developer'].includes(member.role);
  if(!['dashboard','history','analytics','settings','save_settings','diagnostics'].includes(p.action))return out({error:'Неизвестное действие'},400);
  if(['analytics','settings','save_settings','diagnostics'].includes(p.action)&&!owner)return out({error:'Доступно только владельцу'},403);
  const config={...defaults,...(await db('workshop_operations_settings?id=eq.1&select=config'))[0]?.config};
  if(p.action==='settings')return out({data:config});
  if(p.action==='save_settings'){
   const c=p.config||{};for(const k of ['stale_days','long_days','coverage_days'])if(!Number.isInteger(Number(c[k]))||Number(c[k])<1||Number(c[k])>365)return out({error:'Период должен быть от 1 до 365 дней'},400);
   const rates={};for(const [id,rate] of Object.entries(c.rates||{})){if(!/^[a-f0-9-]{36}$/i.test(id)||!Number.isFinite(Number(rate))||Number(rate)<0||Number(rate)>100)return out({error:'Проверьте проценты сотрудников'},400);rates[id]=Number(rate);}
   const saved={stale_days:Number(c.stale_days),long_days:Number(c.long_days),coverage_days:Number(c.coverage_days),rates};await db('workshop_operations_settings?id=eq.1','PATCH',{config:saved,updated_at:new Date().toISOString()});return out({data:saved});
  }
  if(p.action==='diagnostics'){const [versions,state,queue]=await Promise.all([db('workshop_app_versions?select=version,latest_version,update_state,last_seen&order=last_seen.desc&limit=20'),db('workshop_native_state?id=eq.1&select=version,mode,mirror_verified_at'),db('workshop_native_outbox?state=neq.synced&select=version&limit=1000')]);return out({data:{versions,state:state[0],mirror_pending:queue.length,checked_at:new Date().toISOString()}});}
  const snapshot=await db('rpc/workshop_native_snapshot','POST',{}),items=records(snapshot.sheets||{});
  if(p.action==='dashboard')return out({data:{alerts:alerts(items,config),thresholds:{stale_days:config.stale_days,long_days:config.long_days}}});
  if(p.action==='history'){let found;try{found=history(items,p);}catch(e){return out({error:e.message},400);}return out({data:{items:found.sort((a,b)=>String(b.created).localeCompare(String(a.created)))}});}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(p.from||'')||!/^\d{4}-\d{2}-\d{2}$/.test(p.to||'')||p.from>p.to)return out({error:'Проверьте период'},400);
  return out({data:analytics(snapshot.sheets,p,config)});
 }catch{return out({error:'Не удалось загрузить данные. Повторите попытку.'},503);}
};}
