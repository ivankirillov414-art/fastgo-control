import {esc,money,uuid} from './client.js';
export function mountServices({root,call,editor,message}){
 root.classList.add('service-workspace');
 let services=[],pending=null,dirty=false;
 root.innerHTML='<div class="toolbar"><h1>Ремонтные работы</h1>'+(editor?'<button type="button" data-new>+ Добавить работу</button>':'')+'</div><p>Общий прайс сервиса и склада. Изменение цены не меняет ранее проведённые оплаты.</p><div data-editor></div><input type="search" data-search placeholder="Поиск работы"><div data-list></div>';
 const $=s=>root.querySelector(s);window.fastgoServiceCatalogDirty=()=>root.isConnected&&dirty;
 function draw(){const q=$('[data-search]').value.trim().toLowerCase();$('[data-list]').innerHTML=services.filter(x=>x.title.toLowerCase().includes(q)).map(x=>'<div class="row"><span>'+esc(x.title)+'</span><strong>'+money(x.labor_price)+'</strong>'+(editor?'<button type="button" data-edit="'+esc(x.id)+'">Изменить</button>':'')+'</div>').join('')||'<p>Работ пока нет.</p>';root.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>edit(services.find(x=>x.id===b.dataset.edit)));}
 function edit(item){if(pending){message('Повторите сохранение: результат прошлого запроса пока неизвестен.',true);return;}dirty=true;$('[data-editor]').innerHTML='<form class="panel"><h2>'+(item?'Изменить работу':'Новая работа')+'</h2><label>Название<input name="title" maxlength="200" required value="'+esc(item?.title||'')+'"></label><label>Стоимость, ₽<input name="price" type="number" min="0" max="100000000" step="0.01" required value="'+(item?.labor_price??'')+'"></label><div class="actions"><button class="primary">Сохранить</button><button type="button" data-cancel>Отмена</button></div><p role="status" data-error></p></form>';const form=$('form');$('[data-cancel]').onclick=()=>{if(pending)return;dirty=false;$('[data-editor]').innerHTML='';};form.onsubmit=async e=>{e.preventDefault();if(!form.reportValidity())return;let p=pending;if(!p){p={request_id:uuid(),id:item?.id||uuid(),title:form.elements.title.value.trim(),labor_price:Number(form.elements.price.value),create:!item,...(item?{expected_title:item.title,expected_price:item.labor_price}:{})};pending=p;}form.querySelectorAll('input,button').forEach(x=>x.disabled=true);try{await call('work_catalog_save',p);pending=null;dirty=false;services=await call('work_catalog');$('[data-editor]').innerHTML='';draw();message('Прайс сохранён');}catch(error){$('[data-error]').textContent=error.message;if(error.status&&error.status<500){pending=null;}form.querySelectorAll('input').forEach(x=>x.disabled=!!pending);form.querySelectorAll('button').forEach(x=>x.disabled=false);}};}
 $('[data-search]').oninput=draw;if($('[data-new]'))$('[data-new]').onclick=()=>edit(null);
 return {ready:call('work_catalog').then(x=>{services=x;draw();}),dispose(){window.fastgoServiceCatalogDirty=()=>false;}};
}
export function mountManualPayment({root,call,load,save,home,message}){
 root.classList.add('service-workspace','manual-payment-workspace');
 let catalog=[],draft=load('manual-service-payment')||{id:uuid(),items:[],method:'',total:'',simple:true},paying=false,storageError=false;
 draft.items ||= [];
 if(!draft.pending&&draft.work?.trim()&&!draft.simple){draft.items.push({title:draft.work.trim(),quantity:1,unit_price:Number(draft.price)||0});delete draft.work;delete draft.price;}
 const $=s=>root.querySelector(s),persist=()=>save('manual-service-payment',draft);
 const methods=[['cash','Наличные'],['card','Безналичный расчёт']];
 if(draft.pending?.payment_method==='transfer'||draft.method==='transfer')methods.push(['transfer','Перевод · сохранённая оплата']);
 root.innerHTML='<div class="live-heading"><button type="button" data-back>← К оплате</button><h1>Ручная оплата работ</h1></div><p>Без создания клиента и карточки ремонта. Остатки запчастей не меняются.</p><div class="manual-payment-grid"><section class="panel" data-add><label>Название работы<input form="manual-work-payment" name="work" list="service-choices" maxlength="200" autocomplete="off" required placeholder="Например, замена камеры"><datalist id="service-choices"></datalist></label><div data-lines aria-live="polite"></div></section><form id="manual-work-payment" data-payment class="panel"><label>Сумма к оплате, ₽<input name="total" type="number" min="0.01" max="100000000" step="0.01" required placeholder="Введите сумму"></label><fieldset class="payment-options"><legend>Способ оплаты</legend>'+methods.map(([value,title])=>'<label><input type="radio" name="method" value="'+value+'" required>'+title+'</label>').join('')+'</fieldset><button class="primary" data-submit>Принять оплату</button><button type="button" data-cancel>Отменить оплату</button><p data-payment-error role="status"></p></form></div>';
 const work=$('[name=work]'),payment=$('[data-payment]'),error=$('[data-payment-error]');
 work.value=draft.simple?(draft.work||draft.items[0]?.title||''):draft.items.map(x=>x.title).join('; ');
 const gross=Math.round(draft.items.reduce((sum,x)=>sum+x.quantity*x.unit_price,0)*100)/100;
 payment.elements.total.value=draft.pending?.total_override??(draft.total===''?(gross>0?gross:''):draft.total);
 for(const input of payment.querySelectorAll('[name=method]'))input.checked=input.value===(draft.pending?.payment_method||draft.method);
 function state(){
  root.querySelectorAll('input,button').forEach(x=>x.disabled=paying||!!draft.pending);
  const valid=work.value.trim()&&draft.items.length&&payment.elements.total.validity.valid&&Number(payment.elements.total.value)>0&&payment.elements.method.value;
  $('[data-submit]').disabled=paying||(!draft.pending&&(!valid||storageError));
  $('[data-back]').disabled=$('[data-cancel]').disabled=paying||!!draft.pending;
  root.querySelectorAll('button').forEach(x=>x.dataset.unavailable=String(x.disabled));
  $('[data-submit]').textContent=draft.pending?'Проверить результат оплаты':'Принять оплату';
  if(draft.pending&&!paying&&!error.textContent)error.textContent='Результат оплаты ещё не подтверждён. Нажмите «Проверить результат оплаты» — повторного списания не будет.';
 }
 function draw(){
  $('[data-lines]').innerHTML=draft.items.map(x=>'<p class="manual-work-added">✓ '+esc(x.title)+'</p>').join('');state();
 }
 function remember(){try{persist();storageError=false;error.textContent='';}catch(e){storageError=true;error.textContent='Не удалось сохранить черновик: '+e.message;}draw();}
 work.oninput=()=>{if(draft.pending)return;draft.simple=true;draft.work=work.value;const title=work.value.trim(),selected=catalog.find(x=>x.title===title);draft.items=title?[{title,quantity:1,unit_price:0,...(selected?{service_id:selected.id}:{})}]:[];remember();};
 work.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();payment.elements.total.focus();}};
 payment.oninput=()=>{if(draft.pending)return;draft.total=payment.elements.total.value;draft.method=payment.elements.method.value;remember();};
 payment.onsubmit=async e=>{
  e.preventDefault();if(paying||(!draft.pending&&(storageError||!payment.reportValidity()||!work.value.trim()||!draft.items.length)))return;
  const amount=Number(payment.elements.total.value);
  const payload=draft.pending||{request_id:draft.id,items:draft.simple?draft.items.map(x=>({...x,unit_price:amount})):draft.items,payment_method:payment.elements.method.value,total_override:amount};
  try{draft.pending=payload;persist();paying=true;state();error.textContent='Сохраняем оплату…';const result=await call('work_payment',payload);save('manual-service-payment',null);draft={id:uuid(),items:[],method:'',total:'',simple:true};home();message('Оплата работ принята: '+money(result.total));}
  catch(e){error.textContent=e.message;if(e.status&&e.status<500){delete draft.pending;persist();}}
  finally{paying=false;if(root.isConnected)state();}
 };
 $('[data-back]').onclick=()=>home();$('[data-cancel]').onclick=()=>{if(draft.pending||paying)return;save('manual-service-payment',null);draft={id:uuid(),items:[],method:'',total:'',simple:true};home();message('Ручная оплата отменена. Деньги и остатки не изменены.');};draw();
 return {ready:call('work_catalog').then(x=>{catalog=x;$('datalist').innerHTML=x.map(s=>'<option value="'+esc(s.title)+'"></option>').join('');})};
}
