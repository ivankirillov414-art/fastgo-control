import { neon } from '@neondatabase/serverless';

interface Env {
  DATABASE_URL: string;
  FILE_TOKEN_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  FASTGO_FILES: R2Bucket;
}

type Member = { profile_id:string; name:string; role:string; active:boolean; tags:string[] };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Cache-Control': 'no-store',
};

const json = (data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8'}});
const fail = (message:string,status=400):never => { throw Object.assign(new Error(message),{status}); };
const uuid = (v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v||'');

function b64url(input:Uint8Array|string){
  const bytes=typeof input==='string'?new TextEncoder().encode(input):input;
  let s='';for(const b of bytes)s+=String.fromCharCode(b);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function fromB64url(input:string){
  const s=input.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(input.length/4)*4,'=');
  const raw=atob(s);return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
async function hmac(secret:string,text:string){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(text)));
}
async function signedFileUrl(request:Request,env:Env,path:string){
  const exp=Math.floor(Date.now()/1000)+600;
  const payload=`${path}\n${exp}`;
  const sig=b64url(await hmac(env.FILE_TOKEN_SECRET,payload));
  const u=new URL(request.url);u.pathname='/files/'+b64url(path);u.search=`?exp=${exp}&sig=${encodeURIComponent(sig)}`;return u.toString();
}
async function verifyFileToken(env:Env,path:string,exp:number,sig:string){
  if(!Number.isFinite(exp)||exp<Math.floor(Date.now()/1000))return false;
  const expected=b64url(await hmac(env.FILE_TOKEN_SECRET,`${path}\n${exp}`));
  if(expected.length!==sig.length)return false;
  let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^sig.charCodeAt(i);return diff===0;
}

async function auth(request:Request,env:Env,sql:ReturnType<typeof neon>){
  const token=request.headers.get('authorization')||'';
  if(!/^Bearer .+/i.test(token))fail('Войдите в приложение',401);
  const r=await fetch(env.SUPABASE_URL+'/auth/v1/user',{headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:token}});
  if(!r.ok)fail('Сессия истекла. Войдите снова',401);
  const user=await r.json() as {id:string,email?:string};
  const rows=await sql.query('select profile_id,name,role,active,tags from workshop_members where profile_id=$1 and active=true limit 1',[user.id]) as Member[];
  const member=rows[0];if(!member)fail('Доступ к мастерской не выдан',403);
  return {user,member};
}

async function fileResponse(request:Request,env:Env){
  const url=new URL(request.url),encoded=url.pathname.slice('/files/'.length);
  let path='';try{path=new TextDecoder().decode(fromB64url(encoded));}catch{return new Response('Bad token',{status:400});}
  const exp=Number(url.searchParams.get('exp')),sig=url.searchParams.get('sig')||'';
  if(!await verifyFileToken(env,path,exp,sig))return new Response('Expired or invalid token',{status:403});
  const obj=await env.FASTGO_FILES.get(path);if(!obj)return new Response('Not found',{status:404});
  const headers=new Headers();obj.writeHttpMetadata(headers);headers.set('etag',obj.httpEtag);headers.set('Cache-Control','private, max-age=300');
  return new Response(obj.body,{headers});
}

