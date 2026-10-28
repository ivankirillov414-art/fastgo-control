import {equipmentData} from './equipment-data.js';
import {linkedEquipment,purchaseOperation,purchaseValue,selectEquipment,marketPrice,marketOperation} from './equipment-reference-core.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const money=v=>Number(v).toLocaleString('ru-RU',{maximumFractionDigits:2})+' ₽';
const uuid=()=>crypto.randomUUID?crypto.randomUUID():'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(Number(c)^crypto.getRandomValues(new Uint8Array(1))[0]&15>>Number(c)/4).toString(16));
const electric=x=>x.electric===true||['Электросамокаты','Электровелосипеды','Электромопеды','Электроскутеры','Электромотоциклы','Электротрициклы','Грузовые электротрициклы','Пассажирские электротрициклы','Электроквадроциклы','Электромобили','Электроскейты','Электробеговелы','Моноколёса','Моноколеса','Гироскутеры','Сигвеи','Другой электротранспорт'].includes(x.category);
export function mountEquipmentReference({root,call,editor=false,actor='',stockLink='',setDirty=()=>{}}){
 const items=equipmentData.items.filter(electric),byId=new Map(items.map(x=>[x.id,x]));
 let parts=[],loaded=false,marketLoaded=false,page=0,disposed=false,pending=null,saving=false,selected=null,formField='';
 let prices=new Map(),links=new Map();
 const storageKey='fastgo-equipment-purchase-v1:'+actor,cacheKey='fastgo-equipment-market-cache-v1:'+actor;
 try{pending=JSON.parse(localStorage.getItem(storageKey)||'null');}catch{}
 try{const cache=JSON.parse(localStorage.getItem(cacheKey)||'null');if(Array.isArray(cache))prices=new Map(cache.map(x=>[x.id,x]));}catch{}
 const $=s=>root.querySelector(s),options=values=>values.map(v=>`<option>${esc(v)}</option>`).join('');
 const partFor=item=>{if(!links.has(item.id))links.set(item.id,linkedEquipment(item,parts));return links.get(item.id);};
 const dirty=()=>!!(pending||saving||formField);
 root.classList.add('equipment-reference');window.fastgoEquipmentDirty=()=>root.isConnected&&dirty();
 root.innerHTML=`<div class="eq-heading"><h1>Электротранспорт</h1>${stockLink?`<a class="btn secondary" href="${esc(stockLink)}">Моя техника на складе</a>`:''}</div><p class="eq-note">${items.length.toLocaleString('ru-RU')} моделей · фото и характеристики из каталогов производителей и поставщиков.<br>Нажмите на модель, чтобы открыть карточку. Рыночную оценку и закупочную цену можно изменить в FastGo.</p><div class="eq-filters"><label>Поиск<input type="search" data-search placeholder="Марка или модель" autocomplete="off"></label><label>Категория<select data-category><option value="">Весь электротранспорт</option>${options([...new Set(items.map(x=>x.category))].sort((a,b)=>a.localeCompare(b,'ru')))}</select></label><label>Марка<select data-brand><option value="">Все марки</option>${options([...new Set(items.map(x=>x.brand))].sort((a,b)=>a.localeCompare(b,'ru')))}</select></label><label><input type="checkbox" data-stock> Только на моём складе</label></div><p data-status role="status" aria-live="polite">Загружаем сохранённые цены…</p><div data-editor></div><div data-list></div><div class="eq-pages"><button type="button" data-prev>← Назад</button><span data-count></span><button type="button" data-next>Далее →</button></div><dialog class="eq-dialog" data-detail aria-labelledby="eq-detail-title"></dialog>`;
 const dialog=$('[data-detail]'),isOpen=()=>dialog.open||dialog.hasAttribute('open');
 const status=(text,error=false)=>{if(disposed)return;$('[data-status]').textContent=text;$('[data-status]').classList.toggle('eq-error',error);const notice=dialog.querySelector('[data-detail-status]');if(notice){notice.textContent=text;notice.classList.toggle('eq-error',error);}};
 function close(){if(isOpen()){if(typeof dialog.close==='function')dialog.close();else{dialog.removeAttribute('open');dialog.classList.remove('eq-dialog-fallback');closed();}}}
 function closed(){formField='';selected=null;dialog.innerHTML='';setDirty(dirty());if(pending&&!disposed)retryForm();}
 dialog.addEventListener('close',closed);
 dialog.addEventListener('cancel',()=>{formField='';setDirty(!!pending);});
 dialog.addEventListener('keydown',e=>{if(e.key==='Escape'&&dialog.classList.contains('eq-dialog-fallback')){e.preventDefault();close();}if(e.key==='Tab'&&dialog.classList.contains('eq-dialog-fallback')){const focusable=[...dialog.querySelectorAll('button:not([disabled]),input,a[href]')],first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
 function draw(){
  if(disposed)return;
  let matches=selectEquipment(items,{search:$('[data-search]').value,category:$('[data-category]').value,brand:$('[data-brand]').value});
  if($('[data-stock]').checked)matches=matches.filter(x=>Number(partFor(x)?.quantity)>0);
  page=Math.max(0,Math.min(page,Math.ceil(matches.length/20)-1));const rows=matches.slice(page*20,page*20+20);
  $('[data-list]').innerHTML=rows.length?`<div class="eq-table-scroll"><table class="eq-table"><thead><tr><th>Модель</th><th>Рыночная цена</th><th>Закупочная цена</th></tr></thead><tbody>${rows.map(x=>{
   const p=partFor(x),price=marketPrice(x,prices.get(x.id));
   return `<tr data-model-row="${x.id}"><td><button type="button" class="eq-model-open" data-open="${x.id}">${esc(x.name)}</button><small>${esc(x.category)}${p?' · На складе: '+Number(p.quantity||0)+' шт.':''}</small></td><td><b>${price.value===null?'Не задана':money(price.value)}</b><small>${price.overridden?'Оценка FastGo':'По источникам'}</small>${editor&&marketLoaded?`<button type="button" class="eq-edit" data-market="${x.id}" ${pending?'disabled':''}>Изменить</button>`:''}</td><td>${p?money(p.unit_cost||0):'<span class="eq-note">Не задана</span>'}${editor&&loaded?`<button class="eq-edit" type="button" data-cost="${x.id}" ${pending?'disabled':''}>${p?'Изменить':'Задать'}</button>`:''}</td></tr>`;
  }).join('')}</tbody></table></div>`:'<p>Ничего не найдено. Измените поиск или фильтры.</p>';
  $('[data-count]').textContent=matches.length?`${page*20+1}–${Math.min((page+1)*20,matches.length)} из ${matches.length}`:'0 моделей';
  $('[data-prev]').disabled=page===0;$('[data-next]').disabled=(page+1)*20>=matches.length;
  root.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>open(byId.get(b.dataset.open)));
  root.querySelectorAll('[data-model-row]').forEach(row=>row.onclick=e=>{if(!e.target.closest('button,a,input,summary,details'))open(byId.get(row.dataset.modelRow));});
  root.querySelectorAll('[data-cost]').forEach(b=>b.onclick=()=>open(byId.get(b.dataset.cost),'cost'));
  root.querySelectorAll('[data-market]').forEach(b=>b.onclick=()=>open(byId.get(b.dataset.market),'market'));
 }
 function card(){
  if(!selected||disposed)return;
  const item=selected,p=partFor(item),record=prices.get(item.id),price=marketPrice(item,record);
  const image=item.image,src=image?.src&&/^warehouse\/equipment-media\/[a-f0-9]+\.(?:png|jpe?g|webp)$/.test(image.src)?image.src:'';
  const specs=(item.specifications||[]).filter(x=>x.name&&x.value);
  const sources=[...new Set([...(item.sources||[]).map(x=>typeof x==='string'?x:x.url),...(item.offers||[]).map(x=>x.url),image?.source_url].filter(x=>/^https:\/\//.test(x||'')))];
  dialog.innerHTML=`<header class="eq-detail-heading"><div><small>${esc(item.category)}</small><h2 id="eq-detail-title">${esc(item.name)}</h2></div><button type="button" data-close aria-label="Закрыть карточку">✕</button></header><div class="eq-detail-grid"><section class="eq-detail-info"><div class="eq-detail-prices"><section><span>Рыночная цена</span><strong data-detail-market-value>${price.value===null?'Не задана':money(price.value)}</strong><small>${price.overridden?'Оценка сохранена в FastGo':'Справочная цена источников'}</small>${editor&&marketLoaded?`<button type="button" data-edit-market ${pending?'disabled':''}>Изменить</button>`:''}</section><section><span>Закупочная цена</span><strong data-detail-cost-value>${p?money(p.unit_cost||0):'Не задана'}</strong><small>${p?'Из вашей складской карточки':'Сохраняется в общей базе'}</small>${editor&&loaded?`<button type="button" data-edit-cost ${pending?'disabled':''}>${p?'Изменить':'Задать'}</button>`:''}</section></div><div data-detail-editor></div><h3>Характеристики</h3>${specs.length?`<dl class="eq-specs">${specs.map(x=>`<div><dt>${esc(x.name)}</dt><dd>${esc(x.value)}</dd></div>`).join('')}</dl>`:'<p class="eq-note">Характеристики ещё не получены из источника. Можно открыть страницу поставщика ниже.</p>'}<details class="eq-sources"><summary>Источники и цены поставщиков</summary>${(item.offers||[]).map(o=>`<p><a href="${esc(o.url)}" target="_blank" rel="noopener noreferrer">${esc(o.source)}</a> · ${money(o.price)}<small>Проверено ${esc(o.checked_at)}</small></p>`).join('')}${sources.filter(url=>!(item.offers||[]).some(o=>o.url===url)).map(url=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Открыть источник</a>`).join('')}<p class="eq-note">Рыночная цена — ориентир. Цена продажи задаётся в складской карточке.</p></details></section><figure class="eq-detail-media">${src?`<img src="${esc(src)}" alt="${esc(item.name)}" decoding="async">`:'<div class="eq-photo-empty">Фото пока не получено из источника</div>'}<figcaption>${src?'Фото модели из каталога поставщика':'Фотография появится после проверки источника'}</figcaption></figure></div><footer class="eq-detail-footer"><p data-detail-status role="status"></p><button type="button" data-close>Закрыть</button></footer>`;
  dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);
  const img=dialog.querySelector('img');if(img)img.onerror=()=>{img.replaceWith(Object.assign(document.createElement('p'),{className:'eq-photo-empty',textContent:'Фото сейчас недоступно'}));};
  const cost=dialog.querySelector('[data-edit-cost]'),market=dialog.querySelector('[data-edit-market]');if(cost)cost.onclick=()=>edit('cost');if(market)market.onclick=()=>edit('market');
  if(pending&&pending.itemId===item.id)retryForm();
 }
 function open(item,field=''){
  if(!item)return;selected=item;formField='';card();
  if(!isOpen()){if(typeof dialog.showModal==='function')dialog.showModal();else{dialog.setAttribute('open','');dialog.classList.add('eq-dialog-fallback');}dialog.querySelector('[data-close]')?.focus();}
  if(pending&&pending.itemId===item.id){$('[data-editor]').innerHTML='';retryForm();}else if(field)edit(field);
 }
 function edit(field){
  if(!selected||!editor||pending||saving||field==='cost'&&!loaded||field==='market'&&!marketLoaded)return;
  formField=field;setDirty(true);const item=selected,p=partFor(item),record=prices.get(item.id),value=field==='cost'?(p?.unit_cost??''):marketPrice(item,record).value;
  dialog.querySelector('[data-detail-editor]').innerHTML=`<form class="eq-cost-form"><label>${field==='cost'?'Закупочная':'Рыночная'} цена, ₽<input name="cost" inputmode="decimal" required maxlength="12" value="${esc(value??'')}" autocomplete="off"></label><p class="eq-note">${field==='cost'?(p?'Сохранится закупочная цена этой техники.':'Будет создана складская карточка с нулевым остатком.'):'Оценка сохранится в общей базе и будет видна на других устройствах.'}</p><div><button type="submit">Сохранить</button> <button type="button" data-cancel>Отмена</button>${field==='market'&&record?.market_price!==null&&record?.market_price!==undefined?' <button type="button" data-reset>Использовать цену источников</button>':''}</div></form>`;
  const form=dialog.querySelector('form');form.querySelector('[data-cancel]').onclick=()=>{formField='';setDirty(dirty());card();};
  const submit=value=>{const op=field==='cost'?purchaseOperation(item,p,value,uuid()):marketOperation(item,record,value,uuid());const next={itemId:item.id,...op};localStorage.setItem(storageKey,JSON.stringify(next));pending=next;formField='';setDirty(true);void save();};
  form.onsubmit=e=>{e.preventDefault();try{submit(purchaseValue(form.elements.cost.value));}catch(error){status(error.message,true);}};
  const reset=form.querySelector('[data-reset]');if(reset)reset.onclick=()=>{try{submit(null);}catch(error){status(error.message,true);}};
  form.elements.cost.focus();form.elements.cost.select();
 }
 function retryForm(){
  if(!pending)return;const host=selected?.id===pending.itemId&&isOpen()?dialog.querySelector('[data-detail-editor]'):$('[data-editor]');
  if(!host)return;host.innerHTML='<div class="eq-cost-form"><p>Сохранение ещё не подтверждено. Повтор отправит ту же операцию без дублирования.</p><button type="button" data-retry>Повторить сохранение</button></div>';host.querySelector('[data-retry]').onclick=()=>void save();
 }
 async function refresh(){
  const [catalog,market]=await Promise.allSettled([call('catalog',{}, {fresh:true}),call('equipment_market_prices',{}, {fresh:true})]);
  if(disposed)return;
  if(catalog.status==='fulfilled'){parts=catalog.value.parts||[];links=new Map();loaded=true;}
  if(market.status==='fulfilled'){prices=new Map((market.value.items||[]).map(x=>[x.id,x]));marketLoaded=true;try{localStorage.setItem(cacheKey,JSON.stringify([...prices.values()]));}catch{}}
  draw();if(selected&&!formField)card();
  if(catalog.status==='rejected'||market.status==='rejected')status('Справочник доступен. '+(catalog.status==='rejected'?catalog.reason.message:market.reason.message),true);
  else status(editor?'Цены сохраняются в общей базе склада и сервиса.':'Откройте модель, чтобы посмотреть фото и характеристики.');
 }
 async function save(){
  if(!pending||saving)return;saving=true;setDirty(true);const operation=pending;
  root.querySelectorAll('[data-detail-editor] input,[data-detail-editor] button,[data-editor] button').forEach(x=>x.disabled=true);
  try{
   const result=await call(operation.action,operation.params);if(operation.action==='equipment_market_price_save'&&result?.id===operation.itemId){prices.set(result.id,result);try{localStorage.setItem(cacheKey,JSON.stringify([...prices.values()]));}catch{}}localStorage.removeItem(storageKey);pending=null;formField='';setDirty(false);
   if(disposed)return;$('[data-editor]').innerHTML='';await refresh();status(operation.action==='equipment_market_price_save'?(operation.params.market_price===null?'Восстановлена цена источников.':'Рыночная цена сохранена.'):'Закупочная цена сохранена.');
  }catch(error){
   if(disposed)return;
   if(error.status&&error.status<500&&error.status!==408&&error.status!==429){try{localStorage.removeItem(storageKey);pending=null;}catch{}formField='';setDirty(dirty());await refresh();status(error.message+' Проверьте актуальную карточку перед повторным изменением.',true);}
   else{status(error.message,true);retryForm();}
  }finally{saving=false;if(!disposed){draw();root.querySelectorAll('[data-detail-editor] button,[data-editor] button').forEach(x=>x.disabled=false);setDirty(dirty());}}
 }
 for(const name of ['search','category','brand','stock'])$('[data-'+name+']').addEventListener(name==='search'?'input':'change',()=>{page=0;draw();});$('[data-prev]').onclick=()=>{page--;draw();};$('[data-next]').onclick=()=>{page++;draw();};draw();
 return {ready:refresh().then(()=>{if(pending&&editor){setDirty(true);retryForm();}}),dispose(){disposed=true;close();setDirty(false);}};
}
