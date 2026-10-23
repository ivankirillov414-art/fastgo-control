import {esc,money,uuid} from './client.js';
import {priceAdjustment} from './price-adjustment.js';

export function repairPayment({call,render,home,run,message,load,save}){
 let watching=0;
 const $=id=>document.getElementById(id);
 const summary=q=>'<section class="panel"><h2>Ремонт № '+esc(q.number)+'</h2><p>'+esc(q.vehicle)+'</p><div class="total"><span>К оплате</span><b>'+money(q.due)+'</b></div></section>';
 async function enqueue(q,usbId){
  const cacheKey=usbId?'repair:usb:'+usbId:'repair:terminal';let pending=load(cacheKey);if(!pending||pending.repair_id!==q.id){pending={request_id:uuid(),repair_id:q.id};save(cacheKey,pending);}
  const result=await call('enqueue_repair',pending);return {pending,result};
 }
 async function terminal(q){
  render('<div class="live-heading"><button id="repair-back" aria-label="Назад">←</button><h1>Оплата</h1></div>'+summary(q)+'<p id="repair-status" role="status">Передаём на ноутбук…</p>');$('repair-back').onclick=home;
  let jobId='',polling=false;
  async function poll(){if(polling||!$('repair-status'))return;polling=true;try{
   if(!jobId){const {pending}=await enqueue(q);jobId=pending.request_id;}
   const r=await call('job',{id:jobId});if(!$('repair-status'))return;
   if(r?.state==='done'){save('repair:terminal',null);home();message(r.result?.cancelled?'Сканирование оплаты отменено':'Оплата принята');return;}
   $('repair-status').textContent='Ожидаем оплату на ноутбуке';
  }catch(e){if($('repair-status'))$('repair-status').textContent=e.message;}finally{polling=false;}}
  void poll();const timer=setInterval(()=>{if(!$('repair-status'))clearInterval(timer);else void poll();},1000);
 }
 async function station(q,usbId){const {pending}=await enqueue(q,usbId);await checkout(await call('job',{id:pending.request_id}));}
 async function checkout(job){
  const latest=await call('job',{id:job.id});if(!latest)throw Error('Документ не найден');if(latest.state==='done'){home();message(latest.result?.cancelled?'Сканирование оплаты отменено':'Оплата уже проведена');return;}
  const q=latest.repair||await call('repair_quote',{repair_id:latest.payload.repair_id}),fixed=latest.checkout;
  const cacheKey='repair-price:'+latest.id,methodKey='repair-method:'+latest.id,signature=JSON.stringify([q.total,q.paid,q.revision]);let stale=false,submitting=false;
  const read=()=>{if(fixed?.total_override!==undefined)return{value:String(fixed.total_override)};const saved=load(cacheKey);return saved?.signature===signature?saved:null;};
  const editable=q.price_editable??!['issued','cancelled','returned'].includes(q.status);
  const price=priceAdjustment({prefix:'repair',base:()=>q.total,read,write:edit=>save(cacheKey,edit?{...edit,signature}:null),locked:()=>!!fixed||submitting||stale||!editable,changed:drawBalance,label:'Полная стоимость ремонта',inputLabel:'Стоимость ремонта',resetLabel:'Текущая стоимость заказа'});
  render('<div class="live-heading"><button id="repair-back" aria-label="Назад">←</button><h1>Оплата ремонта</h1></div><section class="panel"><h2>Ремонт № '+esc(q.number)+'</h2><p>'+esc(q.vehicle)+'</p>'+price.markup()+'<div class="total"><span>Уже оплачено</span><b>'+money(q.paid)+'</b></div><div class="total"><span>К оплате</span><b id="repair-due"></b></div></section><fieldset class="payment-options"><legend>Способ оплаты</legend>'+[['cash','Наличные'],['card','Безналичный расчёт'],['transfer','Перевод']].map(([value,label])=>'<label><input type="radio" name="repair-method" value="'+value+'">'+label+'</label>').join('')+'</fieldset><p id="repair-state" class="muted" role="status"></p><button type="button" id="repair-refresh" hidden>Обновить сумму ремонта</button><button class="primary" id="repair-pay">Принять оплату</button>');
  function drawBalance(){
   if(!$('repair-pay'))return;const total=price.total(),due=total===null?null:(Math.round(total*100)-Math.round(q.paid*100))/100;
   $('repair-due').textContent=due===null||due<0?'Проверьте стоимость':money(due);
   const disabled=stale||submitting||!fixed&&(!editable||due===null||due<=0);$('repair-pay').disabled=disabled;$('repair-pay').dataset.unavailable=String(disabled);
   $('repair-pay').textContent=read()&&!fixed?'Сохранить цену и принять оплату':'Принять оплату';
   if(!stale)$('repair-state').textContent=!editable?'Ремонт закрыт. Приём оплаты недоступен.':due<0?'Стоимость меньше уже внесённой оплаты. Сначала оформите возврат.':due===0?'Ремонт оплачен. Для новой суммы измените полную стоимость.':read()?'Новая полная стоимость сохранится вместе с оплатой. Остаток долга будет пересчитан.':'';
  }
  price.bind();drawBalance();$('repair-back').onclick=home;$('repair-refresh').onclick=()=>run(()=>checkout(latest));
  const method=fixed?.method||load(methodKey);for(const input of document.querySelectorAll('input[name="repair-method"]')){input.checked=input.value===method;input.disabled=!!fixed;input.onchange=()=>save(methodKey,input.value);}
  const token=++watching;let polling=false;
  const timer=setInterval(async()=>{if(token!==watching||!$('repair-pay')){clearInterval(timer);return;}if(polling||submitting)return;polling=true;try{
   const status=await call('job',{id:latest.id});if(token!==watching||!$('repair-pay'))return;
   if(status?.state==='done'){clearInterval(timer);save(cacheKey,null);save(methodKey,null);home();message(status.result?.cancelled?'Сканирование оплаты отменено на ТСД':'Оплата ремонта завершена');}
   else if(status?.checkout&&!fixed){clearInterval(timer);await checkout(status);}
   else if(status?.repair&&JSON.stringify([status.repair.total,status.repair.paid,status.repair.revision])!==signature){stale=true;price.draw();drawBalance();$('repair-state').textContent='Стоимость или данные ремонта изменились на другом устройстве. Обновите сумму и проверьте скидку перед оплатой.';$('repair-refresh').hidden=false;}
  }catch(e){if($('repair-state'))$('repair-state').textContent=e.message;}finally{polling=false;}},1000);
  $('repair-pay').onclick=()=>run(async()=>{
   const method=fixed?.method||document.querySelector('input[name="repair-method"]:checked')?.value;if(!method)throw Error('Выберите способ оплаты');
   const total=price.total();if(total===null||stale)throw Error('Проверьте стоимость ремонта');
   submitting=true;price.draw();drawBalance();
   try{await call('checkout',{id:latest.id,payment_method:method,amount:fixed?.amount??(Math.round(total*100)-Math.round(q.paid*100))/100,expected_revision:fixed?.expected_revision??q.revision,...(read()?{total_override:total}:{})});save(cacheKey,null);save(methodKey,null);home();message('Оплата ремонта № '+q.number+' записана');}catch(e){await checkout(latest);throw e;}finally{submitting=false;}
  });
 }
 return {terminal,station,checkout};
}
