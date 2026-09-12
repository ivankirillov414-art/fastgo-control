import {api,esc,money,csvDownload} from './core.js';

const ZXING_URL=new URL('../vendor/zxing-browser-0.2.1.min.js',import.meta.url).href;
const BARCODE_URL=new URL('../vendor/jsbarcode-3.12.3.min.js',import.meta.url).href;
let me=null;
let catalogCache=null;
let enhancing=false;
const cart=new Map();
let pendingSale=null;
const saleStore=()=> 'fastgo_sale_draft_v1:'+me.profile_id;
function saveSale(){if(me)localStorage.setItem(saleStore(),JSON.stringify({cart:[...cart.values()],pendingSale}));}
function restoreSale(){if(!me||cart.size)return;try{const d=JSON.parse(localStorage.getItem(saleStore())||'null');if(d){for(const x of d.cart||[])cart.set(x.part.id,x);pendingSale=d.pendingSale||null;}}catch{}}


const $=id=>document.getElementById(id);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const loadScript=(src,globalName)=>new Promise((resolve,reject)=>{
  if(window[globalName])return resolve(window[globalName]);
  const old=[...document.scripts].find(s=>s.src===src);
  if(old){old.addEventListener('load',()=>resolve(window[globalName]),{once:true});old.addEventListener('error',reject,{once:true});return;}
  const s=document.createElement('script');s.src=src;s.defer=true;s.onload=()=>resolve(window[globalName]);s.onerror=()=>reject(new Error('Не удалось загрузить модуль сканера'));document.head.appendChild(s);
});

async function getCatalog(force=false){
  if(force||!catalogCache)catalogCache=await api('catalog');
  return catalogCache;
}
function ownDialog(){
  let d=$('inventory-dialog');
  if(!d){d=document.createElement('dialog');d.id='inventory-dialog';d.className='inventory-dialog';document.body.appendChild(d);}
  return d;
}
function closeDialog(){const d=ownDialog();if(d.open)d.close();}
function showDialog(title,body,footer=''){
  const d=ownDialog();
  d.innerHTML=`<div class="inv-head"><div><small>FASTGO · СКЛАД</small><h2>${esc(title)}</h2></div><button type="button" class="inv-icon" data-inv-close aria-label="Закрыть">✕</button></div><div class="inv-body">${body}</div>${footer?`<div class="inv-foot">${footer}</div>`:''}`;
  d.querySelectorAll('[data-inv-close]').forEach(b=>b.onclick=closeDialog);
  if(!d.open)d.showModal();
  return d;
}
function notice(text,type='ok'){
  let n=$('inventory-notice');if(!n){n=document.createElement('div');n.id='inventory-notice';document.body.appendChild(n);}
  n.className='inventory-notice '+type;n.textContent=text;requestAnimationFrame(()=>n.classList.add('show'));setTimeout(()=>n.classList.remove('show'),3200);
}
function paymentLabel(v){return({cash:'Наличные',card:'Карта',transfer:'Перевод'})[v]||v;}
function fileToBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]||'');r.onerror=()=>reject(new Error('Не удалось прочитать фото'));r.readAsDataURL(file);});}

async function scanCode(title='Сканировать штрих-код'){
  return new Promise(async resolve=>{
    let done=false,controls=null;
    const finish=value=>{if(done)return;done=true;try{controls?.stop();}catch{}closeDialog();resolve(value||null);};
    const d=showDialog(title,`<div class="scan-box"><video id="inventory-video" muted playsinline></video><div class="scan-line"></div></div><p class="muted">Наведите камеру на Code 128. Если камера недоступна, введите код вручную.</p><form id="manual-barcode" class="inv-inline"><input id="manual-code" autocomplete="off" placeholder="FGP-00000001" inputmode="text"><button class="btn secondary">Найти</button></form><p id="scan-status" class="muted">Запускаем камеру…</p>`,`<button class="btn ghost" data-cancel>Отмена</button>`);
    d.querySelector('[data-cancel]').onclick=()=>finish(null);
    d.addEventListener('close',()=>{try{controls?.stop();}catch{}if(!done){done=true;resolve(null);}},{once:true});
    $('manual-barcode').onsubmit=e=>{e.preventDefault();const v=$('manual-code').value.trim();if(v)finish(v);};
    try{
      await loadScript(ZXING_URL,'ZXingBrowser');
      const reader=new ZXingBrowser.BrowserMultiFormatReader();
      controls=await reader.decodeFromConstraints({audio:false,video:{facingMode:{ideal:'environment'}}},$('inventory-video'),(result)=>{
        if(result?.getText)finish(result.getText());
      });
      if(done){controls?.stop();}else $('scan-status').textContent='Камера активна';
    }catch(e){
      if(!done)$('scan-status').textContent='Камера не запустилась. Введите код вручную.';
    }
  });
}

