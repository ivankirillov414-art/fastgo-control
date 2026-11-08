const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict'),{execFileSync}=require('child_process');
const pkg='ru.fastgo.tsd.app',base='warehouse/native/FastGo-TSD-2.1.9.apk',candidate='warehouse/native/FastGo-TSD-2.1.10.apk',test='warehouse-android/native/release/FastGo-TSD-2.1.10-upgrade-tests.apk',out='warehouse-android/native/build/bootstrap-test/';
const adb=(...args)=>execFileSync('adb',['-e',...args],{encoding:'utf8',timeout:45000,maxBuffer:10000000});
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),passed=t=>/OK \(1 test\)/.test(t)&&!/FAILURES|INSTRUMENTATION_FAILED|Process crashed|UpgradeTest:I/.test(t);
const identity=()=>{const s=adb('shell','dumpsys','package',pkg);return{uid:s.match(/\b(?:userId|appId)=(\d+)/)?.[1],first:s.match(/firstInstallTime=([^\r\n]+)/)?.[1]?.trim(),code:Number(s.match(/versionCode=(\d+)/)?.[1])};};
try{
 assert.equal(adb('shell','getprop','ro.kernel.qemu').trim(),'1');fs.mkdirSync(out,{recursive:true});
 // The real production updater must not replace our isolated fixture manifest
 // with today's live channel before the candidate has been published.
 adb('shell','svc','wifi','disable');adb('shell','svc','data','disable');
 adb('install','-r',base);const before=identity();assert.equal(before.code,12);
 adb('install','-r','-t',test);
 const stage=adb('shell','am','instrument','-w','-e','class','ru.fastgo.tsd.UpgradeTest#stagesRealSignedApkOnlyAfterDocumentsClose',pkg+'.test/androidx.test.runner.AndroidJUnitRunner');assert(passed(stage),stage);
 // Explicit one-time bootstrap, not evidence that immutable2.1.9's updater works.
 adb('install','-r',candidate);const after=identity();assert.equal(after.code,13);assert.equal(after.uid,before.uid);assert.equal(after.first,before.first);
 const keep=adb('shell','am','instrument','-w','-e','class','ru.fastgo.tsd.UpgradeTest#keepsDataAfterInstall',pkg+'.test/androidx.test.runner.AndroidJUnitRunner');assert(passed(keep),keep);
 const installed=adb('shell','pm','path',pkg).trim().replace(/^package:/,'');adb('pull',installed,out+'installed.apk');assert.equal(hash(out+'installed.apk'),hash(candidate));fs.unlinkSync(out+'installed.apk');
 fs.writeFileSync(out+'receipt.json',JSON.stringify({api:Number(process.env.FASTGO_ANDROID_API),package:pkg,from_code:12,to_code:13,sha256:hash(candidate),exact_signed_candidate:true,bootstrap_mode:'explicit adb install -r; immutable2.1.9 self-installer is not claimed to pass',android_uid_preserved:true,first_install_time_preserved:true,sqlite_retained:true,encrypted_value_retained:true,document_gate:true,installed_bytes_match:true,fixture_network_isolated:true},null,2));
 console.log('PASS: explicit signed bootstrap12->13 retains UID, first install, SQLite and Keystore data; installed APK bytes exact');
}catch(error){console.error(error);process.exitCode=1;}
