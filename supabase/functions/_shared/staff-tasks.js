const admins=new Set(['developer','owner','admin']);
const uuid=v=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(v||''));
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const columns='id,assignee_id,created_by,title,description,scopes,reviewed_scopes,status,revision,created_at,updated_at,completed_at,notice_posted_at,notice_opened_at';
export async function requirePriceTask(db,id,actor,{write=false}={}){
 if(!uuid(id))fail('Неверный номер задачи');
 const rows=await db('workshop_staff_tasks','id=eq.'+id+(admins.has(actor.role)?'':'&assignee_id=eq.'+actor.id)+'&select='+columns);
 const task=rows?.[0];if(!task)fail('Задача не найдена',404);
 if(write&&task.status!=='open')fail('Задача закрыта; редактирование цен завершено',409);
 return task;
}
export async function staffTaskApi(action,p,{db,actor}){
 if(action==='staff_device_register'){
  if(!uuid(p.device_id)||!/^[-_A-Za-z0-9]{43}$/.test(p.token||''))fail('Неверный ключ уведомлений');
  const old=(await db('workshop_task_devices','id=eq.'+p.device_id+'&select=profile_id'))?.[0];
  if(old&&old.profile_id!==actor.id)fail('Создайте новый ключ устройства',409);
  const token_hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p.token)))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const value={profile_id:actor.id,token_hash,revoked_at:null,updated_at:new Date().toISOString()};
  if(old)await db('workshop_task_devices','id=eq.'+p.device_id+'&profile_id=eq.'+actor.id,'PATCH',value);
  else await db('workshop_task_devices','','POST',{id:p.device_id,...value});
  return {ok:true};
 }
 if(action==='staff_device_revoke'){
  if(!uuid(p.device_id))fail('Неверное устройство');
  await db('workshop_task_devices','id=eq.'+p.device_id+'&profile_id=eq.'+actor.id,'PATCH',{revoked_at:new Date().toISOString()});return {ok:true};
 }
 if(action==='staff_tasks')return {items:await db('workshop_staff_tasks',(admins.has(actor.role)?'':'assignee_id=eq.'+actor.id+'&')+'select='+columns+'&order=created_at.desc&limit=100')};
 if(action==='staff_task_get')return requirePriceTask(db,p.id,actor);
 if(action==='staff_task_create'){
  if(!admins.has(actor.role))fail('Задачи назначает руководитель',403);
  if(!uuid(p.request_id)||!uuid(p.assignee_id)||typeof p.title!=='string'||!p.title.trim()||p.title.length>200||typeof p.description!=='string'||p.description.length>3000||!Array.isArray(p.scopes)||!p.scopes.length||p.scopes.length>3||p.scopes.some(x=>!['parts','equipment','works'].includes(x)))fail('Проверьте данные задачи');
  if(!(await db('workshop_members','profile_id=eq.'+p.assignee_id+'&active=eq.true&select=profile_id'))?.length)fail('Выберите активного сотрудника');
  const body={assignee_id:p.assignee_id,title:p.title.trim(),description:p.description.trim(),scopes:[...new Set(p.scopes)].sort()},hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(body))))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const replay=async()=>{const old=(await db('workshop_staff_tasks','request_id=eq.'+p.request_id+'&select=*'))?.[0];if(old&&(old.created_by!==actor.id||old.request_fingerprint!==hash))fail('Код операции уже использован для другой задачи',409);return old;};
  const old=await replay();if(old)return requirePriceTask(db,old.id,actor);
  try{const created=await db('workshop_staff_tasks','','POST',{...body,request_id:p.request_id,request_fingerprint:hash,created_by:actor.id},{Prefer:'return=representation'});return requirePriceTask(db,created[0].id,actor);}catch(error){const found=await replay();if(found)return requirePriceTask(db,found.id,actor);throw error;}
 }
 if(action==='staff_task_update'){
  await requirePriceTask(db,p.id,actor);if(!Number.isSafeInteger(p.revision)||!Array.isArray(p.reviewed_scopes)||!['open','done','cancelled'].includes(p.status))fail('Проверьте отметки задачи');
  await db('rpc/workshop_update_staff_task','','POST',{p_actor:actor.id,p_id:p.id,p_revision:p.revision,p_scopes:p.reviewed_scopes,p_status:p.status});
  return requirePriceTask(db,p.id,actor);
 }
 if(action==='staff_notice_claim'){
  if(!uuid(p.device_id))fail('Неверный код устройства');
  const tasks=await db('rpc/workshop_claim_task_notices','','POST',{p_actor:actor.id,p_device:p.device_id});
  return {items:(tasks||[]).map(t=>({id:t.id,title:t.title,body:t.description,route:'#task?id='+t.id}))};
 }
 if(action==='staff_notice_ack'){
  if(!uuid(p.device_id)||!uuid(p.id))fail('Неверное уведомление');
  const where='id=eq.'+p.id+'&assignee_id=eq.'+actor.id+'&notice_device=eq.'+p.device_id;
  if(!(await db('workshop_staff_tasks',where+'&select=id'))?.length)fail('Уведомление не найдено',404);
  await db('workshop_staff_tasks',where+'&notice_posted_at=is.null','PATCH',{notice_posted_at:new Date().toISOString()});return {ok:true};
 }
 if(action==='staff_notice_open'){
  const t=await requirePriceTask(db,p.id,actor);if(t.assignee_id===actor.id)await db('workshop_staff_tasks','id=eq.'+p.id+'&assignee_id=eq.'+actor.id+'&notice_opened_at=is.null','PATCH',{notice_opened_at:new Date().toISOString()});return {ok:true};
 }
 fail('Неизвестная операция задачи');
}
