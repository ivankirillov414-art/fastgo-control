import {mountProductSteps} from './product-steps.js';
import {priceAdjustment} from '../warehouse/price-adjustment.js';
import {preparePartPhoto,fileBase64} from './photo-upload.js';
import {displayPrivatePhoto} from './private-photo.js';
import {uploadStatus,holdUpload} from './upload-ui.js';
import {createSaleCamera} from './sale-camera.js';
import {equipmentTypes,equipmentType} from './equipment-core.js';
import {canSell,api,esc,money,csvDownload} from './core.js';
import {labelRows,labelJobs,labelDocument,LABELS_PER_SHEET} from './label-layout.js';
import {loadLibrary as loadScript} from './library-loader.js';
import {loadProductIntake,startProductIntake,continueProductIntake} from './product-intake.js';
import {offerLabelPrinting,mobileLabelOffer} from '../warehouse/label-offer.js';

const ZXING_URL=new URL('../vendor/zxing-browser-0.2.1.min.js',import.meta.url).href;
const BARCODE_URL=new URL('../vendor/jsbarcode-3.12.3.min.js',import.meta.url).href;
let me=null;
let catalogCache=null;
let enhancing=false;
const cart=new Map();
let pendingSale=null,saleBusy=false,saleAdjustment=null,cartPrice=null;
const saleStore=()=> 'fastgo_sale_draft_v1:'+me.profile_id;
function saveSale(){if(me)localStorage.setItem(saleStore(),JSON.stringify({cart:[...cart.values()],pendingSale,saleAdjustment}));}
function restoreSale(){if(!me||cart.size)return;try{const d=JSON.parse(localStorage.getItem(saleStore())||'null');if(d){for(const x of d.cart||[])cart.set(x.part.id,x);pendingSale=d.pendingSale||null;saleAdjustment=d.saleAdjustment||null;}}catch{}}


const $=id=>document.getElementById(id);
const wait=ms=>new Promise(r=>setTimeout(r,ms));


async function getCatalog(force=false){
  return api('catalog',{}, {fresh:force});
}
function ownDialog(){
  let d=$('inventory-dialog');
  if(!d){d=document.createElement('dialog');d.id='inventory-dialog';d.className='inventory-dialog';document.body.appendChild(d);}
  return d;
}
function closeDialog(){const d=ownDialog();if(d.open)d.close();}
function showDialog(title,body,footer=''){
  const d=ownDialog();
  d.classList.remove('sale-dialog');
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
      if(done)return;
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
  if(String(code).trim().toUpperCase().startsWith('FGC-')){const e=new Error('Это штрих-код категории. Для прихода или продажи выберите конкретную модель с кодом FGP.');e.status=400;throw e;}
  return api('part_by_barcode',{barcode:String(code).trim()});
}

export async function printPartLabel(part,quantity=1){
  return chooseLabels([{...part,quantity}],true);
}

export async function chooseLabels(parts,received=false){
  const rows=labelRows(parts,received);
  if(!rows.length)return notice('Нет товаров со штрихкодом для печати','bad');
  const d=showDialog('Печать этикеток',`<p class="muted">Выберите товары и количество этикеток. Это не меняет остатки на складе.</p><label>Поиск товара<input type="search" id="label-search" placeholder="Название, модель, артикул или штрихкод"></label><div class="inv-inline"><button type="button" class="btn ghost" id="label-select">Выбрать найденные</button><button type="button" class="btn ghost" id="label-clear">Снять весь выбор</button></div><div style="max-height:45vh;overflow:auto"><table class="records" style="width:100%"><thead><tr><th>Печатать</th><th>Товар</th><th>Этикеток, шт.</th></tr></thead><tbody id="label-rows"></tbody></table></div><label>Формат печати<select id="label-format"><option value="a4">Лист A4 — 24 этикетки 58 × 30 мм на листе</option><option value="roll">Принтер этикеток — 58 × 30 мм</option></select></label><p class="muted">В окне принтера установите масштаб 100% и отключите колонтитулы. Для листов с наклейками нужна соответствующая раскладка.</p><p id="label-total" role="status"></p><p id="label-error" class="error" role="alert"></p>`,`<button type="button" class="btn ghost" data-inv-close>Отмена</button><button type="button" class="btn" id="label-print">Напечатать выбранные</button>`);
  const search=d.querySelector('#label-search'),format=d.querySelector('#label-format'),button=d.querySelector('#label-print');
  const visible=()=>rows.filter(x=>[x.part.name,x.part.model,x.part.sku,x.part.barcode,x.part.category].filter(Boolean).join(' ').toLowerCase().includes(search.value.trim().toLowerCase()));
  const update=()=>{
    let jobs;try{jobs=labelJobs(rows);d.querySelector('#label-error').textContent='';}catch(e){d.querySelector('#label-error').textContent=rows.some(x=>x.selected)?e.message:'';}
    button.disabled=!jobs;
    const total=jobs?.reduce((n,x)=>n+x.quantity,0)||0;
    d.querySelector('#label-total').textContent=`Выбрано товаров: ${rows.filter(x=>x.selected).length} · Этикеток: ${total}`+(total&&format.value==='a4'?` · Листов A4: ${Math.ceil(total/LABELS_PER_SHEET)}`:'');
  };
  const draw=()=>{
    const found=visible();
    d.querySelector('#label-rows').innerHTML=found.map(x=>`<tr data-row="${rows.indexOf(x)}"><td><input type="checkbox" data-select style="width:22px;height:22px;min-height:22px;padding:0" aria-label="${esc('Печатать '+x.part.name)}" ${x.selected?'checked':''}></td><td><b>${esc(x.part.name)}</b><br><small>${esc([x.part.model,x.part.sku,x.part.barcode].filter(Boolean).join(' · '))}</small></td><td><input type="number" data-quantity aria-label="${esc('Количество этикеток: '+x.part.name)}" min="1" max="10000" step="1" value="${esc(x.quantity)}" style="width:95px"></td></tr>`).join('')||'<tr><td colspan="3">Товары не найдены</td></tr>';
    d.querySelectorAll('[data-row]').forEach(tr=>{const x=rows[Number(tr.dataset.row)];tr.querySelector('[data-select]').onchange=e=>{x.selected=e.target.checked;update();};tr.querySelector('[data-quantity]').oninput=e=>{x.quantity=Number(e.target.value);x.selected=true;tr.querySelector('[data-select]').checked=true;update();};});
    update();
  };
  search.oninput=draw;format.onchange=update;
  d.querySelector('#label-select').onclick=()=>{visible().forEach(x=>x.selected=true);draw();};
  d.querySelector('#label-clear').onclick=()=>{rows.forEach(x=>x.selected=false);draw();};
  button.onclick=async()=>{
    let w;
    try{
      const jobs=labelJobs(rows).map(x=>({...x})),selectedFormat=format.value;
      w=window.open('','_blank','width=850,height=700');if(!w)throw new Error('Разрешите всплывающие окна для печати');
      w.document.write('<p>Подготовка этикеток…</p>');button.disabled=true;
      await loadScript(BARCODE_URL,'JsBarcode');
      const labels=[];
      for(const x of jobs){
        const part=x.part,svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
        JsBarcode(svg,part.barcode,{format:'CODE128',width:2,height:55,displayValue:true,fontSize:15,margin:10});
        const label=`<div class="label"><div class="name">${esc(part.name)}${part.model?` · ${esc(part.model)}`:''}</div><div class="meta"><span class="meta-category">${esc(part.category||'Без категории')}</span><b class="label-price">${money(part.retail_price)}</b></div><div class="label-details">${esc([part.model?'Размер: '+part.model:'',part.sku?'Арт. '+part.sku:''].filter(Boolean).join(' · '))}</div>${svg.outerHTML}</div>`;
        for(let i=0;i<x.quantity;i++)labels.push(label);
      }
      w.document.open();w.document.write(labelDocument(labels,selectedFormat));w.document.close();
    }catch(e){if(w&&!w.closed)w.close();d.querySelector('#label-error').textContent=e.message;}finally{update();}
  };
  draw();
}

