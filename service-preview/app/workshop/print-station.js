import {api,printApi,esc,sessionAvailable} from './core.js';
import {renderDocument} from './documents.js';
import {runPrintJob} from './print-worker.js';
const $=id=>document.getElementById(id);
let me,stationId=localStorage.getItem('fastgo_print_station_id'),running=false,timer,busy=false;
if(!stationId){stationId=crypto.randomUUID();localStorage.setItem('fastgo_print_station_id',stationId);}
const claimToken=crypto.randomUUID(),silent=new URLSearchParams(location.search).get('silent')==='1';
const status=text=>$('station-status').textContent=text;
const labels={queued:'В очереди',claimed:'Подготовка',dispatched:'Проверьте принтер: запуск уже выполнен',submitted:'Передано на печать',failed:'Ошибка подготовки'};
function display(data){
 $('station-queue').innerHTML=(data.jobs||[]).map(j=>`<div class="event"><b>${esc(j.kind==='storage'?'Хранение':'Ремонт')}</b> · ${esc(labels[j.status]||j.status)}<small>${new Date(j.created_at).toLocaleString('ru-RU')}${j.error?' · '+esc(j.error):''}</small>${['failed','dispatched'].includes(j.status)?`<button class="btn secondary small" data-retry="${j.id}">Повторить этот лист</button>`:''}</div>`).join('')||'<p>Очередь пуста.</p>';
 $('station-queue').querySelectorAll('[data-retry]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await printApi('retry',{job_id:b.dataset.retry});status('Лист возвращён в очередь');}catch(e){status(e.message);}finally{b.disabled=false;}});
}
async function prepare(job){
 $('station-document').innerHTML='';
 await renderDocument({me,mount:html=>{$('station-document').innerHTML=html;return true;},href:(page,p)=>'#'+page+'?'+new URLSearchParams(p)}, {kind:job.kind,id:job.record_id,type:'master'},0);
 await document.fonts?.ready;await Promise.all([...$('station-document').querySelectorAll('img')].map(img=>img.decode?.().catch(()=>{})||Promise.resolve()));
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
}
async function poll(){
 if(!running||busy)return;busy=true;
 try{
  const data=await printApi('status');display(data);
  if(!data.enabled||data.station_id!==stationId||data.owner_id!==me.profile_id){running=false;status('Приём заданий выключен или назначен другой ноутбук');return;}
  const result=await printApi('claim',{station_id:stationId,request_id:claimToken});
  if(result.job){
   status('Подготавливаем лист…');
   await runPrintJob(result.job,{prepare,call:(action,params)=>printApi(action,{...params,station_id:stationId,request_id:claimToken}),print:()=>window.print()});
   status('Лист передан на печать. Ожидаем следующую приёмку.');
  }else status('Ноутбук принимает задания. Ожидаем приёмку.');
 }catch(e){status(e.message+' · повторим проверку связи');}
 finally{busy=false;if(running)timer=setTimeout(poll,3000);}
}
async function start(){
 if(!silent){status('Для печати без подтверждения закройте это окно и выберите запуск в скачанном файле.');return;}
 if(!$('printer-ready').checked){status('Сначала выберите принтер в настройке запуска и отметьте готовность.');return;}
 await printApi('activate',{station_id:stationId});localStorage.setItem('fastgo_print_station_ready','1');running=true;clearTimeout(timer);poll();
}
async function init(){
 $('setup-instructions').hidden=silent;
 $('enable-print').disabled=true;
 if(!sessionAvailable()){status('Войдите в FastGo в этом окне, затем нажмите «Проверить вход».');return;}
 try{
  me=await api('me');if(!['developer','owner','admin'].includes(me.role))throw new Error('Назначить станцию печати может владелец или администратор');
  $('enable-print').disabled=false;status(silent?'Готово к включению автоматической печати.':'Режим настройки: выберите принтер через тестовый лист.');
  const data=await printApi('status');display(data);
  if(silent&&localStorage.getItem('fastgo_print_station_ready')==='1'&&data.enabled&&data.station_id===stationId&&data.owner_id===me.profile_id){$('printer-ready').checked=true;running=true;poll();}
 }catch(e){status(e.message);}
}
$('enable-print').onclick=()=>start().catch(e=>status(e.message));
$('stop-print').onclick=async()=>{running=false;clearTimeout(timer);try{await printApi('deactivate');status('Приём заданий выключен');}catch(e){status(e.message);}};
$('check-login').onclick=()=>location.reload();
$('test-print').onclick=()=>{
 $('station-document').innerHTML='<article class="print-page"><h1>FastGo — проверка принтера</h1><p>Если этот лист напечатан на нужном принтере, закройте окно настройки и запустите FastGo без подтверждения печати.</p></article>';
 window.print();
};
$('station-login').onclick=e=>{
 e.preventDefault();const url=new URL('workshop.html',location.href);url.hash='home';window.open(url.href,'fastgo-print-login');
 status('После входа вернитесь сюда и нажмите «Проверить вход».');
};
window.addEventListener('workshop-auth-required',()=>{running=false;clearTimeout(timer);status('Сессия истекла. Войдите в FastGo и проверьте вход.');});
window.addEventListener('storage',e=>{if(e.key==='fastgo_workshop_session'&&!me)location.reload();});
init();
