const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const dir=path.resolve('warehouse-android/phone/release'),receipt=JSON.parse(fs.readFileSync(path.join(dir,'receipt.json'),'utf8')),apk=path.join(dir,receipt.file),out=path.resolve('browser-results/android-phone-'+process.env.FASTGO_ANDROID_API);
fs.mkdirSync(out,{recursive:true});const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');assert.equal(sha(apk),receipt.sha256);
const adb=(...args)=>execFileSync('adb',args,{encoding:'utf8',timeout:45000}),pause=ms=>new Promise(r=>setTimeout(r,ms));
async function dump(){adb('shell','uiautomator','dump','/sdcard/fastgo-phone.xml');return adb('shell','cat','/sdcard/fastgo-phone.xml');}
async function loginReady(){let xml='';for(let i=0;i<30;i++){xml=await dump();if(xml.includes('Вход для сотрудников'))return xml;await pause(500);}throw Error('Installed APK login did not finish rendering');}
(async()=>{
 const previous=path.join(dir,'FastGo-Android-1.0.1.apk');
 const packageInfo=()=>{const raw=adb('shell','dumpsys','package','ru.fastgo.mobile');const identity={uid:raw.match(/\b(?:userId|appId)=(\d+)/)?.[1],first:raw.match(/firstInstallTime=([^\r\n]+)/)?.[1]?.trim(),version:raw.match(/versionName=([^\r\n]+)/)?.[1]?.trim()};console.log('Android package identity: '+JSON.stringify(identity));return identity;};
 adb('install','-r',previous);const before=packageInfo();assert(before.uid&&before.first,'Previous Android package identity missing');
 let intermediateVersion=null;const channel=JSON.parse(fs.readFileSync('warehouse-android/phone/update.json','utf8'));
 if(channel.package==='ru.fastgo.mobile'&&channel.versionName!==receipt.version){const file=path.basename(new URL(channel.url).pathname);assert(/^FastGo-Android-[0-9]+\.[0-9]+\.[0-9]+\.apk$/.test(file),'Unexpected production APK path');const intermediate=path.join(dir,file);assert.equal(sha(intermediate),channel.sha256,'Production APK differs from its channel');adb('install','-r',intermediate);const middle=packageInfo();assert.equal(middle.uid,before.uid,'Production update must preserve UID');assert.equal(middle.first,before.first,'Production update must preserve first install');intermediateVersion=channel.versionName;}
 adb('install','-r',apk);const after=packageInfo();assert.equal(after.uid,before.uid,'Update must retain Android application UID');assert.equal(after.first,before.first,'Update must retain original installation');assert.equal(after.version,receipt.version,'Installed Android version differs from signed receipt');adb('shell','am','force-stop','ru.fastgo.mobile');adb('shell','am','start','-W','-n','ru.fastgo.mobile/.MainActivity');
 let xml=await loginReady();
 const node=(xml.match(/<node\b[^>]*class="android.widget.EditText"[^>]*>/g)||[])[0];assert(node,'editable email field missing');const b=node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);assert(b,'email bounds missing');
 adb('shell','input','tap',String(Math.round((Number(b[1])+Number(b[3]))/2)),String(Math.round((Number(b[2])+Number(b[4]))/2)));adb('shell','input','text','releaseprobe');await pause(500);xml=await dump();assert(xml.includes('releaseprobe'),'typing into final installed APK failed');
 fs.writeFileSync(path.join(out,'installed-keyboard.png'),execFileSync('adb',['exec-out','screencap','-p'],{timeout:30000}));
 adb('shell','input','keyevent','KEYCODE_BACK');adb('shell','settings','put','system','accelerometer_rotation','0');adb('shell','settings','put','system','user_rotation','1');await pause(700);xml=await dump();assert(xml.includes('Вход для сотрудников'),'rotation lost screen');adb('shell','settings','put','system','user_rotation','0');
 adb('shell','am','force-stop','ru.fastgo.mobile');adb('shell','am','start','-W','-n','ru.fastgo.mobile/.MainActivity');xml=await loginReady();assert(xml.includes('Вход для сотрудников'),'restart failed');
 const installed=adb('shell','pm','path','ru.fastgo.mobile').trim().replace(/^package:/,'');const pulled=path.join(out,'installed.apk');adb('pull',installed,pulled);assert.equal(sha(pulled),receipt.sha256,'installed bytes differ from download');fs.unlinkSync(pulled);
 fs.writeFileSync(path.join(out,'installed-login.png'),execFileSync('adb',['exec-out','screencap','-p'],{timeout:30000}));fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({api:process.env.FASTGO_ANDROID_API,sha256:receipt.sha256,package:'ru.fastgo.mobile',install:true,in_place_upgrade_from:'1.0.1',intermediateVersion,android_uid_preserved:true,first_install_time_preserved:true,login:true,typing:true,rotation:true,restart:true,installed_bytes_match:true},null,2));console.log('PASS: exact signed APK in-place upgrade, login, typing, rotation, restart and installed hash');
})().catch(async e=>{
 console.error(e);
 // Preserve the actual failing emulator state; a timeout is not proof of an app bug
 // or an infrastructure failure. Never retry installation or relax the assertion here.
 try{fs.writeFileSync(path.join(out,'failure-screen.xml'),await dump());}catch{}
 try{fs.writeFileSync(path.join(out,'failure-screen.png'),execFileSync('adb',['exec-out','screencap','-p'],{timeout:30000}));}catch{}
 for(const [file,args]of [['failure-logcat.txt',['logcat','-d','-t','500']],['failure-activity.txt',['shell','dumpsys','activity','top']]]){
  try{fs.writeFileSync(path.join(out,file),execFileSync('adb',args,{timeout:30000}));}catch{}
 }
 process.exitCode=1;
});
