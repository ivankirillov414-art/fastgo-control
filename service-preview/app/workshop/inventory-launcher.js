import {icon} from './icons.js';
import {api,canSell} from './core.js';
let member=null;
async function enhance(){
  const page=location.hash.slice(1).split('?')[0]||'home';
  if(page!=='home'){document.getElementById('inventory-sale-fab')?.remove();return;}
  if(!document.querySelector('.shell')){member=null;document.getElementById('inventory-sale-fab')?.remove();return;}
  if(!member){try{member=await api('me');}catch{return;}}
  if((location.hash.slice(1).split('?')[0]||'home')!=='home')return;
  if(!canSell(member)){document.getElementById('inventory-sale-fab')?.remove();return;}
  const sales=document.querySelector('a[href="#cash"]');
  const loading=document.querySelector('#workspace>.panel')?.textContent==='Загружаем данные…';
  let b=document.getElementById('inventory-sale-fab');
  if(!b){b=document.createElement('button');b.id='inventory-sale-fab';b.type='button';b.innerHTML=icon('sale')+' Продажа';b.onclick=()=>{location.hash='#cash';};document.body.appendChild(b);}
  const target=document.getElementById('home-sale-slot')||document.getElementById('workspace');
  if(target&&b.parentElement!==target)target.prepend(b);
  b.hidden=!sales||loading;
}
const observer=new MutationObserver(()=>setTimeout(enhance,60));observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>{if((location.hash.slice(1).split('?')[0]||'home')!=='home')document.getElementById('inventory-sale-fab')?.remove();enhance();});
window.addEventListener('workshop-session-cleared',()=>{member=null;document.getElementById('inventory-sale-fab')?.remove();});
setTimeout(enhance,180);
