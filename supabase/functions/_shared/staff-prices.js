import {equipmentReferencePrices,equipmentPriceRecords} from './equipment-reference-prices.js';
import {staffEquipment} from './staff-equipment-data.js';
const admins=new Set(['developer','owner','admin']);
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const price=v=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e8||Math.abs(v*100-Math.round(v*100))>0.00001)fail('Укажите цену от 0 до 100 000 000 ₽ с точностью до копеек');return Math.round(v*100)/100;};
const norm=v=>String(v||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/g,'');
export function staffPriceOperation(action,p,actor,{rows,patch,partSave,catalogSave,addEvent,sheets,uuid,now}){
 const task=actor.price_task;
 if(!task||task.id!==p.task_id||task.status!=='open'&&action==='staff_price_save'||task.assignee_id!==actor.id&&!admins.has(actor.role))fail('Задача не даёт права изменять цены',403);
 const products=rows('Товары'),services=rows('Прайс работ');
 const product=r=>({id:r.product_id,name:r['Модель / название'],sku:r['Артикул / SKU'],model:r['Модель'],category:r['Категория'],active:r['Активен']!==false,unit_cost:Number(r['Цена закупки, ₽'])||0,retail_price:Number(r['Цена продажи, ₽'])||0});
 const referenceRecords=()=>equipmentPriceRecords(sheets);
 if(action==='staff_price_catalog')return {parts:task.scopes.some(s=>['parts','equipment'].includes(s))?products.filter(r=>r['Активен']!==false).map(product):[],services:task.scopes.includes('works')?services.filter(r=>r['Активна']!==false).map(r=>({id:r.service_id,title:r['Работа'],category:r['Категория'],labor_price:Number(r['Работа, ₽'])||0})):[],equipment_prices:task.scopes.includes('equipment')?referenceRecords():[]};
 if(action!=='staff_price_save'||!task.scopes.includes(p.scope))fail('Этот справочник не включён в задачу',403);
 if(!p.values||!p.expected||Array.isArray(p.values)||Object.keys(p.values).length===0)fail('Нет новых цен');
 const changes={};let result;
 function updateProduct(r,allowed){
  if(!r||r['Активен']===false)fail('Товар не найден',404);
  const obj={};for(const [key,value] of Object.entries(p.values)){if(!allowed.includes(key))fail('Можно менять только цены',403);const column={unit_cost:'Цена закупки, ₽',retail_price:'Цена продажи, ₽'}[key];if(typeof p.expected[key]!=='number'||p.expected[key]!==Number(r[column]||0))fail('Цена уже изменена. Откройте позицию заново.',409);obj[column]=price(value);changes[key]={before:Number(r[column]||0),after:obj[column]};}
  patch('Товары',r.__row,{...obj,updated_at:now()});return product(r);
 }
 if(p.scope==='parts'){
  const r=products.find(x=>x.product_id===p.id);if(String(r?.['Категория']||'').startsWith('Техника'))fail('Откройте справочник техники');
  result=updateProduct(r,['unit_cost','retail_price']);
 }else if(p.scope==='works'){
  if(Object.keys(p.values).some(k=>k!=='labor_price'))fail('Можно менять только стоимость работы',403);
  const value=price(p.values.labor_price),r=services.find(x=>x.service_id===p.id);
  if(p.create===true){if(r)fail('Работа уже существует',409);if(!/^[a-f0-9-]{36}$/i.test(p.id)||!String(p.title||'').trim()||String(p.title).length>200)fail('Укажите название работы');result=catalogSave({id:p.id,title:p.title,category:String(p.category||'Ремонтные работы').slice(0,100),labor_price:value,create:true});}
  else{if(!r||r['Активна']===false)fail('Работа не найдена',404);if(p.expected.labor_price!==Number(r['Работа, ₽']||0))fail('Стоимость работы уже изменена. Откройте её заново.',409);result=catalogSave({id:p.id,title:r['Работа'],category:r['Категория'],labor_price:value,expected_price:p.expected.labor_price,expected_title:r['Работа']});}
  changes.labor_price={before:r?Number(p.expected.labor_price):null,after:value};
 }else if(p.scope==='equipment'){
  const item=staffEquipment.find(x=>x.id===p.id);if(!item)fail('Модель не найдена',404);
  if(Object.keys(p.values).some(k=>!['unit_cost','market_price'].includes(k)))fail('Можно менять только цены',403);
  const linked=products.filter(r=>r['Активен']!==false&&String(r['Артикул / SKU']||'').toUpperCase()===('REF-'+item.id).toUpperCase());
  const matches=linked.length?linked:products.filter(r=>r['Активен']!==false&&String(r['Категория']||'').startsWith('Техника')&&(norm(r['Модель / название'])===norm(item.name)||norm([r['Модель / название'],r['Модель']].join(' '))===norm(item.name)||(norm(r['Модель / название'])===norm(item.brand)&&norm(r['Модель'])===norm(item.model))));
  if(matches.length>1)fail('У модели несколько карточек. Руководителю нужно объединить дубли.',409);
  let part=matches[0];if((p.expected.part_id||null)!==(part?.product_id||null))fail('Карточка модели изменилась. Откройте её заново.',409);
  if('unit_cost' in p.values){const value=price(p.values.unit_cost);if(p.expected.unit_cost!==Number(part?.['Цена закупки, ₽']||0))fail('Закупочная цена уже изменена. Откройте модель заново.',409);changes.unit_cost={before:part?Number(part['Цена закупки, ₽']||0):null,after:value};if(part)patch('Товары',part.__row,{'Цена закупки, ₽':value,updated_at:now()});else{const created=partSave({name:item.name,model:item.model,sku:'REF-'+item.id,category:'Техника · '+item.category,unit:'шт.',unit_cost:value,retail_price:0},actor);part=products.find(r=>r.product_id===created.id);}}
  let record=referenceRecords().find(x=>x.id===item.id);
  if('market_price' in p.values){const value=p.values.market_price===null?null:price(p.values.market_price);const prepared=equipmentReferencePrices(sheets,'equipment_market_price_save',{id:item.id,revision:p.expected.revision,market_price:value,request_id:p.request_id},actor,{uuid,now});changes.market_price={before:record?.market_price??null,after:value};const e=prepared.event;addEvent('equipment_reference_price',item.id,e['Действие'],actor,JSON.parse(e['Детали']));record=prepared.result;}
  result={part:part?product(part):null,record:record||null};
 }else fail('Неизвестный справочник');
 addEvent('staff_price_task',task.id,'price_saved',actor,{task_id:task.id,scope:p.scope,item_id:p.id,changes,request_id:p.request_id});
 return {task_id:task.id,scope:p.scope,item_id:p.id,item:result};
}
