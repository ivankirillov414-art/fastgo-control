import {createNativeEngine} from '../_shared/native-engine.js';
// Keep inventory corrections independent of terminal/master issue adapters.
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const id=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

export async function editInventory(p,{db,actor,device,digest,remote=false}){
 if((device?.kind!=='station'&&!remote)||!['owner','developer','admin'].includes(actor.role))fail('Нет права изменять цену и остаток',403);
 const {request_id,part_id,field,value,expected}=p;
 if(!id(request_id)||!id(part_id)||!['quantity','retail_price','unit_cost'].includes(field))fail('Неверные данные товара');
 const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>=(field==='quantity'?-1000000:0)&&n<=(field==='quantity'?1000000:100000000)&&(field==='quantity'?Number.isInteger(n):Math.abs(n*100-Math.round(n*100))<0.00001);
 if(!valid(value)||!valid(expected))fail(field==='quantity'?'Остаток: целое число от −1 000 000 до 1 000 000':'Цена: от 0 до 100 000 000 ₽, до двух знаков после запятой');
 const action=field==='quantity'?'stock':'part_save',fingerprint=await digest(JSON.stringify({part_id,field,value,expected}));
 const previous=async()=>{const r=(await db('workshop_native_receipts','request_id=eq.'+request_id))[0];if(!r)return null;if(r.actor_id!==actor.id||r.action!==action||r.fingerprint!==fingerprint)fail('Код операции уже использован',409);return r.result;};
 for(let attempt=0;attempt<4;attempt++){
  const old=await previous();if(old)return old;
  const snapshot=await db('rpc/workshop_native_snapshot','','POST',{}),engine=createNativeEngine(snapshot.sheets),part=engine.run('catalog',{},actor).parts.find(x=>x.id===part_id&&x.active!==false);
  if(!part)fail('Товар не найден',404);
  if(part[field]!==expected)fail('Данные товара уже изменились. Откройте карточку заново и проверьте актуальное значение.',409);
  if(value===expected)return part;
  let changes,result;
  if(field==='quantity'){
   engine.run('stock',{part_id,request_id,movement_type:'adjustment',quantity:Math.max(1,Math.abs(value-expected)),balance_after:value,note:'Корректировка остатка · FastGo Склад'},actor);
   changes=engine.changes();result=engine.run('catalog',{},actor).parts.find(x=>x.id===part_id);
  }else{
   const now=new Date().toISOString(),row=snapshot.sheets['Товары'].rows.find(x=>x.product_id===part_id),events=snapshot.sheets['События'].rows;
   changes=[{sheet:'Товары',row:row.__row,values:{[field==='unit_cost'?'Цена закупки, ₽':'Цена продажи, ₽']:value,updated_at:now}},{sheet:'События',row:Math.max(1,...events.map(x=>x.__row))+1,values:{event_id:crypto.randomUUID(),'Дата':now,'Тип':'stock',record_id:part_id,'Действие':field==='unit_cost'?'purchase_price_update':'price_update',actor_id:actor.id,'Детали':JSON.stringify({field,before:expected,after:value,source:remote?'workshop':'warehouse'}),updated_at:now}}];result={...part,[field]:value};
  }
  const committed=await db('rpc/workshop_native_commit','','POST',{p_actor:actor.id,p_action:action,p_request_id:request_id,p_fingerprint:fingerprint,p_version:snapshot.version,p_changes:changes,p_result:result});
  if(!committed.retry)return committed.result;
 }
 fail('Склад изменяется другим сотрудником. Повторите сохранение.',409);
}