async function partByCode(code){
  if(!code)return null;
  return api('part_by_barcode',{barcode:String(code).trim()});
}

async function printPartLabel(part){
  const w=window.open('','_blank','width=520,height=420');if(!w)throw new Error('Разрешите всплывающие окна для печати');
  w.document.write('<p>Подготовка этикетки…</p>');
  await loadScript(BARCODE_URL,'JsBarcode');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  JsBarcode(svg,part.barcode,{format:'CODE128',width:2,height:55,displayValue:true,fontSize:15,margin:3});
  w.document.open();w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(part.barcode)}</title><style>@page{size:58mm 30mm;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}.label{width:58mm;height:30mm;padding:2mm;display:flex;flex-direction:column;justify-content:center;align-items:center;overflow:hidden}.name{font-size:9pt;font-weight:700;text-align:center;line-height:1.05;max-height:8mm;overflow:hidden}.meta{font-size:7pt;margin:1mm 0}svg{max-width:54mm;height:14mm}</style></head><body><div class="label"><div class="name">${esc(part.name)}${part.model?` · ${esc(part.model)}`:''}</div><div class="meta">${esc(part.category||'Без категории')} · ${money(part.retail_price)}</div>${svg.outerHTML}</div><script>onload=()=>{setTimeout(()=>{print();},120)};<\/script></body></html>`);
  w.document.close();
}

async function printAllLabels(){
  const w=window.open('','_blank','width=800,height=700');if(!w)throw new Error('Разрешите всплывающие окна для печати');w.document.write('<p>Подготовка этикеток…</p>');
  const c=await getCatalog(true);const parts=(c.parts||[]).filter(x=>x.active!==false);
  if(!parts.length){w.close();return notice('Нет товаров для печати','bad');}
  await loadScript(BARCODE_URL,'JsBarcode');
  const labels=[];
  for(const part of parts){
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    JsBarcode(svg,part.barcode,{format:'CODE128',width:1.7,height:45,displayValue:true,fontSize:13,margin:2});
    labels.push(`<div class="label"><div class="name">${esc(part.name)}${part.model?` · ${esc(part.model)}`:''}</div><div class="meta">${esc(part.category||'Без категории')}</div>${svg.outerHTML}</div>`);
  }
  w.document.open();w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Этикетки FastGo</title><style>@page{size:58mm 30mm;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}.label{width:58mm;height:30mm;padding:2mm;page-break-after:always;display:flex;flex-direction:column;justify-content:center;align-items:center;overflow:hidden}.name{font-size:9pt;font-weight:700;text-align:center;line-height:1.05;max-height:8mm;overflow:hidden}.meta{font-size:7pt;margin:1mm 0}svg{max-width:54mm;height:14mm}</style></head><body>${labels.join('')}<script>onload=()=>setTimeout(()=>print(),150);<\/script></body></html>`);w.document.close();
}

function exportInventory(){
  getCatalog(true).then(c=>csvDownload('FastGo-склад.csv',['Категория','Модель / название','Модель','SKU','Штрих-код','Ед.','Закупка','Продажа','Остаток','Активен'],(c.parts||[]).map(x=>[x.category||'',x.name,x.model||'',x.sku||'',x.barcode||'',x.unit||'шт',x.unit_cost||0,x.retail_price||0,x.quantity||0,x.active===false?'Нет':'Да']))).then(()=>notice('Файл для Excel подготовлен')).catch(e=>notice(e.message,'bad'));
}

