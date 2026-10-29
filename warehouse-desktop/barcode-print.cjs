const path=require('node:path'),{PrinterProfiles,labelSize,profile,printerList,availablePrinter}=require('./printer-profiles.cjs');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let code128;
function widerCode128(svg,value,maxDots){
 try{
  if(!code128){
   const fs=require('node:fs'),asset=['web/vendor/','../web/vendor/','../vendor/'].map(dir=>path.join(__dirname,dir,'jsbarcode-3.12.3.min.js')).find(file=>fs.existsSync(file));
   if(!asset)return svg;
   const scope={window:{}};require('node:vm').runInNewContext(fs.readFileSync(asset,'utf8'),scope,{timeout:1000});code128=scope.window.JsBarcode;
  }
  const encoded={};code128(encoded,value,{format:'CODE128B',displayValue:false,width:2,height:72,margin:0,marginLeft:20,marginRight:20});
  const bits=encoded.encodings?.map(x=>x.data).join(''),width=bits?.length*2+40,previous=Number(svg.match(/\bviewBox="0 0 (\d+)/)?.[1]);
  if(!bits||!/^[01]+$/.test(bits)||!Number.isInteger(previous)||width<=previous||width>maxDots)return svg;
  const bars=[...bits.matchAll(/1+/g)].map(m=>'<rect x="'+m.index*2+'" y="0" width="'+m[0].length*2+'" height="72"/>').join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="72" viewBox="0 0 '+width+' 72"><g transform="translate(20,0)" fill="#000000">'+bars+'</g></svg>';
 }catch{return svg;}
}
function barcodePrintHTML(p){
 if(!p||typeof p.name!=='string'||p.name.length>200||typeof p.barcode!=='string'||p.barcode.length>100||!Number.isInteger(p.quantity)||p.quantity<1||p.quantity>1000||!['a4','label'].includes(p.format))throw Error('Проверьте количество и формат этикеток');
 if(p.price!==undefined&&(typeof p.price!=='number'||!Number.isFinite(p.price)||p.price<0||p.price>100000000))throw Error('Проверьте цену товара');
 for(const [key,max]of [['model',120],['sku',100]])if(p[key]!==undefined&&p[key]!==null&&(typeof p[key]!=='string'||p[key].length>max))throw Error('Проверьте размер и артикул');
 const details=[p.model?'Размер: '+p.model:'',p.sku?'Арт. '+p.sku:''].filter(Boolean).join(' · ');
 const price=p.price===undefined?'':p.price.toLocaleString('ru-RU',{maximumFractionDigits:2})+' ₽';
 let svg=p.svg;
 if(typeof svg!=='string'||svg.length>100000||!/^<svg\b[\s\S]*<\/svg>$/.test(svg)||/<\/?(?!svg\b|g\b|rect\b|text\b)[a-z]/i.test(svg)||/\bon[a-z]+\s*=|href\s*=|url\s*\(|<\?|<!|javascript:|data:|https?:/i.test(svg.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g,'')))throw Error('Некорректный штрихкод');
 const a4=p.format==='a4',size=a4?{widthMm:58,heightMm:30}:labelSize(p),width=size.widthMm,height=size.heightMm,barHeight=Math.min(15,height-15),p2=!a4&&require('./label-printer-setup.cjs').isP2({name:p.deviceName||''});
 let thermalCSS='';
 const pc365=!a4&&require('./pc365-setup.cjs').isPC365({name:p.deviceName||''}),thermal203=p2||pc365;
 if(thermal203){
  // A narrow roll can sit inside the 48 mm P2 head. Keep both text lines in
  // its central 32 mm, and preserve whole-dot barcode widths at 203 dpi.
  const large=pc365&&height>=26,paperDots=Math.min(p2?384:576,Math.floor(width*203/25.4)),maxDots=paperDots-(large?24:32),mm=n=>(n*25.4/203).toFixed(5)+'mm';
  // A wider legal Code128 B encoding uses the available PC365 label width
  // without stretching two-dot modules. Longer codes retain automatic encoding.
  if(large)svg=widerCode128(svg,p.barcode,maxDots);
  const box=svg.match(/\bviewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/),dots=box?.slice(1).map(Number);
  if(!dots||!dots.every(n=>Number.isInteger(n)&&n>0)||dots[0]>maxDots||dots[1]!==72)throw Error('Штрихкод не помещается без искажения. Выберите более широкую этикетку.');
  // Fit height independently: SVG's default `meet` would also shrink bar
  // widths to fractional dots when making room for the separate price line.
  svg=svg.replace(/\s+preserveAspectRatio="[^"]*"/g,'').replace(/^<svg\b/,'<svg preserveAspectRatio="none"');
  const textWidth=Math.min(256,paperDots-64),textLeft=Math.floor((paperDots-textWidth)/2),barTop=price?58:46,barHeight=price?64:72,codeTop=price?126:122;
  thermalCSS='.label{position:relative;padding:0;display:block}.label strong,.label small,.label .price{position:absolute;left:'+mm(textLeft)+';width:'+mm(textWidth)+';overflow:hidden;white-space:nowrap;text-align:center}.label strong{top:'+mm(price?8:16)+';height:'+mm(price?22:26)+';max-height:none;font-size:'+(price?'7.5':'8')+'pt;line-height:'+mm(price?22:26)+';text-overflow:ellipsis}.label svg{position:absolute;left:'+mm(Math.floor((paperDots-dots[0])/2))+';top:'+mm(barTop)+';width:'+mm(dots[0])+';height:'+mm(barHeight)+';shape-rendering:crispEdges}.label small{top:'+mm(codeTop)+';height:'+mm(20)+';font-size:7pt;line-height:'+mm(20)+'}.label .price{right:auto;top:'+mm(32)+';height:'+mm(22)+';line-height:'+mm(22)+';font-size:7.5pt}';
  if(large){
   // A stacked title/price left the code only 2.7 mm from a 27 mm cut edge.
   // Share the heading row, then centre the whole block inside equal safe bands.
   // Only bar height changes; the encoded X modules and quiet zones stay intact.
   const paperHeightDots=Math.floor(height*203/25.4),heading=34,gap=8,caption=28;
   const bars=Math.min(128,Math.max(64,paperHeightDots-64-heading-caption-gap*2));
   const block=heading+gap+bars+gap+caption,top=Math.floor((paperHeightDots-block)/2),barY=top+heading+gap,codeY=barY+bars+gap;
   thermalCSS+='.label-heading{position:absolute;left:'+mm(24)+';top:'+mm(top)+';width:'+mm(paperDots-48)+';height:'+mm(heading)+';gap:'+mm(8)+';align-items:center}.label-heading strong,.label-heading .price{position:static;left:auto;top:auto;width:auto;height:'+mm(heading)+';line-height:'+mm(heading)+';max-height:none}.label-heading strong{flex:1;min-width:0;font-size:10pt;text-align:'+(price?'left':'center')+';text-overflow:ellipsis}.label-heading .price{flex:0 0 auto;font-size:'+(paperDots<320?9:11)+'pt;overflow:visible;text-align:right}.label svg{top:'+mm(barY)+';height:'+mm(bars)+'}.label small{left:'+mm(24)+';width:'+mm(paperDots-48)+';top:'+mm(codeY)+';height:'+mm(caption)+';line-height:'+mm(caption)+';font-size:9pt}';
  }
 }else if(!a4){
  thermalCSS='.label{justify-content:flex-start;padding:2mm;gap:.5mm}.label strong{width:100%;max-height:none;height:3.3mm;flex:0 0 3.3mm;font-size:8pt;line-height:3.3mm;white-space:nowrap;text-overflow:ellipsis}.label svg{height:9mm;shape-rendering:crispEdges}.label small{height:3mm;flex:0 0 3mm;line-height:3mm;white-space:nowrap}';
 }
 if(details&&thermal203){const mm=n=>(n*25.4/203).toFixed(5)+'mm',paper=Math.floor(height*203/25.4),heading=28,meta=p.model&&p.sku?36:20,caption=20,gap=6,safe=pc365&&height>=26?64:16,bars=Math.min(128,Math.max(48,paper-safe-heading-meta-caption-gap*2)),top=Math.floor((paper-heading-meta-caption-gap*2-bars)/2),left=Math.max(8,Math.floor((Math.min(p2?384:576,Math.floor(width*203/25.4))-Math.min(384,Math.floor(width*203/25.4)-32))/2)),tw=Math.min(384,Math.floor(width*203/25.4)-32);thermalCSS+='.label-heading{position:absolute;left:'+mm(left)+';top:'+mm(top)+';width:'+mm(tw)+';height:'+mm(heading)+';display:flex;gap:'+mm(6)+'}.label-heading strong,.label-heading .price{position:static;left:auto;top:auto;width:auto;height:'+mm(heading)+';line-height:'+mm(heading)+';font-size:7.5pt}.label-heading strong{flex:1;min-width:0;text-align:left}.label-heading .price{flex:0 0 auto}.label-details{position:absolute;left:'+mm(left)+';width:'+mm(tw)+';top:'+mm(top+heading)+';height:'+mm(meta)+';line-height:'+mm(18)+';font-size:6.5pt;white-space:normal;overflow:hidden}.label svg{top:'+mm(top+heading+meta+gap)+';height:'+mm(bars)+'}.label small{left:'+mm(left)+';width:'+mm(tw)+';top:'+mm(top+heading+meta+gap+bars+gap)+';height:'+mm(caption)+';line-height:'+mm(caption)+';font-size:7pt}';}
 const label='<section class="label"><div class="label-heading"><strong>'+escape(p.name)+'</strong>'+(price?'<b class="price">'+escape(price)+'</b>':'')+'</div>'+(details?'<div class="label-details">'+(p.model?'<span>'+escape('Размер: '+p.model)+'</span>':'')+(p.sku?'<span>'+escape('Арт. '+p.sku)+'</span>':'')+'</div>':'')+svg+'<small>'+escape(p.barcode)+'</small></section>';
 return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><title>Этикетки FastGo</title><style>@page{size:'+(a4?'A4;margin:10mm':width+'mm '+height+'mm;margin:0')+'}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#000;background:#fff;'+(a4?'display:grid;grid-template-columns:repeat(3,58mm);grid-auto-rows:30mm;gap:2mm;':'')+'}.label{width:'+width+'mm;height:'+height+'mm;padding:2mm;display:flex;flex-direction:column;justify-content:center;align-items:center;overflow:hidden;break-inside:avoid;'+(a4?'':'break-after:page;')+'}.label:last-child{break-after:auto}.label-heading{display:flex;align-items:center;justify-content:space-between;gap:1mm;width:100%}.label-heading strong{min-width:0;flex:1;text-align:left}.price{font-size:8pt;font-weight:bold;white-space:nowrap}strong{font-size:9pt;line-height:1.1;max-height:8mm;overflow:hidden;text-align:center}small{font-size:7pt}.label-details span{display:block}.label-details{font-size:7pt;line-height:1.1;width:100%;text-align:center;overflow-wrap:anywhere}svg{width:'+(width-4)+'mm;height:'+barHeight+'mm;flex-shrink:0}'+thermalCSS+'</style></head><body>'+label.repeat(p.quantity)+'</body></html>';
}
function registerBarcodePrinting({app,ipcMain,BrowserWindow,getWindow,preferences,listTimeout=10000,setup,receiptJournal,media,rasterPrinter}){
 const settings=preferences||new PrinterProfiles(path.join(app.getPath('appData'),'FastGo','printer-profiles.json'));
 const paper=media||new (require('./pc365-media.cjs').PC365Media)({dir:path.join(path.dirname(settings.file),'printer-setup','pc365'),enabled:!!app?.isPackaged});
 const raster=rasterPrinter||new (require('./pc365-raster.cjs').PC365Raster)({dir:path.join(path.dirname(settings.file),'printer-setup','pc365'),BrowserWindow,enabled:!!app?.isPackaged});
 const {LabelPrinterSetup,isP2}=require('./label-printer-setup.cjs');
 const driver=setup||(app?new LabelPrinterSetup({dir:path.join(app.getPath('appData'),'FastGo','printer-setup','p2'),enabled:app.isPackaged,station:async()=>{
  const window=getWindow();if(!window||window.isDestroyed()||!window.webContents.getURL().startsWith('fastgo://app/warehouse.html'))return '';
  return window.webContents.executeJavaScript('(async()=>{if(window.fastgoDesktop)return (await window.fastgoDesktop.warehouseStation())?.id||"";const s=JSON.parse(localStorage.getItem("fastgo_warehouse_session_v1")||"null");return s?.user_id?JSON.parse(localStorage.getItem("fgwarehouse:"+s.user_id+":station")||"null")?.id||"":"";})()');
 }}):null);
 const pc365=app?new (require('./pc365-setup.cjs').PC365Setup)({dir:path.join(app.getPath('appData'),'FastGo','printer-setup','pc365'),enabled:app.isPackaged,station:driver?.station}):null;
 let printing=false,readingPrinters;
 const receipts=receiptJournal||new (require('./receipt-label-journal.cjs').ReceiptLabelJournal)(path.join(path.dirname(settings.file),'receipt-labels'));
 async function systemPrinters(parent){
  if(!readingPrinters)readingPrinters=Promise.resolve().then(()=>parent.webContents.getPrintersAsync()).finally(()=>{readingPrinters=null;});
  let timer;try{return await Promise.race([readingPrinters,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Служба печати Windows не ответила вовремя. Проверьте подключение принтера и обновите список.')),listTimeout);})]);}finally{clearTimeout(timer);}
 }
 function trusted(event){const parent=getWindow();if(!parent||parent.isDestroyed()||event.sender!==parent.webContents||event.senderFrame!==parent.webContents.mainFrame||!require('./warehouse-bridge.cjs').allowedWarehouseURL(event.senderFrame?.url))throw Error('Недоступно');return parent;}
 function rememberP2(printers){const p=printers.find(isP2);if(p&&!settings.read().profiles.label)settings.save({format:'label',deviceName:p.name,widthMm:50,heightMm:30});}
 function pc365Status(){const state=pc365?.snapshot();if(!state)return state;const m=paper.snapshot?.(),w=m?.windows_media;if(!w)return state;const dimensions=w.widthMm&&w.heightMm?w.widthMm+'×'+w.heightMm+' мм':String(w.paper||'не указан'),q=m.queue;return {...state,message:(['tspl-gap','driver-gap'].includes(m.mode)?'Автовыравнивание каждой серии; аппаратный шаг этикеток. ':'')+'Размер задания '+m.widthMm+'×'+m.heightMm+' мм. Windows по умолчанию: '+dimensions+'; тип '+String(w.sensor||'неизвестен')+'.'+(q?' Очередь: '+String(q.status||'неизвестно')+'; порт '+String(q.port||'не указан')+'; заданий '+(q.jobs?.length||0)+'.':'')};}
 ipcMain.handle('warehouse:printers',async event=>{const parent=trusted(event);try{const printers=printerList(await systemPrinters(parent));rememberP2(printers);void driver?.ensure({printers}).catch(()=>{});void pc365?.ensure({printers}).catch(()=>{});return {printers,...settings.read(),setup:driver?.snapshot(),pc365:pc365Status()};}catch{return {printers:[],...settings.read(),setup:driver?.snapshot(),warning:'Служба печати Windows не ответила вовремя. Проверьте подключение принтера и обновите список.'};}});
 ipcMain.handle('warehouse:printerSetup',async(event,p)=>{const parent=trusted(event);if(printing)throw Error('Дождитесь завершения печати');const printers=await systemPrinters(parent);if(p?.calibrate===true){if(p.model!=='pc365')throw Error('Выравнивание доступно только для PC-365');const saved=settings.read().profiles.label,deviceName=p.deviceName??saved?.deviceName;if(!require('./pc365-setup.cjs').isPC365({name:deviceName}))throw Error('Выберите POScenter PC-365');availablePrinter(printers,deviceName);printing=true;try{return await paper.restore({deviceName,...labelSize({widthMm:p.widthMm??saved?.widthMm,heightMm:p.heightMm??saved?.heightMm}),force:true});}finally{printing=false;}}const installer=p?.model==='pc365'?pc365:driver;if(!installer)throw Error('Установка доступна в программе Windows');void installer.ensure({printers,manual:true}).catch(()=>{});return {started:true};});
 ipcMain.handle('warehouse:printerSave',async(event,p)=>{const parent=trusted(event);if(printing)throw Error('Дождитесь завершения печати');if(p?.clear)return settings.clear(p.format);const next=profile(p);availablePrinter(await systemPrinters(parent),next.deviceName);return settings.save(next);});
 async function print(parent,p,beforeSubmit=()=>{}){
  if(printing)throw Error('Завершите открытую печать');barcodePrintHTML(p);printing=true;let child;
  try{
   const saved=settings.read(),previous=saved.profiles[p.format],deviceName=p.systemDialog===true?'':p.deviceName??previous?.deviceName??'';
   if(p.deviceName!==undefined&&typeof p.deviceName!=='string')throw Error('Выберите установленный принтер');
   if(deviceName){profile({...p,deviceName});availablePrinter(await systemPrinters(parent),deviceName);}
   const size=p.format==='label'?labelSize({widthMm:p.widthMm??previous?.widthMm,heightMm:p.heightMm??previous?.heightMm}):null;
   let result={printed:true,deviceName};
   if(size&&require('./pc365-setup.cjs').isPC365({name:deviceName})&&raster.enabled){
    const html=barcodePrintHTML({...p,...size,deviceName,quantity:1});
    result=await raster.print({parent,html,deviceName,...size,quantity:p.quantity,beforeSubmit});
   }else{
    const html=barcodePrintHTML({...p,...size,deviceName});child=new BrowserWindow({show:false,parent,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,javascript:false}});child.webContents.on('will-navigate',e=>e.preventDefault());child.webContents.setWindowOpenHandler(()=>({action:'deny'}));await child.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));
    if(size&&require('./pc365-setup.cjs').isPC365({name:deviceName}))await paper.restore({deviceName,...size});
    beforeSubmit();await new Promise((resolve,reject)=>child.webContents.print({silent:!!deviceName,...(deviceName?{deviceName}:{}),printBackground:true,copies:1,scaleFactor:100,pagesPerSheet:1,landscape:false,duplexMode:'simplex',...(p.format==='label'&&(isP2({name:deviceName})||require('./pc365-setup.cjs').isPC365({name:deviceName}))?{color:false,dpi:{horizontal:203,vertical:203}}:{}),margins:{marginType:'none'},pageSize:p.format==='a4'?'A4':{width:Math.round(size.widthMm*1000),height:Math.round(size.heightMm*1000)}},(ok,reason)=>ok?resolve():reject(Object.assign(Error(/cancel/i.test(reason)?'Печать отменена':reason||'Принтер не принял задание'),{notSubmitted:true}))));
   }
   let warning='';if(p.remember===true&&deviceName){try{settings.save({format:p.format,deviceName,...size});}catch{warning='Задание передано принтеру, но выбор принтера не удалось сохранить. Сохраните его в настройках.';}}
   return {...result,warning};
  }finally{if(child&&!child.isDestroyed())child.destroy();printing=false;}
 }
 ipcMain.handle('warehouse:printBarcode',async(event,p)=>print(trusted(event),p));
 ipcMain.handle('warehouse:printReceiptLabels',async(event,p)=>{
  const parent=getWindow(),frame=event.senderFrame;
  let service=false;try{const u=new URL(frame?.url);service=u.protocol==='fastgo:'&&u.hostname==='app'&&u.pathname==='/workshop.html';}catch{}
  if(!parent||parent.isDestroyed()||event.sender!==parent.webContents||frame!==parent.webContents.mainFrame||!service&&!require('./warehouse-bridge.cjs').allowedWarehouseURL(frame?.url))throw Error('Недоступно');
  if(!p?.items||!Array.isArray(p.items))throw Error('Неверное задание печати');
  if((p.widthMm!==undefined)!==(p.heightMm!==undefined))throw Error('Укажите ширину и высоту этикетки вместе');
  const requestedSize=p.widthMm!==undefined?labelSize({widthMm:p.widthMm,heightMm:p.heightMm}):null;
  const printers=printerList(await systemPrinters(parent));rememberP2(printers);
  let saved=settings.read().profiles.label;if(p.printer_name!==undefined){if(typeof p.printer_name!=='string')throw Error('Выберите принтер');saved=profile({...saved,format:'label',deviceName:p.printer_name});}if(!saved?.deviceName)throw Error('Подключите термопринтер и выберите его в настройках печати');
  if(requestedSize)saved=profile({...saved,...requestedSize});
  availablePrinter(printers,saved.deviceName);
  for(const item of p.items)barcodePrintHTML({...item,...saved,format:'label'});
  return receipts.run(p,(item,before)=>print(parent,{...item,...saved,format:'label',remember:p.remember_printer===true},before));
 });
 return {busy:()=>printing,setupStatus:()=>driver?.snapshot()};
}
module.exports={barcodePrintHTML,registerBarcodePrinting};
