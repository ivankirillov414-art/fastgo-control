const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('native print polling advertises act support and preserves document purpose until dispatch',async()=>{
 const calls=[],context=vm.createContext({require:name=>name==='electron'?electron:['./store.cjs','./sync.cjs','./warehouse-station.cjs','./warehouse-runtime.cjs'].includes(name)?{}:name==='./updates.cjs'?require('../updates.cjs'):require(name),__dirname:path.resolve(__dirname,'..'),setTimeout,clearTimeout});
 const electron={app:{setName(){},getVersion:()=> '1.0.70',requestSingleInstanceLock:()=>true,whenReady:()=>({then(){}}),on(){}},protocol:{registerSchemesAsPrivileged(){}},BrowserWindow:class{
  constructor(){this.webContents={id:51,print:(options,done)=>{calls.push(['print',options]);done(true);}};}
  async loadURL(){const entry=vm.runInContext('printWindows.get(51)',context);calls.push(['context',entry.context]);entry.resolve();}
  destroy(){}
 }};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../main.cjs'),'utf8'),context);
 context.fixtureCalls=calls;context.printRows=new Map();
 context.fakeRemote=async(action,p)=>{calls.push([action,p]);return action==='claim'?{job:{id:'paid-job',kind:'repair',record_id:'paid-repair',document_type:'completion'}}:{};};
 vm.runInContext(`actor='owner';win={isDestroyed:()=>true};store={setting:k=>({printer:'A4 Service',station_id:'station',claim_token:'claim',remote_print:true})[k],cache:()=>({role:'owner'}),printState:(actor,key,state)=>printRows.set(key,{state}),printExists:(actor,key)=>printRows.get(key),stats:()=>({})};cloud=async(path,body)=>({data:await fakeRemote(body.action,body.params)});`,context);
 await vm.runInContext('pollPrint()',context);
 const claim=calls.find(x=>x[0]==='claim')[1];assert.deepEqual(Array.from(claim.document_types),['master','completion']);assert.equal(claim.client_version,'1.0.70');assert.equal(claim.printer_name,'A4 Service');
 assert.equal(calls.find(x=>x[0]==='context')[1].document_type,'completion');
 assert.deepEqual(calls.filter(x=>['dispatch','print','complete'].includes(x[0])).map(x=>x[0]),['dispatch','print','complete']);
 const print=calls.find(x=>x[0]==='print')[1];assert.equal(print.silent,true);assert.equal(print.copies,1);assert.equal(print.pageSize,'A4');assert.equal(print.deviceName,'A4 Service');
 assert.equal(context.printRows.get('paid-job').state,'submitted');
});