async function api(request:Request,env:Env){
  const sql=neon(env.DATABASE_URL);
  const {user,member}=await auth(request,env,sql);
  const manager=['owner','admin','receiver','manager'].includes(member.role),admin=['owner','admin'].includes(member.role);
  let input:{action?:string,params?:Record<string,unknown>};try{input=await request.json();}catch{fail('Некорректный запрос');}
  const action=String(input.action||''),p=input.params||{};

  if(action==='me')return json({data:{...member,email:user.email}});
  if(action==='health'){
    const rows=await sql`select now() as now`;
    return json({data:{ok:true,db:true,r2:true,now:rows[0]?.now}});
  }
  if(action==='catalog'){
    const [services,parts,staff,categories]=await Promise.all([
      sql`select * from service_catalog where active=true order by title limit 500`,
      sql`select id,name,sku,barcode,category,model,unit,quantity,unit_cost,retail_price,price_note,active,primary_photo_path from parts order by name limit 5000`,
      sql`select profile_id,name,role,active,tags from workshop_members order by name`,
      sql`select id,name,barcode,primary_photo_path from inventory_categories order by name limit 1000`,
    ]);
    return json({data:{services,parts,staff,categories}});
  }
  if(action==='part_by_barcode'){
    const code=String(p.barcode||'').trim().toUpperCase().slice(0,100);if(!code)fail('Штрих-код пуст');
    const rows=await sql.query('select id,name,sku,barcode,category,model,unit,quantity,unit_cost,retail_price,primary_photo_path from parts where active=true and (upper(barcode)=$1 or upper(coalesce(sku,\'\'))=$1) limit 1',[code]);
    if(!rows.length)fail('Товар с таким штрих-кодом не найден',404);return json({data:rows[0]});
  }
  if(action==='sale'){
    if(!manager)fail('Нет права проводить продажи',403);
    const rows=await sql.query('select workshop_sale($1,$2::jsonb) as result',[user.id,JSON.stringify(p)]);
    return json({data:rows[0]?.result});
  }
  if(action==='sales'){
    if(!manager)fail('Нет доступа',403);const limit=Math.min(100,Math.max(1,Number(p.limit)||50)),offset=Math.max(0,Number(p.offset)||0);
    const rows=await sql.query('select id,sale_number,cashier_id,payment_method,total,note,created_at from workshop_sales order by created_at desc limit $1 offset $2',[limit,offset]);
    const count=Number((await sql`select count(*)::int as count from workshop_sales`)[0]?.count||0);return json({data:{items:rows,count,offset,limit}});
  }
  if(action==='stock_history'){
    const id=String(p.part_id||'');if(!uuid(id))fail('Не указана запчасть');
    return json({data:await sql.query('select * from stock_movements where part_id=$1 order by created_at desc limit 100',[id])});
  }
  if(action==='list'){
    const kind=String(p.kind||'repair');if(kind!=='repair'&&kind!=='storage')fail('Неверный вид заказа');if(!manager&&kind==='storage')fail('Нет доступа',403);
    const limit=Math.min(100,Math.max(1,Number(p.limit)||50)),offset=Math.max(0,Number(p.offset)||0);
    const table=kind==='repair'?'service_repairs':'storage_intakes';
    const statuses=String(p.status||'active');
    const where:string[]=[];const values:unknown[]=[];
    if(!manager&&kind==='repair'){values.push(user.id);where.push(`assigned_master_id=$${values.length}`);}
    if(statuses==='active')where.push(kind==='repair'?"status not in ('issued','cancelled')":"status not in ('returned','cancelled')");
    else if(statuses!=='all'){values.push(statuses);where.push(`status=$${values.length}`);}
    const search=String(p.search||'').replace(/[^\p{L}\p{N} +_-]/gu,'').trim().slice(0,100);
    if(search){values.push('%'+search+'%');const x='$'+values.length;where.push(`(last_name ilike ${x} or first_name ilike ${x} or coalesce(middle_name,'') ilike ${x} or phone ilike ${x} or brand ilike ${x} or model ilike ${x} or coalesce(serial_number,'') ilike ${x})`);}
    values.push(limit,offset);const w=where.length?' where '+where.join(' and '):'';
    const rows=await sql.query(`select * from ${table}${w} order by created_at desc,id desc limit $${values.length-1} offset $${values.length}`,values);
    const countValues=values.slice(0,-2);const count=Number((await sql.query(`select count(*)::int as count from ${table}${w}`,countValues))[0]?.count||0);
    return json({data:{items:rows,count,offset,limit}});
  }
  if(action==='get'){
    const kind=String(p.kind||'repair'),id=String(p.id||'');if(!uuid(id)||!['repair','storage'].includes(kind))fail('Некорректная карточка');
    const table=kind==='repair'?'service_repairs':'storage_intakes';const rows=await sql.query(`select * from ${table} where id=$1 limit 1`,[id]);const record=rows[0];if(!record)fail('Приёмка не найдена',404);
    if(member.role==='mechanic'&&(kind!=='repair'||record.assigned_master_id!==user.id))fail('Нет доступа',403);
    const [events,payments,legal,linked]=await Promise.all([
      sql.query('select * from workshop_events where kind=$1 and record_id=$2 order by created_at desc limit 100',[kind,id]),
      manager?sql.query(`select * from workshop_payments where ${kind==='repair'?'repair_id':'storage_id'}=$1 order by created_at desc`,[id]):Promise.resolve([]),
      sql`select * from legal_entity_settings where id=1 limit 1`,
      kind==='storage'?sql.query('select id,repair_number,status,total_amount,paid_amount from service_repairs where storage_id=$1',[id]):Promise.resolve([]),
    ]);
    return json({data:{record,events,payments,legal:legal[0],linked}});
  }
  if(action==='file_url'){
    const path=String(p.path||'');if(!path.startsWith('workshop/'))fail('Неверный путь');return json({data:{url:await signedFileUrl(request,env,path)}});
  }
  if(action==='file_upload'){
    if(!manager)fail('Нет права загружать файлы',403);
    const path=String(p.path||''),mime=String(p.content_type||''),base64=String(p.content_base64||'');
    if(!path.startsWith('workshop/'))fail('Неверный путь');if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(mime))fail('Недопустимый тип файла');
    let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));}catch{fail('Повреждённый файл');}
    if(!bytes.length||bytes.length>15*1024*1024)fail('Файл слишком большой',413);
    await env.FASTGO_FILES.put(path,bytes,{httpMetadata:{contentType:mime}});return json({data:{path}});
  }
  if(action==='part_save'){
    if(!admin)fail('Нет права изменять справочник',403);
    const name=String(p.name||'').trim(),retail=Number(p.retail_price);if(!name||!Number.isFinite(retail)||retail<0)fail('Проверьте название и цену');
    const id=String(p.id||'');
    if(id&&uuid(id)){
      const rows=await sql.query('update parts set name=$2,sku=$3,category=$4,model=$5,unit=$6,unit_cost=$7,retail_price=$8,active=$9,updated_at=now() where id=$1 returning *',[id,name,String(p.sku||'').trim()||null,String(p.category||'').trim()||null,String(p.model||'').trim()||null,String(p.unit||'шт').trim()||'шт',Math.max(0,Number(p.unit_cost)||0),retail,p.active!==false&&String(p.active)!=='false']);return json({data:rows[0]});
    }
    const rows=await sql.query('insert into parts(name,sku,category,model,unit,unit_cost,retail_price) values($1,$2,$3,$4,$5,$6,$7) returning *',[name,String(p.sku||'').trim()||null,String(p.category||'').trim()||null,String(p.model||'').trim()||null,String(p.unit||'шт').trim()||'шт',Math.max(0,Number(p.unit_cost)||0),retail]);return json({data:rows[0]});
  }
  fail('Операция ещё не перенесена во внешний API',501);
}

export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    try{
      const url=new URL(request.url);
      if(request.method==='GET'&&url.pathname.startsWith('/files/'))return fileResponse(request,env);
      if(request.method==='GET'&&url.pathname==='/health'){
        const sql=neon(env.DATABASE_URL);const rows=await sql`select now() as now`;return json({ok:true,db:true,r2:true,now:rows[0]?.now});
      }
      if(request.method==='POST'&&url.pathname==='/api')return api(request,env);
      return json({error:'Not found'},404);
    }catch(e){const x=e as Error&{status?:number};return json({error:x.message||'Ошибка сервиса'},x.status||500);}
  }
} satisfies ExportedHandler<Env>;
