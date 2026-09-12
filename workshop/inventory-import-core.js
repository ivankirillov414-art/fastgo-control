// Pure import validation and resumable receipts. No customer data or credentials.
export const normalize = v => String(v ?? '').trim().toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ');
const text = v => String(v ?? '').trim();
const identity = p => [normalize(p.category),normalize(p.model),normalize(p.name)].join('|');
const present = v => v !== undefined && v !== null && text(v) !== '';
export function column(row,names) {
  for (const name of names) {
    const key=Object.keys(row).find(k=>normalize(k)===normalize(name));
    if (key!==undefined && present(row[key])) return row[key];
  }
  return undefined;
}
export function numberCell(value,label,{integer=false,fallback=0}={}) {
  if (!present(value)) return fallback;
  const s=String(value).trim().replace(/[\s\u00a0\u202f]/g,'').replace(',','.');
  if (typeof value==='boolean' || !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(s)) throw new Error(`${label}: требуется неотрицательное число`);
  const n=Number(s);
  if (!Number.isFinite(n) || n>1e9 || (integer && (!Number.isInteger(n)||n>100000))) throw new Error(`${label}: ${integer?'требуется целое количество до 100000':'недопустимое число'}`);
  return n;
}
function uniqueMatch(items,predicate,label) {
  const found=items.filter(predicate);
  if(found.length>1) throw new Error(`${label}: несколько товаров в базе; сначала устраните дубли`);
  return found[0];
}
export function planImport(rows,catalog) {
  if(!Array.isArray(rows)||rows.length>5000) throw new Error('В одном импорте допускается до 5000 строк');
  const items=catalog.parts||[], plan=[], errors=[], used=new Set(), usedSku=new Set();
  for(let i=0;i<rows.length;i++) {
    const row=rows[i], rowNumber=Number.isInteger(row.__rowNum__)?row.__rowNum__+1:i+2;
    const name=text(column(row,['Модель / название','Наименование','Товар','Название']));
    if(!name) continue;
    try {
      let category=text(column(row,['Категория','Category']));
      const model=text(column(row,['Модель','Model'])), sku=text(column(row,['SKU','Артикул','Артикул / SKU']));
      let barcode=text(column(row,['Штрих-код','Штрихкод','Barcode']));
      if(normalize(barcode)==='auto') barcode='';
      const cat=(catalog.categories||[]).find(c=>[c.name,c.label].some(v=>v && normalize(v)===normalize(category)));
      if(cat) category=cat.name;
      const candidates=[
        barcode?uniqueMatch(items,p=>normalize(p.barcode)===normalize(barcode),'Штрих-код'):null,
        sku?uniqueMatch(items,p=>normalize(p.sku)===normalize(sku),'Артикул'):null,
        uniqueMatch(items,p=>identity(p)===identity({name,category,model}),'Модель')
      ].filter(Boolean);
      if(new Set(candidates.map(p=>p.id)).size>1) throw new Error('Штрих-код, артикул и модель указывают на разные товары');
      const found=candidates[0];
      if(barcode && (!found || normalize(found.barcode)!==normalize(barcode))) throw new Error('Неизвестный штрих-код: для нового товара оставьте поле пустым или AUTO');
      category=category||found?.category||'';
      if(!category) throw new Error('Укажите категорию');
      const product={...(found?{id:found.id}:{}),name,category,model:model||found?.model||'',sku:sku||found?.sku||'',unit:text(column(row,['Ед.','Единица','Ед. изм.']))||found?.unit||'шт',
        unit_cost:numberCell(column(row,['Цена закупки','Закупочная цена','Закупка','Цена закупки, ₽']),'Закупочная цена',{fallback:Number(found?.unit_cost||0)}),
        retail_price:numberCell(column(row,['Цена продажи','Розничная цена','Цена продажи, ₽','Цена','Продажа']),'Розничная цена',{fallback:Number(found?.retail_price||0)}),
        active:found?found.active!==false:true};
      const quantity=numberCell(column(row,['Приход, шт.','Количество','Приход','Начальный остаток']),'Количество',{integer:true});
      const key=found?.id||identity(product), skuKey=normalize(product.sku);
      if(used.has(key)||(skuKey&&usedSku.has(skuKey))) throw new Error('Товар повторяется в этом файле; объедините количества в одну строку');
      used.add(key);if(skuKey)usedSku.add(skuKey);
      plan.push({rowNumber,product,quantity});
    } catch(e) { errors.push(`Строка ${rowNumber}: ${e.message}`); }
  }
  if(errors.length) throw new Error(`Импорт не начат. Исправьте ошибки:\n${errors.slice(0,15).join('\n')}${errors.length>15?'\n… и ещё '+(errors.length-15):''}`);
  if(!plan.length) throw new Error('Не найдены строки товаров. Используйте лист «Товары»');
  return plan;
}
export async function digestBytes(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
}
export async function receiptId(fileHash,rowNumber,productId) {
  const h=await digestBytes(new TextEncoder().encode(`FastGo/receipt/v1/${fileHash}/${rowNumber}/${productId}`));
  const s=h.slice(0,12)+'8'+h.slice(13,16)+((parseInt(h[16],16)&3)|8).toString(16)+h.slice(17,32);
  return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;
}
export function checkpointStore(storage,fileHash) {
  const key='fastgo_import_v1:'+fileHash;
  let state={rows:{},complete:false};
  const raw=storage.getItem(key);
  if(raw){try{state=JSON.parse(raw);}catch{throw new Error('Повреждён журнал импорта. Не повторяйте приход до сверки остатков');}}
  if(!state||!state.rows||typeof state.rows!=='object')throw new Error('Некорректный журнал импорта');
  const save=()=>{storage.setItem(key,JSON.stringify(state));if(!storage.getItem(key))throw new Error('Не удалось сохранить журнал импорта в браузере');};
  save();return {state,save};
}
export async function runImport(plan,{api,catalog,fileHash,checkpoint,onProgress=()=>{}}) {
  const state=checkpoint.state;
  if(state.complete)return {alreadyDone:true,created:0,updated:0,received:0};
  const totals={created:0,updated:0,received:0};
  for(let i=0;i<plan.length;i++) {
    const row=plan[i], saved=state.rows[row.rowNumber]||{};
    onProgress(i,plan.length,`Строка ${row.rowNumber}`);
    if(saved.receipt_done)continue;
    let found=(catalog.parts||[]).find(p=>p.id===(saved.product_id||row.product.id));
    if(!found)found=(catalog.parts||[]).find(p=>identity(p)===identity(row.product)||(row.product.sku&&normalize(p.sku)===normalize(row.product.sku)));
    const patch={...row.product,...(found?{id:found.id}:{})};
    const same=found&&Object.entries(patch).every(([k,v])=>k==='active'?(found.active!==false)===v:String(found[k]??'')===String(v));
    let product=found;
    if(!same) {product=await api('part_save',patch);if(!product?.id)throw new Error('Сервер не подтвердил сохранение товара. Импорт остановлен');totals[found?'updated':'created']++;}
    saved.product_id=product.id;state.rows[row.rowNumber]=saved;checkpoint.save();
    if(row.quantity>0) {
      const request_id=await receiptId(fileHash,row.rowNumber,product.id);
      saved.receipt_id=request_id;checkpoint.save();
      await api('stock',{part_id:product.id,movement_type:'receipt',quantity:row.quantity,note:`Импорт Excel ${fileHash.slice(0,12)}, строка ${row.rowNumber}`,request_id});
      totals.received+=row.quantity;
    }
    saved.receipt_done=true;checkpoint.save();
  }
  state.complete=true;checkpoint.save();onProgress(plan.length,plan.length,'Импорт завершён');return totals;
}
