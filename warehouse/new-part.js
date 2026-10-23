import {esc} from './client.js';
import {loadProductIntake,startProductIntake,continueProductIntake} from '../workshop/product-intake.js';

export function newPartForm({actor,api,photos,parts,canReceive,run,refresh,openProduct,message}){
 return function open(){
  const dialog=document.createElement('dialog');dialog.className='new-part-dialog';dialog.setAttribute('aria-label','Новая запчасть');
  const categories=[...new Set(parts().map(p=>p.category).filter(Boolean))].sort();
  dialog.innerHTML='<form><h2>Новая запчасть</h2><div class="new-part-fields"><label>Наименование<input name="name" required maxlength="200"></label><label>Категория<input name="category" required maxlength="100" list="new-part-categories"><datalist id="new-part-categories">'+categories.map(c=>'<option value="'+esc(c)+'">').join('')+'</datalist></label><label>Модель / размер<input name="model" maxlength="120"></label><label>Артикул / SKU<input name="sku" maxlength="100"></label><label>Закупка, ₽<input name="unit_cost" type="number" min="0" max="1000000000" step="0.01" value="0" required></label><label>Продажа, ₽<input name="retail_price" type="number" min="0" max="1000000000" step="0.01" value="0" required></label><label>Количество при создании<input name="initial_quantity" type="number" min="0" max="100000" step="1" value="0" '+(canReceive()?'':'disabled')+'></label><label>Единица измерения<input name="unit" value="шт" maxlength="20" required></label></div><p class="muted">Штрихкод FastGo присвоится автоматически.'+(canReceive()?' Начальное количество оформится отдельным приходом.':' Приход доступен на двух подключённых ноутбуках.')+'</p><label>Фотография запчасти<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><img class="new-part-preview" alt="Выбранное фото" hidden><label class="new-part-category-photo"><input name="category_primary" type="checkbox"> Сделать фото основным для категории</label><p class="new-part-status" role="status" aria-live="polite"></p><div class="actions"><button type="button" data-close>Закрыть</button><button class="primary" type="submit">Создать запчасть</button></div></form>';
  document.body.append(dialog);dialog.showModal();
  const form=dialog.querySelector('form'),submit=dialog.querySelector('[type=submit]'),status=dialog.querySelector('[role=status]'),close=dialog.querySelector('[data-close]'),fileInput=form.elements.photo;let preview='',saving=false;
  const restore=()=>{const state=loadProductIntake(localStorage,actor());if(!state)return null;for(const [name,value]of Object.entries({...state.product,initial_quantity:state.quantity})){const input=form.elements.namedItem(name);if(input){input.value=value;input.disabled=true;}}form.elements.category_primary.checked=!!state.photo?.primary;form.elements.category_primary.disabled=true;submit.textContent='Продолжить сохранение';return state;};
  try{if(restore())status.textContent='Продолжим незавершённое создание. Товар и приход не будут записаны повторно.';}catch(error){status.textContent=error.message;submit.disabled=true;submit.dataset.unavailable='true';}
  close.onclick=()=>dialog.close();dialog.addEventListener('cancel',e=>{if(saving)e.preventDefault();});dialog.onclose=()=>{if(preview)URL.revokeObjectURL(preview);dialog.remove();};
  fileInput.onchange=()=>{if(preview)URL.revokeObjectURL(preview);const file=fileInput.files[0],image=dialog.querySelector('.new-part-preview');image.hidden=!file;if(file){preview=URL.createObjectURL(file);image.src=preview;}else image.removeAttribute('src');};
  form.onsubmit=e=>{e.preventDefault();if(saving||!form.reportValidity())return;void run(async()=>{
   saving=true;submit.disabled=true;close.disabled=true;fileInput.disabled=true;
   try{const fields=new FormData(form),file=fileInput.files[0];let photo=null;
    if(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>25*1024*1024)throw Error('Выберите JPG, PNG или WebP не больше 25 МБ');const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()));photo={sha256:[...hash].map(v=>v.toString(16).padStart(2,'0')).join(''),type:file.type,primary:form.elements.category_primary.checked};}
    let state=loadProductIntake(localStorage,actor());
    if(!state)state=startProductIntake(localStorage,actor(),{product:{name:String(fields.get('name')||'').trim(),category:String(fields.get('category')||'').trim(),model:String(fields.get('model')||'').trim(),sku:String(fields.get('sku')||'').trim(),unit_cost:Number(fields.get('unit_cost')||0),retail_price:Number(fields.get('retail_price')||0),unit:String(fields.get('unit')||'шт')},quantity:Number(fields.get('initial_quantity')||0),photo});
    restore();if(state.quantity>0&&!canReceive())throw Error('Завершите сохранённый приход на разрешённом складском ноутбуке.');
    if(state.photo&&!state.photoSaved&&(!photo||photo.sha256!==state.photo.sha256||photo.type!==state.photo.type))throw Error('Для продолжения выберите то же фото. Товар и приход сохранены.');
    const part=await continueProductIntake(localStorage,actor(),{api,onProgress:text=>status.textContent=text,uploadPhoto:(part,metadata,id)=>photos.upload(part,file,id,metadata.primary,text=>status.textContent=text)});
    await refresh();dialog.close();openProduct(parts().find(p=>p.id===part.id)||part);message('Запчасть создана. '+(state.quantity>0?'Приход сохранён. ':'')+(state.photo?'Фотография сохранена.':''));
   }catch(error){if(dialog.isConnected)status.textContent=error.message;throw error;}finally{saving=false;if(dialog.isConnected){submit.disabled=false;close.disabled=false;fileInput.disabled=false;}}
  });};
  form.elements.name.focus();
 };
}
