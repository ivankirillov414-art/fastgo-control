import {esc,money} from './client.js';

const names={cash:'Наличные',transfer:'Перевод',card:'Безналичные'};
const localDay=(date=new Date())=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
const displayDay=value=>value.split('-').reverse().join('.');

export function mountFinalReport({root,call}){
 let disposed=false,revision=0,mode='today',day='',timer;
 root.classList.add('final-report');
 root.innerHTML='<div class="toolbar"><h1>Итоговый отчёт</h1><button type="button" data-refresh>Обновить</button></div><form data-period><label>С даты<input type="date" name="from"></label><label>По дату<input type="date" name="to"></label><button>Показать</button><button type="button" data-today>Сегодня</button><button type="button" data-yesterday>Вчера</button><button type="button" data-all>За всё время</button></form><p data-report-period></p><p data-report-status role="status"></p><div class="report-total">Все операции <strong data-grand-total>—</strong><span data-count></span></div><div data-groups></div>';
 const $=s=>root.querySelector(s),form=$('[data-period]');
 const setDay=value=>{form.elements.from.value=value;form.elements.to.value=value;};
 const parameters=()=>{
  const from=form.elements.from.value,to=form.elements.to.value;
  const date=value=>new Date(value+'T00:00:00'),end=to?date(to):null;
  // The upper bound is the next local midnight, including on DST changes.
  if(end)end.setDate(end.getDate()+1);
  return {...(from?{from:date(from).toISOString()}:{}),...(end?{to:end.toISOString()}: {})};
 };
 const markMode=()=>{$('[data-today]').setAttribute('aria-pressed',String(mode==='today'));$('[data-all]').setAttribute('aria-pressed',String(mode==='all'));};
 const describePeriod=()=>{
  const from=form.elements.from.value,to=form.elements.to.value;
  if(!from&&!to)return 'За всё время';
  if(from===to)return (mode==='today'?'Сегодня · ':'Дата · ')+displayDay(from);
  return 'Период: '+(from?displayDay(from):'с начала учёта')+' — '+(to?displayDay(to):'по настоящее время');
 };
 const row=x=>'<article class="report-operation"><time>'+esc(new Date(x.created_at).toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short'}))+'</time><div><b>'+esc(x.title)+'</b>'+(x.note?'<small>'+esc(x.note)+'</small>':'')+'<small>'+esc(x.actor)+'</small></div><strong>'+money(x.amount)+'</strong></article>';

 async function refresh(){
  if(disposed)return;
  if(mode==='today'){day=localDay();setDay(day);}
  markMode();
  const current=++revision,opened=new Set([...root.querySelectorAll('details[open]')].map(x=>x.dataset.method));
  $('[data-report-period]').textContent=describePeriod();
  $('[data-report-status]').textContent='Загружаем проведённые операции…';
  $('[data-refresh]').disabled=true;
  // Never leave the previous day's figures under the new day's heading.
  $('[data-grand-total]').textContent='—';$('[data-count]').textContent='';$('[data-groups]').innerHTML='';
  try{
   const period=parameters(),data=await call('final_report',period);
   if(disposed||current!==revision)return;
   $('[data-grand-total]').textContent=money(data.total);$('[data-count]').textContent='Операций: '+data.count;
   $('[data-groups]').innerHTML=data.groups.map(g=>'<details data-method="'+g.method+'"'+(opened.has(g.method)?' open':'')+'><summary><span>'+names[g.method]+'<small>'+g.count+' операций</small></span><strong>'+money(g.total)+'</strong><span class="report-chevron" aria-hidden="true">▶</span></summary><div class="report-operations">'+(g.items.map(row).join('')||'<p>Операций нет.</p>')+'</div>'+(g.items.length<g.count?'<button type="button" data-more="'+g.method+'" data-offset="'+g.items.length+'">Ещё операции</button>':'')+'</details>').join('');
   $('[data-report-status]').textContent='Проведённые продажи и оплаты работ, ремонтов и хранения. Выдача запчастей мастеру не является оплатой.';
   root.querySelectorAll('[data-more]').forEach(button=>button.onclick=async()=>{
    if(disposed||current!==revision)return;
    if(mode==='today'&&day!==localDay()){void refresh();return;}
    button.disabled=true;
    try{
     // Pagination belongs to the displayed report, even while dates are being edited.
     const data=await call('final_report',{...period,method:button.dataset.more,offset:Number(button.dataset.offset)});
     if(disposed||current!==revision)return;
     const group=data.groups.find(g=>g.method===button.dataset.more);
     button.previousElementSibling.insertAdjacentHTML('beforeend',group.items.map(row).join(''));
     button.dataset.offset=String(Number(button.dataset.offset)+group.items.length);
     button.hidden=Number(button.dataset.offset)>=group.count;
    }catch(e){if(!disposed&&current===revision)$('[data-report-status]').textContent=e.message;}
    finally{button.disabled=false;}
   });
  }catch(e){if(!disposed&&current===revision)$('[data-report-status]').textContent='Отчёт не загружен: '+e.message;}
  finally{if(!disposed&&current===revision)$('[data-refresh]').disabled=false;}
 }

 function checkDay(){
  if(disposed)return;
  if(mode==='today'&&day!==localDay())void refresh();
  clearTimeout(timer);
  const now=new Date(),midnight=new Date(now);
  midnight.setHours(24,0,0,0);
  // Also recheck wall-clock/time-zone changes while the application stays open.
  timer=setTimeout(checkDay,Math.min(60000,Math.max(50,midnight-now+20)));
 }
 const visible=()=>{if(document.visibilityState==='visible')checkDay();};
 form.oninput=()=>{mode='custom';markMode();};
 form.onsubmit=e=>{e.preventDefault();const from=form.elements.from.value,to=form.elements.to.value;mode=from===localDay()&&to===from?'today':!from&&!to?'all':'custom';void refresh();};
 $('[data-refresh]').onclick=()=>void refresh();
 $('[data-today]').onclick=()=>{mode='today';void refresh();};
 $('[data-yesterday]').onclick=()=>{const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);mode='custom';setDay(localDay(yesterday));void refresh();};
 $('[data-all]').onclick=()=>{mode='all';form.reset();void refresh();};
 const ready=refresh();
 window.addEventListener('focus',checkDay);window.addEventListener('pageshow',checkDay);window.addEventListener('online',checkDay);document.addEventListener('visibilitychange',visible);
 checkDay();
 return {ready,dispose(){disposed=true;revision++;clearTimeout(timer);window.removeEventListener('focus',checkDay);window.removeEventListener('pageshow',checkDay);window.removeEventListener('online',checkDay);document.removeEventListener('visibilitychange',visible);}};
}
