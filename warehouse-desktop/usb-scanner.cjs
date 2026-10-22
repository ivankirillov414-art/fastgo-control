const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const DEVICE_PORT=17859,MAX_PENDING=2000;
const validCode=v=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=256&&!/[\x00-\x1f\x7f]/.test(v.trim());
class USBScanner{
 constructor({terminal,dir,assets=__dirname}){Object.assign(this,{terminal,dir,assets});this.target=null;this.status='USB-сканер выключен';this.connected=false;this.lastContact=0;this.launchedAt=0;this.polling=false;this.recognized=new Map();this.serialChain=Promise.resolve();this.state={token:crypto.randomBytes(32).toString('hex'),serial:'',enabled:false,autoConnect:true,pending:[],seen:[],results:[],mode:''};}
 async init(){await fs.mkdir(this.dir,{recursive:true});try{const s=JSON.parse(await fs.readFile(path.join(this.dir,'usb-scanner.json'),'utf8'));if(!/^[a-f0-9]{64}$/.test(s.token)||!Array.isArray(s.pending)||!Array.isArray(s.seen))throw Error('Повреждено хранилище USB-сканов');this.state={results:[],mode:'',...s,autoConnect:s.autoConnect??(!s.serial||s.enabled)};}catch(e){if(e.code!=='ENOENT')throw e;}await this.persist();await this.listen();this.timer=setInterval(()=>void this.tick(),2500);this.timer.unref();return this;}
 async persist(){const file=path.join(this.dir,'usb-scanner.json');await fs.writeFile(file+'.tmp',JSON.stringify(this.state),{mode:0o600});await fs.rename(file+'.tmp',file);}
 transaction(fn){const result=this.serialChain.then(async()=>{const before=JSON.stringify(this.state);try{const value=fn();await this.persist();return value;}catch(e){this.state=JSON.parse(before);throw e;}});this.serialChain=result.catch(()=>{});return result;}
 snapshot(){return{enabled:this.state.enabled,autoConnect:this.state.autoConnect,serial:this.state.serial,connected:this.connected,ready:this.connected&&Date.now()-this.lastContact<7000,lastContact:this.lastContact,status:this.connectionStatus(),pending:this.state.pending.length,unassigned:this.state.pending.filter(x=>!x.target).length,target:this.target?.label||'',recent:this.state.pending.slice(-15).map(x=>({code:x.code,time:x.time}))};}
 connectionStatus(){if(!this.connected)return this.status;if(Date.now()-this.lastContact<7000)return 'USB-сканер на терминале отвечает'+(this.target?' · '+this.target.label:' · откройте «Приход» или «Оплата»');return Date.now()-this.launchedAt>10000?'Кабель виден, но экран сканера не отвечает. Нажмите «Открыть сканер на терминале» и проверьте экран iData.':'Кабель виден. Ожидаем запуска экрана «FastGo · USB» на iData…';}
 setTarget(value){if(value!==null&&(!value||typeof value.key!=='string'||!/^[-a-zA-Z0-9:]{1,150}$/.test(value.key)||!['Приход','Оплата'].includes(value.label)))throw Error('Неверный документ');this.target=value;return this.snapshot();}
 batch(key){return{items:this.state.pending.filter(x=>x.target===key).slice(0,100),unassigned:this.state.pending.filter(x=>!x.target).length};}
 async claim(key){if(!this.target||this.target.key!==key)throw Error('Откройте документ');await this.transaction(()=>{for(const x of this.state.pending)if(!x.target)x.target=key;});return this.batch(key);}
 async ack(key,ids){if(!Array.isArray(ids)||ids.length>100||ids.some(x=>typeof x!=='string'))throw Error('Неверное подтверждение');await this.transaction(()=>{const accepted=new Set(ids);this.state.pending=this.state.pending.filter(x=>x.target!==key||!accepted.has(x.id));});return true;}
 async releaseTarget(key){await this.transaction(()=>{for(const x of this.state.pending)if(x.target===key)x.target=null;});if(this.target?.key===key)this.target=null;}
 async record(data){if(!this.state.enabled)throw Error('USB-сканер выключен');if(!data||!/^[-a-zA-Z0-9]{12,100}$/.test(data.id)||!validCode(data.code))throw Error('Неверный штрихкод');return this.transaction(()=>{if(this.state.seen.includes(data.id))return{accepted:true,duplicate:true};if(this.state.pending.length>=MAX_PENDING)throw Error('На ноутбуке накоплено 2000 сканов. Добавьте их в документ.');if(data.kind!==undefined&&!['receipt','sale'].includes(data.kind))throw Error('Неверная операция');const kind=data.kind||this.state.mode||(this.target?.label==='Приход'?'receipt':this.target?.label==='Оплата'?'sale':'');const item={id:data.id,code:data.code.trim(),kind,time:new Date().toISOString(),target:this.target?.key||null};this.state.pending.push(item);this.state.seen.push(item.id);this.state.seen=this.state.seen.slice(-10000);return{accepted:true};});}
 async selectMode(kind){if(!['receipt','sale'].includes(kind))throw Error('Неверная операция');await this.transaction(()=>{this.state.mode=kind;this.state.modeRevision=(this.state.modeRevision||0)+1;});return {kind};}
 inbox(){return {items:this.state.pending.filter(x=>x.kind).slice(0,100)};}
 async result(id,result){
  if(typeof id!=='string'||!result||typeof result!=='object')throw Error('Неверный результат');
  return this.transaction(()=>{const item=this.state.pending.find(x=>x.id===id);if(!item)return true;
   const value={id,code:item.code,kind:item.kind,name:String(result.name||'').slice(0,200),error:String(result.error||'').slice(0,300),price:Number(result.price)||0,quantity:Number(result.quantity)||1};
   if(!result.retry)this.state.pending=this.state.pending.filter(x=>x.id!==id);this.state.results=[...(this.state.results||[]),value].slice(-100);return true;
  });
 }
 async listen(){this.server=http.createServer((req,res)=>void this.handle(req,res));this.server.requestTimeout=5000;await new Promise((resolve,reject)=>{this.server.once('error',reject);this.server.listen(0,'127.0.0.1',resolve);});this.port=this.server.address().port;}
 async handle(req,res){const reply=(status,body,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; form-action 'self'"});res.end(type==='application/json'?JSON.stringify(body):body);};
 try{const hosts=['127.0.0.1:'+DEVICE_PORT,'127.0.0.1:'+this.port];if(!hosts.includes(req.headers.host)||req.headers.origin&&!hosts.map(h=>'http://'+h).includes(req.headers.origin))return reply(403,{error:'Недоступно'});const prefix='/'+this.state.token+'/';if(!req.url.startsWith(prefix))return reply(404,{error:'Нет страницы'});const route=req.url.slice(prefix.length).split('?')[0];
 if(req.method==='GET'&&['','phone.js'].includes(route)){const file=route?'usb-phone.js':'usb-phone.html';return reply(200,await fs.readFile(path.join(this.assets,file)),route?'text/javascript; charset=utf-8':'text/html; charset=utf-8');}
 if(req.method==='GET'&&route==='status'){this.lastContact=Date.now();return reply(200,{connected:true,target:this.target?.label||'',pending:this.state.pending.length,enabled:this.state.enabled,mode:this.state.mode,last:this.state.results?.at(-1)||null});}
 if(req.method==='POST'&&['scan','mode'].includes(route)){if(!(req.headers['content-type']||'').startsWith('application/json'))return reply(415,{error:'Неверный формат'});let bytes=0,body='';for await(const chunk of req){bytes+=chunk.length;if(bytes>2048)return reply(413,{error:'Слишком большой запрос'});body+=chunk;}const data=JSON.parse(body);const accepted=route==='mode'?await this.selectMode(data.kind):await this.record(data);this.lastContact=Date.now();return reply(200,accepted);}
 return reply(404,{error:'Нет страницы'});
 }catch(e){return reply(400,{error:e.message});}}
 async enable(serial){if(typeof serial!=='string'||!serial||serial.length>200)throw Error('Выберите терминал');const devices=await this.terminal.devices();if(!devices.some(x=>x.serial===serial&&x.state==='device'))throw Error('Подтвердите USB-отладку на терминале');if(this.state.serial&&this.state.serial!==serial)await this.removeTunnel();await this.transaction(()=>{this.state.serial=serial;this.state.enabled=true;this.state.autoConnect=true;});this.connected=false;this.lastContact=0;await this.tick(true);return this.snapshot();}
 async disable(){await this.transaction(()=>{this.state.enabled=false;this.state.autoConnect=false;});await this.removeTunnel();this.connected=false;this.status='USB-сканер выключен';return this.snapshot();}
 async removeTunnel(){if(this.state.serial)await this.terminal.command(['-s',this.state.serial,'reverse','--remove','tcp:'+DEVICE_PORT]).catch(()=>{});}
 // Only recognize authorized iData hardware or a device already running FastGo.
 // An unrelated phone is never selected just because it is the sole USB device.
 async discover(devices){
  const available=devices.filter(d=>d.state==='device');
  for(const serial of this.recognized.keys())if(!available.some(d=>d.serial===serial))this.recognized.delete(serial);
  const candidates=[];
  for(const d of available){
   let known=this.recognized.get(d.serial);
   if(known===undefined){
    known=/idata/i.test(d.model||'');
    if(!known){const output=await this.terminal.command(['-s',d.serial,'shell','pm','path','ru.fastgo.terminal.test']).catch(()=>'');known=/^package:/m.test(output);}
    if(!known){const maker=await this.terminal.command(['-s',d.serial,'shell','getprop','ro.product.manufacturer']).catch(()=>'');known=/idata/i.test(maker);}
    this.recognized.set(d.serial,known);
   }
   if(known)candidates.push(d);
  }
  if(candidates.length!==1){this.status=candidates.length>1?'Подключено несколько терминалов. Выберите нужный в «Сканер по USB».':devices.some(d=>d.state==='unauthorized')?'Разрешите USB-отладку на iData':'Подключите iData кабелем. Сканер откроется автоматически.';return null;}
  return candidates[0];
 }
 async tick(force=false){
  if(this.polling||(!this.state.enabled&&!this.state.autoConnect)||this.terminal.busy)return;
  this.polling=true;
  try{
   const devices=await this.terminal.devices();
   if(!this.state.enabled){
    if(!this.state.autoConnect)return;
    const found=await this.discover(devices);
    if(!found||!this.state.autoConnect)return;
    await this.transaction(()=>{if(!this.state.enabled&&this.state.autoConnect){this.state.serial=found.serial;this.state.enabled=true;}});
   }
   const serial=this.state.serial,d=devices.find(x=>x.serial===serial);
   if(!this.state.enabled)return;
   if(!d||d.state!=='device'){this.connected=false;this.lastContact=0;this.status=d?.state==='unauthorized'?'Разрешите USB-отладку на iData':'Подключите выбранный iData кабелем';return;}
   if(!this.connected||force){
    await this.terminal.command(['-s',serial,'reverse','tcp:'+DEVICE_PORT,'tcp:'+this.port]);
    if(!this.state.enabled||serial!==this.state.serial){await this.terminal.command(['-s',serial,'reverse','--remove','tcp:'+DEVICE_PORT]).catch(()=>{});return;}
    const url='http://127.0.0.1:'+DEVICE_PORT+'/'+this.state.token+'/';
    const output=await this.terminal.command(['-s',serial,'shell','am','start','-W','-a','android.intent.action.VIEW','-d',url]);
    if(/Error:|unable to resolve Intent|Exception|Status: timeout/.test(output))throw Error('Не удалось открыть экран сканера. На iData нужен браузер.');
    this.connected=true;this.launchedAt=Date.now();
   }
   this.status=this.connectionStatus();
  }catch(e){this.connected=false;this.status=e.message;}finally{this.polling=false;}
 }
 async close(){clearInterval(this.timer);await this.serialChain;await this.removeTunnel();if(this.server)await new Promise(r=>this.server.close(r));}
}
module.exports={USBScanner,DEVICE_PORT,validCode};
