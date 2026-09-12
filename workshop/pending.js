// Persist only hashes and operation identifiers; never customer details or photos.
export const mutations=new Set(['create','update','contact','extend','payment','stock','sale','part_save','catalog_save','legal_save','upload','documents','part_photo_upload','part_photo_primary','migrate_legacy_file']);
export function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value);}
export async function operation(storage,actor,action,params){
  const body={...params};delete body.request_id;
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical({action,body})));
  const signature=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
  const key='fastgo_pending_v1:'+actor+':'+signature;
  let entry;try{entry=JSON.parse(storage.getItem(key)||'null');}catch{}
  if(!entry){entry={request_id:params.request_id||crypto.randomUUID(),action,created_at:new Date().toISOString()};storage.setItem(key,JSON.stringify(entry));}
  // Fail before submission if the browser cannot durably remember the operation.
  if(!storage.getItem(key))throw new Error('Не удалось сохранить код операции в браузере. Освободите место и повторите.');
  return {key,params:{...params,request_id:entry.request_id},finish:()=>storage.removeItem(key)};
}
