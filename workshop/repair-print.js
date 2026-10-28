import {esc,money,date,fio,number,total} from './core.js';
import {customerRepairLink} from './customer-link.js';

let activePrintLayout = null;
window.addEventListener('beforeprint', () => activePrintLayout?.());

const printStyle = `<style>
 .print-page.fg-repair-print{box-sizing:border-box;width:206mm;max-width:none;min-height:0;padding:8mm;margin:20px auto;border:0;border-radius:0;background:#fff;color:#171717;color-scheme:light;font:10pt/1.3 Arial,sans-serif;box-shadow:0 4px 24px #0002}
 .fg-repair-print *{box-sizing:border-box}
 .fg-repair-print .fg-print-content{width:190mm;margin:0 auto;padding:0;color:#171717;background:#fff}
 .fg-repair-print .fg-client-copy{display:block;min-height:0}
 .fg-repair-print .fg-print-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5mm;align-items:center;margin:0 0 5mm}
 .fg-repair-print .fg-wordmark{font-size:25pt;line-height:1;font-weight:900;font-style:italic;letter-spacing:-1px}
 .fg-repair-print .fg-print-no{font-size:17pt;line-height:1.2;font-weight:700;text-align:right;overflow-wrap:anywhere}
 .fg-repair-print .fg-print-date{font-size:8.5pt;text-align:right;color:#555;margin-top:1mm}
 .fg-repair-print h1{font-size:20pt;font-weight:700;letter-spacing:-.4px;text-align:left;margin:0 0 2mm;line-height:1.15}
 .fg-repair-print h2{font-size:10.5pt;line-height:1.3;margin:0 0 2mm}
 .fg-repair-print p{margin:0 0 2mm;line-height:1.3;overflow-wrap:anywhere}
 .fg-repair-print .fg-print-intro{font-size:9pt;color:#555;margin-bottom:4mm}
 .fg-repair-print .fg-print-grid{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:3mm 7mm;margin:0 0 4mm}
 .fg-repair-print .fg-print-grid>div{min-width:0;overflow-wrap:anywhere;white-space:pre-wrap}
 .fg-repair-print .fg-print-grid small{display:block;color:#555;font-size:8pt;margin:0 0 1mm;line-height:1.2}
 .fg-repair-print .fg-print-problem{padding:3mm;border:.25mm solid #aaa;border-radius:2mm;margin:0 0 4mm;overflow-wrap:anywhere}
 .fg-repair-print .fg-print-problem p{white-space:pre-wrap}
 .fg-repair-print .fg-print-problem p:last-child{margin:0}
 .fg-repair-print table{width:100%;table-layout:fixed;font-size:9pt;line-height:1.25;border-collapse:collapse;margin:0 0 3mm;background:white}
 .fg-repair-print th,.fg-repair-print td{border:0;border-bottom:.2mm solid #ccc;padding:1.5mm 2mm;color:#171717;background:white;vertical-align:top;overflow-wrap:anywhere;white-space:normal;text-align:left}
 .fg-repair-print th{font-size:8pt;font-weight:400;color:#555}
 .fg-repair-print th:first-child,.fg-repair-print td:first-child{padding-left:0}
 .fg-repair-print th:nth-child(2),.fg-repair-print td:nth-child(2){text-align:center;white-space:nowrap}
 .fg-repair-print th:last-child,.fg-repair-print td:last-child{text-align:right;white-space:nowrap;padding-right:0}
 .fg-repair-print .fg-print-sum{display:grid;grid-template-columns:1fr 1fr;gap:5mm;border-top:.4mm solid #333;padding:2mm 0 0;margin:0 0 4mm;font-size:9pt;break-inside:avoid}
 .fg-repair-print .fg-print-sum>div:last-child{text-align:right}
 .fg-repair-print .fg-print-sum strong{display:block;font-size:14pt;line-height:1.3}
 .fg-repair-print .fg-customer-qr{display:grid;grid-template-columns:minmax(0,1fr) 30mm;gap:5mm;align-items:center;margin:0;padding:2mm 3mm;border:.25mm solid #aaa;border-radius:2mm;break-inside:avoid}
 .fg-repair-print .fg-customer-qr strong{font-size:13pt;line-height:1.25}
 .fg-repair-print .fg-customer-qr p{font-size:9pt;margin:2mm 0 0;line-height:1.3}
 .fg-repair-print .fg-customer-qr.fg-without-qr{grid-template-columns:1fr;min-height:20mm}
 .fg-repair-print .fg-qrcode{width:30mm;height:30mm;background:#fff;line-height:0}
 .fg-repair-print .fg-qrcode svg{display:block;width:30mm;height:30mm}
 .fg-repair-print .fg-print-contact{font-size:8pt;line-height:1.3;margin:3mm 0 0}
 .fg-repair-print .fg-print-signatures{display:grid;grid-template-columns:1fr 1fr;gap:12mm;font-size:8.5pt;margin:4mm 0 0;break-inside:avoid}
 .fg-repair-print .fg-print-signatures span{display:flex;align-items:baseline;gap:2mm;min-width:0}
 .fg-repair-print .fg-signature-line{flex:1;min-width:20mm;height:4mm;border-bottom:.2mm solid #777}
 .fg-repair-print .fg-print-cut{border-top:.25mm dashed #777;margin:6mm 0 4mm;text-align:center;font-size:7.5pt;padding:1.5mm 0 0;color:#555;break-after:avoid}
 .fg-repair-print .fg-workshop-copy{display:grid;grid-template-columns:minmax(0,1fr) 30mm;gap:7mm;align-items:start;break-inside:avoid}
 .fg-repair-print .fg-workshop-copy h2{font-size:8pt;font-weight:400;color:#555;margin:0 0 1.5mm}
 .fg-repair-print .fg-workshop-copy .fg-print-no{text-align:left;font-size:20pt;margin:0 0 2mm}
 .fg-repair-print .fg-workshop-copy p{font-size:9pt;margin:0 0 1.5mm}
 .fg-repair-print .fg-workshop-copy small{display:block;font-size:7.5pt;line-height:1.3;color:#555;margin-top:2mm}
 .fg-repair-print.fg-print-compact{font-size:9pt}
 .fg-print-compact .fg-print-head{margin-bottom:3mm}
 .fg-print-compact h1{font-size:17pt}
 .fg-print-compact .fg-print-grid{gap:2mm 5mm;margin-bottom:3mm}
 .fg-print-compact .fg-print-problem{padding:2mm;margin-bottom:3mm}
 .fg-print-compact td{padding-top:1mm;padding-bottom:1mm;font-size:8.5pt}
 .fg-print-compact .fg-print-cut{margin-top:4mm;margin-bottom:3mm}
 @media screen and (max-width:820px){.workspace:has(.fg-repair-print){overflow-x:auto}.print-page.fg-repair-print{margin:16px 0}}
 @media print{
  :root:has(.fg-repair-print){color-scheme:light!important;background:#fff!important}
  body:has(.fg-repair-print){margin:0!important;padding:0!important;background:#fff!important;color:#171717!important}
  .shell:has(.fg-repair-print),.content:has(.fg-repair-print),.workspace:has(.fg-repair-print){display:block!important;min-height:0!important;height:auto!important;padding:0!important;margin:0!important;border:0!important;box-shadow:none!important;background:#fff!important;overflow:visible!important}
  .print-page.fg-repair-print{width:190mm;max-width:none;min-height:0;padding:0;margin:0 auto;box-shadow:none;border:0;background:#fff}
  .fg-repair-print .fg-client-copy{break-inside:auto}
  @page{size:A4 portrait;margin:10mm}
 }
 </style>`;

