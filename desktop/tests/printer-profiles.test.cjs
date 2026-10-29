const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{EventEmitter}=require('node:events');
const {PrinterProfiles,labelSize}=require('../../warehouse-desktop/printer-profiles.cjs');
const {registerBarcodePrinting}=require('../../warehouse-desktop/barcode-print.cjs');
function fixture(t,options={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fastgo-printer-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const preferences=new PrinterProfiles(path.join(dir,'printers.json')),handlers={},windows=[],prints=[],parent={isDestroyed:()=>false,webContents:{mainFrame:{url:'fastgo://app/warehouse.html'}}};
 let queues=[{name:'Thermal_System_Queue',displayName:'Термопринтер кассы'},{name:'Laser_A4',displayName:'Бланки A4',isDefault:true}],result=true,reason='',release,stalled=false,reads=0;
 parent.webContents.getPrintersAsync=async()=>{reads++;return stalled?new Promise(()=>{}):queues;};
 class Window{constructor(options){this.options=options;this.webContents=new EventEmitter();this.webContents.setWindowOpenHandler=()=>{};this.webContents.print=(options,callback)=>{prints.push(options);if(release)release.callback=()=>callback(result,reason);else callback(result,reason);};windows.push(this);}async loadURL(url){this.url=url;}isDestroyed(){return !!this.destroyed;}destroy(){this.destroyed=true;}}
 const control=registerBarcodePrinting({ipcMain:{handle:(key,fn)=>handlers[key]=fn},BrowserWindow:Window,getWindow:()=>parent,preferences,listTimeout:20,...options});
 const event={sender:parent.webContents,senderFrame:parent.webContents.mainFrame},payload={name:'Камера',barcode:'FGP-001',quantity:2,format:'label',svg:'<svg><rect x="0" y="0" width="2" height="72"/></svg>'};
 return {dir,preferences,handlers,event,payload,control,windows,prints,queues:set=>queues=set,fail:()=>{result=false;reason='Print job canceled';},hold:()=>release={},stall:()=>stalled=true,reads:()=>reads};
}
test('both app sessions retain the same label printer and size without changing the A4 profile',t=>{
 const f=fixture(t);f.preferences.save({format:'a4',deviceName:'Laser_A4'});f.preferences.save({format:'label',deviceName:'Thermal_System_Queue',widthMm:40,heightMm:30});
 const restarted=new PrinterProfiles(f.preferences.file),profiles=restarted.read().profiles;assert.equal(profiles.label.deviceName,'Thermal_System_Queue');assert.equal(profiles.label.widthMm,40);assert.equal(profiles.a4.deviceName,'Laser_A4');
 assert.deepEqual(labelSize(),{widthMm:58,heightMm:30});for(const size of [{widthMm:'40'},{widthMm:29},{heightMm:201},{heightMm:NaN}])assert.throws(()=>labelSize(size));
 fs.writeFileSync(f.preferences.file,'corrupted');assert(restarted.read().warning);restarted.save({format:'label',deviceName:'Thermal_System_Queue'});assert.equal(restarted.read().profiles.label.deviceName,'Thermal_System_Queue');
});
test('saved system queue is used automatically after restart with exact paper size and no Windows dialog',async t=>{
 const f=fixture(t);f.preferences.save({format:'label',deviceName:'Thermal_System_Queue',widthMm:40,heightMm:30});
 const result=await f.handlers['warehouse:printBarcode'](f.event,f.payload);assert.equal(result.printed,true);assert.equal(f.prints[0].silent,true);assert.equal(f.prints[0].deviceName,'Thermal_System_Queue');assert.deepEqual(f.prints[0].pageSize,{width:40000,height:30000});assert.equal(f.prints[0].copies,1);assert(decodeURIComponent(f.windows[0].url).includes('size:40mm 30mm'));assert(f.windows[0].destroyed);assert.equal(f.control.busy(),false);
});
test('missing saved printer rejects without submitting to another queue or losing its saved name',async t=>{
 const f=fixture(t);f.preferences.save({format:'label',deviceName:'Thermal_System_Queue'});f.queues([{name:'Laser_A4',isDefault:true}]);await assert.rejects(()=>f.handlers['warehouse:printBarcode'](f.event,f.payload),/принтер не найден/);assert.equal(f.prints.length,0);assert.equal(f.windows.length,0);assert.equal(f.preferences.read().profiles.label.deviceName,'Thermal_System_Queue');assert.equal(f.control.busy(),false);
});
test('user can explicitly request the Windows dialog while the saved profile remains intact',async t=>{
 const f=fixture(t);f.preferences.save({format:'label',deviceName:'Thermal_System_Queue'});await f.handlers['warehouse:printBarcode'](f.event,{...f.payload,systemDialog:true,remember:true});assert.equal(f.prints[0].silent,false);assert(!('deviceName' in f.prints[0]));assert.equal(f.preferences.read().profiles.label.deviceName,'Thermal_System_Queue');
});
test('P2 uses its native dot grid and full scale without changing another printer resolution',async t=>{
 const f=fixture(t);f.queues([{name:'P2 Label Printer'}]);f.preferences.save({format:'label',deviceName:'P2 Label Printer',widthMm:50,heightMm:27});
 await f.handlers['warehouse:printBarcode'](f.event,{...f.payload,svg:'<svg viewBox="0 0 300 72"><rect x="20" y="0" width="2" height="72"/></svg>'});
 assert.deepEqual(f.prints[0].dpi,{horizontal:203,vertical:203});assert.equal(f.prints[0].scaleFactor,100);assert.equal(f.prints[0].pagesPerSheet,1);assert.equal(f.prints[0].color,false);assert.deepEqual(f.prints[0].pageSize,{width:50000,height:27000});assert.match(decodeURIComponent(f.windows[0].url),/shape-rendering:crispEdges/);
 await assert.rejects(()=>f.handlers['warehouse:printBarcode'](f.event,{...f.payload,svg:'<svg viewBox="0 0 600 72"><rect width="2" height="72"/></svg>'}),/без искажения/);
 await assert.rejects(()=>f.handlers['warehouse:printBarcode'](f.event,{...f.payload,deviceName:'P2 Label Printer',widthMm:58,svg:'<svg viewBox="0 0 380 72"><rect width="2" height="72"/></svg>'}),/без искажения/);assert.equal(f.prints.length,1);assert.equal(f.control.busy(),false);
});
test('cancelled print never changes a saved printer; active printing blocks duplicate submission and settings changes',async t=>{
 const f=fixture(t),pending=f.hold(),first=f.handlers['warehouse:printBarcode'](f.event,{...f.payload,deviceName:'Thermal_System_Queue',remember:true});await new Promise(r=>setImmediate(r));assert(f.control.busy());
 await assert.rejects(()=>f.handlers['warehouse:printBarcode'](f.event,f.payload),/Завершите/);await assert.rejects(()=>f.handlers['warehouse:printerSave'](f.event,{format:'label',deviceName:'Thermal_System_Queue'}),/завершения/);f.fail();pending.callback();await assert.rejects(()=>first,/Печать отменена/);assert.deepEqual(f.preferences.read().profiles,{});assert.equal(f.control.busy(),false);assert.equal(f.prints.length,1);
});
test('remembering only follows accepted printing, and settings can be saved before the first job',async t=>{
 const f=fixture(t);await f.handlers['warehouse:printerSave'](f.event,{format:'a4',deviceName:'Laser_A4'});await f.handlers['warehouse:printBarcode'](f.event,{...f.payload,deviceName:'Thermal_System_Queue',widthMm:40,heightMm:25,remember:true});assert.equal(f.preferences.read().profiles.label.heightMm,25);assert.equal(f.preferences.read().profiles.a4.deviceName,'Laser_A4');
 await f.handlers['warehouse:printBarcode'](f.event,{...f.payload,format:'a4'});assert.equal(f.prints[1].deviceName,'Laser_A4');assert.equal(f.prints[1].pageSize,'A4');assert.equal(f.preferences.read().profiles.label.deviceName,'Thermal_System_Queue');
});
test('receipt labels use the saved thermal queue, quantities and persistent deduplication from the service screen',async t=>{const f=fixture(t);f.preferences.save({format:'label',deviceName:'Thermal_System_Queue',widthMm:50,heightMm:27});f.event.senderFrame.url='fastgo://app/workshop.html';const job={id:'11111111-1111-4111-8111-111111111111',items:[{...f.payload,quantity:10}]};assert.equal((await f.handlers['warehouse:printReceiptLabels'](f.event,job)).printed,true);assert.equal((await f.handlers['warehouse:printReceiptLabels'](f.event,job)).alreadyPrinted,true);assert.equal(f.prints.length,1);assert.equal(f.prints[0].silent,true);assert.equal(f.prints[0].copies,1);assert.equal((decodeURIComponent(f.windows[0].url).match(/<section class="label">/g)||[]).length,10);f.queues([]);await assert.rejects(()=>f.handlers['warehouse:printReceiptLabels'](f.event,{...job,id:'22222222-2222-4222-8222-222222222222'}),/принтер не найден/);assert.equal(f.prints.length,1);});

test('typed phone label job applies its explicit paper size and remembers it only after accepted printing',async t=>{
 const f=fixture(t);f.preferences.save({format:'label',deviceName:'P2 Label Printer',widthMm:50,heightMm:27});f.queues([{name:'P2 Label Printer'},{name:'4BARCODE 3B-365B'}]);
 const job={id:'33333333-3333-4333-8333-333333333333',printer_name:'4BARCODE 3B-365B',widthMm:58,heightMm:40,remember_printer:true,items:[{...f.payload,price:1500,svg:'<svg viewBox="0 0 300 72"><rect x="20" y="0" width="2" height="72"/></svg>'}]};
 assert.equal((await f.handlers['warehouse:printReceiptLabels'](f.event,job)).printed,true);assert.deepEqual(f.prints[0].pageSize,{width:58000,height:40000});assert.equal(f.prints[0].deviceName,'4BARCODE 3B-365B');assert.match(decodeURIComponent(f.windows[0].url),/size:58mm 40mm/);
 assert.deepEqual(f.preferences.read().profiles.label,{format:'label',deviceName:'4BARCODE 3B-365B',widthMm:58,heightMm:40});assert.equal((await f.handlers['warehouse:printReceiptLabels'](f.event,job)).alreadyPrinted,true);assert.equal(f.prints.length,1);
});

test('partial or invalid explicit paper size cannot print or overwrite the saved format',async t=>{
 const f=fixture(t);f.preferences.save({format:'label',deviceName:'Thermal_System_Queue',widthMm:50,heightMm:27});const saved=f.preferences.read();
 for(const size of [{widthMm:58},{heightMm:40},{widthMm:29,heightMm:40},{widthMm:58,heightMm:201},{widthMm:'58',heightMm:40}])await assert.rejects(()=>f.handlers['warehouse:printReceiptLabels'](f.event,{id:'44444444-4444-4444-8444-444444444444',items:[f.payload],remember_printer:true,...size}));
 assert.equal(f.prints.length,0);assert.deepEqual(f.preferences.read(),saved);
});
test('printer IPC rejects unrelated windows and subframes before listing, configuring or printing',async t=>{
 const f=fixture(t),iframe={...f.event,senderFrame:{url:'fastgo://app/warehouse.html'}},other={sender:{},senderFrame:{}};
 for(const event of [iframe,other])for(const name of ['warehouse:printers','warehouse:printerSave','warehouse:printBarcode'])await assert.rejects(()=>f.handlers[name](event,f.payload),/Недоступно/);
 await assert.rejects(()=>f.handlers['warehouse:printerSave'](f.event,{format:'label',deviceName:'Forged'}),/принтер не найден/);assert.equal(f.prints.length,0);assert.deepEqual(f.preferences.read().profiles,{});
});
test('a stalled Windows printer service returns a bounded error and retains the chosen queue without repeated background reads',async t=>{
 const f=fixture(t);f.preferences.save({format:'label',deviceName:'Thermal_System_Queue'});f.stall();
 const first=await f.handlers['warehouse:printers'](f.event),second=await f.handlers['warehouse:printers'](f.event);assert.deepEqual(first.printers,[]);assert.match(first.warning,/Служба печати/);assert.equal(second.profiles.label.deviceName,'Thermal_System_Queue');assert.equal(f.reads(),1);
 await assert.rejects(()=>f.handlers['warehouse:printBarcode'](f.event,f.payload),/не ответила вовремя/);assert.equal(f.prints.length,0);assert.equal(f.control.busy(),false);
});

test('PC365 restores media before a label is submitted and refuses printing when recovery fails',async t=>{
 let fail=true,calls=0;const f=fixture(t,{media:{restore:async p=>{assert.equal(p.deviceName,'4BARCODE 3B-365B');assert.equal(p.heightMm,27);calls++;if(fail)throw Error('Очередь занята');}}});
 f.queues([{name:'4BARCODE 3B-365B'}]);f.preferences.save({format:'label',deviceName:'4BARCODE 3B-365B',widthMm:58,heightMm:27});
 const payload={...f.payload,svg:'<svg viewBox="0 0 300 72"><rect x="20" y="0" width="2" height="72"/></svg>'};
 await assert.rejects(()=>f.handlers['warehouse:printBarcode'](f.event,payload),/Очередь занята/);assert.equal(f.prints.length,0);assert.equal(f.control.busy(),false);
 fail=false;await f.handlers['warehouse:printBarcode'](f.event,payload);assert.equal(f.prints.length,1);assert.equal(calls,2);
 await assert.rejects(()=>f.handlers['warehouse:printBarcode'](f.event,{...payload,svg:'<svg viewBox="0 0 600 72"><rect x="20" y="0" width="2" height="72"/></svg>'}),/без искажения/);assert.equal(calls,2,'invalid raster cannot feed the printer');
 await f.handlers['warehouse:printerSetup'](f.event,{model:'pc365',calibrate:true});assert.equal(calls,3);assert.equal(f.prints.length,1,'manual media recovery never duplicates a product label');
 await assert.rejects(()=>f.handlers['warehouse:printerSetup']({...f.event,senderFrame:{url:f.event.senderFrame.url}},{model:'pc365',calibrate:true}),/Недоступно/);
});

test('packaged PC365 sends one raster and thirty hardware copies without Windows pagination',async t=>{
 const calls=[];const f=fixture(t,{media:{restore:async()=>assert.fail('native batch calibrates in its own command stream')},rasterPrinter:{enabled:true,print:async p=>{calls.push(p);p.beforeSubmit();return {printed:true,deviceName:p.deviceName,transport:'tspl-gap'};}}});
 f.queues([{name:'4BARCODE 3B-365B'}]);f.preferences.save({format:'label',deviceName:'4BARCODE 3B-365B',widthMm:58,heightMm:27});
 const payload={...f.payload,quantity:30,sku:'FGP-037',svg:'<svg viewBox="0 0 300 72"><rect x="20" y="0" width="2" height="72"/></svg>'};
 const result=await f.handlers['warehouse:printBarcode'](f.event,payload);assert.equal(result.transport,'tspl-gap');assert.equal(calls.length,1);assert.equal(calls[0].quantity,30);assert.equal((calls[0].html.match(/<section class="label">/g)||[]).length,1);assert.equal(f.prints.length,0);assert.equal(f.windows.length,0);assert.equal(f.control.busy(),false);
});