async function printAllLabels(){
  const c=await getCatalog(true);
  return chooseLabels((c.parts||[]).filter(x=>x.active!==false));
}

function exportInventory(){
  getCatalog(true).then(c=>csvDownload('FastGo-склад.csv',['Категория','Модель / название','Модель','SKU','Штрих-код','Ед.','Закупка','Продажа','Остаток','Активен'],(c.parts||[]).map(x=>[x.category||'',x.name,x.model||'',x.sku||'',x.barcode||'',x.unit||'шт',x.unit_cost||0,x.retail_price||0,x.quantity||0,x.active===false?'Нет':'Да']))).then(()=>notice('Файл для Excel подготовлен')).catch(e=>notice(e.message,'bad'));
}

async function receiveByBarcode(){
  const code=await scanCode('Приёмка товара по штрих-коду');if(!code)return;
  let part;try{part=await partByCode(code);}catch(e){
    if(e.status===404&&!String(code).startsWith('FGC-')&&me&&['developer','owner','admin'].includes(me.role)&&confirm('Такого товара ещё нет. Создать новую позицию?'))return newPartForm(code);
    return notice(e.message,'bad');
  }
  const d=showDialog('Поступление на склад',`<div class="inv-product"><b>${esc(part.name)}</b><small>${esc(part.model||part.sku||part.barcode)}</small><strong>Сейчас: ${part.quantity} ${esc(part.unit||'шт')}</strong></div><form id="receipt-form"><label>Количество<input name="quantity" type="number" min="1" step="1" value="1" required></label><label>Основание / поставщик<input name="note" value="Приёмка по штрих-коду" required></label></form>`,`<button class="btn ghost" data-inv-close>Отмена</button><button class="btn" id="receipt-save">Принять</button>`);
  const receiptId=crypto.randomUUID();
  $('receipt-save').onclick=async()=>{const f=new FormData($('receipt-form'));const q=Number(f.get('quantity'));if(!Number.isInteger(q)||q<1)return notice('Укажите количество','bad');try{$('receipt-save').disabled=true;await api('stock',{part_id:part.id,movement_type:'receipt',quantity:q,note:String(f.get('note')||'Приёмка по штрих-коду'),request_id:receiptId});catalogCache=null;showDialog('Приход сохранён',`<p>${esc(part.name)} · принято: ${q} ${esc(part.unit||'шт')}</p>`,`<button class="btn ghost" id="receipt-done">На склад</button><button class="btn" id="receipt-labels">Напечатать этикетки</button>`);$('receipt-labels').onclick=()=>printPartLabel(part,q).catch(e=>notice(e.message,'bad'));$('receipt-done').onclick=()=>location.reload();notice(`Принято: ${part.name} +${q}`);}catch(e){notice(e.message,'bad');$('receipt-save').disabled=false;}};
}

async function uploadPartPhoto(part,file,categoryPrimary,requestId,onProgress=()=>{}){
  if(!file)return;
  onProgress('Подготавливаем фотографию…');
  const photo=await preparePartPhoto(file);
  if(photo.size>5*1024*1024)throw new Error('Фото после сжатия должно быть не больше 5 МБ');
  onProgress('Отправляем фото · '+Math.ceil(photo.size/1024)+' КБ. Дождитесь подтверждения…');
  const result=await api('part_photo_upload',{part_id:part.id,content_type:photo.type,content_base64:await fileBase64(photo),primary_for_category:categoryPrimary,...(requestId?{request_id:requestId}:{})});
  if(!result?.path)throw new Error('Сервер не подтвердил сохранение фото. Повторите загрузку.');
  return {...result,file:photo};
}

