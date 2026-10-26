const endpoint='https://oqgpjfikjpcplnxueoki.supabase.co/functions/v1/fastgo-repair-status';
const token=location.hash.slice(1),legacy=token.startsWith('repair=')?new URLSearchParams(token).get('repair'):null,view=document.getElementById('view'),error=document.getElementById('error'),button=document.getElementById('refresh');
const labels={accepted:['Приняли вашу технику','Ремонт ещё не начат.'],diagnostics:['Проверяем технику','Мастер выясняет причину неисправности.'],waiting:['Ожидаем запчасти','Продолжим ремонт, когда необходимые детали поступят в мастерскую.'],repair:['Ремонтируем','Ваша техника в работе.'],ready:['Можно забирать','Ремонт завершён. Ждём вас в мастерской.'],issued:['Техника у вас','Спасибо, что выбрали FastGo!'],cancelled:['Ремонт отменён','Подробности можно уточнить в мастерской.']};
let busy=false;
async function update(){
 if(busy)return;busy=true;button.disabled=true;error.textContent='';
 try{
  if(!(legacy&&/^[a-f0-9-]{36}$/i.test(legacy))&&!/^[a-f0-9-]{36}\.[a-f0-9]{64}$/i.test(token))throw new Error('Откройте ссылку с QR-кода на вашей квитанции.');
  let session;try{session=JSON.parse(localStorage.getItem('fastgo_workshop_session')||'null');}catch{}
  let access=session?.access_token||localStorage.getItem('fastgo_token');
  if(session?.refresh_token&&session.expires_at&&session.expires_at*1000<Date.now()+45000){try{const refreshed=await fetch('https://oqgpjfikjpcplnxueoki.supabase.co/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:'sb_publishable_-aVkOpeHXncVZhF2jPuG5w_4DkRYqji','Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token}),signal:AbortSignal.timeout(10000)});if(refreshed.ok){const next=await refreshed.json();session={...session,...next,expires_at:Math.floor(Date.now()/1000)+next.expires_in};localStorage.setItem('fastgo_workshop_session',JSON.stringify(session));access=session.access_token;}}catch{}}
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(access?{Authorization:'Bearer '+access}:{})},body:JSON.stringify({action:'open',...(legacy?{legacy_id:legacy}:{token})}),cache:'no-store',signal:AbortSignal.timeout(20000)});
  const result=await response.json();if(!response.ok||!result.data)throw new Error(result.error||'Не удалось обновить статус.');
  const data=result.data;if(data.staff_url){const target=new URL(data.staff_url);if(target.origin==='https://ivankirillov414-art.github.io'&&target.pathname==='/fastgo-control/workshop.html'){location.replace(target.href);return;}throw Error('Не удалось открыть карточку ремонта');}const [title,description]=labels[data.stage]||labels.accepted;
  const index={accepted:0,diagnostics:1,waiting:1,repair:2,ready:3,issued:4}[data.stage]??-1;
  view.replaceChildren();const badge=document.createElement('span');badge.id='badge';badge.textContent='Ремонт № '+data.number;const h=document.createElement('h1');h.textContent=title;const p=document.createElement('p');p.textContent=description;view.append(badge,h,p);
  if(index>=0){const list=document.createElement('ol');['Приняли','Диагностика','В работе','Готово к выдаче','Выдали'].forEach((label,i)=>{const item=document.createElement('li');item.textContent=data.stage==='waiting'&&i===1?'Ожидаем запчасти':label;item.className=i<index?'done':i===index?'active':'';if(i===index)item.setAttribute('aria-current','step');list.append(item);});view.append(list);}
  document.getElementById('updated').textContent='Проверено в '+new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
 }catch(e){error.textContent=e.message;}finally{busy=false;button.disabled=false;}
}
button.onclick=update;update();setInterval(()=>{if(!document.hidden)update();},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
