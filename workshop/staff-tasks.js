import {api,esc,money,date} from './core.js';
import {equipmentData} from '../warehouse/equipment-data.js';
import {linkedEquipment,marketPrice,purchaseValue} from '../warehouse/equipment-reference-core.js';
const labels={parts:'Запчасти',equipment:'Техника',works:'Стоимость работ'};
const state=s=>({open:'Открыта',done:'Выполнена',cancelled:'Отменена'}[s]||s);
export async function renderStaffTasks(ctx,p,token){
 const admin=['developer','owner','admin'].includes(ctx.me.role);
 if(!p.id){
  const {items}=await api('staff_tasks',{}, {fresh:true});
  if(!ctx.mount(ctx.head('Задачи','',admin?'<button class="btn" id="task-create">Назначить задачу</button>':'')+`<section class="panel">${items.length?items.map(t=>`<a class="task-link" href="#task?id=${esc(t.id)}"><b>${esc(t.title)}</b><span>${state(t.status)} · ${date(t.created_at)}</span></a>`).join(''):'Пока нет задач.'}</section>`,token))return;
  document.getElementById('task-create')?.addEventListener('click',async()=>{
   try{const c=await ctx.catalog(true),staff=c.staff.filter(s=>s.active);ctx.modal('Новая задача',`<div class="field"><label for="task-assignee">Сотрудник</label><select id="task-assignee" name="assignee_id" required>${staff.map(s=>`<option value="${esc(s.profile_id)}">${esc(s.name)}</option>`).join('')}</select></div>`+ctx.field('title','Задача','Проверить цены в справочниках','text',true)+`<div class="field"><label for="task-description">Что нужно сделать</label><textarea id="task-description" name="description" required>Укажите актуальные цены запчастей и техники, проверьте стоимость работ.</textarea></div><p>Разделы: запчасти, техника, стоимость работ.</p>`,async v=>{const t=await api('staff_task_create',{...v,scopes:['parts','equipment','works']});ctx.go('task',{id:t.id});});}catch(e){ctx.toast(e.message);}
  });return;
 }
 let task=await api('staff_task_get',{id:p.id},{fresh:true});
 const c=await api('staff_price_catalog',{task_id:task.id},{fresh:true});
 await api('staff_notice_open',{id:task.id}).catch(()=>{});
 const scopes=['parts','equipment','works'].filter(s=>task.scopes.includes(s));
 let scope=scopes.includes(p.scope)?p.scope:scopes[0],search='',offset=0;const size=20;
 const content=()=>ctx.head(esc(task.title),'','<a class="btn ghost small" href="#tasks">К задачам</a>')+`<section class="panel task-summary"><p>${esc(task.description)}</p><div class="actions"><span id="task-state">${state(task.status)}</span><span id="task-progress">${task.reviewed_scopes.length} / ${task.scopes.length} проверено</span></div></section><nav class="task-scopes" aria-label="Справочники">${scopes.map(s=>`<button class="btn secondary" data-scope="${s}">${labels[s]}</button>`).join('')}</nav><section class="panel"><div class="field"><label for="task-search">Поиск по справочнику</label><input id="task-search" type="search" placeholder="Название, модель или артикул"></div><div id="task-toolbar" class="actions"></div><div id="task-prices"></div><div class="pagination"><span id="task-range"></span><div class="actions"><button class="btn ghost small" id="task-prev">Назад</button><button class="btn ghost small" id="task-next">Далее</button></div></div><div class="actions"><button class="btn secondary" id="scope-reviewed">Цены раздела проверены</button><button class="btn" id="task-done">Завершить задачу</button></div><p id="task-feedback" role="status" aria-live="polite"></p></section>`;
 if(!ctx.mount('<style>.task-link{display:flex;flex-direction:column;gap:6px;padding:16px 0;border-bottom:1px solid #29455b;color:inherit;text-decoration:none}.task-link span{color:#9bb2c8}.task-scopes{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.task-scopes [aria-current=true]{border-color:#48d7f0;color:#48d7f0}.task-price-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 0;border-bottom:1px solid #29455b}.task-price-row>div{min-width:0;overflow-wrap:anywhere}.task-price-row small{display:block;color:#9bb2c8;margin-top:4px}.task-price-row button{flex-shrink:0}.task-summary p{white-space:pre-wrap}@media(max-width:400px){.task-price-row{align-items:flex-start}.task-price-row .btn{padding:8px}.task-scopes .btn{flex:1;padding:10px 6px}}</style>'+content(),token))return;
 const $=id=>document.getElementById(id),feedback=s=>{$('task-feedback').textContent=s;};
 function all(){if(scope==='works')return c.services;return scope==='parts'?c.parts.filter(x=>!String(x.category||'').startsWith('Техника')):equipmentData.items;}
 function current(){const words=search.toLowerCase().replace(/ё/g,'е').split(/\s+/).filter(Boolean);return all().filter(x=>words.every(w=>[x.name||x.title,x.model,x.sku,x.category].join(' ').toLowerCase().replace(/ё/g,'е').includes(w)));}
 function draw(){
  const filtered=current();offset=Math.max(0,Math.min(offset,Math.max(0,Math.ceil(filtered.length/size)-1)*size));
  document.querySelectorAll('[data-scope]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.scope===scope)));
  $('task-toolbar').innerHTML=scope==='works'&&task.status==='open'?'<button class="btn ghost small" id="task-add-work">Добавить работу</button>':'';
  $('task-add-work')?.addEventListener('click',()=>edit(null));
  $('task-prices').innerHTML=filtered.slice(offset,offset+size).map(x=>{let text;if(scope==='equipment'){const part=linkedEquipment(x,c.parts),record=c.equipment_prices.find(r=>r.id===x.id);text='Рыночная: '+(marketPrice(x,record).value===null?'не указана':money(marketPrice(x,record).value))+' · Закупка: '+(part?money(part.unit_cost):'не указана');}else text=scope==='works'?money(x.labor_price):'Продажа: '+money(x.retail_price)+' · Закупка: '+money(x.unit_cost);return `<article class="task-price-row"><div><b>${esc(x.name||x.title)}</b><small>${esc(x.category||'')}${x.sku?' · '+esc(x.sku):''}</small><small>${text}</small></div>${task.status==='open'?`<button class="btn ghost small" data-edit-price="${esc(x.id)}" aria-label="Изменить цену: ${esc(x.name||x.title)}">Изменить</button>`:''}</article>`;}).join('')||'<p>Ничего не найдено.</p>';
  document.querySelectorAll('[data-edit-price]').forEach(b=>b.onclick=()=>edit(all().find(x=>x.id===b.dataset.editPrice)));
  $('task-range').textContent=filtered.length?`${offset+1}–${Math.min(offset+size,filtered.length)} из ${filtered.length}`:'0 позиций';$('task-prev').disabled=offset===0;$('task-next').disabled=offset+size>=filtered.length;
  $('scope-reviewed').disabled=task.status!=='open'||task.reviewed_scopes.includes(scope);$('scope-reviewed').textContent=task.reviewed_scopes.includes(scope)?'Раздел проверен':'Цены раздела проверены';$('task-done').disabled=task.status!=='open'||!task.scopes.every(s=>task.reviewed_scopes.includes(s));
  $('task-progress').textContent=`${task.reviewed_scopes.length} / ${task.scopes.length} проверено`;$('task-state').textContent=state(task.status);
 }
 function edit(x){
  const selected=scope,part=x&&selected==='equipment'?linkedEquipment(x,c.parts):x,record=x&&c.equipment_prices.find(r=>r.id===x.id),id=x?.id||crypto.randomUUID();
  const expected=selected==='parts'?{unit_cost:x.unit_cost,retail_price:x.retail_price}:selected==='works'?{labor_price:x?.labor_price||0}:{part_id:part?.id||null,unit_cost:part?.unit_cost||0,revision:record?.revision||0};
  let fields=!x?ctx.field('title','Название работы','','text',true)+ctx.field('category','Раздел','Ремонтные работы','text',true):`<p><b>${esc(x.name||x.title)}</b></p>`;
  if(selected==='works')fields+=ctx.field('labor_price','Стоимость работы, ₽',x?.labor_price||0,'text',true);
  else{fields+=ctx.field('unit_cost','Закупочная цена, ₽',part?.unit_cost??'','text',true);fields+=selected==='parts'?ctx.field('retail_price','Цена продажи, ₽',x.retail_price,'text',true):ctx.field('market_price','Рыночная цена, ₽',record?.market_price??x.price_min??'','text',false);}
  ctx.modal(x?'Изменить цены':'Добавить работу',fields,async v=>{
   const values={};for(const k of selected==='works'?['labor_price']:selected==='parts'?['unit_cost','retail_price']:['unit_cost','market_price'])values[k]=k==='market_price'&&!v[k].trim()?null:purchaseValue(v[k]);
   await api('staff_price_save',{task_id:task.id,scope:selected,id,values,expected,...(!x?{create:true,title:v.title,category:v.category}:{})});
   const fresh=await api('staff_price_catalog',{task_id:task.id},{fresh:true});Object.assign(c,fresh);feedback('Сохранено');draw();
  });
  document.querySelectorAll('#modal-form input[name$="price"],#modal-form input[name="unit_cost"]').forEach(i=>{i.inputMode='decimal';});
 }
 document.querySelectorAll('[data-scope]').forEach(b=>b.onclick=()=>{scope=b.dataset.scope;offset=0;search='';$('task-search').value='';feedback('');draw();});
 $('task-search').oninput=e=>{search=e.target.value;offset=0;draw();};$('task-prev').onclick=()=>{offset-=size;draw();};$('task-next').onclick=()=>{offset+=size;draw();};
 async function update(button,done){await ctx.run(button,async()=>{try{task=await api('staff_task_update',{id:task.id,revision:task.revision,reviewed_scopes:done?task.reviewed_scopes:[...new Set([...task.reviewed_scopes,scope])],status:done?'done':'open'});feedback(done?'Задача выполнена':'Проверка раздела отмечена');draw();}catch(e){task=await api('staff_task_get',{id:task.id},{fresh:true});draw();throw e;}});}
 $('scope-reviewed').onclick=e=>update(e.currentTarget,false);$('task-done').onclick=e=>update(e.currentTarget,true);draw();
}
