const {execFileSync}=require('node:child_process'),fs=require('node:fs');
const pkg='ru.fastgo.tsd.app',adb=(args,binary=false)=>execFileSync('adb',['-e',...args],{encoding:binary?undefined:'utf8',timeout:30000,maxBuffer:10000000});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 // Gradle's connected-test runner removes its installed packages after completing.
 // Install the same tested baseline and re-stage the fixture for a persistent host-driven upgrade.
 adb(['install','-r','warehouse-android/native/build/outputs/apk/debug/native-debug.apk']);
 adb(['install','-r','warehouse-android/native/build/outputs/apk/androidTest/debug/native-debug-androidTest.apk']);
 const staged=adb(['shell','am','instrument','-w','-e','class','ru.fastgo.tsd.UpgradeTest#stagesRealSignedApkOnlyAfterDocumentsClose',pkg+'.test/androidx.test.runner.AndroidJUnitRunner']);
 if(!/OK \(1 test\)/.test(staged))throw Error('APK staging and document gate failed: '+staged);
 adb(['shell','appops','set',pkg,'REQUEST_INSTALL_PACKAGES','allow']);
 adb(['shell','input','keyevent','224']);
 adb(['shell','wm','dismiss-keyguard']);
 adb(['shell','am','start','-n',pkg+'/ru.fastgo.tsd.InstallUpdateActivity']);
 fs.mkdirSync('warehouse-android/native/build/upgrade-test',{recursive:true});let installed=false;
 for(let i=0;i<30;i++){
  if(/versionCode=12\b/.test(adb(['shell','dumpsys','package',pkg]))){installed=true;break;}
  // Android 10 briefly has no accessibility root while Package Installer takes focus.
  // Retry the observation; installation remains verified by PackageManager below.
  let xml;try{adb(['shell','uiautomator','dump','/sdcard/fastgo-install.xml']);xml=adb(['shell','cat','/sdcard/fastgo-install.xml']);}catch{await pause(1000);continue;}
  const button=[...xml.matchAll(/<node\b[^>]*>/g)].map(m=>Object.fromEntries([...m[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(x=>[x[1],x[2]]))).find(x=>/^(install|update)$/i.test(x.text||'')&&x.enabled==='true');
  if(button){fs.writeFileSync('warehouse-android/native/build/upgrade-test/android-installer.png',adb(['exec-out','screencap','-p'],true));const bounds=[...button.bounds.matchAll(/\d+/g)].map(x=>Number(x[0]));adb(['shell','input','tap',String(Math.round((bounds[0]+bounds[2])/2)),String(Math.round((bounds[1]+bounds[3])/2))]);}
  await pause(2000);
 }
 if(!installed)throw Error('Android package installer did not install the new APK');
 let resumed='',restartMode='automatic';for(let n=0;n<10;n++){resumed=adb(['shell','dumpsys','activity','activities']);if(resumed.includes(pkg+'/ru.fastgo.tsd.MainActivity'))break;await pause(1000);}
 if(!resumed.includes(pkg+'/ru.fastgo.tsd.MainActivity')){
  // Android 10 can block starts from MY_PACKAGE_REPLACED. Exercise the actual
  // user-facing notification return path, rather than granting a background
  // launch exemption or starting the scanner with an adb command.
  restartMode='notification';adb(['shell','cmd','statusbar','expand-notifications']);await pause(1000);
  let opened=false;
  for(let n=0;n<5&&!opened;n++){
   try{
    adb(['shell','uiautomator','dump','/sdcard/fastgo-reopen.xml']);const xml=adb(['shell','cat','/sdcard/fastgo-reopen.xml']);
    const notification=[...xml.matchAll(/<node\b[^>]*>/g)].map(m=>Object.fromEntries([...m[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(x=>[x[1],x[2]]))).find(x=>(x.text||'').includes('FastGo обновлён'));
    if(notification){fs.writeFileSync('warehouse-android/native/build/upgrade-test/update-notification.png',adb(['exec-out','screencap','-p'],true));const bounds=[...notification.bounds.matchAll(/\d+/g)].map(x=>Number(x[0]));adb(['shell','input','tap',String(Math.round((bounds[0]+bounds[2])/2)),String(Math.round((bounds[1]+bounds[3])/2))]);opened=true;}
   }catch{}
   await pause(1000);
  }
  for(let n=0;n<10;n++){resumed=adb(['shell','dumpsys','activity','activities']);if(resumed.includes(pkg+'/ru.fastgo.tsd.MainActivity'))break;await pause(1000);}
 }
 if(!resumed.includes(pkg+'/ru.fastgo.tsd.MainActivity')){
  fs.writeFileSync('warehouse-android/native/build/upgrade-test/after-install-activities.txt',resumed);
  const logs=adb(['logcat','-d','-t','600']);fs.writeFileSync('warehouse-android/native/build/upgrade-test/after-install-logcat.txt',logs);
  console.error(resumed.split('\n').filter(line=>/Resumed|focused|fastgo|InstallResult/i.test(line)).join('\n'));
  console.error(logs.split('\n').filter(line=>/fastgo|FATAL EXCEPTION|Background activity|ActivityNotFound|Permission Denial/i.test(line)).join('\n'));
  throw Error('Updated APK could not reopen its scanner through the update notification');
 }
 const status=adb(['shell','am','broadcast','--user','0','-f','0x20','-n',pkg+'/ru.fastgo.tsd.ProvisionReceiver','--es','operation','status']);
 if(!/update_installed_at[^\d]+\d+/.test(status))throw Error('Replacement APK did not record successful installation');
 const result=adb(['shell','am','instrument','-w','-e','class','ru.fastgo.tsd.UpgradeTest#keepsDataAfterInstall',pkg+'.test/androidx.test.runner.AndroidJUnitRunner']);
 if(!/OK \(1 test\)/.test(result))throw Error('Post-update retention check failed: '+result);
 fs.writeFileSync('warehouse-android/native/build/upgrade-test/receipt.json',JSON.stringify({package:pkg,installed_version_code:9,document_gate:true,hash_and_signature:true,android_installer:true,restarted_activity:true,restart_mode:restartMode,sqlite_retained:true,encrypted_value_retained:true},null,2));
 console.log('PASS: document gate, APK download/hash/signature, Android installer, return via '+restartMode+', new version and retained SQLite/encrypted credentials');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