export async function renderFriendlyRepair(ctx,p,token,r){
 if(['ready','issued'].includes(r.status))return renderCompletionRepair(ctx,p,token,r);
 let customerUrl='';
 try{customerUrl=await customerRepairLink(r.id);}catch(error){const fallback=new URL('https://ivankirillov414-art.github.io/fastgo-control/repair-status.html');fallback.hash='repair='+r.id;customerUrl=fallback.href;}
 const n=number(r,'repair'),vehicle=[r.brand,r.model].filter(Boolean).join(' '),rows=[...(r.works||[]),...(r.parts||[])];
 const html=`${printStyle}<div class="print-tools"><button class="btn" id="print-document">Печать</button><a class="btn secondary" href="${ctx.href('order',{kind:'repair',id:r.id})}">К карточке</a></div>
 <article class="print-page fg-repair-print"><div class="fg-print-content"><section class="fg-client-copy">
 <header class="fg-print-head"><div class="fg-wordmark">FASTGO</div><div><div class="fg-print-no">Ремонт № ${esc(n)}</div><div class="fg-print-date">${date(r.created_at)}</div></div></header>
 <h1>Ваша техника — у нас.</h1><p class="fg-print-intro">Сохраните эту часть для получения техники и проверки готовности.</p>
 <div class="fg-print-grid"><div><small>Владелец</small><b>${esc(fio(r))}</b></div><div><small>Телефон</small>${esc(r.phone)}</div><div><small>Техника</small><b>${esc(vehicle)}</b></div><div><small>Серийный номер</small>${esc(r.serial_number||'Не указан')}</div></div>
 <div class="fg-print-problem"><h2>С чем разбираемся</h2><p>${esc(r.issue_description||'Проверка техники')}</p><p><b>Состояние:</b> ${esc(r.condition_notes||'Зафиксировано при приёмке')}</p></div>
 ${rows.length?`<table aria-label="Записи техкарты без стоимости"><colgroup><col><col style="width:15mm"></colgroup><thead><tr><th>Работы и детали</th><th>Кол.</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.name)}</td><td>${Number(x.quantity)||1}</td></tr>`).join('')}</tbody></table>`:''}
 <div class="fg-customer-qr${customerUrl?'':' fg-without-qr'}"><div><strong>Как там мой ремонт?</strong><p>${customerUrl?'Наведите камеру на QR, чтобы узнать текущий этап ремонта.':'Уточните готовность по телефону 96-04-86. Назовите номер ремонта, указанный выше.'}</p></div>${customerUrl?'<div class="fg-qrcode" id="customer-document-qr"></div>':''}</div>
 <div class="fg-print-contact">FastGo · Оренбург, проспект Победы, 79 · 96-04-86</div><div class="fg-print-signatures"><span>Передал <i class="fg-signature-line"></i></span><span>Принял <i class="fg-signature-line"></i></span></div></section>
 <div class="fg-print-cut">Отделите по линии · ниже — часть мастерской</div>
 <section class="fg-workshop-copy"><div><h2>Остаётся с техникой</h2><div class="fg-print-no">№ ${esc(n)}</div><p><b>${esc(vehicle)}</b></p><p>${esc(fio(r))} · ${esc(r.phone)}</p><p>Мастер ____________________</p><small>QR — рабочая карточка. Вход только для сотрудников.</small></div><div class="fg-qrcode" id="document-qr"></div></section></div></article>`;
 if(!ctx.mount(html,token))return;
 if(!window.qrcode)throw new Error('Не загрузился генератор QR. Обновите страницу');
 const staffUrl=new URL('workshop.html',location.href);staffUrl.hash=ctx.href('order',{kind:'repair',id:r.id}).slice(1);
 for(const [id,url,label] of [['customer-document-qr',customerUrl,'Статус вашего ремонта'],['document-qr',staffUrl.href,'Рабочая карточка']]){
  if(!url)continue;const qr=window.qrcode(0,'M');qr.addData(url);qr.make();document.getElementById(id).innerHTML=qr.createSvgTag({cellSize:2,margin:8,scalable:true,title:{text:label,id:id+'-title'}});
 }
 const sheet=document.querySelector('.fg-repair-print'),content=sheet.querySelector('.fg-print-content');
 const fit=()=>{
  if(!sheet.isConnected)return;
  content.style.zoom='1';sheet.classList.remove('fg-print-compact');
  // Leave 13 mm of slack inside the 277 mm printable area for driver rounding.
  const available=264*96/25.4;
  if(content.getBoundingClientRect().height>available)sheet.classList.add('fg-print-compact');
  const scale=Math.min(1,available/content.getBoundingClientRect().height);
  content.style.zoom=String(Math.floor(scale*10000)/10000);sheet.dataset.printScale=content.style.zoom;
 };
 activePrintLayout=fit;
 await document.fonts?.ready;
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 fit();
 document.getElementById('print-document').onclick=()=>{fit();window.print();};
 if(p.auto_print==='1'&&location.hash.includes('auto_print=1'))window.print();
}

export async function renderCompletionRepair(ctx,p,token,r){
 if(!['ready','issued'].includes(r.status))throw Error('Акт выполненных работ доступен после завершения ремонта');
 const works=r.works||[],parts=r.parts||[],sum=items=>items.reduce((n,x)=>n+Number(x.price||0)*Number(x.quantity||1),0),gross=sum(works)+sum(parts),final=Number(r.total_amount||0);
 const master=r.step_state?.completion_master_name||r.master_first_name||String(r.assigned_master||'').trim().split(/\s+/)[0]||'Не указан';
 const table=(title,items)=>'<h2>'+title+'</h2>'+(items.length?'<table><colgroup><col><col style="width:14mm"><col style="width:26mm"><col style="width:27mm"></colgroup><thead><tr><th>Наименование</th><th>Кол.</th><th>Цена, ₽</th><th>Сумма, ₽</th></tr></thead><tbody>'+items.map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+Number(x.quantity||1)+'</td><td>'+money(x.price)+'</td><td>'+money(Number(x.price)*Number(x.quantity||1))+'</td></tr>').join('')+'</tbody></table>':'<p>Запчасти не использовались.</p>');
 const html=printStyle+`<div class="print-tools"><button class="btn" id="print-document">Печать</button><a class="btn secondary" href="${ctx.href('order',{kind:'repair',id:r.id})}">К карточке</a></div><article class="print-page fg-repair-print"><div class="fg-print-content"><header class="fg-print-head"><div class="fg-wordmark">FASTGO</div><div><div class="fg-print-no">Ремонт № ${esc(number(r,'repair'))}</div><div class="fg-print-date">${date(r.step_state?.completion_at||r.issued_at||r.created_at)}</div></div></header><h1>АКТ ВЫПОЛНЕННЫХ РАБОТ</h1><p class="fg-print-intro">Работы и установленные запчасти по завершённому ремонту.</p><div class="fg-print-grid"><div><small>Клиент</small><b>${esc(fio(r))}</b><p>${esc(r.phone)}</p></div><div><small>Техника</small><b>${esc([r.brand,r.model].filter(Boolean).join(' '))}</b><p>Серийный номер: ${esc(r.serial_number||'не указан')}</p></div><div><small>Мастер</small><b data-completion-master>${esc(master)}</b></div></div>${table('Выполненные работы',works)}<p>Стоимость работ: <b>${money(sum(works))}</b></p>${table('Установленные запчасти',parts)}<p>Стоимость запчастей: <b>${money(sum(parts))}</b></p>${Math.abs(gross-final)>.005?'<p>'+ (gross>final?'Скидка: ':'Корректировка итоговой стоимости: ')+money(Math.abs(gross-final))+'</p>':''}<div class="fg-print-sum"><div>Итоговая стоимость<strong>${money(final)}</strong></div></div><div class="fg-print-problem"><h2>Комментарий мастера</h2><p data-completion-comment>${esc(r.step_state?.master_comment||'Комментарий не указан')}</p></div><p>Работа техники проверена.</p><div class="fg-print-signatures"><span>Мастер ${esc(master)} <i class="fg-signature-line"></i></span><span>Клиент <i class="fg-signature-line"></i></span></div><div class="fg-print-contact">FastGo · Оренбург, проспект Победы, 79 · 96-04-86</div></div></article>`;
 if(!ctx.mount(html,token))return;activePrintLayout=null;document.getElementById('print-document').onclick=()=>window.print();if(p.auto_print==='1')window.print();
}
