import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';import fs from 'node:fs';
import {createBackupHandler} from '../supabase/functions/fastgo-backups/handler.js';
import {decryptArchive,b64,sha256} from '../supabase/functions/fastgo-backups/crypto.js';
const actor=crypto.randomUUID(),base='https://backup.example.invalid',secret=b64(crypto.randomBytes(32)),keyId=crypto.randomUUID();
function fixture(){
 let role='owner',lease=null;const backups=[],media=[],devices=[],objects=new Map(),calls=[],control={id:1};
 const schema=JSON.parse(fs.readFileSync(new URL('google-schema.json',import.meta.url))),sheets=Object.fromEntries(Object.entries(schema).map(([name,headers])=>[name,{headers,rows:[]}]));
 const file={bucket:'fastgo-workshop-private',name:'fixture/photo.jpg',stamp:'2026-10-24:etag',bytes:4},exported={format:1,source_version:180,native:{sheets},tables:{'public.workshop_members':[{profile_id:actor}],'auth.users':[{encrypted_password:'private-test-hash'}]},media:[file]};
 const respond=(data,status=200)=>new Response(JSON.stringify(data),{status});
 async function fetcher(url,options={}){
  const u=new URL(url),q=u.searchParams,method=options.method||'GET';let p;try{p=typeof options.body==='string'?JSON.parse(options.body):options.body;}catch{}
  calls.push({path:u.pathname,method});if(u.pathname==='/auth/v1/user')return respond({id:actor});
  if(u.pathname.startsWith('/storage/v1/object/sign/'))return respond({signedURL:'/object/sign/fastgo-backups/'+u.pathname.split('/fastgo-backups/')[1]+'?token=fixture'});
  if(u.pathname.startsWith('/storage/v1/object/authenticated/fastgo-workshop-private/'))return new Response(Buffer.from('JPEG'));
  if(u.pathname.startsWith('/storage/v1/object/authenticated/fastgo-backups/'))return new Response(objects.get(u.pathname.split('/fastgo-backups/')[1]));
  if(u.pathname.startsWith('/storage/v1/object/fastgo-backups/')){const name=u.pathname.split('/fastgo-backups/')[1];if(objects.has(name))return respond({error:'Duplicate',message:'The resource already exists'},400);objects.set(name,Buffer.from(options.body));return respond({},201);}
  const table=u.pathname.split('/rest/v1/')[1];
  if(table==='workshop_device_status')return respond([]);
  if(table==='workshop_members')return respond([{profile_id:actor,role,name:'Fixture'}]);
  if(table==='rpc/workshop_backup_keys')return respond({key:secret,key_id:keyId,job_token:'fixture-private-job-token'});
  if(table==='rpc/workshop_backup_schedule')return respond({scheduled:true});
  if(table==='rpc/workshop_backup_export')return respond(structuredClone(exported));
  if(table==='workshop_native_state')return respond([{version:180}]);
  if(table==='workshop_backup_control'){
   if(method==='PATCH'&&q.has('or')){if(lease)return respond([]);lease=p.lease_until;return respond([{...control,lease_until:lease}]);}
   if(method==='PATCH'){Object.assign(control,p);lease=p.lease_until;}return respond([control]);
  }
  const list=table==='workshop_backups'?backups:table==='workshop_backup_media'?media:table==='workshop_backup_devices'?devices:null;
  if(list){if(method==='POST'){const key=table==='workshop_backup_devices'?'device_id':'id',at=list.findIndex(x=>x[key]===p[key]);if(at<0)list.push(p);else list[at]={...list[at],...p};return respond(null,201);}if(method==='PATCH'){const key=table==='workshop_backup_devices'?'device_id':'id',row=list.find(x=>x[key]===q.get(key)?.slice(3));if(row)Object.assign(row,p);return respond(null,204);}
   let rows=[...list];if(q.get('device_id'))rows=rows.filter(x=>x.device_id===q.get('device_id').slice(3));if(q.get('id'))rows=rows.filter(x=>x.id===q.get('id').slice(3));if(q.get('public_key'))rows=rows.filter(x=>x.public_key);if(q.get('limit'))rows=rows.slice(Number(q.get('offset')||0),Number(q.get('offset')||0)+Number(q.get('limit')));return respond(rows);}
  throw Error('Unexpected fixture table '+table);
 }
 const handler=createBackupHandler({base,key:'server-fixture-key',fetcher});
 const call=async(action,p={},headers={Authorization:'Bearer fixture'})=>{const r=await handler(new Request(base,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({action,...p})}));return {status:r.status,body:await r.json()};};
 return {call,calls,backups,media,devices,objects,control,setRole:r=>role=r,lock:()=>lease='other',loseMediaRow:()=>media.length=0};
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