async function receiveByBarcode(){
  const code=await scanCode('Приёмка товара по штрих-коду');if(!code)return;
  let part;try{part=await partByCode(code);}catch(e){
    if(me&&['owner','admin'].includes(me.role)&&confirm('Такого товара ещё нет. Создать новую позицию?'))return newPartForm(code);
    return notice(e.message,'bad');
  }
  const d=showDialog('Поступление на склад',`<div class="inv-product"><b>${esc(part.name)}</b><small>${esc(part.model||part.sku||part.barcode)}</small><strong>Сейчас: ${part.quantity} ${esc(part.unit||'шт')}</strong></div><form id="receipt-form"><label>Количество<input name="quantity" type="number" min="1" step="1" value="1" required></label><label>Основание / поставщик<input name="note" value="Приёмка по штрих-коду" required></label></form>`,`<button class="btn ghost" data-inv-close>Отмена</button><button class="btn" id="receipt-save">Принять</button>`);
  const receiptId=crypto.randomUUID();
  $('receipt-save').onclick=async()=>{const f=new FormData($('receipt-form'));const q=Number(f.get('quantity'));if(!Number.isInteger(q)||q<1)return notice('Укажите количество','bad');try{$('receipt-save').disabled=true;await api('stock',{part_id:part.id,movement_type:'receipt',quantity:q,note:String(f.get('note')||'Приёмка по штрих-коду'),request_id:receiptId});catalogCache=null;closeDialog();notice(`Принято: ${part.name} +${q}`);setTimeout(()=>location.hash.startsWith('#stock')&&location.reload(),250);}catch(e){notice(e.message,'bad');$('receipt-save').disabled=false;}};
}

async function uploadPartPhoto(part,file,categoryPrimary){
  if(!file)return;
  if(file.size>5*1024*1024)throw new Error('Фото должно быть не больше 5 МБ');
  const base64=await fileToBase64(file);
  await api('part_photo_upload',{part_id:part.id,content_type:file.type,content_base64:base64,primary_for_category:categoryPrimary});
}

async function photoDialog(part){
  const photos=await api('part_photos',{part_id:part.id});
  const editable=['owner','admin'].includes(me.role);
  showDialog('Фотографии: '+part.name,`<div id="part-photo-list" class="photo-grid"></div>${editable?'<label>Добавить фотографию<input id="part-photo-file" type="file" accept="image/jpeg,image/png,image/webp"></label><label><input id="part-photo-category" type="checkbox"> Основное фото категории</label>':''}`,`<button class="btn ghost" data-inv-close>Закрыть</button>${editable?'<button class="btn" id="part-photo-upload">Загрузить</button>':''}`);
  const host=$('part-photo-list');
  if(!photos.length)host.textContent='Фотографий пока нет.';
  for(const p of photos){
    const card=document.createElement('div'),img=document.createElement('img');img.alt=part.name;card.appendChild(img);host.appendChild(card);
    if(editable){const button=document.createElement('button');button.className='btn secondary small';button.textContent=p.primary?'Основное фото · выбрать для категории':'Сделать основным';button.onclick=async()=>{try{button.disabled=true;await api('part_photo_primary',{part_id:part.id,photo_id:p.id,primary_for_category:$('part-photo-category').checked});catalogCache=null;await photoDialog(part);}catch(e){notice(e.message,'bad');button.disabled=false;}};card.appendChild(button);}
    try{const result=await api('part_photo_url',{part_id:part.id,photo_id:p.id});if(host.isConnected)img.src=result.url;}catch{img.alt='Фото не загрузилось';}
  }
  if(editable)$('part-photo-upload').onclick=async()=>{const button=$('part-photo-upload');try{const file=$('part-photo-file').files[0];if(!file)throw new Error('Выберите фотографию');button.disabled=true;await uploadPartPhoto(part,file,$('part-photo-category').checked);catalogCache=null;await photoDialog(part);}catch(e){notice(e.message,'bad');button.disabled=false;}};
}

async function maintenanceDialog(){
  const c=await getCatalog(true);
  if(!c.capabilities?.atomic_writes)throw new Error('Для проверки копий и переноса файлов сначала обновите Google API.');
  const [status,files]=await Promise.all([api('backup_status'),api('migration_manifest')]);
  const remaining=files.filter(x=>!x.migrated);
  showDialog('Резервные копии и старые файлы',`<p>Ежедневное расписание: ${status.trigger_count===1?'установлено':'требует настройки'}.</p><p>Последняя проверенная копия: ${esc(status.last_success||'нет подтверждения')}.</p><p>Проверка восстановления: ${esc(status.restore_verified_at||'не выполнена')}.</p>${status.last_error?`<p class="error">${esc(status.last_error)}</p>`:''}<p>Перенесено файлов: ${files.length-remaining.length} из ${files.length}. Без связи с приёмкой: ${files.filter(x=>!x.record_id).length}.</p><p id="migration-progress" aria-live="polite"></p>`,`<button class="btn ghost" data-inv-close>Закрыть</button>${remaining.length?'<button class="btn" id="migrate-files">Перенести и проверить файлы</button>':''}`);
  if(remaining.length)$('migrate-files').onclick=async()=>{
    const button=$('migrate-files'),progress=$('migration-progress');button.disabled=true;
    try{for(let i=0;i<remaining.length;i++){progress.textContent=`Перенос ${i+1} из ${remaining.length}…`;await api('migrate_legacy_file',{object_id:remaining[i].object_id});}progress.textContent='Файлы скопированы и проверены по контрольным суммам. Исходники сохранены.';button.remove();}catch(e){progress.textContent=e.message;button.disabled=false;}
  };
}

