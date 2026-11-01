import {esc,money,uuid} from './client.js';

const states={cancelled:'Отменена',edited:'Исправлена',reversal:'Сторно'};
const methods={cash:'Наличные',card:'Карта',transfer:'Перевод'};

export function mountPaymentCorrections({root,call,onSaved}){
 let editable=false,disposed=false,generation=0,busy=false,pending=null;
 const dialog=document.createElement('dialog');dialog.className='payment-correction';
 dialog.setAttribute('aria-label','Исправление оплаты');root.append(dialog);
 const controls=item=>{
  const operation=item.operation;if(!operation)return '';
  const badge=states[operation.state];
  return (badge?'<small class="payment-state">'+badge+(operation.reason?' · '+esc(operation.reason):'')+(operation.changed_by?' · '+esc(operation.changed_by):'')+'</small>':'')+
   (editable&&operation.can_correct?'<div class="payment-actions"><button type="button" data-payment-edit="'+esc(operation.id)+'">Редактировать</button><button type="button" data-payment-void="'+esc(operation.id)+'">Отменить оплату</button></div>':'');
 };
 const close=()=>{if(busy)return;generation++;pending=null;dialog.close();};
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 async function open(operation_id,mode){
  if(!editable||busy||disposed)return;
  const current=++generation;pending=null;
  dialog.innerHTML='<h2>'+(mode==='void'?'Отменить оплату':'Редактировать оплату')+'</h2><p role="status">Загружаем исходную оплату…</p><button type="button" data-close>Закрыть</button>';
  dialog.querySelector('[data-close]').onclick=close;if(!dialog.open)dialog.showModal();
  try{
   const data=await call('payment_correction_preview',{operation_id});if(disposed||current!==generation)return;
   const isVoid=mode==='void';
   dialog.innerHTML='<form><h2>'+(isVoid?'Отменить оплату':'Редактировать оплату')+'</h2><p><b>'+esc(data.title)+'</b><br>'+money(data.amount)+' · '+esc(methods[data.method])+'</p>'+
    (data.items.length?'<ul>'+data.items.map(x=>'<li>'+esc(x.name)+' · '+esc(x.quantity)+' шт.</li>').join('')+'</ul>':'')+
    (isVoid?'<p>Оплата будет отменена. Другие оплаты сохранятся. История и причина отмены останутся в отчёте.</p>':
     '<label>Сумма, ₽<input name="amount" type="number" min="0.01" max="100000000" step="0.01" required value="'+data.amount+'"></label><label>Способ оплаты<select name="method">'+Object.entries(methods).map(([key,label])=>'<option value="'+key+'"'+(data.method===key?' selected':'')+'>'+label+'</option>').join('')+'</select></label>')+
    (data.original_shift_closed?'<p class="correction-note">Исходная смена закрыта. Исправление попадёт в отчёт текущей датой; итоги закрытой смены сохранятся.</p>':'')+
    (isVoid&&data.stock_return?'<label class="correction-checkbox"><input type="checkbox" name="returned" required>Товары не были выданы или уже возвращены на склад</label>':'')+
    '<label>Причина '+(isVoid?'отмены':'исправления')+'<textarea name="reason" maxlength="500" required rows="3"></textarea></label><p data-error role="status" aria-live="polite"></p><div class="payment-actions"><button type="submit">'+(isVoid?'Отменить оплату':'Сохранить изменения')+'</button><button type="button" data-close>Закрыть</button></div></form>';
   const form=dialog.querySelector('form'),status=form.querySelector('[data-error]');form.querySelector('[data-close]').onclick=close;
   form.onsubmit=async event=>{
    event.preventDefault();if(busy||disposed||!form.reportValidity())return;
    if(!pending)pending={operation_id:data.operation_id,mode,request_id:uuid(),expected_amount:data.expected_amount,expected_method:data.expected_method,reason:form.elements.reason.value.trim(),shift_id:data.default_shift_id,...(isVoid?{goods_returned:!!form.elements.returned?.checked}:{amount:Number(form.elements.amount.value),method:form.elements.method.value})};
    if(!pending.reason){pending=null;status.textContent='Укажите причину.';return;}
    busy=true;status.textContent='Сохраняем…';form.querySelectorAll('button,input,select,textarea').forEach(x=>x.disabled=true);
    try{
     await call('payment_correction',pending);
    }catch(error){
     status.textContent=error.message+' Нажмите ещё раз, чтобы проверить и повторить это же исправление.';
     // Keep the exact request after a transport failure: the server may already
     // have committed it. A validation/conflict response allows a fresh preview.
     if(error.status>=400&&error.status<500){pending=null;form.querySelectorAll('input,select,textarea').forEach(x=>x.disabled=false);}
     form.querySelectorAll('button').forEach(x=>x.disabled=false);busy=false;return;
    }
    busy=false;pending=null;dialog.close();
    try{await onSaved?.();}catch{const message=root.querySelector('[data-report-status]');if(message)message.textContent='Исправление сохранено. Обновите отчёт и остатки после восстановления связи.';}
   };
  }catch(error){if(disposed||current!==generation)return;dialog.innerHTML='<h2>Не удалось открыть оплату</h2><p role="status">'+esc(error.message)+'</p><button type="button" data-close>Закрыть</button>';dialog.querySelector('[data-close]').onclick=close;}
 }
 const clicked=event=>{const button=event.target.closest('[data-payment-edit],[data-payment-void]');if(!button||!root.contains(button))return;void open(button.dataset.paymentEdit||button.dataset.paymentVoid,button.hasAttribute('data-payment-void')?'void':'edit');};root.addEventListener('click',clicked);
 return {controls,setEditable:value=>editable=value===true,dispose(){disposed=true;generation++;root.removeEventListener('click',clicked);dialog.remove();}};
}
