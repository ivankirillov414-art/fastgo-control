import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';import fs from 'node:fs';
import {createBackupHandler} from '../supabase/functions/fastgo-backups/handler.js';
import {decryptArchive,b64,sha256} from '../supabase/functions/fastgo-backups/crypto.js';
import {backupDay,dailyHistory,retentionPlan} from '../supabase/functions/fastgo-backups/policy.js';
const actor=crypto.randomUUID(),base='https://backup.example.invalid',secret=b64(crypto.randomBytes(32)),keyId=crypto.randomUUID();
function fixture(){
 let role='owner',lease=null,time=Date.parse('2026-11-07T10:00:00Z'),badRead=false,sourceMissing=false,revoked=false,full=false;const backups=[],media=[],devices=[],objects=new Map(),calls=[],control={id:1},hardwareId=crypto.randomUUID(),stationId=crypto.randomUUID(),hardwareToken=crypto.randomUUID()+crypto.randomUUID();
 const schema=JSON.parse(fs.readFileSync(new URL('google-schema.json',import.meta.url))),sheets=Object.fromEntries(Object.entries(schema).map(([name,headers])=>[name,{headers,rows:[]}]));
 const file={bucket:'fastgo-workshop-private',name:'fixture/photo.jpg',stamp:'2026-10-24:etag',bytes:4},exported={format:1,export_scope:'full-project',source_version:180,native:{sheets},tables:{'public.workshop_members':[{profile_id:actor}],'auth.users':[{encrypted_password:'private-test-hash'}]},media:[file]};
 const respond=(data,status=200)=>new Response(status===204?null:JSON.stringify(data),{status});
 async function fetcher(url,options={}){
  const u=new URL(url),q=u.searchParams,method=options.method||'GET';let p;try{p=typeof options.body==='string'?JSON.parse(options.body):options.body;}catch{}
  calls.push({path:u.pathname,method});if(u.pathname==='/auth/v1/user')return respond({id:actor});
  if(u.pathname.startsWith('/storage/v1/object/sign/'))return respond({signedURL:'/object/sign/fastgo-backups/'+u.pathname.split('/fastgo-backups/')[1]+'?token=fixture'});
  if(u.pathname==='/storage/v1/object/fastgo-backups'&&method==='DELETE'){for(const path of p.prefixes)objects.delete(path);return respond([]);}
  if(u.pathname.startsWith('/storage/v1/object/authenticated/fastgo-workshop-private/'))return sourceMissing?respond({},404):new Response(Buffer.from('JPEG'));
  if(u.pathname.startsWith('/storage/v1/object/authenticated/fastgo-backups/')){const value=objects.get(u.pathname.split('/fastgo-backups/')[1]);return value?new Response(badRead?Buffer.from('corrupt'):value):respond({},404);}
  if(u.pathname.startsWith('/storage/v1/object/fastgo-backups/')){const name=u.pathname.split('/fastgo-backups/')[1];if(objects.has(name))return respond({error:'Duplicate',message:'The resource already exists'},400);objects.set(name,Buffer.from(options.body));return respond({},201);}
  const table=u.pathname.split('/rest/v1/')[1];
  if(table==='workshop_device_status')return respond([]);
  if(table==='workshop_members')return respond(revoked?[]:[{profile_id:actor,role,name:'Fixture'}]);
  if(table==='workshop_warehouse_devices')return respond(revoked?[]:[q.get('kind')==='eq.terminal'?{id:hardwareId,kind:'terminal',active:true,created_by:actor,station_id:stationId,token_hash:await sha256(hardwareToken)}:{id:stationId,kind:'station',active:true}]);
  if(table==='workshop_terminal_stations')return respond(revoked?[]:[{station_id:stationId}]);
  if(table==='rpc/workshop_backup_keys')return respond({key:secret,key_id:keyId,job_token:'fixture-private-job-token'});
  if(table==='rpc/workshop_backup_storage_usage')return respond({bytes:full?512*1024*1024-10:[...objects.values()].reduce((sum,bytes)=>sum+bytes.length,0)});
  if(table==='rpc/workshop_backup_schedule')return respond({scheduled:true});
  if(table==='rpc/workshop_backup_export')return respond(structuredClone(exported));
  if(table==='rpc/workshop_backup_complete'){const row=backups.find(x=>x.id===p.p_id);const completed=!!row&&objects.has(row.object_path)&&row.manifest.media.every(f=>media.some(m=>m.id===f.id&&objects.has(m.object_path)));if(completed)row.completed_at||=new Date(time).toISOString();return respond({completed});}
  if(table==='rpc/workshop_backup_retention_ready')return respond({ready:p.p_ids.length===7&&p.p_ids.every(id=>backups.some(b=>b.id===id&&b.completed_at&&objects.has(b.object_path)&&b.manifest.media.every(f=>media.some(m=>m.id===f.id&&objects.has(m.object_path))))) });
  if(table==='workshop_native_state')return respond([{version:180}]);
  if(table==='workshop_backup_control'){
   if(method==='PATCH'&&q.has('or')){if(lease)return respond([]);lease=p.lease_until;return respond([{...control,lease_until:lease}]);}
   if(method==='PATCH'){Object.assign(control,p);lease=p.lease_until;}return respond([control]);
  }
  const list=table==='workshop_backups'?backups:table==='workshop_backup_media'?media:table==='workshop_backup_devices'?devices:null;
  if(list){if(method==='DELETE'){const at=list.findIndex(x=>x.id===q.get('id')?.slice(3));if(at>=0)list.splice(at,1);return respond(null,204);}if(method==='POST'){const key=table==='workshop_backup_devices'?'device_id':'id',at=list.findIndex(x=>x[key]===p[key]);if(at<0)list.push(p);else list[at]={...list[at],...p};return respond(null,201);}if(method==='PATCH'){const key=table==='workshop_backup_devices'?'device_id':'id',row=list.find(x=>x[key]===q.get(key)?.slice(3));if(row)Object.assign(row,p);return respond(null,204);}
   let rows=[...list];if(q.get('device_id'))rows=rows.filter(x=>x.device_id===q.get('device_id').slice(3));if(q.get('id'))rows=rows.filter(x=>x.id===q.get('id').slice(3));if(q.get('public_key'))rows=rows.filter(x=>x.public_key);if(q.get('order')==='created_at.desc')rows.sort((a,b)=>b.created_at.localeCompare(a.created_at));if(q.get('limit'))rows=rows.slice(Number(q.get('offset')||0),Number(q.get('offset')||0)+Number(q.get('limit')));return respond(rows);}
  throw Error('Unexpected fixture table '+table);
 }
 const handler=createBackupHandler({base,key:'server-fixture-key',fetcher,now:()=>time});
 const call=async(action,p={},headers={Authorization:'Bearer fixture'})=>{const r=await handler(new Request(base,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({action,...p})}));return {status:r.status,body:await r.json()};};
 return {call,calls,backups,media,devices,objects,control,exported,hardwareId,hardwareToken,setRole:r=>role=r,lock:()=>lease='other',loseMediaRow:()=>media.length=0,advance:()=>time+=86400000,corruptRead:()=>badRead=true,missingSource:()=>sourceMissing=true,restoreSource:()=>sourceMissing=false,revoke:()=>revoked=true,fill:()=>full=true};
}
test('backup worker authenticates callers, limits creation to owner and protects device identity',async()=>{
 const h=fixture();assert.equal((await h.call('tick',{},{})).status,401);h.setRole('mechanic');assert.equal((await h.call('tick')).status,403);assert.equal((await h.call('initialize')).status,403);
 const id=crypto.randomUUID(),device_token=crypto.randomUUID()+crypto.randomUUID(),p={device_id:id,device_token,app:'desktop',host:'Fixture'};
 assert.equal((await h.call('register',p)).status,200);assert.equal(h.devices[0].public_key,null);assert.equal((await h.call('register',{...p,device_token:crypto.randomUUID()+crypto.randomUUID()})).status,409);assert.equal(h.backups.length,0);
});
test('server stores encrypted, consistent snapshots and distinct photo archives without changing business data',async()=>{
 const h=fixture(),r=await h.call('tick');assert.equal(r.status,200);assert.equal(h.backups.length,1);assert.equal(h.media.length,1);assert.equal(h.objects.size,2);
 const snapshot=h.backups[0],opened=await decryptArchive(h.objects.get(snapshot.object_path),secret);assert.equal(opened.meta.source_version,180);assert.equal(opened.meta.compression,'gzip');assert.equal(h.control.last_error,'');
 for(const bytes of h.objects.values())assert.ok(!bytes.includes(Buffer.from('private-test-hash')));
 assert.ok(!h.calls.some(x=>x.method!=='GET'&&/workshop_native_(rows|state|commit)|auth\/v1/.test(x.path)));
 const second=await h.call('tick');assert.equal(second.status,200);assert.equal(h.backups.length,1);assert.equal(h.objects.size,2);
});
test('a lost media metadata commit reuses and verifies its original encrypted object',async()=>{
 const h=fixture();await h.call('tick');const old=h.media[0],cipher=Buffer.from(h.objects.get(old.object_path));h.loseMediaRow();const result=await h.call('tick');assert.equal(result.status,200);assert.equal(h.media[0].sha256,await sha256(cipher));assert.deepEqual(h.objects.get(old.object_path),cipher);
});
test('parallel workers respect the lease and an invalid scheduled token cannot start a backup',async()=>{
 const h=fixture();h.lock();assert.equal((await h.call('tick')).body.data.busy,true);assert.equal(h.backups.length,0);
 assert.equal((await h.call('tick',{}, {'X-FastGo-Backup-Job':'invalid'})).status,401);
});