function updateProductPhoto(part,url){
  window.dispatchEvent(new CustomEvent('workshop-photo-preview',{detail:{part_id:part.id,url}}));
}
export async function photoDialog(part){
  if(!me)me=await api('me');
  const editable=['developer','owner','admin'].includes(me.role);
  const dialog=showDialog('Фотографии: '+part.name,`<p>${esc(part.model||'')} · ${money(part.retail_price)} · ${Number(part.quantity)||0} шт.</p>${editable?'<label><input id="part-photo-category" type="checkbox"> Основное фото категории</label><label>Добавить фотографию<input id="part-photo-file" type="file" accept="image/jpeg,image/png,image/webp"></label><label class="btn secondary" for="part-photo-camera">Сделать снимок</label><input id="part-photo-camera" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden><p class="muted">Выберите фото или сделайте снимок — он сохранится автоматически.</p><div id="part-photo-progress" hidden></div>':''}<div id="part-photo-list" class="photo-grid">Загружаем фотографии…</div>`,`<button class="btn ghost" data-inv-close>Закрыть</button>${editable?'<button class="btn" id="part-photo-upload">Загрузить</button>':''}`);
  const host=$('part-photo-list'),input=$('part-photo-file'),button=$('part-photo-upload'),category=$('part-photo-category');
  const status=editable?uploadStatus($('part-photo-progress')):null;
  let busy=false,pendingFile=null,pendingPhoto=null;const photoStops=[];
  dialog.addEventListener('close',()=>photoStops.splice(0).forEach(stop=>stop()),{once:true});
  const save=async(file,photo)=>{
    if(busy)return;
    if(!file&&!photo){status.error('Сначала выберите фотографию');return;}
    if(file||photo){pendingFile=file||null;pendingPhoto=photo||null;}
    busy=true;const release=holdUpload(dialog);status.busy('Подготавливаем фотографию…');
    try{
      let url,result;
      if(file){result=await uploadPartPhoto(part,file,category.checked,undefined,text=>status.busy(text));url=URL.createObjectURL(result.file);}
      else{status.busy('Сохраняем основную фотографию…');result=await api('part_photo_primary',{part_id:part.id,photo_id:photo.id,primary_for_category:category.checked});}
      part.primary_photo_path=result.path;updateProductPhoto(part,url);
      // The preview owns this blob until its card leaves the page. Revoking it
      // on a timer breaks restored/evicted images on mobile Safari.
      status.done('Фото сохранено');release();if(host.isConnected)dialog.close();notice('Фото сохранено');
    }catch(e){status.error(e.message+' Нажмите «Повторить загрузку».');button.textContent='Повторить загрузку';}
    finally{busy=false;release();host.querySelectorAll('button').forEach(b=>b.disabled=false);}
  };
  if(editable){button.onclick=()=>save(pendingFile||input.files[0],pendingPhoto);input.onchange=()=>{if(input.files.length)save(input.files[0]);};const camera=$('part-photo-camera');camera.onchange=()=>{if(camera.files.length)save(camera.files[0]);};}
  // Bind upload immediately; old previews must not hold up a new camera shot.
  try{
    const photos=await api('part_photos',{part_id:part.id});if(!host.isConnected)return;
    host.textContent=photos.length?'':'Фотографий пока нет.';
    await Promise.allSettled(photos.map(async p=>{
      const card=document.createElement('div'),img=document.createElement('img');img.alt=part.name;img.loading='lazy';card.append(img);host.append(card);
      if(editable){const primary=document.createElement('button');primary.className='btn secondary small';primary.textContent=p.primary?'Основное фото':'Сделать основным';primary.disabled=busy;primary.onclick=()=>save(null,{...p,url:img.src});card.append(primary);}
      photoStops.push(displayPrivatePhoto(img,{cacheKey:me?.profile_id&&p.path?me.profile_id+':'+part.id+':'+p.path:undefined,getUrl:async()=>(await api('part_photo_url',{part_id:part.id,photo_id:p.id},{fresh:true})).url,onError:()=>{img.alt='Фото не загрузилось';}}));
    }));
  }catch(e){if(host.isConnected)host.textContent=e.message;}
}

async function maintenanceDialog(){
  const c=await getCatalog(true);
  if(!c.capabilities?.atomic_writes)throw new Error('Для проверки копий и переноса файлов сначала обновите Google API.');
  const [status,files]=await Promise.all([api('backup_status'),api('migration_manifest')]);
  let remaining=files.filter(x=>!x.migrated);
  showDialog('Резервные копии и старые файлы',`<p>Ежедневное расписание: ${status.trigger_count===1?'установлено':'требует настройки'}.</p><p>Последняя проверенная копия: ${esc(status.last_success||'нет подтверждения')}.</p><p>Проверка восстановления: ${esc(status.restore_verified_at||'не выполнена')}.</p>${status.last_error?`<p class="error">${esc(status.last_error)}</p>`:''}<p id="migration-summary">Перенесено файлов: ${files.length-remaining.length} из ${files.length}. Без связи с приёмкой: ${files.filter(x=>!x.record_id).length}.</p><p id="migration-progress" aria-live="polite"></p>`,`<button class="btn ghost" data-inv-close>Закрыть</button>${remaining.length?'<button class="btn" id="migrate-files">Перенести и проверить файлы</button>':''}`);
  if(remaining.length)$('migrate-files').onclick=async()=>{
    const button=$('migrate-files'),progress=$('migration-progress'),summary=$('migration-summary');button.disabled=true;const updateCount=()=>{summary.textContent=`Перенесено файлов: ${files.length-remaining.length} из ${files.length}. Без связи с приёмкой: ${files.filter(x=>!x.record_id).length}.`;};
    try{
      progress.textContent='Сверяем уже перенесённые файлы…';
      remaining=(await api('migration_manifest')).filter(x=>!x.migrated);updateCount();
      while(remaining.length){progress.textContent=`Проверено ${files.length-remaining.length} из ${files.length}. Переносим следующий файл…`;await api('migrate_legacy_file',{object_id:remaining[0].object_id});remaining.shift();updateCount();}
      progress.textContent=`Все ${files.length} файлов скопированы и проверены по контрольным суммам. Исходники сохранены.`;button.remove();
    }catch(e){progress.textContent=e.message+' При повторе сначала проверим уже сохранённые файлы.';button.disabled=false;}
  };
}

