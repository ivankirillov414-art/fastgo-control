import {esc,uuid} from './client.js';

export const mobileLabelOffer=()=>!window.warehouseDesktop&&(matchMedia('(max-width: 700px)').matches||matchMedia('(pointer: coarse)').matches);

// Printing is a separate, explicit operation. A lost reply keeps the same ID,
// target and quantity; reopening the offer never submits a second stock change.
export function offerLabelPrinting(part,quantity,{call,actor}){
 if(!part?.barcode||!Number.isInteger(quantity)||quantity<1)return;
 const key='fastgo_label_offer_v1:'+actor+':'+part.id;
 let pending=null;try{pending=JSON.parse(localStorage.getItem(key)||'null');}catch{}
 if(pending?.part_id!==part.id)pending=null;
 const dialog=document.createElement('dialog');dialog.className='barcode-print-dialog';dialog.setAttribute('aria-label','Напечатать этикетки?');
 dialog.innerHTML='<form><h2>Напечатать этикетки?</h2><p>'+esc(part.name)+'</p><p>Товар сохранён. Предлагаем напечатать <b>'+quantity+'</b> этикеток. Количество можно изменить.</p><label>Количество этикеток<input name="quantity" type="number" min="1" max="1000" step="1" required value="'+esc(pending?.quantity??quantity)+'"></label><label>Печать на кассе<select name="station" required aria-label="Кассовый принтер"></select></label><p data-status role="status">Ищем подключённый кассовый принтер…</p><p class="error" role="alert"></p><div class="actions"><button type="button" data-close>Не печатать</button><button type="submit" class="primary" disabled>Напечатать</button></div></form>';
 document.body.append(dialog);dialog.showModal();dialog.onclose=()=>dialog.remove();
 const form=dialog.querySelector('form'),input=form.elements.quantity,station=form.elements.station,button=form.querySelector('[type=submit]'),close=form.querySelector('[data-close]'),status=form.querySelector('[data-status]'),error=form.querySelector('[role=alert]');
 let busy=false,targets=[];
 close.onclick=()=>dialog.close();dialog.oncancel=e=>{if(busy)e.preventDefault();};
 const freeze=value=>{input.disabled=value;station.disabled=value;};if(pending){freeze(true);close.textContent='Закрыть';}
 void call('label_targets').then(result=>{
  if(!dialog.isConnected)return;targets=Array.isArray(result)?result:[];
  station.innerHTML=targets.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name+' · '+x.printer)+'</option>').join('');
  if(pending)station.value=pending.station_id;
  const update=()=>{const target=targets.find(x=>x.id===station.value);button.disabled=!target;status.textContent=!target?'На кассе ещё не выбран термопринтер. Выберите его в FastGo на кассовом ноутбуке.':pending?'Повторяем сохранённое задание без дубликатов.':target.online?'Этикетки напечатает кассовый ноутбук.':'Касса сейчас не в сети. Задание дождётся её подключения.';};
  station.onchange=update;update();
 }).catch(e=>{if(dialog.isConnected){status.textContent='Список кассовых принтеров недоступен.';error.textContent=e.message;}});
 form.onsubmit=async e=>{
  e.preventDefault();if(busy||!form.reportValidity())return;
  const count=Number(input.value);if(!Number.isInteger(count)||count<1||count>1000){error.textContent='Введите целое количество от 1 до 1000';return;}
  try{
   if(!pending){pending={request_id:uuid(),part_id:part.id,quantity:count,station_id:station.value};const raw=JSON.stringify(pending);localStorage.setItem(key,raw);if(localStorage.getItem(key)!==raw)throw Error('Не удалось сохранить задание на телефоне. Повторите.');}
   busy=true;button.disabled=true;close.disabled=true;close.textContent='Закрыть';freeze(true);error.textContent='';
   const result=await call('label_enqueue',pending);if(result?.id!==pending.request_id||!['pending','printed'].includes(result.status))throw Error('Сервер не подтвердил печать. Повторите это же задание.');
   localStorage.removeItem(key);status.textContent=result.status==='printed'?'Этикетки уже переданы принтеру. Повторно не печатаем.':'Задание на '+pending.quantity+' этикеток отправлено на кассу. Печать начнётся автоматически.';
   button.hidden=true;close.textContent='Готово';
  }catch(e){error.textContent=e.message;if([400,403,404,409,413,422].includes(e.status)){localStorage.removeItem(key);pending=null;freeze(false);}else if(pending)status.textContent='Ответ не получен. Нажмите «Повторить»: код задания сохранён, дубликата не будет.';button.textContent='Повторить';button.disabled=false;}
  finally{busy=false;close.disabled=false;}
 };
 return dialog;
}
