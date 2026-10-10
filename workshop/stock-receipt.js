import {suggest,partChoices} from './autocomplete.js';
import {api,esc,date} from './core.js';
import {printPartLabel,chooseLabels} from './inventory-ui.js';

export async function renderReceipt(ctx,token){
  const [catalog,history]=await Promise.all([api('catalog',{}, {fresh:true}),api('stock_receipts',{}, {fresh:true})]);
  const parts=catalog.parts.filter(x=>x.active!==false),key='fastgo_receipt_v1:'+ctx.me.profile_id;
  let draft;try{draft=JSON.parse(localStorage.getItem(key)||'null');}catch{}
  draft=draft||{note:'',items:[{part_id:parts[0]?.id||'',quantity:1}],request_id:crypto.randomUUID(),submitted:false};
  if(!ctx.mount(ctx.head('Приход списком','До 40 позиций за один приход','<a class="btn secondary" href="#stock">На склад</a>')+'<section id="receipt-editor"></section><section class="panel"><h2>Последние 50 приходов</h2><div id="receipt-history"></div></section>',token))return;
  const host=document.getElementById('receipt-editor');
  const saveDraft=()=>{localStorage.setItem(key,JSON.stringify(draft));ctx.setDirty(true);};
  const showReceipt=(r,target)=>{
    target.innerHTML=`<p><b>${esc(r.note)}</b> · ${date(r.created_at)}</p><small>Приход ${esc(r.id)}</small><div style="overflow:auto"><table class="records"><thead><tr><th>Товар</th><th>Принято</th><th>Остаток после строки</th><th>Штрихкод</th><th></th></tr></thead><tbody>${r.items.map((x,i)=>`<tr><td>${esc(x.name)}</td><td>${x.quantity}</td><td>${x.balance}</td><td>${esc(x.barcode)}</td><td><button type="button" class="btn ghost small" data-label="${i}">Этикетка</button></td></tr>`).join('')}</tbody></table></div><p><button type="button" class="btn secondary" data-receipt-labels>Напечатать этикетки для прихода</button></p>`;
    target.querySelector('[data-receipt-labels]').onclick=()=>chooseLabels(r.items,true).catch(e=>ctx.toast(e.message));
    target.querySelectorAll('[data-label]').forEach(b=>b.onclick=()=>printPartLabel(r.items[Number(b.dataset.label)],r.items[Number(b.dataset.label)].quantity).catch(e=>ctx.toast(e.message)));
  };
  const hist=document.getElementById('receipt-history');
  if(!history.length)hist.textContent='Приходов списком пока нет.';
  history.forEach(r=>{const d=document.createElement('details');d.innerHTML=`<summary>${date(r.created_at)} · ${esc(r.note)} · ${r.items.reduce((n,x)=>n+x.quantity,0)} шт.</summary><div></div>`;hist.append(d);showReceipt(r,d.querySelector('div'));});
  const draw=()=>{
    host.innerHTML=`<form class="panel" id="receipt-form"><fieldset ${draft.submitted?'disabled':''} style="border:0;padding:0;min-width:0"><label>Поставщик / накладная<input name="note" maxlength="500" required value="${esc(draft.note)}" placeholder="Поставщик, накладная №…"></label><p class="muted">Выберите существующую деталь или создайте новую. Одинаковые детали используют один штрихкод.</p><div id="receipt-lines"></div><button type="button" class="btn secondary" id="receipt-add" ${draft.items.length>=40?'disabled':''}>+ Позиция</button></fieldset><p id="receipt-error" class="error" role="alert"></p>${draft.submitted?'<p>Проверяем сохранение ранее отправленного прихода. Повтор использует тот же код операции.</p>':''}<button class="btn" type="submit">${draft.submitted?'Проверить и повторить сохранение':'Сохранить весь приход'}</button></form>`;
    const form=host.querySelector('form'),lines=host.querySelector('#receipt-lines');
    suggest(form.elements.note,[...new Set(history.map(r=>r.note).filter(Boolean))].map(value=>({value})),choice=>{draft.note=choice.value;saveDraft();});
    draft.items.forEach((x,i)=>{
      const row=document.createElement('section');row.className='panel';
      row.innerHTML=`<h3>Позиция ${i+1}</h3><label>Поиск товара<input type="search" data-search placeholder="Название, модель, штрихкод"></label><label>Деталь<select data-field="part_id"><option value="">+ Новая деталь</option>${parts.map(p=>`<option value="${esc(p.id)}" ${p.id===x.part_id?'selected':''}>${esc([p.name,p.model,p.sku,p.barcode].filter(Boolean).join(' · '))}</option>`).join('')}</select></label><div class="grid">${!x.part_id?['name','category','model','sku','unit_cost','retail_price'].map((f,j)=>`<label>${['Название','Категория','Модель техники','Артикул','Закупочная цена, ₽','Розничная цена, ₽'][j]}<input data-field="${f}" ${j>=4?'type="number" min="0" max="1000000000" step="0.01"':'maxlength="120"'} ${['name','category','retail_price'].includes(f)?'required':''} value="${esc(x[f]??(j>=4?0:''))}"></label>`).join(''):''}<label>Количество<input data-field="quantity" type="number" min="1" max="10000" step="1" required value="${esc(x.quantity)}"></label></div><button type="button" class="btn ghost small" data-remove>Убрать позицию</button>`;
      lines.append(row);
      const search=row.querySelector('[data-search]');
      const selected=parts.find(p=>p.id===x.part_id);search.value=selected?[selected.name,selected.model,selected.sku,selected.barcode].filter(Boolean).join(' · '):'';
      search.addEventListener('input',()=>search.setCustomValidity(search.value.trim()?'Выберите товар из подсказок или списка деталей.':''));
      suggest(search,partChoices(parts),choice=>{x.part_id=choice.item.id;saveDraft();draw();});
      row.querySelectorAll('[data-field]').forEach(input=>input.onchange=()=>{const f=input.dataset.field;x[f]=['quantity','unit_cost','retail_price'].includes(f)?Number(input.value):input.value;saveDraft();if(f==='part_id')draw();});
      row.querySelector('[data-remove]').onclick=()=>{draft.items.splice(i,1);saveDraft();draw();};
    });
    form.elements.note.oninput=e=>{draft.note=e.target.value;saveDraft();};
    host.querySelector('#receipt-add').onclick=()=>{draft.items.push({part_id:parts[0]?.id||'',quantity:1});saveDraft();draw();};
    form.onsubmit=async e=>{
      e.preventDefault();if(!draft.items.length){host.querySelector('#receipt-error').textContent='Добавьте хотя бы одну позицию';return;}
      draft.submitted=true;try{saveDraft();}catch(err){draft.submitted=false;host.querySelector('#receipt-error').textContent=err.message;return;}
      draw();const button=host.querySelector('[type=submit]');button.disabled=true;
      try{
        const result=await api('stock_receive',{note:draft.note,items:draft.items,request_id:draft.request_id});
        localStorage.removeItem(key);ctx.setDirty(false);
        host.innerHTML='<section class="panel"><h2>Приход сохранён</h2><div id="receipt-result"></div><a class="btn" href="#stock">Вернуться на склад</a></section>';
        showReceipt(result,host.querySelector('#receipt-result'));ctx.toast('Все позиции прихода сохранены');
      }catch(err){
        // Only definitive validation/permission failures permit editing; uncertain network outcomes retain the exact payload and request ID.
        if([400,403,404,409,413,422].includes(err.status)){draft.submitted=false;draft.request_id=crypto.randomUUID();saveDraft();draw();}
        host.querySelector('#receipt-error').textContent=err.message;
        host.querySelector('[type=submit]').disabled=false;
      }
    };
  };
  draw();if(localStorage.getItem(key))ctx.setDirty(true);
}
