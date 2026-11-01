const reject=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const text=(value,max=200)=>{if(typeof value!=='string'||value.length>max)reject('Проверьте текст акта');return value.trim();};
const money=value=>{if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1e8||Math.abs(value*100-Math.round(value*100))>.00001)reject('Цена: неотрицательное число, до двух знаков после запятой');return value;};
const quantity=value=>{if(!Number.isSafeInteger(value)||value<1||value>100000)reject('Количество: целое число от 1 до 100000');return value;};
const parse=value=>{try{return JSON.parse(value||'{}');}catch{return {};}};
export function repairActDocument(events,id){
 let result={};for(const event of events.filter(e=>e['Тип']==='repair'&&e.record_id===id&&e['Действие']==='repair_act_edit').sort((a,b)=>Number(a.__row)-Number(b.__row))){const data=parse(event['Детали']);if(data.document&&typeof data.document==='object'&&!Array.isArray(data.document))result=data.document;}return result;
}
export function repairActOperation(p,actor,h){
 const uuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value||''));
 if(!uuid(p.id)||!uuid(p.request_id))reject('Неверный код ремонта или изменения акта');
 if(!['owner','developer','admin','receiver','manager','mechanic'].includes(actor.role))reject('Нет доступа к редактированию акта',403);
 const raw=h.rows('Ремонты').find(r=>r.repair_id===p.id);if(!raw)reject('Ремонт не найден',404);
 h.access(actor,'repair',raw);const revision=h.revision(raw,p),record=h.map(raw);
 if(!['ready','issued'].includes(record.status))reject('Акт можно редактировать после завершения ремонта',409);
 const reason=text(p.reason,500);if(!reason)reject('Укажите причину изменения акта');
 if(!Array.isArray(p.works)||!Array.isArray(p.parts)||p.works.length>50||p.parts.length>50)reject('Не более 50 работ и 50 запчастей');
 const line=x=>{if(!x||typeof x!=='object')reject('Проверьте строку акта');const name=text(x.name);if(!name)reject('Укажите наименование');return {name,quantity:quantity(x.quantity),price:money(x.price)};};
 const works=p.works.map(x=>({...line(x),...(typeof x.catalog_id==='string'?{catalog_id:x.catalog_id.slice(0,100)}:{})}));
 const oldParts=record.parts||[],seen=new Set();
 const parts=p.parts.map(x=>{
  const value=line(x),index=x.source_index;
  if(index===undefined||index===null)return value;
  if(!Number.isSafeInteger(index)||!oldParts[index]||seen.has(index))reject('Список запчастей изменился. Обновите акт',409);seen.add(index);
  const original=oldParts[index];
  if((original.part_id||original.id)&&value.quantity!==Number(original.quantity))reject('Количество выданной со склада детали меняется через выдачу или возврат на кассе',409);
  return {...original,...value};
 });
 if(oldParts.some((x,i)=>(x.part_id||x.id)&&!seen.has(i)))reject('Выданную со склада деталь удаляют через возврат на кассе',409);
 const document={};if(!p.document||typeof p.document!=='object'||Array.isArray(p.document))reject('Проверьте данные акта');
 for(const key of ['title','client_name','phone','vehicle','serial_number','master_name','date','intro','note','closing'])document[key]=text(p.document[key]??'',key==='note'?2000:500);
 if(document.date&&(!/^\d{4}-\d{2}-\d{2}$/.test(document.date)||!Number.isFinite(Date.parse(document.date+'T00:00:00Z'))||new Date(document.date+'T00:00:00Z').toISOString().slice(0,10)!==document.date))reject('Проверьте дату акта');
 const total=money(p.total_amount),paid=Number(record.paid_amount)||0;
 if(Math.round(total*100)<Math.round(paid*100))reject('Стоимость меньше уже внесённой оплаты. Сначала оформите возврат',409);
 const sum=items=>Math.round(items.reduce((n,x)=>n+x.quantity*x.price,0)*100)/100,worksTotal=sum(works),partsTotal=sum(parts);
 if(!Number.isFinite(worksTotal+partsTotal)||worksTotal+partsTotal>1e9)reject('Проверьте сумму строк акта');
 const status=record.status==='issued'&&total>paid+.005?'ready':record.status,now=h.now();
 h.patch('Ремонты',raw.__row,{'Работы':JSON.stringify(works),'Строки запчастей':JSON.stringify(parts),'Стоимость работ':worksTotal,'Запчасти':partsTotal,'Скидка':Math.max(0,Math.round((worksTotal+partsTotal-total)*100)/100),'Итого':total,'Статус':h.human(status,'repair'),'Согласовано, ₽':total,'Примечание согласования':'Корректировка акта: '+reason,updated_at:now,revision:revision+1});
 h.event('repair',p.id,'price',actor,{total_override:total,total,previous_total:record.total_amount,reason});
 if(status==='ready')h.event('repair',p.id,'repair_steps',actor,{...record.step_state,action:'act_edit',payment_qr:true,completion_request_id:p.request_id});
 h.event('repair',p.id,'repair_act_edit',actor,{reason,document,previous:{works:record.works,parts:oldParts,total:record.total_amount},total,from_status:record.status,to_status:status});
 return h.map(raw);
}
