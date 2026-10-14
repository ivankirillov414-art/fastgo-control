export const defaults={stale_days:3,long_days:14,coverage_days:7,rates:{}};
const num=x=>Number(x)||0;
const parse=x=>{try{return Array.isArray(x)?x:JSON.parse(x||'[]');}catch{return [];}};
const key=x=>String(x||'').toLowerCase().replace(/[^а-яёa-z0-9]/g,'');
const phone=x=>String(x||'').replace(/\D/g,'').replace(/^8(?=\d{10}$)/,'7');
const day=x=>String(x||'').slice(0,10);
export function records(sheets){
 const rows=name=>sheets[name]?.rows||[],intakes=new Map(rows('Приёмки').map(x=>[x.intake_id,x]));
 const repairs=rows('Ремонты').filter(x=>!['deleted','Удалён','Удален'].includes(x['Статус'])).map(x=>{const i=intakes.get(x.intake_id)||{};return {kind:'repair',id:x.repair_id,number:x['Номер ремонта'],status:x['Статус'],client:i['Клиент']||'',phone:i['Телефон']||'',vehicle:i['Бренд / модель']||'',serial:i['Серийный номер']||'',created:x['Создано'],updated:x.updated_at||x['Создано'],promised:x['Плановая дата']||i['Плановая дата']||'',issued:x['Выдано']||'',master_id:x.master_id||'',master:x['Мастер']||'',issue:i['Описание неисправности']||'',works:parse(x['Работы']),parts:parse(x['Строки запчастей']),total:num(x['Итого']),paid:num(x['Оплачено']),discount:num(x['Скидка'])};});
 const storage=rows('Зимнее хранение').filter(x=>!['deleted','Удалён','Удален'].includes(x['Статус'])).map(x=>{const i=intakes.get(x.intake_id)||{};return {kind:'storage',id:x.storage_id,number:x['Номер'],status:x['Статус'],client:i['Клиент']||x['Клиент']||'',phone:i['Телефон']||x['Телефон']||'',vehicle:i['Бренд / модель']||x['Техника']||'',serial:i['Серийный номер']||'',created:x['Создано'],updated:x.updated_at||x['Создано'],promised:'',issued:x['Выдано']||'',master_id:'',master:'',issue:'Зимнее хранение',works:[],parts:[],total:num(x['Сумма']),paid:num(x['Оплачено']),discount:0};});
 return [...repairs,...storage];
}
const closed=r=>['Выдан','Отменён','Отменено','issued','cancelled'].includes(r.status);
export function alerts(items,config={},now=Date.now()){
 const c={...defaults,...config},today=new Date(now+5*3600000).toISOString().slice(0,10),days=date=>Math.max(0,Math.floor((now-Date.parse(date))/86400000)||0);
 return items.filter(r=>r.kind!=='storage'&&!closed(r)).flatMap(r=>{const reasons=[];const age=days(r.created),idle=days(r.updated);if(r.promised&&day(r.promised)<today&&!['Готов','Готово','ready'].includes(r.status))reasons.push('Просрочен срок готовности');if(idle>=c.stale_days)reasons.push('Без изменений '+idle+' дн.');if(age>=c.long_days)reasons.push('В мастерской '+age+' дн.');return reasons.length?[{id:r.id,number:r.number,vehicle:r.vehicle,status:r.status,reasons,priority:r.promised&&day(r.promised)<today?0:1,age,idle}]:[];}).sort((a,b)=>a.priority-b.priority||b.age-a.age);
}
export function history(items,p){
 if(p.phone){const q=phone(p.phone);if(q.length<10)throw Error('Введите полный телефон клиента');return items.filter(r=>phone(r.phone)===q);}
 const serial=key(p.serial);if(!serial||['неуказан','неуказано'].includes(serial))throw Error('Укажите серийный номер техники');return items.filter(r=>key(r.serial)===serial);
}
export function analytics(sheets,p,config={}){
 const c={...defaults,...config},all=records(sheets).filter(r=>r.kind==='repair'),start=String(p.from||''),end=String(p.to||'');
 const inRange=date=>day(date)>=start&&day(date)<=end;
 const rows=name=>sheets[name]?.rows||[],movements=rows('Движения склада'),products=rows('Товары');
 const done=all.filter(r=>['Выдан','issued'].includes(r.status)&&r.issued&&inRange(r.issued));
 const repairCosts=new Map();
 for(const m of movements){const sign=['Расход','Продажа','issue'].includes(m['Тип'])?1:['Возврат','return'].includes(m['Тип'])?-1:0;if(!sign)continue;const id=m.reference_id;repairCosts.set(id,(repairCosts.get(id)||0)+sign*num(m['Количество'])*num(m['Цена закупки']));}
 const details=done.map(r=>{const grossWorks=r.works.reduce((n,x)=>n+num(x.price)*(num(x.quantity)||1),0),grossParts=r.parts.reduce((n,x)=>n+num(x.price)*(num(x.quantity)||1),0),factor=grossWorks+grossParts?Math.max(0,1-r.discount/(grossWorks+grossParts)):1,labor=Math.round(grossWorks*factor*100)/100;const missingParts=r.parts.filter(x=>x.part_id?!movements.some(m=>m.reference_id===r.id&&m.product_id===x.part_id&&m['Цена закупки']!==''&&m['Цена закупки']!=null):x.unit_cost==null).length;const cost=Math.max(0,repairCosts.get(r.id)||0)+r.parts.filter(x=>!x.part_id&&x.unit_cost!=null).reduce((s,x)=>s+num(x.unit_cost)*(num(x.quantity)||1),0);const rate=c.rates?.[r.master_id],wage=rate===undefined?null:Math.round(labor*num(rate))/100;return {id:r.id,number:r.number,vehicle:r.vehicle,date:day(r.issued),month:day(r.issued).slice(0,7),master_id:r.master_id,master:r.master||'Не назначен',revenue:r.total,labor,parts_revenue:Math.round(grossParts*factor*100)/100,cost,missing_cost:missingParts,wage,margin:missingParts||wage===null?null:r.total-cost-wage};});
 const aggregate=field=>{const groups=new Map();for(const r of details){const id=r[field];let g=groups.get(id);if(!g){g={label:id,count:0,revenue:0,labor:0,cost:0,wage:0,missing_cost:0,missing_wage:0};groups.set(id,g);}g.count++;for(const k of ['revenue','labor','cost','missing_cost'])g[k]+=r[k];if(r.wage===null)g.missing_wage++;else g.wage+=r.wage;}return [...groups.values()].sort((a,b)=>a.label.localeCompare(b.label));};
 const now=Number(p.now)||Date.now(),weekStart=now-7*86400000,usage=new Map();
 for(const m of movements){if(Date.parse(m['Дата'])<weekStart||Date.parse(m['Дата'])>now||!Number.isFinite(Date.parse(m['Дата'])))continue;const sign=['Расход','Продажа','issue'].includes(m['Тип'])?1:['Возврат','return'].includes(m['Тип'])?-1:0;if(sign)usage.set(m.product_id,(usage.get(m.product_id)||0)+sign*num(m['Количество']));}
 const purchases=products.filter(x=>x['Активен']!==false).map(x=>{const used=Math.max(0,usage.get(x.product_id)||0),stock=num(x['Остаток, шт.']),recommended=Math.max(0,Math.ceil(used*c.coverage_days/7)-stock);return {id:x.product_id,name:x['Модель / название'],sku:x['Артикул / SKU']||'',used,stock,recommended};}).filter(x=>x.used>0||x.recommended>0).sort((a,b)=>b.recommended-a.recommended||b.used-a.used);
 const totals=details.reduce((t,r)=>{for(const k of ['revenue','labor','cost','missing_cost'])t[k]+=r[k];if(r.wage===null)t.missing_wage++;else t.wage+=r.wage;return t;},{revenue:0,labor:0,cost:0,wage:0,missing_cost:0,missing_wage:0});
 return {details,days:aggregate('date'),months:aggregate('month'),employees:aggregate('master'),totals,purchases,coverage_days:c.coverage_days,staff:rows('Сотрудники').map(x=>({id:x.employee_id,name:x['ФИО']})).filter(x=>x.id)};
}
