import test from 'node:test';
import assert from 'node:assert/strict';
import {createSaleCamera} from '../workshop/sale-camera.js';
test('camera chooses rear lens, accepts one scan and stops tracks',async()=>{
 let callback,stops=0,tracks=0;const codes=[],video={srcObject:null};
 class Reader{async decodeFromConstraints(constraints,element,cb){assert.equal(constraints.video.facingMode.ideal,'environment');assert.equal(element,video);callback=cb;video.srcObject={getTracks:()=>[{stop:()=>tracks++}]};return {stop:()=>stops++};}}
 const c=createSaleCamera({video,loadReader:async()=>Reader,onCode:code=>codes.push(code),onStatus:()=>{}});
 await c.start();callback({getText:()=> 'FGP-00000001'});callback({getText:()=> 'FGP-00000001'});
 assert.deepEqual(codes,['FGP-00000001']);assert.equal(stops,1);assert.equal(tracks,1);assert.equal(video.srcObject,null);
});
test('closing while reader loads never asks for camera',async()=>{
 let finish,calls=0;class Reader{async decodeFromConstraints(){calls++;}}
 const c=createSaleCamera({video:{srcObject:null},loadReader:()=>new Promise(r=>finish=r),onCode:()=>assert.fail('late scan'),onStatus:()=>{}});
 const starting=c.start();c.stop();finish(Reader);await starting;assert.equal(calls,0);
});
test('closing during camera permission stops the late session and ignores callbacks',async()=>{
 let finish,callback,stops=0;class Reader{decodeFromConstraints(_,__,cb){callback=cb;return new Promise(r=>finish=r);}}
 const c=createSaleCamera({video:{srcObject:null},loadReader:async()=>Reader,onCode:()=>assert.fail('late scan'),onStatus:()=>{}});
 const starting=c.start();await Promise.resolve();c.stop();callback({getText:()=> 'late'});finish({stop:()=>stops++});await starting;assert.equal(stops,1);
});
test('denied camera leaves manual search available and allows retry',async()=>{
 let attempts=0;const statuses=[];class Reader{async decodeFromConstraints(){attempts++;throw Object.assign(Error('denied'),{name:'NotAllowedError'});}}
 const c=createSaleCamera({video:{srcObject:null},loadReader:async()=>Reader,onCode:()=>{},onStatus:s=>statuses.push(s)});
 await c.start();await c.start();assert.equal(attempts,2);assert.match(statuses.at(-1),/поиском/);
});
