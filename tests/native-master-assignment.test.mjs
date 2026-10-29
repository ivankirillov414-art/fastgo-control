import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {nativeClient} from '../supabase/functions/_shared/native-client.js';

const owner={id:'11111111-1111-4111-8111-111111111111',role:'owner'};
const mechanic={id:'22222222-2222-4222-8222-222222222222',role:'mechanic'};
const other={id:'33333333-3333-4333-8333-333333333333',role:'mechanic'};
function fixture({active=true,role='mechanic',retry=false}={}){
 const schema=JSON.parse(fs.readFileSync(new URL('./google-schema.json',import.meta.url)));
 const sheets=Object.fromEntries(Object.entries(schema).map(([name,headers])=>[name,{headers,rows:[]}]));
 const member={profile_id:mechanic.id,name:'Андрей',role,active};
 const queries=[],commits=[];let version=1,onRetry=()=>{};
 // Production can contain only old owners in this mirrored sheet. Auth members are authoritative.
 sheets['Сотрудники'].rows.push({employee_id:owner.id,'ФИО':'Владелец','Роль':'Владелец','Активен':true,__row:2});
 const db=async(table,q,method,p)=>{
  if(table==='rpc/workshop_native_snapshot')return structuredClone({version,sheets});
  if(table==='workshop_members'){
   queries.push(q);const filter=new URLSearchParams(q);
   const found=filter.get('profile_id')==='eq.'+member.profile_id?member:filter.get('profile_id')==='eq.'+other.id?{profile_id:other.id,name:'Другой мастер',role:'mechanic',active:true}:null;
   return found&&found.active&&found.role==='mechanic'?[structuredClone(found)]:[];
  }
  if(table!=='rpc/workshop_native_commit')throw Error(table);
  if(retry&&p.p_action==='update'){retry=false;version++;onRetry();return {retry:true};}
  for(const c of p.p_changes){let row=sheets[c.sheet].rows.find(x=>x.__row===c.row);if(!row){row={__row:c.row};sheets[c.sheet].rows.push(row);}Object.assign(row,c.values);}
  version++;commits.push(structuredClone(p));return {result:p.p_result};
 };
 const call=(action,p,actor=owner)=>nativeClient({db,actor,google:async()=>{throw Error('Unexpected Google call');},storage:{}})(action,{kind:'repair',request_id:randomUUID(),__request_fingerprint:'fixture',...p});
 const intake=()=>call('create',{last_name:'Тест',first_name:'Клиент',phone:'+70000000000',brand:'White Siberia',model:'beluga'});
 return {call,intake,sheets,member,queries,commits,onRetry:fn=>onRetry=fn};
}

test('first mobile diagnose assigns an active auth mechanic absent from the mirrored staff sheet',async()=>{
 const h=fixture(),r=await h.intake();
 const saved=await h.call('update',{id:r.id,revision:r.revision,step_flow:true,flow_action:'diagnose'},mechanic);
 assert.equal(saved.status,'diagnostics');assert.equal(saved.assigned_master_id,mechanic.id);assert.equal(saved.assigned_master,'Андрей');
 assert.equal(h.queries.length,1);assert.equal(h.sheets['Сотрудники'].rows.length,1);
});

test('step updates hydrate the self-assigned master when the caller sends an empty selection',async()=>{
 const h=fixture(),r=await h.intake();const saved=await h.call('update',{id:r.id,revision:r.revision,step_flow:true,flow_action:'diagnose',assigned_master_id:''},mechanic);
 assert.equal(saved.assigned_master_id,mechanic.id);
});

test('continuing an assigned repair resolves the same active master from auth',async()=>{
 const h=fixture();let r=await h.intake();r=await h.call('update',{id:r.id,revision:r.revision,assigned_master_id:mechanic.id});
 r=await h.call('update',{id:r.id,revision:r.revision,step_flow:true,flow_action:'diagnose'},mechanic);
 r=await h.call('update',{id:r.id,revision:r.revision,step_flow:true,flow_action:'save_comment',master_comment:'Диагностика выполняется'},mechanic);
 assert.equal(r.assigned_master_id,mechanic.id);assert.equal(r.step_state.master_comment,'Диагностика выполняется');
});

for(const state of [{active:false,role:'mechanic'},{active:true,role:'seller'}])test('implicit assignment rejects auth member '+JSON.stringify(state),async()=>{
 const h=fixture(state),r=await h.intake();
 await assert.rejects(h.call('update',{id:r.id,revision:r.revision,step_flow:true,flow_action:'diagnose'},mechanic),e=>e.status===400&&/активного мастера/.test(e.message));
 assert.equal(h.commits.length,1);assert.equal(h.sheets['Ремонты'].rows[0].master_id,'');
});

test('implicit assignment does not permit a mechanic to select another mechanic',async()=>{
 const h=fixture(),r=await h.intake();
 await assert.rejects(h.call('update',{id:r.id,revision:r.revision,step_flow:true,flow_action:'diagnose',assigned_master_id:other.id},mechanic),e=>e.status===403);
 assert.equal(h.commits.length,1);
});

test('step action preserves an existing assignment to another mechanic',async()=>{
 const h=fixture();let r=await h.intake();r=await h.call('update',{id:r.id,revision:r.revision,assigned_master_id:other.id});
 const saved=await h.call('update',{id:r.id,revision:r.revision,step_flow:true,flow_action:'diagnose'},mechanic);
 assert.equal(saved.assigned_master_id,other.id);assert.equal(h.sheets['Ремонты'].rows[0].master_id,other.id);
});

test('owner step actions do not implicitly assign an owner as a mechanic',async()=>{
 const h=fixture(),r=await h.intake();const saved=await h.call('update',{id:r.id,revision:r.revision,step_flow:true,flow_action:'diagnose'});
 assert.equal(saved.assigned_master_id,'');assert.equal(h.queries.length,0);
});

test('snapshot retry revalidates current auth membership before self-assignment',async()=>{
 const h=fixture({retry:true}),r=await h.intake();h.onRetry(()=>h.member.active=false);
 await assert.rejects(h.call('update',{id:r.id,revision:r.revision,step_flow:true,flow_action:'diagnose'},mechanic),e=>e.status===400&&/активного мастера/.test(e.message));
 assert.equal(h.queries.length,2);assert.equal(h.commits.length,1);
});

test('snapshot retry succeeds with an active master and writes a single diagnosis transition',async()=>{
 const h=fixture({retry:true}),r=await h.intake();const saved=await h.call('update',{id:r.id,revision:r.revision,step_flow:true,flow_action:'diagnose'},mechanic);
 assert.equal(saved.status,'diagnostics');assert.equal(saved.assigned_master_id,mechanic.id);assert.equal(h.queries.length,2);assert.equal(h.commits.length,2);
});