export async function newPartForm(prefill='',{equipment=false}={}){
  if(!me)me=await api('me');
  const c=await getCatalog();const photoReady=!!c.capabilities?.private_product_photos;const categories=[...new Set((c.categories||[]).map(x=>x.name).filter(Boolean))].sort();
  const options=categories.map(x=>`<option value="${esc(x)}"></option>`).join('');
  const d=showDialog(equipment?'Новая техника':'Новая товарная позиция',`<form id="new-part-form" class="inv-form">${equipment?`<label>Тип техники<select name="category" required>${equipmentTypes.map(t=>`<option value="Техника · ${esc(t)}">${esc(t)}</option>`).join('')}</select></label>`:`<label>Категория<input name="category" list="part-categories" required placeholder="Подшипники"><datalist id="part-categories">${options}</datalist></label>`}<label>Наименование по модели<input name="name" required placeholder="Камера Макс Спид"></label><label>Размер<input name="model" placeholder="Например, 10 × 2,5"></label><div class="inv-grid"><label>Закупочная цена, ₽<input name="unit_cost" type="number" min="0" step="0.01" value="0"></label><label>Продажа, ₽<input name="retail_price" type="number" min="0" step="0.01" value="0" required></label><label>Количество<input name="initial_quantity" type="number" min="0" step="1" value="0"></label></div>${photoReady?'<p class="muted">Фотографии доступны только сотрудникам мастерской.</p>':'<p class="muted">Загрузка фото станет доступна после обновления сервера.</p>'}<label>Фото товара<input name="photo" ${photoReady?'':'disabled'} type="file" accept="image/jpeg,image/png,image/webp"></label><img id="product-photo-preview" class="product-photo-preview" alt="Выбранное фото товара" hidden><label class="inv-check"><input name="category_primary" ${photoReady?'':'disabled'} type="checkbox"> Сделать это фото основным и для категории</label><p class="muted">Артикул и штрихкод будут присвоены автоматически после сохранения.</p></form>`,`<button class="btn ghost" data-inv-close>Отмена</button><button class="btn" id="new-part-save">Создать и принять</button>`);
  const progress=document.createElement('p');progress.className='muted';progress.setAttribute('role','status');progress.setAttribute('aria-live','polite');d.querySelector('.inv-body').appendChild(progress);
  mountProductSteps($('new-part-form'),$('new-part-save'));
  const form=$('new-part-form'),button=$('new-part-save'),actor=me.profile_id;
  let previewUrl=null;form.elements.photo.onchange=()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);const file=form.elements.photo.files[0],img=$('product-photo-preview');img.hidden=!file;if(file){previewUrl=URL.createObjectURL(file);img.src=previewUrl;}else img.removeAttribute('src');};
  d.addEventListener('close',()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);},{once:true});
  const restore=()=>{const state=loadProductIntake(localStorage,actor);if(!state)return null;for(const [name,value] of Object.entries({...state.product,initial_quantity:state.quantity})){const field=form.elements.namedItem(name);if(field){field.value=value;field.disabled=true;}}form.elements.category_primary.checked=!!state.photo?.primary;form.elements.category_primary.disabled=true;button.textContent='Продолжить приёмку';return state;};
  const unfinished=restore();if(unfinished)progress.textContent='Есть незавершённая приёмка. Продолжим с сохранённого шага.'+(unfinished.photo&&!unfinished.photoSaved?' Выберите то же фото ещё раз.':'');
  $('new-part-save').onclick=async()=>{
    if(button.disabled)return;
    if(!form.reportValidity())return;
    try{
      button.disabled=true;const f=new FormData(form),file=form.elements.photo.files[0];let photo=null;
      if(file?.size){if(file.size>25*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Выберите JPG, PNG или WebP не больше 25 МБ. Снимок будет сжат перед отправкой.');const hash=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());photo={sha256:[...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join(''),type:file.type,primary:form.elements.category_primary.checked};}
      let state=loadProductIntake(localStorage,actor);
      if(!state)state=startProductIntake(localStorage,actor,{product:{name:f.get('name'),category:f.get('category'),model:f.get('model'),unit_cost:Number(f.get('unit_cost')||0),retail_price:Number(f.get('retail_price')||0),unit:f.get('unit')||'шт'},quantity:Number(f.get('initial_quantity')||0),photo});
      restore();
      if(state.photo&&!state.photoSaved&&(!photo||photo.sha256!==state.photo.sha256||photo.type!==state.photo.type))throw new Error('Для продолжения выберите то же фото. Товар и приход не будут созданы повторно.');
      const part=await continueProductIntake(localStorage,actor,{api,onProgress:text=>{progress.textContent=text;},uploadPhoto:(part,metadata,id)=>uploadPartPhoto(part,file,metadata.primary,id,text=>{progress.textContent=text;})});
      catalogCache=null;window.dispatchEvent(new Event('workshop-data-changed'));
      showDialog('Приёмка завершена',`<p>${esc(part.name)}</p><p>Штрих-код: <strong>${esc(part.barcode)}</strong></p><p>Товар, приход и выбранное фото сохранены.</p>`,`<button class="btn ghost" data-inv-close>Закрыть</button><button class="btn" id="new-part-print">Напечатать этикетку</button>`);
      $('new-part-print').onclick=()=>printPartLabel(part,Number(state.quantity)||1).catch(e=>notice(e.message,'bad'));
      if(mobileLabelOffer()&&state.quantity>0)offerLabelPrinting(part,state.quantity,{call:api,actor});
    }catch(e){progress.textContent=e.message;notice(e.message,'bad');try{if(!loadProductIntake(localStorage,actor)){for(const field of form.elements)field.disabled=false;if(!photoReady){form.elements.photo.disabled=true;form.elements.category_primary.disabled=true;}button.textContent='Создать и принять';}}catch{} }finally{button.disabled=false;}
  };
}

const cartSignature=()=>JSON.stringify([...cart.values()].map(x=>[x.part.id,x.qty,salePrice(x)]));
const salePrice=x=>x.priceMode==='free'?Number(x.freePrice):Number(x.part.retail_price||0);
const saleQuantityLimit=part=>equipmentType(part)?Math.min(1000,Number(part.quantity)||0):1000;
function renderCart(){
  saveSale();
  const host=$('sales-cart');if(!host)return;
  const rows=[...cart.values()];cartPrice=priceAdjustment({prefix:'sale',base:()=>[...cart.values()].reduce((s,x)=>s+x.qty*salePrice(x),0),read:()=>pendingSale?.payload?.total_override!==undefined?{value:String(pendingSale.payload.total_override)}:saleAdjustment?.signature===cartSignature()?saleAdjustment:null,write:edit=>{saleAdjustment=edit?{...edit,signature:cartSignature()}:null;saveSale();},locked:()=>!!pendingSale||saleBusy});
  host.innerHTML=rows.length?rows.map(x=>`<div class="cart-row"><div><b>${esc(x.part.name)}</b><small>${esc(x.part.barcode)} · остаток ${x.part.quantity}</small><div class="sale-price-options"><label><input type="radio" name="price-${x.part.id}" data-price-mode="${x.part.id}" value="base" ${x.priceMode!=='free'?'checked':''}> Основная цена · ${money(x.part.retail_price)}</label><label><input type="radio" name="price-${x.part.id}" data-price-mode="${x.part.id}" value="free" ${x.priceMode==='free'?'checked':''}> Свободная цена</label>${x.priceMode==='free'?`<input aria-label="Свободная цена, ₽" data-free-price="${x.part.id}" type="number" min="0" max="1000000000" step="0.01" value="${esc(x.freePrice??x.part.retail_price)}">`: ''}</div></div><div class="cart-qty"><button data-minus="${x.part.id}">−</button><strong>${x.qty}</strong><button data-plus="${x.part.id}">+</button></div><b>${money(x.qty*salePrice(x))}</b><button class="inv-icon" data-remove="${x.part.id}">✕</button></div>`).join('')+cartPrice.markup():`<div class="empty"><strong>Корзина пустая</strong><p>Сканируйте штрих-код товара или найдите его вручную.</p></div>`;
  host.querySelectorAll('[data-minus]').forEach(b=>b.onclick=()=>{const x=cart.get(b.dataset.minus);if(x){x.qty--;if(x.qty<1)cart.delete(b.dataset.minus);renderCart();}});
  host.querySelectorAll('[data-plus]').forEach(b=>b.onclick=()=>{const x=cart.get(b.dataset.plus);if(x&&x.qty<saleQuantityLimit(x.part)){x.qty++;renderCart();}else notice(x?.qty>=1000?'Не больше 1000 штук одного товара':'Больше остатка техники на складе добавить нельзя','bad');});
  host.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{cart.delete(b.dataset.remove);renderCart();});
  host.querySelectorAll('[data-price-mode]').forEach(input=>input.onchange=()=>{const x=cart.get(input.dataset.priceMode);x.priceMode=input.value;x.freePrice??=Number(x.part.retail_price||0);renderCart();});
  host.querySelectorAll('[data-free-price]').forEach(input=>{input.oninput=()=>{const x=cart.get(input.dataset.freePrice);x.freePrice=input.value;saveSale();cartPrice.draw();input.closest('.cart-row').querySelector(':scope > b').textContent=money(x.qty*salePrice(x));};});
  if(rows.length)cartPrice.bind();
  document.querySelectorAll('[name="sale-payment-choice"]').forEach(input=>input.disabled=!!pendingSale||saleBusy);
  host.querySelectorAll('input').forEach(input=>input.disabled=!!pendingSale||saleBusy);
  if($('sale-checkout'))$('sale-checkout').hidden=!rows.length;
  if($('sale-complete'))$('sale-complete').hidden=!rows.length;
  host.querySelectorAll('button').forEach(b=>b.disabled=!!pendingSale||saleBusy);['sale-payment','sale-search','sale-find','sale-search-toggle','sale-scan-toggle'].forEach(id=>{if($(id))$(id).disabled=!!pendingSale||saleBusy;});
  const btn=$('sale-complete');if(btn){btn.disabled=!rows.length||saleBusy;btn.textContent=pendingSale?'Проверить и завершить продажу':'Провести продажу';}
}
function addToCart(part){
  if(saleQuantityLimit(part)<=0)return notice('Этой техники нет в наличии','bad');
  const x=cart.get(part.id);if(x){if(x.qty>=saleQuantityLimit(part))return notice(x.qty>=1000?'Не больше 1000 штук одного товара':'В корзине уже весь доступный остаток техники','bad');x.qty++;}else cart.set(part.id,{part,qty:1});renderCart();
}

