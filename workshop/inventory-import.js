import {api,esc} from './core.js';

const XLSX_URL='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
let busy=false;
const loadXlsx=()=>new Promise((resolve,reject)=>{
  if(window.XLSX)return resolve(window.XLSX);
  const s=document.createElement('script');s.src=XLSX_URL;s.defer=true;s.onload=()=>resolve(window.XLSX);s.onerror=()=>reject(new Error('Не удалось загрузить модуль Excel'));document.head.appendChild(s);
});
const norm=v=>String(v??'').trim();
const h=v=>norm(v).toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ');
function pick(row,names){const keys=Object.keys(row);for(const name of names){const key=keys.find(k=>h(k)===h(name));if(key!==undefined&&norm(row[key])!=='')return row[key];}return '';}
function num(v){const n=Number(String(v??'').replace(/\s/g,'').replace(',','.'));return Number.isFinite(n)?n:0;}
function int(v){const n=Math.floor(num(v));return n>0?n:0;}
function keyOf(x){return [h(x.category),h(x.model),h(x.name)].join('|');}
function showProgress(title,text){
 let d=document.getElementById('inventory-import-dialog');if(!d){d=document.createElement('dialog');d.id='inventory-import-dialog';d.className='inventory-dialog';document.body.appendChild(d);}d.innerHTML=`<div class="inv-head"><div><small>FASTGO · EXCEL</small><h2>${esc(title)}</h2></div></div><div class="inv-body"><p id="inventory-import-progress">${esc(text)}</p><div class="import-meter"><i id="inventory-import-meter"></i></div><pre id="inventory-import-log"></pre></div>`;if(!d.open)d.showModal();return d;
}
function setProgress(done,total,text){const p=document.getElementById('inventory-import-progress'),m=document.getElementById('inventory-import-meter');if(p)p.textContent=text;if(m)m.style.width=(total?Math.round(done/total*100):0)+'%';}
function closeProgress(){const d=document.getElementById('inventory-import-dialog');if(d?.open)d.close();}
async function chooseFile(){return new Promise(resolve=>{const i=document.createElement('input');i.type='file';i.accept='.xlsx,.xls,.csv';i.onchange=()=>resolve(i.files?.[0]||null);i.click();});}
async function importWorkbook(){
 if(busy)return;busy=true;
 try{
  const me=await api('me');if(!['owner','admin'].includes(me.role))throw new Error('Импорт Excel доступен владельцу и администратору');
  const file=await chooseFile();if(!file)return;
  await loadXlsx();const data=await file.arrayBuffer();const wb=XLSX.read(data,{type:'array',cellDates:false});
  const sheet=wb.Sheets['Товары']||wb.Sheets[wb.SheetNames[0]];if(!sheet)throw new Error('В книге нет листов');
  const rows=XLSX.utils.sheet_to_json(sheet,{defval:'',raw:false}).filter(r=>norm(pick(r,['Модель / название','Наименование','Товар','Название'])));
  if(!rows.length)throw new Error('Не найдены строки товаров. Используйте лист «Товары» из шаблона FastGo.');
  const current=await api('catalog');const byBarcode=new Map(),bySku=new Map(),byKey=new Map();
  for(const p of current.parts||[]){if(p.barcode)byBarcode.set(h(p.barcode),p);if(p.sku)bySku.set(h(p.sku),p);byKey.set(keyOf(p),p);}
  showProgress('Импорт товаров',`Подготовлено строк: ${rows.length}`);let created=0,updated=0,received=0,errors=[];
  for(let i=0;i<rows.length;i++){
   const r=rows[i];setProgress(i,rows.length,`Строка ${i+1} из ${rows.length}`);
   const name=norm(pick(r,['Модель / название','Наименование','Товар','Название']));const category=norm(pick(r,['Категория','Category']));const model=norm(pick(r,['Модель','Model']));const sku=norm(pick(r,['SKU','Артикул','Артикул / SKU']));const barcode=norm(pick(r,['Штрих-код','Штрихкод','Barcode']));
   const retail=num(pick(r,['Цена продажи','Розничная цена','Цена продажи, ₽','Цена']));const cost=num(pick(r,['Цена закупки','Закупочная цена','Закупка','Цена закупки, ₽']));const quantity=int(pick(r,['Приход, шт.','Количество','Приход','Начальный остаток']));const unit=norm(pick(r,['Ед.','Единица','Ед. изм.']))||'шт';
   try{
    const found=(barcode&&byBarcode.get(h(barcode)))||(sku&&bySku.get(h(sku)))||byKey.get(keyOf({category,model,name}));
    const saved=await api('part_save',{id:found?.id,name,category,model,sku,unit,unit_cost:cost,retail_price:retail,active:true});
    if(found)updated++;else{created++;if(saved.barcode)byBarcode.set(h(saved.barcode),saved);if(saved.sku)bySku.set(h(saved.sku),saved);byKey.set(keyOf(saved),saved);}
    if(quantity>0){await api('stock',{part_id:saved.id,movement_type:'receipt',quantity,note:`Импорт Excel: ${file.name}`,request_id:crypto.randomUUID()});received+=quantity;}
   }catch(e){errors.push(`Строка ${i+2}: ${name} — ${e.message}`);}
  }
  setProgress(rows.length,rows.length,'Импорт завершён');const log=document.getElementById('inventory-import-log');if(log)log.textContent=`Создано: ${created}\nОбновлено: ${updated}\nПринято единиц: ${received}\nОшибок: ${errors.length}${errors.length?'\n\n'+errors.slice(0,30).join('\n'):''}`;
  const d=document.getElementById('inventory-import-dialog');const foot=document.createElement('div');foot.className='inv-foot';foot.innerHTML='<button class="btn" id="inventory-import-done">Готово</button>';d.appendChild(foot);document.getElementById('inventory-import-done').onclick=()=>{closeProgress();location.reload();};
 }catch(e){closeProgress();alert(e.message);}finally{busy=false;}
}
function enhance(){
 const tools=document.querySelector('[data-inv-tools]');if(!tools||tools.querySelector('[data-import-xlsx]'))return;
 const b=document.createElement('button');b.className='btn ghost';b.dataset.importXlsx='1';b.textContent='Импорт Excel';b.onclick=importWorkbook;tools.insertBefore(b,tools.querySelector('[data-export]')||null);
}
const observer=new MutationObserver(()=>setTimeout(enhance,80));observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(enhance,250);
