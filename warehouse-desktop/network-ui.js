const $=id=>document.getElementById(id),api=window.fastgoNetwork;
const rate=value=>Number.isFinite(value)?(value/1048576).toLocaleString('ru-RU',{maximumFractionDigits:2})+' МБ/с':'Нет данных';
const row=(title,value)=>{const item=document.createElement('div');item.className='row';const label=document.createElement('span'),result=document.createElement('b');label.textContent=title;result.textContent=value;item.append(label,result);return item;};
const replace=(id,items)=>$(id).replaceChildren(...items);
const message=value=>{const p=document.createElement('p');p.textContent=value;return p;};
function draw(state){
 replace('conclusions',(state.conclusions||[]).map(x=>{const p=message(x.message);p.className='notice '+x.level;return p;}));
 replace('wifi',[row('Windows',state.online?'Сеть доступна':'Нет подключения'),...(state.local?.wifi||[]).flatMap(x=>[row('Сеть',x.ssid||'Название недоступно'),row('Сигнал',x.signal_percent===null?'Windows не предоставил измерение':x.signal_percent+'%'),row('Скорость соединения',x.receive_mbps===null?'Нет измерения':x.receive_mbps+' Мбит/с')])]);
 if(!state.local?.wifi?.length)$('wifi').append(message('Сведения о Wi‑Fi ещё не получены или недоступны в Windows.'));
 const ping=state.local?.gateway_ping;replace('gateway',[row('Шлюз',ping?.status==='reply'?ping.received+' из '+ping.sent+' ответов · '+ping.average_ms+' мс':ping?.status==='no_reply'?'Не ответил на ping':'Не проверен')]);
 replace('adapters',(state.local?.adapters||[]).filter(x=>x.status==='Up').map(x=>row(x.name||'Подключение',[x.link_speed,...x.ipv4].filter(Boolean).join(' · '))));
 const d=state.download||{};replace('download',[row('Состояние',({downloading:'Загрузка',ready:'Готово к установке',checking:'Проверка версии',installing:'Установка',error:'Ошибка',current:'Обновление не требуется'})[d.status]||'Нет активной загрузки'),row('Скорость',d.status==='downloading'?rate(d.bytes_per_second):'Измеряется во время скачивания'),row('Получено',(Number(d.transferred||0)/1048576).toLocaleString('ru-RU',{maximumFractionDigits:1})+' МБ'),...(d.stalled_seconds>=15?[row('Без новых данных',d.stalled_seconds+' сек.')]:[]),...(d.error?[message(d.error)]:[])]);
 const probes=state.probes||{};replace('probes',['api','feed','download'].map(key=>{const p=probes[key],label=({api:'Сервер FastGo',feed:'Список обновлений',download:'Файл установщика'})[key];return row(label,!p?'Не проверен':p.reachable?(p.ok?'Отвечает':'Ответ с ошибкой')+' · HTTP '+p.status+' · '+p.elapsed_ms+' мс':'Нет ответа · '+(p.error==='timeout'?'превышено время ожидания':p.error==='manifest_invalid'?'неверный адрес в списке':'сбой соединения'));}));
 if(probes.dns)$('probes').append(row('DNS',probes.dns.ok?'Адреса разрешаются':'Есть ошибки разрешения адресов'));
 replace('history',(state.history||[]).slice(-30).reverse().map(x=>{const p=document.createElement('div');p.className='row';p.textContent=({online:'Связь восстановлена',offline:'Windows сообщил об отсутствии сети',wifi_connected:'Wi‑Fi подключён',wifi_failed:'Неудачное подключение Wi‑Fi',wifi_disconnected:'Wi‑Fi отключён',update_error:'Ошибка загрузки обновления'})[x.kind]||x.kind;const small=document.createElement('small');small.textContent=new Date(x.at).toLocaleString('ru-RU')+(x.reason?' · '+x.reason:'');p.append(small);return p;}));
 if(!state.history?.length)$('history').append(message('Событий не зарегистрировано. История Windows появится после проверки.'));
 if(state.local?.warnings?.includes('wlan_history_unavailable'))$('history').append(message('Windows не предоставил журнал Wi‑Fi. Это не означает, что обрывов не было.'));
 if(state.history_error)$('history').append(message(state.history_error));
 $('progress').textContent=state.busy?'Проверяем сеть…':state.sampled_at?'Проверено: '+new Date(state.sampled_at).toLocaleTimeString('ru-RU'):'Проверка ещё не выполнялась';
}
let running=false;
$('probe').onclick=async()=>{if(running)return;running=true;$('probe').disabled=true;$('progress').textContent='Проверяем сеть…';try{draw(await api.probe());}catch{$('progress').textContent='Проверка не завершилась. Повторите после восстановления связи.';}finally{running=false;$('probe').disabled=false;}};
$('save').onclick=async()=>{if($('save').disabled)return;$('save').disabled=true;try{const result=await api.save();if(result.saved)$('progress').textContent='Отчёт сохранён';}catch{$('progress').textContent='Не удалось сохранить отчёт';}finally{$('save').disabled=false;}};
const update=async()=>{if(running)return;try{draw(await api.status());}catch{}};setInterval(update,2000);void update();