test('backup status is owner-only and contains no decryption keys or device tokens',async()=>{const h=fixture();await h.call('tick');const r=await h.call('status');assert.equal(r.status,200);assert.equal(r.body.data.snapshot.media_present,1);assert.ok(!JSON.stringify(r.body).includes(secret));h.setRole('mechanic');assert.equal((await h.call('status')).status,403);});

test('eight successful dates retain seven; same-day replay creates no extra archive; older selected snapshot downloads',async()=>{
 const h=fixture(),p={device_id:crypto.randomUUID(),device_token:crypto.randomUUID()+crypto.randomUUID(),app:'android'};
 assert.equal((await h.call('register',p)).status,200);
 for(let day=0;day<8;day++){assert.equal((await h.call('tick')).status,200);if(day<7)h.advance();}
 assert.equal(h.backups.length,7);assert.equal((await h.call('tick')).status,200);assert.equal(h.backups.length,7);
 const history=(await h.call('history',p)).body.data;assert.equal(history.snapshots.length,7);assert.equal(new Set(history.snapshots.map(x=>x.day)).size,7);
 const id=history.snapshots.at(-1).id,snapshot=(await h.call('snapshot',{...p,snapshot_id:id})).body.data;
 assert.equal(snapshot.id,id);assert.equal(snapshot.media.length,1);assert.equal((await h.call('media',{...p,snapshot_id:id,id:snapshot.media[0].id})).status,200);
 const opened=await decryptArchive(h.objects.get(h.backups.find(x=>x.id===id).object_path),secret);
 const recovered=await new Response(new Blob([opened.bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
 assert.equal(recovered.tables['auth.users'][0].encrypted_password,'private-test-hash');
});

test('failed eighth day and corrupted persisted upload cannot rotate previous seven complete dates',async()=>{
 const h=fixture();for(let i=0;i<7;i++){assert.equal((await h.call('tick')).status,200);h.advance();}
 const keep=h.backups.map(x=>x.id);h.exported.media[0].stamp='new-revision';h.missingSource();
 assert.equal((await h.call('tick')).status,503);assert.equal(dailyHistory(h.backups).length,7);assert.ok(keep.every(id=>h.backups.some(x=>x.id===id)));
 h.restoreSource();h.corruptRead();assert.equal((await h.call('tick')).status,503);assert.ok(keep.every(id=>h.backups.some(x=>x.id===id)));
});

test('TSD hardware tokens can save ciphertext but cannot administer, obtain recovery keys, or survive revocation',async()=>{
 const h=fixture();await h.call('tick');const p={device_id:h.hardwareId,device_token:h.hardwareToken,app:'tsd',public_key:'invalid-key-is-not-admitted'};
 const r=await h.call('register',p,{});assert.equal(r.status,200);assert.equal(r.body.data.recovery_key,false);assert.equal(h.devices[0].public_key,null);
 assert.equal((await h.call('history',p,{})).body.data.snapshots.length,1);
 for(const action of ['tick','initialize','status'])assert.equal((await h.call(action,p,{})).status,401);
 h.revoke();assert.equal((await h.call('history',p,{})).status,403);
});

test('daily policy uses local midnight and never promotes legacy or incomplete archives',()=>{
 assert.equal(backupDay('2026-11-07T18:59:59Z'),'2026-11-07');assert.equal(backupDay('2026-11-07T19:00:00Z'),'2026-11-08');
 const legacy={id:'old',created_at:'2026-11-01',manifest:{media:[]}};assert.deepEqual(dailyHistory([legacy]),[]);assert.deepEqual(retentionPlan([legacy],[]).expired,[]);
});

test('full project archive keeps rental data while retaining the legacy workshop table namespace',async()=>{
 const h=fixture();h.exported.tables['public.rentals']=[{id:'rental-fixture',state:'active'}];
 const result=await h.call('tick');assert.equal(result.status,200);const row=h.backups[0],opened=await decryptArchive(h.objects.get(row.object_path),secret);
 const data=await new Response(new Blob([opened.bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
 assert.equal(data.project_tables['public.rentals'][0].state,'active');assert.equal(data.tables['public.rentals'],undefined);
 assert.equal(row.manifest.table_counts['public.rentals'],1);assert.ok(Object.keys(data.tables).every(name=>/^(public\.workshop_|auth\.)/.test(name)));
});

test('corrupt retained database blocks deletion; orphan media cleanup resumes after the last expired database',async()=>{
 const h=fixture();for(let i=0;i<7;i++){assert.equal((await h.call('tick')).status,200);h.advance();}
 const previous=h.backups.map(x=>x.id),damaged=h.backups[3];h.objects.set(damaged.object_path,Buffer.from('corrupt-existing'));
 assert.equal((await h.call('tick')).status,503);assert.ok(previous.every(id=>h.backups.some(x=>x.id===id)));
 const retained=dailyHistory(h.backups),orphan={id:'b'.repeat(64),object_path:'media/'+'b'.repeat(64)+'.fgarchive'};
 assert.equal(retentionPlan(retained,[...h.media,orphan]).media[0].id,orphan.id);
 assert.equal(retentionPlan(retained,h.media).media.length,0);
});

test('storage quota stops before upload and preserves all previous good backups',async()=>{
 const h=fixture();await h.call('tick');h.advance();const before=[...h.objects.keys()],previous=h.backups[0].id;
 h.fill();const result=await h.call('tick');assert.equal(result.status,507);assert.match(result.body.error,/512 МБ/);
 assert.deepEqual([...h.objects.keys()],before);assert.ok(h.backups.some(x=>x.id===previous&&x.completed_at));assert.equal(h.control.lease_until,null);
});
