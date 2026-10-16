const mb=value=>(Math.max(0,Number(value)||0)/1048576).toFixed(1).replace('.',',')+' МБ';
export function updateView(state={}){
 const u=state.update||{},version=u.version?' '+u.version:'';
 switch(u.status){
  case 'checking':return {title:'Проверяем обновления',detail:'Подключаемся к серверу обновлений…',stage:0,busy:true};
  case 'downloading':{
   const percent=Math.max(0,Math.min(100,Number(u.progress)||0));
   return {title:'Загружаем обновление'+version,detail:percent>=100?'Загрузка завершена. Проверяем файл перед установкой.':u.total?mb(u.transferred)+' из '+mb(u.total)+(u.bytesPerSecond?' · '+mb(u.bytesPerSecond)+'/с':''):'Начинаем загрузку…',stage:1,busy:true,percent};
  }
  case 'ready':return {title:'Обновление'+version+' загружено',detail:u.waitReason||(u.immediate?'Подготавливаем установку…':'Установим автоматически после двух минут бездействия на главной.'),stage:2,busy:true,waiting:!!u.waitReason};
  case 'preparing':return {title:'Подготавливаем установку',detail:'Сохраняем резервную копию базы. Приложение откроется снова автоматически.',stage:2,busy:true,locked:true};
  case 'installing':return {title:'Устанавливаем обновление'+version,detail:'Сейчас откроется окно установки с полосой прогресса. FastGo запустится снова автоматически.',stage:3,busy:true,locked:true};
  case 'current':return {title:'Установлена актуальная версия',detail:'FastGo '+(state.version||'')+' — обновление не требуется.',stage:3,done:true};
  case 'error':return {title:'Обновление не завершено',detail:u.error||'Не удалось связаться с сервером. Проверьте интернет и повторите.',stage:0,error:true};
  case 'development':return {title:'Обновление недоступно',detail:'Проверка обновлений работает в установленной версии FastGo.',stage:0,error:true};
  default:return {title:'Обновление FastGo',detail:'Проверим версию и установим обновление, если оно доступно.',stage:0};
 }
}

