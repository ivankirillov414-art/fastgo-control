const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function barcodePrintHTML(p){
 if(!p||typeof p.name!=='string'||p.name.length>200||typeof p.barcode!=='string'||p.barcode.length>100||!Number.isInteger(p.quantity)||p.quantity<1||p.quantity>1000||!['a4','label'].includes(p.format))throw Error('Проверьте количество и формат этикеток');
 const svg=p.svg;
 if(typeof svg!=='string'||svg.length>100000||!/^<svg\b[\s\S]*<\/svg>$/.test(svg)||/<\/?(?!svg\b|g\b|rect\b|text\b)[a-z]/i.test(svg)||/\bon[a-z]+\s*=|href\s*=|url\s*\(|<\?|<!|javascript:|data:|https?:/i.test(svg.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g,'')))throw Error('Некорректный штрихкод');
 const a4=p.format==='a4',label='<section class="label"><strong>'+escape(p.name)+'</strong>'+svg+'<small>'+escape(p.barcode)+'</small></section>';
 return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><title>Этикетки FastGo</title><style>@page{size:'+(a4?'A4;margin:10mm':'58mm 30mm;margin:0')+'}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#000;background:#fff;'+(a4?'display:grid;grid-template-columns:repeat(3,58mm);grid-auto-rows:30mm;gap:2mm;':'')+'}.label{width:58mm;height:30mm;padding:2mm;display:flex;flex-direction:column;justify-content:center;align-items:center;overflow:hidden;break-inside:avoid;'+(a4?'':'break-after:page;')+'}.label:last-child{break-after:auto}strong{font-size:9pt;line-height:1.1;max-height:8mm;overflow:hidden;text-align:center}small{font-size:7pt}svg{width:54mm;height:15mm;flex-shrink:0}</style></head><body>'+label.repeat(p.quantity)+'</body></html>';
}
function registerBarcodePrinting({ipcMain,BrowserWindow,getWindow}){
 let printing=false;
 ipcMain.handle('warehouse:printBarcode',async(event,p)=>{
  const parent=getWindow();if(!parent||parent.isDestroyed()||event.sender!==parent.webContents||event.senderFrame!==parent.webContents.mainFrame||!require('./warehouse-bridge.cjs').allowedWarehouseURL(event.senderFrame.url))throw Error('Недоступно');
  if(printing)throw Error('Завершите открытую печать');const html=barcodePrintHTML(p);printing=true;let child;
  try{child=new BrowserWindow({show:false,parent,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,javascript:false}});child.webContents.on('will-navigate',e=>e.preventDefault());child.webContents.setWindowOpenHandler(()=>({action:'deny'}));await child.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));
   await new Promise((resolve,reject)=>child.webContents.print({silent:false,printBackground:true,copies:1,margins:{marginType:'none'},pageSize:p.format==='a4'?'A4':{width:58000,height:30000}},(ok,reason)=>ok?resolve():reject(Error(/cancel/i.test(reason)?'Печать отменена':reason||'Принтер не принял задание'))));return true;
  }finally{if(child&&!child.isDestroyed())child.destroy();printing=false;}
 });
}
module.exports={barcodePrintHTML,registerBarcodePrinting};
