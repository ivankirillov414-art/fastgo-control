const fail=(message,status=502)=>{throw Object.assign(Error(message),{status});};
const short=(v,max)=>String(v??'').slice(0,max);
export function messagePreview(message){const c=message?.content||{};return short(c.text||({image:'Фотография',voice:'Голосовое сообщение',video:'Видео',link:'Ссылка',location:'Местоположение',item:'Объявление',call:'Звонок'})[message?.type]||'Новое сообщение',5000);}
export function incomingEvent(chat,message,account){
 if(!message?.id||!chat?.id)return null;
 const incoming=message.direction==='in'||message.direction==='incoming'||!message.direction&&message.author_id!==undefined&&String(message.author_id)!==String(account);
 if(!incoming)return null;const stamp=Number(message.created),time=Number.isFinite(stamp)&&stamp>0?new Date(stamp<1e12?stamp*1000:stamp):null;if(!time||!Number.isFinite(time.getTime()))return null;
 const person=(chat.users||[]).find(x=>String(x.id)===String(message.author_id));
 return {account_id:String(account),message_id:short(message.id,200),chat_id:short(chat.id,200),created_at:time.toISOString(),title:short(chat.context?.value?.title||chat.title||'Сообщение Авито',300),sender:short(person?.name||'Клиент Авито',200),body:messagePreview(message)};
}
export function avitoProvider({fetcher=fetch}){
 const tokens=new Map();
 async function token(credentials,force=false){const key=credentials.client_id;let cached=tokens.get(key);if(!force&&cached?.until>Date.now())return cached.value;
  const r=await fetcher('https://api.avito.ru/token/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:credentials.client_id,client_secret:credentials.client_secret}),signal:AbortSignal.timeout(15000),redirect:'error'});
  if(!r.ok)fail(r.status===401||r.status===400?'Авито не принял данные подключения. Проверьте доступ API в кабинете владельца.':'Сервер авторизации Авито временно недоступен',r.status===401||r.status===400?400:502);
  const p=await r.json();if(typeof p.access_token!=='string'||!Number.isFinite(Number(p.expires_in)))fail('Авито вернул неполный ответ авторизации');cached={value:p.access_token,until:Date.now()+Math.max(0,Number(p.expires_in)-60)*1000};tokens.set(key,cached);return cached.value;
 }
 async function get(path,credentials){for(let n=0;n<2;n++){const r=await fetcher('https://api.avito.ru'+path,{headers:{Authorization:'Bearer '+await token(credentials,n>0),Accept:'application/json'},signal:AbortSignal.timeout(15000),redirect:'error'});if(r.status===401&&n===0)continue;if(!r.ok)fail(r.status===403?'Авито не разрешил доступ к сообщениям. Проверьте API мессенджера в вашем тарифе.':r.status===429?'Авито временно ограничил частоту запросов. Повторим автоматически.':'Не удалось получить сообщения Авито',r.status===429?429:502);return r.json();}fail('Сессия Авито не обновилась');}
 const safeId=id=>{if(typeof id!=='string'||!/^[\w:-]{1,200}$/.test(id))fail('Неверный чат',400);return encodeURIComponent(id);};
 return {async self(c){await token(c,true);const me=await get('/core/v1/accounts/self',c);if(!/^[0-9]{1,20}$/.test(String(me.id)))fail('Не удалось определить аккаунт Авито');return {id:String(me.id),name:short(me.name||'Авито',200)};},
  async chats(account,c){const data=await get('/messenger/v2/accounts/'+safeId(String(account))+'/chats?limit=100&offset=0&unread_only=false',c);if(!Array.isArray(data.chats))fail('Авито изменил формат списка чатов');return data.chats;},
  async messages(account,chat,c){const data=await get('/messenger/v3/accounts/'+safeId(String(account))+'/chats/'+safeId(chat)+'/messages/?limit=100&offset=0',c);const list=Array.isArray(data)?data:data.messages;if(!Array.isArray(list))fail('Авито изменил формат сообщений');return list;}
 };
}
