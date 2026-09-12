import {api,esc} from './core.js';
import {planImport,digestBytes,checkpointStore,runImport} from './inventory-import-core.js';
import {loadLibrary} from './library-loader.js';
const XLSX_URL='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
let busy=false;
function showProgress(title,text){
 let d=document.getElementById('inventory-import-dialog');if(!d){d=document.createElement('dialog');d.id='inventory-import-dialog';d.className='inventory-dialog';document.body.appendChild(d);}d.innerHTML=`<div class="inv-head"><div><small>FASTGO · EXCEL</small><h2>${esc(title)}</h2></div></div><div class="inv-body"><p id="inventory-import-progress">${esc(text)}</p><div class="import-meter"><i id="inventory-import-meter"></i></div><pre id="inventory-import-log"></pre></div>`;d.oncancel=e=>{if(busy)e.preventDefault();};if(!d.open)d.showModal();return d;
}
function setProgress(done,total,text){const p=document.getElementById('inventory-import-progress'),m=document.getElementById('inventory-import-meter');if(p)p.textContent=text;if(m)m.style.width=(total?Math.round(done/total*100):0)+'%';}
function finish(text){const d=document.getElementById('inventory-import-dialog');if(!d)return;document.getElementById('inventory-import-log').textContent=text;const foot=document.createElement('div');foot.className='inv-foot';const b=document.createElement('button');b.className='btn';b.textContent='Закрыть';b.onclick=()=>{d.close();location.reload();};foot.append(b);d.append(foot);}
async function chooseFile(){return new Promise(resolve=>{const i=document.createElement('input');i.type='file';i.accept='.xlsx,.xls,.csv';i.hidden=true;let done=false;const end=value=>{if(done)return;done=true;i.remove();resolve(value);};i.onchange=()=>end(i.files?.[0]||null);i.oncancel=()=>end(null);document.body.append(i);i.click();});}
async function importWorkbook(){
 if(busy)return;busy=true;let started=false;
 try{
  const me=await api('me');if(!['owner','admin'].includes(me.role))throw new Error('Импорт Excel доступен владельцу и администратору');
  const file=await chooseFile();if(!file)return;if(file.size>10*1024*1024)throw new Error('Файл больше 10 МБ. Разделите его на несколько файлов');
  const data=await file.arrayBuffer(),fileHash=await digestBytes(data),checkpoint=checkpointStore(localStorage,fileHash);
  if(checkpoint.state.complete){alert('Этот файл уже импортирован. Повторный приход не выполнен. Для новой поставки подготовьте отдельный файл с номером нового документа.');return;}
  const XLSX=await loadLibrary(XLSX_URL,'XLSX');const wb=XLSX.read(data,{type:'array',cellDates:false});const sheet=wb.Sheets['Товары']||wb.Sheets[wb.SheetNames[0]];if(!sheet)throw new Error('В книге нет листов');
  const bounds=XLSX.utils.decode_range(sheet['!ref']||'A1');if(bounds.e.r>5000||bounds.e.c>100)throw new Error('В одном файле допускается до 5000 строк и 100 столбцов');
  const rows=XLSX.utils.sheet_to_json(sheet,{defval:'',raw:true}),catalog=await api('catalog'),plan=planImport(rows,catalog);
  if(!confirm(`Строк: ${plan.length}. Приход: ${plan.reduce((s,r)=>s+r.quantity,0)} шт.\nПустые цены существующих товаров сохраняются. При ошибке импорт остановится. Продолжить?`))return;
  showProgress('Импорт товаров','Проверка всех строк завершена');started=true;
  const result=await runImport(plan,{api,catalog,fileHash,checkpoint,onProgress:setProgress});
  finish(`Создано: ${result.created}\nОбновлено: ${result.updated}\nПринято за этот запуск: ${result.received} шт.\nПовторный импорт этого файла заблокирован.`);
 }catch(e){if(started){setProgress(0,0,'Импорт остановлен');finish(`${e.message}\n\nНе загружайте изменённый файл как новую поставку. Для продолжения выберите тот же исходный файл: сохранятся коды уже выполненных приходов. При сообщении о незавершённой операции сначала сверьте склад.`);}else alert(e.message);}finally{busy=false;}
}
function enhance(){const tools=document.querySelector('[data-inv-tools]');if(!tools||tools.querySelector('[data-import-xlsx]'))return;const b=document.createElement('button');b.className='btn ghost';b.dataset.importXlsx='1';b.textContent='Импорт Excel';b.onclick=importWorkbook;tools.insertBefore(b,tools.querySelector('[data-export]')||null);}
let timer;const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(enhance,80);});observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(enhance,250);
