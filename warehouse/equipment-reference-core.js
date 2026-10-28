export const normalizeEquipment=value=>String(value||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/g,'');
export const referenceSku=item=>'REF-'+item.id;
export function linkedEquipment(item,parts){
 const sku=parts.filter(p=>p.active!==false&&String(p.sku||'').toUpperCase()===referenceSku(item).toUpperCase());
 if(sku.length===1)return sku[0];
 const key=normalizeEquipment(item.name),model=normalizeEquipment(item.model);
 const matches=parts.filter(p=>p.active!==false&&String(p.category||'').startsWith('Техника')&&(normalizeEquipment(p.name)===key||normalizeEquipment([p.name,p.model].filter(Boolean).join(' '))===key||(normalizeEquipment(p.name)===normalizeEquipment(item.brand)&&normalizeEquipment(p.model)===model)));
 return matches.length===1?matches[0]:null;
}
export function purchaseValue(value){
 const s=String(value).trim().replace(',','.');
 if(!/^\d+(\.\d{1,2})?$/.test(s)||Number(s)>100000000)throw Error('Введите цену от 0 до 100 000 000 ₽, до двух знаков после запятой');
 return Number(s);
}
export function purchaseOperation(item,part,value,request_id){
 if(part)return {action:'inventory_edit',params:{request_id,part_id:part.id,field:'unit_cost',value,expected:Number(part.unit_cost||0)}};
 return {action:'part_save',params:{request_id,name:item.name,model:item.model,sku:referenceSku(item),category:'Техника · '+item.category,unit:'шт.',unit_cost:value,retail_price:0}};
}
export function marketPrice(item,record){
 if(record&&record.market_price!==null&&Number.isFinite(record.market_price))return {value:record.market_price,overridden:true};
 return {value:Number.isFinite(item.price_min)?item.price_min:null,overridden:false};
}
export function marketOperation(item,record,value,request_id){
 return {action:'equipment_market_price_save',params:{id:item.id,revision:record?.revision||0,market_price:value,request_id}};
}
export function selectEquipment(items,{search='',category='',brand=''}={}){
 const words=String(search).toLowerCase().replace(/ё/g,'е').trim().split(/\s+/).filter(Boolean);
 return items.filter(x=>(!category||x.category===category)&&(!brand||x.brand===brand)&&words.every(w=>[x.name,x.brand,x.model].join(' ').toLowerCase().replace(/ё/g,'е').includes(w)));
}
