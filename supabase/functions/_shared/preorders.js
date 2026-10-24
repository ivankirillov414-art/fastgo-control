// Preorders use the existing immutable business event journal. The same atomic
// commit, device replicas and Google mirror retain every revision.
export const preorderStatuses={waiting:'Ожидаем',ordered:'Заказано',arrived:'Пришло',issued:'Выдано',cancelled:'Отменено'};
export const canPreorder=actor=>['developer','owner','admin','receiver','manager','seller'].includes(actor?.role)||actor?.can_sell===true;
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const uuid=value=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(value||''));
const text=(value,max=200)=>typeof value==='string'?value.trim().slice(0,max):'';
const latin={а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
const norm=value=>String(value||'').toLowerCase().replace(/[а-яё]/g,c=>latin[c]).replace(/\s+/g,' ').trim();
const localDate=value=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Yekaterinburg'}).format(new Date(value));
function phone(value){let digits=String(value||'').replace(/\D/g,'');if(digits.length===11&&/^[78]/.test(digits))digits=digits.slice(1);if(digits.length!==10)fail('Введите полный телефон: +7 и 10 цифр');return '+7'+digits;}
function date(value){if(!value)return '';if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)fail('Проверьте дату ожидания');return value;}
const equipmentCategories=['Электросамокаты','Электровелосипеды','Велосипеды','Электромопеды','Электроскутеры','Другая техника'];
const kind=product=>String(product['Категория']||'').startsWith('Техника · ')||equipmentCategories.some(c=>norm(c)===norm(product['Категория']))?'equipment':'part';
function journal(sheets){const latest=new Map(),history=new Map();for(const event of sheets['События']?.rows||[]){if(event['Тип']!=='preorder')continue;let details;try{details=JSON.parse(event['Детали']);}catch{continue;}const record=details?.record;if(!record||!uuid(record.id)||record.id!==event.record_id||!Number.isSafeInteger(record.revision)||record.revision<1)continue;if(!latest.has(record.id)||latest.get(record.id).revision<record.revision)latest.set(record.id,record);if(!history.has(record.id))history.set(record.id,[]);history.get(record.id).push({at:event['Дата'],actor_name:details.actor_name||'',action:event['Действие'],revision:record.revision,status:record.status,prepayment:record.prepayment,record});}return {latest,history};}
export function preorderOperation(sheets,action,p={},actor,{uuid:makeId,now}={}){
 if(!canPreorder(actor))fail('Предзаказы доступны сотрудникам приёмки и кассы',403);
 const {latest,history}=journal(sheets),records=[...latest.values()];
 if(action==='preorders'){
  const search=norm(p.search),status=p.status||'active',from=date(p.from),to=date(p.to);if(from&&to&&from>to)fail('Начальная дата позже конечной');
  if(!['active','archive','all',...Object.keys(preorderStatuses)].includes(status))fail('Выберите статус');
  const matchesStatus=r=>status==='all'||(status==='active'?!['issued','cancelled'].includes(r.status):status==='archive'?['issued','cancelled'].includes(r.status):r.status===status);
  const filtered=records.filter(r=>matchesStatus(r)&&(!from||localDate(r.created_at)>=from)&&(!to||localDate(r.created_at)<=to)&&(!search||norm([r.number,r.last_name,r.first_name,r.middle_name,r.phone,...r.items.map(i=>i.name)].join(' ')).includes(search)));
  filtered.sort((a,b)=>p.sort==='expected'?String(a.expected_on||'9999').localeCompare(String(b.expected_on||'9999'))||b.created_at.localeCompare(a.created_at):b.created_at.localeCompare(a.created_at)||b.number.localeCompare(a.number));
  const offset=Math.max(0,Math.floor(Number(p.offset)||0)),limit=50;return {result:{items:filtered.slice(offset,offset+limit),count:filtered.length,offset,limit,prepayment_total:Math.round(filtered.reduce((sum,r)=>sum+r.prepayment,0)*100)/100}};
 }
 if(action==='preorder_get'){if(!uuid(p.id))fail('Неверный предзаказ');const record=latest.get(p.id);if(!record)fail('Предзаказ не найден',404);const entries=(history.get(p.id)||[]).sort((a,b)=>b.revision-a.revision),offset=Math.max(0,Math.floor(Number(p.history_offset)||0));return {result:{record,history:entries.slice(offset,offset+25),history_count:entries.length,history_offset:offset}};}
 if(action==='preorder_suggestions'){
  const q=norm(p.search);if(q.length<2)return {result:[]};
  if(p.kind==='customer'){
   const clients=[...records.map(r=>({...r,full_name:[r.last_name,r.first_name,r.middle_name].filter(Boolean).join(' ')})),...(sheets['Клиенты']?.rows||[]).filter(c=>c.client_id).map(c=>({full_name:c['ФИО'],phone:c['Телефон']}))],seen=new Set();
   const phoneQuery=/^[+\d()\s-]+$/.test(q)?q.replace(/\D/g,''):'';
   return {result:clients.filter(c=>norm(c.full_name+' '+c.phone).includes(q)||phoneQuery.length>=2&&String(c.phone||'').replace(/\D/g,'').includes(phoneQuery)).filter(c=>{const key=String(c.phone);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,8).map(c=>({full_name:c.full_name,phone:c.phone}))};
  }
  return {result:(sheets['Товары']?.rows||[]).filter(r=>r.product_id&&r['Активен']!==false&&(!p.kind||p.kind==='all'||kind(r)===p.kind)&&norm([r['Модель / название'],r['Модель'],r['Артикул / SKU'],r['Штрих-код']].join(' ')).includes(q)).slice(0,12).map(r=>({id:r.product_id,name:r['Модель / название'],kind:kind(r),sku:r['Артикул / SKU']||'',model:r['Модель']||''}))};
 }
 if(action!=='preorder_save')fail('Неизвестная операция предзаказа');
 if(!uuid(p.id)||!uuid(p.request_id))fail('Неверный код предзаказа');
 const old=latest.get(p.id);if(old&&Number(p.revision)!==old.revision)fail('Предзаказ уже изменён на другом устройстве. Откройте его заново.',409);if(!old&&p.revision!==undefined&&Number(p.revision)!==0)fail('Предзаказ не найден',404);
 const first_name=text(p.first_name,80),last_name=text(p.last_name,80),middle_name=text(p.middle_name,80);if(!first_name||!last_name)fail('Укажите фамилию и имя клиента');
 if(!Array.isArray(p.items)||!p.items.length||p.items.length>20)fail('Добавьте от 1 до 20 позиций');
 const items=p.items.map((item,index)=>{
  if(!item||!['part','equipment'].includes(item.kind)||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>1000)fail('Проверьте позицию '+(index+1));
  let name=text(item.name),product_id=item.product_id||null,itemKind=item.kind;if(!name)fail('Укажите, что ожидает клиент');
  if(product_id){if(!uuid(product_id))fail('Неверный товар');const previous=old?.items.find(i=>i.product_id===product_id&&i.name===name&&i.kind===itemKind);if(!previous){const product=sheets['Товары']?.rows.find(r=>r.product_id===product_id&&r['Активен']!==false);if(!product)fail('Выбранный товар не найден или отключён');name=String(product['Модель / название']);itemKind=kind(product);}}
  return {kind:itemKind,product_id,name,quantity:item.quantity};
 });
 if(typeof p.prepayment!=='number'||!Number.isFinite(p.prepayment)||p.prepayment<0||p.prepayment>1e8||Math.abs(p.prepayment*100-Math.round(p.prepayment*100))>0.00001)fail('Укажите предоплату от 0 ₽ с точностью до копеек');
 const status=p.status||old?.status||'waiting';if(!Object.hasOwn(preorderStatuses,status))fail('Выберите статус предзаказа');
 const at=now(),number=old?.number||'ПЗ-'+String(records.reduce((max,r)=>Math.max(max,Number(String(r.number).replace(/^ПЗ-/,''))||0),0)+1).padStart(6,'0');
 const record={id:p.id,number,first_name,last_name,middle_name,phone:phone(p.phone),items,prepayment:Math.round(p.prepayment*100)/100,expected_on:date(p.expected_on),status,note:text(p.note,2000),created_at:old?.created_at||at,created_by:old?.created_by||actor.id,updated_at:at,updated_by:actor.id,revision:(old?.revision||0)+1};
 return {result:record,event:{event_id:makeId(),'Дата':at,'Тип':'preorder',record_id:record.id,'Действие':old?'preorder_update':'preorder_create',actor_id:actor.id,'Детали':JSON.stringify({actor_name:actor.name||actor.email||'',record}),updated_at:at}};
}
