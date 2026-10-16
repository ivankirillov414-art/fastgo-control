import {esc,money,uuid} from './client.js';

export function repairPayment({call,render,home,run,message,load,save}){
 const $=id=>document.getElementById(id);
 const summary=q=>'<section class="panel"><h2>Ремонт № '+esc(q.number)+'</h2><p>'+esc(q.vehicle)+'</p><p>Стоимость: '+money(q.total)+'<br>Оплачено: '+money(q.paid)+'</p><div class="total"><span>К оплате</span><b>'+money(q.due)+'</b></div></section>';
 async function terminal(q){
  let pending=load('repair:terminal');if(!pending||pending.repair_id!==q.id){pending={request_id:uuid(),repair_id:q.id};save('repair:terminal',pending);}
  render('<button id="repair-back">← Главное</button>'+summary(q)+'<p id="repair-status" role="status">Отправляем ремонт на ноутбук…</p><button id="repair-retry">Повторить передачу</button><button id="repair-check">Проверить оплату</button>');
  $('repair-back').onclick=home;
  const send=async()=>{const r=await call('enqueue_repair',pending);if(!$('repair-status'))return;$('repair-status').textContent=r.state==='done'?'Оплата уже проведена':'Ремонт передан. Выберите способ оплаты на ноутбуке.';$('repair-retry').hidden=true;};
  $('repair-retry').onclick=()=>run(send);
  $('repair-check').onclick=()=>run(async()=>{const r=await call('job',{id:pending.request_id});if(r?.state==='done'){save('repair:terminal',null);home();message('Оплата ремонта проведена.');}else $('repair-status').textContent='Ожидает оплаты на ноутбуке.';});
  try{await send();}catch(e){$('repair-status').textContent=e.message;}
 }
 async function checkout(job){
  const latest=await call('job',{id:job.id});if(!latest)throw Error('Документ не найден');if(latest.state==='done'){home();message('Оплата уже проведена.');return;}
  const q=latest.repair||await call('repair_quote',{repair_id:latest.payload.repair_id});const fixed=latest.checkout;
  render('<button id="repair-back">← Главное</button>'+summary(q)+'<fieldset class="payment-options"><legend>Способ оплаты</legend><label><input type="radio" name="repair-method" value="cash">Наличные</label><label><input type="radio" name="repair-method" value="card">Карта</label></fieldset><button class="primary" id="repair-pay">Оплатить ремонт</button><button id="repair-refresh">Обновить сумму</button>');
  $('repair-back').onclick=home;$('repair-refresh').onclick=()=>run(()=>checkout(latest));
  if(fixed){const selected=document.querySelector('input[name="repair-method"][value="'+fixed.method+'"]');if(selected)selected.checked=true;document.querySelectorAll('input[name="repair-method"]').forEach(el=>el.disabled=true);}
  $('repair-pay').disabled=!q.payable&&!fixed;
  $('repair-pay').onclick=()=>run(async()=>{const method=fixed?.method||document.querySelector('input[name="repair-method"]:checked')?.value;if(!method)throw Error('Выберите способ оплаты');await call('checkout',{id:latest.id,payment_method:method,amount:fixed?.amount??q.due,expected_revision:fixed?.expected_revision??q.revision});home();message('Оплата ремонта № '+q.number+' записана.');});
 }
 return {terminal,checkout};
}
