import {api} from './core.js';
let role=null;
async function enhance(){
  if(!document.querySelector('.shell')){role=null;document.getElementById('inventory-sale-fab')?.remove();return;}
  if(!role){try{role=(await api('me')).role;}catch{return;}}
  if(!['owner','admin','receiver','manager'].includes(role))return;
  const sales=document.querySelector('[data-sales-nav]');
  let b=document.getElementById('inventory-sale-fab');
  if(!b){b=document.createElement('button');b.id='inventory-sale-fab';b.type='button';b.innerHTML='<span aria-hidden="true">▦</span> Продажа';b.onclick=()=>document.querySelector('[data-sales-nav]')?.click();document.body.appendChild(b);}
  b.hidden=!sales;
}
const observer=new MutationObserver(()=>setTimeout(enhance,60));observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('workshop-session-cleared',()=>{role=null;document.getElementById('inventory-sale-fab')?.remove();});
setTimeout(enhance,180);
