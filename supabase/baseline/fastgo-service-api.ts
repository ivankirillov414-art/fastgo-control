import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const out=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'content-type':'application/json'}});
const safe=(s:string)=>s.replace(/[^a-zA-Z0-9._-]/g,'_');
const allowedUpdate=new Set(['status','assigned_master','diagnostics_notes','works','parts','labor_amount','parts_amount','total_amount','promised_date','issue_description','condition_notes','accessories']);
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 try{
  const x=await req.json(),p=x.params||{};
  if(x.action==='upload'){
   const bytes=Uint8Array.from(atob(p.content_base64||''),c=>c.charCodeAt(0));
   if(!bytes.length)return out({error:'Нет файла'},400);
   if(bytes.length>10*1024*1024)return out({error:'Файл больше 10 МБ'},400);
   const path=`service/${crypto.randomUUID()}/${safe(p.file_name||'file.jpg')}`;
   const {error}=await db.storage.from('rental-private-docs').upload(path,bytes,{contentType:p.content_type||'image/jpeg'});
   if(error)throw error;
   return out({data:{path}});
  }
  if(x.action==='signed_url'){
   if(!p.path)return out({error:'Нет пути к файлу'},400);
   const {data,error}=await db.storage.from('rental-private-docs').createSignedUrl(p.path,3600);
   if(error)throw error;
   return out({data:{url:data.signedUrl}});
  }
  if(x.action==='create'){
   for(const k of ['last_name','first_name','phone','brand','model']) if(!String(p[k]||'').trim()) return out({error:'Заполните обязательные поля'},400);
   const payload={...p,status:'accepted'};
   const {data,error}=await db.from('service_repairs').insert(payload).select('*').single();
   if(error)throw error;
   return out({data},201);
  }
  if(x.action==='get'){
   let q=db.from('service_repairs').select('*');
   if(p.qr_token)q=q.eq('qr_token',p.qr_token); else if(p.id)q=q.eq('id',p.id); else return out({error:'Нет идентификатора'},400);
   const {data,error}=await q.maybeSingle();
   if(error)throw error;
   return data?out({data}):out({error:'Заказ не найден'},404);
  }
  if(x.action==='list'){
   const {data,error}=await db.from('service_repairs').select('*').order('created_at',{ascending:false}).limit(300);
   if(error)throw error;
   return out({data});
  }
  if(x.action==='update'){
   if(!p.id)return out({error:'Нет id'},400);
   const patch:any={updated_at:new Date().toISOString()};
   for(const [k,v] of Object.entries(p)) if(allowedUpdate.has(k)) patch[k]=v;
   if('labor_amount' in patch || 'parts_amount' in patch){
     const {data:old,error:oldErr}=await db.from('service_repairs').select('labor_amount,parts_amount').eq('id',p.id).single();
     if(oldErr)throw oldErr;
     const labor=Number(patch.labor_amount ?? old.labor_amount ?? 0),parts=Number(patch.parts_amount ?? old.parts_amount ?? 0);
     patch.total_amount=labor+parts;
   }
   const {data,error}=await db.from('service_repairs').update(patch).eq('id',p.id).select('*').single();
   if(error)throw error;
   return out({data});
  }
  return out({error:'Unknown action'},400);
 }catch(e){return out({error:e instanceof Error?e.message:'Ошибка'},500)}
});
