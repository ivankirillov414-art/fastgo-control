const money=n=>Number(n||0).toLocaleString('ru-RU',{style:'currency',currency:'RUB'});

// Money is calculated in kopecks; percentages are rounded once, at the total.
export function adjustedTotal(base,edit){
 const cents=Math.round(base*100);if(!edit)return cents/100;
 const raw=String(edit.value??'').trim().replace(',','.');
 if(!/^\d+(?:\.\d{1,2})?$/.test(raw))return null;
 const value=Number(raw);if(!Number.isFinite(value)||value>1e8)return null;
 if(edit.mode!=='discount')return value;
 if(edit.unit==='percent')return value<=100?Math.round(cents*(10000-Math.round(value*100))/10000)/100:null;
 const off=Math.round(value*100);return off<=cents?(cents-off)/100:null;
}

export function priceAdjustment({prefix,base,read,write,locked=()=>false,changed=()=>{},label='Итого',inputLabel='Сумма к оплате',resetLabel='По каталогу'}){
 const $=name=>document.getElementById(prefix+'-'+name);
 const total=()=>adjustedTotal(base(),read());
 const markup=()=>'<div class="price-adjustment"><div class="total"><span>'+label+'</span><b id="'+prefix+'-total"></b></div><div class="price-actions"><button type="button" id="'+prefix+'-total-edit">✎ Изменить сумму</button><button type="button" id="'+prefix+'-discount-edit">% Скидка</button></div><div id="'+prefix+'-total-field" hidden><label>'+inputLabel+', ₽<input id="'+prefix+'-total-input" type="text" inputmode="decimal" autocomplete="off" aria-label="'+inputLabel+'"></label></div><div id="'+prefix+'-discount-field" hidden><label>Размер скидки<input id="'+prefix+'-discount-input" type="text" inputmode="decimal" autocomplete="off" aria-label="Размер скидки"></label><label>Скидка в<select id="'+prefix+'-discount-unit" aria-label="Скидка в"><option value="rub">Рублях</option><option value="percent">Процентах</option></select></label></div><p id="'+prefix+'-price-note" class="muted" role="status"></p><button type="button" id="'+prefix+'-total-reset" hidden>'+resetLabel+'</button></div>';
 function draw(){
  if(!$('total'))return;const edit=read(),value=total(),discount=edit?.mode==='discount';
  $('total').textContent=value===null?'Проверьте сумму':money(value);
  $('total-field').hidden=!edit||discount;$('discount-field').hidden=!discount;$('total-reset').hidden=!edit;
  for(const [name,v] of [['total-input',discount?'':edit?.value??''],['discount-input',discount?edit.value:''],['discount-unit',edit?.unit||'rub']])if(document.activeElement!==$(name))$(name).value=v;
  $('price-note').textContent=value===null?'Укажите корректную сумму. Скидка не может превышать стоимость.':edit?'До изменения: '+money(base())+(value<base()?' · Скидка: '+money(Math.round((base()-value)*100)/100):''):'';
  for(const name of ['total-edit','discount-edit','total-input','discount-input','discount-unit','total-reset']){$(name).disabled=locked();$(name).dataset.unavailable=String(locked());}
 }
 function bind(){
  const update=edit=>{if(locked())return;write(edit);draw();changed();};
  $('total-edit').onclick=()=>{if(locked())return;update({mode:'total',value:String(total()??base())});$('total-input').focus();$('total-input').select();};
  $('discount-edit').onclick=()=>{if(locked())return;update({mode:'discount',unit:'rub',value:'0'});$('discount-input').focus();$('discount-input').select();};
  $('total-input').oninput=()=>update({mode:'total',value:$('total-input').value});
  const discount=()=>update({mode:'discount',value:$('discount-input').value,unit:$('discount-unit').value});
  $('discount-input').oninput=discount;$('discount-unit').onchange=discount;$('total-reset').onclick=()=>update(null);draw();
 }
 return{markup,draw,bind,total};
}
