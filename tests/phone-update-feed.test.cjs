const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{nextFeed}=require('../scripts/publish-phone-update.cjs');
test('only verified exact phone APK bytes can advance the channel; old jobs cannot downgrade it',()=>{
 const bytes=Buffer.from('signed fixture'),sha256=crypto.createHash('sha256').update(bytes).digest('hex'),receipt={package:'ru.fastgo.mobile',file:'FastGo-Android-1.0.5.apk',version:'1.0.5',sha256,signature_verified:true,release_device_tests:'passed: exact signed APK on Android 10 and 15 emulators'},gradle="versionCode 6; versionName '1.0.5'";
 const next=nextFeed({versionCode:0},receipt,gradle,bytes);assert.equal(next.versionCode,6);assert.equal(next.sha256,sha256);assert.equal(nextFeed({versionCode:7},receipt,gradle,bytes),null);
 assert.throws(()=>nextFeed({versionCode:6,sha256:'other'},receipt,gradle,bytes));assert.throws(()=>nextFeed({},receipt,gradle,Buffer.from('corrupt')));assert.throws(()=>nextFeed({},{...receipt,release_device_tests:'pending'},gradle,bytes));
});
