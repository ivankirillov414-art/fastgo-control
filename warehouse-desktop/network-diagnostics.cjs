const fs=require('node:fs'),path=require('node:path'),dns=require('node:dns').promises,{execFile}=require('node:child_process'),{promisify}=require('node:util');
const execute=promisify(execFile),FEED='https://raw.githubusercontent.com/ivankirillov414-art/fastgo-control/main/warehouse/update/latest.yml',API='https://oqgpjfikjpcplnxueoki.supabase.co/functions/v1/fastgo-warehouse';
const {atomicWrite}=require('./backup-replica.cjs');
const text=(value,size=180)=>typeof value==='string'?value.slice(0,size):'',list=value=>Array.isArray(value)?value:[],number=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max?v:null;
const safeError=value=>text(value,1000).replace(/https?:\/\/[^\s]+/g,url=>url.split(/[?#]/)[0]).replace(/Bearer\s+\S+/gi,'Bearer [скрыто]').slice(0,240);
async function windowsSnapshot({platform=process.platform,exec=execute}={}){
 if(platform!=='win32')return {adapters:[],wifi:[],events:[],warnings:['windows_only']};
 const shell=path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
 const script=fs.readFileSync(path.join(__dirname,'network-snapshot.ps1'),'utf8');
 const {stdout}=await exec(shell,['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:15000,maxBuffer:512*1024,encoding:'utf8'});
 return JSON.parse(stdout.replace(/^\uFEFF/,''));
}
function cleanLocal(value={}){
 return {adapters:list(value.adapters).slice(0,12).map(x=>({name:text(x.name,100),description:text(x.description,140),status:text(x.status,24),link_speed:text(x.link_speed,40),wireless:x.wireless===true,ipv4:list(x.ipv4).filter(v=>typeof v==='string').slice(0,4),gateways:list(x.gateways).filter(v=>typeof v==='string').slice(0,4),dns:list(x.dns).filter(v=>typeof v==='string').slice(0,4)})),wifi:list(value.wifi).slice(0,8).map(x=>({ssid:text(x.ssid,64),signal_percent:number(x.signal_percent,0,100),receive_mbps:number(x.receive_mbps,0,100000),transmit_mbps:number(x.transmit_mbps,0,100000)})),events:list(value.events).filter(x=>[8001,8002,8003].includes(x.id)&&Number.isSafeInteger(x.record_id)&&Number.isFinite(Date.parse(x.at))).slice(0,200).map(x=>({id:x.id,record_id:x.record_id,at:x.at,reason:text(x.reason,240)})),gateway_ping:{status:['reply','no_reply'].includes(value.gateway_ping?.status)?value.gateway_ping.status:'unavailable',sent:number(value.gateway_ping?.sent,0,10),received:number(value.gateway_ping?.received,0,10),average_ms:number(value.gateway_ping?.average_ms,0,100000)},warnings:list(value.warnings).filter(v=>/^[a-z_]+$/.test(v)).slice(0,8)};
}
function conclusions(state){
 const result=[],wireless=state.local?.wifi||[],weak=wireless.some(x=>x.signal_percent!==null&&x.signal_percent<40),probes=state.probes||{};
 if(state.online===false)result.push({code:'offline',level:'error',message:'Windows сообщает об отсутствии сети. Проверьте подключение ноутбука к Wi‑Fi.'});
 if(weak)result.push({code:'weak_wifi',level:'warning',message:'Сигнал Wi‑Fi ниже 40%. Это может замедлять загрузку и увеличивать число обрывов.'});
 const failures=(state.history||[]).filter(x=>x.kind==='wifi_failed'||x.kind==='wifi_disconnected');
 if(failures.length)result.push({code:'wifi_history',level:'warning',message:'В журнале Windows есть неудачные подключения или отключения Wi‑Fi за последние сутки: '+failures.length+'. Отключения могут быть и ручными — время поможет сопоставить их со сбоем.'});
 if(probes.api&&!probes.api.reachable)result.push({code:'api_unreachable',level:'error',message:'Из приложения не удалось получить ответ сервера FastGo.'});
 if(probes.feed&&!probes.feed.ok)result.push({code:'feed_unreachable',level:'error',message:'Не удалось прочитать список обновлений.'});
 if(probes.download&&!probes.download.ok)result.push({code:'download_unreachable',level:'error',message:'Источник файла обновления не ответил успешно. Сервер FastGo и загрузка установщика проверяются отдельно.'});
 if(probes.dns&&!probes.dns.ok)result.push({code:'dns_failure',level:'warning',message:'Системный DNS не разрешил один из адресов. При использовании прокси приложение может обращаться к серверу другим способом.'});
 if(state.download?.stalled_seconds>=45)result.push({code:'download_stalled',level:'warning',message:'Загрузка не передаёт новые данные '+state.download.stalled_seconds+' сек. Обновлятор сохранит документы и повторит проверку при восстановлении связи.'});
 if(!result.length&&probes.api?.reachable&&probes.feed?.ok&&probes.download?.ok)result.push({code:'reachable',level:'ok',message:'Сервер и источник обновлений отвечают. Скорость ниже показана по реальному скачиванию; небольшая проверка доступности не измеряет пропускную способность канала.'});
 if(!result.length)result.push({code:'pending',level:'info',message:'Нажмите «Проверить сеть». Проверка использует небольшие запросы и не загружает установщик.'});
 return result;
}
class NetworkDiagnostics{
 constructor({dir,fetcher=fetch,local=windowsSnapshot,lookup=host=>dns.lookup(host),online=()=>true,update=()=>({}),now=()=>Date.now()}){
  Object.assign(this,{dir,fetcher,local,lookup,online,update,now});this.busy=false;this.lastProbe=0;this.lastBytes=0;this.lastProgress=now();this.wasDownloading=false;this.state={online:online(),local:null,probes:{},history:[],download:{},sampled_at:null};
  try{const saved=JSON.parse(fs.readFileSync(path.join(dir,'history.json'),'utf8'));this.state.history=list(saved).filter(x=>Number.isFinite(Date.parse(x.at))&&['online','offline','wifi_connected','wifi_failed','wifi_disconnected','update_error'].includes(x.kind)).slice(-200);}catch{}
 }
 save(){
  this.state.history=this.state.history.filter(x=>Date.parse(x.at)>=this.now()-86400000).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)).slice(-200);
  try{atomicWrite(path.join(this.dir,'history.json'),Buffer.from(JSON.stringify(this.state.history)));delete this.state.history_error;}catch{this.state.history_error='Не удалось сохранить историю сети';}
 }
 record(event){if(event.key&&this.state.history.some(x=>x.key===event.key))return;this.state.history.push({at:new Date(this.now()).toISOString(),...event});this.save();}
 observe(){
  this.state.history=this.state.history.filter(x=>Date.parse(x.at)>=this.now()-86400000);
  const online=this.online();if(online!==this.state.online){this.state.online=online;this.record({kind:online?'online':'offline'});}
  const update=this.update()||{},downloading=update.status==='downloading',bytes=Number(update.transferred)||0;
  if(!downloading||!this.wasDownloading||bytes!==this.lastBytes){this.lastProgress=this.now();this.lastBytes=bytes;}this.wasDownloading=downloading;
  const stalled=downloading?Math.max(0,Math.floor((this.now()-this.lastProgress)/1000)):0;
  this.state.download={status:text(update.status,24),version:text(update.version,24),transferred:bytes,total:Number(update.total)||0,bytes_per_second:downloading&&stalled<15?Number(update.bytesPerSecond)||0:0,stalled_seconds:stalled,error:safeError(update.error)};
  if(update.status==='error'&&update.error&&this.lastUpdateError!==update.error){this.lastUpdateError=update.error;this.record({kind:'update_error',message:'Не удалось загрузить обновление'});}
  if(update.status!=='error')this.lastUpdateError=null;
  this.state.conclusions=conclusions(this.state);return this.snapshot();
 }
 snapshot(){return JSON.parse(JSON.stringify({...this.state,busy:this.busy}));}
 async request(url,method='HEAD'){
  const start=this.now();try{const r=await this.fetcher(url,{method,cache:'no-store',signal:AbortSignal.timeout(8000)});let body='';
   if(method==='GET'){let bytes=0;for await(const part of r.body){bytes+=part.length;if(bytes>16384)throw Error('response_too_large');body+=Buffer.from(part).toString('utf8');}}
   else await r.body?.cancel?.().catch(()=>{});
   return {reachable:true,ok:r.ok,status:r.status,elapsed_ms:Math.max(0,this.now()-start),host:new URL(r.url||url).hostname,body};
  }catch(error){return {reachable:false,ok:false,status:null,elapsed_ms:Math.max(0,this.now()-start),host:new URL(url).hostname,error:error.name==='TimeoutError'||error.name==='AbortError'?'timeout':'connection_failed'};}
 }
 async probe(){
  if(this.inFlight)return this.inFlight;this.busy=true;
  this.inFlight=(async()=>{
   this.observe();const [local,api,feed]=await Promise.allSettled([this.local(),this.request(API,'OPTIONS'),this.request(FEED,'GET')]);
   if(local.status==='fulfilled'){
    this.state.local=cleanLocal(local.value);for(const e of this.state.local.events)this.record({key:'wlan:'+e.record_id,kind:({8001:'wifi_connected',8002:'wifi_failed',8003:'wifi_disconnected'})[e.id],at:e.at,reason:e.reason});
   }else this.state.local={...cleanLocal(),warnings:['adapter_read_unavailable']};
   const probes={api:api.status==='fulfilled'?api.value:{ok:false,reachable:false,error:'connection_failed'},feed:feed.status==='fulfilled'?feed.value:{ok:false,reachable:false,error:'connection_failed'}};
   const candidate=probes.feed.body?.match(/^\s*- url:\s*(https:\/\/\S+)/m)?.[1];delete probes.feed.body;delete probes.api.body;
   if(candidate&&/^https:\/\/github\.com\/ivankirillov414-art\/fastgo-control\/releases\/download\/fastgo-warehouse-v\d+\.\d+\.\d+\/FastGo-Warehouse-Setup-\d+\.\d+\.\d+-Windows-x64\.exe$/.test(candidate)){probes.download=await this.request(candidate);delete probes.download.body;}
   else if(probes.feed.ok)probes.download={reachable:false,ok:false,error:'manifest_invalid'};
   const hosts=[new URL(API).hostname,new URL(FEED).hostname,...(probes.download?.host?[probes.download.host]:[])];
   const answers=await Promise.all(hosts.map(async host=>{let timer;try{await Promise.race([this.lookup(host),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),4000);})]);return {host,ok:true};}catch{return {host,ok:false};}finally{clearTimeout(timer);}}));
   probes.dns={ok:answers.every(x=>x.ok),hosts:answers};this.state.probes=probes;this.state.sampled_at=new Date(this.now()).toISOString();this.lastProbe=this.now();this.busy=false;return this.observe();
  })().finally(()=>{this.busy=false;this.inFlight=null;});return this.inFlight;
 }
 summary(){
  const state=this.observe(),signals=state.local?.wifi.map(x=>x.signal_percent).filter(x=>x!==null)||[];
  return {sampled_at:state.sampled_at,online:state.online,wifi_signal_percent:signals.length?Math.min(...signals):null,disconnects_24h:state.history.filter(x=>x.kind==='wifi_disconnected').length,api_ok:state.probes.api?.reachable??null,feed_ok:state.probes.feed?.ok??null,download_ok:state.probes.download?.ok??null,download_bytes_per_second:state.download.bytes_per_second,stalled_seconds:state.download.stalled_seconds,codes:state.conclusions.map(x=>x.code)};
 }
}
module.exports={NetworkDiagnostics,windowsSnapshot,cleanLocal,conclusions};
