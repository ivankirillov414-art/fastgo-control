// Product/receipt/photo workflow checkpoints contain product fields and IDs,
// never image bytes, credentials or customer data.
const keyFor=actor=>'fastgo_product_intake_v1:'+actor;
const write=(storage,key,value)=>{const encoded=JSON.stringify(value);storage.setItem(key,encoded);if(storage.getItem(key)!==encoded)throw new Error('Не удалось сохранить ход приёмки в браузере.');};
export function loadProductIntake(storage,actor){
  const raw=storage.getItem(keyFor(actor));if(!raw)return null;
  let value;try{value=JSON.parse(raw);}catch{throw new Error('Не удалось прочитать незавершённую приёмку. Не создавайте её повторно; сверьте склад.');}
  if(value.version!==1||!value.product||!value.ids?.product||!value.ids?.stock||!value.ids?.photo)throw new Error('Незавершённая приёмка требует сверки склада.');
  return value;
}
export function startProductIntake(storage,actor,{product,quantity,photo=null}){
  const existing=loadProductIntake(storage,actor);if(existing)return existing;
  if(!String(product.name||'').trim()||!String(product.category||'').trim()||!Number.isInteger(quantity)||quantity<0||quantity>100000)throw new Error('Проверьте наименование, категорию и количество (от 0 до 100000).');
  for(const name of ['unit_cost','retail_price'])if(!Number.isFinite(product[name])||product[name]<0||product[name]>1e9)throw new Error('Проверьте цену товара.');
  const state={version:1,product,quantity,photo,ids:{product:crypto.randomUUID(),stock:crypto.randomUUID(),photo:crypto.randomUUID()},part:null,received:false,photoSaved:false};
  write(storage,keyFor(actor),state);return state;
}
export async function continueProductIntake(storage,actor,{api,uploadPhoto,onProgress=()=>{}}){
  const key=keyFor(actor),state=loadProductIntake(storage,actor);if(!state)throw new Error('Нет незавершённой приёмки.');
  if(!state.part){
    onProgress('Сохраняем товар…');
    try{state.part=await api('part_save',{...state.product,request_id:state.ids.product});}
    catch(error){if([400,403,404,409,413,422].includes(error.status))storage.removeItem(key);throw error;}
    write(storage,key,state);
  }
  if(state.quantity>0&&!state.received){
    onProgress('Товар создан. Записываем приход…');
    await api('stock',{part_id:state.part.id,movement_type:'receipt',quantity:state.quantity,note:'Первичная ручная приёмка',request_id:state.ids.stock});
    state.received=true;write(storage,key,state);
  }
  if(state.photo&&!state.photoSaved){
    onProgress('Товар и приход сохранены. Сохраняем приватное фото…');
    await uploadPhoto(state.part,state.photo,state.ids.photo);
    state.photoSaved=true;write(storage,key,state);
  }
  // Clear only after all requested steps are durably acknowledged. If clearing
  // fails, resuming the finished checkpoint makes no additional API writes.
  storage.removeItem(key);return state.part;
}
