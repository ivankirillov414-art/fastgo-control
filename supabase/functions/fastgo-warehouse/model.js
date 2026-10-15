import {createNativeEngine} from '../_shared/native-engine.js';
export {masterHoldings} from '../_shared/warehouse-holdings.js';
export const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
export const id=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function items(value){if(!Array.isArray(value)||!value.length||value.length>40)fail('От 1 до 40 позиций');const merged=new Map();for(const x of value){if(!id(x.part_id)||!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>1000)fail('Проверьте товар и количество');const q=(merged.get(x.part_id)?.quantity||0)+x.quantity;if(q>1000)fail('Слишком большое количество');merged.set(x.part_id,{part_id:x.part_id,quantity:q});}return [...merged.values()];}
export function masterIssue(snapshot,p,actor,{uuid=()=>crypto.randomUUID(),now=()=>new Date().toISOString()}={}){
 if(!['owner','developer','seller'].includes(actor.role)&&actor.can_sell!==true)fail('Нет права выдавать запчасти',403);
 const rows=snapshot.sheets['Сотрудники'].rows,master=rows.find(x=>x.employee_id===p.master_id&&x['Активен']!==false&&['mechanic','Механик','Мастер'].includes(x['Роль']));if(!master)fail('Выберите активного мастера');
 const normalized=items(p.items),engine=createNativeEngine(snapshot.sheets,{uuid,now}),list=[];
 // The wrapper grants exactly stock issue after checking cash permission, not arbitrary manager actions.
 for(const x of normalized){const product=engine.sheets['Товары'].rows.find(r=>r.product_id===x.part_id&&r['Активен']!==false);if(!product)fail('Запчасть не найдена');engine.run('stock',{...x,movement_type:'issue',note:'Выдано мастеру '+master['ФИО']+' · 0 ₽',reference_id:p.request_id,request_id:p.request_id+':'+x.part_id},{...actor,role:'manager'});list.push({...x,name:product['Модель / название'],unit_cost:Number(product['Цена закупки, ₽'])||0,retail_price:Number(product['Цена продажи, ₽'])||0});}
 const result={id:p.request_id,master_id:p.master_id,master_name:master['ФИО'],amount:0,items:list},events=engine.sheets['События'],row=Math.max(1,...events.rows.map(x=>x.__row))+1;
 const event={event_id:uuid(),'Дата':now(),'Тип':'warehouse',record_id:p.request_id,'Действие':'warehouse_master_issue',actor_id:actor.id,'Детали':JSON.stringify(result)};
 for(const key of Object.keys(event))if(!events.headers.includes(key))fail('Схема журнала не поддерживается',503);
 return {result,changes:[...engine.changes(),{sheet:'События',row,values:event}]};
}
