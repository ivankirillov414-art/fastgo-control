const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type,apikey','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const out=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
export const versionPattern=/^\d{1,3}\.\d{1,3}\.\d{1,3}$/;
export function versionState(installed,latest){if(!latest)return 'unknown';const a=installed.split('.').map(Number),b=latest.split('.').map(Number);for(let i=0;i<3;i++){if(a[i]<b[i])return 'outdated';if(a[i]>b[i])return 'ahead';}return 'current';}
export function createVersionHandler({base,key,fetcher=fetch,now=()=>Date.now()}){
 let latest=null,checked=0;
 return async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return out({error:'Метод не поддерживается'},405);
  try{
   const auth=req.headers.get('authorization');if(!auth?.startsWith('Bearer '))return out({error:'Войдите в FastGo'},401);
   const u=await fetcher(base+'/auth/v1/user',{headers:{apikey:key,Authorization:auth},signal:AbortSignal.timeout(10000)});if(!u.ok)return out({error:'Войдите в FastGo'},401);
   const user=await u.json();if(!user.id)return out({error:'Войдите в FastGo'},401);
   const service={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
   const member=await fetcher(base+'/rest/v1/workshop_members?profile_id=eq.'+encodeURIComponent(user.id)+'&active=eq.true&select=profile_id&limit=1',{headers:service,signal:AbortSignal.timeout(10000)});
   if(!member.ok||!(await member.json()).length)return out({error:'Нет доступа'},403);
   const raw=await req.text();if(raw.length>2048)return out({error:'Неверные данные'},400);let p;try{p=JSON.parse(raw);}catch{return out({error:'Неверные данные'},400);}
   if(!p||!versionPattern.test(p.version||'')||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(p.device_id||''))return out({error:'Неверная версия или устройство'},400);
   if(!checked||now()-checked>300000){
    try{const response=await fetcher('https://api.github.com/repos/ivankirillov414-art/fastgo-control/releases?per_page=20',{headers:{Accept:'application/vnd.github+json','User-Agent':'FastGo-version-check'},signal:AbortSignal.timeout(10000)});if(response.ok){const releases=await response.json();const candidates=releases.filter(r=>!r.draft&&!r.prerelease&&/^fastgo-windows-v\d+\.\d+\.\d+$/.test(r.tag_name)&&r.assets?.some(a=>a.name==='latest.yml'));candidates.sort((a,b)=>{const av=a.tag_name.split('v').pop().split('.').map(Number),bv=b.tag_name.split('v').pop().split('.').map(Number);return bv[0]-av[0]||bv[1]-av[1]||bv[2]-av[2];});latest=candidates[0]?.tag_name.replace('fastgo-windows-v','')||null;checked=now();}}
    catch{latest=null;checked=0;}
   }
   const last_seen=new Date(now()).toISOString(),state=versionState(p.version,latest);
   const body={actor_id:user.id,device_id:p.device_id,version:p.version,latest_version:latest,update_state:state,last_seen};
   const save=await fetcher(base+'/rest/v1/workshop_app_versions?on_conflict=actor_id,device_id',{method:'POST',headers:{...service,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
   if(!save.ok)return out({error:'Не удалось передать версию'},503);
   return out({data:{installed:p.version,latest,state,last_seen}});
  }catch{return out({error:'Проверка версии временно недоступна'},503);}
 };
}
