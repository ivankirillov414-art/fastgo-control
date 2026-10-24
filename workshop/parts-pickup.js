import {api,esc} from './core.js';
export async function showPartsPickup(record,{dirty,refresh}){
 if(dirty())throw Error('Сначала сохраните изменения ремонта');
 const ticket=await api('parts_pickup',{kind:'repair',id:record.id});
 const dialog=document.createElement('dialog');dialog.setAttribute('aria-label','Взять запчасти');
 dialog.style.cssText='max-width:440px;width:calc(100% - 32px);border:1px solid #456078;border-radius:16px;padding:24px;background:#152638;color:#eef6ff';
 dialog.innerHTML='<h2>Взять запчасти</h2><p>Ремонт № '+esc(ticket.number)+' · '+esc(ticket.vehicle)+'</p><p>'+esc(ticket.master_name)+'</p><div data-pickup-qr style="background:white;padding:12px;text-align:center"></div><p>На кассе сначала отсканируйте детали, затем этот QR. Подтвердите «Выдать» на ТСД.</p><p data-pickup-state role="status">Ожидаем выдачу запчастей на кассе…</p><button type="button" class="btn secondary">Закрыть</button>';
 const qr=window.qrcode(0,'M');qr.addData(ticket.code);qr.make();dialog.querySelector('[data-pickup-qr]').innerHTML=qr.createSvgTag({scalable:true,margin:4});
 document.body.append(dialog);dialog.showModal();dialog.querySelector('button').onclick=()=>dialog.close();
 let checking=false;
 const timer=setInterval(async()=>{if(checking||!dialog.isConnected)return;checking=true;try{
  const {record:latest}=await api('get',{kind:'repair',id:record.id},{fresh:true});
  const before=new Set((record.parts||[]).map(x=>x.tsd_issue_id).filter(Boolean));
  if((latest.parts||[]).some(x=>x.tsd_issue_id&&!before.has(x.tsd_issue_id))){dialog.querySelector('[data-pickup-state]').textContent='Запчасти выданы и добавлены в ремонт';dialog.close();await refresh();}
 }catch(error){dialog.querySelector('[data-pickup-state]').textContent=error.message;}finally{checking=false;}},5000);
 dialog.onclose=()=>{clearInterval(timer);dialog.remove();};
}
