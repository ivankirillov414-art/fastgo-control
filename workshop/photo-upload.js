export const videoType=file=>file.type||({'mp4':'video/mp4','mov':'video/quicktime','webm':'video/webm'}[file.name.split('.').pop().toLowerCase()]||'');
const prepared=new WeakMap(),preparedParts=new WeakMap(),completed=new WeakMap();
export const preparePhoto=file=>prepareImage(file,prepared);
export const preparePartPhoto=file=>prepareImage(file,preparedParts,true);
async function prepareImage(file,cache,compact=false){
 if(cache.has(file))return cache.get(file);
 const task=(async()=>{
  if(file.size>25*1024*1024)throw new Error('Фото '+file.name+' больше 25 МБ');
  const url=URL.createObjectURL(file),img=new Image();
  try{
   await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Не удалось прочитать '+file.name+'. Выберите снимок в JPG, PNG или WebP.'));img.src=url;});
   const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
   const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
   let blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.82));
   // WebKit and Chromium encode JPEG quality differently. Bound large parts
   // photos by measured bytes, while keeping 1600 px for labels and markings.
   if(compact)for(const quality of [.72,.62,.52]){if(!blob||blob.size<=750*1024)break;blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));}
   if(!blob)throw new Error('Не удалось подготовить фото '+file.name);
   if(blob.size>=file.size&&['image/jpeg','image/png','image/webp'].includes(videoType(file))&&scale===1)return file;
   return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg',lastModified:file.lastModified});
  }finally{URL.revokeObjectURL(url);}
 })();cache.set(file,task);return task;
}
export const fileBase64=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Не удалось прочитать файл'));reader.readAsDataURL(file);});
export async function uploadOrderFiles(api,kind,id,files,slot,progress){
 const key=kind+':'+id+':'+slot;
 for(let i=0;i<files.length;i++){
  const original=files[i];if(completed.get(original)?.has(key))continue;
  progress?.(`Подготовка ${i+1} из ${files.length}: ${original.name}`);
  const mime=videoType(original),isVideo=['video/mp4','video/quicktime','video/webm'].includes(mime);
  const file=slot==='photos'&&!isVideo?await preparePhoto(original):original;
  if(file.size>10*1024*1024)throw new Error('Файл '+file.name+' больше 10 МБ');
  if(!['image/jpeg','image/png','image/webp',...(slot==='signed'?['application/pdf']:['video/mp4','video/quicktime','video/webm'])].includes(videoType(file)))throw new Error('Выберите JPG, PNG, WebP'+(slot==='signed'?' или PDF':', MP4, MOV или WebM'));
  progress?.(`Отправка ${i+1} из ${files.length}: ${file.name} · ${Math.ceil(file.size/1024)} КБ`);
  const result=await api('upload',{kind,id,slot,content_type:videoType(file),file_name:file.name,content_base64:await fileBase64(file)});
  if(!result?.path)throw new Error('Сервер не подтвердил загрузку '+file.name);
  if(!completed.has(original))completed.set(original,new Set());completed.get(original).add(key);
 }
 return true;
}
