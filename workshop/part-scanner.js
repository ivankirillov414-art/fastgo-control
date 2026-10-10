import {createSaleCamera} from './sale-camera.js';
import {loadLibrary} from './library-loader.js';

const ZXING_URL=new URL('../vendor/zxing-browser-0.2.1.min.js',import.meta.url).href;
let currentScanner=null;

const element=(tag,className,text)=>{
 const node=document.createElement(tag);
 if(className)node.className=className;
 if(text!==undefined)node.textContent=text;
 return node;
};

// The caller applies a code to its existing draft and checks signal after lookups.
export function openPartScanner({onCode,isActive=()=>true}){
 if(typeof onCode!=='function')throw new TypeError('onCode must be a function');
 currentScanner?.close();
 const parentForm=document.getElementById('order-form'),opener=document.activeElement;
 const abortController=new AbortController(),{signal}=abortController;
 let closed=false,busy=false,camera=null,observer=null;
 const dialog=element('dialog');dialog.id='repair-part-scanner';dialog.setAttribute('aria-labelledby','repair-part-scanner-title');
 const header=element('div','part-scanner-header'),title=element('h2','','Сканировать запчасть');title.id='repair-part-scanner-title';
 const closeButton=element('button','btn ghost small','×');closeButton.type='button';closeButton.dataset.partScanClose='';closeButton.setAttribute('aria-label','Закрыть сканер');
 header.append(title,closeButton);
 const body=element('div','part-scanner-body');
 const hint=element('p','muted','Наведите камеру на штрихкод или QR-код запчасти.');
 const cameraView=element('div','part-scanner-camera');
 const video=element('video');video.id='repair-part-video';video.muted=true;video.autoplay=true;video.playsInline=true;video.setAttribute('muted','');video.setAttribute('playsinline','');
 const line=element('span','part-scanner-line');line.setAttribute('aria-hidden','true');cameraView.append(video,line);
 const cameraStatus=element('p','muted');cameraStatus.id='repair-part-camera-status';cameraStatus.setAttribute('role','status');
 const retry=element('button','btn secondary','Сканировать ещё');retry.type='button';retry.id='repair-part-retry';
 const form=element('form','part-scanner-form');form.id='repair-part-form';
 const label=element('label','','Штрихкод или артикул');label.htmlFor='repair-part-code';
 const inputRow=element('div','part-scanner-input-row'),input=element('input');input.id='repair-part-code';input.name='code';input.type='text';input.required=true;input.autocomplete='off';input.autocapitalize='none';input.spellcheck=false;input.inputMode='text';input.placeholder='FGP-00000001';input.setAttribute('aria-describedby','repair-part-code-hint');
 const submit=element('button','btn','Добавить');submit.type='submit';submit.id='repair-part-add';inputRow.append(input,submit);
 const manualHint=element('p','muted','Для USB- или Bluetooth-сканера нажмите на поле и отсканируйте код. Enter добавит запчасть.');manualHint.id='repair-part-code-hint';
 form.append(label,inputRow,manualHint);
 const feedback=element('p','part-scanner-feedback');feedback.id='repair-part-feedback';feedback.hidden=true;feedback.setAttribute('aria-atomic','true');
 const saveHint=element('p','muted part-scanner-save-hint','Запчасть добавится в текущий ремонт. Затем нажмите «Сохранить изменения» в карточке.');
 body.append(hint,cameraView,cameraStatus,retry,form,feedback,saveHint);
 const footer=element('div','part-scanner-footer'),doneButton=element('button','btn ghost','Готово');doneButton.type='button';doneButton.dataset.partScanClose='';footer.append(doneButton);
 dialog.append(header,body,footer);

 const active=()=>{
  if(closed||signal.aborted||!dialog.isConnected||parentForm&&!parentForm.isConnected)return false;
  try{return !!isActive();}catch{return false;}
 };
 const fitViewport=()=>{
  const editing=dialog.contains(document.activeElement)&&document.activeElement.matches('input,textarea');
  dialog.style.setProperty('--part-scanner-viewport-height',editing&&window.visualViewport?window.visualViewport.height+'px':'100dvh');
 };
 const close=()=>{
  if(closed)return;closed=true;abortController.abort();camera?.stop();observer?.disconnect();
  window.removeEventListener('hashchange',close);window.removeEventListener('pagehide',close);window.removeEventListener('workshop-auth-required',close);
  window.removeEventListener('resize',fitViewport);window.visualViewport?.removeEventListener('resize',fitViewport);
  document.removeEventListener('visibilitychange',onVisibility);
  dialog.removeEventListener('focusin',fitViewport);dialog.removeEventListener('focusout',fitViewport);
  dialog.removeEventListener('close',close);dialog.removeEventListener('cancel',onCancel);
  if(dialog.open)dialog.close();dialog.remove();if(currentScanner===handle)currentScanner=null;
  if(opener?.isConnected&&document.visibilityState==='visible')opener.focus?.({preventScroll:true});
 };
 const handle={close};
 const onCancel=event=>{event.preventDefault();close();};
 const pauseCamera=()=>{camera?.stop();cameraView.hidden=true;cameraStatus.textContent='Камера остановлена. Для следующего кода нажмите «Сканировать ещё».';};
 const onVisibility=()=>{if(document.visibilityState==='hidden')pauseCamera();};
 const showFeedback=(message,error=false)=>{
  feedback.textContent=String(message);feedback.dataset.state=error?'error':'success';feedback.setAttribute('role',error?'alert':'status');feedback.setAttribute('aria-live',error?'assertive':'polite');feedback.hidden=false;
 };
 const setBusy=value=>{busy=value;input.disabled=value;submit.disabled=value;retry.disabled=value;submit.textContent=value?'Добавляем…':'Добавить';};
 const addCode=async(raw,source)=>{
  if(!active()){close();return;}
  if(busy)return;
  const code=String(raw??'').trim();if(!code){showFeedback('Введите штрихкод или артикул запчасти.',true);return;}
  setBusy(true);pauseCamera();input.value=code;showFeedback('Добавляем запчасть…');
  try{
   const message=await onCode(code,{signal});
   if(!active()){close();return;}
   input.value='';showFeedback(typeof message==='string'&&message.trim()?message:'Запчасть добавлена в ремонт.');
  }catch(error){
   if(!active()){close();return;}
   showFeedback(error?.message||'Не удалось добавить запчасть. Проверьте код и повторите.',true);
  }finally{
   if(active()){
    setBusy(false);
    if(source==='manual'){input.focus({preventScroll:true});input.select();}else retry.focus({preventScroll:true});
   }
  }
 };
 const startCamera=()=>{
  if(!active()){close();return;}
  if(busy)return;
  input.blur();feedback.hidden=true;cameraView.hidden=false;fitViewport();camera.start();
 };
 camera=createSaleCamera({
  video,
  loadReader:async()=>{const reader=await loadLibrary(ZXING_URL,'ZXingBrowser');return reader.BrowserMultiFormatReader;},
  onCode:code=>{void addCode(code,'camera');},
  onStatus:message=>{if(active())cameraStatus.textContent=message;else close();}
 });
 closeButton.onclick=doneButton.onclick=close;retry.onclick=startCamera;
 form.onsubmit=event=>{event.preventDefault();void addCode(input.value,'manual');};
 dialog.addEventListener('close',close);dialog.addEventListener('cancel',onCancel);
 dialog.addEventListener('focusin',fitViewport);dialog.addEventListener('focusout',fitViewport);
 window.addEventListener('hashchange',close);window.addEventListener('pagehide',close);window.addEventListener('workshop-auth-required',close);
 window.addEventListener('resize',fitViewport);window.visualViewport?.addEventListener('resize',fitViewport);
 document.addEventListener('visibilitychange',onVisibility);
 document.body.append(dialog);currentScanner=handle;
 observer=new MutationObserver(()=>{if(!active())close();});observer.observe(document.body,{childList:true,subtree:true});
 if(!active()){close();return handle;}
 dialog.showModal();closeButton.focus({preventScroll:true});fitViewport();startCamera();
 return handle;
}