async function newPartForm(prefill=''){
  const c=await getCatalog();const photoReady=!!c.capabilities?.private_product_photos;const categories=[...new Set((c.categories||[]).map(x=>x.name).filter(Boolean))].sort();
  const options=categories.map(x=>`<option value="${esc(x)}"></option>`).join('');
  const d=showDialog('Новая товарная позиция',`<form id="new-part-form" class="inv-form"><label>Категория<input name="category" list="part-categories" required placeholder="Подшипники"><datalist id="part-categories">${options}</datalist></label><label>Наименование<input name="name" required placeholder="Подшипник рулевой 2008 2RS"></label><label>Модель / размер<input name="model" placeholder="2008 2RS"></label><label>Артикул / SKU<input name="sku" value="${esc(prefill&&!String(prefill).startsWith('FGP-')?prefill:'')}"></label><div class="inv-grid"><label>Закупка, ₽<input name="unit_cost" type="number" min="0" step="0.01" value="0"></label><label>Продажа, ₽<input name="retail_price" type="number" min="0" step="0.01" value="0" required></label><label>Количество<input name="initial_quantity" type="number" min="0" step="1" value="0"></label><label>Ед.<input name="unit" value="шт"></label></div>${photoReady?'<p class="muted">Фотографии доступны только сотрудникам мастерской.</p>':'<p class="muted">Загрузка фото станет доступна после обновления сервера.</p>'}<label>Основное фото<input name="photo" ${photoReady?'':'disabled'} type="file" accept="image/jpeg,image/png,image/webp" capture="environment"></label><label class="inv-check"><input name="category_primary" ${photoReady?'':'disabled'} type="checkbox"> Сделать это фото основным и для категории</label><p class="muted">Штрих-код FastGo будет присвоен автоматически после сохранения.</p></form>`,`<button class="btn ghost" data-inv-close>Отмена</button><button class="btn" id="new-part-save">Создать и принять</button>`);
  let savedPart=null,stockReceived=false;const initialReceiptId=crypto.randomUUID();
  $('new-part-save').onclick=async()=>{
    const form=$('new-part-form'),f=new FormData(form);const initial=Number(f.get('initial_quantity')||0);if(!form.reportValidity())return;if(!Number.isInteger(initial)||initial<0)return notice('Количество должно быть целым','bad');
    try{
      $('new-part-save').disabled=true;
      const part=savedPart||(savedPart=await api('part_save',{name:f.get('name'),category:f.get('category'),model:f.get('model'),sku:f.get('sku'),unit_cost:Number(f.get('unit_cost')||0),retail_price:Number(f.get('retail_price')||0),unit:f.get('unit')||'шт'}));
      if(initial>0&&!stockReceived){await api('stock',{part_id:part.id,movement_type:'receipt',quantity:initial,note:'Первичная ручная приёмка',request_id:initialReceiptId});stockReceived=true;}
      const file=f.get('photo');if(file?.size)await uploadPartPhoto(part,file,f.get('category_primary')==='on');
      catalogCache=null;closeDialog();notice(`Товар создан: ${part.barcode}`);
      if(confirm(`Штрих-код ${part.barcode} создан. Напечатать этикетку?`))await printPartLabel(part);
    }catch(e){notice(e.message,'bad');$('new-part-save').disabled=false;}
  };
}

