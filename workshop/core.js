export const BASE='https://oqgpjfikjpcplnxueoki.supabase.co';
const KEY='sb_publishable_-aVkOpeHXncVZhF2jPuG5w_4DkRYqji',STORE='fastgo_workshop_session';
let session=null,refreshing=null;
try{session=JSON.parse(localStorage.getItem(STORE)||'null');if(!session&&localStorage.getItem('fastgo_token'))session={access_token:localStorage.getItem('fastgo_token')};}catch{}
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money=v=>Number(v||0).toLocaleString('ru-RU',{maximumFractionDigits:2})+' ₽';
export const date=v=>v?new Date(v.length===10?v+'T12:00:00+05:00':v).toLocaleDateString('ru-RU',{timeZone:'Asia/Yekaterinburg'}):'Не указана';
export const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Yekaterinburg'}).format(new Date());
export const fio=r=>[r.last_name,r.first_name,r.middle_name].filter(Boolean).join(' ');
export const number=(r,k)=>String(k==='repair'?r.repair_number:r.storage_number).padStart(4,'0');
export const roles={owner:'Владелец',admin:'Администратор',receiver:'Мастер-приёмщик',manager:'Менеджер',mechanic:'Мастер'};
export const statuses={repair:{accepted:'Принят',diagnostics:'Диагностика',waiting_parts:'Ждём запчасти',repair:'В ремонте',ready:'Готов',issued:'Выдан',cancelled:'Отменён'},storage:{accepted:'Принят',stored:'На хранении',ready_return:'К выдаче',returned:'Выдан',cancelled:'Отменён'}};
export const badge=(s,k)=>`<span class="badge ${esc(s)}">${esc(statuses[k]?.[s]||s)}</span>`;
export const total=(r,k)=>Number(k==='repair'?r.total_amount:r.storage_amount)||0;
export const opts=(values,selected,blank)=> (blank?`<option value="">${esc(blank)}</option>`:'')+Object.entries(values).map(([v,l])=>`<option value="${esc(v)}"${String(v)===String(selected)?' selected':''}>${esc(l)}</option>`).join('');
export function suggestedEnd(start,tariff,months){const d=new Date(start+'T12:00:00Z');if(!Number.isFinite(d.getTime()))return '';if(tariff==='season')return `${d.getUTCFullYear()+(d.getUTCMonth()>=2?1:0)}-03-31`;const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+Number(months||1));const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.toISOString().slice(0,10);}
export function normalizePhone(value){let d=String(value).replace(/\D/g,'');if(d.length===11&&(d[0]==='7'||d[0]==='8'))d=d.slice(1);if(d.length!==10)throw new Error('Введите полный номер телефона: +7 и 10 цифр');return '+7'+d;}
export function sessionAvailable(){return !!session?.access_token;}
async function request(path,body,token){let r;try{r=await fetch(BASE+path,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(40000)});}catch(e){throw new Error(e.name==='TimeoutError'?'Сервер не ответил. Проверьте подключение и повторите попытку.':'Нет соединения с сервером. Проверьте интернет и повторите попытку.');}let j;try{j=await r.json();}catch{throw new Error('Сервер вернул неполный ответ. Повторите попытку.');}if(!r.ok){const msg=j.error_description||j.error||j.message||j.msg||'Ошибка запроса';const e=new Error(msg==='Invalid login credentials'?'Неверная почта или пароль':msg);e.status=r.status;throw e;}return j;}
function saveSession(s){session={access_token:s.access_token,refresh_token:s.refresh_token,expires_at:s.expires_at||Math.floor(Date.now()/1000)+s.expires_in};localStorage.setItem(STORE,JSON.stringify(session));}
async function refresh(){if(!session?.refresh_token)return false;if(!refreshing)refreshing=request('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token}).then(s=>{saveSession(s);return true;}).catch(e=>{if(e.status===400||e.status===401)clearSession();throw e;}).finally(()=>refreshing=null);return refreshing;}
export async function signIn(email,password){saveSession(await request('/auth/v1/token?grant_type=password',{email,password}));}
export function clearSession(){session=null;localStorage.removeItem(STORE);localStorage.removeItem('fastgo_token');}
export async function signOut(){const token=session?.access_token;try{if(token)await request('/auth/v1/logout?scope=local',{},token);}catch{}finally{clearSession();}}
export async function api(action,params={},retried=false){if(session?.expires_at && session.expires_at*1000<Date.now()+45000)await refresh();try{return(await request('/functions/v1/fastgo-workshop-api',{action,params},session?.access_token)).data;}catch(e){if(e.status===401&&!retried&&await refresh())return api(action,params,true);if(e.status===401){clearSession();window.dispatchEvent(new Event('workshop-auth-required'));}throw e;}}
export function csvDownload(name,headers,rows){const cell=v=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};const text='\ufeff'+[headers,...rows].map(row=>row.map(cell).join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
