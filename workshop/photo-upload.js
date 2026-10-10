const prepared=new WeakMap(),completed=new WeakMap();
export async function preparePhoto(file){
 if(prepared.has(file))return prepared.get(file);
 const task=(async()=>{
  if(file.size>25*1024*1024)throw new Error('Фото '+file.name+' больше 25 МБ');
  const url=URL.createObjectURL(file),img=new Image();
  try{
   await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Не удалось прочитать '+file.name+'. Выберите снимок в JPG, PNG или WebP.'));img.src=url;});
   const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
   const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.82));if(!blob)throw new Error('Не удалось подготовить фото '+file.name);
   if(blob.size>=file.size&&['image/jpeg','image/png','image/webp'].includes(file.type)&&scale===1)return file;
   return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg',lastModified:file.lastModified});
  }finally{URL.revokeObjectURL(url);}
 })();prepared.set(file,task);return task;
}
const base64=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Не удалось прочитать файл'));reader.readAsDataURL(file);});
export async function uploadOrderFiles(api,kind,id,files,slot,progress){
 const key=kind+':'+id+':'+slot;
 for(let i=0;i<files.length;i++){
  const original=files[i];if(completed.get(original)?.has(key))continue;
  progress?.(`Подготовка ${i+1} из ${files.length}: ${original.name}`);
  const file=slot==='photos'?await preparePhoto(original):original;
  if(file.size>10*1024*1024)throw new Error('Файл '+file.name+' больше 10 МБ');
  if(!['image/jpeg','image/png','image/webp',...(slot==='signed'?['application/pdf']:[])].includes(file.type))throw new Error('Выберите JPG, PNG, WebP'+(slot==='signed'?' или PDF':''));
  progress?.(`Отправка ${i+1} из ${files.length}: ${file.name} · ${Math.ceil(file.size/1024)} КБ`);
  const result=await api('upload',{kind,id,slot,content_type:file.type,file_name:file.name,content_base64:await base64(file)});
  if(!result?.path)throw new Error('Сервер не подтвердил загрузку '+file.name);
  if(!completed.has(original))completed.set(original,new Set());completed.get(original).add(key);
 }
 return true;
}
