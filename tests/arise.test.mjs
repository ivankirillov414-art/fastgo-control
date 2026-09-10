import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {QUESTS,FUSION,ENGLISH} from '../arise/curriculum.mjs';
import {getDevice,DEVICE_KEY,levelFor,cleanProgress,available,escapeHTML,validateFile,request} from '../arise/core.mjs';
import {stlDimensions,geometryMatches,aggregateQuest,bytesBase64,localClock,evaluateFile} from '../supabase/arise-functions/_shared/evidence.mjs';
import {createHandler} from '../supabase/arise-functions/_shared/server.mjs';

const KEY='test-device-0123456789';
const env={get:name=>({SUPABASE_URL:'https://database.example',SUPABASE_SERVICE_ROLE_KEY:'test-server-key'})[name]};
const storage=initial=>{const m=new Map(Object.entries(initial));return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};};
test('canonical identity is preserved across sessions',()=>{const s=storage({[DEVICE_KEY]:KEY});assert.equal(getDevice(s,()=>{throw Error('must not generate');}),KEY);});
test('legacy device key migrates without replacing it',()=>{const s=storage({personal_rpg_device_id:KEY});assert.equal(getDevice(s),KEY);assert.equal(s.getItem(DEVICE_KEY),KEY);});
test('new devices have their own generated identity, never a shared fallback',()=>{const s=storage({});assert.equal(getDevice(s,()=>KEY),KEY);});
test('curriculum has stable Fusion ids and noncolliding English ids',()=>{assert.equal(FUSION.length,37);assert.equal(ENGLISH.length,15);assert.deepEqual(QUESTS.map(x=>x.id),Array.from({length:52},(_,i)=>i));assert.equal(FUSION[2].xp,60);});
test('level curve preserves 500 + 250 progression and caps at 150',()=>{assert.equal(levelFor(0).level,1);assert.equal(levelFor(500).level,2);assert.equal(levelFor(1249).level,2);assert.equal(levelFor(1250).level,3);assert.equal(levelFor(1e12).level,150);assert.equal(levelFor(-3).remaining,0);});
test('English unlocks independently, future nodes stay locked',()=>{assert.equal(available(ENGLISH[0],QUESTS,[]),true);assert.equal(available(ENGLISH[1],QUESTS,[0,1]),false);assert.equal(available(ENGLISH[1],QUESTS,[37]),true);assert.equal(available(FUSION[3],QUESTS,[2]),false);});
test('server progress is validated and duplicate quest ids are removed',()=>{assert.deepEqual(cleanProgress({xp:90,completed_quests:[0,0,1,-1,'1']}),{xp:90,completed_quests:[0,1],updated_at:null});assert.throws(()=>cleanProgress({xp:'bad',completed_quests:[]}));});
test('all interpolated HTML can escape script and attribute delimiters',()=>{assert.equal(escapeHTML('<img src=x onerror="x">&\''),'&lt;img src=x onerror=&quot;x&quot;&gt;&amp;&#39;');});
test('client rejects empty, oversized and executable files',()=>{assert.throws(()=>validateFile({name:'a.stl',size:0}));assert.throws(()=>validateFile({name:'x.exe',size:4}));assert.throws(()=>validateFile({name:'x.jpg',size:21*1024*1024}));assert.equal(validateFile({name:'part.STL',size:500}),true);});
test('API does not convert server failure into a successful empty response',async()=>{await assert.rejects(request('https://example/','rpg-progress',{device:KEY,fetcher:async()=>new Response('{"error":"invalid_device"}',{status:401})}),/invalid_device/);});
test('API handles invalid JSON',async()=>{await assert.rejects(request('https://example/','x',{device:KEY,fetcher:async()=>new Response('<html>')}),/непонятный ответ/);});
test('API always uses device header and never caches private responses',async()=>{await request('https://example/','x',{device:KEY,fetcher:async(url,opt)=>{assert.equal(opt.headers['x-device-id'],KEY);assert.equal(opt.cache,'no-store');return Response.json({ok:true});}});});
test('large images use chunked base64 without call-stack overflow',()=>{const bytes=new Uint8Array(300000).fill(42);assert.equal(Buffer.from(bytesBase64(bytes),'base64').length,bytes.length);});
test('ASCII STL dimensions and rotation independent size validation',()=>{const ascii='solid sample\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 60 0 20\nvertex 0 40 0\nendloop\nendfacet\nendsolid sample';const dims=stlDimensions(new TextEncoder().encode(ascii).buffer);assert.deepEqual(dims,[60,40,20]);assert.ok(geometryMatches(dims));assert.ok(geometryMatches([20,60,40]));assert.equal(geometryMatches([21,40,60]),false);});
test('binary STL parser does not allocate a vertex list',()=>{const b=new ArrayBuffer(134),v=new DataView(b);v.setUint32(80,1,true);[[0,0,0],[60,0,20],[0,40,0]].forEach((p,i)=>p.forEach((x,k)=>v.setFloat32(96+i*12+k*4,x,true)));assert.deepEqual(stlDimensions(b),[60,40,20]);});
test('malformed STL rejected',()=>{assert.throws(()=>stlDimensions(new TextEncoder().encode('not stl').buffer));});
test('normal quests can complete instead of staying pending forever',()=>{assert.equal(aggregateQuest(0,[{check_status:'accepted',check_note:'OK'}]).status,'accepted');});
test('CAD dimensions quest needs BOTH geometry and screenshot',()=>{const stl={check_status:'accepted',evidence_type:'stl'},img={check_status:'accepted',evidence_type:'png'};assert.equal(aggregateQuest(2,[stl]).status,'pending');assert.equal(aggregateQuest(2,[img]).status,'pending');assert.equal(aggregateQuest(2,[stl,img]).status,'accepted');});
test('new rejected evidence cannot revert a completed quest',()=>{assert.equal(aggregateQuest(0,[{check_status:'rejected'}],{status:'accepted'}).status,'accepted');});
test('deadline uses Orenburg time, not browser timezone',()=>{assert.equal(localClock(new Date('2026-09-10T17:59:59Z')).seconds_to_deadline,1);assert.equal(localClock(new Date('2026-09-10T18:00:00Z')).expired,true);assert.equal(localClock(new Date('2026-09-10T19:00:00Z')).date,'2026-09-11');assert.equal(localClock(new Date('2026-09-10T19:00:00Z')).expired,false);});
test('unsupported AI proof remains pending, never falsely accepted',async()=>{const f=new File(['hello'],'report.txt',{type:'text/plain'});const result=await evaluateFile(f,{id:37,title:'English',mission:'speak'},env);assert.equal(result.check_status,'pending');});
test('AI outage preserves pending evidence',async()=>{const f=new File(['not-real-image'],'proof.png',{type:'image/png'});const result=await evaluateFile(f,{id:0,title:'CAD',mission:'show CAD'},{get:k=>k==='GEMINI_API_KEY'?'test':null},async()=>new Response('unavailable',{status:503}));assert.equal(result.check_status,'pending');});
test('server rejects missing device without querying data',async()=>{const handler=createHandler('rpg-progress',{env,fetcher:()=>{throw Error('must not fetch');}});const result=await handler(new Request('https://example/rpg-progress'));assert.equal(result.status,401);});
test('server denies unverified daily completion',async()=>{const handler=createHandler('rpg-dailies',{env,fetcher:()=>{throw Error('must not fetch');}});const result=await handler(new Request('https://example/rpg-dailies',{method:'POST',headers:{'x-device-id':KEY,'content-type':'application/json'},body:'{"action":"complete","id":1}'}));assert.equal(result.status,403);assert.equal((await result.json()).error,'verification_required');});
test('server rejects missing or out-of-range quest identifiers',async()=>{for(const query of ['', '?quest_index=999','?quest_index=-1','?quest_index=']){const handler=createHandler('quest-evidence-bundle',{env});const result=await handler(new Request('https://example/quest-evidence-bundle'+query,{headers:{'x-device-id':KEY}}));assert.equal(result.status,400);}});
test('server scopes evidence history to the requesting device and excludes file paths',async()=>{const handler=createHandler('quest-status',{env,fetcher:async(url,options)=>{assert.equal(url.searchParams.get('device_id'),'eq.'+KEY);assert.equal(url.searchParams.get('select').includes('file_path'),false);assert.equal(options.headers.Authorization,'Bearer test-server-key');return Response.json([]);}});const response=await handler(new Request('https://example/quest-status',{headers:{'x-device-id':KEY}}));assert.equal(response.status,200);assert.deepEqual((await response.json()).items,[]);});
test('all local frontend assets exist and runtime page has no remote document.write',async()=>{const html=await readFile(new URL('../achievements.html',import.meta.url),'utf8');assert.equal(html.includes('document.write'),false);assert.equal(html.includes('raw.githubusercontent'),false);for(const match of html.matchAll(/(?:href|src)="(\.\/[^"?#]+)(?:\?[^"#]*)?"/g))await readFile(new URL('../'+match[1],import.meta.url));});
test('shared service worker intercepts ARISE assets only',async()=>{const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');assert.ok(sw.includes('!paths.has(url.pathname)'));assert.ok(sw.includes("req.method!=='GET'"));assert.equal(sw.includes('personal_rpg_device_id'),false);});
test('release SQL preserves rows and blocks old anonymous access',async()=>{const sql=await readFile(new URL('../supabase/arise-release.sql',import.meta.url),'utf8');assert.equal(/\b(?:delete\s+from|truncate|drop\s+table)\b/i.test(sql),false);assert.ok(sql.includes('drop policy if exists "personal rpg evidence read"'));assert.ok(sql.includes('security invoker'));const rewards=sql.match(/rewards integer\[\] := array\[([^\]]+)\]/)[1].split(',').map(Number);assert.deepEqual(rewards,QUESTS.map(x=>x.xp));});

function uploadRequest(id, kind='quest') {
  const body=new FormData();
  body.append('file',new File(['test fixture'],'proof.png',{type:'image/png'}));
  body.append(kind==='quest'?'quest_index':'daily_id',String(id));
  return new Request('https://example/submit',{method:'POST',headers:{'x-device-id':KEY},body});
}

test('locked quest upload cannot write files or records',async()=>{
  let calls=0;
  const handler=createHandler('submit-quest-evidence',{env,fetcher:async(url,opt)=>{
    calls++; assert.equal(opt.method,'GET');
    assert.equal(url.pathname,'/rest/v1/quest_evidence');
    return Response.json([]);
  }});
  const result=await handler(uploadRequest(1));
  assert.equal(result.status,409); assert.equal(calls,1);
});

test('accepted quest retry returns existing progress without uploading or re-awarding',async()=>{
  const paths=[];
  const handler=createHandler('submit-quest-evidence',{env,fetcher:async(url,opt)=>{
    paths.push(url.pathname);
    if(url.pathname.endsWith('/quest_evidence')) return Response.json([{quest_index:0,status:'accepted'}]);
    assert.equal(url.pathname,'/rest/v1/rpc/sync_rpg_progress_from_evidence');
    assert.equal(JSON.parse(opt.body).p_device_id,KEY);
    return Response.json({xp:40,completed_quests:[0]});
  }});
  const result=await handler(uploadRequest(0));
  assert.equal(result.status,200);
  assert.equal((await result.json()).progress.xp,40);
  assert.equal(paths.length,2);
});

test('full upload flow stores an unavailable AI review as pending, not completed',async()=>{
  const writes=[];
  const handler=createHandler('submit-quest-evidence',{env,fetcher:async(input,opt)=>{
    const url=new URL(input);
    if(url.pathname.startsWith('/storage/')) { writes.push('upload'); return Response.json({}); }
    if(url.pathname.endsWith('/quest_evidence')) return Response.json([]);
    if(url.pathname.endsWith('/quest_evidence_parts')) {
      if(opt.method==='POST') { const row=JSON.parse(opt.body); assert.equal(row.device_id,KEY); assert.equal(row.check_status,'pending'); writes.push('part'); return Response.json([row]); }
      return Response.json(url.searchParams.has('quest_index')?[{check_status:'pending',check_note:'Manual review',evidence_type:'png'}]:[]);
    }
    if(url.pathname.endsWith('/arise_record_quest')) {
      const row=JSON.parse(opt.body); assert.equal(row.p_status,'pending'); writes.push('aggregate');
      return Response.json({status:'pending',review_note:row.p_note});
    }
    assert.equal(url.pathname,'/rest/v1/rpc/sync_rpg_progress_from_evidence');
    return Response.json({xp:0,completed_quests:[]});
  }});
  const response=await handler(uploadRequest(0));
  assert.equal(response.status,200);
  assert.equal((await response.json()).status,'pending');
  assert.deepEqual(writes,['upload','part','aggregate']);
});

test('new daily reward cannot be chosen by an untrusted client',async()=>{
  const handler=createHandler('rpg-dailies',{env,now:()=>new Date('2026-09-10T10:00:00Z'),fetcher:async(url,opt)=>{
    assert.equal(url.pathname,'/rest/v1/rpc/arise_add_daily');
    const body=JSON.parse(opt.body);
    assert.equal(body.p_repeat,false); assert.equal(body.p_type,'project');
    assert.equal(Object.hasOwn(body,'xp'),false); assert.equal(Object.hasOwn(body,'p_xp'),false);
    return Response.json({id:1,xp:35});
  }});
  const result=await handler(new Request('https://example/dailies',{method:'POST',headers:{'x-device-id':KEY,'content-type':'application/json'},body:JSON.stringify({action:'add',title:'Model',details:'A finished model',source_type:'project',xp:999999})}));
  assert.equal(result.status,200); assert.equal((await result.json()).xp,35);
});

test('camera daily cannot be completed by uploading a screenshot',async()=>{
  const handler=createHandler('submit-daily-evidence',{env,now:()=>new Date('2026-09-10T10:00:00Z'),fetcher:async(url,opt)=>{
    assert.equal(opt.method,'GET'); assert.equal(url.pathname,'/rest/v1/daily_instances');
    return Response.json([{id:1,status:'active',verification_mode:'camera'}]);
  }});
  const result=await handler(uploadRequest(1,'daily'));
  assert.equal(result.status,409);
  assert.equal((await result.json()).error,'camera_verification_unavailable');
});
