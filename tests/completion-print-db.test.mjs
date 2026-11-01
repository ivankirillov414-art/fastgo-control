import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {createNativeEngine} from '../supabase/functions/_shared/native-engine.js';
import {prepareRepairPayment} from '../supabase/functions/fastgo-warehouse/repair.js';
const {PGlite}=createRequire(import.meta.url)(process.env.FASTGO_PGLITE||'@electric-sql/pglite');
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const owner={id:randomUUID(),role:'owner',name:'Петров Алексей Иванович'},station=randomUUID(),token=randomUUID();
let db,engine,repair,request,params,version;
const queue=async(action,extra={})=>(await db.query(`select public.workshop_print_queue(p_action=>$1,p_actor=>$2,p_station=>$3,p_request=>$4${extra.job?',p_job=>$5':''}${extra.types?',p_document_types=>$'+(extra.job?6:5):''}) as result`,[action,owner.id,station,token,...(extra.job?[extra.job]:[]),...(extra.types?[extra.types]:[])])).rows[0].result;
const count=async table=>Number((await db.query(`select count(*) as n from public.${table}`)).rows[0].n);
async function commit(prepared=prepareRepairPayment({sheets:engine.sheets},params,owner)){
 return (await db.query('select public.workshop_native_commit($1,$2,$3,$4,$5,$6,$7) as result',[owner.id,'warehouse_repair_payment',request,'a'.repeat(64),version,JSON.stringify(prepared.changes),JSON.stringify(prepared.result)])).rows[0].result;
}
async function enqueue(document_type='completion',requestId=repair.step_state.completion_request_id){
 return (await db.query(`select public.workshop_print_queue(p_action=>'enqueue',p_actor=>$1,p_kind=>'repair',p_record=>$2,p_request=>$3,p_document_type=>$4) as result`,[owner.id,repair.id,requestId,document_type])).rows[0].result;
}
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table public.workshop_backend_config(id integer primary key);
 create table public.workshop_members(profile_id uuid primary key,role text,active boolean,can_sell boolean default false,can_edit_catalog boolean default false);`);
 await db.exec(read('supabase/workshop-native.sql'));
 await db.exec(read('supabase/migrations/20261024134928_fastgo_preorder_cash_access.sql'));
 await db.exec(read('supabase/migrations/20261013134258_workshop_remote_print_queue.sql'));
 await db.exec(read('supabase/migrations/20261101103555_repair_completion_print.sql'));
 await db.query('insert into public.workshop_members(profile_id,role,active) values($1,$2,true)',[owner.id,'owner']);
 console.log('Isolated PostgreSQL:',(await db.query('select version() as version')).rows[0].version);
});
after(async()=>{await db?.close();});
beforeEach(async()=>{
 await db.exec(`truncate public.workshop_native_outbox,public.workshop_native_receipts,public.workshop_native_rows,public.workshop_native_sheets,public.workshop_print_jobs;
 update public.workshop_native_state set version=1,mode='active' where id=1;`);
 const schema=JSON.parse(read('tests/google-schema.json'));
 schema['Операции API']=['request_id','actor_id','action','fingerprint','result','created_at'];
 engine=createNativeEngine(Object.fromEntries(Object.entries(schema).map(([k,headers])=>[k,{headers,rows:[]}])));
 const service=randomUUID();engine.sheets['Прайс работ'].rows.push({__row:2,service_id:service,'Работа':'Настройка','Работа, ₽':1600,'Активна':true});
 repair=engine.run('create',{kind:'repair',phone:'+79990000000',last_name:'Тест',first_name:'Клиент',brand:'Kugoo',model:'M4',request_id:randomUUID()},owner);
 const update=p=>repair=engine.run('update',{kind:'repair',id:repair.id,revision:repair.revision,request_id:randomUUID(),step_flow:true,...p},owner);
 update({flow_action:'diagnose',works:[]});
 update({flow_action:'save_works',works:[{catalog_id:service,name:'Настройка',price:1600,quantity:1}]});
 update({flow_action:'complete',quality_checked:true,no_parts:true,payment_qr:true,works:repair.works});
 for(const [name,sheet] of Object.entries(engine.sheets)){
  await db.query('insert into public.workshop_native_sheets values($1,$2)',[name,JSON.stringify(sheet.headers)]);
  for(const row of sheet.rows){const {__row,...data}=row;await db.query('insert into public.workshop_native_rows values($1,$2,$3)',[name,__row,JSON.stringify(data)]);}
 }
 request=randomUUID();version=1;params={request_id:request,repair_id:repair.id,expected_revision:repair.revision,amount:1600,method:'cash'};
 await queue('activate');
});
test('confirmed cash payment commits the repair and exactly one act without reopening a card',async()=>{
 const paid=await commit();assert.equal(paid.result.repair_completed,true);
 assert.equal(await count('workshop_print_jobs'),1);
 const job=(await db.query('select * from public.workshop_print_jobs')).rows[0];
 assert.equal(job.kind,'repair');assert.equal(job.record_id,repair.id);assert.equal(job.document_type,'completion');assert.equal(job.status,'queued');
 const actual=(await db.query(`select data from public.workshop_native_rows where sheet='Ремонты' and data->>'repair_id'=$1`,[repair.id])).rows[0].data;
 assert.equal(actual['Статус'],'Выдан');assert.equal(actual['Оплачено'],1600);
 assert.equal((await commit()).replayed,true);assert.equal(await count('workshop_print_jobs'),1);
 assert.equal((await enqueue('master')).job.id,job.id,'legacy card fallback must deduplicate with payment');
 assert.equal((await enqueue('completion',randomUUID())).job.id,job.id,'a different transport retry cannot duplicate the act');
 assert.equal(await count('workshop_native_receipts'),1);assert.equal(await count('workshop_print_jobs'),1);
});
test('ordinary prepayment and an unconfirmed completion do not print an act',async()=>{
 await assert.rejects(enqueue(),/not completed and paid/);
 for(const row of engine.sheets['События'].rows){
  if(row['Действие']!=='repair_steps')continue;
  const detail=JSON.parse(row['Детали']);detail.payment_qr=false;row['Детали']=JSON.stringify(detail);
  await db.query(`update public.workshop_native_rows set data=jsonb_set(data,'{Детали}',to_jsonb($1::text)) where sheet='События' and row_no=$2`,[row['Детали'],row.__row]);
 }
 const prepared=prepareRepairPayment({sheets:engine.sheets},params,owner);
 assert.equal(prepared.result.repair_completed,false);
 await commit(prepared);assert.equal(await count('workshop_print_jobs'),0);
 await assert.rejects(enqueue(),/not completed and paid/);
});
test('a paid act correction commits once, supersedes the old queued act and prints after the exact additional payment',async()=>{
 await commit();
 const snapshot=(await db.query('select public.workshop_native_snapshot() as value')).rows[0].value;
 const editEngine=createNativeEngine(snapshot.sheets),current=editEngine.run('get',{kind:'repair',id:repair.id},owner).record,editId=randomUUID();
 const edited=editEngine.run('repair_act_save',{id:repair.id,revision:current.revision,request_id:editId,works:[{name:'Уточнённая настройка',quantity:1,price:1800}],parts:[],total_amount:1800,document:{title:'Уточнённый акт',note:'Проверка'},reason:'Уточнение объёма работ'},owner);
 const args=[owner.id,'repair_act_save',editId,'b'.repeat(64),2,JSON.stringify(editEngine.changes()),JSON.stringify(edited)];
 await db.query('select public.workshop_native_commit($1,$2,$3,$4,$5,$6,$7)',args);
 const replay=(await db.query('select public.workshop_native_commit($1,$2,$3,$4,$5,$6,$7) as result',args)).rows[0].result;assert.equal(replay.replayed,true);
 assert.equal((await queue('claim',{types:['master','completion']})).job,null);assert.equal((await db.query('select status from public.workshop_print_jobs')).rows[0].status,'failed');
 const afterEdit=(await db.query('select public.workshop_native_snapshot() as value')).rows[0].value;engine=createNativeEngine(afterEdit.sheets);version=3;request=randomUUID();params={request_id:request,repair_id:repair.id,expected_revision:edited.revision,amount:200,method:'card'};
 await commit();assert.equal(await count('workshop_print_jobs'),2);
 const act=(await queue('claim',{types:['master','completion']})).job;assert.equal(act.document_type,'completion');assert.equal(act.completion_request_id,editId);
 await queue('dispatch',{job:act.id});await queue('complete',{job:act.id});assert.equal((await queue('claim',{types:['master','completion']})).job,null);
 const finalSnapshot=(await db.query('select public.workshop_native_snapshot() as value')).rows[0].value;
 const final=createNativeEngine(finalSnapshot.sheets).run('get',{kind:'repair',id:repair.id},owner).record;assert.equal(final.completion_act.title,'Уточнённый акт');assert.equal(final.paid_amount,1800);assert.equal(final.total_amount,1800);assert.equal(final.status,'issued');
});
test('an act submitted by an older client is not reprinted on payment replay or card reopen',async()=>{
 const old=randomUUID(),key='repair:'+repair.id+':'+repair.step_state.completion_request_id;
 await db.query(`insert into public.workshop_print_jobs(id,dedupe_key,kind,record_id,created_by,status) values($1,$2,'repair',$3,$4,'submitted')`,[old,key,repair.id,owner.id]);
 await commit();assert.equal(await count('workshop_print_jobs'),1);
 assert.equal((await enqueue('master')).job.id,old);assert.equal((await enqueue()).job.status,'submitted');
 assert.equal((await queue('claim',{types:['master','completion']})).job,null);
});
test('an issued repair with an unpaid balance cannot enqueue a completion act',async()=>{
 await db.query(`update public.workshop_native_rows set data=data||$1::jsonb where sheet='Ремонты' and data->>'repair_id'=$2`,[JSON.stringify({'Статус':'Выдан','Оплачено':800}),repair.id]);
 await assert.rejects(enqueue(),/not completed and paid/);assert.equal(await count('workshop_print_jobs'),0);
});
test('a failure after the receipt rolls back both payment and completion print outbox',async()=>{
 await db.exec(`create function public.fail_print_test() returns trigger language plpgsql as $$begin raise exception 'simulated outbox failure';end$$;
 create trigger fail_print_test before insert on public.workshop_native_outbox for each row execute function public.fail_print_test();`);
 try{await assert.rejects(commit(),/simulated outbox failure/);}finally{await db.exec('drop trigger fail_print_test on public.workshop_native_outbox;drop function public.fail_print_test();');}
 assert.equal(await count('workshop_native_receipts'),0);assert.equal(await count('workshop_print_jobs'),0);
 assert.equal(Number((await db.query(`select count(*) as n from public.workshop_native_rows where sheet='Оплаты'`)).rows[0].n),0);
 assert.equal((await commit()).result.repair_completed,true);assert.equal(await count('workshop_print_jobs'),1);
});
test('legacy clients skip acts while new native clients dispatch once and acknowledge submission',async()=>{
 await commit();assert.equal((await queue('claim')).job,null);
 const job=(await queue('claim',{types:['master','completion']})).job;assert.equal(job.document_type,'completion');
 assert.equal((await queue('claim',{types:['master','completion']})).job,null);
 await queue('dispatch',{job:job.id});
 // A lost acknowledgement must never make a dispatched print claimable again.
 await db.exec(`update public.workshop_print_jobs set lease_until=now()-interval '1 hour'`);
 assert.equal((await queue('claim',{types:['master','completion']})).job,null);
 await queue('complete',{job:job.id});assert.equal((await db.query('select status from public.workshop_print_jobs')).rows[0].status,'submitted');
 assert.equal((await queue('claim',{types:['master','completion']})).job,null);
});
test('intake compatibility, disabled automation, lease fencing and private grants remain intact',async()=>{
 const intake=await enqueue('master',repair.id);assert.equal(intake.job.document_type,'master');
 assert.equal((await queue('claim')).job.id,intake.job.id);
 await assert.rejects(db.query(`select public.workshop_print_queue(p_action=>'claim',p_actor=>$1,p_station=>$2,p_request=>$3)`,[owner.id,randomUUID(),token]),/not the active print station/);
 await db.exec(`update public.workshop_print_jobs set lease_until=now()-interval '1 hour'`);
 assert.equal((await queue('claim')).job.id,intake.job.id);
 await queue('deactivate');await commit();assert.equal(await count('workshop_print_jobs'),1);
 const grants=(await db.query(`select has_function_privilege('authenticated','public.workshop_repair_completion_request(uuid)','execute') as helper,has_table_privilege('anon','public.workshop_print_jobs','select') as jobs`)).rows[0];
 assert.equal(grants.helper,false);assert.equal(grants.jobs,false);
});