export async function openSales(shiftId,partId){
  if(!me)me=await api('me');restoreSale();if(!canSell(me))return notice('У вашей роли нет доступа к продажам','bad');
  const state=await api('cash_state',shiftId?{shift_id:shiftId}:{},{fresh:true}),shift=state.selected;if(!pendingSale&&(!shift||shift.status!=='open')){location.hash='#cash';return notice('Откройте смену в разделе «Кассы и продажи»','bad');}
  const c=await getCatalog(true);const parts=(c.parts||[]).filter(x=>x.active!==false);
  const d=showDialog('Продажа · '+(shift?.register||'Проверка операции'),`<div class="sales-tools"><div class="sale-modes"><button type="button" class="btn secondary" id="sale-scan-toggle" aria-expanded="false" aria-controls="sale-camera-panel">Сканировать</button><button type="button" class="btn secondary" id="sale-search-toggle" aria-expanded="false" aria-controls="sale-search-panel">Поиск товара</button></div><section id="sale-camera-panel" hidden aria-label="Сканер штрих-кода"><div class="scan-box"><video id="sale-video" muted playsinline autoplay></video><div class="scan-line"></div></div><p id="sale-camera-status" role="status">Запускаем камеру…</p><button type="button" class="btn ghost" id="sale-camera-close">Закрыть камеру</button></section><div class="inv-search" id="sale-search-panel" hidden><div class="inv-inline"><input id="sale-search" type="search" aria-label="Название или штрих-код товара" autocomplete="off" placeholder="Название или штрих-код"><button type="button" class="btn secondary" id="sale-find">Найти</button></div><div id="sale-results"></div></div></div><div id="sales-cart"></div><div id="sale-checkout" hidden><fieldset><legend>Оплата</legend><label><input type="radio" name="sale-payment-choice" value="cash" checked> Наличные</label><label><input type="radio" name="sale-payment-choice" value="card"> Безналичные</label></fieldset><input id="sale-payment" type="hidden" value="cash"></div>`,`<button class="btn ghost" data-inv-close>Закрыть</button><button class="btn" id="sale-complete" hidden disabled>Провести продажу</button>`);
  d.querySelectorAll('[name="sale-payment-choice"]').forEach(input=>input.onchange=()=>{$('sale-payment').value=input.value;});
  d.classList.add('sale-dialog');
  let closed=false,camera=null;
  const fitViewport=()=>{
    const editing=d.contains(document.activeElement)&&document.activeElement.matches('input:not([type=radio]),textarea');
    // Dynamic CSS handles rotation; pixels are only needed for the iOS keyboard.
    d.style.setProperty('--sale-viewport-height',editing&&window.visualViewport?window.visualViewport.height+'px':'100dvh');
  };
  fitViewport();window.visualViewport?.addEventListener('resize',fitViewport);window.addEventListener('resize',fitViewport);
  d.addEventListener('focusin',fitViewport);d.addEventListener('focusout',fitViewport);
  d.addEventListener('close',()=>{window.visualViewport?.removeEventListener('resize',fitViewport);window.removeEventListener('resize',fitViewport);d.removeEventListener('focusin',fitViewport);d.removeEventListener('focusout',fitViewport);},{once:true});
  const cameraPanel=$('sale-camera-panel'),searchPanel=$('sale-search-panel');
  const setMode=mode=>{
    camera?.stop();cameraPanel.hidden=mode!=='camera';searchPanel.hidden=mode!=='search';
    $('sale-scan-toggle').setAttribute('aria-expanded',String(mode==='camera'));
    $('sale-search-toggle').setAttribute('aria-expanded',String(mode==='search'));
    $('sale-search-toggle').textContent=mode==='search'?'Закрыть поиск':'Поиск товара';
    if(mode==='search')$('sale-search').focus();else $('sale-search').blur();
    fitViewport();
    if(mode==='camera')camera?.start();
  };
  $('sale-search-toggle').onclick=()=>setMode(searchPanel.hidden?'search':null);
  $('sale-scan-toggle').onclick=()=>setMode(cameraPanel.hidden?'camera':null);
  $('sale-camera-close').onclick=()=>setMode(null);
  const search=$('sale-search'),results=$('sale-results');
  const showResults=()=>{const q=search.value.trim().toLowerCase();if(!q){results.innerHTML='';return;}const found=parts.filter(x=>(`${x.name} ${x.model||''} ${x.sku||''} ${x.barcode||''}`).toLowerCase().includes(q)).slice(0,12);results.innerHTML=found.length?found.map(x=>`<button type="button" data-pick="${x.id}"><span>${esc(x.name)}${x.model?` · ${esc(x.model)}`:''}</span><small>${esc(x.barcode)} · ${x.quantity} шт. · ${money(x.retail_price)}</small></button>`).join(''):'<p class="muted" role="status">Товар не найден. Попробуйте другое название или штрих-код.</p>';results.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{addToCart(found.find(x=>x.id===b.dataset.pick));search.value='';results.innerHTML='';setMode(null);});};
  search.oninput=showResults;
  let scanQueue=Promise.resolve();
  const queueCode=code=>{scanQueue=scanQueue.then(async()=>{try{const part=await partByCode(code);if(closed||!d.open)return;addToCart(part);}catch(err){notice(err.message,'bad');}});};
  camera=createSaleCamera({video:$('sale-video'),loadReader:async()=>{await loadScript(ZXING_URL,'ZXingBrowser');return ZXingBrowser.BrowserMultiFormatReader;},onCode:code=>{setMode(null);queueCode(code);},onStatus:message=>{if(!closed)$('sale-camera-status').textContent=message;}});
  d.addEventListener('close',()=>{closed=true;camera.stop();},{once:true});
  search.onkeydown=e=>{if(e.key!=='Enter'||pendingSale||saleBusy)return;e.preventDefault();const code=search.value.trim();if(!code)return;const exact=parts.find(x=>x.barcode===code||x.sku===code);if(exact){addToCart(exact);search.value='';results.innerHTML='';}else showResults();};
  $('sale-find').onclick=showResults;
  // HID scanners type a fast sequence ending in Enter. Listen only in this sale
  // dialog, and never consume typing in search or editable price fields.
  let buffer='',lastKey=0;
  const scanner=e=>{
    if(!d.open||!$('sales-cart')||pendingSale||saleBusy||e.ctrlKey||e.altKey||e.metaKey)return;
    if(e.target.closest('input:not([type="radio"]):not([type="checkbox"]),textarea,select,[contenteditable="true"]'))return;
    const now=performance.now();
    if(e.key==='Enter'){if(buffer.length>=3&&now-lastKey<150){e.preventDefault();queueCode(buffer);}buffer='';return;}
    if(e.key.length===1){if(now-lastKey>150)buffer='';buffer+=e.key;lastKey=now;}
  };
  document.addEventListener('keydown',scanner,true);
  d.addEventListener('close',()=>document.removeEventListener('keydown',scanner,true),{once:true});
  d.querySelector('[data-inv-close]').focus();
  if(pendingSale?.payload){$('sale-payment').value=pendingSale.payload.payment_method;d.querySelectorAll('[name="sale-payment-choice"]').forEach(input=>input.checked=input.value===$('sale-payment').value);}
  if(partId&&!pendingSale&&!cart.has(partId)){const selected=parts.find(x=>x.id===partId);if(selected)addToCart(selected);}
  renderCart();
  if(!pendingSale&&!partId&&(matchMedia('(pointer: coarse)').matches||matchMedia('(max-width: 700px)').matches))setMode('camera');
  $('sale-complete').onclick=async()=>{
    if(saleBusy)return;if([...cart.values()].some(x=>x.priceMode==='free'&&(x.freePrice===''||!Number.isFinite(salePrice(x))||salePrice(x)<0||salePrice(x)>1e9||Math.abs(salePrice(x)*100-Math.round(salePrice(x)*100))>0.0001)))return notice('Введите цену в рублях, не более двух знаков после запятой','bad');saleBusy=true;camera.stop();renderCart();
    try{await scanQueue;if(!cart.size)return;const total=cartPrice?.total();if(total===null)throw Object.assign(Error('Проверьте сумму или скидку'),{status:400});const payload={shift_id:shift?.id,payment_method:$('sale-payment').value,...(saleAdjustment?.signature===cartSignature()?{total_override:total}:{}),items:[...cart.values()].map(x=>({part_id:x.part.id,quantity:x.qty,price_mode:x.priceMode==='free'?'free':'base',...(x.priceMode==='free'?{unit_price:salePrice(x)}:{})}))};const signature=JSON.stringify(payload);if(!pendingSale)pendingSale={signature,id:crypto.randomUUID(),payload};saveSale();const result=await api('sale',{request_id:pendingSale.id,...(pendingSale.payload||payload)});pendingSale=null;saleAdjustment=null;cart.clear();saveSale();catalogCache=null;closeDialog();window.dispatchEvent(new Event('workshop-data-changed'));notice(`Продажа №${result.sale_number} · ${money(result.total)}`);}catch(e){if([400,403,404,409,413,422].includes(e.status))pendingSale=null;saveSale();notice(e.message,'bad');}finally{saleBusy=false;renderCart();}
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
    if(location.hash.startsWith('#stock')){
      const head=document.querySelector('.workspace .pagehead');
      if(head&&!head.querySelector('[data-inv-tools]')){
        const box=document.createElement('div');box.dataset.invTools='1';box.className='inv-toolbar';box.innerHTML=`<button class="btn secondary" data-receive>▣ Приёмка сканером</button>${['developer','owner','admin'].includes(me.role)?'<button class="btn secondary" data-newpart>+ Новый товар</button>':''}<button class="btn ghost" data-labels>Этикетки</button><button class="btn ghost" data-export>Excel</button>${canSell(me)?'<button class="btn ghost" data-history>Продажи</button>':''}${['developer','owner','admin'].includes(me.role)?'<button class="btn ghost" data-maintenance>Копии и файлы</button>':''}`;
        head.appendChild(box);box.querySelector('[data-receive]').onclick=receiveByBarcode;box.querySelector('[data-newpart]')&&(box.querySelector('[data-newpart]').onclick=()=>newPartForm().catch(e=>notice(e.message,'bad')));box.querySelector('[data-labels]').onclick=()=>printAllLabels().catch(e=>notice(e.message,'bad'));box.querySelector('[data-export]').onclick=exportInventory;if(box.querySelector('[data-history]'))box.querySelector('[data-history]').onclick=showSalesHistory;const maintenance=box.querySelector('[data-maintenance]');if(maintenance)maintenance.onclick=async()=>{if(maintenance.disabled)return;maintenance.disabled=true;maintenance.textContent='Проверяем копии…';try{await maintenanceDialog();}catch(e){notice(e.message,'bad');}finally{maintenance.disabled=false;maintenance.textContent='Копии и файлы';}};
      }
      const table=document.querySelector('.workspace table.records');
      if(table&&!table.dataset.barcodeEnhanced){
        table.dataset.barcodeEnhanced='1';
        const c=await getCatalog();const map=new Map((c.parts||[]).map(x=>[x.name,x]));
        table.querySelectorAll('tbody tr').forEach(tr=>{const name=tr.querySelector('td b')?.textContent||'';const id=tr.querySelector('[data-editpart]')?.dataset.editpart||tr.querySelector('[data-stock]')?.dataset.stock;const p=c.parts.find(x=>x.id===id)||map.get(name);if(!p)return;if(c.capabilities?.private_product_photos){const button=document.createElement('button');button.className='btn ghost small';button.textContent='Фото';button.onclick=()=>photoDialog(p).catch(e=>notice(e.message,'bad'));tr.lastElementChild.appendChild(button);const preview=document.createElement('button');preview.type='button';preview.className='product-photo-thumb';preview.dataset.productPhoto=p.id;preview.setAttribute('aria-label','Фото товара: '+p.name);preview.textContent='Фото';tr.firstElementChild.prepend(preview);}const small=tr.querySelector('td small');if(small)small.innerHTML=`${esc(p.sku||'Без артикула')} · <b>${esc(p.barcode)}</b>`;tr.addEventListener('dblclick',()=>printPartLabel(p).catch(e=>notice(e.message,'bad')));});bindProductPreviews(table,c.parts);
      }
    }
  }catch(e){notice(e.message,'bad');}finally{enhancing=false;}
}

