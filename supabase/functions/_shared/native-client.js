import {createNativeEngine} from './native-engine.js';
const writes=new Set(['storage_close','storage_delete','part_save','stock','sale','catalog_save','legal_save','create','update','contact','payment','extend','upload','documents','part_photo_upload','part_photo_primary','migrate_legacy_file']);
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export function nativeClient({db,actor,google,storage}){
 let statePromise;
 const state=()=>statePromise||(statePromise=db('rpc/workshop_native_snapshot','','POST',{}));
 const reset=()=>statePromise=null;
 const signed=async(path)=>path.startsWith('native:')?{url:await storage.sign(path.slice(7))}:null;
 return async function run(action,p={}){
  if(action==='health')return {ok:true,backend:'POSTGRES_GOOGLE_MIRROR',capabilities:{atomic_writes:true,private_product_photos:true,background_google_sync:true}};
  if(action==='backup_status')return {...await google(action,p),sync:(await state()).sync};
  if(action==='operation_status'||action==='operation_retry'){
   const rows=await db('workshop_native_receipts','request_id=eq.'+encodeURIComponent(p.request_id)+'&select=*');const r=rows?.[0];if(!r)return {status:'not_found'};
   if(r.actor_id!==actor.id||action==='operation_retry'&&(r.action!==p.action||r.fingerprint!==p.fingerprint))fail('Код уже использован для другой операции',409);
   return {status:'committed',action:r.action,result:r.result};
  }
  let file=null;
  if(['upload','part_photo_upload','migrate_legacy_file'].includes(action)){
   // Validate object access before uploading bytes to the private bucket.
   const engine=createNativeEngine((await state()).sheets);
   if(action==='upload')engine.run('get',p,actor);
   else if(!['owner','admin'].includes(actor.role))fail('Нет доступа',403);
   if(action==='part_photo_upload'&&!engine.sheets['Товары'].rows.some(r=>r.product_id===p.part_id))fail('Товар не найден',404);
   const bytes=Uint8Array.from(atob(String(p.content_base64||'')),c=>c.charCodeAt(0));
   if(!bytes.length||bytes.length>10*1024*1024)fail('Неверный размер файла',413);
   if(action==='part_photo_upload'){
    const m=p.content_type;if(bytes.length>5*1024*1024||!(m==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255||m==='image/png'&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)||m==='image/webp'&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'))fail('Содержимое не соответствует формату изображения',400);
   }
   const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
   if(action==='migrate_legacy_file'&&digest!==p.sha256)fail('Контрольная сумма не совпадает',409);
   const object=(action==='part_photo_upload'?'products/'+p.part_id:action==='upload'?'orders/'+p.kind+'/'+p.id:'legacy/'+p.object_id)+'/'+p.request_id+'/'+digest;
   await storage.put(object,bytes,p.content_type||'application/octet-stream');file={path:'native:'+object,sha256:digest,size:bytes.length};
  }
  for(let attempt=0;attempt<4;attempt++){
   const snapshot=await state(),engine=createNativeEngine(snapshot.sheets);
   if(action==='part_photo_url'){
    let path;
    if(p.category){const cat=engine.sheets['Категории'].rows.find(r=>r['Категория (ключ)']===p.category);path=cat?.['Основное фото'];if(!engine.sheets['Фото товаров'].rows.some(r=>r.category===p.category&&r.path===path))fail('Фото категории не найдено',404);}
    else{const product=engine.sheets['Товары'].rows.find(r=>r.product_id===p.part_id),photos=engine.run('part_photos',p,actor);path=p.photo_id?photos.find(r=>r.id===p.photo_id)?.path:product?.['Фото URL'];if(!photos.some(r=>r.path===path))fail('Фото не найдено',404);}
    return await signed(path)||google(action,p);
   }
   if(action==='signed_url'||action==='get_url'){
    const r=engine.run('get',p,actor).record;if(r.signed_document_paths.includes(p.path)&&actor.role==='mechanic')fail('Нет доступа к подписанным документам',403);if(![...r.fault_photo_paths,...r.signed_document_paths].includes(p.path))fail('Файл не относится к заказу',403);
    return await signed(p.path)||google('signed_url',p);
   }
   if(action==='documents'){
    const r=engine.run('get',p,actor).record;if(!(p.paths||[]).every(path=>[...r.fault_photo_paths,...r.signed_document_paths].includes(path)))fail('Сначала загрузите файл в эту карточку',403);
   }
   let localAction=action,params=p;
   if(action==='upload'){localAction='native_document';params={...p,paths:[file.path],object_id:p.request_id,file_size:file.size};}
   if(action==='part_photo_upload'){localAction='native_photo';params={...p,path:file.path,sha256:file.sha256,photo_id:p.request_id};}
   if(action==='migrate_legacy_file'){localAction='native_file_migration';params={...p,path:file.path};}
   let result=engine.run(localAction,params,actor);if(action==='upload')result={path:file.path};
   if(!writes.has(action))return result;
   const committed=await db('rpc/workshop_native_commit','','POST',{p_actor:actor.id,p_action:action,p_request_id:p.request_id,p_fingerprint:p.__request_fingerprint,p_version:snapshot.version,p_changes:engine.changes(),p_result:result});
   reset();if(!committed.retry)return committed.result;
  }
  fail('Данные изменяются другим сотрудником. Повторите эту же операцию.',409);
 };
}
