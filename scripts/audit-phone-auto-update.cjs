const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const pkg='ru.fastgo.mobile',dir='warehouse-android/phone/release/',out=path.resolve('browser-results/phone-public-auto-update-'+process.env.FASTGO_ANDROID_API);
const adb=(...args)=>execFileSync('adb',args,{encoding:'utf8',timeout:45000}),pause=ms=>new Promise(r=>setTimeout(r,ms)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const identity=()=>{const s=adb('shell','dumpsys','package',pkg);return {code:Number(s.match(/versionCode=(\d+)/)?.[1]),version:s.match(/versionName=([^\r\n]+)/)?.[1]?.trim(),uid:s.match(/\b(?:userId|appId)=(\d+)/)?.[1],first:s.match(/firstInstallTime=([^\r\n]+)/)?.[1]?.trim()};};
let capture=0;
async function dump(){
 for(let attempt=0;attempt<5;attempt++){
  // Package replacement temporarily leaves Android without an accessibility
  // root. Read a fresh capture, never an XML file from the previous window.
  const file='/sdcard/fastgo-public-update-'+(++capture)+'.xml';
  try{adb('shell','uiautomator','dump',file);const xml=adb('shell','cat',file);assert(xml.includes('<hierarchy'),'Empty accessibility hierarchy');return xml;}
  catch(error){fs.appendFileSync(path.join(out,'capture-retries.txt'),String(error.message)+'\n');if(attempt===4)throw error;await pause(500);}
 }
}
const compare=(a,b)=>{const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]-y[i];return 0;};
function tap(xml,text){const node=(xml.match(/<node\b[^>]*>/g)||[]).find(n=>text.test(n)&&/clickable="true"/.test(n));if(!node)return false;const b=node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);assert(b);adb('shell','input','tap',String(Math.round((+b[1]+ +b[3])/2)),String(Math.round((+b[2]+ +b[4])/2)));return true;}
(async()=>{
 assert.equal(adb('shell','getprop','ro.kernel.qemu').trim(),'1','Audit may only control an emulator');fs.mkdirSync(out,{recursive:true});
 const receipt=JSON.parse(fs.readFileSync(dir+'receipt.json'));
 const feed=await fetch('https://raw.githubusercontent.com/ivankirillov414-art/fastgo-control/main/warehouse-android/phone/update.json?t='+Date.now(),{redirect:'error'}).then(r=>{assert(r.ok);return r.json();});assert.equal(feed.versionName,receipt.version);assert.equal(feed.sha256,receipt.sha256);assert.equal(feed.package,pkg);
 const versions=fs.readdirSync(dir).map(file=>({file,version:/^FastGo-Android-(\d+\.\d+\.\d+)\.apk$/.exec(file)?.[1]})).filter(x=>x.version&&compare(x.version,feed.versionName)<0).sort((a,b)=>compare(a.version,b.version));const previous=versions.at(-1);assert(previous,'Previous signed public APK missing');
 const baseline=await fetch('https://github.com/ivankirillov414-art/fastgo-control/releases/download/fastgo-android-v'+previous.version+'/verified-receipt.json').then(r=>{assert(r.ok);return r.json();});assert.equal(baseline.package,pkg);assert.equal(baseline.version,previous.version);
 const base=dir+previous.file;assert.equal(sha(fs.readFileSync(base)),baseline.sha256);
 adb('install','-r',base);const before=identity();assert.equal(before.version,previous.version);assert(before.code<feed.versionCode&&before.uid&&before.first);
 // Isolated fresh emulator: model a user who already allowed app updates.
 // No account, real repair, stock record or manual APK install is used after this.
 adb('shell','appops','set',pkg,'REQUEST_INSTALL_PACKAGES','allow');const started=Date.now();adb('shell','am','start','-W','-n',pkg+'/.MainActivity');
 let nativeOffer=false,systemConfirmation=false,xml='',offerMs=null,accepted=false;
 for(let i=0;i<80;i++){
  if(identity().code===feed.versionCode)break;xml=await dump();fs.writeFileSync(path.join(out,'last-screen.xml'),xml);
  assert(!/harmful app|blocked by|Play Protect|install anyway/i.test(xml),'System security rejected installation; no bypass is allowed');
  if(xml.includes('Обновление FastGo')&&xml.includes(feed.versionName)){
   nativeOffer=true;offerMs??=Date.now()-started;
   if(!accepted){fs.writeFileSync(path.join(out,'automatic-offer.png'),execFileSync('adb',['exec-out','screencap','-p'],{timeout:30000}));accepted=tap(xml,/text="Обновить"/i);assert(accepted,'Automatic offer had no Update button');}
  }else if(/package="(?:com\.google\.android\.packageinstaller|com\.android\.packageinstaller|com\.google\.android\.permissioncontroller|com\.android\.permissioncontroller)"/.test(xml)&&tap(xml,/text="(?:Install|Update|Установить|Обновить)"/i))systemConfirmation=true;
  await pause(500);
 }
 const after=identity();assert(nativeOffer,'Installed old APK did not discover and download the public update automatically');assert.equal(after.code,feed.versionCode,'Update did not install through the app');assert.equal(after.version,feed.versionName);assert.equal(after.uid,before.uid);assert.equal(after.first,before.first);
 const installed=adb('shell','pm','path',pkg).trim().replace(/^package:/,''),pulled=path.join(out,'installed.apk');adb('pull',installed,pulled);assert.equal(sha(fs.readFileSync(pulled)),feed.sha256);fs.unlinkSync(pulled);
 await pause(2000);xml=await dump();const automaticRestartObserved=xml.includes('package="'+pkg+'"')&&xml.includes('Вход для сотрудников');adb('shell','am','start','-W','-n',pkg+'/.MainActivity');
 for(let i=0;i<25;i++){xml=await dump();if(xml.includes('Вход для сотрудников'))break;await pause(300);}assert(xml.includes('Вход для сотрудников'));fs.writeFileSync(path.join(out,'updated-app.png'),execFileSync('adb',['exec-out','screencap','-p'],{timeout:30000}));
 const proof={api:Number(process.env.FASTGO_ANDROID_API),from:before.version,to:after.version,sha256:feed.sha256,publicFeed:true,downloadedByInstalledApp:true,nativeAutomaticOffer:true,offerMs,appConfirmationRequired:true,systemConfirmationRequired:systemConfirmation,installSourcePermissionPreGranted:true,installedBytesMatch:true,uidRetained:true,firstInstallRetained:true,automaticRestartObserved,reopenedForVerification:true,physicalPhoneConfirmed:false};
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
})().catch(async e=>{console.error(e.message);try{fs.writeFileSync(path.join(out,'failure-screen.xml'),await dump());fs.writeFileSync(path.join(out,'failure-screen.png'),execFileSync('adb',['exec-out','screencap','-p'],{timeout:30000}));}catch{}try{fs.writeFileSync(path.join(out,'failure-logcat.txt'),adb('logcat','-d','-t','800'));}catch{}process.exitCode=1;});
