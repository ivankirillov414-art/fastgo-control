// FastGo Google Sheets cutover. Supabase holds auth/configuration only.
// No fallback writes to the former business tables. Never log tokens or bodies.
const BASE = Deno.env.get('SUPABASE_URL') || '';
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const RELEASE = 'google-cutover-2026-09-12';
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,GET,OPTIONS','Access-Control-Expose-Headers':'X-FastGo-Backend,X-FastGo-Release','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-FastGo-Backend':'google-sheets','X-FastGo-Release':RELEASE};
const out=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||''));
const admin=m=>['owner','admin'].includes(m.role);
const manager=m=>['owner','admin','receiver','manager'].includes(m.role);
const numeric=(v,label,min=0,max=1e9)=>{if(v===null||v===''||typeof v==='boolean')fail('Проверьте '+label);const n=Number(v);if(!Number.isFinite(n)||n<min||n>max)fail('Проверьте '+label);return n;};
const integer=(v,label,min=1,max=100000)=>{const n=numeric(v,label,min,max);if(!Number.isInteger(n))fail('Укажите целое число: '+label);return n;};
const text=(v,max=500)=>String(v??'').trim().slice(0,max);
const bool=v=>v===true||v==='true'||v==='on';
function safeText(v){if(typeof v==='string')return /^\s*=/.test(v)?"'"+v:v;if(Array.isArray(v))return v.map(safeText);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,safeText(x)]));return v;}
async function rest(path,method='GET',body,extra={}){
  const r=await fetch(BASE+path,{method,headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json',...extra},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  const raw=await r.text();let data;try{data=raw?JSON.parse(raw):null;}catch{fail('Неполный ответ сервера авторизации',503);}
  if(!r.ok)fail(data?.message||'Ошибка сервера авторизации',r.status>=500?503:400);return data;
}
const db=(t,q='',method='GET',body,extra={})=>rest('/rest/v1/'+t+(q?'?'+q:''),method,body,extra);
async function readBody(req){
  const max=14500000;if(Number(req.headers.get('content-length')||0)>max)fail('Файл слишком большой',413);
  const reader=req.body?.getReader();if(!reader)fail('Пустой запрос');let n=0;const chunks=[];
  try{while(true){const r=await reader.read();if(r.done)break;n+=r.value.length;if(n>max){await reader.cancel();fail('Файл слишком большой',413);}chunks.push(r.value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(n);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  let input;try{input=JSON.parse(new TextDecoder().decode(bytes));}catch{fail('Некорректный JSON');}
  if(!input||Array.isArray(input)||typeof input!=='object')fail('Некорректный запрос');return input;
}
async function config(){
  const rows=await db('workshop_backend_config','id=eq.1&select=sheets_api_url,sheets_api_secret');const c=rows?.[0];
  if(!c?.sheets_api_secret||!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(c.sheets_api_url||''))fail('Google-база не подключена',503);return c;
}
function googleClient(c,actor){
  return async(action,params={})=>{
    let r;try{r=await fetch(c.sheets_api_url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({secret:c.sheets_api_secret,action,params:safeText(params),actor}),redirect:'follow',signal:AbortSignal.timeout(65000)});}catch{fail('Google не ответил. Обновите карточку перед повторением операции.',504);}
    const raw=await r.text();let j;try{j=JSON.parse(raw);}catch{fail('Google вернул не данные. Проверьте доступ Apps Script к таблице.',502);}
    if(!r.ok)fail('Google временно недоступен',502);
    if(j?.error){const code=Number(j.status);fail(String(j.error).replaceAll(c.sheets_api_secret,'[скрыто]'),code>=400&&code<600?code:400);}return j?.data;
  };
}
function recordDates(r){if(!r)return r;for(const k of ['starts_on','planned_return_date','promised_date'])if(typeof r[k]==='string')r[k]=r[k].slice(0,10);return r;}
function required(p,fields){for(const f of fields)if(!text(p[f]))fail('Заполните поле '+f);}
function lines(items){if(!Array.isArray(items)||items.length>200)fail('Неверный список работ / запчастей');return items.map(x=>{required(x,['name']);return {...x,name:text(x.name,200),quantity:integer(x.quantity,'количество',1,1000),price:numeric(x.price,'цену')};});}
const readActions=new Set(['catalog','part_by_barcode','stock_history','sales','list','get','overview','customers','finance','legacy','legal','part_photo_url','signed_url','get_url','health']);
const writeActions=new Set(['part_save','stock','sale','catalog_save','legal_save','create','update','contact','payment','extend','upload','documents']);
const managementActions=new Set(['create','customers','finance','sales','stock','sale','payment','extend','contact','legacy']);
const administrationActions=new Set(['part_save','catalog_save','legal_save']);
const terminal=new Set(['issued','returned','cancelled']);
async function legacyPhotos(kind,id){
  if(!uuid(id))return [];const t=kind==='storage'?'storage_intakes':'service_repairs';
  const a=await db(t,'id=eq.'+encodeURIComponent(id)+'&select=scooter_photo_path,display_photo_path,motor_photo_path,fault_photo_paths,signed_document_paths');const r=a?.[0];
  return r?[r.scooter_photo_path,r.display_photo_path,r.motor_photo_path,...(r.fault_photo_paths||[])].filter(Boolean).map(path=>({path,slot:'photos'})).concat((r.signed_document_paths||[]).map(path=>({path,slot:'signed'}))):[];
}
async function main(req){
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method==='GET')return out({ok:true,service:'fastgo-workshop-api',backend:'GOOGLE_SHEETS_DRIVE',release:RELEASE,authentication:'required'});
  if(req.method!=='POST')return out({error:'Разрешён только POST'},405);
  try{
    const authorization=req.headers.get('authorization')||'';if(!/^Bearer [^\s]+$/i.test(authorization))fail('Войдите в приложение',401);
    const u=await fetch(BASE+'/auth/v1/user',{headers:{apikey:KEY,Authorization:authorization},signal:AbortSignal.timeout(15000)});if(!u.ok)fail('Сессия истекла. Войдите снова',401);
    const user=await u.json();if(!uuid(user.id))fail('Неверная сессия',401);
    const a=await db('workshop_members','profile_id=eq.'+encodeURIComponent(user.id)+'&active=eq.true&select=*');const me=a?.[0];if(!me||!['owner','admin','receiver','manager','mechanic'].includes(me.role))fail('Доступ к мастерской не выдан',403);
    const input=await readBody(req),action=text(input.action,40);let p=input.params||{};if(Array.isArray(p)||typeof p!=='object')fail('Некорректные параметры');p={...p};
    p.kind=p.kind||(/storage-api/.test(new URL(req.url).pathname)?'storage':'repair');if(!['repair','storage'].includes(p.kind))fail('Неверный вид заказа');
    if(action==='me')return out({data:{...me,email:user.email,backend:'GOOGLE_SHEETS_DRIVE',release:RELEASE}});
    if(['member_update','staff_create'].includes(action)){
      if(!admin(me))fail('Нет права изменять сотрудников',403);
      if(action==='member_update'){
        if(!uuid(p.profile_id))fail('Не указан сотрудник');
        const data=await db('rpc/workshop_mutate','','POST',{p_actor:user.id,p_action:'member_update',p:{profile_id:p.profile_id,name:text(p.name,200),role:text(p.role,30),active:bool(p.active),tags:Array.isArray(p.tags)?p.tags.map(x=>text(x,100)).slice(0,20):[]}});return out({data});
      }
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email||'')||String(p.password||'').length<12||!text(p.name))fail('Укажите имя, почту и пароль от 12 символов');
      if(!['admin','receiver','manager','mechanic'].includes(p.role))fail('Недопустимая роль');
      const created=await rest('/auth/v1/admin/users','POST',{email:p.email,password:p.password,email_confirm:true});const id=created?.id||created?.user?.id;if(!uuid(id))fail('Не удалось создать сотрудника');
      try{await db('profiles','','POST',{id,full_name:p.name,role:'customer'},{Prefer:'resolution=ignore-duplicates'});await db('rpc/workshop_mutate','','POST',{p_actor:user.id,p_action:'member_update',p:{profile_id:id,name:p.name,role:p.role,active:true,tags:p.tags||[]}});}catch(e){await rest('/auth/v1/admin/users/'+id,'DELETE').catch(()=>{});throw e;}return out({data:{id}});
    }
    if(!readActions.has(action)&&!writeActions.has(action))fail(action==='part_photo_upload'?'Загрузка фото товара пока отключена: текущий скрипт делает их публичными. Фото приёмок работают.':'Неизвестная операция',400);
    if(managementActions.has(action)&&!manager(me))fail('Нет доступа',403);if(administrationActions.has(action)&&!admin(me))fail('Нет права изменять справочник',403);
    const c=await config(),actor={id:user.id,email:user.email||'',name:me.name||'',role:me.role},g=googleClient(c,actor);
    if(action==='health')return out({data:{...await g('health'),release:RELEASE}});
    if(action==='catalog'){
      const [d,staff]=await Promise.all([g('catalog'),db('workshop_members','select=profile_id,name,role,active,tags&order=name')]);d.staff=staff||[];d.backend='GOOGLE_SHEETS_DRIVE';return out({data:d});
    }
    if(action==='part_by_barcode'){required(p,['barcode']);const d=await g(action,{barcode:text(p.barcode,100)});if(d.active===false)fail('Товар отключён',404);return out({data:d});}
    if(action==='overview'&&!manager(me)){
      const d=await g('list',{kind:'repair',status:'active',limit:100});const today=new Date().toISOString().slice(0,10);return out({data:{repairs:d.count,ready:d.items.filter(x=>x.status==='ready').length,overdue:d.items.filter(x=>x.promised_date&&x.promised_date<today&&x.status!=='ready').length,low_stock:0}});
    }
    if(['get','update','contact','payment','extend','upload','documents','signed_url','get_url'].includes(action)&&!uuid(p.id)&&!p.qr_token)fail('Неверная ссылка на карточку');
    if(p.qr_token&&!p.id){if(!uuid(p.qr_token))fail('Неверный QR');const t=p.kind==='storage'?'storage_intakes':'service_repairs';const r=await db(t,'qr_token=eq.'+encodeURIComponent(p.qr_token)+'&select=id');if(!r?.[0])fail('QR не найден',404);p.id=r[0].id;}
    if(action==='get'){
      const d=await g('get',p);d.record=recordDates(d.record);if(!manager(me))d.payments=[];
      const old=await legacyPhotos(p.kind,p.id);d.record.fault_photo_paths=[...(d.record.fault_photo_paths||[]),...old.filter(x=>x.slot==='photos').map(x=>x.path)];d.record.signed_document_paths=[...(d.record.signed_document_paths||[]),...old.filter(x=>x.slot==='signed').map(x=>x.path)];d.backend='GOOGLE_SHEETS_DRIVE';return out({data:d});
    }
    if(action==='signed_url'||action==='get_url'){
      await g('get',{kind:p.kind,id:p.id});
      if(String(p.path||'').startsWith('storage/')||String(p.path||'').startsWith('workshop/')){
        const old=await legacyPhotos(p.kind,p.id);if(!old.some(x=>x.path===p.path))fail('Файл не относится к карточке',403);
        const signed=await rest('/storage/v1/object/sign/rental-private-docs/'+String(p.path).split('/').map(encodeURIComponent).join('/'),'POST',{expiresIn:300});return out({data:{url:BASE+'/storage/v1'+signed.signedURL}});
      }
      return out({data:await g('signed_url',p)});
    }
    if(action==='stock'){
      required(p,['note']);if(!uuid(p.part_id)||!uuid(p.request_id))fail('Неверный код операции');p.quantity=integer(p.quantity,'количество');
      if(!['receipt','issue','return','adjustment'].includes(p.movement_type))fail('Неверное движение');if(p.movement_type==='adjustment'){if(!admin(me))fail('Нет права корректировки',403);p.balance_after=integer(p.balance_after??p.quantity,'остаток',0);}
    }
    if(action==='sale'){
      if(!uuid(p.request_id)||!Array.isArray(p.items)||!p.items.length||p.items.length>200)fail('Неверная корзина');
      if(!['cash','card','transfer'].includes(p.payment_method))fail('Укажите способ оплаты');
      const catalog=await g('catalog'),merged=new Map();
      for(const x of p.items){const id=x.part_id||x.id;if(!uuid(id))fail('Неверный товар');merged.set(id,(merged.get(id)||0)+integer(x.quantity,'количество',1,1000));}
      p.items=[...merged].map(([id,quantity])=>{const pr=catalog.parts.find(x=>x.id===id&&x.active!==false);if(!pr)fail('Товар не найден',404);return {part_id:id,quantity,price:numeric(pr.retail_price,'цену')};});
      const subtotal=p.items.reduce((s,x)=>s+x.price*x.quantity,0);p.discount=numeric(p.discount??0,'скидку',0,subtotal);if(p.discount&&!admin(me))fail('Скидку задаёт администратор',403);
    }
    if(action==='part_save'){
      required(p,['name']);const existing=p.id?(await g('catalog')).parts.find(x=>x.id===p.id):null;if(p.id&&!existing)fail('Товар не найден',404);
      p={...existing,...p};p.unit_cost=numeric(p.unit_cost??0,'закупочную цену');p.retail_price=numeric(p.retail_price??0,'розничную цену');p.name=text(p.name,200);p.category=text(p.category,100);p.model=text(p.model,120);p.sku=text(p.sku,100);
    }
    if(action==='catalog_save'){if(!uuid(p.id))fail('Неверная услуга');required(p,['title']);p.labor_price=numeric(p.labor_price,'стоимость работы');}
    if(action==='legal_save'){required(p,['legal_name']);}
    if(action==='create'){
      required(p,['last_name','first_name','phone','brand','model']);if(!/^\+7\d{10}$/.test(p.phone))fail('Введите полный телефон');if(!uuid(p.request_id))fail('Неверный код приёмки');
      if(p.kind==='storage'){if(!['monthly','season'].includes(p.storage_tariff))fail('Неверный тариф');p.storage_months=integer(p.storage_months||1,'месяцы',1,12);p.wash=bool(p.wash);if(!/^\d{4}-\d{2}-\d{2}$/.test(p.starts_on||'')||!/^\d{4}-\d{2}-\d{2}$/.test(p.planned_return_date||'')||p.planned_return_date<p.starts_on)fail('Проверьте сроки хранения');}
      if(p.auto_assign){const staff=await db('workshop_members','active=eq.true&role=eq.mechanic&select=profile_id,tags');const tags=(p.tags||[]).map(x=>String(x).toLowerCase());const available=(staff||[]).filter(x=>!tags.length||(x.tags||[]).some(t=>tags.includes(String(t).toLowerCase())));p.assigned_master_id=available[0]?.profile_id||'';}
    }
    if(['update','payment','extend','contact','upload','documents'].includes(action)){
      const d=await g('get',{kind:p.kind,id:p.id}),r=recordDates(d.record);
      if(me.role==='mechanic'&&(p.kind!=='repair'||r.assigned_master_id!==user.id))fail('Нет доступа к карточке',403);
      if(['update','extend','contact'].includes(action)){if(Number(p.revision)!==Number(r.revision))fail('Карточка изменена. Обновите страницу.',409);}
      if(terminal.has(r.status)&&!['documents','upload'].includes(action)){
        if(!(action==='update'&&admin(me)&&text(p.reopen_reason)&&p.status===(p.kind==='storage'?'stored':'accepted')))fail('Заказ закрыт. Повторное открытие доступно администратору.',409);
      }
      if(action==='update'){
        if(p.kind==='repair'){
          if(p.works!==undefined)p.works=lines(p.works);if(p.parts!==undefined)p.parts=lines(p.parts);
          p.discount=numeric(p.discount??r.discount??0,'скидку');p.warranty_days=integer(p.warranty_days??r.warranty_days??0,'гарантию',0,3650);
          if(!manager(me)){p.assigned_master_id=r.assigned_master_id;p.approve=false;}
          const amount=[...(p.works||r.works||[]),...(p.parts||r.parts||[])].reduce((s,x)=>s+x.price*x.quantity,0)-p.discount;
          if(p.approve&&!text(p.approval_note))fail('Укажите как согласована стоимость');
          if(['ready','issued'].includes(p.status)&&(!(p.quality_checked??r.quality_checked)||(p.approve?amount:r.approved_amount)!==amount))fail('Перед выдачей нужны проверка техники и согласование текущей стоимости',409);
          if(p.status==='issued'&&(r.status!=='ready'||Number(r.paid_amount)<amount))fail('Для выдачи нужны статус «Готов» и оплата',409);
          if(!['accepted','diagnostics','waiting_parts','repair','ready','issued','cancelled'].includes(p.status||r.status))fail('Неверный статус');
        }else{
          if(!['accepted','stored','ready_return','returned','cancelled'].includes(p.status||r.status))fail('Неверный статус');
          if(p.status==='returned'&&(r.status!=='ready_return'||Number(r.paid_amount)<Number(r.storage_amount)||(d.linked||[]).some(x=>!terminal.has(x.status))))fail('Для выдачи нужны готовность, оплата и завершение связанных ремонтов',409);
        }
      }
      if(action==='payment'){
        if(!uuid(p.request_id))fail('Неверный код оплаты');p.amount=numeric(p.amount,'сумму',-1e9);if(!p.amount)fail('Нулевая оплата');
        if(!['cash','card','transfer'].includes(p.method))fail('Неверный способ оплаты');if(p.amount<0&&(!admin(me)||!text(p.note)))fail('Возврат доступен администратору с указанием причины',403);
      }
      if(action==='extend'){p.months=integer(p.months,'месяцы',1,12);required(p,['note']);}
      if(action==='upload'){
        if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(p.content_type))fail('Поддерживаются JPG, PNG, WebP, PDF');
        let bytes;try{bytes=atob(String(p.content_base64||''));}catch{fail('Повреждённый файл');}if(!bytes.length||bytes.length>10*1024*1024)fail('Максимум 10 МБ',413);
        const slot=p.slot==='signed'?'signed':'photos';if(slot==='signed'&&!manager(me))fail('Нет доступа к подписанным документам',403);
        const uploaded=await g('upload',p);await g('documents',{kind:p.kind,id:p.id,paths:[uploaded.path],slot});return out({data:uploaded});
      }
      if(action==='documents'){
        if(!['photos','signed'].includes(p.slot)||!Array.isArray(p.paths)||p.paths.length>30)fail('Неверный список файлов');if(p.slot==='signed'&&!manager(me))fail('Нет доступа',403);
        const allowed=[...(r.fault_photo_paths||[]),...(r.signed_document_paths||[])];if(p.paths.some(x=>!allowed.includes(x)))fail('Файл не загружен в эту карточку',403);
      }
    }
    let data=await g(action,p);if(action==='list')data.items=data.items.map(recordDates);if(action==='get')recordDates(data.record);return out({data,backend:'GOOGLE_SHEETS_DRIVE'});
  }catch(e){return out({error:e.status?e.message:'Сервис временно недоступен. Данные в Google не переключались на старую базу.'},e.status||503);}
}
Deno.serve(main);
