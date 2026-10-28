import {esc,matchBarcode} from './client.js';
import {bindScanner} from './scanner.js';
export function installScannerDiagnostics({parts,report=async()=>{}}){
 const bridge=window.warehouseDesktop;if(!bridge?.scannerStatus)return;
 const button=document.createElement('button');button.textContent='Сканер';button.id='hardware-scanner';document.querySelector('header').append(button);
 button.onclick=async()=>{
  const dialog=document.createElement('dialog');dialog.className='barcode-print-dialog';dialog.setAttribute('aria-label','Проверка сканера');dialog.innerHTML='<h2>Проверка сканера</h2><div data-devices>Проверяем подключение Windows…</div><p>Сканируйте этикетки по очереди. Проверка не создаёт приход или продажу.</p><form><label>Код со сканера<input data-scan autocomplete="off" spellcheck="false"></label><button type="submit">Проверить код</button></form><p data-result role="status"></p><button type="button" data-close>Закрыть</button>';document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-close]').onclick=()=>dialog.close();const form=dialog.querySelector('form'),input=dialog.querySelector('[data-scan]'),result=dialog.querySelector('[data-result]');
  form.onsubmit=e=>{e.preventDefault();const code=input.value.trim();input.value='';if(!code)return;const matches=matchBarcode(parts(),code);result.textContent=matches.length===1?'Сканер передал код · '+matches[0].name:'Код получен, совпадений в каталоге: '+matches.length;void report({scan_test:{received:true,matched:matches.length===1,characters:code.length}}).catch(()=>{});};
  const dispose=bindScanner(input,form,()=>dialog.open);dialog.onclose=()=>{dispose();dialog.remove();};
  try{const status=await bridge.scannerStatus();if(!dialog.isConnected)return;dialog.querySelector('[data-devices]').innerHTML=status.devices.length?status.devices.map(d=>'<p><b>'+esc(d.name)+'</b><br><small>'+esc(d.kind)+' · '+esc(d.status)+' · '+esc(d.hardware)+'</small></p>').join(''):'<p>Windows не сообщила о подключённом USB-сканере. Проверьте питание и кабель.</p>';await report({scanner:status});}catch(e){if(dialog.isConnected)dialog.querySelector('[data-devices]').textContent=e.message;}
 };
}
