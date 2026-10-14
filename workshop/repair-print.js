import {esc,money,date,fio,number,total} from './core.js';
import {customerRepairLink} from './customer-link.js';
export async function renderFriendlyRepair(ctx,p,token,r){
 const customerUrl=await customerRepairLink(r.id),n=number(r,'repair'),vehicle=[r.brand,r.model].filter(Boolean).join(' ');
 const rows=[...(r.works||[]),...(r.parts||[])];
 const style=`<style>
 .print-page.fg-repair-print{width:210mm;max-width:100%;min-height:297mm;padding:14mm;border:0;border-radius:0;background:#fff;color:#171717;font:11pt/1.4 Arial,sans-serif;box-shadow:0 4px 24px #0002}
 .fg-repair-print .fg-client-copy{min-height:178mm;display:flex;flex-direction:column}
 .fg-repair-print .fg-print-head{display:flex;justify-content:space-between;gap:15px;align-items:center;margin-bottom:10mm}
 .fg-repair-print .fg-wordmark{font-size:29pt;font-weight:900;font-style:italic;letter-spacing:-1.5px}
 .fg-repair-print .fg-print-no{font-size:19pt;font-weight:700;text-align:right}
 .fg-repair-print .fg-print-date{font-size:9pt;text-align:right;color:#555}
 .fg-repair-print h1{font-size:25pt;letter-spacing:-.6px;margin:0 0 3mm;line-height:1.15}
 .fg-repair-print h2{font-size:12pt;margin:0 0 3mm}
 .fg-repair-print p{margin:0 0 3mm}
 .fg-repair-print .fg-print-intro{color:#555;margin-bottom:8mm}
 .fg-repair-print .fg-print-grid{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-bottom:6mm}
 .fg-repair-print .fg-print-grid small{display:block;color:#555;font-size:9pt;margin-bottom:1mm}
 .fg-repair-print .fg-print-problem{padding:4mm;border:1px solid #aaa;border-radius:4mm;margin-bottom:6mm;overflow-wrap:anywhere}
 .fg-repair-print .fg-print-problem p:last-child{margin:0}
 .fg-repair-print table{width:100%;font-size:10pt;border-collapse:collapse;margin:0 0 5mm}
 .fg-repair-print td,.fg-repair-print th{border:0;border-bottom:1px solid #ccc;padding:2mm 0;text-align:left;overflow-wrap:anywhere}
 .fg-repair-print td:last-child,.fg-repair-print th:last-child{text-align:right;white-space:nowrap}
 .fg-repair-print .fg-print-sum{display:flex;justify-content:space-between;gap:5mm;border-top:2px solid;padding-top:3mm;margin-bottom:6mm}
 .fg-repair-print .fg-print-sum strong{font-size:16pt}
 .fg-repair-print .fg-customer-qr{display:grid;grid-template-columns:1fr 29mm;gap:5mm;align-items:center;margin-top:auto;padding:4mm;border:1px solid #aaa;border-radius:4mm;break-inside:avoid}
 .fg-repair-print .fg-customer-qr strong{font-size:15pt}
 .fg-repair-print .fg-customer-qr p{font-size:10pt;margin-top:2mm}
 .fg-repair-print .fg-qrcode img{display:block;width:29mm;height:29mm;image-rendering:pixelated}
 .fg-repair-print .fg-print-contact{font-size:9pt;margin-top:5mm}
 .fg-repair-print .fg-print-signatures{display:flex;justify-content:space-between;font-size:9pt;margin:5mm 0}
 .fg-repair-print .fg-print-cut{border-top:1px dashed #777;margin:7mm 0 5mm;text-align:center;font-size:8pt;padding-top:2mm;color:#555}
 .fg-repair-print .fg-workshop-copy{display:grid;grid-template-columns:1fr 29mm;gap:6mm;break-inside:avoid}
 .fg-repair-print .fg-workshop-copy h2{font-size:10pt;font-weight:400;color:#555}
 .fg-repair-print .fg-workshop-copy .fg-print-no{text-align:left;font-size:26pt;margin-bottom:3mm}
 .fg-repair-print .fg-workshop-copy p{font-size:10pt}
 .fg-repair-print .fg-workshop-copy small{font-size:8pt;color:#555}
 @media print{.print-page.fg-repair-print{width:190mm;max-width:none;min-height:277mm;padding:0;box-shadow:none;margin:0}.workspace:has(.fg-repair-print){padding:0!important}@page{size:A4;margin:10mm}}
 </style>`;
 const html=`${style}<div class="print-tools"><button class="btn" id="print-document">Печать</button><a class="btn secondary" href="${ctx.href('order',{kind:'repair',id:r.id})}">К карточке</a></div><article class="print-page fg-repair-print"><section class="fg-client-copy"><header class="fg-print-head"><div class="fg-wordmark">FASTGO</div><div><div class="fg-print-no">Ремонт № ${esc(n)}</div><div class="fg-print-date">${date(r.created_at)}</div></div></header><h1>Ваша техника — у нас.</h1><p class="fg-print-intro">Сохраните эту часть. Она поможет забрать технику и следить за ремонтом.</p><div class="fg-print-grid"><div><small>Владелец</small><b>${esc(fio(r))}</b></div><div><small>Телефон</small>${esc(r.phone)}</div><div><small>Техника</small><b>${esc(vehicle)}</b></div><div><small>Серийный номер</small>${esc(r.serial_number||'Не указан')}</div></div><div class="fg-print-problem"><h2>С чем разбираемся</h2><p>${esc(r.issue_description||'Проверка техники')}</p><p><b>Состояние:</b> ${esc(r.condition_notes||'Зафиксировано при приёмке')}</p><p><b>В комплекте:</b> ${esc(r.accessories||'Не указано')}</p></div>${rows.length?`<table><thead><tr><th>Работы и запчасти</th><th>Кол.</th><th>Сумма</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.name)}</td><td>${Number(x.quantity)||1}</td><td>${money(Number(x.price)*(Number(x.quantity)||1))}</td></tr>`).join('')}</tbody></table>`:''}<div class="fg-print-sum"><div>Стоимость<br><strong>${money(total(r,'repair'))}</strong></div><div>Оплачено<br><strong>${money(r.paid_amount)}</strong></div></div><div class="fg-customer-qr"><div><strong>Как там мой ремонт?</strong><p>Наведите камеру на QR — увидите текущий этап и узнаете, когда можно забирать.</p></div><div class="fg-qrcode" id="customer-document-qr"></div></div><div class="fg-print-contact">FastGo · Оренбург, проспект Победы, 79 · 96-04-86</div><div class="fg-print-signatures"><span>Передал __________________</span><span>Принял __________________</span></div></section><div class="fg-print-cut">Отделите по линии · ниже — часть мастерской</div><section class="fg-workshop-copy"><div><h2>Остаётся с техникой</h2><div class="fg-print-no">№ ${esc(n)}</div><p><b>${esc(vehicle)}</b></p><p>${esc(fio(r))} · ${esc(r.phone)}</p><p>Мастер ____________________</p><small>QR справа — рабочая карточка. Вход только для сотрудников.</small></div><div class="fg-qrcode" id="document-qr"></div></section></article>`;
 if(!ctx.mount(html,token))return;
 if(!window.qrcode)throw new Error('Не загрузился генератор QR. Обновите страницу');
 const staffUrl=new URL('workshop.html',location.href);staffUrl.hash=ctx.href('order',{kind:'repair',id:r.id}).slice(1);
 for(const [id,url,label] of [['customer-document-qr',customerUrl,'Статус вашего ремонта'],['document-qr',staffUrl.href,'Рабочая карточка']]){const qr=window.qrcode(0,'M');qr.addData(url);qr.make();document.getElementById(id).innerHTML=qr.createImgTag(4,4,label);}
 document.getElementById('print-document').onclick=()=>window.print();
 if(p.auto_print==='1'){await document.fonts?.ready;await Promise.all([...document.querySelectorAll('.fg-repair-print img')].map(img=>img.decode?.().catch(()=>{})||Promise.resolve()));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));if(document.getElementById('customer-document-qr')&&location.hash.includes('auto_print=1'))window.print();}
}
