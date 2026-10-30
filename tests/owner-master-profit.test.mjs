import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {masterProfit,reportPeriod,preparePayroll,payrollInput,localDay} from '../supabase/functions/fastgo-operations/master-profit.js';
import {createNativeEngine} from '../supabase/functions/_shared/native-engine.js';
import {createOperationsHandler} from '../supabase/functions/fastgo-operations/handler.js';

const owner={id:randomUUID(),role:'owner'},a=randomUUID(),b=randomUUID(),repair=randomUUID(),part=randomUUID();
const members=[{profile_id:a,name:'Алексей',role:'mechanic',active:true},{profile_id:b,name:'Алексей',role:'mechanic',active:false}];
function fixture(){return {
 'Ремонты':{rows:[{__row:2,repair_id:repair,'Номер ремонта':'FGR-1',master_id:b,'Мастер':'Другой','Итого':1000,'Оплачено':1000,'Строки запчастей':JSON.stringify([{part_id:part,quantity:2,price:250,unit_cost:100}])}]},
 'События':{rows:[{__row:2,event_id:randomUUID(),'Дата':'2026-10-01T08:00:00Z','Тип':'repair',record_id:repair,'Действие':'repair_steps',actor_id:a,'Детали':JSON.stringify({action:'complete',completion_at:'2026-10-01T08:00:00Z',completion_master_name:'Алексей'})},
 {__row:3,event_id:randomUUID(),'Дата':'2026-10-01T08:00:00Z','Тип':'repair',record_id:repair,'Действие':'update',actor_id:a,'Детали':JSON.stringify({from_status:'repair',to_status:'ready'})}]},
 'Оплаты':{rows:[{__row:2,payment_id:randomUUID(),'Дата':'2026-10-01T09:00:00Z','Тип':'repair',record_id:repair,'Сумма':1000,'Сотрудник':'Кассир'}]},
 'Движения склада':{rows:[{product_id:part,reference_id:repair,'Тип':'Расход','Количество':2,'Цена закупки':100}]},
 'Товары':{rows:[{product_id:part,'Цена закупки, ₽':99999}]}
};}
const rate=(s,value=50,date='2026-10-01',employee=a)=>apply(s,preparePayroll({sheets:s},'salary_rate_save',{request_id:randomUUID(),employee_id:employee,expected_revision:0,effective_date:date,daily_rate:value,basis:'working_days'},owner,members));
function apply(s,prepared){for(const c of prepared.changes){let r=s[c.sheet].rows.find(x=>x.__row===c.row);if(!r){r={__row:c.row};s[c.sheet].rows.push(r);}Object.assign(r,c.values);}return prepared.result;}
const report=(s,date='2026-10-03',period='month')=>masterProfit(s,{date,period},members,Date.parse('2026-10-30T12:00:00Z'));

