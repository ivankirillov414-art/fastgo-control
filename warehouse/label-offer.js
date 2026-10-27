import {esc,uuid} from './client.js';

export const mobileLabelOffer=()=>!window.warehouseDesktop&&(matchMedia('(max-width: 700px)').matches||matchMedia('(pointer: coarse)').matches);

// The durable request includes the exact queue and label format. A lost reply
// must not turn a retry into another printer, another format or a stock edit.
export function offerLabelPrinting(part,quantity,{call,actor}){
 if(!part?.barcode||!Number.isInteger(quantity)||quantity<1)return;
 const key='fastgo_label_offer_v1:'+actor+':'+part.id;
 let pending=null;try{pending=JSON.parse(localStorage.getItem(key)||'null');}catch{}
 if(pending?.part_id!==part.id)pending=null;
 const dialog=document.createElement('dialog');dialog.className='barcode-print-dialog';dialog.setAttribute('aria-label','Напечатать этикетки?');
 dialog.innerHTML='<form><h2>Напечатать этикетки?</h2><p>'+esc(part.name)+'</p><p>Товар сохранён. Предлагаем напечатать <b>'+quantity+'</b> этикеток. Количество можно изменить.</p><label>Количество этикеток<input name="quantity" type="number" min="1" max="1000" step="1" required value="'+esc(pending?.quantity??quantity)+'"></label><label>Касса и термопринтер<select name="station" required aria-label="Кассовый принтер"></select></label><div class="printer-size"><label>Ширина, мм<input name="width_mm" aria-label="Ширина этикетки, мм" type="number" min="30" max="110" step="0.1" value="58" required></label><label>Высота, мм<input name="height_mm" aria-label="Высота этикетки, мм" type="number" min="20" max="200" step="0.1" value="30" required></label></div><label class="printer-remember" data-remember-label hidden><input name="remember" type="checkbox" checked>Запомнить принтер и размер на кассе</label><p data-status role="status">Ищем подключённые термопринтеры…</p><p class="error" role="alert"></p><div class="actions"><button type="button" data-close>Не печатать</button><button type="submit" class="primary" disabled>Напечатать</button></div></form>';
 document.body.append(dialog);dialog.showModal();dialog.onclose=()=>dialog.remove();
 const form=dialog.querySelector('form'),input=form.elements.quantity,station=form.elements.station,width=form.elements.width_mm,height=form.elements.height_mm,remember=form.elements.remember,rememberLabel=form.querySelector('[data-remember-label]'),button=form.querySelector('[type=submit]'),close=form.querySelector('[data-close]'),status=form.querySelector('[data-status]'),error=form.querySelector('[role=alert]');
 let busy=false,targets=[];
 const targetKey=x=>JSON.stringify([x.id,x.printer]);
 const selected=()=>targets.find(x=>targetKey(x)===station.value);
 const sizedTarget=target=>Number.isSafeInteger(target?.label_pipeline)&&target.label_pipeline>=3;
 close.onclick=()=>dialog.close();dialog.oncancel=e=>{if(busy)e.preventDefault();};
 const freeze=value=>{for(const el of [input,station,width,height,remember])el.disabled=value;};if(pending){freeze(true);close.textContent='Закрыть';}
 function showTarget(){
  const target=selected();button.disabled=!pending&&!target;
  width.value=pending?.width_mm??target?.width_mm??58;height.value=pending?.height_mm??target?.height_mm??30;
  form.querySelector('.printer-size').hidden=!sizedTarget(target)&&pending?.width_mm===undefined;
  width.disabled=height.disabled=!!pending||!sizedTarget(target);
  rememberLabel.hidden=!(target?.can_remember===true||pending?.remember_printer===true);
  remember.checked=pending?pending.remember_printer===true:target?.can_remember===true;
  remember.disabled=!!pending||target?.can_remember!==true;
  status.textContent=pending?'Повторяем сохранённое задание с тем же принтером, количеством и форматом.':!target?'Касса пока не сообщила о подключённом термопринтере.':target.online?'Этикетки напечатает выбранный принтер кассового ноутбука.':'Касса сейчас не в сети. Задание дождётся её подключения.';
 }
 void call('label_targets').then(result=>{
  if(!dialog.isConnected)return;targets=Array.isArray(result)?result:[];
  station.innerHTML=targets.map(x=>'<option value="'+esc(targetKey(x))+'">'+esc(x.name+' · '+(x.displayName||x.printer)+(x.isDefault?' · основной':''))+'</option>').join('');
  const target=pending?targets.find(x=>x.id===pending.station_id&&(!pending.printer_name||x.printer===pending.printer_name)):targets.find(x=>x.isDefault)||targets[0];
  if(target)station.value=targetKey(target);
  else if(pending){const option=document.createElement('option');option.value='pending';option.textContent='Сохранённое задание'+(pending.printer_name?' · '+pending.printer_name:'');station.append(option);station.value=option.value;}
  station.onchange=showTarget;showTarget();
 }).catch(e=>{if(dialog.isConnected){status.textContent='Список кассовых принтеров недоступен.';error.textContent=e.message;if(pending){button.disabled=false;width.value=pending.width_mm??58;height.value=pending.height_mm??30;}}});
 form.onsubmit=async e=>{
  e.preventDefault();if(busy||!form.reportValidity())return;
  const count=Number(input.value),widthMm=Number(width.value),heightMm=Number(height.value);
  if(!pending&&(!Number.isInteger(count)||count<1||count>1000||!Number.isFinite(widthMm)||widthMm<30||widthMm>110||!Number.isFinite(heightMm)||heightMm<20||heightMm>200)){error.textContent='Проверьте количество и размер этикетки';return;}
  try{
   if(!pending){
    const target=selected();if(!target)throw Error('Выберите термопринтер');
    const candidate={request_id:uuid(),part_id:part.id,quantity:count,station_id:target.id,printer_name:target.printer,remember_printer:target.can_remember===true&&remember.checked,...(sizedTarget(target)?{width_mm:widthMm,height_mm:heightMm}:{})};
    const raw=JSON.stringify(candidate);localStorage.setItem(key,raw);if(localStorage.getItem(key)!==raw)throw Error('Не удалось сохранить задание на телефоне. Повторите.');pending=candidate;
   }
   busy=true;button.disabled=true;close.disabled=true;close.textContent='Закрыть';freeze(true);error.textContent='';
   const result=await call('label_enqueue',pending);if(result?.id!==pending.request_id||!['pending','printed'].includes(result.status))throw Error('Сервер не подтвердил печать. Повторите это же задание.');
   localStorage.removeItem(key);status.textContent=result.status==='printed'?'Этикетки уже переданы принтеру. Повторно не печатаем.':'Задание на '+pending.quantity+' этикеток отправлено на кассу. Печать начнётся автоматически.';
   button.hidden=true;close.textContent='Готово';
  }catch(e){error.textContent=e.message;if([400,403,404,409,413,422].includes(e.status)){localStorage.removeItem(key);pending=null;freeze(false);width.disabled=height.disabled=!sizedTarget(selected());remember.disabled=selected()?.can_remember!==true;}else if(pending)status.textContent='Ответ не получен. Нажмите «Повторить»: код задания и параметры сохранены, дубликата не будет.';button.textContent='Повторить';button.disabled=false;}
  finally{busy=false;close.disabled=false;}
 };
 return dialog;
}
