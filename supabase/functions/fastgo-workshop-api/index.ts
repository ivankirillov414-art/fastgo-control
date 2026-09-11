const PROJECT_URL = Deno.env.get('SUPABASE_URL') || '';
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SHEETS_URL = Deno.env.get('FASTGO_SHEETS_API_URL') || '';
const SHEETS_SECRET = Deno.env.get('FASTGO_SHEETS_API_SECRET') || '';
const cors = {
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Cache-Control':'no-store'
};
const out=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8'}});
const fail=(message:string,status=400)=>{throw Object.assign(new Error(message),{status});};
async function rest(path:string,method='GET',body?:unknown){
  const r=await fetch(PROJECT_URL+path,{method,headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  const text=await r.text(); let data:any; try{data=JSON.parse(text);}catch{data=null;}
  if(!r.ok) fail(data?.message||data?.error_description||'Сервис временно недоступен',r.status>=500?503:r.status);
  return data;
}
async function db(table:string,query='',method='GET',body?:unknown){ return rest('/rest/v1/'+table+(query?'?'+query:''),method,body); }
async function sheets(action:string,params:any,actor:any){
  if(!SHEETS_URL||!SHEETS_SECRET) fail('Google Sheets API ещё не подключён',503);
  const r=await fetch(SHEETS_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({secret:SHEETS_SECRET,action,params,actor}),redirect:'follow',signal:AbortSignal.timeout(30000)});
  const text=await r.text(); let data:any; try{data=JSON.parse(text);}catch{fail('Некорректный ответ Google Sheets',503);}
  if(!r.ok||data?.error) fail(data?.error||'Google Sheets недоступен',Number(data?.status)||503);
  return data?.data;
}
async function handler(req:Request){
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST') return out({error:'Разрешён только POST'},405);
  try{
    const auth=req.headers.get('authorization')||'';
    if(!/^Bearer .+/i.test(auth)) fail('Войдите в приложение',401);
    const ur=await fetch(PROJECT_URL+'/auth/v1/user',{headers:{apikey:KEY,Authorization:auth},signal:AbortSignal.timeout(15000)});
    if(!ur.ok) fail('Сессия истекла. Войдите снова',401);
    const user:any=await ur.json();
    const members:any[]=await db('workshop_members','profile_id=eq.'+encodeURIComponent(user.id)+'&active=eq.true&select=*');
    const me=members?.[0]; if(!me) fail('Доступ к мастерской не выдан. Обратитесь к владельцу',403);
    let input:any; try{input=await req.json();}catch{fail('Некорректный запрос');}
    const action=String(input.action||''), p=input.params||{};
    if(!p.kind && /storage-api/.test(new URL(req.url).pathname)) p.kind='storage';
    if(action==='me') return out({data:{...me,email:user.email}});
    const admin=['owner','admin'].includes(me.role);
    if(action==='member_update'){
      if(!admin) fail('Нет права изменять сотрудников',403);
      const id=String(p.profile_id||''); if(!id) fail('Не указан сотрудник');
      const patch={name:String(p.name||'').slice(0,200),role:String(p.role||''),active:p.active!==false,tags:Array.isArray(p.tags)?p.tags:[]};
      const data=await db('workshop_members','profile_id=eq.'+encodeURIComponent(id),'PATCH',patch); return out({data:data});
    }
    if(action==='staff_create'){
      if(!admin) fail('Нет права добавлять сотрудников',403);
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(p.email||''))||String(p.password||'').length<12||!String(p.name||'').trim()) fail('Укажите имя, почту и пароль от 12 символов');
      if(!['admin','receiver','manager','mechanic'].includes(String(p.role||''))) fail('Недопустимая роль');
      const created:any=await rest('/auth/v1/admin/users','POST',{email:p.email,password:p.password,email_confirm:true});
      const id=created.id||created.user?.id; if(!id) fail('Не удалось создать сотрудника');
      await db('workshop_members','','POST',{profile_id:id,name:String(p.name).trim(),role:p.role,active:true,tags:Array.isArray(p.tags)?p.tags:[]});
      return out({data:{profile_id:id,name:p.name,role:p.role,active:true,email:p.email}});
    }
    const actor={id:user.id,email:user.email||'',name:me.name||'',role:me.role};
    if(action==='catalog'){
      const data:any=await sheets(action,p,actor);
      const staff:any[]=await db('workshop_members','select=profile_id,name,role,active,tags&order=name');
      data.staff=staff||[];
      return out({data});
    }
    return out({data:await sheets(action,p,actor)});
  }catch(e:any){ return out({error:e?.message||'Ошибка сервиса'},Number(e?.status)||500); }
}
Deno.serve(handler);
