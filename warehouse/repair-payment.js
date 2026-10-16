import {esc,money,uuid} from './client.js';

export function repairPayment({call,render,home,run,message,load,save}){
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
   if(r?.state==='done'){save('repair:terminal',null);home();message('Оплата принята');return;}
   $('repair-status').textContent='Ожидаем оплату на ноутбуке';
  }catch(e){if($('repair-status'))$('repair-status').textContent=e.message;}finally{polling=false;}}
  void poll();const timer=setInterval(()=>{if(!$('repair-status'))clearInterval(timer);else void poll();},1000);
 }
 async function station(q,usbId){const {pending}=await enqueue(q,usbId);await checkout(await call('job',{id:pending.request_id}));}
 async function checkout(job){
  const latest=await call('job',{id:job.id});if(!latest)throw Error('Документ не найден');if(latest.state==='done'){home();message('Оплата уже проведена');return;}
  const q=latest.repair||await call('repair_quote',{repair_id:latest.payload.repair_id}),fixed=latest.checkout;
  render('<div class="live-heading"><button id="repair-back" aria-label="Назад">←</button><h1>Оплата</h1></div>'+summary(q)+'<fieldset class="payment-options"><legend>Способ оплаты</legend>'+[['cash','Наличные'],['card','Безналичный расчёт'],['transfer','Перевод']].map(([value,label])=>'<label><input type="radio" name="repair-method" value="'+value+'">'+label+'</label>').join('')+'</fieldset><button class="primary" id="repair-pay">Принять оплату</button>');
  $('repair-back').onclick=home;
  if(fixed){const selected=document.querySelector('input[name="repair-method"][value="'+fixed.method+'"]');if(selected)selected.checked=true;document.querySelectorAll('input[name="repair-method"]').forEach(el=>el.disabled=true);}
  $('repair-pay').disabled=!q.payable&&!fixed;
  $('repair-pay').onclick=()=>run(async()=>{const method=fixed?.method||document.querySelector('input[name="repair-method"]:checked')?.value;if(!method)throw Error('Выберите способ оплаты');try{await call('checkout',{id:latest.id,payment_method:method,amount:fixed?.amount??q.due,expected_revision:fixed?.expected_revision??q.revision});home();message('Оплата ремонта № '+q.number+' записана');}catch(e){await checkout(latest);throw e;}});
 }
 return {terminal,station,checkout};
}
