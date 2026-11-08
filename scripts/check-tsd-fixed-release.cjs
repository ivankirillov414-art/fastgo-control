const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto'),{execFileSync}=require('child_process');
const run=(file,args)=>execFileSync(file,args,{stdio:'inherit',timeout:240000});
try{
 run(process.execPath,['scripts/check-tsd-bootstrap-retention.cjs']);
 const proof=JSON.parse(fs.readFileSync('warehouse-android/native/build/bootstrap-test/receipt.json'));
 const expected=crypto.createHash('sha256').update(fs.readFileSync('warehouse/native/FastGo-TSD-2.1.10.apk')).digest('hex');
 assert.equal(proof.sha256,expected);assert.equal(proof.to_code,13);for(const key of ['installed_bytes_match','android_uid_preserved','first_install_time_preserved','sqlite_retained','encrypted_value_retained'])assert.equal(proof[key],true);
 assert.equal(execFileSync('adb',['-e','shell','getprop','ro.kernel.qemu'],{encoding:'utf8'}).trim(),'1');
 console.log('Bootstrap PASS recorded externally. Start independent own-update fixture: emulator-only app-data reset; no physical devices.');
 run('adb',['-e','shell','pm','clear','ru.fastgo.tsd.app']);
 run(process.execPath,['scripts/check-native-apk-install.cjs']);
}catch(error){console.error(error.message);process.exitCode=1;}
