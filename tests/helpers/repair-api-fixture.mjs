import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {nativeClient} from '../../supabase/functions/_shared/native-client.js';
import {pickupCode} from '../../supabase/functions/_shared/parts-pickup-code.js';
import {partsIssue} from '../../supabase/functions/fastgo-warehouse/parts-issue.js';

export const ownerId='11111111-1111-4111-8111-111111111111',masterId='44444444-4444-4444-8444-444444444444';
export const partId='33333333-3333-4333-8333-333333333333',serviceId='22222222-2222-4222-8222-222222222222';
const secret='isolated-repair-fixture-not-a-production-key';
export function repairApiFixture(){
 const schema=JSON.parse(fs.readFileSync(new URL('../google-schema.json',import.meta.url)));
 const sheets=Object.fromEntries(Object.entries(schema).map(([name,headers])=>[name,{headers,rows:[]}]));
 const seed=(sheet,fields)=>{const row={...Object.fromEntries(sheets[sheet].headers.map(k=>[k,''])),...fields,__row:sheets[sheet].rows.length+2};sheets[sheet].rows.push(row);return row;};
 // Mirror reproduces production: auth members contain the master, the staff sheet does not.
 seed('Сотрудники',{employee_id:ownerId,'ФИО':'Владелец','Роль':'Владелец','Активен':true});
 seed('Прайс работ',{service_id:serviceId,'Работа':'Настройка тормозов','Работа, ₽':1000,'Активна':true});
 seed('Товары',{product_id:partId,'Модель / название':'Тормозной трос','Категория':'Тормоза','Штрих-код':'FGP-00000001','Остаток, шт.':5,'Цена продажи, ₽':750,'Цена закупки, ₽':300,'Активен':true});
 const members=[{profile_id:ownerId,name:'Владелец',role:'owner',active:true},{profile_id:masterId,name:'Алексей Иванов',role:'mechanic',active:true}];
 const receipts=new Map(),writes=[],requests=[];let version=1;
 const db=async(table,q='',method='GET',p)=>{
  const filters=new URLSearchParams(q);
  if(table==='workshop_members')return structuredClone(members.filter(m=>[...filters].every(([k,v])=>!v.startsWith('eq.')||String(m[k])===v.slice(3))));
  if(table==='workshop_role_permissions')return [{role:'admin',can_mark_ready:true,can_issue:true,can_cancel:true}];
  if(table==='service_repairs'||table==='storage_intakes')return [];
  if(table==='workshop_backend_config')return [{sheets_api_url:'https://script.google.com/macros/s/fixture/exec',sheets_api_secret:secret,storage_mode:'postgres'}];
  if(table==='rpc/workshop_native_snapshot')return structuredClone({version,sheets});
  if(table==='workshop_native_receipts'){const row=receipts.get(filters.get('request_id')?.slice(3));return row?[structuredClone(row)]:[];}
  if(table==='rpc/workshop_native_commit'){
   const old=receipts.get(p.p_request_id);
   if(old){assert.equal(old.actor_id,p.p_actor);assert.equal(old.action,p.p_action);assert.equal(old.fingerprint,p.p_fingerprint);return {result:structuredClone(old.result)};}
   if(p.p_version!==version)return {retry:true};
   for(const change of p.p_changes){assert.ok(sheets[change.sheet],change.sheet);let row=sheets[change.sheet].rows.find(x=>x.__row===change.row);if(!row){row={__row:change.row};sheets[change.sheet].rows.push(row);}Object.assign(row,structuredClone(change.values));}
   version++;writes.push(structuredClone(p));receipts.set(p.p_request_id,{actor_id:p.p_actor,action:p.p_action,fingerprint:p.p_fingerprint,result:structuredClone(p.p_result)});
   return {result:structuredClone(p.p_result)};
  }
  throw Error('Unexpected fixture database request: '+table);
 };
 const fetch=async(url,init={})=>{
  const u=new URL(url);
  if(u.pathname==='/auth/v1/user'){const id=String(new Headers(init.headers).get('authorization')||'').replace('Bearer fixture-','');return members.some(x=>x.profile_id===id)?Response.json({id,email:'fixture@example.invalid',email_confirmed_at:'2026-10-01T00:00:00Z'}):Response.json({error:'invalid token'},{status:401});}
  if(u.pathname.startsWith('/rest/v1/'))return Response.json(await db(u.pathname.slice(9),u.search.slice(1),init.method,init.body?JSON.parse(init.body):undefined));
  throw Error('Unexpected external request: '+u.origin+u.pathname);
 };
 let handler;
 const source=fs.readFileSync(new URL('../../supabase/functions/fastgo-workshop-api/index.ts',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
 vm.runInNewContext(source,{Deno:{env:{get:k=>k==='SUPABASE_URL'?'https://fixture.invalid':secret},serve:fn=>handler=fn},fetch,nativeClient,pickupCode,Request,Response,Headers,URL,URLSearchParams,AbortSignal,Uint8Array,TextEncoder,TextDecoder,atob,crypto:globalThis.crypto});
 const request=async(action,params={},actor=ownerId)=>{requests.push({action,params:structuredClone(params),actor});return handler(new Request('https://fixture.invalid/functions/v1/fastgo-workshop-api',{method:'POST',headers:{Authorization:'Bearer fixture-'+actor,'Content-Type':'application/json'},body:JSON.stringify({action,params})}));};
 const call=async(action,p={},actor=ownerId)=>{const r=await request(action,p,actor),j=await r.json();if(!r.ok)throw Object.assign(Error(j.error),{status:r.status});return j.data;};
 const create=()=>call('create',{kind:'repair',request_id:randomUUID(),last_name:'Тест',first_name:'Клиент',phone:'+79990000000',brand:'White Siberia',model:'beluga'});
 const issue=(code,request_id=randomUUID())=>partsIssue('parts_issue',{code,request_id,scanner_source:'atol',items:[{part_id:partId,quantity:1}]},{db,actor:{id:ownerId,role:'owner'},device:{id:ownerId,kind:'station'},stationId:ownerId,key:secret,digest:async text=>createHash('sha256').update(text).digest('hex')});
 return {call,request,create,issue,sheets,members,writes,requests,receipts,seed};
}
