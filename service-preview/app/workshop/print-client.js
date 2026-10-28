import {printApi} from './core.js';
const prefix='fastgo_print_pending_';
function pending(actor){try{return JSON.parse(localStorage.getItem(prefix+actor)||'[]');}catch{return [];}}
function save(actor,jobs){localStorage.setItem(prefix+actor,JSON.stringify(jobs));}
export async function enqueueIntake(kind,id,actor){
 const job={kind,id,request_id:id}; // stable across save retries and page reloads
 const jobs=pending(actor);if(!jobs.some(x=>x.kind===kind&&x.id===id)){jobs.push(job);save(actor,jobs);}
 const result=await printApi('enqueue',job);
 save(actor,pending(actor).filter(x=>x.kind!==kind||x.id!==id));
 return result;
}
const flushing=new Set();
export async function flushIntakePrints(actor){
 if(!actor||flushing.has(actor))return;flushing.add(actor);
 try{for(const job of pending(actor)){await printApi('enqueue',job);save(actor,pending(actor).filter(x=>x.kind!==job.kind||x.id!==job.id));}}
 finally{flushing.delete(actor);}
}
export async function sendManualPrint(kind,id){
 const state=await printApi('status');if(!state.enabled)return false;
 await printApi('enqueue',{kind,id,request_id:crypto.randomUUID()});return true;
}
export async function renderPrintSettings(ctx,token){
 const state=await printApi('status'),station=new URL('print-station.html',location.href);
 ctx.mount(ctx.head('Печать на ноутбуке','Лист мастера с QR после приёмки')+`<section class="panel"><h2>Автоматическая печать</h2><p>${state.enabled?'Включена. Новые приёмки отправляются в очередь ноутбука.':'Ещё не настроена. Приёмки сохраняются без отправки на ноутбук.'}</p><p>На ноутбуке один раз выберите принтер и запустите отдельное окно FastGo без подтверждения печати. Окно должно оставаться открытым.</p><div class="actions"><a class="btn" href="${station.href}" target="_blank" rel="noopener">Открыть станцию печати</a><a class="btn secondary" href="FastGo-Print-Windows.cmd" download>Запуск для Windows</a><a class="btn secondary" href="FastGo-Print-Mac.command" download>Запуск для Mac</a></div><p class="muted">1. Скачайте запуск на ноутбук. 2. Выберите настройку, войдите в FastGo и распечатайте тест на нужном принтере. 3. Закройте окно настройки, запустите режим без подтверждения и включите приём заданий.</p>${ctx.admin()?'<button class="btn ghost" id="disable-remote-print">Отключить автоматическую печать</button>':''}</section>`,token);
 const b=document.getElementById('disable-remote-print');if(b)b.onclick=()=>ctx.run(b,async()=>{await printApi('deactivate');ctx.toast('Автоматическая печать отключена');ctx.refresh();});
}
