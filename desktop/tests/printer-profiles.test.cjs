const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{EventEmitter}=require('node:events');
const {PrinterProfiles,labelSize}=require('../../warehouse-desktop/printer-profiles.cjs');
const {registerBarcodePrinting}=require('../../warehouse-desktop/barcode-print.cjs');
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fastgo-printer-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const preferences=new PrinterProfiles(path.join(dir,'printers.json')),handlers={},windows=[],prints=[],parent={isDestroyed:()=>false,webContents:{mainFrame:{url:'fastgo://app/warehouse.html'}}};
 let queues=[{name:'Thermal_System_Queue',displayName:'Термопринтер кассы'},{name:'Laser_A4',displayName:'Бланки A4',isDefault:true}],result=true,reason='',release,stalled=false,reads=0;
 parent.webContents.getPrintersAsync=async()=>{reads++;return stalled?new Promise(()=>{}):queues;};
 class Window{constructor(options){this.options=options;this.webContents=new EventEmitter();this.webContents.setWindowOpenHandler=()=>{};this.webContents.print=(options,callback)=>{prints.push(options);if(release)release.callback=()=>callback(result,reason);else callback(result,reason);};windows.push(this);}async loadURL(url){this.url=url;}isDestroyed(){return !!this.destroyed;}destroy(){this.destroyed=true;}}
 const control=registerBarcodePrinting({ipcMain:{handle:(key,fn)=>handlers[key]=fn},BrowserWindow:Window,getWindow:()=>parent,preferences,listTimeout:20});
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
test('cancelled print never changes a saved printer; active printing blocks duplicate submission and settings changes',async t=>{
 const f=fixture(t),pending=f.hold(),first=f.handlers['warehouse:printBarcode'](f.event,{...f.payload,deviceName:'Thermal_System_Queue',remember:true});await new Promise(r=>setImmediate(r));assert(f.control.busy());
 await assert.rejects(()=>f.handlers['warehouse:printBarcode'](f.event,f.payload),/Завершите/);await assert.rejects(()=>f.handlers['warehouse:printerSave'](f.event,{format:'label',deviceName:'Thermal_System_Queue'}),/завершения/);f.fail();pending.callback();await assert.rejects(()=>first,/Печать отменена/);assert.deepEqual(f.preferences.read().profiles,{});assert.equal(f.control.busy(),false);assert.equal(f.prints.length,1);
});
test('remembering only follows accepted printing, and settings can be saved before the first job',async t=>{
 const f=fixture(t);await f.handlers['warehouse:printerSave'](f.event,{format:'a4',deviceName:'Laser_A4'});await f.handlers['warehouse:printBarcode'](f.event,{...f.payload,deviceName:'Thermal_System_Queue',widthMm:40,heightMm:25,remember:true});assert.equal(f.preferences.read().profiles.label.heightMm,25);assert.equal(f.preferences.read().profiles.a4.deviceName,'Laser_A4');
 await f.handlers['warehouse:printBarcode'](f.event,{...f.payload,format:'a4'});assert.equal(f.prints[1].deviceName,'Laser_A4');assert.equal(f.prints[1].pageSize,'A4');assert.equal(f.preferences.read().profiles.label.deviceName,'Thermal_System_Queue');
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
