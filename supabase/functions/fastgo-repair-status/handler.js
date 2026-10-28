// Signed, repair-scoped read capability. No customer or workshop data is public.
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const out=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const encoder=new TextEncoder();
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
export function clientStage(value){
 const stages={'Принят':'accepted','Диагностика':'diagnostics','Ждём запчасти':'waiting','Ждем запчасти':'waiting','В работе':'repair','В ремонте':'repair','Готов':'ready','Выдан':'issued','Отменён':'cancelled','Отменен':'cancelled',accepted:'accepted',diagnostics:'diagnostics',waiting_parts:'waiting',repair:'repair',ready:'ready',issued:'issued',cancelled:'cancelled'};
 return stages[value]||'accepted';
}
export function createStatusHandler({base,key,fetcher=fetch}){
 const signingKey=crypto.subtle.importKey('raw',encoder.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
 const payload=id=>encoder.encode('fastgo:customer-repair-status:v1:'+id);
 return async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return out({error:'Метод не поддерживается'},405);
  try{
   if(!base||!key)return out({error:'Сервис временно недоступен'},503);
   const raw=await req.text();if(raw.length>2048)return out({error:'Неверный запрос'},400);
   let p;try{p=JSON.parse(raw);}catch{return out({error:'Неверный запрос'},400);}
   if(!p||typeof p!=='object')return out({error:'Неверный запрос'},400);
   if(p.action==='issue'){
    if(!uuid.test(p.id||''))return out({error:'Неверный ремонт'},400);
    const auth=req.headers.get('authorization');if(!auth?.startsWith('Bearer '))return out({error:'Войдите в мастерскую'},401);
    // Reuse the staff API's authentication and per-order authorization.
    const check=await fetcher(base+'/functions/v1/fastgo-workshop-api',{method:'POST',headers:{Authorization:auth,apikey:key,'Content-Type':'application/json'},body:JSON.stringify({action:'get',params:{kind:'repair',id:p.id}}),signal:AbortSignal.timeout(25000)});
    if(!check.ok)return out({error:'Нет доступа к ремонту'},check.status===401?401:403);
    const result=await check.json();if(result?.data?.record?.id!==p.id)return out({error:'Нет доступа к ремонту'},403);
    const signature=hex(await crypto.subtle.sign('HMAC',await signingKey,payload(p.id)));
    return out({data:{token:p.id+'.'+signature}});
   }
   const legacy=typeof p.legacy_id==='string'&&uuid.test(p.legacy_id),[signedId,signature,...extra]=String(p.token||'').split('.'),id=legacy?p.legacy_id:signedId;
   if(!legacy){
    if(extra.length||!uuid.test(id||'')||!/^[a-f0-9]{64}$/.test(signature||''))return out({error:'Ссылка недействительна'},404);
    const bytes=Uint8Array.from(signature.match(/../g),x=>parseInt(x,16));
    if(!await crypto.subtle.verify('HMAC',await signingKey,bytes,payload(id)))return out({error:'Ссылка недействительна'},404);
   }
   // Old paper forms contain an unguessable repair UUID. They expose the same
   // coarse status only; staff must still pass the authenticated workshop API.
   const auth=req.headers.get('authorization');
   if(p.action==='open'&&auth?.startsWith('Bearer ')){
    const check=await fetcher(base+'/functions/v1/fastgo-workshop-api',{method:'POST',headers:{Authorization:auth,apikey:key,'Content-Type':'application/json'},body:JSON.stringify({action:'get',params:{kind:'repair',id}}),signal:AbortSignal.timeout(25000)});
    if(check.ok){const result=await check.json();if(result?.data?.record?.id===id)return out({data:{staff_url:'https://ivankirillov414-art.github.io/fastgo-control/workshop.html#order?kind=repair&id='+id}});}
   }
   // Fetch only the two allowed columns of the exact signed repair.
   const query=new URLSearchParams({sheet:'eq.Ремонты','data->>repair_id':'eq.'+id,select:'status:data->>Статус,number:data->>Номер ремонта',limit:'1'});
   const response=await fetcher(base+'/rest/v1/workshop_native_rows?'+query,{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(15000)});
   if(!response.ok)return out({error:'Не удалось обновить статус'},503);
   const [row]=await response.json();
   if(!row||['deleted','Удалён','Удален'].includes(row.status))return out({error:'Ссылка недействительна'},404);
   return out({data:{number:String(row.number||'').replace(/^FGR-/,''),stage:clientStage(row.status)}});
  }catch{return out({error:'Не удалось обновить статус. Попробуйте ещё раз.'},503);}
 };
}
