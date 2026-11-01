import test,{before,after,beforeEach} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';import {randomUUID} from 'node:crypto';
import {owner,fixture,paidRepair} from './payment-correction-fixture.mjs';
import {preparePaymentCorrection} from '../supabase/functions/fastgo-warehouse/payment-corrections.js';
const {PGlite}=createRequire(import.meta.url)(process.env.FASTGO_PGLITE||'@electric-sql/pglite');
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');let db,h;
const snapshot=async()=>(await db.query('select public.workshop_native_snapshot() as result')).rows[0].result;
const commit=async(prepared,request,version=1,actor=owner.id)=>(await db.query('select public.workshop_native_commit($1,$2,$3,$4,$5,$6,$7) as result',[actor,'warehouse_payment_correction',request,'c'.repeat(64),version,JSON.stringify(prepared.changes),JSON.stringify(prepared.result)])).rows[0].result;
const count=async table=>Number((await db.query('select count(*) as n from public.'+table)).rows[0].n);
async function seed(){for(const [name,sheet] of Object.entries(h.sheets)){await db.query('insert into public.workshop_native_sheets values($1,$2)',[name,JSON.stringify(sheet.headers)]);for(const {__row,...row} of sheet.rows)await db.query('insert into public.workshop_native_rows values($1,$2,$3)',[name,__row,JSON.stringify(row)]);}}
before(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table public.workshop_backend_config(id integer primary key);
 create table public.workshop_members(profile_id uuid primary key,role text,active boolean,can_sell boolean default false,can_edit_catalog boolean default false);`);
 for(const name of ['supabase/workshop-native.sql','supabase/migrations/20261024134928_fastgo_preorder_cash_access.sql','supabase/migrations/20261013134258_workshop_remote_print_queue.sql','supabase/migrations/20261101103555_repair_completion_print.sql','supabase/migrations/20261101124025_payment_corrections.sql'])await db.exec(read(name));
 await db.query('insert into public.workshop_members(profile_id,role,active) values($1,$2,true)',[owner.id,'owner']);
 console.log('Payment correction database:',(await db.query('select version() as v')).rows[0].v);
});after(async()=>await db?.close());
beforeEach(async()=>{await db.exec(`truncate public.workshop_native_outbox,public.workshop_native_receipts,public.workshop_native_rows,public.workshop_native_sheets,public.workshop_print_jobs;update public.workshop_native_state set version=1,mode='active' where id=1;`);h=fixture();});
test('one correction atomically commits stock, money and audit with receipt replay and CAS conflict',async()=>{
 const sale=h.run('sale',{shift_id:h.shift,payment_method:'transfer',items:[{part_id:h.a,quantity:1}]}),p=h.command('sale:'+sale.id),prepared=preparePaymentCorrection(h.snapshot(),p,owner);await seed();
 assert.equal((await commit(prepared,p.request_id)).result.state,'cancelled');assert.equal((await commit(prepared,p.request_id)).replayed,true);
 assert.equal((await commit(prepared,randomUUID())).retry,true);assert.equal(await count('workshop_native_receipts'),1);assert.equal(await count('workshop_native_outbox'),1);
 const actual=await snapshot();assert.equal(actual.sheets['Товары'].rows.find(x=>x.product_id===h.a)['Остаток, шт.'],5);assert.equal(actual.sheets['Продажи'].rows.reduce((sum,x)=>sum+Number(x['Итого']),0),0);
});
test('database denies non-administrator corrections and rolls back every journal on an outbox failure',async()=>{
 const sale=h.run('sale',{shift_id:h.shift,payment_method:'cash',items:[{part_id:h.a,quantity:1}]}),p=h.command('sale:'+sale.id),prepared=preparePaymentCorrection(h.snapshot(),p,owner);await seed();
 for(const [role,can_sell] of [['manager',true],['mechanic',true],['admin',false]]){const actor=randomUUID();await db.query('insert into public.workshop_members values($1,$2,true,$3,false)',[actor,role,can_sell]);await assert.rejects(commit(prepared,p.request_id,1,actor),/администратору/);}
 const before=await snapshot();await db.exec(`create function public.fail_correction_test() returns trigger language plpgsql as $$begin raise exception 'simulated outbox failure';end$$;create trigger fail_correction_test before insert on public.workshop_native_outbox for each row execute function public.fail_correction_test();`);
 try{await assert.rejects(commit(prepared,p.request_id),/simulated outbox failure/);}finally{await db.exec('drop trigger fail_correction_test on public.workshop_native_outbox;drop function public.fail_correction_test();');}
 assert.deepEqual(await snapshot(),before);assert.equal(await count('workshop_native_receipts'),0);await commit(prepared,p.request_id);assert.equal(await count('workshop_native_receipts'),1);
});
test('corrected partial repair payment queues exactly one act inside the money transaction',async()=>{
 const {record,payment}=paidRepair(h);Object.assign(h.sheets['Ремонты'].rows.find(x=>x.repair_id===record.id),{'Статус':'Готов','Оплачено':700});payment['Сумма']=700;await seed();
 await db.query(`select public.workshop_print_queue(p_action=>'activate',p_actor=>$1,p_station=>$2,p_request=>$3)`,[owner.id,randomUUID(),randomUUID()]);
 const p=h.command('payment:'+payment.payment_id,{mode:'edit',amount:1000,method:'cash'}),prepared=preparePaymentCorrection(h.snapshot(),p,owner);assert.equal(prepared.result.repair_completed,true);
 await commit(prepared,p.request_id);await commit(prepared,p.request_id);assert.equal(await count('workshop_print_jobs'),1);assert.equal((await db.query('select document_type from public.workshop_print_jobs')).rows[0].document_type,'completion');
});
test('voiding payment fences a previously queued completion act from the print station',async()=>{
 const {record,payment}=paidRepair(h);await seed();const station=randomUUID(),token=randomUUID();
 await db.query(`select public.workshop_print_queue(p_action=>'activate',p_actor=>$1,p_station=>$2,p_request=>$3)`,[owner.id,station,token]);
 await db.query(`select public.workshop_print_queue(p_action=>'enqueue',p_actor=>$1,p_kind=>'repair',p_record=>$2,p_request=>$3,p_document_type=>'completion')`,[owner.id,record.id,record.step_state.completion_request_id]);
 const p=h.command('payment:'+payment.payment_id);await commit(preparePaymentCorrection(h.snapshot(),p,owner),p.request_id);
 const claim=(await db.query(`select public.workshop_print_queue(p_action=>'claim',p_actor=>$1,p_station=>$2,p_request=>$3,p_document_types=>array['master','completion']) as result`,[owner.id,station,token])).rows[0].result;
 assert.equal(claim.job,null);assert.equal((await db.query('select status from public.workshop_print_jobs')).rows[0].status,'failed');
});
