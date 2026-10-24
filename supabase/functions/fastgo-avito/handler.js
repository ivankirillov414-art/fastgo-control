import {avitoProvider,incomingEvent,messagePreview} from './provider.js';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const out=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const id=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/i.test(v);
const sha=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');
export function createAvitoHandler({base,key,fetcher=fetch,provider=avitoProvider({fetcher})}){
 return async req=>{if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});if(req.method!=='POST')return out({error:'Только POST'},405);
 try{
  const authorization=req.headers.get('authorization');if(!authorization?.startsWith('Bearer '))fail('Войдите в FastGo',401);
  const userResponse=await fetcher(base+'/auth/v1/user',{headers:{apikey:key,Authorization:authorization},signal:AbortSignal.timeout(10000)});if(!userResponse.ok)fail('Войдите в FastGo',401);const user=await userResponse.json();
  const db=async(table,q='',method='GET',body,prefer)=>{const r=await fetcher(base+'/rest/v1/'+table+(q?'?'+q:''),{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});if(!r.ok)fail('Не удалось сохранить состояние Авито. Повторите запрос.',503);if(r.status===204)return null;const text=await r.text();return text?JSON.parse(text):null;};
  const member=(await db('workshop_members','profile_id=eq.'+user.id+'&active=eq.true&select=role,can_sell,name'))[0];if(!member||!['owner','developer','seller'].includes(member.role)&&member.can_sell!==true)fail('Сообщения доступны владельцу и кассиру',403);
  const raw=await req.text();if(raw.length>12000)fail('Слишком большой запрос',413);const p=JSON.parse(raw),action=p.action,owner=['owner','developer'].includes(member.role);
  let connection=(await db('workshop_avito_connection','id=eq.1&select=*'))[0];if(!connection)fail('Подключение Авито ещё не настроено',503);
  if(action==='connect'){
   if(!owner)fail('Подключение доступно владельцу',403);
   if(typeof p.client_id!=='string'||!p.client_id.trim()||p.client_id.length>500||typeof p.client_secret!=='string'||!p.client_secret.trim()||p.client_secret.length>4000)fail('Заполните данные API Авито');
   const credentials={client_id:p.client_id.trim(),client_secret:p.client_secret.trim()},me=await provider.self(credentials);await provider.chats(me.id,credentials);
   return out({data:await db('rpc/workshop_avito_connect','','POST',{p_secret:credentials,p_account_id:me.id,p_label:me.name,p_actor:user.id})});
  }
  if(action==='disconnect'){if(!owner)fail('Подключение доступно владельцу',403);await db('workshop_avito_connection','id=eq.1','PATCH',{enabled:false});return out({data:{connected:false}});}
  if(action==='popup_station'){
   if(!owner)fail('Настройка доступна владельцу',403);if(!id(p.station_id)||(await db('workshop_terminal_stations','station_id=eq.'+p.station_id+'&select=station_id')).length!==1)fail('Выберите разрешённый кассовый ноутбук');
   await db('workshop_avito_connection','id=eq.1','PATCH',{popup_station_id:p.station_id});return out({data:{saved:true}});
  }
  if(action==='messages'){
   if(!connection.enabled)fail('Сначала подключите Авито',409);if(typeof p.chat_id!=='string'||!/^[\w:-]{1,200}$/.test(p.chat_id))fail('Неверный чат');
   // Only chats observed in this connected account can be opened through the app.
   if(!(await db('workshop_avito_events','account_id=eq.'+connection.account_id+'&chat_id=eq.'+encodeURIComponent(p.chat_id)+'&limit=1&select=chat_id')).length)fail('Чат не найден',404);
   const credentials=await db('rpc/workshop_avito_credentials','','POST',{});if(!credentials||credentials.account_id!==connection.account_id)fail('Повторно подключите аккаунт Авито',409);const list=await provider.messages(connection.account_id,p.chat_id,credentials);
   return out({data:list.map(m=>({id:String(m.id),text:messagePreview(m),direction:m.direction==='out'||String(m.author_id)===connection.account_id?'out':'in',created:Number(m.created)}))});
  }
  if(action==='read'){
   if(!connection.account_id)return out({data:{ok:true}});if(!Array.isArray(p.message_ids)||p.message_ids.length>100||p.message_ids.some(x=>typeof x!=='string'||!/^[\w:-]{1,200}$/.test(x)))fail('Неверные уведомления');
   const known=await db('workshop_avito_events','account_id=eq.'+connection.account_id+'&message_id=in.('+p.message_ids.map(encodeURIComponent).join(',')+')&select=message_id');
   if(known.length)await db('workshop_avito_reads','','POST',known.map(e=>({profile_id:user.id,account_id:connection.account_id,message_id:e.message_id})), 'resolution=ignore-duplicates');return out({data:{ok:true}});
  }
  if(action!=='list')fail('Неизвестная операция');
  if(connection.enabled){
   const now=new Date(),claim=await db('workshop_avito_connection','id=eq.1&enabled=eq.true&next_poll_at=lte.'+encodeURIComponent(now.toISOString()),'PATCH',{next_poll_at:new Date(now.getTime()+120000).toISOString()},'return=representation');
   if(claim?.length){const synchronize=async()=>{try{
    const credentials=await db('rpc/workshop_avito_credentials','','POST',{});if(!credentials||credentials.account_id!==connection.account_id)fail('Повторно подключите аккаунт Авито',409);
    const chats=await provider.chats(connection.account_id,credentials),cursors={...connection.chat_cursors},events=[];let checked=0;
    for(const chat of chats){const last=chat.last_message;if(!last||cursors[chat.id]===String(last.id))continue;if(checked++>=10)break;const messages=await provider.messages(connection.account_id,String(chat.id),credentials);for(const message of messages){const event=incomingEvent(chat,message,connection.account_id);if(event)events.push(event);}cursors[chat.id]=String(last.id);}
    if(events.length)await db('workshop_avito_events','','POST',events,'resolution=ignore-duplicates');
    await db('workshop_avito_connection','id=eq.1&account_id=eq.'+connection.account_id,'PATCH',{last_synced_at:now.toISOString(),last_error:'',chat_cursors:cursors,next_poll_at:new Date(Date.now()+20000).toISOString()});connection.last_synced_at=now.toISOString();connection.last_error='';
   }catch(e){connection.last_error=e.status?e.message:'Не удалось связаться с Авито. Повторим автоматически.';await db('workshop_avito_connection','id=eq.1&account_id=eq.'+connection.account_id,'PATCH',{last_error:connection.last_error,next_poll_at:new Date(Date.now()+60000).toISOString()});}};if(globalThis.EdgeRuntime?.waitUntil)globalThis.EdgeRuntime.waitUntil(synchronize());else await synchronize();}
  }
  const events=connection.account_id?await db('workshop_avito_events','account_id=eq.'+connection.account_id+'&select=message_id,chat_id,title,sender,body,created_at&order=created_at.desc&limit=100'):[],reads=connection.account_id?await db('workshop_avito_reads','profile_id=eq.'+user.id+'&account_id=eq.'+connection.account_id+'&select=message_id'):[],read=new Set(reads.map(x=>x.message_id));
  let popups=false;if(id(p.device_id)&&typeof p.device_token==='string'&&p.device_id===connection.popup_station_id){const allowed=await db('workshop_terminal_stations','station_id=eq.'+p.device_id+'&select=station_id'),bound=await db('workshop_warehouse_devices','id=eq.'+p.device_id+'&active=eq.true&kind=eq.station&token_hash=eq.'+await sha(p.device_token)+'&select=id');popups=allowed.length===1&&bound.length===1;}
  const stations=owner?await db('workshop_terminal_stations','select=station_id,slot&order=slot'):[];
  return out({data:{connected:connection.enabled,label:connection.label,owner,stations,popup_station_id:connection.popup_station_id,popups_allowed:popups,last_synced_at:connection.last_synced_at,error:connection.last_error,notifications:events.map(e=>({...e,read:read.has(e.message_id)}))}});
 }catch(e){return out({error:e.status?e.message:'Не удалось подключиться к Авито. Повторите позже.'},e.status||503);}
 };
}