function renderCart(){
  saveSale();
  const host=$('sales-cart');if(!host)return;
  const rows=[...cart.values()];const total=rows.reduce((s,x)=>s+x.qty*Number(x.part.retail_price||0),0);
  host.innerHTML=rows.length?rows.map(x=>`<div class="cart-row"><div><b>${esc(x.part.name)}</b><small>${esc(x.part.barcode)} · остаток ${x.part.quantity}</small></div><div class="cart-qty"><button data-minus="${x.part.id}">−</button><strong>${x.qty}</strong><button data-plus="${x.part.id}">+</button></div><b>${money(x.qty*Number(x.part.retail_price||0))}</b><button class="inv-icon" data-remove="${x.part.id}">✕</button></div>`).join('')+`<div class="cart-total"><span>Итого</span><strong>${money(total)}</strong></div>`:`<div class="empty"><strong>Корзина пустая</strong><p>Сканируйте штрих-код товара или найдите его вручную.</p></div>`;
  host.querySelectorAll('[data-minus]').forEach(b=>b.onclick=()=>{const x=cart.get(b.dataset.minus);if(x){x.qty--;if(x.qty<1)cart.delete(b.dataset.minus);renderCart();}});
  host.querySelectorAll('[data-plus]').forEach(b=>b.onclick=()=>{const x=cart.get(b.dataset.plus);if(x&&x.qty<x.part.quantity){x.qty++;renderCart();}else notice('Больше остатка на складе добавить нельзя','bad');});
  host.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{cart.delete(b.dataset.remove);renderCart();});
  host.querySelectorAll('button').forEach(b=>b.disabled=!!pendingSale);['sale-payment','sale-note','sale-search','sale-scan'].forEach(id=>{if($(id))$(id).disabled=!!pendingSale;});
  const btn=$('sale-complete');if(btn){btn.disabled=!rows.length;btn.textContent=pendingSale?'Проверить и завершить продажу':'Провести продажу';}
}
function addToCart(part){
  if(Number(part.quantity)<=0)return notice('Этого товара нет в наличии','bad');
  const x=cart.get(part.id);if(x){if(x.qty>=part.quantity)return notice('В корзине уже весь доступный остаток','bad');x.qty++;}else cart.set(part.id,{part,qty:1});renderCart();
}

async function openSales(){
  if(!me)me=await api('me');restoreSale();if(!['owner','admin','receiver','manager'].includes(me.role))return notice('У вашей роли нет доступа к продажам','bad');
  const c=await getCatalog(true);const parts=(c.parts||[]).filter(x=>x.active!==false);
  const d=showDialog('Продажи',`<div class="sales-tools"><button class="btn" id="sale-scan">▣ Сканировать</button><div class="inv-search"><input id="sale-search" placeholder="Поиск по названию, модели, SKU"><div id="sale-results"></div></div></div><div id="sales-cart"></div><div class="inv-form"><label>Оплата<select id="sale-payment"><option value="cash">Наличные</option><option value="card">Карта</option><option value="transfer">Перевод</option></select></label><label>Комментарий<input id="sale-note" placeholder="Необязательно"></label></div>`,`<button class="btn ghost" data-inv-close>Закрыть</button><button class="btn" id="sale-complete" disabled>Провести продажу</button>`);
  const search=$('sale-search'),results=$('sale-results');
  const showResults=()=>{const q=search.value.trim().toLowerCase();if(q.length<2){results.innerHTML='';return;}const found=parts.filter(x=>(`${x.name} ${x.model||''} ${x.sku||''} ${x.barcode||''}`).toLowerCase().includes(q)).slice(0,12);results.innerHTML=found.map(x=>`<button type="button" data-pick="${x.id}"><span>${esc(x.name)}${x.model?` · ${esc(x.model)}`:''}</span><small>${esc(x.barcode)} · ${x.quantity} шт. · ${money(x.retail_price)}</small></button>`).join('');results.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{addToCart(found.find(x=>x.id===b.dataset.pick));search.value='';results.innerHTML='';});};
  search.oninput=showResults;
  $('sale-scan').onclick=async()=>{const code=await scanCode('Сканирование продажи');if(!code){await openSales();return;}try{addToCart(await partByCode(code));}catch(e){notice(e.message,'bad');}finally{if(!ownDialog().open)openSales();}};
  if(pendingSale?.payload){$('sale-payment').value=pendingSale.payload.payment_method;$('sale-note').value=pendingSale.payload.note||'';}
  renderCart();
  $('sale-complete').onclick=async()=>{
    if(!cart.size)return;const btn=$('sale-complete');btn.disabled=true;
    try{const payload={payment_method:$('sale-payment').value,note:$('sale-note').value,items:[...cart.values()].map(x=>({part_id:x.part.id,quantity:x.qty}))};const signature=JSON.stringify(payload);if(!pendingSale)pendingSale={signature,id:crypto.randomUUID(),payload};saveSale();const result=await api('sale',{request_id:pendingSale.id,...(pendingSale.payload||payload)});pendingSale=null;cart.clear();saveSale();catalogCache=null;closeDialog();notice(`Продажа №${result.sale_number} · ${money(result.total)}`);}catch(e){if([400,403,404,409,413,422].includes(e.status))pendingSale=null;saveSale();notice(e.message,'bad');renderCart();}
  };
}

