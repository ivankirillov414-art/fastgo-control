const endpoint='https://oqgpjfikjpcplnxueoki.supabase.co/functions/v1/fastgo-repair-status';
const token=location.hash.slice(1),view=document.getElementById('view'),error=document.getElementById('error'),button=document.getElementById('refresh');
const labels={accepted:['Приняли вашу технику','Ремонт ещё не начат.'],diagnostics:['Проверяем технику','Мастер выясняет причину неисправности.'],waiting:['Ремонт на паузе','Мастерская ожидает необходимое для продолжения ремонта.'],repair:['Ремонтируем','Ваша техника в работе.'],ready:['Можно забирать','Ремонт завершён. Ждём вас в мастерской.'],issued:['Техника у вас','Спасибо, что выбрали FastGo!'],cancelled:['Ремонт отменён','Подробности можно уточнить в мастерской.']};
let busy=false;
async function update(){
 if(busy)return;busy=true;button.disabled=true;error.textContent='';
 try{
  if(!/^[a-f0-9-]{36}\.[a-f0-9]{64}$/i.test(token))throw new Error('Откройте ссылку с QR-кода на вашей квитанции.');
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token}),cache:'no-store',signal:AbortSignal.timeout(20000)});
  const result=await response.json();if(!response.ok||!result.data)throw new Error(result.error||'Не удалось обновить статус.');
  const data=result.data,[title,description]=labels[data.stage]||labels.accepted;
  const index={accepted:0,diagnostics:1,waiting:1,repair:2,ready:3,issued:4}[data.stage]??-1;
  view.replaceChildren();const badge=document.createElement('span');badge.id='badge';badge.textContent='Ремонт № '+data.number;const h=document.createElement('h1');h.textContent=title;const p=document.createElement('p');p.textContent=description;view.append(badge,h,p);
  if(index>=0){const list=document.createElement('ol');['Приняли','Диагностика','В работе','Готово к выдаче','Выдали'].forEach((label,i)=>{const item=document.createElement('li');item.textContent=label;item.className=i<index?'done':i===index?'active':'';if(i===index)item.setAttribute('aria-current','step');list.append(item);});view.append(list);}
  document.getElementById('updated').textContent='Проверено в '+new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
 }catch(e){error.textContent=e.message;}finally{busy=false;button.disabled=false;}
}
button.onclick=update;update();setInterval(()=>{if(!document.hidden)update();},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
