addEventListener('DOMContentLoaded',()=>{
 const id=new URLSearchParams(location.search).get('screen');let tries=0;
 const timer=setInterval(()=>{
  const intake=document.querySelector('#intake-form'),repair=document.querySelector('.repair-steps');
  if(!intake&&!repair){if(++tries>150)clearInterval(timer);return;}
  clearInterval(timer);
  const fill=(selector,value)=>{const el=document.querySelector(selector);if(el){el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));}};
  if(intake){for(const [k,v]of Object.entries({phone:'89990000000',last_name:'Иванов',first_name:'Алексей'}))fill('#f-'+k,v);
   if(['03-vehicle','04-intake-photo'].includes(id)){document.querySelector('[data-intake-next]')?.click();fill('#f-equipment_name','Kugoo M4 Pro');fill('#f-issue_description','Люфт рулевой стойки. Требуется настройка тормозов.');if(id==='04-intake-photo')document.querySelector('[data-intake-next]')?.click();}return;}
  if(id==='09-pickup'){document.querySelector('#rs-take')?.click();setTimeout(()=>fill('[data-part-search]','тормоз'),250);}
  if(id==='10-order'){document.querySelector('#rs-order-part')?.click();fill('#dialog [name=waiting_part]','Тормозной трос');fill('#dialog [name=waiting_due]','2026-11-02');}
  if(id==='15-payment')document.querySelector('#rs-pay')?.click();
  if(id==='16-handover'){document.querySelector('#rs-handover')?.click();fill('#dialog textarea','Самокат и зарядное устройство переданы клиенту.');}
 },50);
});