async function showSalesHistory(){
  try{const data=await api('sales',{limit:50});showDialog('Последние продажи',data.items?.length?`<div class="inv-list">${data.items.map(x=>`<div><b>Продажа №${x.sale_number}</b><span>${new Date(x.created_at).toLocaleString('ru-RU')} · ${paymentLabel(x.payment_method)}</span><strong>${money(x.total)}</strong></div>`).join('')}</div>`:`<div class="empty"><strong>Продаж пока нет</strong></div>`,`<button class="btn" data-inv-close>Закрыть</button>`);}catch(e){notice(e.message,'bad');}
}

async function enhance(){
  if(!document.querySelector('.shell'))return;
  if(enhancing)return;enhancing=true;
  try{
    if(!me){try{me=await api('me');}catch{return;}}
    const nav=document.querySelector('.sidebar .nav');
    if(nav&&!nav.querySelector('[data-sales-nav]')&&['owner','admin','receiver','manager'].includes(me.role)){
      const a=document.createElement('a');a.href='#';a.dataset.salesNav='1';a.innerHTML='<span class="nav-mark" aria-hidden="true">▦</span>Продажи';a.onclick=e=>{e.preventDefault();openSales();};
      const stock=[...nav.querySelectorAll('a')].find(x=>x.getAttribute('href')==='#stock');stock?.after(a)||nav.appendChild(a);
    }
    if(location.hash.startsWith('#stock')){
      const head=document.querySelector('.workspace .pagehead');
      if(head&&!head.querySelector('[data-inv-tools]')){
        const box=document.createElement('div');box.dataset.invTools='1';box.className='inv-toolbar';box.innerHTML=`<button class="btn secondary" data-receive>▣ Приёмка сканером</button>${['owner','admin'].includes(me.role)?'<button class="btn secondary" data-newpart>+ Новый товар</button>':''}<button class="btn ghost" data-labels>Этикетки</button><button class="btn ghost" data-export>Excel</button><button class="btn ghost" data-history>Продажи</button>${['owner','admin'].includes(me.role)?'<button class="btn ghost" data-maintenance>Копии и файлы</button>':''}`;
        head.appendChild(box);box.querySelector('[data-receive]').onclick=receiveByBarcode;box.querySelector('[data-newpart]')&&(box.querySelector('[data-newpart]').onclick=()=>newPartForm());box.querySelector('[data-labels]').onclick=()=>printAllLabels().catch(e=>notice(e.message,'bad'));box.querySelector('[data-export]').onclick=exportInventory;box.querySelector('[data-history]').onclick=showSalesHistory;const maintenance=box.querySelector('[data-maintenance]');if(maintenance)maintenance.onclick=()=>maintenanceDialog().catch(e=>notice(e.message,'bad'));
      }
      const table=document.querySelector('.workspace table.records');
      if(table&&!table.dataset.barcodeEnhanced){
        table.dataset.barcodeEnhanced='1';
        const c=await getCatalog();const map=new Map((c.parts||[]).map(x=>[x.name,x]));
        table.querySelectorAll('tbody tr').forEach(tr=>{const name=tr.querySelector('td b')?.textContent||'';const id=tr.querySelector('[data-editpart]')?.dataset.editpart||tr.querySelector('[data-stock]')?.dataset.stock;const p=c.parts.find(x=>x.id===id)||map.get(name);if(!p)return;if(c.capabilities?.private_product_photos){const button=document.createElement('button');button.className='btn ghost small';button.textContent='Фото';button.onclick=()=>photoDialog(p).catch(e=>notice(e.message,'bad'));tr.lastElementChild.appendChild(button);}const small=tr.querySelector('td small');if(small)small.innerHTML=`${esc(p.sku||'Без артикула')} · <b>${esc(p.barcode)}</b>`;tr.addEventListener('dblclick',()=>printPartLabel(p).catch(e=>notice(e.message,'bad')));});
      }
    }
  }finally{enhancing=false;}
}

const observer=new MutationObserver(()=>{clearTimeout(window.__fastgoInvTimer);window.__fastgoInvTimer=setTimeout(enhance,60);});
observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>setTimeout(enhance,80));
window.addEventListener('workshop-session-cleared',()=>{me=null;catalogCache=null;pendingSale=null;cart.clear();closeDialog();});
setTimeout(enhance,120);
