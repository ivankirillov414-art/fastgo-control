import {createDailyCheck} from '../warehouse-desktop/update-clock.cjs';
// The page and its bundled assets share one content-derived version.
export function createWebUpdater({version,fetchVersion,fetchPage,canApply,apply,notify=()=>{}}){
 let pending=null,checking=false,applying=false,immediate=false;
 async function tick(){
  if(!pending||applying)return;
  applying=true;
  try{if(!await canApply(immediate)){notify('Обновление экрана готово · применится после завершения работы');return;}apply(pending);pending=null;immediate=false;}
  catch{notify('Обновление экрана отложено. Повторим автоматически.');}
  finally{applying=false;}
 }
 async function check(){
  if(checking||applying)return;checking=true;
  try{const next=await fetchVersion();if(!/^[a-f0-9]{24}$/.test(next)||next===version){if(next===version){pending=null;if(immediate)notify('Установлена актуальная версия экрана · '+version);immediate=false;}return;}
   // Do not reload into an HTML/manifest pair from different deployments.
   if(await fetchPage(next)!==next){notify('Публикация обновления ещё идёт. Повторите проверку позже.');return;}
   pending=next;notify('Доступно обновление экрана');
  }catch{if(immediate)notify('Не удалось проверить обновление. Проверьте интернет и повторите.');}finally{checking=false;}
  await tick();
 }
 return {check,tick,now:async()=>{immediate=true;notify('Проверка версии…');await check();await tick();}};
}

export function startWebUpdates({canApply}){
 const version=document.querySelector('meta[name="warehouse-web-version"]')?.content;
 if(!version)return null;
 const get=async url=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const r=await fetch(url,{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error('Нет связи');return r;}finally{clearTimeout(timer);}};
 const updater=createWebUpdater({version,
  fetchVersion:async()=>{const u=new URL('warehouse/web-version.json',location.href);u.searchParams.set('check',Date.now());return(await(await get(u)).json()).version;},
  fetchPage:async next=>{const u=new URL(location.href);u.searchParams.set('ui',next);const html=await(await get(u)).text();return new DOMParser().parseFromString(html,'text/html').querySelector('meta[name="warehouse-web-version"]')?.content;},
  canApply,
  apply:next=>{document.body.inert=true;const u=new URL(location.href);u.searchParams.set('ui',next);location.replace(u.href);},
  notify:text=>{const el=document.getElementById('web-update-status');if(el)el.textContent=text;}
 });
 const daily=createDailyCheck({read:()=>{try{return localStorage.getItem('warehouse-update-day');}catch{return ''; }},write:day=>{try{localStorage.setItem('warehouse-update-day',day);}catch{}},check:updater.check});
 setTimeout(()=>void updater.check(),5000);setInterval(()=>void updater.check(),60000);setInterval(()=>void updater.tick(),5000);
 window.addEventListener('online',()=>void updater.check());
 return updater;
}
