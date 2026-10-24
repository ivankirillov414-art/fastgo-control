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
 adb(['shell','am','start','-n',pkg+'/ru.fastgo.tsd.InstallUpdateActivity']);
 fs.mkdirSync('warehouse-android/native/build/upgrade-test',{recursive:true});let installed=false;
 for(let i=0;i<30;i++){
  if(/versionCode=8\b/.test(adb(['shell','dumpsys','package',pkg]))){installed=true;break;}
  adb(['shell','uiautomator','dump','/sdcard/fastgo-install.xml']);const xml=adb(['shell','cat','/sdcard/fastgo-install.xml']);
  const button=[...xml.matchAll(/<node\b[^>]*>/g)].map(m=>Object.fromEntries([...m[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(x=>[x[1],x[2]]))).find(x=>/^(install|update)$/i.test(x.text||'')&&x.enabled==='true');
  if(button){fs.writeFileSync('warehouse-android/native/build/upgrade-test/android-installer.png',adb(['exec-out','screencap','-p'],true));const bounds=[...button.bounds.matchAll(/\d+/g)].map(x=>Number(x[0]));adb(['shell','input','tap',String(Math.round((bounds[0]+bounds[2])/2)),String(Math.round((bounds[1]+bounds[3])/2))]);}
  await pause(2000);
 }
 if(!installed)throw Error('Android package installer did not install the new APK');
 const resumed=adb(['shell','dumpsys','activity','activities']);
 if(!resumed.includes(pkg+'/ru.fastgo.tsd.MainActivity'))throw Error('Updated APK did not restart its scanner activity');
 const status=adb(['shell','am','broadcast','--user','0','-f','0x20','-n',pkg+'/ru.fastgo.tsd.ProvisionReceiver','--es','operation','status']);
 if(!/update_installed_at[^\d]+\d+/.test(status))throw Error('Replacement APK did not record successful installation');
 const result=adb(['shell','am','instrument','-w','-e','class','ru.fastgo.tsd.UpgradeTest#keepsDataAfterInstall',pkg+'.test/androidx.test.runner.AndroidJUnitRunner']);
 if(!/OK \(1 test\)/.test(result))throw Error('Post-update retention check failed: '+result);
 fs.writeFileSync('warehouse-android/native/build/upgrade-test/receipt.json',JSON.stringify({package:pkg,installed_version_code:8,document_gate:true,hash_and_signature:true,android_installer:true,restarted_activity:true,sqlite_retained:true,encrypted_value_retained:true},null,2));
 console.log('PASS: document gate, APK download/hash/signature, Android installer, new version and retained SQLite/encrypted credentials');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
