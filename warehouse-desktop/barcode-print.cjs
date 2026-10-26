const path=require('node:path'),{PrinterProfiles,labelSize,profile,printerList,availablePrinter}=require('./printer-profiles.cjs');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function barcodePrintHTML(p){
 if(!p||typeof p.name!=='string'||p.name.length>200||typeof p.barcode!=='string'||p.barcode.length>100||!Number.isInteger(p.quantity)||p.quantity<1||p.quantity>1000||!['a4','label'].includes(p.format))throw Error('Проверьте количество и формат этикеток');
 if(p.price!==undefined&&(typeof p.price!=='number'||!Number.isFinite(p.price)||p.price<0||p.price>100000000))throw Error('Проверьте цену товара');
 const price=p.price===undefined?'':p.price.toLocaleString('ru-RU',{maximumFractionDigits:2})+' ₽';
 const svg=p.svg;
 if(typeof svg!=='string'||svg.length>100000||!/^<svg\b[\s\S]*<\/svg>$/.test(svg)||/<\/?(?!svg\b|g\b|rect\b|text\b)[a-z]/i.test(svg)||/\bon[a-z]+\s*=|href\s*=|url\s*\(|<\?|<!|javascript:|data:|https?:/i.test(svg.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g,'')))throw Error('Некорректный штрихкод');
 const a4=p.format==='a4',size=a4?{widthMm:58,heightMm:30}:labelSize(p),width=size.widthMm,height=size.heightMm,barHeight=Math.min(15,height-15),p2=!a4&&require('./label-printer-setup.cjs').isP2({name:p.deviceName||''});
 let thermalCSS='';
 if(p2){
  // Preserve JsBarcode's two-dot modules at the P2's native 203 dpi. Stretching
  // an SVG to the full paper width gives bars fractional dots and closes gaps.
  const box=svg.match(/\bviewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/),dots=box?.slice(1).map(Number),paperDots=Math.min(384,Math.floor(width*203/25.4)),mm=n=>(n*25.4/203).toFixed(5)+'mm';
  if(!dots||!dots.every(n=>Number.isInteger(n)&&n>0)||dots[0]>paperDots-32||dots[1]!==72)throw Error('Штрихкод не помещается без искажения. Выберите более широкую этикетку.');
  thermalCSS='.label{position:relative;padding:0;display:block}.label strong,.label small{position:absolute;left:'+mm(16)+';width:'+mm(paperDots-32)+';overflow:hidden;white-space:nowrap;text-align:center}.label strong{top:'+mm(16)+';height:'+mm(26)+';max-height:none;font-size:8pt;line-height:'+mm(26)+';text-overflow:ellipsis}.label svg{position:absolute;left:'+mm(Math.floor((paperDots-dots[0])/2))+';top:'+mm(46)+';width:'+mm(dots[0])+';height:'+mm(72)+';shape-rendering:crispEdges}.label small{top:'+mm(122)+';height:'+mm(24)+';font-size:7pt;line-height:'+mm(24)+'}';
 }else if(!a4){
  thermalCSS='.label{justify-content:flex-start;padding:2mm;gap:.5mm}.label strong{width:100%;max-height:none;height:3.3mm;flex:0 0 3.3mm;font-size:8pt;line-height:3.3mm;white-space:nowrap;text-overflow:ellipsis}.label svg{height:9mm;shape-rendering:crispEdges}.label small{height:3mm;flex:0 0 3mm;line-height:3mm;white-space:nowrap}';
 }
 if(p2&&price){const dots=Math.min(384,Math.floor(width*203/25.4)),mm=n=>(n*25.4/203).toFixed(5)+'mm';thermalCSS+='.label strong{width:'+mm(dots-32-144)+';text-align:left}.label .price{position:absolute;right:'+mm(16)+';top:'+mm(16)+';width:'+mm(136)+';height:'+mm(26)+';line-height:'+mm(26)+';text-align:right;font-size:8pt}';}
 const label='<section class="label"><div class="label-heading"><strong>'+escape(p.name)+'</strong>'+(price?'<b class="price">'+escape(price)+'</b>':'')+'</div>'+svg+'<small>'+escape(p.barcode)+'</small></section>';
 return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><title>Этикетки FastGo</title><style>@page{size:'+(a4?'A4;margin:10mm':width+'mm '+height+'mm;margin:0')+'}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#000;background:#fff;'+(a4?'display:grid;grid-template-columns:repeat(3,58mm);grid-auto-rows:30mm;gap:2mm;':'')+'}.label{width:'+width+'mm;height:'+height+'mm;padding:2mm;display:flex;flex-direction:column;justify-content:center;align-items:center;overflow:hidden;break-inside:avoid;'+(a4?'':'break-after:page;')+'}.label:last-child{break-after:auto}.label-heading{display:flex;align-items:center;justify-content:space-between;gap:1mm;width:100%}.label-heading strong{min-width:0;flex:1;text-align:left}.price{font-size:8pt;font-weight:bold;white-space:nowrap}strong{font-size:9pt;line-height:1.1;max-height:8mm;overflow:hidden;text-align:center}small{font-size:7pt}svg{width:'+(width-4)+'mm;height:'+barHeight+'mm;flex-shrink:0}'+thermalCSS+'</style></head><body>'+label.repeat(p.quantity)+'</body></html>';
}
function registerBarcodePrinting({app,ipcMain,BrowserWindow,getWindow,preferences,listTimeout=10000,setup,receiptJournal}){
 const settings=preferences||new PrinterProfiles(path.join(app.getPath('appData'),'FastGo','printer-profiles.json'));
 const {LabelPrinterSetup,isP2}=require('./label-printer-setup.cjs');
 const driver=setup||(app?new LabelPrinterSetup({dir:path.join(app.getPath('appData'),'FastGo','printer-setup','p2'),enabled:app.isPackaged,station:async()=>{
  const window=getWindow();if(!window||window.isDestroyed()||!window.webContents.getURL().startsWith('fastgo://app/warehouse.html'))return '';
  return window.webContents.executeJavaScript('(async()=>{if(window.fastgoDesktop)return (await window.fastgoDesktop.warehouseStation())?.id||"";const s=JSON.parse(localStorage.getItem("fastgo_warehouse_session_v1")||"null");return s?.user_id?JSON.parse(localStorage.getItem("fgwarehouse:"+s.user_id+":station")||"null")?.id||"":"";})()');
 }}):null);
 let printing=false,readingPrinters;
 const receipts=receiptJournal||new (require('./receipt-label-journal.cjs').ReceiptLabelJournal)(path.join(path.dirname(settings.file),'receipt-labels'));
 async function systemPrinters(parent){
  if(!readingPrinters)readingPrinters=Promise.resolve().then(()=>parent.webContents.getPrintersAsync()).finally(()=>{readingPrinters=null;});
  let timer;try{return await Promise.race([readingPrinters,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Служба печати Windows не ответила вовремя. Проверьте подключение принтера и обновите список.')),listTimeout);})]);}finally{clearTimeout(timer);}
 }
 function trusted(event){const parent=getWindow();if(!parent||parent.isDestroyed()||event.sender!==parent.webContents||event.senderFrame!==parent.webContents.mainFrame||!require('./warehouse-bridge.cjs').allowedWarehouseURL(event.senderFrame?.url))throw Error('Недоступно');return parent;}
 function rememberP2(printers){const p=printers.find(isP2);if(p&&!settings.read().profiles.label)settings.save({format:'label',deviceName:p.name,widthMm:50,heightMm:30});}
 ipcMain.handle('warehouse:printers',async event=>{const parent=trusted(event);try{const printers=printerList(await systemPrinters(parent));rememberP2(printers);void driver?.ensure({printers}).catch(()=>{});return {printers,...settings.read(),setup:driver?.snapshot()};}catch{return {printers:[],...settings.read(),setup:driver?.snapshot(),warning:'Служба печати Windows не ответила вовремя. Проверьте подключение принтера и обновите список.'};}});
 ipcMain.handle('warehouse:printerSetup',async event=>{const parent=trusted(event);if(!driver)throw Error('Установка доступна в программе Windows');const printers=await systemPrinters(parent);void driver.ensure({printers,manual:true}).catch(()=>{});return {started:true};});
 ipcMain.handle('warehouse:printerSave',async(event,p)=>{const parent=trusted(event);if(printing)throw Error('Дождитесь завершения печати');if(p?.clear)return settings.clear(p.format);const next=profile(p);availablePrinter(await systemPrinters(parent),next.deviceName);return settings.save(next);});
 async function print(parent,p,beforeSubmit=()=>{}){
  if(printing)throw Error('Завершите открытую печать');barcodePrintHTML(p);printing=true;let child;
  try{
   const saved=settings.read(),previous=saved.profiles[p.format],deviceName=p.systemDialog===true?'':p.deviceName??previous?.deviceName??'';
   if(p.deviceName!==undefined&&typeof p.deviceName!=='string')throw Error('Выберите установленный принтер');
   if(deviceName){profile({...p,deviceName});availablePrinter(await systemPrinters(parent),deviceName);}
   const size=p.format==='label'?labelSize({widthMm:p.widthMm??previous?.widthMm,heightMm:p.heightMm??previous?.heightMm}):null;
   const html=barcodePrintHTML({...p,...size,deviceName});child=new BrowserWindow({show:false,parent,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,javascript:false}});child.webContents.on('will-navigate',e=>e.preventDefault());child.webContents.setWindowOpenHandler(()=>({action:'deny'}));await child.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));
   beforeSubmit();await new Promise((resolve,reject)=>child.webContents.print({silent:!!deviceName,...(deviceName?{deviceName}:{}),printBackground:true,copies:1,scaleFactor:100,pagesPerSheet:1,landscape:false,duplexMode:'simplex',...(p.format==='label'&&isP2({name:deviceName})?{color:false,dpi:{horizontal:203,vertical:203}}:{}),margins:{marginType:'none'},pageSize:p.format==='a4'?'A4':{width:Math.round(size.widthMm*1000),height:Math.round(size.heightMm*1000)}},(ok,reason)=>ok?resolve():reject(Object.assign(Error(/cancel/i.test(reason)?'Печать отменена':reason||'Принтер не принял задание'),{notSubmitted:true}))));
   let warning='';if(p.remember===true&&deviceName){try{settings.save({format:p.format,deviceName,...size});}catch{warning='Задание передано принтеру, но выбор принтера не удалось сохранить. Сохраните его в настройках.';}}
   return {printed:true,deviceName,warning};
  }finally{if(child&&!child.isDestroyed())child.destroy();printing=false;}
 }
 ipcMain.handle('warehouse:printBarcode',async(event,p)=>print(trusted(event),p));
 ipcMain.handle('warehouse:printReceiptLabels',async(event,p)=>{
  const parent=getWindow(),frame=event.senderFrame;
  let service=false;try{const u=new URL(frame?.url);service=u.protocol==='fastgo:'&&u.hostname==='app'&&u.pathname==='/workshop.html';}catch{}
  if(!parent||parent.isDestroyed()||event.sender!==parent.webContents||frame!==parent.webContents.mainFrame||!service&&!require('./warehouse-bridge.cjs').allowedWarehouseURL(frame?.url))throw Error('Недоступно');
  if(!p?.items||!Array.isArray(p.items))throw Error('Неверное задание печати');
  const printers=printerList(await systemPrinters(parent));rememberP2(printers);
  const saved=settings.read().profiles.label;if(!saved?.deviceName)throw Error('Подключите термопринтер и выберите его в настройках печати');
  availablePrinter(printers,saved.deviceName);
  for(const item of p.items)barcodePrintHTML({...item,...saved,format:'label'});
  return receipts.run(p,(item,before)=>print(parent,{...item,...saved,format:'label'},before));
 });
 return {busy:()=>printing,setupStatus:()=>driver?.snapshot()};
}
module.exports={barcodePrintHTML,registerBarcodePrinting};
