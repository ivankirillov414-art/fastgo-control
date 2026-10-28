import {fail} from './model.js';
// Read one consistent snapshot. A service payment also has a sale row;
// prefer the payment journal so that money is counted exactly once.
export function finalReport(sheets,p={}){
 const rows=name=>sheets[name]?.rows||[],methods={cash:'cash',card:'card',transfer:'transfer','Наличные':'cash','Карта':'card','Банковская карта':'card','Безналичный расчёт':'card','Перевод':'transfer'};
 const boundary=value=>{if(!value)return null;const n=Date.parse(value);if(!Number.isFinite(n))fail('Проверьте даты отчёта');return n;};
 const from=boundary(p.from),to=boundary(p.to);if(from!==null&&to!==null&&from>=to)fail('Начало периода должно быть раньше окончания');
 if(p.method&&!['cash','card','transfer'].includes(p.method))fail('Неизвестный способ оплаты');
 const offset=p.offset??0;if(!Number.isSafeInteger(offset)||offset<0)fail('Неверная страница отчёта');
 const repairs=new Map(rows('Ремонты').map(r=>[r.repair_id,r['Номер ремонта']])),storage=new Map(rows('Зимнее хранение').map(r=>[r.storage_id,r['Номер']])),sales=rows('Продажи'),payments=rows('Оплаты').filter(r=>r.payment_id),serviceIds=new Set(payments.filter(r=>r['Тип']==='service').map(r=>r.record_id));
 const operations=[...payments.map(r=>({id:'payment:'+r.payment_id,created_at:r['Дата'],method:methods[r['Способ оплаты']],amount:Number(r['Сумма']),title:r['Тип']==='repair'?'Ремонт № '+(repairs.get(r.record_id)||r.record_id):r['Тип']==='storage'?'Хранение № '+(storage.get(r.record_id)||r.record_id):r['Тип']==='service'?'Ручная оплата работ':'Оплата',note:r['Комментарий']||'',actor:r['Сотрудник']||''})),...sales.filter(r=>r.sale_id&&!serviceIds.has(r.sale_id)).map(r=>({id:'sale:'+r.sale_id,created_at:r['Дата'],method:methods[r['Способ оплаты']],amount:Number(r['Итого']),title:'Продажа '+(r['Номер']||''),note:r['Комментарий']||'',actor:r['Сотрудник']||''}))].filter(r=>{const t=Date.parse(r.created_at);return (from===null||t>=from)&&(to===null||t<to);});
 const seen=new Set(),groups=Object.fromEntries(['cash','transfer','card'].map(m=>[m,{method:m,total:0,count:0,items:[],offset:p.method===m?offset:0,limit:100}]));
 operations.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))||a.id.localeCompare(b.id));
 for(const item of operations){if(seen.has(item.id))continue;seen.add(item.id);const group=groups[item.method];if(!group||!Number.isFinite(item.amount))fail('В журнале есть операция с неизвестным способом оплаты или суммой',503);group.total+=Math.round(item.amount*100);group.count++;if((!p.method||p.method===item.method)&&group.count>group.offset&&group.items.length<group.limit)group.items.push(item);}
 for(const g of Object.values(groups))g.total/=100;
 return {groups:Object.values(groups),total:Object.values(groups).reduce((s,g)=>s+Math.round(g.total*100),0)/100,count:seen.size,generated_at:new Date().toISOString()};
}
