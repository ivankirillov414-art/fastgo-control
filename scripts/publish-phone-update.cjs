const fs=require('node:fs'),crypto=require('node:crypto');
function nextFeed(current,receipt,gradle,bytes){
 const code=Number(gradle.match(/versionCode\s+(\d+)/)?.[1]),version=gradle.match(/versionName\s+'([^']+)'/)?.[1];
 if(!code||version!==receipt.version||receipt.package!=='ru.fastgo.mobile'||receipt.release_device_tests!=='passed: exact signed APK on Android 10 and 15 emulators'||!receipt.signature_verified)throw Error('Phone release is not verified');
 if(receipt.file!==`FastGo-Android-${version}.apk`||crypto.createHash('sha256').update(bytes).digest('hex')!==receipt.sha256)throw Error('Phone release bytes do not match');
 if(current.versionCode>code)return null;
 if(current.versionCode===code&&current.sha256!==receipt.sha256)throw Error('Published Android version already has different bytes');
 return {package:receipt.package,versionCode:code,versionName:version,url:`https://raw.githubusercontent.com/ivankirillov414-art/fastgo-control/main/warehouse-android/phone/release/${receipt.file}`,sha256:receipt.sha256};
}
module.exports={nextFeed};
if(require.main===module)(async()=>{
 const dir='warehouse-android/phone/',receipt=JSON.parse(fs.readFileSync(dir+'release/verified-receipt.json'));
 const endpoint=`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/contents/${dir}update.json`;
 const headers={Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
 for(let attempt=0;attempt<3;attempt++){
  const response=await fetch(endpoint+'?ref=main',{headers});if(!response.ok)throw Error('Cannot read phone update channel: '+response.status);
  const file=await response.json(),current=JSON.parse(Buffer.from(file.content,'base64').toString());
  const next=nextFeed(current,receipt,fs.readFileSync(dir+'build.gradle','utf8'),fs.readFileSync(dir+'release/'+receipt.file));
  if(!next){console.log('A newer Android update is already published');return;}
  if(JSON.stringify(current)===JSON.stringify(next)){console.log('Android update channel is current');return;}
  const put=await fetch(endpoint,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({message:'Publish verified Android phone update '+next.versionName,branch:'main',sha:file.sha,content:Buffer.from(JSON.stringify(next,null,2)+'\n').toString('base64')})});
  if(put.ok){console.log('Published verified Android channel '+next.versionName);return;}if(put.status!==409)throw Error('Cannot publish phone update channel: '+put.status);
 }
 throw Error('Phone channel changed concurrently; retry publication');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
