import {backupApi,esc} from './core.js';
const time=value=>value?new Date(value).toLocaleString('ru-RU'):'Ещё не получено';
const app=name=>({desktop:'FastGo',warehouse:'FastGo Склад',tsd:'FastGo ТСД'})[name]||name;
export async function renderRecoveryStatus(host){
 host.innerHTML='<h2>Резервные копии на сервере и ноутбуках</h2><p>Проверяем сохранённые копии…</p>';
 try{
  const status=await backupApi('status');if(!host.isConnected)return;const s=status.snapshot;
  host.innerHTML='<h2>Резервные копии на сервере и ноутбуках</h2><p>'+esc(s?'Снимок базы от '+time(s.created_at)+' · таблиц: '+s.tables+' · файлов: '+s.media_present+' из '+s.media_expected:'Сервер готовит первую копию')+'</p>'+(status.server?.last_error?'<p class="error">'+esc(status.server.last_error)+'</p>':'')+
   '<p class="muted">Сервер проверяет изменения каждые пять минут. При изменениях новый снимок создаётся через 15 минут, полный контрольный снимок — каждый час. Ноутбуки сверяют копии каждую минуту. Завершённой считается копия со всеми фотографиями и документами.</p>'+
   status.devices.map(d=>'<section class="panel"><h3>'+esc(d.host||'Ноутбук')+' · '+esc(app(d.app))+'</h3><p>'+esc(d.media_present+' из '+d.media_expected+' файлов · последняя связь: '+time(d.last_seen))+'</p><p>'+esc(d.verified_at?'Проверено восстановлением: '+time(d.verified_at):'Зашифрованная копия: '+(d.media_present===d.media_expected&&d.source_version!==null?'получена; проверка восстановления ещё не подтверждена':'загружается'))+'</p>'+(d.last_error?'<p class="error">'+esc(d.last_error)+'</p>':'')+'</section>').join('')+
   '<h3>Приложения на устройствах</h3>'+status.applications.map(d=>'<p>'+esc(app(d.app)+' · '+(d.details?.host||'ТСД')+' · '+d.version+' · '+time(d.last_seen))+(d.details?.blocking_reason?'<br>'+esc(d.details.blocking_reason):'')+(d.details?.error?'<br>'+esc(d.details.error):'')+'</p>').join('')+'<button class="btn secondary" type="button" data-backup-refresh>Проверить состояние</button>';
  host.querySelector('[data-backup-refresh]').onclick=()=>void renderRecoveryStatus(host);
 }catch(error){if(host.isConnected)host.innerHTML='<h2>Резервные копии</h2><p class="error">'+esc(error.message)+'</p>';}
}
