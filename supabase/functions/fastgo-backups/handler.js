import {b64,unb64,encryptArchive,decryptArchive,sha256,wrapKey} from './crypto.js';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-fastgo-backup-job','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const out=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:cors}),fail=(m,s=400)=>{throw Object.assign(Error(m),{status:s});};
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const escaped=p=>p.split('/').map(encodeURIComponent).join('/'),bucket='fastgo-backups';
const mediaId=file=>sha256(file.bucket+'\n'+file.name+'\n'+file.stamp);
function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;}
export function createBackupHandler({base,key,publicBase=base,signingKey=key,fetcher=fetch,now=()=>Date.now()}){
 return async request=>{
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});if(request.method!=='POST')return out({error:'Только POST'},405);
  try{
   if(!base||!key)fail('Резервирование временно недоступно',503);
   const db=async(table,q='',method='GET',body,prefer)=>{const r=await fetcher(base+'/rest/v1/'+table+(q?'?'+q:''),{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});if(!r.ok)fail('Ошибка хранилища резервных копий',503);if(r.status===204)return null;const text=await r.text();return text?JSON.parse(text):null;};
   const keys=()=>db('rpc/workshop_backup_keys','','POST',{});
   const put=async(path,bytes)=>{const url=base+'/storage/v1/object/'+bucket+'/'+escaped(path),headers={apikey:key,Authorization:'Bearer '+key};const r=await fetcher(url,{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream','x-upsert':'false'},body:bytes,signal:AbortSignal.timeout(60000)});let duplicate=r.status===409;if(!r.ok&&r.status===400){const error=await r.clone().json().catch(()=>({}));duplicate=error.statusCode==='409'||error.error==='Duplicate'||error.message==='The resource already exists';}if(duplicate){const existing=await fetcher(base+'/storage/v1/object/authenticated/'+bucket+'/'+escaped(path),{headers,signal:AbortSignal.timeout(60000)});if(!existing.ok)fail('Не удалось проверить существующий архив',503);return new Uint8Array(await existing.arrayBuffer());}if(!r.ok)fail('Не удалось записать резервный архив',503);return bytes;};
   const mediaRows=async columns=>{const rows=[];for(let offset=0;;offset+=1000){const page=await db('workshop_backup_media','select='+columns+'&order=id&limit=1000&offset='+offset);rows.push(...page);if(page.length<1000)return rows;}};
   const signed=async path=>{const r=await fetcher(base+'/storage/v1/object/sign/'+bucket+'/'+escaped(path),{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:900}),signal:AbortSignal.timeout(20000)});if(!r.ok)fail('Не удалось открыть резервный архив',503);const data=await r.json(),relative=data.signedURL||data.signedUrl;if(typeof relative!=='string'||!relative.startsWith('/object/sign/'+bucket+'/'))fail('Некорректная ссылка архива',503);return publicBase+'/storage/v1'+relative;};
   const sourceMedia=async file=>{const r=await fetcher(base+'/storage/v1/object/authenticated/'+escaped(file.bucket)+'/'+escaped(file.name),{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(60000)});if(!r.ok)fail('Файл резервной копии недоступен. Сохранён предыдущий архив.',503);const declared=Number(r.headers.get('content-length'));if(declared>24*1024*1024)fail('Файл превышает размер блока резервирования',413);const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length>24*1024*1024)fail('Файл превышает размер блока резервирования',413);return bytes;};
   const raw=await request.text();if(raw.length>12000)fail('Слишком большой запрос',413);let p;try{p=JSON.parse(raw);}catch{fail('Неверный запрос');}if(!p||typeof p!=='object')fail('Неверный запрос');
   const job=request.headers.get('x-fastgo-backup-job');let member,user;
   if(job){const secret=await keys();if(!equal(job,secret.job_token)||p.action!=='tick')fail('Нет доступа',401);}
   else{
    const authorization=request.headers.get('authorization');if(!authorization?.startsWith('Bearer '))fail('Войдите в FastGo',401);
    const r=await fetcher(base+'/auth/v1/user',{headers:{apikey:key,Authorization:authorization},signal:AbortSignal.timeout(12000)});if(!r.ok)fail('Войдите в FastGo',401);user=await r.json();
    member=(await db('workshop_members','profile_id=eq.'+user.id+'&active=eq.true&select=role,name'))[0];if(!member)fail('Нет доступа к FastGo',403);
   }
   const owner=member&&['owner','developer'].includes(member.role);
   if(p.action==='status'){
    if(!owner)fail('Состояние резервных копий доступно владельцу',403);
    const snapshot=(await db('workshop_backups','order=created_at.desc&limit=1'))[0],control=(await db('workshop_backup_control','id=eq.1&select=last_started_at,last_completed_at,last_error,server_url'))[0];
    const ready=snapshot?new Set((await mediaRows('id')).map(x=>x.id)):new Set();
    return out({data:{server:control,snapshot:snapshot?{id:snapshot.id,source_version:snapshot.source_version,created_at:snapshot.created_at,sha256:snapshot.sha256,bytes:snapshot.bytes,tables:Object.keys(snapshot.manifest.table_counts).length,media_expected:snapshot.manifest.media.length,media_present:snapshot.manifest.media.filter(x=>ready.has(x.id)).length}:null,devices:await db('workshop_backup_devices','select=device_id,app,host,last_seen,source_version,media_expected,media_present,verified_at,last_error&order=registered_at'),applications:await db('workshop_device_status','select=app,version,station_id,details,last_seen&order=last_seen.desc')}});
   }
   if(p.action==='initialize'){
    if(!owner)fail('Резервирование настраивает владелец',403);
    return out({data:await db('rpc/workshop_backup_schedule','','POST',{p_url:publicBase+'/functions/v1/fastgo-backups'})});
   }
   if(p.action==='tick'){
    if(!job&&!owner)fail('Нет доступа',403);
    const until=new Date(now()+180000).toISOString(),lease=await db('workshop_backup_control','id=eq.1&or=(lease_until.is.null,lease_until.lt.'+encodeURIComponent(new Date(now()).toISOString())+')','PATCH',{lease_until:until,last_started_at:new Date(now()).toISOString()},'return=representation');
    if(!lease?.length)return out({data:{busy:true}});
    let snapshot;
    try{
     const secret=await keys();snapshot=(await db('workshop_backups','order=created_at.desc&limit=1'))[0];const state=(await db('workshop_native_state','id=eq.1&select=version'))[0];
     const age=snapshot?now()-new Date(snapshot.created_at).getTime():Infinity;
     if(!snapshot||age>=3600000||age>=900000&&Number(snapshot.source_version)!==Number(state.version)){
      const data=await db('rpc/workshop_backup_export','','POST',{});if(data?.format!==1||!data.native?.sheets||!data.tables)fail('Неполный снимок базы',503);
      data.migration={signing_key:signingKey};const id=crypto.randomUUID(),created_at=new Date(now()).toISOString(),files=await Promise.all(data.media.map(async f=>({...f,id:await mediaId(f)})));data.media=files;
      const manifest={format:1,media:files,table_counts:Object.fromEntries(Object.entries(data.tables).map(([name,rows])=>[name,rows.length])),native_rows:Object.values(data.native.sheets).reduce((sum,sheet)=>sum+sheet.rows.length,0)};
      const packed=new Uint8Array(await new Response(new Blob([JSON.stringify(data)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
      let bytes=await encryptArchive(packed,secret.key,{kind:'database',compression:'gzip',id,key_id:secret.key_id,source_version:data.source_version,created_at});const path='database/'+id+'.fgarchive';bytes=await put(path,bytes);const verified=await decryptArchive(bytes,secret.key);if(verified.meta.id!==id)fail('Некорректный существующий архив',503);
      snapshot={id,source_version:data.source_version,created_at,object_path:path,sha256:await sha256(bytes),bytes:bytes.length,key_id:secret.key_id,manifest};await db('workshop_backups','','POST',snapshot);
     }
     const ready=new Set((await mediaRows('id')).map(x=>x.id));let copied=0;
     for(const file of snapshot.manifest.media){if(ready.has(file.id))continue;if(copied>=8)break;const rawBytes=await sourceMedia(file),plainHash=await sha256(rawBytes),path='media/'+file.id+'.fgarchive';let bytes=await encryptArchive(rawBytes,secret.key,{kind:'media',id:file.id,key_id:secret.key_id,plain_sha256:plainHash});
      bytes=await put(path,bytes);const verified=await decryptArchive(bytes,secret.key);if(verified.meta.id!==file.id||await sha256(verified.bytes)!==plainHash)fail('Исходный файл изменился во время резервирования',409);
      await db('workshop_backup_media','','POST',{id:file.id,bucket:file.bucket,source_path:file.name,source_stamp:file.stamp,object_path:path,sha256:await sha256(bytes),plain_sha256:plainHash,bytes:bytes.length,key_id:secret.key_id},'resolution=ignore-duplicates');copied++;
     }
     await db('workshop_backup_control','id=eq.1&lease_until=eq.'+encodeURIComponent(until),'PATCH',{lease_until:null,last_completed_at:new Date(now()).toISOString(),last_error:''});
     return out({data:{snapshot_id:snapshot.id,source_version:snapshot.source_version,media_copied:copied,media_expected:snapshot.manifest.media.length}});
    }catch(error){await db('workshop_backup_control','id=eq.1&lease_until=eq.'+encodeURIComponent(until),'PATCH',{lease_until:null,last_error:String(error.message||'backup_error').slice(0,500)}).catch(()=>{});throw error;}
   }
   if(!uuid(p.device_id)||typeof p.device_token!=='string'||!/^[a-f0-9-]{72}$/i.test(p.device_token))fail('Неверная копия устройства');
   let device=(await db('workshop_backup_devices','device_id=eq.'+p.device_id))[0];const tokenHash=await sha256(p.device_token);
   if(p.action==='register'){
    if(!['desktop','warehouse'].includes(p.app))fail('Неверное приложение');
    if(device&&(device.registered_by!==user.id||!equal(device.token_hash,tokenHash)))fail('Устройство уже зарегистрировано',409);
    let public_key=null,public_key_sha256=null;if(owner){if(typeof p.public_key!=='string'||p.public_key.length>1500)fail('Неверный ключ восстановления');await wrapKey(b64(new Uint8Array(32)),p.public_key);public_key=p.public_key;public_key_sha256=await sha256(unb64(p.public_key));}
    device={device_id:p.device_id,registered_by:user.id,token_hash:tokenHash,public_key,public_key_sha256,app:p.app,host:String(p.host||'').slice(0,120),last_seen:new Date(now()).toISOString()};
    await db('workshop_backup_devices','','POST',device,'resolution=merge-duplicates');return out({data:{registered:true,recovery_key:owner}});
   }
   if(!device||device.registered_by!==user.id||!equal(device.token_hash,tokenHash))fail('Зарегистрируйте резервную копию ноутбука',403);
   const snapshot=(await db('workshop_backups','order=created_at.desc&limit=1'))[0];
   if(p.action==='latest'){
    if(!snapshot)return out({data:{pending:true}});
    const secret=await keys(),all=await db('workshop_backup_devices','public_key=not.is.null&select=device_id,public_key,public_key_sha256,registered_by'),active=new Set((await db('workshop_members','active=eq.true&role=in.(owner,developer)&select=profile_id')).map(x=>x.profile_id));
    const key_boxes=await Promise.all(all.filter(x=>active.has(x.registered_by)).map(async x=>({device_id:x.device_id,public_key_sha256:x.public_key_sha256,key_id:secret.key_id,wrapped_key:await wrapKey(secret.key,x.public_key)})));
    const media=await mediaRows('id,sha256,bytes,key_id'),wanted=new Set(snapshot.manifest.media.map(x=>x.id));
    return out({data:{id:snapshot.id,created_at:snapshot.created_at,source_version:snapshot.source_version,sha256:snapshot.sha256,bytes:snapshot.bytes,key_id:snapshot.key_id,key_boxes,media:media.filter(x=>wanted.has(x.id)),media_expected:wanted.size,url:await signed(snapshot.object_path)}});
   }
   if(p.action==='media'){
    if(typeof p.id!=='string'||!/^[a-f0-9]{64}$/.test(p.id)||!snapshot?.manifest.media.some(x=>x.id===p.id))fail('Файл не относится к снимку',404);
    const file=(await db('workshop_backup_media','id=eq.'+p.id))[0];if(!file)fail('Сервер ещё копирует файл',409);return out({data:{id:file.id,sha256:file.sha256,bytes:file.bytes,url:await signed(file.object_path)}});
   }
   if(p.action==='receipt'){
    if(!uuid(p.snapshot_id)||!Number.isSafeInteger(p.media_present)||p.media_present<0||!Number.isSafeInteger(p.media_expected)||p.media_expected<0)fail('Неверное подтверждение');
    const saved=(await db('workshop_backups','id=eq.'+p.snapshot_id))[0];if(!saved||p.media_expected!==saved.manifest.media.length||p.media_present>p.media_expected)fail('Неверный снимок');
    await db('workshop_backup_devices','device_id=eq.'+device.device_id,'PATCH',{last_seen:new Date(now()).toISOString(),snapshot_id:saved.id,source_version:saved.source_version,media_expected:p.media_expected,media_present:p.media_present,verified_at:p.verified===true&&owner&&p.media_present===p.media_expected?new Date(now()).toISOString():null,last_error:String(p.error||'').slice(0,300)});
    return out({data:{saved:true}});
   }
   fail('Неизвестная операция');
  }catch(error){return out({error:error.status?error.message:'Не удалось проверить резервную копию'},error.status||503);}
 };
}
