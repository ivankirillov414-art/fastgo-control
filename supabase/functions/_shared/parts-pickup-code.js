const invalid=()=>{throw Object.assign(Error('Это не действующий QR выдачи запчастей. Откройте «Взять запчасти» в ремонте.'),{status:400});};
const id=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/i.test(v);
const bytes=v=>new TextEncoder().encode(v);
const encode=v=>btoa(String.fromCharCode(...v)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const decode=v=>Uint8Array.from(atob(v.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const key=secret=>crypto.subtle.importKey('raw',bytes('fastgo-parts-pickup-v1:'+secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
export async function pickupCode(repair,secret,{now=Date.now(),uuid=()=>crypto.randomUUID()}={}){
 const ticket={id:uuid(),repair_id:repair.id,master_id:repair.assigned_master_id,expires:Math.floor(now/1000)+86400};
 if(!id(ticket.repair_id)||!id(ticket.master_id))invalid();
 const body=encode(bytes(JSON.stringify(ticket))),signature=await crypto.subtle.sign('HMAC',await key(secret),bytes(body));
 return {code:'FGPARTS1.'+body+'.'+encode(new Uint8Array(signature)),expires_at:new Date(ticket.expires*1000).toISOString(),repair_id:repair.id,number:repair.repair_number,vehicle:[repair.brand,repair.model].filter(Boolean).join(' '),serial:repair.serial_number||'',master_id:repair.assigned_master_id,master_name:''};
}
export async function readPickupCode(value,secret,{now=Date.now(),allowExpired=false}={}){
 try{
  if(typeof value!=='string'||value.length>1024)invalid();const [prefix,body,signature,...tail]=value.trim().split('.');
  if(prefix!=='FGPARTS1'||!body||!signature||tail.length||!await crypto.subtle.verify('HMAC',await key(secret),decode(signature),bytes(body)))invalid();
  const t=JSON.parse(new TextDecoder().decode(decode(body)));
  if(!id(t.id)||!id(t.repair_id)||!id(t.master_id)||!Number.isInteger(t.expires))invalid();
  if(!allowExpired&&t.expires*1000<=now)throw Object.assign(Error('QR выдачи истёк. Мастеру нужно снова нажать «Взять запчасти».'),{status:409});
  return t;
 }catch(e){if(e.status)throw e;invalid();}
}
