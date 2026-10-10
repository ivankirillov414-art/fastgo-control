// Own a camera session, including cancellation while permission is still pending.
export function createSaleCamera({loadReader,video,onCode,onStatus}){
 let generation=0,controls=null;
 const stop=()=>{
  generation++;
  try{controls?.stop();}catch{}
  controls=null;
  const stream=video.srcObject;
  stream?.getTracks?.().forEach(track=>track.stop());
  video.srcObject=null;
 };
 const start=async()=>{
  stop();const session=generation;onStatus('Запускаем камеру…');
  try{
   const Reader=await loadReader();if(session!==generation)return;
   const reader=new Reader();
   const active=await reader.decodeFromConstraints({audio:false,video:{facingMode:{ideal:'environment'}}},video,result=>{
    if(session!==generation||!result?.getText)return;
    const code=String(result.getText()||'').trim();if(!code)return;
    stop();onCode(code);
   });
   if(session!==generation){active?.stop();return;}
   controls=active;onStatus('Наведите камеру на штрих-код товара');
  }catch(e){
   if(session!==generation)return;
   stop();onStatus(e?.name==='NotAllowedError'?'Разрешите доступ к камере или воспользуйтесь поиском.':'Камера недоступна. Повторите запуск или найдите товар вручную.');
  }
 };
 return {start,stop};
}
