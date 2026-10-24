import {fail} from './model.js';

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
 const row={device_id:device.id,app,version:p.version,station_id:stationId,pending_documents:p.pending_documents??null,details,last_seen:new Date().toISOString()};
 await db('workshop_device_status','on_conflict=device_id,app','POST',row,'resolution=merge-duplicates,return=minimal');
 return {device_id:device.id,app,version:row.version,last_seen:row.last_seen};
}
