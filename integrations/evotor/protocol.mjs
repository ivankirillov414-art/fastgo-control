// Pure preparation layer. Not connected to live sales or a fiscal terminal.
import {createHash} from 'node:crypto';
const uuid = s => typeof s==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const money=n=>Number.isSafeInteger(n)&&n>=0;
export function prepareCheckout({checkout_id,terminal_id,shift_id,items},catalog,now=Date.now()){
 assert(uuid(checkout_id)&&uuid(terminal_id)&&uuid(shift_id),'Invalid identifiers');
 assert(Array.isArray(items)&&items.length>0&&items.length<=40,'Invalid basket');
 const seen=new Set();
 const rows=items.map(row=>{
  assert(uuid(row.product_id)&&!seen.has(row.product_id),'Duplicate or invalid product');seen.add(row.product_id);
  assert(Number.isSafeInteger(row.quantity)&&row.quantity>0&&row.quantity<=10000,'Invalid quantity');
  const p=catalog.find(p=>p.product_id===row.product_id);
  assert(p&&p.active===true,'Product unavailable');
  assert(Number.isSafeInteger(p.available)&&p.available>=row.quantity,'Insufficient stock');
  assert(money(p.price_kopecks),'Invalid server price');
  assert(p.fiscal_product_id&&uuid(p.fiscal_product_id),'Fiscal product mapping required');
  assert(typeof p.tax==='string'&&p.tax.length>0&&p.unit==='шт','Fiscal configuration required');
  assert(typeof p.name==='string'&&p.name.length>0&&p.name.length<=128,'Invalid product name');
  assert(typeof p.barcode==='string'&&p.barcode.length>0,'Barcode required');
  return {product_id:p.product_id,fiscal_product_id:p.fiscal_product_id,barcode:p.barcode,name:p.name,quantity:row.quantity,price_kopecks:p.price_kopecks,tax:p.tax,unit:p.unit};
 }).sort((a,b)=>a.product_id.localeCompare(b.product_id));
 const total_kopecks=rows.reduce((n,r)=>n+r.quantity*r.price_kopecks,0);
 assert(money(total_kopecks)&&total_kopecks>0,'Invalid total');
 const payload={version:1,checkout_id,terminal_id,shift_id,items:rows,total_kopecks};
 return {...payload,payload_hash:createHash('sha256').update(JSON.stringify(payload)).digest('hex'),expires_at:new Date(now+300000).toISOString(),state:'queued'};
}
export function verifyReceipt(job,receipt){
 assert(receipt.checkout_id===job.checkout_id&&receipt.terminal_id===job.terminal_id,'Receipt correlation mismatch');
 assert(receipt.fiscalized===true&&typeof receipt.receipt_id==='string'&&receipt.receipt_id.length>0,'Fiscal confirmation required');
 assert(money(receipt.total_kopecks)&&receipt.total_kopecks===job.total_kopecks,'Receipt total changed');
 assert(Array.isArray(receipt.items)&&receipt.items.length===job.items.length,'Receipt basket changed');
 const expected=job.items.map(x=>[x.fiscal_product_id,x.quantity,x.price_kopecks,x.tax,x.unit]).sort();
 const actual=receipt.items.map(x=>[x.fiscal_product_id,x.quantity,x.price_kopecks,x.tax,x.unit]).sort();
 assert(JSON.stringify(actual)===JSON.stringify(expected),'Receipt positions changed');
 assert(Array.isArray(receipt.payments)&&receipt.payments.length>0,'Payments missing');
 let total=0;for(const p of receipt.payments){assert(['cash','card','transfer'].includes(p.method)&&money(p.amount_kopecks),'Invalid payment');total+=p.amount_kopecks;}
 assert(total===job.total_kopecks,'Payment total mismatch');
 return {receipt_id:receipt.receipt_id,checkout_id:job.checkout_id,payments:receipt.payments,total_kopecks:total};
}
const transitions={queued:['opening','cancelled'],opening:['opened','unknown'],opened:['fiscalized','unknown'],unknown:['opened','fiscalized'],fiscalized:['committed'],committed:[],cancelled:[]};
export function transition(job,next){assert(transitions[job.state]?.includes(next),'Unsafe checkout transition');return {...job,state:next};}
export function canReleaseReservation(job){return job.state==='cancelled';}
