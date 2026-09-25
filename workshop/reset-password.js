const BASE='https://oqgpjfikjpcplnxueoki.supabase.co';
const KEY='sb_publishable_-aVkOpeHXncVZhF2jPuG5w_4DkRYqji';
const DEVICE_KEY='fastgo_owner_device_v1';
const app=document.getElementById('app');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fail=message=>{app.innerHTML=`<main class="login-shell"><section class="login-card"><div class="brand">Fast<span>Go</span></div><h1>Смена пароля</h1><p class="error">${esc(message)}</p><a class="btn secondary" href="workshop.html">Вернуться ко входу</a></section></main>`;};
async function json(url,options={}){
 const r=await fetch(url,options);let j={};try{j=await r.json();}catch{}
 if(!r.ok)throw new Error(j.error_description||j.error||j.message||j.msg||'Ошибка сервера');
 return j;
}
async function api(access,action,params={}){
 const j=await json(BASE+'/functions/v1/fastgo-workshop-api',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+access,'Content-Type':'application/json'},body:JSON.stringify({action,params})});
 return j.data;
}
async function start(){
 const h=Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
 const access=h.access_token||'';const type=h.type||'';
 history.replaceState(null,'',location.pathname);
 if(type!=='recovery'||!access)return fail('Ссылка недействительна или уже использована.');
 let me;try{me=await api(access,'me');}catch(e){return fail('Ссылка истекла. Запросите смену пароля ещё раз.');}
 if(me.role==='owner'){
  let device='';try{device=localStorage.getItem(DEVICE_KEY)||'';}catch{}
  let status;try{status=await api(access,'owner_device_status',{device_token:device});}catch(e){return fail(e.message);}
  if(!status?.trusted)return fail('Пароль владельца можно изменить только на привязанном iPhone 13.');
 }
 app.innerHTML=`<main class="login-shell"><section class="login-card"><div class="brand">Fast<span>Go</span></div><h1>Новый пароль</h1><p class="muted">${esc(me.email||'')}</p><form id="reset"><div class="field"><label for="new-password">Новый пароль (от 12 символов)</label><input id="new-password" type="password" minlength="12" autocomplete="new-password" required></div><div class="field"><label for="confirm-password">Повторите пароль</label><input id="confirm-password" type="password" minlength="12" autocomplete="new-password" required></div><div id="error" role="alert"></div><button class="btn" type="submit">Сохранить новый пароль</button></form></section></main>`;
 document.getElementById('reset').onsubmit=async e=>{
  e.preventDefault();const b=e.submitter,p=document.getElementById('new-password').value,q=document.getElementById('confirm-password').value,err=document.getElementById('error');
  err.textContent='';if(p!==q){err.innerHTML='<p class="error">Пароли не совпадают</p>';return;}
  b.disabled=true;
  try{
   await json(BASE+'/auth/v1/user',{method:'PUT',headers:{apikey:KEY,Authorization:'Bearer '+access,'Content-Type':'application/json'},body:JSON.stringify({password:p})});
   localStorage.removeItem('fastgo_workshop_session');localStorage.removeItem('fastgo_token');
   app.innerHTML=`<main class="login-shell"><section class="login-card"><div class="brand">Fast<span>Go</span></div><h1>Пароль изменён</h1><p>Войдите в FastGo с новым паролем.</p><a class="btn" href="workshop.html">Перейти ко входу</a></section></main>`;
  }catch(x){err.innerHTML=`<p class="error">${esc(x.message)}</p>`;b.disabled=false;}
 };
}
start().catch(e=>fail(e.message));