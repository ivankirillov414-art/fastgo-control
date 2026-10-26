import {unknownScan} from './unknown.js';
import {repairScan} from './repair-scan.js';
import {cancelDocument} from './cancel.js';
import {deviceStatus} from './device-status.js';
import {partsIssue} from './parts-issue.js';
import {editInventory} from './inventory.js';
import {liveWarehouse} from './live.js';
import {receiptLabels} from './receipt-labels.js';
import {repairIdFromCode,repairQuote,prepareRepairPayment} from './repair.js';
import {nativeClient} from '../_shared/native-client.js';
import {createNativeEngine} from '../_shared/native-engine.js';
import {masterIssue,masterHoldings,items,id,fail} from './model.js';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const out=(data,status=200)=>new Response(JSON.stringify(data),{headers,status});
export async function digest(v){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function createHandler({base,key,fetcher=fetch}){return async req=>{if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return out({error:'Только POST'},405);
 try{
 const auth=req.headers.get('authorization');if(!auth?.startsWith('Bearer '))fail('Войдите в FastGo',401);
 const ur=await fetcher(base+'/auth/v1/user',{headers:{apikey:key,Authorization:auth},signal:AbortSignal.timeout(10000)});if(!ur.ok)fail('Войдите в FastGo',401);const user=await ur.json();
 const db=async(path,q='',method='GET',body,prefer)=>{const r=await fetcher(base+'/rest/v1/'+path+(q?'?'+q:''),{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});if(!r.ok){const e=await r.json().catch(()=>({}));fail(e.message||'Ошибка базы',r.status===409?409:503);}if(r.status===204)return null;const text=await r.text();if(!text.trim()){if(['POST','PATCH','DELETE'].includes(method)&&!prefer&&!path.startsWith('rpc/'))return null;fail('База вернула пустой ответ. Повторите запрос',503);}try{return JSON.parse(text);}catch{fail('База вернула некорректный ответ. Повторите запрос',503);}};
 const member=(await db('workshop_members','profile_id=eq.'+user.id+'&active=eq.true&select=*'))[0];if(!member)fail('Доступ отключён',403);
 const owner=['owner','developer'].includes(member.role),cash=owner||member.role==='seller'||member.can_sell===true;
 const raw=await req.text();if(raw.length>25000)fail('Слишком большой запрос');const p=JSON.parse(raw),action=p.action;
 if(action==='holdings'){if(!owner)fail('Только для владельца',403);const snapshot=await db('rpc/workshop_native_snapshot','','POST',{});return out({data:masterHoldings(snapshot.sheets)});}
 if(!cash)fail('Нет доступа к складу и оплатам',403);
 const actor={id:user.id,email:user.email||'',name:member.name||'',role:member.role,can_sell:cash};
 // All connections still require a verified user and an active cash-enabled member.
 // This project contains one shared workshop; only public station labels are listed.
 const permitted=await db('workshop_terminal_stations','select=station_id');
 const permittedIds=new Set(permitted.map(x=>x.station_id));
 if(action==='stations')return out({data:(await db('workshop_warehouse_devices','kind=eq.station&active=eq.true&select=id,name,created_at&order=created_at.desc')).filter(x=>permittedIds.has(x.id)).map(x=>({id:x.id,name:x.name,created_at:x.created_at}))});
 if(action==='connect_terminal'){
  if(!permittedIds.has(p.station_id))fail('Этот ноутбук не разрешён для ТСД',403);
  if(!id(p.station_id)||!id(p.terminal_id)||typeof p.token!=='string'||!(/^[a-f0-9-]{72}$/.test(p.token)))fail('Неверные данные подключения');
  const destination=(await db('workshop_warehouse_devices','id=eq.'+p.station_id+'&kind=eq.station&active=eq.true&select=id,name'))[0];
  if(!destination)fail('Складской ноутбук недоступен',404);
  const hash=await digest(p.token),existing=(await db('workshop_warehouse_devices','id=eq.'+p.terminal_id))[0];
  const result={id:p.terminal_id,token:p.token,station_id:destination.id,name:destination.name};
  if(existing){if(existing.kind!=='terminal'||!existing.active||existing.created_by!==user.id||existing.token_hash!==hash||existing.station_id!==destination.id)fail('Подключение уже используется',409);return out({data:result});}
  try{await db('workshop_warehouse_devices','','POST',{id:p.terminal_id,kind:'terminal',station_id:destination.id,name:'iData / терминал',token_hash:hash,created_by:user.id});}
  catch(e){if(e.status!==409)throw e;const retry=(await db('workshop_warehouse_devices','id=eq.'+p.terminal_id))[0];if(!retry||retry.kind!=='terminal'||!retry.active||retry.created_by!==user.id||retry.token_hash!==hash||retry.station_id!==destination.id)throw e;}
  return out({data:result});
 }
 if(action==='register'){if(!owner)fail('Разрешить ноутбук для ТСД может только владелец',403);if(p.station_id!==undefined&&(!id(p.station_id)||typeof p.token!=='string'||!(/^[a-f0-9-]{72}$/.test(p.token))))fail('Неверная регистрация');const token=p.station_id?p.token:crypto.randomUUID()+crypto.randomUUID(),device={id:p.station_id||crypto.randomUUID(),name:String(p.name||'Ноутбук FastGo').slice(0,80)};await db('rpc/warehouse_register_terminal_station','','POST',{p_id:device.id,p_name:device.name,p_token_hash:await digest(token),p_actor:user.id});return out({data:{...device,token}});}
 if(action==='pair'){const token=crypto.randomUUID()+crypto.randomUUID(),device_id=crypto.randomUUID();const station=await db('rpc/warehouse_pair','','POST',{p_code:String(p.code||'').trim().toUpperCase(),p_id:device_id,p_token_hash:await digest(token),p_actor:user.id,p_name:'iData / терминал'});return out({data:{id:device_id,token,station_id:station,name:'Терминал'}});}
 if(!id(p.device_id)||typeof p.device_token!=='string')fail('Привяжите устройство',403);
 const device=(await db('workshop_warehouse_devices','id=eq.'+p.device_id+'&active=eq.true&token_hash=eq.'+await digest(p.device_token)))[0];if(!device)fail('Привязка отключена',403);
 const stationId=device.kind==='station'?device.id:device.station_id;
 if(!permittedIds.has(stationId))fail('Этот ноутбук не разрешён для ТСД',403);
 if(device.kind==='terminal'&&!(await db('workshop_warehouse_devices','id=eq.'+stationId+'&active=eq.true&select=id')).length)fail('Складское рабочее место отключено',403);
 const station=()=>{if(device.kind!=='station')fail('Операция доступна только складскому ноутбуку',403);};
 const diagnostic=await deviceStatus(action,p,{db,device,stationId});if(diagnostic!==undefined)return out({data:diagnostic});
 const issue=await partsIssue(action,p,{db,actor,device,stationId,key,digest});if(issue!==undefined)return out({data:issue});
 const g=nativeClient({db,actor,google:async()=>fail('Недоступно',503),storage:{}});
 const activeMaster=async masterId=>{const m=(await db('workshop_members','profile_id=eq.'+masterId+'&active=eq.true&role=eq.mechanic&select=profile_id,name'))[0];if(!m)fail('Выберите активного мастера');return m;};
 const mutate=async(a,params)=>{if(!id(params.request_id))fail('Неверный код операции');const body={...params};delete body.__request_fingerprint;const fingerprint=await digest(JSON.stringify({action:a,params:body}));const old=await g('operation_retry',{request_id:params.request_id,action:a,fingerprint});if(old.status==='committed')return old.result;return g(a,{...params,__request_fingerprint:fingerprint});};
 const cancelled=await cancelDocument(action,p,{db,actor,device,stationId});if(cancelled!==undefined)return out({data:cancelled});
 const repairScanResult=await repairScan(action,p,{db,actor,device,stationId,key});if(repairScanResult!==undefined)return out({data:repairScanResult});
 const unknown=await unknownScan(action,p,{db,actor,device,stationId,g,mutate});if(unknown!==undefined)return out({data:unknown});
 const labels=await receiptLabels(action,p,{db,device,stationId});if(labels!==undefined)return out({data:labels});
 const live=await liveWarehouse(action,p,{db,actor,device,stationId,digest});if(live!==undefined)return out({data:live});
 if(action==='inventory_edit')return out({data:await editInventory(p,{db,actor,device,digest})});
 if(action==='info')return out({data:{device:{id:device.id,name:device.name,kind:device.kind,station_id:stationId},terminal_allowed:true,member:{name:member.name,role:member.role}}});
 if(action==='pair_code'){station();const code=crypto.randomUUID().replaceAll('-','').slice(0,10).toUpperCase();await db('workshop_warehouse_devices','id=eq.'+device.id,'PATCH',{pair_code:code,pair_expires:new Date(Date.now()+600000).toISOString()});return out({data:{code}});}
 if(action==='catalog'){const c=await g('catalog');const staff=device.kind==='station'?await db('workshop_members','active=eq.true&role=eq.mechanic&select=profile_id,name,role,active&order=name'):[];return out({data:{parts:c.parts.filter(x=>x.active!==false),staff}});}
 if(action==='master_return'){station();if(!owner)fail('Только для владельца',403);return out({data:await mutate('master_return',{request_id:p.request_id,master_id:p.master_id,part_id:p.part_id,quantity:p.quantity})});}
 if(action==='repair_quote'){
  const repairId=p.code?await repairIdFromCode(p.code,key):p.repair_id;
  return out({data:repairQuote(await db('rpc/workshop_native_snapshot','','POST',{}),repairId,actor)});
 }
 if(action==='enqueue_repair'){
  if(!id(p.request_id)||!id(p.repair_id))fail('Неверный код ремонта');
  const old=(await db('workshop_warehouse_queue','id=eq.'+p.request_id))[0];
  if(old){if(old.terminal_id!==device.id||old.payload.kind!=='repair'||old.payload.repair_id!==p.repair_id)fail('Код документа уже использован',409);return out({data:{id:old.id,state:old.state}});}
  const quote=repairQuote(await db('rpc/workshop_native_snapshot','','POST',{}),p.repair_id,actor);
  await db('workshop_warehouse_queue','','POST',{id:p.request_id,station_id:stationId,terminal_id:device.id,created_by:user.id,payload:{kind:'repair',repair_id:quote.id,repair:quote,items:[]}});
  return out({data:{id:p.request_id,state:'queued'}});
 }
 if(action==='enqueue'){if(!id(p.request_id))fail('Неверный код корзины');const payload={items:items(p.items)},old=(await db('workshop_warehouse_queue','id=eq.'+p.request_id))[0];if(old){if(old.terminal_id!==device.id||old.payload.kind==='repair'||JSON.stringify(items(old.payload.items))!==JSON.stringify(payload.items))fail('Код корзины уже использован',409);return out({data:{id:old.id,state:old.state}});}await db('workshop_warehouse_queue','','POST',{id:p.request_id,station_id:stationId,terminal_id:device.id,created_by:user.id,payload});return out({data:{id:p.request_id,state:'queued'}});}
 if(action==='queue'){station();return out({data:(await db('workshop_warehouse_queue','station_id=eq.'+stationId+'&state=neq.done&order=created_at.asc&limit=100')).filter(x=>!x.payload.live&&x.payload.kind!=='unknown')});}
 if(action==='job'){if(!id(p.id))fail('Неверная корзина');const job=(await db('workshop_warehouse_queue','id=eq.'+p.id+'&station_id=eq.'+stationId+(device.kind==='terminal'?'&terminal_id=eq.'+device.id:'')))[0]||null;if(job?.payload.kind==='repair'&&job.state!=='done')job.repair=repairQuote(await db('rpc/workshop_native_snapshot','','POST',{}),job.payload.repair_id,actor);return out({data:job});}
 if(action==='receipt'){if(!['owner','developer','seller'].includes(member.role))fail('Нет права принимать товар',403);if(!String(p.note||'').trim())fail('Укажите поставщика / документ');return out({data:await mutate('stock_receive',{request_id:p.request_id,note:String(p.note).slice(0,500),items:items(p.items)})});}
 if(action==='cash_state'){station();return out({data:await g('cash_state')});}
 if(action==='shift_open'){station();return out({data:await mutate('shift_open',{request_id:p.request_id,register:String(p.register||device.name).slice(0,80),opening_cash:Number(p.opening_cash)})});}
 if(action==='checkout'){
 station();if(!id(p.id))fail('Неверная корзина');let job=(await db('workshop_warehouse_queue','id=eq.'+p.id+'&station_id=eq.'+stationId))[0];if(!job)fail('Корзина не найдена',404);if(job.payload.live)fail('Откройте текущую корзину терминала',409);if(job.state==='done')return out({data:job.result});
 if(!job.checkout&&p.mode==='master')fail('Выдавайте запчасти в ремонт через «Выдача запчастей» на ТСД и QR мастера',403);
 if(job.payload.kind==='repair'){
  if(!job.checkout){
   const c={mode:'repair',actor_id:user.id,repair_id:job.payload.repair_id,amount:p.amount,method:p.payment_method,expected_revision:p.expected_revision,...(p.total_override!==undefined?{total_override:p.total_override}:{})};
   prepareRepairPayment(await db('rpc/workshop_native_snapshot','','POST',{}),{...c,request_id:job.id},actor);
   const changed=await db('workshop_warehouse_queue','id=eq.'+job.id+'&state=eq.queued&checkout=is.null','PATCH',{checkout:c,state:'processing'},'return=representation');
   job=changed[0]||(await db('workshop_warehouse_queue','id=eq.'+job.id))[0];
  }
  const c=job.checkout;if(c?.actor_id!==user.id)fail('Эту оплату завершает другой кассир',409);
  const params={request_id:job.id,repair_id:c.repair_id,amount:c.amount,method:c.method,expected_revision:c.expected_revision,...(c.total_override!==undefined?{total_override:c.total_override}:{})},fp=await digest(JSON.stringify(params));
  const receipt=async()=>{const old=(await db('workshop_native_receipts','request_id=eq.'+job.id))[0];if(!old)return null;if(old.actor_id!==user.id||old.action!=='warehouse_repair_payment'||old.fingerprint!==fp)fail('Конфликт операции',409);return old.result;};
  let result=await receipt();
  if(!result){for(let i=0;i<4;i++){
   const snapshot=await db('rpc/workshop_native_snapshot','','POST',{});let prepared;
   try{prepared=prepareRepairPayment(snapshot,params,actor);}catch(e){
    result=await receipt();if(result)break;
    // A known validation failure happened before any commit. Let the cashier
    // see the new balance; unknown network/commit failures retain frozen data.
    if(e.status===409)await db('workshop_warehouse_queue','id=eq.'+job.id+'&state=eq.processing','PATCH',{checkout:null,state:'queued'});
    throw e;
   }
   const commit=await db('rpc/workshop_native_commit','','POST',{p_actor:user.id,p_action:'warehouse_repair_payment',p_request_id:job.id,p_fingerprint:fp,p_version:snapshot.version,p_changes:prepared.changes,p_result:prepared.result});
   if(!commit.retry){result=commit.result;break;}
  }}
  if(!result)fail('Данные изменились. Повторите эту оплату',409);
  await db('workshop_warehouse_queue','id=eq.'+job.id,'PATCH',{state:'done',result,completed_at:new Date().toISOString()});return out({data:result});
 }
 if(!job.checkout){const checkout={actor_id:user.id,mode:p.mode==='master'?'master':'sale',master_id:p.master_id||'',shift_id:p.shift_id||'',payment_method:p.payment_method||'',items:items(job.payload.items).map(x=>{const chosen=(p.items||[]).find(a=>a.part_id===x.part_id);const price=Number(chosen?.unit_price);if(!Number.isFinite(price)||price<0||price>1e8||Math.abs(price*100-Math.round(price*100))>0.00001)fail('Проверьте цену');return {...x,price_mode:'free',unit_price:price};})};if(checkout.mode==='sale'&&(!id(checkout.shift_id)||!['cash','card'].includes(checkout.payment_method)))fail('Выберите смену и способ оплаты');if(checkout.mode==='sale'&&checkout.items.reduce((n,x)=>n+x.unit_price*x.quantity,0)<=0)fail('Для 0 ₽ выберите выдачу мастеру');if(checkout.mode==='master'&&(!id(checkout.master_id)||!(await db('workshop_members','profile_id=eq.'+checkout.master_id+'&active=eq.true&role=eq.mechanic&select=profile_id')).length))fail('Выберите активного мастера');const validationSnapshot=await db('rpc/workshop_native_snapshot','','POST',{});if(checkout.mode==='master')masterIssue(validationSnapshot,{request_id:job.id,master_id:checkout.master_id,items:checkout.items},actor,{validatedMaster:await activeMaster(checkout.master_id)});else createNativeEngine(validationSnapshot.sheets).run('sale',{request_id:job.id,shift_id:checkout.shift_id,payment_method:checkout.payment_method,items:checkout.items,discount:0},actor);const changed=await db('workshop_warehouse_queue','id=eq.'+job.id+'&state=eq.queued&checkout=is.null','PATCH',{checkout,state:'processing'},'return=representation');job=changed[0]||(await db('workshop_warehouse_queue','id=eq.'+job.id))[0];}
 if(job.checkout.actor_id!==user.id)fail('Эту оплату завершает другой кассир',409);const c=job.checkout;let result;
 if(c.mode==='sale')result=await mutate('sale',{request_id:job.id,shift_id:c.shift_id,payment_method:c.payment_method,items:c.items,discount:0,note:'Терминал · '+job.id});
 else {const params={request_id:job.id,master_id:c.master_id,items:items(c.items)},fp=await digest(JSON.stringify(params));const old=await db('workshop_native_receipts','request_id=eq.'+job.id);if(old[0]){if(old[0].actor_id!==user.id||old[0].action!=='warehouse_master_issue'||old[0].fingerprint!==fp)fail('Конфликт операции',409);result=old[0].result;}else{for(let i=0;i<4;i++){const snapshot=await db('rpc/workshop_native_snapshot','','POST',{}),prepared=masterIssue(snapshot,params,actor,{validatedMaster:await activeMaster(params.master_id)}),commit=await db('rpc/workshop_native_commit','','POST',{p_actor:user.id,p_action:'warehouse_master_issue',p_request_id:job.id,p_fingerprint:fp,p_version:snapshot.version,p_changes:prepared.changes,p_result:prepared.result});if(!commit.retry){result=commit.result;break;}}if(!result)fail('Склад изменился. Повторите эту операцию',409);}}
 await db('workshop_warehouse_queue','id=eq.'+job.id,'PATCH',{state:'done',result,completed_at:new Date().toISOString()});return out({data:result});
 }
 fail('Неизвестная операция');
 }catch(e){return out({error:e.message||'Не удалось выполнить запрос'},e.status||503);}
};}