test('cash belongs to the completion account, never the assigned worker, cashier or a matching name',()=>{
 const s=fixture();rate(s);const before=JSON.stringify(s),r=report(s),first=r.items.find(x=>x.id===a),second=r.items.find(x=>x.id===b);
 assert.equal(first.revenue,1000);assert.equal(first.parts_cost,200);assert.equal(first.salary,50);assert.equal(first.profit,750);assert.equal(first.workdays,1);assert.equal(second.revenue,0);assert.equal(second.active,false);assert.equal(JSON.stringify(s),before);
});
test('split receipts and refunds allocate historical cost once and charge one salary per working day',()=>{
 const s=fixture();rate(s);s['Оплаты'].rows=[500,500,-100].map((value,index)=>({__row:index+2,payment_id:randomUUID(),'Дата':`2026-10-0${index+1}T09:00:00Z`,'Тип':'repair',record_id:repair,'Сумма':value}));
 const r=report(s).items.find(x=>x.id===a);assert.equal(r.revenue,900);assert.equal(r.refunds,100);assert.equal(r.parts_cost,180);assert.equal(r.salary,50);assert.equal(r.profit,670);assert.deepEqual(r.payments.map(x=>x.parts_cost),[100,100,-20]);
 assert.equal(report(s,'2026-10-02','day').items.find(x=>x.id===a).profit,400);
});
test('payment duplicates and unrelated storage/service sales do not inflate repair income',()=>{
 const s=fixture();rate(s);s['Оплаты'].rows.push({...s['Оплаты'].rows[0],__row:3},{payment_id:randomUUID(),'Тип':'storage',record_id:repair,'Сумма':9999,'Дата':'2026-10-01'});
 assert.equal(report(s).totals.revenue,1000);assert.equal(report(s).totals.repair_count,1);
});
test('cost allocation keeps kopecks across tiny partial payments',()=>{
 const s=fixture();rate(s,0);s['Ремонты'].rows[0]['Итого']=.03;s['Движения склада'].rows[0]['Количество']=1;s['Движения склада'].rows[0]['Цена закупки']=.01;
 s['Оплаты'].rows=[1,2,3].map(day=>({payment_id:randomUUID(),'Тип':'repair',record_id:repair,'Дата':`2026-10-0${day}T10:00:00Z`,'Сумма':.01}));
 const r=report(s).items.find(x=>x.id===a);assert.deepEqual(r.payments.map(x=>x.parts_cost),[0,.01,0]);assert.equal(r.parts_cost,.01);assert.equal(r.profit,.02);
});
test('a daily rate change applies from its effective date and working days can be added, excluded and reset',()=>{
 const s=fixture();rate(s,50);rate(s,80,'2026-10-02');
 const save=(date,value,revision=0)=>apply(s,preparePayroll({sheets:s},'salary_day_save',{request_id:randomUUID(),employee_id:a,date,value,expected_revision:revision},owner,members));
 save('2026-10-02','work');assert.equal(report(s).totals.salary,130);save('2026-10-01','off');assert.equal(report(s).totals.salary,80);save('2026-10-01','auto',1);assert.equal(report(s).totals.salary,130);
 assert.equal(report(s).items.find(x=>x.id===a).rates.length,2);
});
test('a missing salary or purchase price does not become a zero expense',()=>{
 const s=fixture();assert.equal(report(s).totals.profit,null);assert.equal(report(s).totals.missing_rates,1);rate(s,0);assert.equal(report(s).totals.profit,800);
 s['Движения склада'].rows=[];s['Ремонты'].rows[0]['Строки запчастей']=JSON.stringify([{part_id:part,quantity:1,price:100}]);assert.equal(report(s).totals.profit,null);assert.equal(report(s).totals.missing_cost,1);
 s['Ремонты'].rows[0]['Строки запчастей']=JSON.stringify([{part_id:part,quantity:1,unit_cost:0}]);assert.equal(report(s).totals.profit,1000);assert.equal(report(s).totals.zero_cost,1);
});
test('unconfirmed performers and imported paid totals are shown separately without guessing',()=>{
 const s=fixture();s['События'].rows=[];const r=report(s);assert.equal(r.totals.revenue,0);assert.equal(r.unassigned.revenue,1000);assert.equal(r.unassigned.profit,null);
 s['Оплаты'].rows=[];assert.equal(report(s).paid_without_journal.length,1);assert.equal(report(s).totals.revenue,0);
});
test('business-day boundaries use Yekaterinburg, ISO weeks start Monday and invalid dates fail definitively',()=>{
 assert.equal(localDay('2026-10-04T20:01:00Z'),'2026-10-05');assert.equal(reportPeriod({period:'week',date:'2026-11-01'}).from,'2026-10-26');assert.equal(reportPeriod({period:'month',date:'2026-11-01'}).from,'2026-11-01');
 for(const date of ['2026-99-01','2026-02-30','bad'])assert.throws(()=>reportPeriod({date}),e=>e.status===400);
});
test('payroll edits only append an audit event and reject stale revisions, malformed money and nonowners',()=>{
 const s=fixture(),p={request_id:randomUUID(),employee_id:a,expected_revision:0,effective_date:'2026-10-01',daily_rate:50,basis:'working_days'};
 const prepared=preparePayroll({sheets:s},'salary_rate_save',p,owner,members);assert.deepEqual(prepared.changes.map(x=>x.sheet),['События']);apply(s,prepared);
 assert.throws(()=>preparePayroll({sheets:s},'salary_rate_save',{...p,request_id:randomUUID()},owner,members),e=>e.status===409);
 for(const value of [-1,'50',null,.001,1000001])assert.throws(()=>payrollInput('salary_rate_save',{...p,daily_rate:value}),e=>e.status===400);
 assert.throws(()=>preparePayroll({sheets:s},'salary_rate_save',p,{id:a,role:'mechanic'},members),e=>e.status===403);
});

