import {rememberScan,lastBufferedScan,editScanBuffer} from './scan-history.js';
import {scanError} from './scan-policy.js';
import {priceAdjustment} from './price-adjustment.js';
import {bindScanner} from './scanner.js';
import {esc,money,uuid,matchBarcode} from './client.js';

// A terminal only captures scans. The station owns quantities and confirmation.
export function liveBasket({terminal,call,parts,render,home,run,message,load,save,refresh,repair,stationRepair,canOpen=()=>true,manual}){
 const $=id=>document.getElementById(id),key=kind=>'live:'+kind+':'+(terminal?'terminal':'station');
 let draft=null,current=null,kind='',active=false,locked=false,stop=null,timer=null,pollTimer=null,syncing=null,polling=false,overrides={},dismissed='',lastId='',scanChain=Promise.resolve(),stopKeys=null,emptyClosing=null;
 const product=x=>parts().find(p=>p.id===x?.part_id);
 const shown=new Map();
 const jobStamp=value=>String(value?.payload.updated_at||value?.created_at||'');
 function suspend(){if(current)dismissed=current.id+':'+current.payload.revision;checkpoint();cleanup();}
 const rejected=text=>Object.assign(Error(text),{rejected:true});
 const remaining=(local,job)=>local&&local.id===job.id&&local.revision>job.payload.revision?local.items.map(x=>({...x,quantity:x.quantity-(job.payload.items.find(y=>y.part_id===x.part_id)?.quantity||0)})).filter(x=>x.quantity>0):[];
 function rememberUSB(local){if(local?.usb_ids?.length)save("usb:accepted",[...(load("usb:accepted")||[]),...local.usb_ids].slice(-10000));}
 const cache=()=>{if(draft)save(key(draft.kind),draft);};
 function checkpoint(){if(terminal)return;cache();if(current||draft?.items.length||draft?.cancel_empty)save('live:resume:station',{kind,current:current?JSON.parse(JSON.stringify(current)):null,draft_id:draft?.id||null});}
 async function restore(){if(terminal)return false;const saved=load('live:resume:station');if(!saved)return false;if(saved.current){const latest=await call('job',{id:saved.current.id}).catch(()=>null);if(latest?.state==='done'){save('live:resume:station',null);return false;}await openMirror(latest||saved.current);return true;}if(load(key(saved.kind))?.id===saved.draft_id){await open(saved.kind);return true;}save('live:resume:station',null);return false;}
 const newDraft=k=>({id:uuid(),kind:k,revision:1,acked:0,items:[],usb_ids:[],note:''});
 const source=()=>current?.payload||draft||{kind,items:[]};
 const qty=x=>overrides[x.part_id]?Number(overrides[x.part_id].value)+x.quantity-overrides[x.part_id].base:x.quantity;
 const signature=()=>JSON.stringify(source().items);
 const baseTotal=()=>Math.round(source().items.reduce((sum,x)=>sum+x.quantity*amount(x),0)*100)/100;
 function totalEdit(){const saved=load('live-total:'+documentId());return saved?.signature===signature()?saved:null;}
 const price=priceAdjustment({prefix:'live',base:baseTotal,read:()=>current?.checkout?.total_override!==undefined?{value:String(current.checkout.total_override)}:totalEdit(),write:edit=>save('live-total:'+documentId(),edit?{...edit,signature:signature()}:null),locked:()=>locked||!!current?.checkout});
 const totalValue=()=>price.total();
 const amount=x=>(x.custom_price?Number(x.unit_price):Number(product(x)?.retail_price||0));
 function cleanup(){stopKeys?.();stopKeys=null;active=false;stop?.();stop=null;clearTimeout(timer);clearInterval(pollTimer);pollTimer=null;}
 function changed(){draft.revision++;cache();clearTimeout(timer);timer=setTimeout(()=>void sync().catch(e=>feedback(e.message,true)),120);}
 function feedback(text,error=false){if(!$('scan-feedback'))return;$('scan-feedback').textContent=text;$('scan-feedback').className=error?'error':'';}
 function finished(job){
  if(!active)return;
  // A scan received while the laptop was committing belongs to the next document.
  const local=draft||load(key(job.payload.kind)),extra=remaining(local,job);
  if(!terminal){save('live:resume:station',null);save('live-method:'+job.id,null);}
  if(local?.id===job.id){rememberUSB(local);save(key(local.kind),null);}
  if(draft){save(key(draft.kind),null);save('live:'+draft.kind,null);}
  if(extra.length){draft={...newDraft(kind),items:extra,last_part_id:extra[extra.length-1].part_id};current=null;locked=false;cache();draw();changed();return;}
  draft=null;current=null;locked=false;cleanup();void refresh().catch(()=>{});home();message(job.result?.cancelled?(job.payload.kind==='receipt'?'Приход отменён':'Документ отменён'):kind==='receipt'?'Приход оформлен':'Оплата принята');
 }
 async function sync(){
  if(syncing){await syncing;if(draft&&draft.acked<draft.revision)return sync();return;}
  if(!draft||locked&&!draft.cancel_empty||draft.acked>=draft.revision)return;
  const local=draft,body=JSON.parse(JSON.stringify(local));
  syncing=call('draft_sync',{request_id:body.id,kind:body.kind,revision:body.revision,items:body.items,note:body.note||'',active:active&&draft===local}).then(r=>{
   if(r.state==='done'){if(draft===local)finished(r);return;}
   if(r.state!=='queued')throw Error('Операция проводится на ноутбуке');
   local.acked=Math.max(local.acked||0,r.payload.revision);save(key(local.kind),local);
   if(active&&draft===local&&$('live-sync'))$('live-sync').textContent='';
  }).catch(async e=>{
   const job=await call('job',{id:local.id}).catch(()=>null);
   if(job?.state==='done'&&draft===local){finished(job);return;}
   if(active&&draft===local&&$('live-sync'))$('live-sync').textContent='Нет связи · сканы сохранены';throw e;
  }).finally(()=>syncing=null);
  await syncing;if(draft===local&&local.acked<local.revision&&(!locked||local.cancel_empty))return sync();
 }
 function draw(){
  if(!active||!$('live-items'))return;const value=source(),items=value.items.filter(x=>!overrides[x.part_id]?.removed||qty(x)>0);
  if(terminal){
   const x=items.find(x=>x.part_id===draft?.last_part_id)||items[items.length-1];
   $('live-items').innerHTML=x?'<article class="last-scan"><small>Отсканировано</small><h2>'+esc(product(x)?.name||x.part_id)+'</h2><p>'+x.quantity+' шт.</p></article>':'';
   $('scan-empty').hidden=!!x;return;
  }
  checkpoint();
  const host=$('live-items'),seen=new Set();
  for(const x of items){seen.add(x.part_id);let row=[...host.children].find(r=>r.dataset.part===x.part_id);
   if(!row){row=document.createElement('article');row.className='scan-product station-product'+(value.kind==='receipt'?' receipt-product':'');row.dataset.part=x.part_id;
    row.innerHTML='<strong></strong>'+(value.kind==='receipt'?'<label>Количество<input type="number" min="1" max="1000" step="1" data-live-qty="'+x.part_id+'" aria-label="Количество"></label><button type="button" class="live-remove" data-live-remove="'+x.part_id+'" aria-label="Удалить позицию" title="Удалить позицию"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/></svg><span>Удалить</span></button>':'<span data-count></span><b data-price></b>');host.append(row);
    const remove=row.querySelector('[data-live-remove]');if(remove)remove.onclick=()=>{if(value.kind==='sale'){void run(()=>editBuffer(x.part_id));return;}if(locked)return;const item=source().items.find(i=>i.part_id===x.part_id);overrides[x.part_id]={value:0,base:item.quantity,removed:true};save('live-edits:'+documentId(),overrides);draw();};
    const input=row.querySelector('input');if(input){input.oninput=()=>{const item=source().items.find(i=>i.part_id===x.part_id);overrides[x.part_id]={value:input.value,base:item.quantity};save('live-edits:'+documentId(),overrides);};input.onblur=draw;input.addEventListener('input',drawSummary);}
   }
   if(value.kind==='sale'&&!row.querySelector('[data-live-remove]')){const b=document.createElement('button');b.type='button';b.className='live-remove';b.dataset.liveRemove=x.part_id;b.setAttribute('aria-label','Удалить позицию');b.title='Удалить позицию из буфера';b.textContent='Удалить';b.onclick=()=>void run(()=>editBuffer(x.part_id));row.append(b);}
   row.classList.toggle('is-last-scan',x.part_id===(draft?.last_part_id||''));
   const removeButton=row.querySelector('[data-live-remove]');if(removeButton){removeButton.hidden=value.kind==='sale'&&!!current;removeButton.disabled=locked;removeButton.dataset.unavailable=String(locked||value.kind==='sale'&&!!current);}
   row.querySelector('strong').textContent=product(x)?.name||x.part_id;
   const input=row.querySelector('input');if(input){input.disabled=locked;if(document.activeElement!==input)input.value=String(qty(x));}
   else{row.querySelector('[data-count]').textContent=x.quantity+' шт.';row.querySelector('[data-price]').textContent=money(amount(x)*x.quantity);}
  }
  for(const row of [...host.children])if(!seen.has(row.dataset.part))row.remove();
  if($('live-cancel')){$('live-cancel').disabled=locked;$('live-cancel').dataset.unavailable=String(locked);}
  $('scan-empty').hidden=!!items.length;$('live-payment').hidden=value.kind!=='sale'||!items.length;$('live-submit').hidden=!items.length;
  price.draw();drawSummary();
  for(const el of document.querySelectorAll('input[name="live-method"]'))el.disabled=locked;
 }
 function documentId(){return current?.id||draft?.id||'';}
 function drawSummary(){
  if(terminal||!$('live-units'))return;
  const items=source().items.filter(x=>!overrides[x.part_id]?.removed||qty(x)>0),quantities=items.map(qty),valid=quantities.every(x=>Number.isSafeInteger(x)&&x>0);
  $('live-units').textContent=valid?quantities.reduce((a,b)=>a+b,0)+' шт.':'Проверьте количество';
  $('live-lines').textContent=items.length+' поз.';
  const undo=$('live-undo');if(undo){undo.hidden=kind!=='sale'||!!current;undo.disabled=locked||!!draft?.pickup||!lastBufferedScan(draft);undo.dataset.unavailable=String(undo.disabled);}
  $('live-buffer-hint').textContent=draft?.cancel_empty?'Закрываем пустой буфер. Если связь пропала, отмена завершится после подключения.':current?'Сканы поступили с ТСД. Подтверждение документа выполняется здесь.':kind==='receipt'?'Проверьте количество. После оформления этикетки получит кассовый принтер.':items.length?'Выберите способ оплаты или сканируйте QR «Взять запчасти» для выдачи мастеру.':'Отсканируйте товар для продажи или QR ремонта для оплаты ремонта.';
 }
 function editBuffer(partId){
  const next=scanChain.then(async()=>{
   if(!active||terminal||locked||current||draft?.pickup)throw Error('Буфер уже подтверждается или получен с ТСД');
   const before=draft,edited=editScanBuffer(draft,partId);if(!edited)return;
   draft=edited;if(!draft.items.length){draft.cancel_empty=true;locked=true;}
   try{changed();}catch(e){draft=before;locked=false;draw();throw e;}
   lastId=draft.last_part_id;draw();feedback(partId?'Позиция удалена из буфера':'Последний скан отменён');if(draft.cancel_empty)await clearEmpty();
  });scanChain=next.catch(()=>{});return next;
 }
 async function clearEmpty(){
  if(emptyClosing)return emptyClosing;
  const local=draft;if(!local?.cancel_empty)return;
  locked=true;draw();
  emptyClosing=(async()=>{try{
   await sync();if(draft!==local)return;
   const result=await call('cancel_document',{id:local.id,kind:'sale',revision:local.revision});
   if(result?.state!=='done')throw Error('Сервер не подтвердил отмену');
   finished(result);if(result.result?.cancelled)message('Буфер очищен. Продажа не проведена.');
  }catch(e){
   const result=await call('job',{id:local.id}).catch(()=>null);
   if(result?.state==='done'){finished(result);if(result.result?.cancelled)message('Буфер очищен. Продажа не проведена.');return;}
   if(draft===local){locked=true;draw();feedback('Ожидаем связь для отмены пустого буфера. Сканы сохранены.',true);}throw e;
  }finally{emptyClosing=null;}})();return emptyClosing;
 }
 function markup(k){
  const heading='<div class="live-heading"><button id="live-back" aria-label="Закрыть и сохранить черновик">'+(terminal?'←':'← К списку')+'</button><h1>'+(k==='receipt'?'Приход':'Оплата')+'</h1>'+(!terminal&&k==='sale'?'<button type="button" id="manual-service-payment">Внести оплату работ вручную</button>':'')+'</div><small id="live-sync"></small><form id="live-scan" class="scanner-sink" aria-hidden="true"><input id="live-code" inputmode="none" tabindex="-1" autocomplete="off" autocapitalize="off" spellcheck="false"></form>';
  const items='<p id="scan-empty" class="scan-empty">Ожидаем сканирование</p><div id="live-items" aria-live="polite"></div><p id="scan-feedback" role="status"></p>';
  if(terminal)return heading+items+'<button id="scanner-compat">Сканер не вводит код?</button><small id="scan-received" role="status"></small>';
  return heading+'<div class="live-workspace"><section class="live-buffer" aria-label="Буфер товаров"><div class="live-buffer-heading"><h2>Товары</h2><button type="button" id="live-undo" hidden>Отменить последний скан <kbd>F6</kbd></button></div>'+items+'</section><aside class="live-checkout" aria-label="Подтверждение документа"><div class="live-summary"><span>В документе</span><strong id="live-units">0 шт.</strong><span id="live-lines">0 поз.</span></div><p id="live-buffer-hint" class="live-buffer-hint"></p><section id="live-payment" hidden>'+price.markup()+'<fieldset class="payment-options"><legend>Способ оплаты</legend>'+[['cash','Наличные'],['card','Безналичный расчёт'],['transfer','Перевод']].map(([v,label])=>'<label><input type="radio" name="live-method" value="'+v+'">'+label+'</label>').join('')+'</fieldset></section><button class="primary" id="live-submit" hidden>'+(k==='receipt'?'Оформить приход':'Принять оплату')+'</button><button type="button" class="live-cancel" id="live-cancel">'+(k==='receipt'?'Отменить весь приход':'Отменить оплату')+'</button></aside></div>';
 }

 function mount(){
  render(markup(kind));draw();$('live-back').onclick=()=>{if(current)dismissed=current.id+':'+current.payload.revision;cleanup();home();};
  $('live-scan').onsubmit=e=>{e.preventDefault();const code=$('live-code').value.trim();if(!code)return;if($('scan-received'))$('scan-received').textContent='Получен код: '+code;$('live-code').value='';void add(code).catch(e=>feedback(e.message,true));};
  if(terminal)stop=bindScanner($('live-code'),$('live-scan'),()=>active&&!locked,{silent:true});
  function compatible(enabled,focus=false){
   stop?.();const form=$('live-scan'),input=$('live-code');
   form.className=enabled?'scanner-compatible':'scanner-sink';form.setAttribute('aria-hidden',String(!enabled));
   input.setAttribute('inputmode',enabled?'text':'none');input.tabIndex=enabled?0:-1;input.setAttribute('aria-label','Код аппаратного сканера');input.placeholder='Отсканируйте товар';
   stop=bindScanner(input,form,()=>active&&!locked,{silent:!enabled});
   $('scanner-compat').textContent=enabled?'Скрыть поле сканера':'Сканер не вводит код?';
   if(enabled)feedback('Обычный ввод включён. Отсканируйте товар.');
   if(focus)input.focus();
  }
  if(terminal){let enabled=load('scanner:compat')===true;if(enabled)compatible(true);$('scanner-compat').onclick=()=>{enabled=!enabled;save('scanner:compat',enabled);compatible(enabled,true);};}
  if(!terminal){$('live-undo').onclick=()=>run(()=>editBuffer());const keys=e=>{if(e.key!=='F6'||e.repeat||e.ctrlKey||e.altKey||e.metaKey||!active||locked||current||kind!=='sale'||document.querySelector('dialog[open],.modal')||e.target.closest?.('input:not([data-payment-scan]):not(#live-code),textarea,select,[contenteditable]'))return;e.preventDefault();if(!$('live-undo').disabled)void run(()=>editBuffer());};window.addEventListener('keydown',keys);stopKeys=()=>window.removeEventListener('keydown',keys);if($('manual-service-payment'))$('manual-service-payment').onclick=()=>manual?.();if($('live-cancel'))$('live-cancel').onclick=()=>run(cancelCurrent);$('live-submit').onclick=()=>run(finish);price.bind();const method=current?.checkout?.payment_method||load('live-method:'+documentId());for(const el of document.querySelectorAll('input[name="live-method"]')){el.checked=el.value===method;el.onchange=()=>{save('live-method:'+documentId(),el.value);checkpoint();};}}
  pollTimer=setInterval(()=>void poll().catch(e=>{if(active&&$('live-sync'))$('live-sync').textContent=e.message;}),1000);
 }
 async function open(k){
  cleanup();kind=k;current=null;locked=false;overrides={};lastId='';draft=load(key(kind))||(terminal?load('live:'+kind):null);
  if(draft){const r=await call('job',{id:draft.id}).catch(()=>null);if(r?.state==='done'){const extra=remaining(draft,r);rememberUSB(draft);save(key(kind),null);save('live:'+kind,null);draft=extra.length?{...newDraft(kind),items:extra,last_part_id:extra[extra.length-1].part_id}:null;}else if(r?.state==='processing'){if(!terminal){current=r;draft=null;locked=true;}else locked=true;}}
  if(terminal&&!draft)draft=newDraft(kind);
  if(draft){cache();lastId=draft.last_part_id||'';overrides=load('live-edits:'+draft.id)||{};}
  active=true;mount();if(draft?.cancel_empty)void clearEmpty().catch(()=>{});else if(draft?.pickup)void run(issuePending);else if(draft)void sync().catch(e=>feedback(e.message,true));
 }
 async function openMirror(value){cleanup();kind=value.payload.kind;draft=null;current=value;shown.set(value.id,value.payload.revision);locked=value.state==='processing';overrides=load('live-edits:'+value.id)||{};active=true;mount();if(value.checkout?.payment_method){const el=document.querySelector('input[name="live-method"][value="'+value.checkout.payment_method+'"]');if(el)el.checked=true;}}
 async function addCode(code,usbId){
  if(!code)return;
  if(!active||locked||draft?.cancel_empty)throw Error('Дождитесь завершения операции');
  if(usbId&&(draft?.usb_ids?.includes(usbId)||(load('usb:accepted')||[]).includes(usbId))){const p=matchBarcode(parts(),code)[0];return {name:p?.name||code,price:p?.retail_price,quantity:draft?.items.find(x=>x.part_id===p?.id)?.quantity||1};}
  if(current)throw Error('Сейчас открыт документ другого терминала');
  const scanProblem=scanError(kind,code);if(scanProblem)throw rejected(scanProblem);
  const found=matchBarcode(parts(),code);if(found.length!==1)throw rejected(found.length?'Код неоднозначен':'Товар не найден: '+code);
  if(!draft)draft=newDraft(kind);
  const before=JSON.stringify(draft),old=draft.items.find(x=>x.part_id===found[0].id);
  if(old){if(old.quantity>=1000)throw rejected('Не больше 1000 шт.');old.quantity++;}else{if(draft.items.length>=40)throw rejected('Не больше 40 позиций');draft.items.push({part_id:found[0].id,quantity:1});}
  draft.last_part_id=found[0].id;rememberScan(draft,found[0].id);if(usbId)(draft.usb_ids||(draft.usb_ids=[])).push(usbId);
  try{changed();}catch(e){draft=JSON.parse(before);throw e;}
  lastId=found[0].id;draw();feedback('');return {name:found[0].name,price:found[0].retail_price,quantity:draft.items.find(x=>x.part_id===lastId).quantity};
 }
 function add(code,usbId){const next=scanChain.then(()=>addCode(code,usbId));scanChain=next.catch(()=>{});return next;}
 async function issuePending(){
  if(!draft?.pickup)throw Error('Нет выдачи для завершения');
  const local=draft;locked=true;draw();
  try{
   const result=await call('parts_issue',{request_id:local.pickup.request_id,code:local.pickup.code,items:local.items});
   // Stock and repair are one atomic server transaction. Close the temporary
   // sale only after its idempotent issue receipt has been confirmed.
   await call('cancel_document',{id:local.id,kind:'sale',revision:local.revision});
   finished({id:local.id,payload:local,result:{}});
   message('Запчасти выданы в ремонт № '+result.number+' · '+result.master_name);
  }catch(e){locked=true;draw();feedback('Выдача не завершена: '+e.message+'. Повторите QR мастера или откройте этот черновик для повтора.',true);throw e;}
 }
 async function issueParts(code){
  if(terminal||current||!draft?.items.length||kind!=='sale')throw Error('Сначала отсканируйте запчасти для мастера. Скан отменён.');
  if(draft.pickup){if(draft.pickup.code!==code)throw Error('Сначала завершите предыдущую выдачу');return issuePending();}
  if(locked)throw Error('Дождитесь завершения операции');
  await scanChain;await sync();
  await call('parts_pickup_quote',{code});
  draft.pickup={code,request_id:uuid()};cache();checkpoint();return issuePending();
 }
 async function poll(){
  if(polling||!active)return;polling=true;try{
   if(draft?.cancel_empty){await clearEmpty();return;}
   if(draft){const local=draft;void sync().catch(()=>{});const r=await call('job',{id:local.id});if(active&&draft===local&&r?.state==='done')finished(r);else if(active&&draft===local&&r){locked=r.state==='processing';draw();}return;}
   if(current){const id=current.id,r=await call('job',{id});if(!active||current?.id!==id||!r)return;if(r.state==='done'){finished(r);return;}if(r.payload.revision!==current.payload.revision||r.state!==current.state){current=r;locked=r.state==='processing';draw();}return;}
   if(!terminal)await pollMirror();
  }finally{polling=false;}
 }
 async function pollMirror(){
  if(terminal||!canOpen()||active&&(locked||draft?.items.length))return;
  const jobs=await call('live_jobs');if(!canOpen()||active&&(locked||draft?.items.length))return;
  const candidates=jobs.filter(j=>j.state!=='done').sort((a,b)=>String(b.payload.updated_at||b.created_at).localeCompare(String(a.payload.updated_at||a.created_at)));
  const found=candidates.find(j=>(!j.station_id||j.terminal_id!==j.station_id)&&j.id!==current?.id&&shown.get(j.id)!==j.payload.revision&&j.id+':'+j.payload.revision!==dismissed&&(!active||!current||jobStamp(j)>jobStamp(current)));
  if(found){suspend();await openMirror(found);void window.warehouseDesktop?.showIncoming?.();return;}
  const target=$('live-terminal-panel');if(target){target.textContent='';for(const saved of candidates){const button=document.createElement('button');button.type='button';button.textContent=(saved.payload.kind==='receipt'?'Приход':'Оплата')+' · Открыть черновик';button.onclick=()=>run(()=>saved.terminal_id&&saved.terminal_id===saved.station_id?open(saved.payload.kind):openMirror(saved));target.append(button);}}
 }
 async function cancelCurrent(){
  if(terminal)return;
  const receipt=kind==='receipt';
  if(locked)throw Error('Документ уже проводится. Дождитесь результата');
  if(!confirm(receipt?'Отменить весь приход? Складские остатки не изменятся.':'Отменить оплату? Продажа не будет проведена, остатки и расчёты не изменятся.'))return;
  await scanChain;if(draft)await sync();
  const id=documentId(),value=source();
  if(!id){cleanup();home();message(receipt?'Пустой приход закрыт':'Пустая оплата закрыта');return;}
  locked=true;draw();
  try{
   const result=await call(receipt?'draft_close':'cancel_document',{id,kind,revision:value.revision});
   if(result?.state!=='done')throw Error('Сервер не подтвердил отмену. Повторите');
   save('live-edits:'+id,null);save('live-total:'+id,null);finished(result);
  }catch(e){
   const latest=await call('job',{id}).catch(()=>null);
   if(latest?.state==='done'){save('live-edits:'+id,null);finished(latest);return;}
   if(current&&latest)current=latest;
   locked=latest?.state==='processing'||!!latest?.checkout;draw();throw e;
  }
 }
 async function finish(){
  if(terminal)return;if(draft?.pickup)throw Error('Эти запчасти выдаются мастеру. Откройте черновик для завершения выдачи.');await scanChain;if(draft)await sync();
  const value=source(),id=documentId();if(!value.items.length)throw Error('Нет отсканированных товаров');
  const method=current?.checkout?.payment_method||document.querySelector('input[name="live-method"]:checked')?.value;
  if(kind==='sale'&&!method)throw Error('Выберите способ оплаты');
  let chosen;if(kind==='receipt'){chosen=value.items.filter(x=>!overrides[x.part_id]?.removed||qty(x)>0).map(x=>({part_id:x.part_id,quantity:qty(x)}));if(chosen.some(x=>!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>1000)||Object.values(overrides).some(x=>!x.removed&&x.value===''))throw Error('Количество от 1 до 1000');}
  const total=kind==='sale'?totalValue():undefined;if(total===null)throw Error('Укажите сумму от 0 до 100 000 000 ₽, не больше двух знаков после запятой');
  const custom=kind==='sale'&&(totalEdit()||current?.checkout?.total_override!==undefined);
  locked=true;draw();try{
   const result=await call(kind==='receipt'?'live_receive':'live_pay',{id,revision:value.revision,payment_method:method,...(custom?{total_override:total}:{}),...(chosen?{items:chosen}:{})});
   save('live-edits:'+id,null);save('live-total:'+id,null);finished({id,payload:value,result});
  }catch(e){const r=await call('job',{id}).catch(()=>null);if(r?.state==='done'){finished(r);return;}if(r){if(current)current=r;locked=r.state==='processing';}else locked=true;draw();throw e;}
 }
 return {open,cleanup,suspend,checkpoint,restore,pollMirror,hasDraft:()=>active&&(!!current||locked)||!!draft?.items.length||!!draft?.cancel_empty,active:()=>active,kind:()=>kind,canAutoOpen:()=>!active||!locked&&!draft?.items.length&&!current?.checkout,canPaymentScan:()=>!draft?.cancel_empty&&!current&&(!locked||!!draft?.pickup),issueParts,acceptPaymentScan:async code=>{if(terminal||current||locked)throw Error('Завершите текущий документ. Скан отменён.');if(!active||kind!=='sale'){checkpoint();await open('sale');}return add(code);},canUSB:k=>!draft?.cancel_empty&&(!active||!current&&!locked&&kind===k),acceptUSB:async item=>{if(!active)await open(item.kind);if(kind!==item.kind)throw Error('Завершите текущий документ');return add(item.code,item.id);}};
}
