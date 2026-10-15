export function bindUSBInbox({key,label,container,enabled,add,error,bridge=window.warehouseDesktop}){
 if(!bridge?.usbTarget){container.hidden=true;return()=>{};}
 let stopped=false,working=false,rendered='';
 const live=()=>!stopped&&container.isConnected&&enabled();
 function render(unassigned,blocked){
 const signature=JSON.stringify([unassigned,blocked?.id]);if(signature===rendered)return;rendered=signature;container.replaceChildren();
 const caption=document.createElement('span');caption.textContent=blocked?'USB: код не найден — '+blocked.code:'USB-сканер: готов к приёму';container.append(caption);
 const button=(text,action)=>{const b=document.createElement('button');b.textContent=text;b.onclick=async()=>{b.disabled=true;try{await action();}catch(e){error(e.message);}finally{b.disabled=false;}};container.append(b);};
 if(unassigned)button('Добавить накопленные сканы ('+unassigned+')',()=>bridge.usbClaim(key));
 if(blocked)button('Пропустить этот скан',()=>bridge.usbAck(key,[blocked.id]));
 }
 async function poll(){if(!live()||working)return;working=true;try{
 await bridge.usbTarget({key,label});if(!live())return;
 const batch=await bridge.usbBatch(key);if(!live())return;let blocked;
 for(const item of batch.items){if(!live())break;if(!add(item)){blocked=item;break;}await bridge.usbAck(key,[item.id]);}
 if(live())render(batch.unassigned,blocked);
 }catch(e){if(live())error(e.message);}finally{working=false;}}
 void poll();const timer=setInterval(poll,400);
 return()=>{stopped=true;clearInterval(timer);void bridge.usbTarget(null).catch(()=>{});};
}
