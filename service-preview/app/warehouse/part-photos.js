import {esc,uuid,userId} from './client.js';
import {preparePartPhoto,fileBase64} from '../workshop/photo-upload.js';
import {displayPrivatePhoto} from '../workshop/private-photo.js';

export function partPhotos({api,editable,run,changed,message}){
 let observer;const thumbnails=[];
 const cacheKey=(part,path)=>userId()&&path?userId()+':'+part.id+':'+path:undefined;
 const placeholder='<span aria-hidden="true">▧</span>';
 function thumbnail(part){return '<span class="inventory-photo" data-photo="'+esc(part.id)+'">'+(part.primary_photo_path?'<img alt="Фото: '+esc(part.name)+'">':placeholder)+'</span>';}
 function bindThumbnails(host,parts){
  observer?.disconnect();thumbnails.splice(0).forEach(stop=>stop());
  const load=el=>{const part=parts.find(p=>p.id===el.dataset.photo),img=el.querySelector('img');if(!img||!part)return;
   thumbnails.push(displayPrivatePhoto(img,{cacheKey:cacheKey(part,part.primary_photo_path),getUrl:async()=>(await api('part_photo_url',{part_id:part.id})).url,onError:()=>{if(el.isConnected){el.innerHTML=placeholder;el.title='Не удалось загрузить фото. Откройте карточку для повтора.';}}}));
  };
  if(typeof IntersectionObserver==='undefined'){host.querySelectorAll('[data-photo]').forEach(load);return;}
  observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);load(entry.target);}},{rootMargin:'180px'});
  host.querySelectorAll('[data-photo]').forEach(el=>observer.observe(el));
 }
 async function upload(part,file,requestId=uuid(),primaryForCategory=false,onProgress=()=>{}){
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>25*1024*1024)throw Error('Выберите JPG, PNG или WebP не больше 25 МБ');
  onProgress('Подготавливаем фотографию…');const prepared=await preparePartPhoto(file);
  if(prepared.size>5*1024*1024)throw Error('Фото после сжатия должно быть не больше 5 МБ');
  onProgress('Сохраняем фото · '+Math.ceil(prepared.size/1024)+' КБ…');
  const result=await api('part_photo_upload',{part_id:part.id,request_id:requestId,content_type:prepared.type,content_base64:await fileBase64(prepared),primary_for_category:primaryForCategory});
  if(!result?.path)throw Error('Сервер не подтвердил сохранение фотографии. Повторите загрузку.');
  part.primary_photo_path=result.path;return result;
 }
 function mount(host,part){
  let pending=null,saving=false,stopped=false,viewer=null;const cleanups=[];
  host.innerHTML='<div class="product-photo-heading"><h3>Фотографии</h3>'+(editable()?'<label class="photo-upload-button">Добавить фото<input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Добавить фотографию запчасти"></label>':'')+'</div><div class="product-photo-gallery">Загружаем фотографии…</div><div class="product-photo-thumbs" aria-label="Выбор фотографии"></div><p class="photo-status" role="status" aria-live="polite"></p><button type="button" class="photo-retry" hidden>Повторить загрузку</button>';
  const gallery=host.querySelector('.product-photo-gallery'),status=host.querySelector('.photo-status'),input=host.querySelector('input'),retry=host.querySelector('.photo-retry');
  const current=()=>!stopped&&host.isConnected;
  function closeViewer(){if(viewer){const old=viewer;viewer=null;old.close();old.remove();}}
  function enlarge(img){if(!img.naturalWidth||saving)return;closeViewer();viewer=document.createElement('dialog');viewer.className='product-photo-viewer';viewer.setAttribute('aria-label','Фотография: '+part.name);const big=document.createElement('img');big.src=img.src;big.alt=part.name;const close=document.createElement('button');close.type='button';close.className='product-close';close.setAttribute('aria-label','Закрыть фотографию');close.textContent='×';close.onclick=closeViewer;viewer.append(big,close);document.body.append(viewer);const owned=viewer;owned.onclose=()=>{owned.remove();if(viewer===owned)viewer=null;};owned.onclick=e=>{if(e.target===owned)closeViewer();};owned.showModal();close.focus();}
  const busy=value=>{saving=value;host.closest('dialog').dataset.uploading=String(value);if(input)input.disabled=value;gallery.querySelectorAll('button').forEach(b=>b.disabled=value||b.dataset.unavailable==='true');retry.disabled=value;};
  async function save(){
   if(saving||!pending)return;
   await run(async()=>{busy(true);retry.hidden=true;try{
    if(pending.file)await upload(part,pending.file,pending.id,false,text=>{if(current())status.textContent=text;});
    else {status.textContent='Сохраняем основную фотографию…';const result=await api('part_photo_primary',{part_id:part.id,photo_id:pending.photo.id,request_id:pending.id});part.primary_photo_path=result.path;}
    pending=null;if(current())status.textContent='Фото сохранено';await changed(part);if(current())await load();message('Фотография сохранена в общей базе');
   }catch(error){if(current()){status.textContent=error.message;retry.hidden=false;}throw error;}finally{if(current())busy(false);}});
  }
  async function load(){
   try{const photos=await api('part_photos',{part_id:part.id});if(!current())return;closeViewer();cleanups.splice(0).forEach(stop=>stop());gallery.textContent=photos.length?'':'Фотографий пока нет';const thumbs=host.querySelector('.product-photo-thumbs');thumbs.replaceChildren();
    const first=Math.max(0,photos.findIndex(p=>p.primary)),cards=[],tabs=[];
    for(const [index,photo] of photos.entries()){const card=document.createElement('div');card.className='product-photo-card';card.hidden=true;card.innerHTML='<button type="button" class="product-photo-open" aria-label="Увеличить фотографию '+(index+1)+'"><img alt="'+esc(part.name)+'"><span>⤢ Увеличить</span></button>'+(editable()?'<button type="button" data-photo-primary '+(photo.primary?'disabled':'')+'>'+(photo.primary?'Основное фото':'Сделать основным')+'</button>':'');gallery.append(card);cards.push(card);
     const img=card.querySelector('img'),tab=document.createElement('button');tab.type='button';tab.className='product-photo-thumb';tab.textContent=String(index+1);tab.setAttribute('aria-label','Показать фотографию '+(index+1));thumbs.append(tab);tabs.push(tab);let started=false;
     tab.onclick=()=>{cards.forEach((c,i)=>{c.hidden=i!==index;tabs[i].setAttribute('aria-pressed',String(i===index));});if(started)return;started=true;
      cleanups.push(displayPrivatePhoto(img,{cacheKey:cacheKey(part,photo.path),isCurrent:()=>current()&&card.isConnected,getUrl:async()=>(await api('part_photo_url',{part_id:part.id,photo_id:photo.id})).url,onLoad:()=>{const preview=document.createElement('img');preview.src=img.src;preview.alt='';tab.replaceChildren(preview);},onError:()=>{img.alt='Не удалось загрузить фото';}}));
     };
     card.querySelector('.product-photo-open').onclick=()=>enlarge(img);
     const choose=card.querySelector('[data-photo-primary]');if(choose){choose.dataset.unavailable=String(!!photo.primary);choose.onclick=()=>{pending={photo,id:uuid()};void save();};}
    }
    tabs[first]?.click();
   }catch(error){if(current()){gallery.textContent='Не удалось загрузить фотографии: '+error.message;const reload=document.createElement('button');reload.type='button';reload.textContent='Обновить фотографии';reload.onclick=()=>void load();gallery.append(reload);}}
  }
  if(input)input.onchange=()=>{const file=input.files[0];if(file){pending={file,id:uuid()};void save();}};
  retry.onclick=()=>void save();void load();
  return ()=>{stopped=true;closeViewer();cleanups.forEach(stop=>stop());};
 }
 return {thumbnail,bindThumbnails,mount,upload};
}
