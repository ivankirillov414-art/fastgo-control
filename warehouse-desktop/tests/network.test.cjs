const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {NetworkDiagnostics,windowsSnapshot,conclusions}=require('../network-diagnostics.cjs');
const installer='https://github.com/ivankirillov414-art/fastgo-control/releases/download/fastgo-warehouse-v1.0.18/FastGo-Warehouse-Setup-1.0.18-Windows-x64.exe';
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fg-net-'));t.after(()=>{assert(path.resolve(dir).startsWith(path.join(os.tmpdir(),'fg-net-')));fs.rmSync(dir,{recursive:true,force:true});});
 let clock=Date.parse('2026-10-24T11:30:00Z'),online=true,download={status:'downloading',version:'1.0.19',transferred:10,total:100,bytesPerSecond:512},fileStatus=200,badFeed=false,dnsBad=false,localCalls=0,hold;
 const calls=[],local={adapters:[{name:'Wi-Fi',status:'Up',ipv4:['192.0.2.3'],gateways:['192.0.2.1'],dns:['192.0.2.53'],wireless:true}],wifi:[{ssid:'Private Wi-Fi',signal_percent:28,receive_mbps:72,transmit_mbps:72}],events:[{id:8003,record_id:1,at:new Date(clock-20000).toISOString(),reason:'user disconnect'}],gateway_ping:{status:'no_reply',sent:3,received:0,average_ms:null},warnings:[]};
 const engine=new NetworkDiagnostics({dir,now:()=>clock,online:()=>online,update:()=>download,lookup:async host=>{if(dnsBad&&host.includes('release-assets'))throw Error('ENOTFOUND');return {address:'192.0.2.10'};},local:async()=>{localCalls++;if(hold)await hold;return local;},fetcher:async(url,options={})=>{
  calls.push({url,method:options.method,headers:options.headers});
  if(url.endsWith('latest.yml'))return new Response('version: 1.0.18\nfiles:\n  - url: '+(badFeed?'http://127.0.0.1/private':installer)+'\n');
  if(options.method==='OPTIONS')return new Response(null,{status:204});
  assert.equal(options.method,'HEAD','A diagnostic must not download the installer');return {ok:fileStatus===200,status:fileStatus,url:'https://release-assets.githubusercontent.com/release?signature=private',body:{cancel:async()=>{}}};
 }});
 return {engine,dir,calls,local,advance:n=>clock+=n,setOnline:v=>online=v,setDownload:v=>download=v,setFileStatus:v=>fileStatus=v,badFeed:()=>badFeed=true,badDNS:()=>dnsBad=true,hold:promise=>hold=promise,localCalls:()=>localCalls};
}
test('small probes distinguish API, manifest and actual file host; no installer GET or credentials',async t=>{
 const f=fixture(t),s=await f.engine.probe();assert.equal(s.busy,false);assert.equal(s.probes.api.status,204);assert.equal(s.probes.feed.ok,true);assert.equal(s.probes.download.host,'release-assets.githubusercontent.com');assert.equal(f.calls.filter(x=>x.method==='GET').length,1);assert(f.calls.every(x=>x.headers===undefined));
 assert(s.conclusions.some(x=>x.code==='weak_wifi'));assert(!s.conclusions.some(x=>x.code==='offline'));assert(!JSON.stringify(f.engine.summary()).includes('Private Wi-Fi'));assert(!JSON.stringify(f.engine.summary()).includes('192.0.2'));assert(!JSON.stringify(s).includes('signature=private'));
 await f.engine.probe();assert.equal(f.engine.snapshot().history.filter(x=>x.kind==='wifi_disconnected').length,1);
});
test('connection changes and stalled transfers persist; new bytes reset the stall without changing updater',async t=>{
 const f=fixture(t);f.engine.observe();f.advance(60000);assert.equal(f.engine.observe().download.stalled_seconds,60);assert.equal(f.engine.observe().download.bytes_per_second,0,'A stalled download must not display a stale average rate');f.setOnline(false);assert(f.engine.observe().conclusions.some(x=>x.code==='offline'));f.setOnline(true);f.engine.observe();
 f.setDownload({status:'downloading',transferred:20,total:100,bytesPerSecond:20});assert.equal(f.engine.observe().download.stalled_seconds,0);
 const restored=new NetworkDiagnostics({dir:f.dir,online:()=>true,now:()=>Date.parse('2026-10-24T11:32:00Z')});assert.deepEqual(restored.state.history.map(x=>x.kind),['offline','online']);
});
test('HTTP file failures and DNS issues are separate; a blocked ping is not labelled a Wi-Fi break',async t=>{
 const f=fixture(t);f.local.wifi[0].signal_percent=85;f.local.events=[];f.setFileStatus(403);f.badDNS();const s=await f.engine.probe();assert.equal(s.probes.api.reachable,true);assert(s.conclusions.some(x=>x.code==='download_unreachable'));assert(s.conclusions.some(x=>x.code==='dns_failure'));assert(!s.conclusions.some(x=>x.code==='offline'||x.code==='api_unreachable'));
 assert.equal(conclusions({online:true,local:f.local,history:[],download:{},probes:{api:{reachable:true},feed:{ok:true},download:{ok:true}}})[0].code,'reachable');
});
test('untrusted manifest targets cannot become local network requests',async t=>{
 const f=fixture(t);f.badFeed();const s=await f.engine.probe();assert.equal(f.calls.length,2);assert.equal(s.probes.download.error,'manifest_invalid');assert(!f.calls.some(x=>x.url.includes('127.0.0.1')));
});
test('parallel clicks share one probe and raw download errors lose bearer and signed query values',async t=>{
 const f=fixture(t);let release;f.hold(new Promise(r=>release=r));const first=f.engine.probe(),second=f.engine.probe();await new Promise(r=>setImmediate(r));assert.equal(f.localCalls(),1);release();await Promise.all([first,second]);assert.equal(f.calls.length,3);
 f.setDownload({status:'error',error:'Bearer SECRET_TOKEN at https://example.invalid/package?signature=SECRET_QUERY'});const s=f.engine.observe();assert(!JSON.stringify(s).includes('SECRET_'));assert(!fs.readFileSync(path.join(f.dir,'history.json'),'utf8').includes('SECRET_'));
});
test('Windows reader runs hidden static read-only commands with limits and tolerates a UTF-8 BOM',async()=>{
 let call;const result=await windowsSnapshot({platform:'win32',exec:async(...args)=>{call=args;return {stdout:'\uFEFF'+JSON.stringify({adapters:[],wifi:[],events:[],warnings:[]})};}});assert.deepEqual(result.wifi,[]);assert.equal(call[2].windowsHide,true);assert.equal(call[2].timeout,15000);const script=call[1].at(-1);assert(script.includes('Get-WinEvent'));assert(script.includes('wlan show interfaces'));assert(!/key=clear|\bSet-Net|\bRestart-|\bRemove-Net|wlan\s+(connect|disconnect|set|export)/i.test(script));
});
