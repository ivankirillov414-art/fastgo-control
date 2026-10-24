const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{promisify}=require('node:util');
const generate=promisify(crypto.generateKeyPair),hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function unpack(bytes,key){
 const first=bytes.indexOf(10),second=bytes.indexOf(10,first+1);if(bytes.subarray(0,first).toString()!=='FGARCHIVE1')throw Error('Неизвестный формат резервной копии');
 const size=Number(bytes.subarray(first+1,second).toString());if(!Number.isSafeInteger(size)||size<1||size>8192||bytes.length<second+size+18)throw Error('Повреждён заголовок резервной копии');
 const header=bytes.subarray(second+1,second+1+size),meta=JSON.parse(header),iv=Buffer.from(meta.iv,'base64'),cipher=bytes.subarray(second+1+size);if(meta.format!==1||iv.length!==12||key.length!==32)throw Error('Неверный формат резервной копии');
 const decipher=crypto.createDecipheriv('aes-256-gcm',key,iv);decipher.setAAD(header);decipher.setAuthTag(cipher.subarray(-16));let plain=Buffer.concat([decipher.update(cipher.subarray(0,-16)),decipher.final()]);if(meta.compression){if(meta.compression!=='gzip')throw Error('Неизвестное сжатие архива');plain=require('node:zlib').gunzipSync(plain,{maxOutputLength:256*1024*1024});}return {meta,bytes:plain};
}
function validateSnapshot(bytes,expected){
 const data=JSON.parse(bytes);if(data.format!==1||Number(data.source_version)!==Number(expected.source_version)||!data.tables||!data.native?.sheets||Object.keys(data.native.sheets).length<10)throw Error('Резервная копия содержит неполную базу');
 const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(':memory:');let rows=0;
 try{db.exec('CREATE TABLE recovered(sheet TEXT,row_no INTEGER,data TEXT,PRIMARY KEY(sheet,row_no)); CREATE TABLE raw_recovered(table_name TEXT,row_no INTEGER,data TEXT,PRIMARY KEY(table_name,row_no))');const insert=db.prepare('INSERT INTO recovered VALUES(?,?,?)'),rawInsert=db.prepare('INSERT INTO raw_recovered VALUES(?,?,?)');db.exec('BEGIN');
  for(const [sheet,value] of Object.entries(data.native.sheets)){if(!Array.isArray(value.headers)||!Array.isArray(value.rows))throw Error('Повреждена структура таблиц');for(const row of value.rows){if(!Number.isSafeInteger(row.__row)||row.__row<2)throw Error('Повреждена строка таблицы');insert.run(sheet,row.__row,JSON.stringify(row));rows++;}}
  db.exec('COMMIT');if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||db.prepare('SELECT count(*) AS n FROM recovered').get().n!==rows)throw Error('Восстановление контрольной базы не прошло');
  let rawRows=0;for(const [name,list] of Object.entries(data.tables)){if(!Array.isArray(list)||!(/^(public\.workshop_|auth\.)/.test(name)))throw Error('Неверная таблица архива');for(let index=0;index<list.length;index++){if(!list[index]||typeof list[index]!=='object'||Array.isArray(list[index]))throw Error('Повреждена строка базы');rawInsert.run(name,index,JSON.stringify(list[index]));rawRows++;}}if(db.prepare('SELECT count(*) AS n FROM raw_recovered').get().n!==rawRows)throw Error('Не все строки базы восстановлены');
  if(!Array.isArray(data.media)||new Set(data.media.map(x=>x.id)).size!==data.media.length)throw Error('Повреждён список файлов');
  return {native_rows:rows,raw_rows:rawRows,tables:Object.keys(data.tables).length,media:data.media.length};
 }finally{db.close();}
}
function atomicWrite(target,bytes){fs.mkdirSync(path.dirname(target),{recursive:true});const temp=target+'.'+crypto.randomUUID()+'.partial',fd=fs.openSync(temp,'wx',0o600);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}try{fs.renameSync(temp,target);}catch(e){fs.rmSync(temp,{force:true});throw e;}}
class BackupReplica{
 constructor({dir,secure,call,fetcher=fetch,allowedOrigins,app,host,now=()=>Date.now()}){Object.assign(this,{dir,secure,call,fetcher,allowedOrigins,app,host,now});this.state={status:'waiting',media_present:0,media_expected:0};this.busy=false;}
 async identity(actor,owner){
  const file=path.join(this.dir,'identity-'+hash(actor).slice(0,24)+'.bin');let value;
  if(fs.existsSync(file)){try{value=JSON.parse(this.secure.decrypt(fs.readFileSync(file)));}catch{throw Error('Не удалось открыть ключ резервной копии Windows. Существующие архивы сохранены.');}}
  if(!value)value={device_id:crypto.randomUUID(),device_token:crypto.randomUUID()+crypto.randomUUID(),actor};if(value.actor!==actor)throw Error('Ключ принадлежит другой учётной записи');
  if(owner&&!value.private_key){const pair=await generate('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'der'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});value.private_key=pair.privateKey;value.public_key=pair.publicKey.toString('base64');value.public_key_sha256=hash(pair.publicKey);}
  if(!fs.existsSync(file)||owner&&!value.saved_owner){if(owner)value.saved_owner=true;atomicWrite(file,this.secure.encrypt(JSON.stringify(value)));}return value;
 }
 async download(meta,target){
  if(!/^[0-9a-f]{64}$/.test(meta.sha256)||!Number.isSafeInteger(meta.bytes)||meta.bytes<1||meta.bytes>32*1024*1024)throw Error('Неверные параметры резервного архива');
  if(fs.existsSync(target)){const bytes=fs.readFileSync(target);if(bytes.length===meta.bytes&&hash(bytes)===meta.sha256)return bytes;}
  const url=new URL(meta.url);if(!this.allowedOrigins.includes(url.origin)||!url.pathname.startsWith('/storage/v1/object/sign/fastgo-backups/')||url.username||url.password)throw Error('Неверный сервер резервных копий');
  const response=await this.fetcher(url.href,{redirect:'error',signal:AbortSignal.timeout(90000)});if(!response.ok)throw Error('Не удалось загрузить резервный архив');
  const chunks=[];let size=0;for await(const part of response.body){size+=part.length;if(size>meta.bytes)throw Error('Размер резервного архива не совпал');chunks.push(Buffer.from(part));}
  const bytes=Buffer.concat(chunks);if(bytes.length!==meta.bytes||hash(bytes)!==meta.sha256)throw Error('Контрольная сумма резервной копии не совпала');atomicWrite(target,bytes);return bytes;
 }
 async tick({actor,owner=false}){
  if(this.busy||!actor)return;this.busy=true;let identity,latest,aes,present=0;
  try{
   identity=await this.identity(actor,owner);const request=(action,p={})=>this.call(action,{...p,device_id:identity.device_id,device_token:identity.device_token});
   await request('register',{app:this.app,host:this.host,...(owner?{public_key:identity.public_key}:{})});
   if(owner&&!identity.scheduled){await request('initialize');identity.scheduled=true;atomicWrite(path.join(this.dir,'identity-'+hash(actor).slice(0,24)+'.bin'),this.secure.encrypt(JSON.stringify(identity)));}
   latest=await request('latest');if(owner&&(latest.pending||latest.media.length<latest.media_expected)){await request('tick');latest=await request('latest');}
   if(latest.pending){this.state={status:'server_preparing',media_present:0,media_expected:0};return;}
   if(!/^[a-f0-9-]{36}$/i.test(latest.id)||!Number.isSafeInteger(Number(latest.source_version))||!Array.isArray(latest.media)||!Array.isArray(latest.key_boxes))throw Error('Неполный ответ резервного сервера');
   const previousFile=path.join(this.dir,'latest.json'),previous=fs.existsSync(previousFile)?JSON.parse(fs.readFileSync(previousFile)):null;
   if(previous?.key_id===latest.key_id&&Number(latest.source_version)<Number(previous.source_version))throw Error('Сервер предложил более старую базу. Сохранена новая локальная копия.');
   this.state={status:'copying',created_at:latest.created_at,source_version:latest.source_version,media_present:0,media_expected:latest.media_expected};
   const bytes=await this.download(latest,path.join(this.dir,'database',latest.id+'.fgarchive'));let verified=false,restored;
   const box=latest.key_boxes.find(x=>x.device_id===identity.device_id&&x.public_key_sha256===identity.public_key_sha256&&x.key_id===latest.key_id);
   if(owner&&box){aes=crypto.privateDecrypt({key:identity.private_key,oaepHash:'sha256',padding:crypto.constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(box.wrapped_key,'base64'));const data=unpack(bytes,aes);if(data.meta.kind!=='database'||data.meta.id!==latest.id||data.meta.key_id!==latest.key_id)throw Error('Архив относится к другой резервной копии');restored=validateSnapshot(data.bytes,latest);verified=true;}
   // The key boxes make a copy recoverable on any registered owner's laptop.
   atomicWrite(path.join(this.dir,'database',latest.id+'.json'),Buffer.from(JSON.stringify({...latest,url:undefined,media:latest.media.map(x=>({...x,url:undefined}))})));
   let copied=0;for(const file of latest.media){if(!/^[0-9a-f]{64}$/.test(file.id))throw Error('Неверный файл архива');const target=path.join(this.dir,'media',file.id+'.fgarchive');let data;
    if(fs.existsSync(target)){const candidate=fs.readFileSync(target);if(candidate.length===file.bytes&&hash(candidate)===file.sha256)data=candidate;}
    if(!data){if(copied>=12)continue;const meta=await request('media',{id:file.id});data=await this.download(meta,target);copied++;}
    if(aes){const content=unpack(data,aes);if(content.meta.kind!=='media'||content.meta.id!==file.id||hash(content.bytes)!==content.meta.plain_sha256)throw Error('Не прошла проверка восстановления файла');}present++;
   }
   const complete=present===latest.media_expected,receipt={id:latest.id,key_id:latest.key_id,created_at:latest.created_at,source_version:latest.source_version,media_present:present,media_expected:latest.media_expected,verified:verified&&complete,verified_at:verified&&complete?new Date(this.now()).toISOString():null,restored};
   if(complete){atomicWrite(previousFile,Buffer.from(JSON.stringify(receipt)));atomicWrite(path.join(this.dir,'database',latest.id+'.verified.json'),Buffer.from(JSON.stringify(receipt)));}
   this.state={...receipt,status:complete?'current':'copying'};await request('receipt',{snapshot_id:latest.id,media_present:present,media_expected:latest.media_expected,verified:verified&&complete});
  }catch(error){this.state={...this.state,status:'error',error:error.message};if(identity&&latest?.id&&Number.isSafeInteger(latest.media_expected))await this.call('receipt',{device_id:identity.device_id,device_token:identity.device_token,snapshot_id:latest.id,media_present:present,media_expected:latest.media_expected,verified:false,error:error.message}).catch(()=>{});}
  finally{if(aes)aes.fill(0);this.busy=false;}
 }
}
module.exports={BackupReplica,unpack,validateSnapshot,atomicWrite};
