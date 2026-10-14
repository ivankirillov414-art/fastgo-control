const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store}=require('../store.cjs');
const model=()=>import('../../workshop/home-priorities-model.js');
const now=new Date('2026-10-14T20:00:00Z'); // 15 October in the workshop timezone.
test('daily priorities respect local day, closed cards, approval changes and storage deadlines',async()=>{
 const {buildPriorities}=await model();
 const base={status:'repair',created_at:'2026-10-01',diagnostics_notes:'Проверено',total_amount:1000,approved_amount:1000};
 const result=buildPriorities({repairs:[{...base,id:'late',promised_date:'2026-10-14'},{...base,id:'ready',status:'ready',promised_date:'2026-10-12'},{...base,id:'today',promised_date:'2026-10-15'},{...base,id:'approval',approved_amount:900},{...base,id:'done',status:'issued',promised_date:'2026-10-01'}],storage:[{id:'soon',status:'stored',planned_return_date:'2026-10-22'},{id:'later',status:'stored',planned_return_date:'2026-10-23'},{id:'returned',status:'returned',planned_return_date:'2026-10-15'},{id:'ready-storage',status:'ready_return'}]},now);
 assert.equal(result.today,'2026-10-15');assert.deepEqual(result.overdue.map(r=>r.id),['late']);assert.deepEqual(result.approvals.map(r=>r.id),['approval']);assert.equal(result.next.kind,'overdue');assert.deepEqual(result.tasks.map(r=>r.id),['late','today']);assert.equal(result.working.length,3);assert.equal(result.ready.length,1);assert.deepEqual(result.storageDue.map(r=>r.id),['soon','ready-storage']);
});
test('approval, ready, accepted and empty states lead to actionable records',async()=>{
 const {buildPriorities,repairCount}=await model();
 for(const [record,kind] of [[{status:'diagnostics',diagnostics_notes:'Диагностика',total_amount:1000},'approval'],[{status:'ready'},'ready'],[{status:'accepted'},'accepted'],[{status:'repair'},'working']]){const result=buildPriorities({repairs:[{id:'r',...record}]},now);assert.equal(result.next.kind,kind);assert.equal(result.next.items[0].id,'r');}
 assert.equal(buildPriorities({repairs:[],storage:[]},now).next.kind,'empty');assert.equal(repairCount(21),'21 ремонт');assert.equal(repairCount(12),'12 ремонтов');
});
test('native homepage reflects pending local edits and isolates accounts without attachments',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fg-home-')),store=new Store(path.join(dir,'db.sqlite'));t.after(()=>{store.close();fs.rmSync(dir,{recursive:true,force:true});});
 store.remember('a','repair',{id:'r',revision:1,status:'repair',brand:'Kugoo',model:'M4',works:[{price:1000,quantity:1}],parts:[],total_amount:1000,approved_amount:null,fault_photo_paths:['private-photo'],phone:'private-phone'});
 store.remember('b','repair',{id:'secret',status:'accepted'});store.remember('a','repair',{id:'done',status:'issued'});
 store.localWrite('a','update',{id:'r',kind:'repair',revision:1,status:'ready',approve:true});
 const data=store.homeData('a');assert.equal(data.repairs.length,1);assert.equal(data.repairs[0].status,'ready');assert.equal(data.repairs[0].approved_amount,1000);assert.equal(data.repairs[0].fault_photo_paths,undefined);assert.equal(data.repairs[0].phone,undefined);assert.equal(store.pending('a').length,1);assert.equal(store.homeData('b').repairs[0].id,'secret');assert.deepEqual(store.homeData('unknown'),{repairs:[],storage:[]});
});
