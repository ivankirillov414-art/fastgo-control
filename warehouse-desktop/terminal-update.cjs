const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const run=promisify(execFile);
const REPO='ivankirillov414-art/fastgo-control', PACKAGE='ru.fastgo.terminal.test';
function parseDevices(text){return text.split(/\r?\n/).map(line=>line.trim().split(/\s+/)).filter(p=>p.length>=2&&!p[0].startsWith('*')&&['device','unauthorized','offline'].includes(p[1])).map(p=>({serial:p[0],state:p[1],model:(p.find(s=>s.startsWith('model:'))||'').slice(6)}));}
function apkAsset(releases){for(const r of releases.filter(r=>!r.draft&&!r.prerelease&&/^fastgo-warehouse-v\d+\.\d+\.\d+$/.test(r.tag_name)).sort((a,b)=>b.tag_name.localeCompare(a.tag_name,undefined,{numeric:true}))){const a=r.assets?.find(a=>/^FastGo-Terminal-[\d.]+-test\.apk$/.test(a.name));if(a&&/^sha256:[a-f0-9]{64}$/.test(a.digest||''))return{...a,version:a.name.match(/^FastGo-Terminal-([\d.]+)-test\.apk$/)[1]};}throw Error('Нет опубликованного APK с контрольной суммой.');}
class TerminalUpdate{
 constructor({adb,dir,exec=run,fetcher=fetch}){Object.assign(this,{adb,dir,exec,fetcher});this.busy=false;}
 async command(args,timeout=15000){try{return (await this.exec(this.adb,args,{timeout,windowsHide:true,maxBuffer:1024*1024})).stdout;}catch(e){throw Error(String(e.stdout||e.stderr||e.message).includes('INSTALL_FAILED_UPDATE_INCOMPATIBLE')?'Подпись APK отличается. Обновление остановлено, данные сохранены. Нужна сборка с прежней подписью.':String(e.stderr||e.stdout||e.message).slice(0,800));}}
 async devices(){return parseDevices(await this.command(['devices','-l']));}
 async installNative(serial,automatic=false){
  if(this.busy)throw Error('Установка уже выполняется.');this.busy=true;
  try{
   if(!(await this.devices()).some(d=>d.serial===serial&&d.state==='device'))throw Error('Терминал не подключён или не подтверждена USB-отладка.');
   const request=async url=>{const r=await this.fetcher(url,{signal:AbortSignal.timeout(90000)});if(!r.ok)throw Error('Ошибка загрузки: '+r.status);return r;};
   const meta=await(await request('https://raw.githubusercontent.com/'+REPO+'/main/warehouse/native-update.json')).json();
   if(meta.package!=='ru.fastgo.tsd'||!Number.isInteger(meta.versionCode)||meta.versionCode<1||!/^\d+\.\d+\.\d+$/.test(meta.versionName)||!/^([a-f0-9]{64})$/.test(meta.sha256)||!meta.url.startsWith('https://raw.githubusercontent.com/'+REPO+'/main/warehouse/native/')||!meta.url.endsWith('.apk'))throw Error('Недопустимый канал FastGo ТСД.');
   if(automatic){const installed=await this.command(['-s',serial,'shell','dumpsys','package',meta.package]);if(Number(installed.match(/versionCode=(\d+)/)?.[1])>=meta.versionCode)return 'Установлена актуальная версия '+meta.versionName;}
   const data=Buffer.from(await(await request(meta.url)).arrayBuffer());
   if(data.length>20*1024*1024||crypto.createHash('sha256').update(data).digest('hex')!==meta.sha256)throw Error('Контрольная сумма APK не совпала. Установка отменена.');
   await fs.mkdir(this.dir,{recursive:true});const file=path.join(this.dir,'native-terminal.apk');await fs.writeFile(file,data);
   const output=await this.command(['-s',serial,'install','-r',file],120000);if(!/\bSuccess\b/.test(output))throw Error('Android не подтвердил установку: '+output);
   const details=await this.command(['-s',serial,'shell','dumpsys','package',meta.package]);
   if(details.match(/versionName=([^\s]+)/)?.[1]!==meta.versionName||Number(details.match(/versionCode=(\d+)/)?.[1])!==meta.versionCode)throw Error('Версия FastGo ТСД не подтверждена. Старое приложение сохранено.');
   if(automatic)await this.command(['-s',serial,'shell','am','start','-n','ru.fastgo.tsd/.MainActivity']);
   return 'Установлен FastGo ТСД '+meta.versionName+'. Откройте новое приложение «FastGo ТСД». Старая оболочка и её документы сохранены; незавершённые документы завершайте в ней.';
  }finally{this.busy=false;}
 }

 async install(serial){if(this.busy)throw Error('Установка уже выполняется.');this.busy=true;try{
 if(!(await this.devices()).some(d=>d.serial===serial&&d.state==='device'))throw Error('Терминал не подключён или не подтверждена USB-отладка.');
 const request=async url=>{const r=await this.fetcher(url,{headers:{'User-Agent':'FastGo-Warehouse'},signal:AbortSignal.timeout(90000)});if(!r.ok)throw Error('Ошибка загрузки: '+r.status);return r;};
 const asset=apkAsset(await(await request('https://api.github.com/repos/'+REPO+'/releases?per_page=30')).json());
 if(!asset.browser_download_url.startsWith('https://github.com/'+REPO+'/releases/download/'))throw Error('Недопустимый источник APK.');
 const data=Buffer.from(await(await request(asset.browser_download_url)).arrayBuffer());
 if(data.length>100*1024*1024||'sha256:'+crypto.createHash('sha256').update(data).digest('hex')!==asset.digest)throw Error('Контрольная сумма APK не совпала. Установка отменена.');
 await fs.mkdir(this.dir,{recursive:true});const file=path.join(this.dir,'terminal.apk');await fs.writeFile(file,data);
 const output=await this.command(['-s',serial,'install','-r',file],120000);if(!/\bSuccess\b/.test(output))throw Error('Android не подтвердил установку: '+output);
 const details=await this.command(['-s',serial,'shell','dumpsys','package',PACKAGE]);const version=details.match(/versionName=([^\s]+)/)?.[1];
 if(version!==asset.version)throw Error('Установка завершилась, но версия не подтверждена: '+(version||'нет данных'));
 return 'На терминале подтверждена версия '+version+'. Откройте FastGo Терминал на устройстве.';
 }finally{this.busy=false;}}
}
module.exports={TerminalUpdate,parseDevices,apkAsset};
