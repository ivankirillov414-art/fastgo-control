import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createRequire} from 'node:module';
import {encryptArchive,decryptArchive,wrapKey,sha256,b64} from '../supabase/functions/fastgo-backups/crypto.js';
const require=createRequire(import.meta.url),{BackupReplica,unpack,validateSnapshot}=require('../warehouse-desktop/backup-replica.cjs');
const key=crypto.randomBytes(32),id=crypto.randomUUID(),keyId=crypto.randomUUID();
function snapshot(){const schema=JSON.parse(fs.readFileSync(new URL('./google-schema.json',import.meta.url))),sheets=Object.fromEntries(Object.entries(schema).map(([name,headers])=>[name,{headers,rows:[]}]));sheets['Товары'].rows.push({__row:2,product_id:crypto.randomUUID(),'Модель / название':'Камера 10 × 2,5','Остаток, шт.':4});return {format:1,source_version:180,native:{sheets,version:180},tables:{'public.workshop_members':[{profile_id:'fixture'}],'auth.users':[{encrypted_password:'private-fixture-hash'}]},media:[]};}
test('AES-GCM archives authenticate header and payload and decrypt in both Edge and native Node',async()=>{
 const data=Buffer.from(JSON.stringify(snapshot())),archive=await encryptArchive(data,b64(key),{kind:'database',id,key_id:keyId,source_version:180});
 assert.deepEqual(Buffer.from((await decryptArchive(archive,b64(key))).bytes),data);assert.deepEqual(unpack(Buffer.from(archive),key).bytes,data);
 for(const at of [15,archive.length-20,archive.length-1]){const broken=Buffer.from(archive);broken[at]^=1;assert.throws(()=>unpack(broken,key));}
 assert.throws(()=>unpack(Buffer.from(archive),crypto.randomBytes(32)));assert.ok(!Buffer.from(archive).includes(Buffer.from('private-fixture-hash')));
});
test('recovery key is wrapped only for the owning RSA private key',async()=>{
 const pair=crypto.generateKeyPairSync('rsa',{modulusLength:2048}),publicKey=pair.publicKey.export({type:'spki',format:'der'}).toString('base64');
 const wrapped=await wrapKey(b64(key),publicKey),raw=crypto.privateDecrypt({key:pair.privateKey,oaepHash:'sha256'},Buffer.from(wrapped,'base64'));assert.deepEqual(raw,key);
 await assert.rejects(wrapKey(b64(key),Buffer.from('invalid').toString('base64')));
});
test('recovery validates actual SQLite insertion, duplicate rows and incomplete snapshots',()=>{
 const data=snapshot(),result=validateSnapshot(Buffer.from(JSON.stringify(data)),{source_version:180});assert.equal(result.native_rows,1);assert.equal(result.tables,2);
 data.native.sheets['Товары'].rows.push(data.native.sheets['Товары'].rows[0]);assert.throws(()=>validateSnapshot(Buffer.from(JSON.stringify(data)),{source_version:180}));
 assert.throws(()=>validateSnapshot(Buffer.from('{}'),{source_version:180}));
});
async function fixture(t,{owner=true}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fastgo-replica-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const data=snapshot(),archive=Buffer.from(await encryptArchive(JSON.stringify(data),b64(key),{kind:'database',id,key_id:keyId,source_version:180})),receipts=[];
 let registration,corrupt=false,origin='https://backup.example.invalid';const meta={id,created_at:new Date().toISOString(),source_version:180,key_id:keyId,sha256:await sha256(archive),bytes:archive.length,media:[],media_expected:0,key_boxes:[],url:origin+'/storage/v1/object/sign/fastgo-backups/database/'+id};
 const call=async(action,p)=>{if(action==='register'){registration=p;return {registered:true};}if(action==='initialize')return {scheduled:true};if(action==='latest'){const key_boxes=owner?[{device_id:registration.device_id,key_id:keyId,public_key_sha256:await sha256(Buffer.from(registration.public_key,'base64')),wrapped_key:await wrapKey(b64(key),registration.public_key)}]:[];return {...meta,key_boxes};}if(action==='receipt'){receipts.push(p);return {saved:true};}throw Error(action);};
 const secureKey=crypto.randomBytes(32),secure={encrypt:s=>Buffer.concat([Buffer.from('DPAPI-FIXTURE:'),Buffer.from(s).map((v,i)=>v^secureKey[i%32])]),decrypt:b=>Buffer.from(b.subarray(14)).map((v,i)=>v^secureKey[i%32]).toString()};
 const make=()=>new BackupReplica({dir,secure,call,app:'desktop',host:'Fixture',allowedOrigins:[origin],fetcher:async()=>new Response(corrupt?new Uint8Array(archive.length):archive)});
 return {dir,meta,archive,receipts,make,corrupt:()=>corrupt=true,changeOrigin:()=>meta.url='https://external.example.invalid/private'};
}
test('native replica stores encrypted recovery files and validates an offline restore without business writes',async t=>{
 const h=await fixture(t),replica=h.make();await replica.tick({actor:'owner',owner:true});assert.equal(replica.state.status,'current');assert.equal(replica.state.verified,true);assert.equal(replica.state.restored.native_rows,1);assert.equal(h.receipts.at(-1).verified,true);
 const stored=fs.readdirSync(path.join(h.dir,'database')).map(n=>fs.readFileSync(path.join(h.dir,'database',n)));assert.ok(!stored.some(b=>b.includes(Buffer.from('private-fixture-hash'))));
 await h.make().tick({actor:'owner',owner:true});assert.equal(h.receipts.length,2,'the same protected identity survives restart');
});
test('a non-owner laptop receives an encrypted mirror without an owner decryption key',async t=>{
 const h=await fixture(t,{owner:false}),replica=h.make();await replica.tick({actor:'mechanic',owner:false});assert.equal(replica.state.status,'current');assert.equal(replica.state.verified,false);assert.equal(h.receipts.at(-1).verified,false);
});
test('corrupt network bytes and an unexpected download host preserve the previous valid copy',async t=>{
 const h=await fixture(t),replica=h.make();await replica.tick({actor:'owner',owner:true});const previous=fs.readFileSync(path.join(h.dir,'latest.json'));fs.rmSync(path.join(h.dir,'database',id+'.fgarchive'));h.corrupt();await replica.tick({actor:'owner',owner:true});assert.equal(replica.state.status,'error');assert.deepEqual(fs.readFileSync(path.join(h.dir,'latest.json')),previous);
 h.changeOrigin();await replica.tick({actor:'owner',owner:true});assert.match(replica.state.error,/Неверный сервер/);assert.deepEqual(fs.readFileSync(path.join(h.dir,'latest.json')),previous);
});