export function installUpdateProgress({native,window,document}){
 const style=document.createElement('style');style.textContent=`
 #desktop-update-progress{width:min(440px,calc(100vw - 32px));max-width:440px;box-sizing:border-box;border:1px solid #37546c;border-radius:16px;padding:24px;background:#102238;color:#edf6ff;box-shadow:0 22px 80px #0008}
 #desktop-update-progress::backdrop{background:#030a14a6}
 #desktop-update-progress h2{font-size:21px;line-height:1.3;margin:0 0 12px}
 #desktop-update-progress p{font-size:14px;line-height:1.5;color:#b4c9df;overflow-wrap:anywhere;margin:12px 0}
 #desktop-update-progress .update-meter{display:flex;align-items:center;gap:12px;margin:20px 0 12px}
 #desktop-update-progress progress{display:block;appearance:none;flex:1;min-width:0;height:9px;border:0;border-radius:8px;overflow:hidden;background:#263e55;accent-color:#1ad6e5}
 #desktop-update-progress progress::-webkit-progress-bar{background:#263e55;border-radius:8px}
 #desktop-update-progress progress::-webkit-progress-value{background:#1ad6e5;border-radius:8px;transition:width .15s}
 #desktop-update-progress progress:indeterminate{background:linear-gradient(90deg,#263e55 15%,#1ad6e5 48%,#263e55 80%);background-size:220% 100%;animation:fastgo-progress 1.5s linear infinite}
 #desktop-update-progress progress:indeterminate::-webkit-progress-bar{background:transparent}
 #desktop-update-progress .update-percent{font-size:18px;font-weight:700;color:#29e2ea;min-width:44px;text-align:right}
 #desktop-update-progress ol{display:flex;list-style:none;gap:8px;padding:0;margin:20px 0;font-size:11px;color:#91a7bd}
 #desktop-update-progress li{flex:1;border-top:2px solid #304a63;padding-top:7px}
 #desktop-update-progress li[data-active=true]{border-color:#22dcea;color:#d4faff}
 #desktop-update-progress .actions{display:flex;justify-content:flex-end;margin:18px 0 0;gap:10px}
 #desktop-update-progress .btn{font-size:13px;min-height:38px;padding:8px 14px}
 #desktop-update-progress [hidden]{display:none!important}
 #desktop-update-progress [data-error=true]{color:#ffb8b8}
 #desktop-update-text{cursor:pointer;-webkit-app-region:no-drag}
 @keyframes fastgo-progress{from{background-position:110% 0}to{background-position:-110% 0}}
 @media(prefers-reduced-motion:reduce){#desktop-update-progress progress:indeterminate{animation:none}}
 `;document.head.append(style);
 const dialog=document.createElement('dialog');dialog.id='desktop-update-progress';dialog.setAttribute('aria-labelledby','desktop-update-title');
 dialog.innerHTML='<h2 id="desktop-update-title">Обновление FastGo</h2><div class="update-meter"><progress max="100" aria-label="Ход обновления"></progress><span class="update-percent" hidden></span></div><p id="desktop-update-detail" role="status" aria-live="polite"></p><ol aria-label="Этапы обновления"><li>Проверка</li><li>Загрузка</li><li>Подготовка</li><li>Установка</li></ol><div class="actions"><button class="btn ghost" type="button" data-background>В фоне</button><button class="btn" type="button" data-retry hidden>Повторить</button></div>';
 document.body.append(dialog);
 let locked=false,requesting=false,readSequence=0;
 const paint=state=>{
  const v=updateView(state);locked=!!v.locked;
  dialog.querySelector('h2').textContent=v.title;
  const detail=dialog.querySelector('#desktop-update-detail');detail.textContent=v.detail;detail.dataset.error=String(!!v.error);
  const meter=dialog.querySelector('.update-meter'),bar=dialog.querySelector('progress'),percent=dialog.querySelector('.update-percent');
  meter.hidden=!!v.error||!!v.done;
  if(v.percent===undefined){bar.removeAttribute('value');percent.hidden=true;}else{bar.value=v.percent;percent.textContent=v.percent+'%';percent.hidden=false;}
  bar.setAttribute('aria-label',v.percent===undefined?v.title:'Загрузка обновления');
  dialog.querySelectorAll('li').forEach((li,i)=>li.dataset.active=String(i<=v.stage));
  const back=dialog.querySelector('[data-background]');back.disabled=locked;back.textContent=v.waiting?'Вернуться к работе':v.busy?'В фоне':'Закрыть';
  const retry=dialog.querySelector('[data-retry]');retry.hidden=!v.error;retry.disabled=requesting;
 };
 const refresh=async()=>{const seq=++readSequence;try{const state=await native.state();if(seq===readSequence)paint(state);}catch(error){if(!locked&&seq===readSequence)paint({update:{status:'error',error:error.message}});}};
 const open=async()=>{if(!dialog.open)dialog.showModal();await refresh();};
 const start=async()=>{
  if(requesting)return;requesting=true;
  paint({update:{status:'checking'}});if(!dialog.open)dialog.showModal();
  try{await native.updateNow();await refresh();}catch(error){paint({update:{status:'error',error:error.message}});}finally{requesting=false;dialog.querySelector('[data-retry]').disabled=false;}
 };
 dialog.querySelector('[data-background]').onclick=()=>{if(!locked)dialog.close();};
 dialog.querySelector('[data-retry]').onclick=start;
 dialog.addEventListener('cancel',event=>{if(locked)event.preventDefault();});
 native.onUpdate(refresh);
 window.setInterval(()=>{if(dialog.open)void refresh();},1000);
 return {start,open};
}
