// Only installed Windows apps can submit to a saved physical label printer.
// The server outbox survives disconnection; the shared native journal dedupes
// submissions even if both FastGo applications are open on the same laptop.
export function startReceiptLabels({call,bridge=window.warehouseDesktop,notify=()=>{}}){
 if(!bridge?.printReceiptLabels)return {tick:async()=>{},stop(){}};
 let running=false,stopped=false,loader;
 async function barcode(){if(window.JsBarcode)return;if(!loader)loader=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('vendor/jsbarcode-3.12.3.min.js',document.baseURI).href;script.onload=resolve;script.onerror=()=>reject(Error('Не загрузился генератор штрихкодов'));document.head.append(script);}).catch(e=>{loader=null;throw e;});await loader;}
 async function tick(){
  if(stopped||running)return;running=true;
  try{
   const jobs=await call('receipt_label_jobs');if(!Array.isArray(jobs)||!jobs.length)return;
   await barcode();
   for(const job of jobs){
    if(stopped)return;
    const items=(job.result?.items||[]).map(part=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');window.JsBarcode(svg,String(part.barcode),{format:'CODE128',displayValue:false,width:2,height:72,margin:0,marginLeft:20,marginRight:20,background:'#ffffff',lineColor:'#000000'});return {name:part.name,barcode:String(part.barcode),quantity:part.quantity,svg:svg.outerHTML};});
    await bridge.printReceiptLabels({id:job.id,items});
    await call('receipt_label_ack',{id:job.id});
    notify({ok:true,text:'Приход оформлен · '+items.reduce((n,x)=>n+x.quantity,0)+' этикеток передано термопринтеру'});
   }
  }catch(error){notify({ok:false,text:'Этикетки прихода ожидают печати: '+error.message});}
  finally{running=false;}
 }
 const timer=setInterval(()=>void tick(),10000);const first=setTimeout(()=>void tick(),2000);
 window.addEventListener('online',tick);
 return {tick,stop(){stopped=true;clearTimeout(first);clearInterval(timer);window.removeEventListener('online',tick);}};
}
