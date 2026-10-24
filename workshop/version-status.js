const native=window.fastgoDesktop;
if(native){
 const endpoint='https://oqgpjfikjpcplnxueoki.supabase.co/functions/v1/fastgo-app-version';
 let busy=false,result=null,error='',installed='';
 const device=()=>{let id=localStorage.getItem('fastgo_version_device');if(!id){id=crypto.randomUUID();localStorage.setItem('fastgo_version_device',id);}return id;};
 function panel(){
  const dialog=document.getElementById('desktop-settings');if(!dialog?.querySelector('#desktop-check-update'))return;
  let section=dialog.querySelector('#desktop-version-status');
  if(!section){section=document.createElement('section');section.id='desktop-version-status';section.setAttribute('aria-live','polite');section.innerHTML='<h3>Версия приложения</h3><p data-installed></p><p data-latest></p><p data-seen class="muted"></p><button type="button" class="btn secondary small">Проверить версию</button>';const anchor=dialog.querySelector('h3');if(anchor)anchor.before(section);else dialog.prepend(section);section.querySelector('button').onclick=async()=>{try{await native.checkUpdates();}catch{}await report();};}
  const set=(selector,text)=>{const node=section.querySelector(selector);if(node.textContent!==text)node.textContent=text;};
  set('[data-installed]','Установлена: '+(installed||'проверяем…'));
  const states={current:'актуальная',outdated:'доступно обновление',ahead:'новее опубликованной',unknown:'не удалось сверить'};
  set('[data-latest]','Последняя доступная: '+(result?.latest||'не определена')+(result?' · '+states[result.state]:''));
  set('[data-seen]',error||(result?'Версия передана на сервер: '+new Date(result.last_seen).toLocaleString('ru-RU'):'Версия будет передана после входа и подключения к сети.'));
  section.querySelector('button').disabled=busy;
 }
 async function report(){
  if(busy)return;busy=true;error='';
  try{
   const state=await native.state();installed=state.version;panel();const session=await native.getSession();if(!session?.access_token){result=null;return;}
   const response=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({device_id:device(),version:installed}),signal:AbortSignal.timeout(20000)});
   const value=await response.json();if(!response.ok||!value.data)throw Error(value.error||'Проверка версии недоступна');result=value.data;
   const station=await native.warehouseStation?.();
   if(station)await native.request('/functions/v1/fastgo-warehouse',{action:'device_status',device_id:station.id,device_token:station.token,app:'desktop',version:installed,host:state.host,background:state.background,update_status:state.update?.status,latest_version:state.update?.version||result.latest,blocking_reason:state.update?.waitReason,pending_writes:state.pending});
  }catch(e){error=e.message;}finally{busy=false;panel();}
 }
 const observer=new MutationObserver(panel);observer.observe(document.body,{childList:true,subtree:true});
 window.addEventListener('online',report);setTimeout(report,5000);setInterval(report,60000);
}
