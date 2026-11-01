import fs from 'node:fs';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createNativeEngine} from '../supabase/functions/_shared/native-engine.js';
import {prepareRepairPayment} from '../supabase/functions/fastgo-warehouse/repair.js';
import {preparePaymentCorrection,paymentCorrectionPreview} from '../supabase/functions/fastgo-warehouse/payment-corrections.js';
import {finalReport} from '../supabase/functions/fastgo-warehouse/final-report.js';
export const owner={id:randomUUID(),role:'owner',name:'Тестовый владелец',email:'owner@example.invalid',can_sell:true};
export function fixture(){
 const schema=JSON.parse(fs.readFileSync(new URL('./google-schema.json',import.meta.url)));schema['Операции API']=['request_id','actor_id','action','fingerprint','result','created_at'];
 const engine=createNativeEngine(Object.fromEntries(Object.entries(schema).map(([name,headers])=>[name,{headers,rows:[]}]))),sheets=engine.sheets;
 const seed=(name,data)=>{const row={...Object.fromEntries(sheets[name].headers.map(k=>[k,''])),...data,__row:Math.max(1,...sheets[name].rows.map(r=>r.__row))+1};sheets[name].rows.push(row);return row;};
 const a=randomUUID(),b=randomUUID();for(const [id,name,quantity,price] of [[a,'Первый товар',5,100],[b,'Другой товар',7,350]])seed('Товары',{product_id:id,'Модель / название':name,'Категория':'Запчасти','Штрих-код':id,'Остаток, шт.':quantity,'Цена продажи, ₽':price,'Цена закупки, ₽':50,'Активен':true});
 const run=(action,p={})=>engine.run(action,{request_id:randomUUID(),...p},owner);
 const shift=run('shift_open',{register:'Касса',opening_cash:0}).id;
 const apply=prepared=>{for(const c of prepared.changes){let row=sheets[c.sheet].rows.find(r=>r.__row===c.row);if(!row)row=seed(c.sheet,{});assert.equal(row.__row,c.row);Object.assign(row,c.values);}return prepared.result;};
 const snapshot=()=>({sheets,version:1});
 const preview=key=>paymentCorrectionPreview(snapshot(),{operation_id:key},owner);
 const command=(key,extra={})=>{const current=preview(key);return {operation_id:current.operation_id,expected_amount:current.expected_amount,expected_method:current.expected_method,request_id:randomUUID(),mode:'void',reason:'Ошибка при проведении',goods_returned:true,shift_id:current.default_shift_id,...extra};};
 const correct=(key,extra={})=>apply(preparePaymentCorrection(snapshot(),command(key,extra),owner));
 return {engine,sheets,seed,run,shift,a,b,apply,snapshot,preview,command,correct,report:()=>finalReport(sheets,{}, {can_manage:true}),stock:id=>sheets['Товары'].rows.find(x=>x.product_id===id)['Остаток, шт.']};
}
export function paidRepair(h){
 const service=randomUUID();h.seed('Прайс работ',{service_id:service,'Работа':'Ремонт','Работа, ₽':1000,'Активна':true});
 let r=h.run('create',{kind:'repair',phone:'+79990000000',last_name:'Тест',first_name:'Клиент',brand:'Kugoo',model:'M4'});
 for(const p of [{flow_action:'diagnose',works:[]},{flow_action:'save_works',works:[{catalog_id:service,name:'Ремонт',price:1000,quantity:1}]},{flow_action:'complete',quality_checked:true,no_parts:true,payment_qr:true}])r=h.run('update',{kind:'repair',id:r.id,revision:r.revision,step_flow:true,...p});
 const payment=prepareRepairPayment(h.snapshot(),{repair_id:r.id,request_id:randomUUID(),expected_revision:r.revision,amount:1000,method:'transfer'},owner);h.apply(payment);return {record:h.run('get',{kind:'repair',id:r.id}).record,payment:h.sheets['Оплаты'].rows.find(x=>x.record_id===r.id)};
}
