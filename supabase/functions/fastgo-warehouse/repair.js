import {createNativeEngine} from '../_shared/native-engine.js';
import {fail,id} from './model.js';

const cashActor=actor=>{
 if(!['owner','developer','seller'].includes(actor.role)&&actor.can_sell!==true)fail('Нет права принимать оплату',403);
};
export async function repairIdFromCode(value,key){
 if(typeof value!=='string'||value.length>2048)fail('Неверный QR-код ремонта');
 let url;try{url=new URL(value.trim());}catch{fail('Отсканируйте QR с бланка ремонта FastGo');}
 if(url.protocol!=='https:'||url.origin!=='https://ivankirillov414-art.github.io'||url.username||url.password)fail('Это не QR ремонта FastGo');
 if(url.pathname==='/fastgo-control/workshop.html'&&url.hash.startsWith('#order?')){
  const params=new URLSearchParams(url.hash.slice(7));
  if(params.get('kind')!=='repair'||params.getAll('id').length!==1||!id(params.get('id')))fail('Нужен QR именно ремонта');
  return params.get('id');
 }
 if(url.pathname==='/fastgo-control/repair-status.html'){
  const [repairId,signature,...rest]=url.hash.slice(1).split('.');
  if(rest.length||!id(repairId)||!/^[a-f0-9]{64}$/.test(signature||''))fail('Клиентский QR недействителен');
  const encoder=new TextEncoder(),signingKey=await crypto.subtle.importKey('raw',encoder.encode(key),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const valid=await crypto.subtle.verify('HMAC',signingKey,Uint8Array.from(signature.match(/../g),x=>parseInt(x,16)),encoder.encode('fastgo:customer-repair-status:v1:'+repairId));
  if(!valid)fail('Клиентский QR недействителен');
  return repairId;
 }
 fail('Это не QR ремонта FastGo');
}
export function repairQuote(snapshot,repairId,actor){
 cashActor(actor);if(!id(repairId))fail('Неверный ремонт');
 const raw=snapshot.sheets['Ремонты'].rows.find(r=>r.repair_id===repairId);
 if(!raw||['deleted','Удалён','Удален'].includes(raw['Статус']))fail('Ремонт не найден',404);
 const r=createNativeEngine(snapshot.sheets).run('get',{kind:'repair',id:repairId},{...actor,role:'manager'}).record;
 const total=Math.round(r.total_amount*100)/100,paid=Math.round(r.paid_amount*100)/100,due=Math.max(0,Math.round((total-paid)*100)/100);
 if(![total,paid,due].every(Number.isFinite)||total<0||paid<0)fail('Проверьте стоимость ремонта',409);
 const closed=['issued','cancelled','returned'].includes(r.status);
 return{id:r.id,number:String(r.repair_number).padStart(4,'0'),vehicle:[r.brand,r.model].filter(Boolean).join(' '),total,paid,due,status:r.status,revision:r.revision,payable:!closed&&due>0};
}
export function prepareRepairPayment(snapshot,p,actor){
 cashActor(actor);if(!id(p.request_id)||!['cash','card','transfer'].includes(p.method))fail('Выберите способ оплаты');
 const quote=repairQuote(snapshot,p.repair_id,actor);
 if(!quote.payable)fail(quote.due<=0?'Ремонт уже оплачен или сумма не назначена':'Ремонт закрыт',409);
 if(p.expected_revision!==quote.revision||p.amount!==quote.due)fail('Сумма или данные ремонта изменились. Обновите сумму и подтвердите оплату снова.',409);
 // Use the existing repair payment ledger. Integer cents avoid 0.1 + 0.2
 // rounding causing an overpayment or leaving a fractional debt.
 const now=new Date().toISOString(),paymentId=crypto.randomUUID(),note='Оплата по QR · склад · '+p.request_id;
 const row={payment_id:paymentId,'Дата':now,'Тип':'repair',record_id:quote.id,'Сумма':quote.due,'Способ оплаты':p.method,'Сотрудник':actor.email||actor.id,'Комментарий':note,request_id:p.request_id,updated_at:now};
 const event={event_id:crypto.randomUUID(),'Дата':now,'Тип':'repair',record_id:quote.id,'Действие':'payment',actor_id:actor.id,'Детали':JSON.stringify({amount:quote.due,note}),updated_at:now};
 const append=(sheet,values)=>({sheet,row:Math.max(1,...snapshot.sheets[sheet].rows.map(r=>r.__row))+1,values});
 const raw=snapshot.sheets['Ремонты'].rows.find(r=>r.repair_id===quote.id);
 return{changes:[append('Оплаты',row),{sheet:'Ремонты',row:raw.__row,values:{'Оплачено':quote.total,revision:quote.revision+1,updated_at:now}},append('События',event)],result:{id:paymentId,repair_id:quote.id,number:quote.number,amount:quote.due,method:p.method,remaining:0,created_at:now}};
}
