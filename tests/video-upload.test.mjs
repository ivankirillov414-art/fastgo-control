import test from 'node:test';
import assert from 'node:assert/strict';
import {uploadOrderFiles} from '../workshop/photo-upload.js';
globalThis.FileReader=class {readAsDataURL(file){this.result='data:'+file.type+';base64,dGVzdA==';this.onload();}};
test('mobile videos bypass image compression, infer MOV MIME and resume without duplicates',async()=>{
 for(const [name,type,mime] of [['a.mp4','video/mp4','video/mp4'],['a.MOV','','video/quicktime'],['a.webm','video/webm','video/webm']]){
  const file={name,type,size:4};let calls=0;
  const api=async(action,p)=>{calls++;assert.equal(action,'upload');assert.equal(p.content_type,mime);return {path:'native:video'};};
  await uploadOrderFiles(api,'repair','id',[file],'photos');await uploadOrderFiles(api,'repair','id',[file],'photos');assert.equal(calls,1);
 }
});
test('oversized videos and videos in signed documents fail before API write',async()=>{
 const api=()=>{throw Error('Must not upload');};
 await assert.rejects(uploadOrderFiles(api,'repair','id',[{name:'big.mp4',type:'video/mp4',size:11*1024*1024}],'photos'),/10 МБ/);
 await assert.rejects(uploadOrderFiles(api,'repair','id',[{name:'a.mov',type:'video/quicktime',size:4}],'signed'),/PDF/);
});
