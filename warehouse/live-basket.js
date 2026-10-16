import {bindScanner} from './scanner.js';
import {esc,money,uuid,matchBarcode} from './client.js';

export function liveBasket({terminal,call,parts,render,home,run,message,load,save,refresh}){
 let draft=null,stop=null,timer=null,syncing=null,active=false,mirrorTimer=null,mirror=null,locked=false;
 const $=id=>document.getElementById(id);
 const storeKey=kind=>'live:'+kind;
 function cleanup(){active=false;if(stop)stop();stop=null;clearTimeout(timer);clearInterval(mirrorTimer);mirrorTimer=null;}
 function cache(){save(storeKey(draft.kind),draft);}
 function changed(){draft.revision++;cache();schedule();}
 function schedule(){clearTimeout(timer);timer=setTimeout(()=>void sync().catch(e=>message(e.message,true)),150);}
 async function sync(){
  if(syncing){await syncing;if(draft&&draft.acked<draft.revision)return sync();return;}
  if(!draft||locked||draft.acked>=draft.revision)return;
  const current=draft,body=JSON.parse(JSON.stringify(current));
  syncing=call('draft_sync',{request_id:body.id,kind:body.kind,revision:body.revision,items:body.items,note:body.note||''}).then(r=>{
   if(r.state!=='queued')throw Error('Документ уже завершён или проводится. Откройте его заново.');
   current.acked=Math.max(current.acked||0,r.payload.revision);save(storeKey(current.kind),current);
   if(active&&$('live-sync'))$('live-sync').textContent='Передано на ноутбук';
  }).catch(e=>{if(active&&$('live-sync'))$('live-sync').textContent='Нет синхронизации · сканы сохранены';throw e;}).finally(()=>syncing=null);
  await syncing;if(draft===current&&current.acked<current.revision)return sync();
 }
 function product(x){return parts().find(p=>p.id===x.part_id);}
 function total(){return draft.items.reduce((sum,x)=>sum+x.quantity*(x.custom_price?Number(x.unit_price):Number(product(x)?.retail_price||0)),0);}
 function rows(value,editable){return value.items.map(x=>{const p=product(x);return '<div class="scan-product"><strong>'+esc(p?.name||x.part_id)+'</strong><small>'+esc(p?.barcode||p?.sku||'')+'</small><div class="scan-product-line"><span>'+money(x.custom_price?x.unit_price:p?.retail_price)+'</span>'+(editable?'<input data-live-qty="'+x.part_id+'" type="number" min="1" max="1000" value="'+x.quantity+'" aria-label="Количество"><button data-live-remove="'+x.part_id+'" aria-label="Удалить">×</button>':'<b>'+x.quantity+' шт.</b>')+'</div>'+(editable&&value.kind==='sale'?'<label class="own-price"><input type="checkbox" data-own="'+x.part_id+'" '+(x.custom_price?'checked':'')+'>Своя цена</label><input data-own-value="'+x.part_id+'" type="number" min="0" step="0.01" inputmode="decimal" aria-label="Своя цена" value="'+esc(x.custom_price?x.unit_price:p?.retail_price||0)+'" '+(x.custom_price?'':'hidden')+'>':'')+'</div>';}).join('');}
 function payment(){return '<fieldset class="payment-options"><legend>Способ оплаты</legend>'+[['cash','Наличные'],['card','Карта'],['transfer','Перевод']].map(([v,label])=>'<label><input type="radio" name="live-method" value="'+v+'">'+label+'</label>').join('')+'</fieldset>';}
 function draw(){
  $('live-items').innerHTML=rows(draft,true)||'<p class="scan-empty">Нажмите кнопку сканера на терминале</p>';
  $('live-total').textContent=money(total());$('live-payment').hidden=draft.kind!=='sale'||!draft.items.length;$('live-submit').hidden=!draft.items.length;
  $('live-items').querySelectorAll('input,button').forEach(el=>el.disabled=locked);
  $('live-items').querySelectorAll('[data-live-qty]').forEach(el=>el.onchange=()=>{const n=Number(el.value);if(!Number.isInteger(n)||n<1||n>1000){message('Количество от 1 до 1000',true);return;}draft.items.find(x=>x.part_id===el.dataset.liveQty).quantity=n;changed();$('live-total').textContent=money(total());});
  $('live-items').querySelectorAll('[data-live-remove]').forEach(el=>el.onclick=()=>{if(locked)return;draft.items=draft.items.filter(x=>x.part_id!==el.dataset.liveRemove);changed();draw();$('live-code').focus();});
  $('live-items').querySelectorAll('[data-own]').forEach(el=>el.onchange=()=>{const item=draft.items.find(x=>x.part_id===el.dataset.own);item.custom_price=el.checked;if(el.checked)item.unit_price=Number(product(item)?.retail_price||0);else delete item.unit_price;changed();draw();if(item.custom_price)$('live-items').querySelector('[data-own-value="'+item.part_id+'"]').focus();});
  $('live-items').querySelectorAll('[data-own-value]').forEach(el=>el.oninput=()=>{const n=Number(el.value);if(el.value===''||!Number.isFinite(n)||n<0||Math.abs(n*100-Math.round(n*100))>.00001){message('Введите цену в рублях и копейках',true);return;}draft.items.find(x=>x.part_id===el.dataset.ownValue).unit_price=n;changed();$('live-total').textContent=money(total());});
 }
 function add(code){if(locked||!code)return;const found=matchBarcode(parts(),code);if(found.length!==1){message(found.length?'Код неоднозначен':'Товар не найден. Добавьте его на ноутбуке.',true);return;}const old=draft.items.find(x=>x.part_id===found[0].id);if(old){if(old.quantity>=1000)return;old.quantity++;}else{if(draft.items.length>=40){message('Не больше 40 позиций в документе',true);return;}draft.items.push({part_id:found[0].id,quantity:1});}changed();draw();$('live-code').value='';$('live-code').focus();message('Добавлено: '+found[0].name);}
 async function finish(){
  if(!draft.items.length)throw Error('Добавьте товары');
  const method=document.querySelector('input[name="live-method"]:checked')?.value;
  if(draft.kind==='sale'&&!method)throw Error('Выберите Наличные, Карту или Перевод');
  for(const el of document.querySelectorAll('[data-live-qty]'))if(!el.checkValidity())throw Error('Количество от 1 до 1000');
  for(const el of document.querySelectorAll('[data-own-value]:not([hidden])'))if(!el.value||!el.checkValidity())throw Error('Проверьте свою цену');
  await sync();locked=true;
  try{const result=await call(draft.kind==='sale'?'live_pay':'live_receive',{id:draft.id,revision:draft.revision,payment_method:method});
   save(storeKey(draft.kind),null);const kind=draft.kind;draft=null;cleanup();await refresh().catch(()=>{});home();message(result?.cancelled?'Документ отменён':kind==='sale'?'Оплата записана, товар списан. '+money(result.total):'Приход проведён, остатки обновлены.');
  }finally{if(!draft)locked=false;else {const state=await call('job',{id:draft.id}).catch(()=>null);locked=!state||state.state!=='queued';if(active)draw();}}
 }
 async function open(kind){
  cleanup();locked=false;draft=load(storeKey(kind));
  if(draft){const r=await call('job',{id:draft.id}).catch(()=>null);if(r?.state==='done'){save(storeKey(kind),null);draft=null;}else if(r?.state==='processing')locked=true;}
  if(!draft)draft={id:uuid(),kind,revision:1,acked:0,items:[],note:''};cache();active=true;
  render('<div class="live-heading"><button id="live-back">←</button><h1>'+ (kind==='receipt'?'Приход':'Оплата')+'</h1></div><small id="live-sync">Подключаем ноутбук…</small><form id="live-scan"><input id="live-code" inputmode="none" autocomplete="off" aria-label="Штрихкод"><button type="submit" hidden>Добавить</button></form><div id="live-items"></div><section id="live-payment"><div class="total">Итого <b id="live-total"></b></div>'+payment()+'</section><button class="primary" id="live-submit">'+(kind==='sale'?'Оплатить':'Провести приход')+'</button><button class="live-cancel" id="live-cancel">Отменить документ</button>');
  draw();$('live-back').onclick=()=>{cleanup();home();};$('live-scan').onsubmit=e=>{e.preventDefault();add($('live-code').value.trim());};
  stop=bindScanner($('live-code'),$('live-scan'),()=>active&&!locked);
  document.querySelectorAll('input[name="live-method"]').forEach(el=>el.onchange=()=>$('live-code').focus());
  $('live-submit').onclick=()=>run(finish);
  $('live-cancel').onclick=()=>run(async()=>{if(!confirm('Отменить документ?'))return;await sync();await call('draft_close',{id:draft.id});save(storeKey(kind),null);draft=null;cleanup();home();});
  if(locked)message('Проверяем незавершённую операцию. Нажмите «'+(kind==='sale'?'Оплатить':'Провести приход')+'» для получения результата.',true);
  else {changed();}mirrorTimer=setInterval(()=>{if(!active||locked||!draft)return;void sync().catch(()=>{});const current=draft;void call('job',{id:current.id}).then(r=>{if(active&&!locked&&draft===current&&r?.state==='done'){save(storeKey(current.kind),null);draft=null;cleanup();void refresh().catch(()=>{});home();message(r.result?.cancelled?'Документ отменён':'Операция проведена. Остатки обновлены.');}}).catch(()=>{});},2500);
 }
 function mirrorMarkup(job){return '<div class="live-heading"><h2>Терминал · '+(job.payload.kind==='receipt'?'Приход':'Оплата')+'</h2><small>'+ (job.state==='done'?(job.result?.cancelled?'Отменён':'Проведён'):job.state==='processing'?'Проводится…':'Сканирование')+'</small></div>'+rows(job.payload,false)+(job.payload.items.length?'':'<p>Ожидаем сканирование на ТСД…</p>')+(job.state==='done'&&job.result?.total!==undefined?'<p>Оплачено '+money(job.result.total)+' · '+esc(({cash:'Наличные',card:'Карта',transfer:'Перевод'})[job.result.payment_method]||job.result.payment_method||'')+'</p>':'');}
 async function pollMirror(){
  if(terminal)return;const target=$('live-terminal-panel');if(!target)return;
  const jobs=await call('live_jobs');if(!$('live-terminal-panel')||locked)return;const chosen=target.querySelector('input[name="live-method"]:checked')?.value;jobs.sort((a,b)=>String(b.payload.updated_at||b.created_at).localeCompare(String(a.payload.updated_at||a.created_at)));
  const current=jobs.find(j=>j.state!=='done')||jobs[0],signature=JSON.stringify(current);if(signature===mirror&&target.innerHTML)return;mirror=signature;
  target.innerHTML=current?mirrorMarkup(current):'<p class="muted">Откройте «Приход» или «Оплата» на ТСД — товары появятся здесь автоматически.</p>';
  if(current&&['queued','processing'].includes(current.state)&&current.payload.items.length){
   target.insertAdjacentHTML('beforeend',(current.payload.kind==='sale'?payment():'')+'<button class="primary" id="mirror-submit">'+(current.payload.kind==='sale'?'Оплатить':'Провести приход')+'</button>');
   const selected=current.checkout?.payment_method||chosen;if(selected)target.querySelector('input[value="'+selected+'"]')?.click();
   $('mirror-submit').onclick=()=>run(async()=>{const method=current.checkout?.payment_method||target.querySelector('input[name="live-method"]:checked')?.value;if(current.payload.kind==='sale'&&!method)throw Error('Выберите способ оплаты');locked=true;try{await call(current.payload.kind==='sale'?'live_pay':'live_receive',{id:current.id,revision:current.payload.revision,payment_method:method});mirror=null;await refresh().catch(()=>{});home();message('Операция проведена, остатки обновлены.');}finally{locked=false;}});
  }
 }
 return {open,cleanup,pollMirror,hasDraft:()=>!!draft,active:()=>active};
}
