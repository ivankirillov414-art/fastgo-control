import {icon} from './icons.js';
import {api} from './core.js';
let role=null;
async function enhance(){
  if(!document.querySelector('.shell')){role=null;document.getElementById('inventory-sale-fab')?.remove();return;}
  if(!role){try{role=(await api('me')).role;}catch{return;}}
  if(!['developer','owner','seller'].includes(role))return;
  const sales=document.querySelector('a[href="#cash"]');
  const loading=document.querySelector('#workspace>.panel')?.textContent==='Загружаем данные…';
  let b=document.getElementById('inventory-sale-fab');
  if(!b){b=document.createElement('button');b.id='inventory-sale-fab';b.type='button';b.innerHTML=icon('sale')+' Продажа';b.onclick=()=>{location.hash='#cash';};document.body.appendChild(b);}
  const target=document.getElementById('home-sale-slot')||document.getElementById('workspace');
  if(target&&b.parentElement!==target)target.prepend(b);
  b.hidden=!sales||loading||location.hash.startsWith('#cash');
}
const observer=new MutationObserver(()=>setTimeout(enhance,60));observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('workshop-session-cleared',()=>{role=null;document.getElementById('inventory-sale-fab')?.remove();});
setTimeout(enhance,180);
