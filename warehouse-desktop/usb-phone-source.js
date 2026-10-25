import {scanError} from '../warehouse/scan-policy.js';
import {bindScanner} from '../warehouse/scanner.js';
const $=id=>document.getElementById(id),input=$('barcode'),form=$('scan'),status=$('state'),error=$('error');
const base=location.pathname.replace(/\/?$/,'/'),store='fastgo-usb-outbox:'+base;let queue=[],sending=false,healthy=true,kind='',stop=null,lastSeen='',modePending=false;
try{queue=JSON.parse(localStorage.getItem(store)||'[]');if(!Array.isArray(queue))throw Error();}catch{healthy=false;error.textContent='Не удалось прочитать сохранённые сканы. Не очищайте данные браузера.';}
function persist(){localStorage.setItem(store,JSON.stringify(queue));$('pending').textContent=queue.length?'Ожидают передачи: '+queue.length:'';}
async function request(route,data){const controller=typeof AbortController==='function'?new AbortController():null;const timer=controller?setTimeout(()=>controller.abort(),5000):null;try{const r=await fetch(base+route,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:controller?controller.signal:undefined});const body=await r.json();if(!r.ok)throw Error(body.error||'Нет связи');return body;}finally{clearTimeout(timer);}}
async function flush(){if(sending||!healthy)return;sending=true;try{
 if(modePending){await request('mode',{kind});modePending=false;}
 while(queue.length){const item=queue[0];const result=await request('scan',item);if(result.rejected)error.textContent=result.error;queue.shift();try{persist();}catch(e){queue.unshift(item);throw e;}}
 const s=await request('status');status.textContent=kind?'':'Подключено по USB';
 if(s.last&&s.last.id!==lastSeen&&s.last.kind===kind){lastSeen=s.last.id;if(s.last.error){error.textContent=s.last.error;$('last').textContent='';}else{error.textContent='';$('last').textContent=s.last.name+(s.last.quantity?' · '+s.last.quantity+' шт.':'');}}
 }catch(e){status.textContent='Ожидание ноутбука';error.textContent=e.message==='Failed to fetch'?'Проверьте USB-кабель. Сканы сохранены.':e.message;}finally{sending=false;}}
function open(value){kind=value;$('home').hidden=true;$('work').hidden=false;$('title').textContent=value==='receipt'?'Приход':value==='repair'?'Оплата ремонта':'Продажа';$('last').textContent='';error.textContent='';stop?.();stop=bindScanner(input,form,()=>healthy&&!!kind,{silent:true});modePending=true;void flush();}
for(const button of document.querySelectorAll('[data-kind]'))button.onclick=()=>open(button.dataset.kind);
$('back').onclick=()=>{stop?.();stop=null;kind='';modePending=true;void flush();$('home').hidden=false;$('work').hidden=true;};
form.onsubmit=e=>{e.preventDefault();if(!healthy||!kind)return;const code=input.value.trim();input.value='';if(!code)return;const problem=scanError(kind,code);if(problem){error.textContent=problem;return;}if(code.length>256||/[\x00-\x1f\x7f]/.test(code)){error.textContent='Неверный штрихкод';return;}if(queue.length>=1000){error.textContent='Накоплено 1000 сканов. Подключите ноутбук.';return;}const item={id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2),code,kind};queue.push(item);try{persist();error.textContent='';status.textContent='Скан получен…';void flush();}catch{queue.pop();error.textContent='Не удалось сохранить скан. Повторите после освобождения места.';}};
if(healthy){persist();void flush();setInterval(flush,400);}
