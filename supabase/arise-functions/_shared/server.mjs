import {authenticatedUser} from './identity.mjs';
import {QUESTS} from '../../../arise/curriculum.mjs';
import {aggregateQuest,evaluateFile,localClock,validateUpload} from './evidence.mjs';

const H={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,x-device-id,authorization,apikey','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:H});
const devicePattern=/^[a-zA-Z0-9_-]{16,80}$/;
function database(env,fetcher){const origin=env.get('SUPABASE_URL'),key=env.get('SUPABASE_SERVICE_ROLE_KEY');if(!origin||!key)throw Error('server_not_configured');const headers={apikey:key,Authorization:`Bearer ${key}`};return {
 async rest(table,query={},method='GET',body,prefer='return=representation'){const url=new URL(origin+'/rest/v1/'+table);for(const [k,v] of Object.entries(query))url.searchParams.set(k,String(v));const response=await fetcher(url,{method,headers:{...headers,'Content-Type':'application/json',Prefer:prefer},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('database_error');const raw=await response.text();return raw?JSON.parse(raw):null;},
 async rpc(name,body){return this.rest('rpc/'+name,{},'POST',body);},
 async upload(path,file){const response=await fetcher(origin+'/storage/v1/object/quest-evidence/'+path,{method:'POST',headers:{...headers,'Content-Type':file.type||'application/octet-stream','x-upsert':'false'},body:file,signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('upload_failed');}
};}
export function createHandler(action,{env=globalThis.Deno?.env,fetcher=fetch,now=()=>new Date()}={}){return async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:H});
 try{
  if(!['GET','POST'].includes(req.method))return json({error:'method_not_allowed'},405);
  const user=await authenticatedUser(req,env,fetcher);
  const db=database(env,fetcher),url=new URL(req.url),clock=localClock(now());
  const device=await db.rpc('arise_account_device',{p_user_id:user.id});
  if(!devicePattern.test(device))throw Error('database_error');
  const sync=()=>db.rpc('sync_rpg_progress_from_evidence',{p_device_id:device});

  if(action==='migration'){
   if(req.method==='GET')return json({items:await db.rest('arise_migration_requests',{user_id:'eq.'+user.id,select:'id,status,created_at,reviewed_at',order:'created_at.desc'})});
   const body=await req.json(),legacy=String(body.legacy_device_id||'');
   if(!devicePattern.test(legacy)||legacy===device)return json({error:'invalid_migration'},400);
   const rows=await db.rest('arise_migration_requests',{on_conflict:'user_id,legacy_device_id'},'POST',{user_id:user.id,legacy_device_id:legacy},'resolution=ignore-duplicates,return=minimal');
   return json({status:'pending',message:'Заявка сохранена. Старый ключ не даёт доступа без подтверждения владельца.'});
  }
  if(action==='physical-start'){
   if(req.method!=='POST')return json({error:'method_not_allowed'},405);
   const body=await req.json(),quest=QUESTS.find(q=>q.id===body.quest_index&&q.kind==='physical');
   if(!quest)return json({error:'invalid_quest'},400);
   const completed=await db.rest('quest_evidence',{device_id:'eq.'+device,status:'eq.accepted',select:'quest_index'});

   if(QUESTS.some(q=>q.track===quest.track&&q.id<quest.id&&!completed.some(x=>x.quest_index===q.id)))return json({error:'quest_locked'},409);
   const recent=await db.rest('arise_physical_sessions',{user_id:'eq.'+user.id,started_at:'gte.'+new Date(now().getTime()-60000).toISOString(),select:'id',limit:6});
   if(recent.length>=5)return json({error:'rate_limited'},429);
   const rows=await db.rest('arise_physical_sessions',{},'POST',{user_id:user.id,device_id:device,quest_index:quest.id,goal:quest.goal,mode:quest.mode});
   return json({session_id:rows[0].id,goal:quest.goal,mode:quest.mode,expires_at:rows[0].expires_at});
  }
  if(action==='physical-finish'){
   if(req.method!=='POST')return json({error:'method_not_allowed'},405);
   const body=await req.json();
   if(!/^[a-f0-9-]{36}$/i.test(body.session_id||'')||!['reps','valid_ms','observations'].every(k=>Number.isSafeInteger(body[k])&&body[k]>=0))return json({error:'invalid_result'},400);
   const sessions=await db.rest('arise_physical_sessions',{id:'eq.'+body.session_id,user_id:'eq.'+user.id,select:'quest_index'});
   const quest=QUESTS.find(q=>q.id===sessions[0]?.quest_index&&q.kind==='physical');
   if(!quest)return json({error:'invalid_session'},404);
   const record=await db.rpc('arise_finish_physical',{p_user_id:user.id,p_session_id:body.session_id,p_reps:body.reps,p_valid_ms:body.valid_ms,p_observations:body.observations,p_title:quest.title});
   return json({...record,progress:await sync()});
  }
  if(action==='push-config'){const publicKey=env.get('VAPID_PUBLIC_KEY');return publicKey?json({publicKey}):json({error:'vapid_not_configured'},503);}
  if(action==='push-subscribe'){
   if(req.method!=='POST')return json({error:'method_not_allowed'},405);
   const body=await req.json(),endpoint=String(body.endpoint||'');
   if(!endpoint.startsWith('https://')||endpoint.length>4096||typeof body.keys?.p256dh!=='string'||typeof body.keys?.auth!=='string'||body.keys.p256dh.length>256||body.keys.auth.length>256)return json({error:'invalid_subscription'},400);
   // Never transfer another account's endpoint ownership in an upsert.
   const current=await db.rest('push_subscriptions',{endpoint:'eq.'+endpoint,select:'device_id'});
   if(current.some(x=>x.device_id!==device))return json({error:'subscription_conflict'},409);
   await db.rest('push_subscriptions',{on_conflict:'endpoint'},'POST',{device_id:device,endpoint,p256dh:body.keys.p256dh,auth:body.keys.auth,active:true,updated_at:now().toISOString()},'resolution=merge-duplicates,return=minimal');
   return json({ok:true});
  }
  if(action==='rpg-progress'){if(req.method!=='GET')return json({error:'method_not_allowed'},405);const p=await sync(),done=p.completed_quests||[];return json({xp:p.xp||0,completed_quests:done,daily_xp:p.daily_xp||0,next_quest:QUESTS.find(q=>q.track==='fusion'&&!done.includes(q.id))?.id??null,updated_at:p.updated_at,training_days:await db.rpc('arise_training_days',{p_user_id:user.id})});}
  if(action==='quest-status'||action==='quest-evidence-bundle'){if(req.method!=='GET')return json({error:'method_not_allowed'},405);const raw=url.searchParams.get('quest_index'),index=raw===null?null:Number(raw);if(raw!==null&&(!/^\d+$/.test(raw)||!QUESTS.some(q=>q.id===index)))return json({error:'invalid_quest'},400);if(action==='quest-evidence-bundle'&&index===null)return json({error:'invalid_quest'},400);const parts=action==='quest-evidence-bundle',query={device_id:'eq.'+device,select:parts?'id,file_name,mime_type,evidence_type,check_status,check_note,created_at':'id,quest_index,quest_title,status,review_note,created_at,reviewed_at',order:'created_at.desc',limit:parts?'100':'100'};if(index!==null)query.quest_index='eq.'+index;return json({items:await db.rest(parts?'quest_evidence_parts':'quest_evidence',query)});}
  if(action==='rpg-dailies'){
   if(req.method==='POST'){const body=await req.json();if(body.action==='complete')return json({error:'verification_required'},403);if(body.action!=='add')return json({error:'invalid_action'},400);if(clock.expired)return json({error:'daily_expired'},409);const title=String(body.title||'').trim(),details=String(body.details||'').trim(),type=String(body.source_type||'work');if(!title||title.length>160||!details||details.length>500||!['work','learning','project'].includes(type))return json({error:'invalid_quest'},400);const rows=await db.rpc('arise_add_daily',{p_device_id:device,p_title:title,p_details:details,p_type:type,p_repeat:body.repeat===true,p_date:clock.date});return json(rows);}
   const items=await db.rpc('arise_daily_list',{p_device_id:device,p_date:clock.date,p_expired:clock.expired});return json({...clock,deadline:'23:00',items:items||[]});
  }
  if(!['submit-quest-evidence','submit-daily-evidence'].includes(action))return json({error:'not_found'},404);
  if(req.method!=='POST')return json({error:'method_not_allowed'},405);
  if(Number(req.headers.get('content-length'))>21*1024*1024)return json({error:'file_too_large'},413);
  const form=await req.formData(),file=form.get('file'),extension=validateUpload(file),questMode=action==='submit-quest-evidence',raw=String(form.get(questMode?'quest_index':'daily_id')||''),id=Number(raw);
  if(!/^\d+$/.test(raw)||!Number.isSafeInteger(id))return json({error:'invalid_quest'},400);
  let quest,daily,existing;
  if(questMode){quest=QUESTS.find(q=>q.id===id);if(!quest)return json({error:'invalid_quest'},400);if(quest.kind==='physical')return json({error:'camera_required'},409);const completed=await db.rest('quest_evidence',{device_id:'eq.'+device,status:'eq.accepted',select:'quest_index,status,review_note'});existing=completed.find(x=>x.quest_index===id);if(existing)return json({...existing,part_status:'accepted',progress:await sync()});if(QUESTS.some(x=>x.track===quest.track&&x.id<id&&!completed.some(c=>c.quest_index===x.id)))return json({error:'quest_locked'},409);
  }else{if(clock.expired)return json({error:'daily_expired'},409);const rows=await db.rest('daily_instances',{device_id:'eq.'+device,id:'eq.'+id,daily_date:'eq.'+clock.date,select:'*'});daily=rows[0];if(!daily||!['active','rejected'].includes(daily.status))return json({error:'daily_not_active'},409);if(daily.verification_mode==='camera')return json({error:'camera_verification_unavailable'},409);quest={id:-1,title:daily.title,mission:daily.details||daily.title};}
  const recent=await db.rest(questMode?'quest_evidence_parts':'daily_evidence',{device_id:'eq.'+device,created_at:'gte.'+new Date(now().getTime()-60000).toISOString(),select:'id',limit:12});if(recent.length>=10)return json({error:'rate_limited'},429);
  const path=`${device}/${questMode?'quest-'+id:'daily-'+id}/${crypto.randomUUID()}.${extension}`;
  await db.upload(path,file);
  const evaluated=await evaluateFile(file,quest,env,fetcher),metadata={device_id:device,file_path:path,file_name:file.name.slice(0,240),mime_type:file.type||null,file_size:file.size};
  if(questMode){await db.rest('quest_evidence_parts',{},'POST',{...metadata,quest_index:id,evidence_type:extension,...evaluated});const parts=await db.rest('quest_evidence_parts',{device_id:'eq.'+device,quest_index:'eq.'+id,select:'check_status,check_note,evidence_type',order:'created_at.asc'});const result=aggregateQuest(id,parts,existing);const record=await db.rpc('arise_record_quest',{p_device_id:device,p_index:id,p_title:quest.title,p_path:path,p_name:metadata.file_name,p_mime:metadata.mime_type,p_size:file.size,p_status:result.status,p_note:result.review_note});return json({...record,part_status:evaluated.check_status,part_note:evaluated.check_note,progress:await sync()});}
  // Submission began before the deadline. A slow verifier must not invalidate it later.
  const evidence=await db.rpc('arise_record_daily',{p_device_id:device,p_daily_id:id,p_date:clock.date,p_path:path,p_name:metadata.file_name,p_mime:metadata.mime_type,p_size:file.size,p_status:evaluated.check_status,p_note:evaluated.check_note});return json({status:evidence.status,note:evidence.review_note,progress:await sync()});
 }catch(error){const message=String(error?.message||error),allowed=['auth_required','auth_unavailable','email_verification_required','file_required','file_too_large','unsupported_file','invalid_quest','daily_expired','daily_not_active','server_not_configured','database_error','upload_failed'];return json({error:allowed.includes(message)?message:'request_failed'},message==='auth_required'?401:message==='email_verification_required'?403:message==='auth_unavailable'?503:message==='file_too_large'?413:message==='database_error'||message==='server_not_configured'?503:400);}
};}