function harness(role='owner'){
 const sheets=fixture(),receipts=[],requests=[];let version=1,lost=false,snapshots=0;
 const handler=createOperationsHandler({base:'https://db',key:'server-key',fetcher:async(url,options={})=>{
  if(url.endsWith('/auth/v1/user'))return Response.json({id:owner.id});
  const path=new URL(url).pathname.split('/rest/v1/')[1],query=new URL(url).searchParams;
  if(path==='workshop_members')return Response.json(query.has('profile_id')?(role?[{role}]:[]):members);
  if(path==='workshop_native_receipts')return Response.json(receipts.filter(x=>x.request_id===query.get('request_id')?.slice(3)));
  if(path==='rpc/workshop_native_snapshot'){snapshots++;return Response.json({version,sheets:structuredClone(sheets)});}
  if(path==='rpc/workshop_native_commit'){
   const p=JSON.parse(options.body);requests.push(p);assert(p.p_changes.every(x=>x.sheet==='События'));
   if(p.p_version!==version)return Response.json({retry:true});
   apply(sheets,{changes:p.p_changes});version++;receipts.push({request_id:p.p_request_id,actor_id:p.p_actor,action:p.p_action,fingerprint:p.p_fingerprint,result:p.p_result});
   if(lost){lost=false;throw Error('Response lost');}return Response.json({result:p.p_result});
  }
  throw Error('Unexpected '+url);
 }});
 return {sheets,receipts,requests,lose:()=>lost=true,snapshots:()=>snapshots,call:async(action,p={},authenticated=true)=>{const r=await handler(new Request('https://api',{method:'POST',headers:authenticated?{Authorization:'Bearer owner-token'}:{},body:JSON.stringify({action,...p})}));return {status:r.status,...await r.json()};}};
}
test('owner salary save retries the same receipt after a lost response without duplicate events',async()=>{
 const h=harness(),p={request_id:randomUUID(),employee_id:a,expected_revision:0,effective_date:'2026-10-01',daily_rate:1200,basis:'working_days'};h.lose();assert.equal((await h.call('salary_rate_save',p)).status,503);
 const retry=await h.call('salary_rate_save',p);assert.equal(retry.status,200);assert.equal(retry.data.daily_rate,1200);assert.equal(h.requests.length,1);assert.equal(h.sheets['События'].rows.filter(x=>x['Тип']==='payroll').length,1);
 assert.equal((await h.call('salary_rate_save',{...p,daily_rate:1300})).status,409);
});
test('mechanics, cashiers, inactive accounts and unauthenticated requests cannot retrieve salaries or change days',async()=>{
 for(const role of ['mechanic','receiver','manager','seller',null]){
  const h=harness(role);for(const action of ['master_analytics','salary_rate_save','salary_day_save'])assert.equal((await h.call(action,{period:'month',date:'2026-10-03'})).status,403);
  assert.equal(h.snapshots(),0);assert.equal(h.requests.length,0);
 }
 assert.equal((await harness().call('master_analytics',{},false)).status,401);
});

test('a repair history never exposes a private payroll event even if record identifiers collide',()=>{
 const s=fixture();s['События'].rows.push({__row:10,event_id:randomUUID(),'Дата':'2026-10-01','Тип':'payroll',record_id:repair,'Действие':'payroll_rate',actor_id:owner.id,'Детали':JSON.stringify({employee_id:a,daily_rate:9999})});
 const schema=JSON.parse(fs.readFileSync(new URL('./google-schema.json',import.meta.url))),full=Object.fromEntries(Object.entries(schema).map(([name,headers])=>[name,{headers,rows:s[name]?.rows||[]}]));const result=createNativeEngine(full).run('get',{kind:'repair',id:repair},{id:a,role:'mechanic'});
 assert.equal(result.events.some(x=>x.action==='payroll_rate'),false);assert.equal(JSON.stringify(result.events).includes('9999'),false);
});
