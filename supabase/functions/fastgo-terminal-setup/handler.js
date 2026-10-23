const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const out=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const uuid=v=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v||'');
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export function createHandler({base,key,fetcher=fetch}){return async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return out({error:'Только POST'},405);
 try{
  const auth=req.headers.get('authorization');if(!auth?.startsWith('Bearer '))fail('Войдите в FastGo',401);
  const userResponse=await fetcher(base+'/auth/v1/user',{headers:{apikey:key,Authorization:auth},signal:AbortSignal.timeout(10000)});
  if(!userResponse.ok)fail('Войдите в FastGo',401);const user=await userResponse.json();
  const service={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
  async function json(path,method='GET',body){const r=await fetcher(base+path,{method,headers:service,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});if(!r.ok)fail('Не удалось подготовить подключение',503);return r.status===204?null:r.json();}
  const members=await json('/rest/v1/workshop_members?profile_id=eq.'+user.id+'&active=eq.true&select=role');
  if(!members.some(x=>['owner','developer'].includes(x.role)))fail('Настроить терминал может владелец',403);
  const raw=await req.text();if(raw.length>5000)fail('Слишком большой запрос');let p;try{p=JSON.parse(raw);}catch{fail('Некорректный запрос');}
  if(![p.source_station_id,p.terminal_id].every(uuid)||(p.station_id!==undefined&&!uuid(p.station_id))||!(/^[a-f0-9-]{72}$/.test(p.token||''))||typeof p.source_station_token!=='string')fail('Неверные данные подключения');
  const allowed=await json('/rest/v1/workshop_terminal_stations?select=station_id,slot');
  // Existing terminals keep their pairing. Initial USB setup uses the configured cash station.
  if(p.station_id===undefined)p.station_id=allowed.find(x=>x.slot===1)?.station_id;
  if(!allowed.some(x=>x.station_id===p.station_id)||!allowed.some(x=>x.station_id===p.source_station_id))fail('Ноутбук не разрешён',403);
  async function digest(v){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
  const source=await json('/rest/v1/workshop_warehouse_devices?id=eq.'+p.source_station_id+'&kind=eq.station&active=eq.true&token_hash=eq.'+await digest(p.source_station_token)+'&select=id');
  if(!source.length)fail('Подключение ноутбука не подтверждено',403);
  const destination=await json('/rest/v1/workshop_warehouse_devices?id=eq.'+p.station_id+'&kind=eq.station&active=eq.true&select=id,name');
  if(!destination.length)fail('Складской ноутбук отключён',403);
  const hash=await digest(p.token),old=await json('/rest/v1/workshop_warehouse_devices?id=eq.'+p.terminal_id+'&select=id,kind,active,created_by,station_id,token_hash');
  if(old.length){const x=old[0];if(x.kind!=='terminal'||!x.active||x.created_by!==user.id||x.station_id!==p.station_id||x.token_hash!==hash)fail('Подключение уже используется',409);}
  else await json('/rest/v1/workshop_warehouse_devices','POST',{id:p.terminal_id,kind:'terminal',active:true,station_id:p.station_id,name:'iData / терминал',token_hash:hash,created_by:user.id});
  if(!user.email)fail('У учётной записи нет почты',403);
  // generate_link does not send email. Verify it here to issue an independent session,
  // so Android and Windows never share a rotating refresh token.
  const link=await json('/auth/v1/admin/generate_link','POST',{type:'magiclink',email:user.email});
  const token=link.hashed_token||link.properties?.hashed_token;if(!token)fail('Не удалось создать вход терминала',503);
  const session=await json('/auth/v1/verify','POST',{type:'magiclink',token_hash:token});
  if(session.user?.id!==user.id||!session.access_token||!session.refresh_token)fail('Не удалось подтвердить вход терминала',503);
  return out({data:{auth:{access_token:session.access_token,refresh_token:session.refresh_token,expires_at:session.expires_at||Math.floor(Date.now()/1000)+(session.expires_in||3600),user:{id:user.id}},device:{id:p.terminal_id,token:p.token,station_id:p.station_id,name:destination[0].name}}});
 }catch(e){return out({error:e.status?e.message:'Не удалось настроить терминал'},e.status||503);}
};}
