const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store}=require('../store.cjs'),{Synchronizer}=require('../sync.cjs');
test('identical background sync does not report changed data; real edits still do',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fastgo-refresh-')),store=new Store(path.join(dir,'db.sqlite')),events=[];
 let record={id:'repair-1',revision:1,status:'accepted',model:'Max Speed'},reorder=false;
 const remote=async(action,p)=>{
  if(action==='list')return {items:p.kind==='repair'?[record]:[],count:p.kind==='repair'?1:0};
  if(action==='get')return {record:reorder?Object.fromEntries(Object.entries(record).reverse()):record,legal:{name:'FastGo'}};
  return {value:action};
 };
 try{const sync=new Synchronizer(store,remote,event=>events.push(event));await sync.warm('owner');assert.equal(events.at(-1).dataChanged,true);
  reorder=true;await sync.warm('owner');assert.equal(events.at(-1).dataChanged,false);
  record={...record,revision:2,status:'ready'};await sync.warm('owner');assert.equal(events.at(-1).dataChanged,true);assert.equal(store.record('owner','repair',record.id).status,'ready');
 }finally{store.close();fs.rmSync(dir,{recursive:true,force:true});}
});