const observer=new MutationObserver(()=>{clearTimeout(window.__fastgoInvTimer);window.__fastgoInvTimer=setTimeout(enhance,60);});
observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>setTimeout(enhance,80));
window.addEventListener('workshop-session-cleared',()=>{me=null;catalogCache=null;pendingSale=null;cart.clear();closeDialog();});
setTimeout(enhance,120);


export function bindProductPreviews(host,products){
  const byId=new Map(products.map(p=>[String(p.id),p]));
  let running=0,queue=[];
  const versions=new WeakMap(),stops=new Map(),blobUrls=new Set();
  const load=(button,url)=>new Promise(resolve=>{
    const version=(versions.get(button)||0)+1;versions.set(button,version);
    stops.get(button)?.();
    const p=byId.get(button.dataset.productPhoto);if(!p||!button.isConnected){resolve();return;}
    if(url?.startsWith('blob:'))blobUrls.add(url);
    const img=document.createElement('img');img.alt=p.name;
    let settled=false;
    const finish=()=>{if(!settled){settled=true;clearTimeout(timeout);resolve();}};
    // A stalled image must not block every card behind it in the queue.
    const timeout=setTimeout(()=>{stops.get(button)?.();button.dataset.photoState='error';finish();},30000);
    button.dataset.photoState='loading';
    const stop=displayPrivatePhoto(img,{
      cacheKey:me?.profile_id&&p.primary_photo_path?me.profile_id+':'+p.id+':'+p.primary_photo_path:undefined,
      url,
      isCurrent:()=>button.isConnected&&versions.get(button)===version,
      getUrl:async()=>(await api('part_photo_url',{part_id:p.id},{fresh:true})).url,
      onLoad:()=>{button.dataset.photoState='ready';if(img.parentNode!==button)button.replaceChildren(img);finish();},
      onError:()=>{button.dataset.photoState='error';const previous=button.querySelector('img');if(!previous||previous===img||!previous.naturalWidth)button.textContent='Повторить';finish();}
    });
    stops.set(button,()=>{stop();finish();});
  });
  const drain=()=>{while(running<3&&queue.length){const b=queue.shift();running++;load(b).finally(()=>{running--;drain();});}};
  const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){observer.unobserve(e.target);queue.push(e.target);}drain();},{rootMargin:'100px'});
  host.querySelectorAll('[data-product-photo]').forEach(button=>{
    const p=byId.get(button.dataset.productPhoto);if(!p)return;
    button.onclick=()=>{if(button.dataset.photoState==='error'){queue.push(button);drain();}else photoDialog(p).catch(e=>notice(e.message,'bad'));};
    if(p.primary_photo_path)observer.observe(button);
  });
  const update=e=>{const detail=e.detail;if(!detail?.part_id||detail.local)return;host.querySelectorAll('[data-product-photo]').forEach(button=>{if(button.dataset.productPhoto===detail.part_id){observer.unobserve(button);queue=queue.filter(x=>x!==button);load(button,detail.url);}});};
  window.addEventListener('workshop-data-changed',update);window.addEventListener('workshop-photo-preview',update);
  const recover=()=>{if(document.hidden)return;host.querySelectorAll('[data-product-photo]').forEach(button=>{if(button.dataset.photoState!=='error'||queue.includes(button))return;const r=button.getBoundingClientRect();if(r.bottom>=0&&r.top<=innerHeight)queue.push(button);});drain();};
  for(const event of ['online','pageshow','focus'])window.addEventListener(event,recover);
  document.addEventListener('visibilitychange',recover);
  const cleanup=new MutationObserver(()=>{if(!host.isConnected){observer.disconnect();cleanup.disconnect();queue=[];for(const stop of stops.values())stop();for(const url of blobUrls)URL.revokeObjectURL(url);window.removeEventListener('workshop-data-changed',update);window.removeEventListener('workshop-photo-preview',update);for(const event of ['online','pageshow','focus'])window.removeEventListener(event,recover);document.removeEventListener('visibilitychange',recover);}});cleanup.observe(document.body,{childList:true,subtree:true});
}

