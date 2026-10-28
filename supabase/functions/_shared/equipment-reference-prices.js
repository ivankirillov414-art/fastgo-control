// Reference estimates are independent of stock, purchase cost and sale prices.
// Every revision uses the existing atomic business journal and backup replicas.
const readers=new Set(['developer','owner','admin','receiver','manager','seller']);
const editors=new Set(['developer','owner','admin']);
const referenceId=value=>/^eq-[a-f0-9]{20}$/.test(String(value||''));
const uuid=value=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(value||''));
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
function records(sheets){
 const latest=new Map();
 for(const event of sheets['События']?.rows||[]){
  if(event['Тип']!=='equipment_reference_price')continue;
  let record;try{record=JSON.parse(event['Детали']).record;}catch{continue;}
  if(!record||!referenceId(record.id)||event.record_id!==record.id||!Number.isSafeInteger(record.revision)||record.revision<1)continue;
  if(!latest.has(record.id)||latest.get(record.id).revision<record.revision)latest.set(record.id,record);
 }
 return latest;
}
export function equipmentReferencePrices(sheets,action,p={},actor,{uuid:makeId,now}={}){
 if(!readers.has(actor?.role))fail('Справочник техники недоступен этой роли',403);
 const latest=records(sheets);
 if(action==='equipment_market_prices')return {result:{items:[...latest.values()].sort((a,b)=>a.id.localeCompare(b.id)),schema:1}};
 if(action!=='equipment_market_price_save')fail('Неизвестная операция справочника');
 if(!editors.has(actor?.role))fail('Нет права изменять рыночную цену',403);
 if(!referenceId(p.id)||!uuid(p.request_id))fail('Неверный код модели или операции');
 if(!Number.isSafeInteger(p.revision)||p.revision<0)fail('Откройте актуальную карточку модели');
 const old=latest.get(p.id);
 if(p.revision!==(old?.revision||0))fail('Рыночная цена уже изменена другим сотрудником. Откройте карточку заново.',409);
 const value=p.market_price;
 if(value!==null&&(typeof value!=='number'||!Number.isFinite(value)||value<0||value>100000000||Math.abs(value*100-Math.round(value*100))>0.00001))fail('Укажите рыночную цену от 0 до 100 000 000 ₽ с точностью до копеек');
 const at=now(),record={id:p.id,market_price:value===null?null:Math.round(value*100)/100,revision:(old?.revision||0)+1,updated_at:at,updated_by:actor.id};
 return {result:record,event:{event_id:makeId(),'Дата':at,'Тип':'equipment_reference_price',record_id:record.id,'Действие':value===null?'equipment_market_price_reset':'equipment_market_price_update',actor_id:actor.id,'Детали':JSON.stringify({actor_name:actor.name||'',record}),updated_at:at}};
}
