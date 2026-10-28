import {fail} from './model.js';

// PostgreSQL JSONB adds spaces after separators. Keep the diagnostic row below
// its existing 4096-byte constraint, including multibyte Windows device names.
const pgJSON=value=>Array.isArray(value)?'['+value.map(pgJSON).join(', ')+']':value&&typeof value==='object'?'{'+Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>JSON.stringify(k)+': '+pgJSON(v)).join(', ')+'}':JSON.stringify(value);
export function compactDiagnostics(details){
 const bytes=()=>new TextEncoder().encode(pgJSON(details)).length;
 if(bytes()<3800)return details;
 details.diagnostics_truncated=true;
 if(details.scanner?.devices){const devices=details.scanner.devices;devices.sort((a,b)=>Number(/VID_2AAF|4BARCODE|PC.?365|DETONG|P2|ATOL|АТОЛ/i.test(b.hardware+' '+b.name)||b.error>0)-Number(/VID_2AAF|4BARCODE|PC.?365|DETONG|P2|ATOL|АТОЛ/i.test(a.hardware+' '+a.name)||a.error>0));while(devices.length&&bytes()>=3800)devices.pop();}
 if(details.printing?.printers){const printers=details.printing.printers;printers.sort((a,b)=>Number(b.name===details.printing.label?.deviceName)-Number(a.name===details.printing.label?.deviceName));while(printers.length&&bytes()>=3800)printers.pop();}
 if(bytes()>=3800)delete details.scanner;
 if(bytes()>=3800)delete details.printing;
 if(bytes()>=3800)delete details.network;
 return details;
}

// Diagnostic receipts contain no scans, customer records, passwords or tokens.
export async function deviceStatus(action,p,{db,device,stationId}){
 if(action!=='device_status')return undefined;
 const app=p.app;
 if(!['desktop','warehouse','tsd'].includes(app)||!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(p.version||''))fail('Неверная версия приложения');
 if((app==='tsd')!==(device.kind==='terminal'))fail('Неверный тип устройства',403);
 if(p.pending_documents!==undefined&&p.pending_documents!==null&&(!Number.isSafeInteger(p.pending_documents)||p.pending_documents<0||p.pending_documents>100000))fail('Неверное количество документов');
 const text=(v,n=200)=>typeof v==='string'?v.slice(0,n):'';
 const details={host:text(p.host,80),update_status:text(p.update_status,40),latest_version:text(p.latest_version,24),blocking_reason:text(p.blocking_reason),error:text(p.error),background:p.background===true};
 if(Number.isSafeInteger(p.version_code)&&p.version_code>0)details.version_code=p.version_code;
 if(Number.isSafeInteger(p.pending_writes)&&p.pending_writes>=0)details.pending_writes=p.pending_writes;
 if(p.observer==='companion'&&app==='warehouse')details.observer='companion';
 if(app==='warehouse'&&p.network&&typeof p.network==='object'){
  const source=p.network,flag=x=>typeof x==='boolean'?x:null,integer=(x,max)=>Number.isSafeInteger(x)&&x>=0&&x<=max?x:null;
  details.network={sampled_at:typeof source.sampled_at==='string'&&Number.isFinite(Date.parse(source.sampled_at))?new Date(source.sampled_at).toISOString():null,online:flag(source.online),wifi_signal_percent:integer(source.wifi_signal_percent,100),disconnects_24h:integer(source.disconnects_24h,100000),api_ok:flag(source.api_ok),feed_ok:flag(source.feed_ok),download_ok:flag(source.download_ok),download_bytes_per_second:integer(Math.round(source.download_bytes_per_second),1e12),stalled_seconds:integer(source.stalled_seconds,86400),codes:Array.isArray(source.codes)?source.codes.filter(x=>['offline','weak_wifi','wifi_history','api_unreachable','feed_unreachable','download_unreachable','dns_failure','download_stalled','reachable','pending'].includes(x)).slice(0,10):[]};
 }
 if(app!=='tsd'&&p.printing&&typeof p.printing==='object'){
  const source=p.printing,label=source.profiles?.label,dimension=value=>Number.isFinite(value)&&value>=20&&value<=200?value:null;
  details.printing={sampled_at:new Date().toISOString(),printers:(Array.isArray(source.printers)?source.printers:[]).slice(0,32).filter(x=>x&&typeof x.name==='string').map(x=>({name:text(x.name,256),displayName:text(x.displayName,256),status:Number.isInteger(x.status)?x.status:0,isDefault:x.isDefault===true})),label:label&&typeof label.deviceName==='string'?{deviceName:text(label.deviceName,256),widthMm:dimension(label.widthMm),heightMm:dimension(label.heightMm)}:null,warning:text(source.warning)};
  if(source.setup&&typeof source.setup==='object'){const s=source.setup;details.printing.setup={status:text(s.status,32),message:text(s.message,300),driver_version:text(s.driver_version,32),queue_name:text(s.queue_name,256),connected:s.connected===true,busy:s.busy===true,attempts:Number.isInteger(s.attempts)?Math.max(0,Math.min(100,s.attempts)):0,updated_at:typeof s.updated_at==='string'&&Number.isFinite(Date.parse(s.updated_at))?new Date(s.updated_at).toISOString():null};}
  if(source.pc365&&typeof source.pc365==='object'){const s=source.pc365;details.printing.pc365={status:text(s.status,32),message:text(s.message,300),driver_version:text(s.driver_version,32),queue_name:text(s.queue_name,256),connected:s.connected===true,busy:s.busy===true,test_printed:s.test_printed===true,updated_at:text(s.updated_at,40)};}
 }
 const row={device_id:device.id,app,version:p.version,station_id:stationId,pending_documents:p.pending_documents??null,details,last_seen:new Date().toISOString()};
 if(app!=='tsd'&&p.scanner&&typeof p.scanner==='object')details.scanner={sampled_at:text(p.scanner.sampled_at,40),devices:(Array.isArray(p.scanner.devices)?p.scanner.devices:[]).slice(0,64).map(x=>({name:text(x.name,160),manufacturer:text(x.manufacturer,100),kind:text(x.kind,40),status:text(x.status,40),hardware:text(x.hardware,160),error:Number.isSafeInteger(x.error)?x.error:null}))};
 if(app!=='tsd'&&p.scan_test&&typeof p.scan_test==='object')details.scan_test={received:p.scan_test.received===true,matched:p.scan_test.matched===true,characters:Number.isSafeInteger(p.scan_test.characters)?Math.min(2048,Math.max(0,p.scan_test.characters)):0,...(p.scan_test.source==='atol'?{source:'atol',normalized:p.scan_test.normalized===true,...(/^(?:FGP-\d{1,20}|\d{8,18})$/.test(p.scan_test.code||'')?{code:p.scan_test.code}:{})}:{}),sampled_at:new Date().toISOString()};
 if(app!=='tsd'&&p.input_health&&typeof p.input_health==='object'){const x=p.input_health;details.input_health={screen:text(x.screen,32),busy:x.busy===true,focused:x.focused===true,tag:['INPUT','TEXTAREA','SELECT','BODY','BUTTON'].includes(x.tag)?x.tag:'OTHER',disabled:x.disabled===true,readonly:x.readonly===true,payment_pending:x.payment_pending===true};}
 compactDiagnostics(details);
 await db('workshop_device_status','on_conflict=device_id,app','POST',row,'resolution=merge-duplicates,return=minimal');
 return {device_id:device.id,app,version:row.version,last_seen:row.last_seen};
}
