// No external dependencies. Supabase Auth is checked on every request.
const PROJECT_URL = Deno.env.get('SUPABASE_URL');
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const BUCKET = 'rental-private-docs';
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'};
const out=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v||'');
const tables={repair:'service_repairs',storage:'storage_intakes'};
async function rest(path,method='GET',body,extra={}){
 const r=await fetch(PROJECT_URL+path,{method,headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json',...extra},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 const text=await r.text(); let data;try{data=JSON.parse(text);}catch{data=null;}
 if(!r.ok){const code=data?.code; const status=code==='42501'?403:code==='40001'?409:r.status>=500?503:400;fail(data?.message||data?.error_description||'Сервис временно недоступен',status);}
 return {data,count:Number(r.headers.get('content-range')?.split('/')[1])||0};
}
const db=async(t,q='',method='GET',body,headers={})=>(await rest('/rest/v1/'+t+(q?'?'+q:''),method,body,headers)).data;
const rpc=(action,p,actor)=>db('rpc/workshop_mutate','','POST',{p_actor:actor,p_action:action,p});
async function record(kind,p,member){
 if(!tables[kind])fail('Неверный вид заказа');
 let q=p.qr_token?'qr_token=eq.'+encodeURIComponent(p.qr_token):'id=eq.'+encodeURIComponent(p.id||'');
 if(!uuid(p.qr_token||p.id))fail('Некорректная ссылка на карточку');
 const rows=await db(tables[kind],q+'&select=*'); const r=rows?.[0];
 if(!r)fail('Приёмка не найдена',404);
 if(member.role==='mechanic' && (kind!=='repair'||r.assigned_master_id!==member.profile_id))fail('Нет доступа к этой карточке',403);
 return r;
}
async function uploadImage(base64,mime,path){
 if(!['image/jpeg','image/png','image/webp'].includes(mime))fail('Поддерживаются JPG, PNG и WebP');
 if(base64.length>7000000)fail('Максимальный размер фото — 5 МБ',413);
 let bytes;try{bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));}catch{fail('Повреждённый файл');}
 if(!bytes.length||bytes.length>5*1024*1024)fail('Максимальный размер фото — 5 МБ',413);
 const uploaded=await fetch(PROJECT_URL+'/storage/v1/object/'+BUCKET+'/'+path,{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':mime},body:bytes,signal:AbortSignal.timeout(30000)});
 if(!uploaded.ok)fail('Не удалось загрузить фото. Повторите попытку',503);
 return path;
}
async function signObject(path){
 const result=await rest('/storage/v1/object/sign/'+BUCKET+'/'+String(path).split('/').map(encodeURIComponent).join('/'),'POST',{expiresIn:600});
 return PROJECT_URL+'/storage/v1'+result.data.signedURL;
}
async function handler(req){
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return out({error:'Разрешён только POST'},405);
 try{
  const auth=req.headers.get('authorization')||'';
  if(!/^Bearer .+/i.test(auth))fail('Войдите в приложение',401);
  const ur=await fetch(PROJECT_URL+'/auth/v1/user',{headers:{apikey:KEY,Authorization:auth},signal:AbortSignal.timeout(15000)});
  if(!ur.ok)fail('Сессия истекла. Войдите снова',401);
  const user=await ur.json();
  const members=await db('workshop_members','profile_id=eq.'+encodeURIComponent(user.id)+'&active=eq.true&select=*');
  const me=members?.[0]; if(!me)fail('Доступ к мастерской не выдан. Обратитесь к владельцу',403);
  const manager=['owner','admin','receiver','manager'].includes(me.role), admin=['owner','admin'].includes(me.role);
  if(Number(req.headers.get('content-length')||0)>15000000)fail('Файл слишком большой',413);
  let input;try{input=await req.json();}catch{fail('Некорректный запрос');}
  const action=input.action,p=input.params||{},kind=p.kind||(/storage-api/.test(new URL(req.url).pathname)?'storage':'repair');
  p.kind=kind;
  if(action==='me')return out({data:{...me,email:user.email}});
  if(['create','update','payment','documents','contact','extend','member_update','stock','import_legacy'].includes(action))return out({data:await rpc(action,p,user.id)});
  if(action==='sale'){
   if(!manager)fail('Нет права проводить продажи',403);
   return out({data:await db('rpc/workshop_sale','','POST',{p_actor:user.id,p})});
  }
  if(action==='list'){
   if(!tables[kind]||(!manager&&kind==='storage'))fail('Нет доступа',403);
   const limit=Math.min(100,Math.max(1,Number(p.limit)||50)),offset=Math.max(0,Number(p.offset)||0);
   const cols=kind==='repair'?'repair_number,total_amount,assigned_master,assigned_master_id,promised_date,quality_checked,storage_id':'storage_number,storage_amount,storage_tariff,storage_months,storage_location,starts_on,planned_return_date,documents_uploaded_at';
   const query=new URLSearchParams({select:'id,last_name,first_name,middle_name,phone,brand,model,serial_number,status,paid_amount,created_at,revision,'+cols,order:'created_at.desc,id.desc',limit:String(limit),offset:String(offset)});
   if(!manager)query.set('assigned_master_id','eq.'+user.id);
   if(p.status && p.status!=='all')query.set('status',p.status==='active'?(kind==='repair'?'not.in.(issued,cancelled)':'not.in.(returned,cancelled)'):'eq.'+p.status);
   const search=String(p.search||'').replace(/[^\p{L}\p{N} +_-]/gu,'').trim().slice(0,100);
   if(search){const fields=['last_name','first_name','middle_name','phone','brand','model','serial_number'];query.set('or','('+fields.map(f=>f+'.ilike.*'+search+'*').join(',')+')');}
   if(p.assignee && manager && uuid(p.assignee))query.set('assigned_master_id','eq.'+p.assignee);
   const {data,count}=await rest('/rest/v1/'+tables[kind]+'?'+query,'GET',undefined,{Prefer:'count=exact'});
   return out({data:{items:data,count,offset,limit}});
  }
  if(action==='get'){
   const r=await record(kind,p,me);
   const [events,payments,legal,linked]=await Promise.all([
    db('workshop_events','kind=eq.'+kind+'&record_id=eq.'+r.id+'&order=created_at.desc&limit=100'),
    manager?db('workshop_payments',(kind==='repair'?'repair_id':'storage_id')+'=eq.'+r.id+'&order=created_at.desc'):Promise.resolve([]),
    db('legal_entity_settings','id=eq.1'),
    kind==='storage'?db('service_repairs','storage_id=eq.'+r.id+'&select=id,repair_number,status,total_amount,paid_amount'):Promise.resolve([])
   ]);
   return out({data:{record:r,events,payments,legal:legal?.[0],linked}});
  }
  if(action==='overview'||action==='customers'||action==='finance'||action==='legacy')return out({data:await db('rpc/workshop_read','','POST',{p_actor:user.id,p_action:action,p})});
  if(action==='catalog'){
   const [services,parts,staff,categories]=await Promise.all([
    db('service_catalog','active=eq.true&order=title&limit=500'),
    db('parts','select=id,name,sku,barcode,category,model,unit,quantity,unit_cost,retail_price,price_note,active,primary_photo_path&order=name&limit=5000'),
    db('workshop_members','select=profile_id,name,role,active,tags&order=name'),
    db('inventory_categories','select=id,name,barcode,primary_photo_path&order=name&limit=1000')
   ]);return out({data:{services,parts,staff,categories}});
  }
  if(action==='part_by_barcode'){
   const code=String(p.barcode||'').trim().toUpperCase().slice(0,100);if(!code)fail('Штрих-код пуст');
   let rows=await db('parts','barcode=eq.'+encodeURIComponent(code)+'&active=eq.true&select=id,name,sku,barcode,category,model,unit,quantity,unit_cost,retail_price,primary_photo_path&limit=1');
   if(!rows?.length)rows=await db('parts','sku=eq.'+encodeURIComponent(code)+'&active=eq.true&select=id,name,sku,barcode,category,model,unit,quantity,unit_cost,retail_price,primary_photo_path&limit=1');
   if(!rows?.length)fail('Товар с таким штрих-кодом не найден',404);return out({data:rows[0]});
  }
  if(action==='sales'){
   if(!manager)fail('Нет доступа',403);const limit=Math.min(100,Math.max(1,Number(p.limit)||50)),offset=Math.max(0,Number(p.offset)||0);
   const {data,count}=await rest('/rest/v1/workshop_sales?select=id,sale_number,cashier_id,payment_method,total,note,created_at&order=created_at.desc&limit='+limit+'&offset='+offset,'GET',undefined,{Prefer:'count=exact'});return out({data:{items:data,count,offset,limit}});
  }
  if(action==='stock_history'){
   if(!uuid(p.part_id))fail('Не указана запчасть');return out({data:await db('stock_movements','part_id=eq.'+p.part_id+'&order=created_at.desc&limit=100')});
  }
  if(action==='part_save'){
   if(!admin)fail('Нет права изменять справочник',403);
   if(!String(p.name||'').trim()||!Number.isFinite(Number(p.retail_price))||Number(p.retail_price)<0)fail('Проверьте название и цену');
   const unit=String(p.unit||'шт').trim().slice(0,20)||'шт';
   const value={name:String(p.name).trim().slice(0,200),sku:String(p.sku||'').trim().slice(0,100)||null,category:String(p.category||'').trim().slice(0,100)||null,model:String(p.model||'').trim().slice(0,120)||null,unit,unit_cost:Math.max(0,Number(p.unit_cost)||0),retail_price:Number(p.retail_price),active:p.active!==false&&String(p.active)!=='false',updated_at:new Date().toISOString()};
   const result=await db('parts',p.id?'id=eq.'+encodeURIComponent(p.id):'',p.id?'PATCH':'POST',value,{Prefer:'return=representation'});const part=result[0];
   if(part?.category)await db('inventory_categories','on_conflict=name','POST',{name:part.category,updated_at:new Date().toISOString()},{Prefer:'resolution=merge-duplicates'});return out({data:part});
  }
  if(action==='part_photo_upload'){
   if(!manager)fail('Нет права загружать фото товара',403);if(!uuid(p.part_id))fail('Не указан товар');
   const rows=await db('parts','id=eq.'+p.part_id+'&select=id,category,primary_photo_path');const part=rows?.[0];if(!part)fail('Товар не найден',404);
   const mime=String(p.content_type||''),base64=String(p.content_base64||'');const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[mime];if(!ext)fail('Поддерживаются JPG, PNG и WebP');
   const path='workshop/parts/'+part.id+'/'+crypto.randomUUID()+'.'+ext;await uploadImage(base64,mime,path);await db('parts','id=eq.'+part.id,'PATCH',{primary_photo_path:path,updated_at:new Date().toISOString()});
   if((p.primary_for_category===true||String(p.primary_for_category)==='true')&&part.category)await db('inventory_categories','on_conflict=name','POST',{name:part.category,primary_photo_path:path,updated_at:new Date().toISOString()},{Prefer:'resolution=merge-duplicates'});
   return out({data:{path}});
  }
  if(action==='part_photo_url'){
   if(!uuid(p.part_id))fail('Не указан товар');const rows=await db('parts','id=eq.'+p.part_id+'&select=primary_photo_path');const part=rows?.[0];if(!part?.primary_photo_path)fail('У товара нет фотографии',404);return out({data:{url:await signObject(part.primary_photo_path)}});
  }
  if(action==='catalog_save'){
   if(!admin)fail('Нет права изменять прайс',403);if(!uuid(p.id)||!String(p.title||'').trim()||!Number.isFinite(Number(p.labor_price))||Number(p.labor_price)<0)fail('Проверьте услугу');return out({data:await db('service_catalog','id=eq.'+p.id,'PATCH',{title:String(p.title).slice(0,200),labor_price:Number(p.labor_price),updated_at:new Date().toISOString()},{Prefer:'return=representation'})});
  }
  if(action==='legal')return out({data:(await db('legal_entity_settings','id=eq.1'))[0]});
  if(action==='legal_save'){
   if(!admin)fail('Нет права изменять реквизиты',403);const fields=['legal_name','full_name','inn','ogrnip','registration_address','bank_name','bik','correspondent_account','settlement_account','phone','email'];const patch=Object.fromEntries(fields.map(k=>[k,String(p[k]||'').trim().slice(0,500)||null]));if(!patch.legal_name)fail('Укажите наименование исполнителя');return out({data:await db('legal_entity_settings','id=eq.1','PATCH',{...patch,updated_at:new Date().toISOString()},{Prefer:'return=representation'})});
  }
  if(action==='staff_create'){
   if(!admin)fail('Нет права добавлять сотрудников',403);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email||'')||String(p.password||'').length<12||!String(p.name||'').trim())fail('Укажите имя, почту и пароль от 12 символов');if(!['admin','receiver','manager','mechanic'].includes(p.role))fail('Недопустимая роль');
   const created=await rest('/auth/v1/admin/users','POST',{email:p.email,password:p.password,email_confirm:true});const id=created.data.id||created.data.user?.id;if(!id)fail('Не удалось создать сотрудника');await db('profiles','','POST',{id,full_name:p.name,role:'customer'},{Prefer:'resolution=ignore-duplicates'});await rpc('member_update',{profile_id:id,name:p.name,role:p.role,active:true,tags:p.tags||[]},user.id);return out({data:{id}});
  }
  if(action==='upload'){
   const r=await record(kind,p,me);const mime=String(p.content_type||''),base64=String(p.content_base64||'');if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(mime))fail('Поддерживаются JPG, PNG, WebP и PDF');if(base64.length>14000000)fail('Максимальный размер файла — 10 МБ',413);let bytes;try{bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));}catch{fail('Повреждённый файл');}if(!bytes.length||bytes.length>10*1024*1024)fail('Максимальный размер файла — 10 МБ');const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'}[mime];const path='workshop/'+kind+'/'+r.id+'/'+crypto.randomUUID()+'.'+ext;const uploaded=await fetch(PROJECT_URL+'/storage/v1/object/'+BUCKET+'/'+path,{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':mime},body:bytes,signal:AbortSignal.timeout(30000)});if(!uploaded.ok)fail('Не удалось загрузить файл. Повторите попытку',503);return out({data:{path}});
  }
  if(action==='signed_url'||action==='get_url'){
   const r=await record(kind,p,me),paths=[r.scooter_photo_path,r.display_photo_path,r.motor_photo_path,...(r.fault_photo_paths||[]),...(r.signed_document_paths||[])].filter(Boolean);if(!paths.includes(p.path))fail('Файл не относится к этой карточке',403);return out({data:{url:await signObject(p.path)}});
  }
  fail('Неизвестная операция');
 }catch(e){return out({error:e.message==='Insufficient stock'?'На складе недостаточно запчастей':e.message||'Не удалось выполнить операцию'},e.status||400);}
}
Deno.serve(handler);
