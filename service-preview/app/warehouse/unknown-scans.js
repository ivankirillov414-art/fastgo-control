import {esc} from './client.js';
export function unknownScans({call,parts,refresh,run,owner,message}){
 let loading=false;
 const cancel=row=>run(async()=>{
  if(!confirm('Отменить это сканирование? Товар не будет добавлен в документ.'))return;
  const result=await call('unknown_cancel',{id:row.id});
  if(!result?.cancelled)throw Error('Код уже связан с товаром. Обновите документ на ТСД');
  document.querySelector('.unknown-dialog')?.close();await poll();message('Сканирование отменено');
 });
 async function poll(){const host=document.getElementById('unknown-scans');if(!host||loading)return;loading=true;try{
  const rows=await call('unknown_scans');if(!host.isConnected)return;
  const signature=JSON.stringify(rows);if(host._unknownSignature===signature)return;
  host._unknownSignature=signature;
  host.innerHTML=rows.length?'<h2>Неизвестные коды с ТСД</h2>'+rows.map(x=>'<div class="unknown-row"><button data-unknown="'+esc(x.id)+'">'+esc(x.payload.code)+' · '+(x.payload.document_kind==='receipt'?'Приход':'Продажа')+'</button><button data-unknown-cancel="'+esc(x.id)+'" '+(x.state!=='queued'||x.checkout?'disabled data-unavailable="true"':'')+'>Отменить сканирование</button></div>').join(''):'';
  host.querySelectorAll('[data-unknown]').forEach(b=>b.onclick=()=>open(rows.find(x=>x.id===b.dataset.unknown)));
  host.querySelectorAll('[data-unknown-cancel]').forEach(b=>b.onclick=()=>cancel(rows.find(x=>x.id===b.dataset.unknownCancel)));
 }catch(e){if(host.isConnected){host._unknownSignature=null;host.textContent='Не удалось загрузить неизвестные коды: '+e.message;}}finally{loading=false;}}
 function open(row){const dialog=document.createElement('dialog');dialog.className='unknown-dialog';const creating=!!row.checkout;dialog.innerHTML='<h2>Неизвестный код</h2><p>'+esc(row.payload.code)+'</p><form><label>Найти товар<input id="unknown-filter" placeholder="Название или артикул"></label><label>Существующая позиция<select id="unknown-part"><option value="">Выберите товар</option></select></label><button class="primary" type="submit">Связать с товаром</button></form>'+(owner()?'<details '+(creating?'open':'')+'><summary>Создать новую позицию</summary><form id="unknown-create"><label>Название<input name="name" required value="'+esc(row.checkout?.create?.name||'')+'"></label><label>Категория<input name="category" required value="'+esc(row.checkout?.create?.category||'')+'"></label><label>Цена, ₽<input name="retail_price" type="number" min="0" max="100000000" step="0.01" required value="'+esc(row.checkout?.create?.retail_price??'')+'"></label><button class="primary">Создать и связать</button></form></details>':'')+'<button data-cancel-scan '+(row.state!=='queued'||creating?'disabled data-unavailable="true"':'')+'>Отменить сканирование</button><p class="error" role="status"></p><button data-close>Закрыть</button>';document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.querySelector('[data-cancel-scan]').onclick=()=>cancel(row);dialog.onclose=()=>dialog.remove();dialog.onclick=e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}};
 const select=dialog.querySelector('#unknown-part'),filter=dialog.querySelector('#unknown-filter');const draw=()=>{const q=filter.value.toLowerCase();select.innerHTML='<option value="">Выберите товар</option>'+parts().filter(x=>x.active!==false&&(x.name+' '+(x.sku||'')).toLowerCase().includes(q)).slice(0,200).map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+' · '+esc(x.sku||x.barcode||'')+'</option>').join('');};draw();filter.oninput=draw;
 const submit=payload=>run(async()=>{try{await call('unknown_resolve',{id:row.id,...payload});await refresh();dialog.close();await poll();message('Код связан. ТСД автоматически добавит товар в документ.');}catch(e){dialog.querySelector('.error').textContent=e.message;throw e;}});
 dialog.querySelector('form').onsubmit=e=>{e.preventDefault();if(!select.value)return;void submit({part_id:select.value});};if(creating){dialog.querySelector('form button').disabled=true;select.disabled=true;}
 const create=dialog.querySelector('#unknown-create');if(create){if(creating)create.querySelectorAll('input').forEach(i=>i.readOnly=true);create.onsubmit=e=>{e.preventDefault();const data=new FormData(create);void submit({create:{name:data.get('name'),category:data.get('category'),retail_price:Number(data.get('retail_price'))}});};}
 }
 return {poll};
}
