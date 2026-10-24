const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{EventEmitter}=require('node:events');
const {registerNetworkDiagnostics}=require('../network-window.cjs');
test('only the warehouse can open diagnostics and only its own main frame can probe or export',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fg-net-window-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const handlers={},parent={isDestroyed:()=>false,webContents:{mainFrame:{url:'fastgo://app/warehouse.html'}}},app=new EventEmitter();app.getPath=()=>dir;app.getVersion=()=>'1.0.19';
 let child,probes=0,dialogs=0,releaseSave,selection={canceled:true};
 class Window extends EventEmitter{
  constructor(options){super();child=this;this.options=options;this.webContents=new EventEmitter();this.webContents.mainFrame={};this.webContents.setWindowOpenHandler=fn=>this.openHandler=fn;}
  loadURL(url){this.webContents.mainFrame.url=url;}isDestroyed(){return false;}show(){}focus(){}destroy(){this.emit('closed');}
 }
 const engine={observe:()=>({online:true,history:[]}),summary:()=>({online:true}),probe:async()=>{probes++;return {online:true};}};
 const control=registerNetworkDiagnostics({app,ipcMain:{handle:(name,fn)=>handlers[name]=fn},BrowserWindow:Window,dialog:{showSaveDialog:async()=>{dialogs++;if(releaseSave)await releaseSave;return selection;}},getWindow:()=>parent,getUpdate:()=>({}),engine});
 t.after(()=>control.close());const event=owner=>({sender:owner.webContents,senderFrame:owner.webContents.mainFrame});
 assert.throws(()=>handlers['warehouse-network:open']({sender:{},senderFrame:{}}));
 handlers['warehouse-network:open'](event(parent));assert.equal(child.options.webPreferences.sandbox,true);assert.equal(child.options.webPreferences.nodeIntegration,false);assert.equal(child.options.titleBarOverlay.color,'#091827');assert.deepEqual(child.openHandler({url:'https://example.invalid'}),{action:'deny'});
 assert.throws(()=>handlers['warehouse-network:probe'](event(parent)));assert.throws(()=>handlers['warehouse-network:status']({...event(child),senderFrame:{url:child.webContents.mainFrame.url}}));
 await assert.rejects(()=>handlers['warehouse-network:save'](event(parent)));assert.equal(dialogs,0);
 assert.equal((await handlers['warehouse-network:probe'](event(child))).online,true);assert.equal(probes,1);
 assert.deepEqual(await handlers['warehouse-network:save'](event(child)),{saved:false});assert.equal(fs.readdirSync(dir).length,0);
 selection={canceled:false,filePath:path.join(dir,'chosen-report.json')};let release;releaseSave=new Promise(r=>release=r);
 const saving=handlers['warehouse-network:save'](event(child));assert.deepEqual(await handlers['warehouse-network:save'](event(child)),{saved:false});release();assert.deepEqual(await saving,{saved:true});
 const report=JSON.parse(fs.readFileSync(selection.filePath,'utf8'));assert.equal(report.version,'1.0.19');assert.equal(report.network.online,true);assert.deepEqual(fs.readdirSync(dir),['chosen-report.json']);
 child.webContents.mainFrame.url='https://example.invalid';assert.throws(()=>handlers['warehouse-network:status'](event(child)));
});
