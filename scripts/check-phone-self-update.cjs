const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const pkg='ru.fastgo.mobile.test',out=path.resolve('browser-results/android-phone-'+process.env.FASTGO_ANDROID_API+'/self-update');
const adb=(...args)=>execFileSync('adb',args,{encoding:'utf8',timeout:45000}),pause=ms=>new Promise(r=>setTimeout(r,ms));
const version=()=>Number(adb('shell','dumpsys','package',pkg).match(/versionCode=(\d+)/)?.[1]);
async function dump(){adb('shell','uiautomator','dump','/sdcard/fastgo-self-update.xml');return adb('shell','cat','/sdcard/fastgo-self-update.xml');}
(async()=>{
 assert.equal(adb('shell','getprop','ro.kernel.qemu').trim(),'1','Self-update fixture may only run on an emulator');
 const apk=process.env.FASTGO_SELFUPDATE_APK;assert(apk&&fs.existsSync(apk),'Debug base APK missing');fs.mkdirSync(out,{recursive:true});
 adb('install','-r',apk);const before=version();assert(before>0,'Base version missing');
 // This grants the test app the same install-source permission a user may grant in Android settings.
 adb('shell','appops','set',pkg,'REQUEST_INSTALL_PACKAGES','allow');
 adb('shell','am','start','-W','-n',pkg+'/ru.fastgo.mobile.UpdateProbeActivity');
 let confirmation=false,xml='';
 for(let i=0;i<45;i++){
  if(version()===before+1)break;
  xml=await dump();fs.writeFileSync(path.join(out,'last-screen.xml'),xml);
  assert(!/SELF UPDATE FAILED|harmful app|blocked by|Play Protect|install anyway/i.test(xml),'Native updater or security verification reported an error: '+xml);
  const button=(xml.match(/<node\b[^>]*>/g)||[]).find(x=>/text="(?:Install|Update|Установить|Обновить)"/i.test(x)&&/clickable="true"/.test(x));
  if(button){const b=button.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);assert(b,'Installer button has no bounds');adb('shell','input','tap',String(Math.round((Number(b[1])+Number(b[3]))/2)),String(Math.round((Number(b[2])+Number(b[4]))/2)));confirmation=true;}
  await pause(500);
 }
 assert.equal(version(),before+1,'The app did not install the next version through its own PackageInstaller session');
 assert.equal(adb('shell','run-as',pkg,'cat','files/phone-upgrade-proof.txt').trim(),'retained-before-self-update','Self-update lost app data');
 let callback=false,completionSource='';
 for(let i=0;i<20;i++){
  const prefs=adb('shell','run-as',pkg,'cat','shared_prefs/phone-updates.xml');
  if(!/name="session"/.test(prefs)){callback=true;completionSource=prefs.match(/name="install_completion_source">([^<]+)/)?.[1]||'';break;}await pause(500);
 }
 assert(callback,'Android installation result did not reach the app callback');assert(['package_replaced','installer_result'].includes(completionSource),'No authoritative system completion source recorded');
 adb('shell','am','start','-W','-n',pkg+'/ru.fastgo.mobile.MainActivity');
 for(let i=0;i<30;i++){xml=await dump();if(xml.includes('Вход для сотрудников'))break;await pause(300);}
 assert(xml.includes('Вход для сотрудников'),'Self-updated app did not reopen');
 fs.writeFileSync(path.join(out,'installed.png'),execFileSync('adb',['exec-out','screencap','-p'],{timeout:30000}));
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({api:process.env.FASTGO_ANDROID_API,package:pkg,from:before,to:before+1,installedByOwnPackageInstaller:true,dataRetained:true,callbackReceived:true,completionSource,reopened:true,systemConfirmationRequired:confirmation,scope:'Emulator self-update. This does not prove a Play Protect or OEM verdict on a user device.'},null,2));
 console.log('PASS: native self-update, retained data, installation callback and restart; system confirmation='+confirmation);
})().catch(async e=>{
 console.error(e);
 try{fs.writeFileSync(path.join(out,'failure-screen.xml'),await dump());}catch{}
 try{fs.writeFileSync(path.join(out,'failure-screen.png'),execFileSync('adb',['exec-out','screencap','-p'],{timeout:30000}));}catch{}
 for(const [file,args]of [['failure-logcat.txt',['logcat','-d','-t','1000']],['failure-activity.txt',['shell','dumpsys','activity','top']]]){try{fs.writeFileSync(path.join(out,file),execFileSync('adb',args,{timeout:30000}));}catch{}}
 process.exitCode=1;
});
