const FASTGO_SPREADSHEET_ID = '1f-uEIV8NXKmz5hBoaxKZBXVh55AjexZlH9SIYQIU_vo';
let ROW_CACHE = {};
const SHEETS = {
  settings:'Настройки', categories:'Категории', products:'Товары', clients:'Клиенты', intakes:'Приёмки',
  repairs:'Ремонты', storage:'Зимнее хранение', movements:'Движения склада', sales:'Продажи',
  saleItems:'Строки продаж', staff:'Сотрудники', services:'Прайс работ', legal:'Реквизиты',
  payments:'Оплаты', events:'События', files:'Файлы миграции'
};

function doGet() { ROW_CACHE={}; return json_({ok:true, service:'FastGo Google Sheets API'}); }
function doPost(e) {
  ROW_CACHE={};
  try {
    const input = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const expected = PropertiesService.getScriptProperties().getProperty('FASTGO_API_SECRET');
    if (!expected || input.secret !== expected) throw httpError_('Нет доступа', 403);
    const action = String(input.action || '');
    const p = input.params || {};
    const actor = input.actor || {};
    const result = route_(action, p, actor);
    return json_({data:result});
  } catch (err) {
    return json_({error:err && err.message ? err.message : 'Ошибка FastGo', status:Number(err && err.status) || 400});
  }
}

function route_(action,p,actor){ return reliableRoute_(action,p,actor); }
function routeUnlocked_(action,p,actor){
  switch(action){
    case 'health': return health_();
    case 'catalog': return catalog_();
    case 'part_by_barcode': return partByBarcode_(p);
    case 'part_save': requireAdmin_(actor); return partSave_(p);
    case 'part_photo_upload': requireAdmin_(actor); return privatePartUpload_(p); 
    case 'part_photo_url': return privatePartPhoto_(p);
    case 'part_photos': return partPhotos_(p);
    case 'part_photo_primary': requireAdmin_(actor); return partPhotoPrimary_(p);
    case 'backup_status': requireAdmin_(actor); return backupStatus_();
    case 'migration_manifest': return migrationManifest_(actor);
    case 'migrate_legacy_file': return migrateLegacy_(p,actor);
    case 'operation_status': return operationStatus_(p,actor);
    case 'signed_url': return signedUrl_(p,actor);
    case 'stock_history': return stockHistory_(p);
    case 'stock': requireManager_(actor); return stock_(p,actor);
    case 'sale': requireManager_(actor); return sale_(p,actor);
    case 'sales': requireManager_(actor); return sales_(p);
    case 'list': return list_(p,actor);
    case 'get': return get_(p,actor);
    case 'create': requireManager_(actor); return createOrder_(p,actor);
    case 'update': return updateOrder_(p,actor);
    case 'payment': requireManager_(actor); return payment_(p,actor);
    case 'documents': return documents_(p,actor);
    case 'upload': return upload_(p,actor);
    case 'extend': requireManager_(actor); return extend_(p,actor);
    case 'contact': return contact_(p,actor);
    case 'overview': return overview_();
    case 'customers': requireManager_(actor); return customers_(p);
    case 'finance': requireManager_(actor); return finance_(p);
    case 'legacy': return [];
    case 'import_legacy': throw httpError_('Старые заказы уже перенесены в рабочую базу',409);
    case 'catalog_save': requireAdmin_(actor); return catalogSave_(p);
    case 'legal': return legal_();
    case 'legal_save': requireAdmin_(actor); return legalSave_(p);
    default: throw httpError_('Операция не поддерживается: '+action,400);
  }
}

function ss_(){ return SpreadsheetApp.openById(FASTGO_SPREADSHEET_ID); }
function sh_(name){ const s=ss_().getSheetByName(name); if(!s) throw httpError_('Нет листа '+name,500); return s; }
function rows_(name){
  if(ROW_CACHE[name]) return ROW_CACHE[name];
  const s=sh_(name), last=s.getLastRow(), cols=s.getLastColumn();
  if(last<2 || cols<1) return ROW_CACHE[name]=[];
  const values=s.getRange(1,1,last,cols).getValues(), headers=values[0].map(String);
  return ROW_CACHE[name]=values.slice(1).map((r,i)=>Object.fromEntries(headers.map((h,j)=>[h,r[j]]))).map((o,i)=>Object.assign(o,{__row:i+2}));
}
function headers_(name){ return sh_(name).getRange(1,1,1,sh_(name).getLastColumn()).getValues()[0].map(String); }
function append_(name,obj){ return stagedAppend_(name,obj); }
function patchRow_(name,row,obj){ return stagedPatch_(name,row,obj); }
function find_(name,key,value){ return rows_(name).find(r=>String(r[key])===String(value)); }
function setting_(key){ const r=find_(SHEETS.settings,'Ключ',key); return r ? r['Значение'] : ''; }
function setSetting_(key,value){ const r=find_(SHEETS.settings,'Ключ',key); if(!r) return append_(SHEETS.settings,{Ключ:key,Значение:value}); return patchRow_(SHEETS.settings,r.__row,{Значение:value}); }
function nextSeq_(key){ const n=Number(setting_(key)||1); setSetting_(key,n+1); return n; }
function pad_(n,w){ return String(n).padStart(w,'0'); }
function uid_(){ return Utilities.getUuid(); }
function now_(){ return new Date().toISOString(); }
function num_(v){ const n=Number(v); return Number.isFinite(n)?n:0; }
function bool_(v){ return v===true || String(v).toLowerCase()==='true' || String(v).toLowerCase()==='да'; }
function role_(a){ return String(a.role||''); }
function requireManager_(a){ if(!['owner','admin','receiver','manager'].includes(role_(a))) throw httpError_('Нет доступа',403); }
function requireAdmin_(a){ if(!['owner','admin'].includes(role_(a))) throw httpError_('Нет права изменять справочник',403); }
function httpError_(m,s){ const e=new Error(m); e.status=s; return e; }
function json_(obj){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }


function fullName_(p){ return [p.last_name,p.first_name,p.middle_name].filter(Boolean).join(' ').trim(); }
function splitName_(s){ const a=String(s||'').trim().split(/\s+/); return {last_name:a[0]||'',first_name:a[1]||'',middle_name:a.slice(2).join(' ')}; }

function mapProduct_(r){ return {id:r.product_id,name:r['Модель / название'],sku:r['Артикул / SKU'],barcode:r['Штрих-код'],category:r['Категория'],model:r['Модель'],unit:r['Ед.']||'шт',quantity:num_(r['Остаток, шт.']),unit_cost:num_(r['Цена закупки, ₽']),retail_price:num_(r['Цена продажи, ₽']),price_note:r['Фото / примечание']||'',active:r['Активен']!==false,primary_photo_path:r['Фото URL']||''}; }
function mapService_(r){ return {id:r.service_id,code:r['Код'],category:r['Категория'],wheel_position:r['Позиция колеса'],service_kind:r['Тип работы'],title:r['Работа'],parts_price:num_(r['Запчасти, ₽']),labor_price:num_(r['Работа, ₽']),total_price:num_(r['Итого, ₽']),labor_price_max:num_(r['Работа максимум, ₽']),pricing_note:r['Примечание'],active:r['Активна']!==false}; }
function mapStaff_(r){ return {profile_id:r.employee_id,name:r['ФИО'],email:r['Email'],role:({'Владелец':'owner','Администратор':'admin','Мастер-приёмщик':'receiver','Механик':'mechanic','Менеджер':'manager','Кассир':'manager'})[r['Роль']]||r['Роль'],active:r['Активен']!==false,tags:[]}; }
function catalog_(){
  return {services:rows_(SHEETS.services).filter(r=>r['Работа']).map(mapService_).filter(x=>x.active),parts:rows_(SHEETS.products).filter(r=>r.product_id).map(mapProduct_),staff:rows_(SHEETS.staff).filter(r=>r.employee_id).map(mapStaff_),categories:rows_(SHEETS.categories).filter(r=>r['Категория (ключ)']).map(r=>({id:r['Категория (ключ)'],name:r['Категория (ключ)'],label:r['Понятное название'],barcode:r['Штрих-код категории'],primary_photo_path:r['Основное фото']||''}))};
}
function partByBarcode_(p){ const c=String(p.barcode||'').trim().toUpperCase(); const x=rows_(SHEETS.products).filter(r=>r.product_id).map(mapProduct_).find(x=>String(x.barcode).toUpperCase()===c||String(x.sku).toUpperCase()===c); if(!x) throw httpError_('Товар с таким штрих-кодом не найден',404); return x; }
function partSave_(p){
  let r=p.id?find_(SHEETS.products,'product_id',p.id):null; const now=now_();
  if(!String(p.name||'').trim()) throw httpError_('Укажите название',400);
  if(r){ patchRow_(SHEETS.products,r.__row,{'Категория':String(p.category||''),'Модель / название':String(p.name).trim(),'Модель':String(p.model||''),'Артикул / SKU':String(p.sku||''),'Ед.':String(p.unit||'шт'),'Цена закупки, ₽':num_(p.unit_cost),'Цена продажи, ₽':num_(p.retail_price),'Активен':p.active!==false,updated_at:now}); return mapProduct_(find_(SHEETS.products,'product_id',p.id)); }
  const n=nextSeq_('next_product_seq'), id=uid_(), barcode='FGP-'+pad_(n,8);
  append_(SHEETS.products,{'Категория':String(p.category||''),'Модель / название':String(p.name).trim(),'Модель':String(p.model||''),'Артикул / SKU':String(p.sku||''),'Штрих-код':barcode,'Ед.':String(p.unit||'шт'),'Цена закупки, ₽':num_(p.unit_cost),'Цена продажи, ₽':num_(p.retail_price),'Приход, шт.':0,'Сумма прихода, ₽':0,'Фото / примечание':'',product_id:id,'Остаток, шт.':0,'Активен':true,'Фото URL':'',updated_at:now});
  return mapProduct_(find_(SHEETS.products,'product_id',id));
}
function stockHistory_(p){ if(!p.part_id) throw httpError_('Не указана запчасть',400); return rows_(SHEETS.movements).filter(r=>String(r.product_id)===String(p.part_id)).sort((a,b)=>String(b['Дата']).localeCompare(String(a['Дата']))).slice(0,100).map(r=>({id:r.movement_id,part_id:r.product_id,movement_type:({'Приход':'receipt','Расход':'issue','Продажа':'issue','Возврат':'return','Корректировка':'adjustment'})[r['Тип']]||r['Тип'],quantity:num_(r['Количество']),note:r['Комментарий'],created_at:r['Дата']})); }
function stock_(p,actor){
  if(!Number.isInteger(Number(p.quantity))||Number(p.quantity)<1)throw httpError_('Неверное количество',400);
  if(!['receipt','return','issue','adjustment'].includes(p.movement_type))throw httpError_('Неверное движение',400);
  if(p.movement_type==='adjustment'){requireAdmin_(actor);if(!Number.isInteger(Number(p.balance_after))||Number(p.balance_after)<0)throw httpError_('Неверный остаток',400);}
  const req=String(p.request_id||''); if(req){ const old=find_(SHEETS.movements,'request_id',req); if(old) return old; }
  const r=find_(SHEETS.products,'product_id',p.part_id); if(!r) throw httpError_('Товар не найден',404);
  const q=Math.max(1,Math.floor(num_(p.quantity))), type=String(p.movement_type||'receipt'); let stock=num_(r['Остаток, шт.']);
  if(type==='receipt'||type==='return') stock+=q; else if(type==='issue'){ if(stock<q) throw httpError_('Недостаточно товара на складе',409); stock-=q; } else if(type==='adjustment') stock=num_(p.balance_after!==undefined?p.balance_after:q);
  patchRow_(SHEETS.products,r.__row,{'Остаток, шт.':stock,updated_at:now_()});
  const mt=({receipt:'Приход',issue:'Расход',return:'Возврат',adjustment:'Корректировка'})[type]||type;
  const movement={movement_id:uid_(),'Дата':now_(),'Тип':mt,product_id:r.product_id,'Штрих-код':r['Штрих-код'],'Товар':r['Модель / название'],'Количество':q,'Цена закупки':num_(r['Цена закупки, ₽']),'Цена продажи':num_(r['Цена продажи, ₽']),'Сумма':q*num_(r['Цена закупки, ₽']),'Источник':'Приложение',reference_id:String(p.reference_id||''),'Сотрудник':actor.email||actor.id||'','Комментарий':String(p.note||''),'Остаток после':stock,request_id:req};
  append_(SHEETS.movements,movement); return movement;
}
function sale_(p,actor){
  const req=String(p.request_id||''); if(req){ const old=find_(SHEETS.sales,'request_id',req); if(old) return saleResponse_(old); }
  const merged={};for(const x of (Array.isArray(p.items)?p.items:[])){const id=x.part_id||x.id,q=Number(x.quantity);if(!id||!Number.isInteger(q)||q<1)throw httpError_('Неверное количество',400);merged[id]=(merged[id]||0)+q;}
  const items=Object.entries(merged).map(([part_id,quantity])=>({part_id,quantity}));if(!items.length)throw httpError_('Корзина пустая',400);
  if(!['cash','card','transfer'].includes(p.payment_method))throw httpError_('Укажите оплату',400);if(num_(p.discount)>0)requireAdmin_(actor);
  const prepared=items.map(i=>{ const r=find_(SHEETS.products,'product_id',i.part_id||i.id); if(!r||r['Активен']===false) throw httpError_('Товар не найден',404); const q=Math.max(1,Math.floor(num_(i.quantity))); const stock=num_(r['Остаток, шт.']); if(stock<q) throw httpError_('Недостаточно на складе: '+r['Модель / название'],409); return {r,q,price:num_(r['Цена продажи, ₽'])}; });
  const no=nextSeq_('next_sale_seq'), id=uid_(), created=now_(), subtotal=prepared.reduce((s,x)=>s+x.q*x.price,0), discount=Math.max(0,num_(p.discount)), total=Math.max(0,subtotal-discount);
  const sale={sale_id:id,'Номер':'FGS-'+pad_(no,6),'Дата':created,client_id:String(p.client_id||''),'Клиент':String(p.client_name||''),'Сотрудник':actor.email||actor.id||'','Способ оплаты':({'cash':'Наличные','card':'Карта','transfer':'Перевод','mixed':'Смешанная'})[p.payment_method]||p.payment_method||'Наличные','Сумма':subtotal,'Скидка':discount,'Итого':total,'Статус':'Проведена','Комментарий':String(p.note||''),updated_at:created,request_id:req,'Документ URL':''}; append_(SHEETS.sales,sale);
  prepared.forEach((x,idx)=>{ const stock=num_(x.r['Остаток, шт.'])-x.q; patchRow_(SHEETS.products,x.r.__row,{'Остаток, шт.':stock,updated_at:created}); const movementId=uid_(); append_(SHEETS.movements,{movement_id:movementId,'Дата':created,'Тип':'Продажа',product_id:x.r.product_id,'Штрих-код':x.r['Штрих-код'],'Товар':x.r['Модель / название'],'Количество':x.q,'Цена закупки':num_(x.r['Цена закупки, ₽']),'Цена продажи':x.price,'Сумма':x.q*x.price,'Источник':'Продажа',reference_id:id,'Сотрудник':actor.email||actor.id||'','Комментарий':'Продажа '+sale['Номер'],'Остаток после':stock,request_id:req?req+':'+idx:''}); append_(SHEETS.saleItems,{sale_item_id:uid_(),sale_id:id,product_id:x.r.product_id,'Штрих-код':x.r['Штрих-код'],'Товар':x.r['Модель / название'],'Количество':x.q,'Цена':x.price,'Скидка':0,'Сумма строки':x.q*x.price,movement_id:movementId}); });
  return saleResponse_(find_(SHEETS.sales,'sale_id',id));
}
function saleResponse_(r){ return {id:r.sale_id,sale_number:r['Номер'],cashier_id:r['Сотрудник'],payment_method:r['Способ оплаты'],total:num_(r['Итого']),note:r['Комментарий'],created_at:r['Дата']}; }
function sales_(p){ const all=rows_(SHEETS.sales).filter(r=>r.sale_id).sort((a,b)=>String(b['Дата']).localeCompare(String(a['Дата']))), limit=Math.min(100,Math.max(1,num_(p.limit)||50)), offset=Math.max(0,num_(p.offset)); return {items:all.slice(offset,offset+limit).map(saleResponse_),count:all.length,offset,limit}; }


function partPhotoUrl_(p){ const r=find_(SHEETS.products,'product_id',p.part_id); if(!r||!r['Фото URL']) throw httpError_('У товара нет фотографии',404); return {url:r['Фото URL']}; }





function ensureClient_(p,intakeNo){ const phone=String(p.phone||'').trim(); let c=rows_(SHEETS.clients).find(r=>String(r['Телефон'])===phone); const name=fullName_(p); if(c){ patchRow_(SHEETS.clients,c.__row,{'ФИО':name,Email:String(p.email||c['Email']||''),'Последняя приёмка':intakeNo,'Кол-во заказов':num_(c['Кол-во заказов'])+1,updated_at:now_()}); return c.client_id; } const id='client-'+uid_(); append_(SHEETS.clients,{client_id:id,'Создан':now_(),'ФИО':name,'Телефон':phone,Telegram:'',Email:String(p.email||''),'Примечание':'',Активен:true,'Последняя приёмка':intakeNo,'Кол-во заказов':1,updated_at:now_()}); return id; }







function ymd_(v){
  if(!v) return '';
  const d=v instanceof Date?v:new Date(v);
  if(!Number.isFinite(d.getTime())) return String(v).slice(0,10);
  return Utilities.formatDate(d,'Asia/Yekaterinburg','yyyy-MM-dd');
}
function overview_(){
  const repairs=rows_(SHEETS.repairs).filter(r=>r.repair_id).map(mapRepair_);
  const storage=rows_(SHEETS.storage).filter(r=>r.storage_id).map(mapStorage_);
  const products=rows_(SHEETS.products).filter(r=>r.product_id&&r['Активен']!==false);
  const payments=rows_(SHEETS.payments).filter(r=>r.payment_id);
  const today=Utilities.formatDate(new Date(),'Asia/Yekaterinburg','yyyy-MM-dd');
  const until=new Date(today+'T12:00:00+05:00'); until.setDate(until.getDate()+7); const dueEnd=ymd_(until);
  const activeRepairs=repairs.filter(r=>!['issued','cancelled'].includes(r.status));
  const activeStorage=storage.filter(r=>!['returned','cancelled'].includes(r.status));
  const overdue=activeRepairs.filter(r=>!['ready'].includes(r.status)&&r.promised_date&&String(r.promised_date)<today).length;
  const storageDue=activeStorage.filter(r=>r.planned_return_date&&String(r.planned_return_date)>=today&&String(r.planned_return_date)<=dueEnd).length;
  const debtRepairs=repairs.filter(r=>r.status!=='cancelled').reduce((s,r)=>s+Math.max(0,num_(r.total_amount)-num_(r.paid_amount)),0);
  const debtStorage=storage.filter(r=>r.status!=='cancelled').reduce((s,r)=>s+Math.max(0,num_(r.storage_amount)-num_(r.paid_amount)),0);
  return {
    repairs:activeRepairs.length,
    overdue:overdue,
    ready:repairs.filter(r=>r.status==='ready').length,
    storage:activeStorage.length,
    storage_due:storageDue,
    today_payments:payments.filter(r=>ymd_(r['Дата'])===today).reduce((s,r)=>s+num_(r['Сумма']),0),
    debt:debtRepairs+debtStorage,
    low_stock:products.filter(r=>num_(r['Остаток, шт.'])<=2).length
  };
}
function customers_(p){
  const intakes=rows_(SHEETS.intakes).filter(r=>r.intake_id), repairs=rows_(SHEETS.repairs).filter(r=>r.repair_id), storage=rows_(SHEETS.storage).filter(r=>r.storage_id);
  let items=rows_(SHEETS.clients).filter(r=>r.client_id).map(c=>{
    const ci=intakes.filter(i=>String(i.client_id)===String(c.client_id));
    const intakeIds=new Set(ci.map(i=>String(i.intake_id)));
    const cr=repairs.filter(r=>intakeIds.has(String(r.intake_id))).map(mapRepair_);
    const cs=storage.filter(r=>String(r.client_id)===String(c.client_id)).map(mapStorage_);
    const vehicles=[...new Set(ci.map(i=>String(i['Бренд / модель']||'').trim()).filter(Boolean))];
    const visits=[...cr.map(x=>x.created_at),...cs.map(x=>x.created_at)].filter(Boolean).sort();
    const debt=cr.reduce((s,x)=>s+Math.max(0,num_(x.total_amount)-num_(x.paid_amount)),0)+cs.reduce((s,x)=>s+Math.max(0,num_(x.storage_amount)-num_(x.paid_amount)),0);
    return {id:c.client_id,full_name:c['ФИО'],phone:c['Телефон'],email:c['Email']||'',vehicles:vehicles,orders:cr.length+cs.length,last_visit:visits.length?visits[visits.length-1]:c['Создан'],debt:debt};
  });
  const q=String(p.search||'').trim().toLowerCase(); if(q) items=items.filter(x=>(x.full_name+' '+x.phone+' '+x.vehicles.join(' ')).toLowerCase().includes(q));
  items.sort((a,b)=>String(b.last_visit||'').localeCompare(String(a.last_visit||'')));
  const offset=Math.max(0,Math.floor(num_(p.offset))), limit=100;
  return {items:items.slice(offset,offset+limit),count:items.length,offset,limit};
}
function finance_(p){
  const repairs=Object.fromEntries(rows_(SHEETS.repairs).filter(r=>r.repair_id).map(r=>[String(r.repair_id),r]));
  const storage=Object.fromEntries(rows_(SHEETS.storage).filter(r=>r.storage_id).map(r=>[String(r.storage_id),r]));
  let rows=rows_(SHEETS.payments).filter(r=>r.payment_id);
  const from=String(p.from||''), to=String(p.to||'');
  if(from) rows=rows.filter(r=>ymd_(r['Дата'])>=from); if(to) rows=rows.filter(r=>ymd_(r['Дата'])<=to);
  rows.sort((a,b)=>String(b['Дата']).localeCompare(String(a['Дата'])));
  const mapMethod=v=>({cash:'cash',card:'card',transfer:'transfer','Наличные':'cash','Карта':'card','Банковская карта':'card','Перевод':'transfer'})[String(v)]||String(v||'cash');
  const mapped=rows.map(r=>{ const kind=String(r['Тип']), id=String(r.record_id||''), isRepair=kind==='repair', target=isRepair?repairs[id]:storage[id], no=target?(isRepair?target['Номер ремонта']:target['Номер']):''; return {id:r.payment_id,created_at:r['Дата'],repair_id:isRepair?id:null,storage_id:isRepair?null:id,repair_number:isRepair?(Number(String(no).replace(/\D/g,''))||no):null,storage_number:isRepair?null:(Number(String(no).replace(/\D/g,''))||no),method:mapMethod(r['Способ оплаты']),amount:num_(r['Сумма']),note:r['Комментарий']||'',actor_id:r['Сотрудник']||''}; });
  const total=mapped.reduce((s,x)=>s+x.amount,0), sum=m=>mapped.filter(x=>x.method===m).reduce((s,x)=>s+x.amount,0), offset=Math.max(0,Math.floor(num_(p.offset))), limit=100;
  return {items:mapped.slice(offset,offset+limit),count:mapped.length,offset,limit,total:total,cash:sum('cash'),card:sum('card'),transfer:sum('transfer')};
}
function catalogSave_(p){ const r=find_(SHEETS.services,'service_id',p.id); if(!r) throw httpError_('Услуга не найдена',404); patchRow_(SHEETS.services,r.__row,{'Работа':String(p.title||r['Работа']),'Работа, ₽':num_(p.labor_price),updated_at:now_()}); return mapService_(find_(SHEETS.services,'service_id',p.id)); }
function legal_(){ return Object.fromEntries(rows_(SHEETS.legal).filter(r=>r['Ключ']).map(r=>[r['Ключ'],r['Значение']])); }
function legalSave_(p){ const fields=['legal_name','full_name','inn','ogrnip','registration_address','bank_name','bik','correspondent_account','settlement_account','phone','email']; fields.forEach(k=>{ let r=find_(SHEETS.legal,'Ключ',k); if(r) patchRow_(SHEETS.legal,r.__row,{'Значение':String(p[k]||'')}); else append_(SHEETS.legal,{'Ключ':k,'Значение':String(p[k]||''),'Примечание':''}); }); return legal_(); }

// ---- Google Sheets v1 production helpers ----
function parseJson_(v,fallback){
  fallback=fallback||[];
  if(Array.isArray(v)) return v;
  try{ const x=JSON.parse(String(v||'')); return Array.isArray(x)?x:fallback; }catch(_){ return fallback; }
}
function isManager_(a){ return ['owner','admin','receiver','manager'].includes(role_(a)); }
function assertRevision_(row,p){
  const current=Math.max(1,Math.floor(num_(row.revision)||1));
  if(p.revision!==undefined&&p.revision!==''&&Number(p.revision)!==current) throw httpError_('Карточка уже изменена другим сотрудником. Обновите страницу.',409);
  return current;
}
function canEditOrder_(actor,kind,row){
  if(isManager_(actor)) return true;
  return role_(actor)==='mechanic' && kind==='repair' && String(row.master_id||'')===String(actor.id||'');
}
function requireOrderAccess_(actor,kind,row){ if(!canEditOrder_(actor,kind,row)) throw httpError_('Нет доступа к этой карточке',403); }
function normStatus_(v,kind){
  const repair={'Принят':'accepted','Принято':'accepted','Новая':'accepted','Диагностика':'diagnostics','На диагностике':'diagnostics','Ждём запчасти':'waiting_parts','Ожидает запчасть':'waiting_parts','В ремонте':'repair','В работе':'repair','Готов':'ready','Готово':'ready','Выдан':'issued','Отменён':'cancelled','Отменено':'cancelled'};
  const storage={'Принят':'accepted','Принято':'accepted','Новая':'accepted','На хранении':'stored','Продлено':'stored','К выдаче':'ready_return','Выдан':'returned','Возвращено':'returned','Отменён':'cancelled','Отменено':'cancelled'};
  const raw=String(v||''); return (kind==='storage'?storage:repair)[raw]||raw||(kind==='storage'?'accepted':'accepted');
}
function humanStatus_(v,kind){
  const repair={accepted:'Принят',diagnostics:'Диагностика',waiting_parts:'Ждём запчасти',repair:'В ремонте',ready:'Готов',issued:'Выдан',cancelled:'Отменён'};
  const storage={accepted:'Принят',stored:'На хранении',ready_return:'К выдаче',returned:'Выдан',cancelled:'Отменён'};
  return (kind==='storage'?storage:repair)[String(v||'')] || String(v||'') || 'Принят';
}
function list_(p,actor){
  const kind=p.kind==='storage'?'storage':'repair';
  if(role_(actor)==='mechanic'&&kind==='storage') throw httpError_('Нет доступа',403);
  let items=kind==='storage'?rows_(SHEETS.storage).filter(r=>r.storage_id).map(mapStorage_):rows_(SHEETS.repairs).filter(r=>r.repair_id).map(mapRepair_);
  if(role_(actor)==='mechanic') items=items.filter(x=>String(x.assigned_master_id||'')===String(actor.id||''));
  const search=String(p.search||'').toLowerCase().trim();
  if(search) items=items.filter(x=>JSON.stringify(x).toLowerCase().includes(search));
  if(p.status&&p.status!=='all'&&p.status!=='active') items=items.filter(x=>x.status===p.status);
  if(p.status==='active') items=items.filter(x=>!['issued','returned','cancelled'].includes(x.status));
  items.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  const limit=Math.min(100,Math.max(1,num_(p.limit)||50)),offset=Math.max(0,num_(p.offset));
  return {items:items.slice(offset,offset+limit),count:items.length,offset,limit};
}
function mapStorage_(r){
  const intake=find_(SHEETS.intakes,'intake_id',r.intake_id)||{};
  const client=find_(SHEETS.clients,'client_id',r.client_id)||{};
  const n=splitName_(intake['Клиент']||r['Клиент']);
  const vehicle=String(intake['Бренд / модель']||r['Техника']||'').trim().split(/\s+/);
  const amount=num_(r['Сумма']), wash=bool_(r['Мойка +500']), tariff=String(r['Тариф']||'monthly');
  const months=tariff==='monthly'?Math.max(1,Math.round((amount-(wash?500:0))/1990)||1):0;
  return {
    id:r.storage_id,storage_number:Number(String(r['Номер']).replace(/\D/g,''))||r['Номер'],
    last_name:n.last_name,first_name:n.first_name,middle_name:n.middle_name,phone:intake['Телефон']||r['Телефон'],
    email:intake['Email']||client['Email']||'',vehicle_type:intake['Тип техники']||'Электротранспорт',brand:vehicle[0]||'',model:vehicle.slice(1).join(' '),
    serial_number:intake['Серийный номер']||'',issue_description:intake['Описание неисправности']||'',
    accessories:intake['Комплектность']||'',condition_notes:intake['Состояние при приёмке']||'',
    status:normStatus_(r['Статус'],'storage'),paid_amount:num_(r['Оплачено']),created_at:r['Создано'],issued_at:r['Выдано']||'',
    storage_amount:amount,storage_tariff:tariff,storage_months:months,storage_location:r['Ячейка / место'],
    starts_on:r['Дата начала'],planned_return_date:r['План возврата'],documents_uploaded_at:'',
    wash:wash,extension_months:0,extension_amount:0,handover_notes:r['Примечание'],revision:Math.max(1,num_(r.revision)||1),
    folder_url:r['Папка фото'],scooter_photo_path:'',display_photo_path:'',motor_photo_path:'',fault_photo_paths:orderFiles_(r.storage_id).filter(x=>x.slot==='photos').map(x=>x.url),signed_document_paths:orderFiles_(r.storage_id).filter(x=>x.slot==='signed').map(x=>x.url)
  };
}
function mapRepair_(r){
  const intake=find_(SHEETS.intakes,'intake_id',r.intake_id)||{};
  const client=find_(SHEETS.clients,'client_id',intake.client_id)||{};
  const n=splitName_(intake['Клиент']);
  const vehicle=String(intake['Бренд / модель']||'').trim().split(/\s+/);
  return {
    id:r.repair_id,repair_number:Number(String(r['Номер ремонта']).replace(/\D/g,''))||r['Номер ремонта'],
    last_name:n.last_name,first_name:n.first_name,middle_name:n.middle_name,phone:intake['Телефон'],email:intake['Email']||client['Email']||'',
    vehicle_type:intake['Тип техники']||'Электротранспорт',brand:vehicle[0]||'',model:vehicle.slice(1).join(' '),serial_number:intake['Серийный номер']||'',
    issue_description:intake['Описание неисправности']||'',accessories:intake['Комплектность']||'',condition_notes:intake['Состояние при приёмке']||'',
    status:normStatus_(r['Статус'],'repair'),paid_amount:num_(r['Оплачено']),created_at:r['Создано'],issued_at:r['Выдано']||'',total_amount:num_(r['Итого']),
    assigned_master:r['Мастер'],assigned_master_id:r.master_id||'',promised_date:r['Плановая дата']||intake['Плановая дата']||'',
    quality_checked:bool_(r['Контроль качества']),storage_id:r.storage_id||'',diagnostics_notes:r['Диагностика']||'',
    works:parseJson_(r['Работы'],[]),parts:parseJson_(r['Строки запчастей'],[]),discount:num_(r['Скидка']),
    warranty_days:num_(r['Гарантия, дней']),revision:Math.max(1,num_(r.revision)||1),note:r['Примечание']||'',
    approved_amount:r['Согласовано, ₽']===''||r['Согласовано, ₽']===null?null:num_(r['Согласовано, ₽']),approval_note:r['Примечание согласования']||'',
    scooter_photo_path:'',display_photo_path:'',motor_photo_path:'',fault_photo_paths:orderFiles_(r.repair_id).filter(x=>x.slot==='photos').map(x=>x.url),signed_document_paths:orderFiles_(r.repair_id).filter(x=>x.slot==='signed').map(x=>x.url)
  };
}
function paymentView_(r){ return {id:r.payment_id,amount:num_(r['Сумма']),method:({'Наличные':'cash','Карта':'card','Банковская карта':'card','Перевод':'transfer'})[r['Способ оплаты']]||r['Способ оплаты']||'cash',note:r['Комментарий']||'',created_at:r['Дата'],actor_id:r['Сотрудник']||''}; }
function eventView_(r){ let details={}; try{ details=JSON.parse(String(r['Детали']||'{}')); }catch(_){ details={note:String(r['Детали']||'')}; } return {id:r.event_id,created_at:r['Дата'],action:r['Действие']||'',actor_id:r.actor_id||'',details:details}; }
function addEvent_(kind,id,action,actor,details){ append_(SHEETS.events,{event_id:uid_(),'Дата':now_(),'Тип':kind,record_id:id,'Действие':action,actor_id:actor&&actor.id||'','Детали':JSON.stringify(details||{}),updated_at:now_()}); }
function orderFiles_(recordId){ return rows_(SHEETS.files).filter(r=>String(r.record_id||'')===String(recordId)&&r['Google Drive URL']).map(r=>({url:String(r['Google Drive URL']),slot:String(r.slot||'photos')})); }
function driveFileId_(url){ const s=String(url||''); const m=s.match(/\/d\/([^/?]+)/)||s.match(/[?&]id=([^&]+)/); return m?m[1]:''; }
function signedUrl_(p,actor){
  const kind=p.kind==='storage'?'storage':'repair', rec=kind==='storage'?find_(SHEETS.storage,'storage_id',p.id):find_(SHEETS.repairs,'repair_id',p.id); if(!rec) throw httpError_('Заказ не найден',404); requireOrderAccess_(actor,kind,rec);
  const path=String(p.path||''), id=driveFileId_(path); if(!id) throw httpError_('Файл не найден',404);
  const files=orderFiles_(rec[kind==='storage'?'storage_id':'repair_id']); if(files.some(x=>x.url===path&&x.slot==='signed')&&!isManager_(actor))throw httpError_('Нет доступа к подписанным документам',403); const allowed=files.some(x=>x.url===path); if(!allowed) throw httpError_('Нет доступа к файлу',403);
  const file=DriveApp.getFileById(id), blob=file.getBlob(), bytes=blob.getBytes(); if(bytes.length>10*1024*1024) throw httpError_('Файл слишком большой для просмотра в приложении',413);
  return {url:'data:'+(blob.getContentType()||'application/octet-stream')+';base64,'+Utilities.base64Encode(bytes)};
}
function get_(p,actor){
  const kind=p.kind==='storage'?'storage':'repair';
  const raw=kind==='storage'?find_(SHEETS.storage,'storage_id',p.id):find_(SHEETS.repairs,'repair_id',p.id);
  if(!raw) throw httpError_('Приёмка не найдена',404);
  if(role_(actor)==='mechanic'&&(kind==='storage'||String(raw.master_id||'')!==String(actor.id||''))) throw httpError_('Нет доступа к этой карточке',403);
  const record=kind==='storage'?mapStorage_(raw):mapRepair_(raw);
  const events=rows_(SHEETS.events).filter(r=>String(r.record_id)===String(record.id)).sort((a,b)=>String(b['Дата']).localeCompare(String(a['Дата']))).map(eventView_);
  const payments=rows_(SHEETS.payments).filter(r=>String(r.record_id)===String(record.id)).sort((a,b)=>String(b['Дата']).localeCompare(String(a['Дата']))).map(paymentView_);
  const linked=kind==='storage'?rows_(SHEETS.repairs).filter(r=>String(r.storage_id||'')===String(record.id)).map(mapRepair_).map(x=>({id:x.id,repair_number:x.repair_number,status:x.status,total_amount:x.total_amount,paid_amount:x.paid_amount})):[];
  return {record:record,events:events,payments:payments,legal:legal_(),linked:linked,migrated_legacy_paths:rows_(SHEETS.files).filter(x=>x.record_id===record.id&&x['Google Drive URL']).map(x=>x['Исходный путь'])};
}
function createOrder_(p,actor){
  const kind=p.kind==='storage'?'storage':'repair', requestId=String(p.request_id||'');
  if(requestId){
    const old=kind==='storage'?find_(SHEETS.storage,'request_id',requestId):find_(SHEETS.repairs,'request_id',requestId);
    if(old) return kind==='storage'?mapStorage_(old):mapRepair_(old);
  }
  const intakeSeq=nextSeq_('next_intake_seq'), intakeNo='FGI-'+pad_(intakeSeq,4), orderSeq=nextSeq_(kind==='storage'?'next_storage_seq':'next_repair_seq');
  const orderNo=(kind==='storage'?'FGST-':'FGR-')+pad_(orderSeq,4), id=uid_(), clientId=ensureClient_(p,intakeNo), client=fullName_(p);
  const root=DriveApp.getFolderById(String(setting_('intakes_folder_id'))), folder=root.createFolder(orderNo+' — '+client), folderUrl=folder.getUrl(), created=now_(); assertPrivate_(folder);
  append_(SHEETS.intakes,{intake_id:id,'Номер':intakeNo,'Создано':created,client_id:clientId,'Клиент':client,'Телефон':String(p.phone||''),'Тип услуги':kind==='storage'?'Зимнее хранение':'Ремонт','Тип техники':String(p.vehicle_type||'Электротранспорт'),'Бренд / модель':[p.brand,p.model].filter(Boolean).join(' '),'Серийный номер':String(p.serial_number||''),'Комплектность':String(p.accessories||''),'Описание неисправности':String(p.issue_description||''),'Состояние при приёмке':String(p.condition_notes||''),'Статус':'Принят','Ответственный':actor.email||actor.id||'','Предварительная стоимость':0,'Предоплата':0,'Итоговая сумма':0,'Статус оплаты':'Не оплачено','Папка фото':folderUrl,'Папка документов':folderUrl,'Плановая дата':String(p.promised_date||p.planned_return_date||''),'Закрыто':'','Примечание':'',updated_at:created,Email:String(p.email||''),request_id:requestId});
  if(kind==='storage'){
    const months=Math.max(1,Math.floor(num_(p.storage_months)||1)), tariff=String(p.storage_tariff||'monthly'), amount=(tariff==='season'?7990:months*1990)+(bool_(p.wash)?500:0);
    append_(SHEETS.storage,{storage_id:id,'Номер':orderNo,intake_id:id,client_id:clientId,'Клиент':client,'Телефон':String(p.phone||''),'Техника':[p.brand,p.model].filter(Boolean).join(' '),'Создано':created,'Дата начала':String(p.starts_on||''),'План возврата':String(p.planned_return_date||''),'Тариф':tariff,'Сумма':amount,'Оплачено':0,'Статус оплаты':'Не оплачено','Мойка +500':bool_(p.wash),'Ячейка / место':String(p.storage_location||''),'Статус':'Принят','Папка фото':folderUrl,'Папка документов':folderUrl,'Выдано':'','Примечание':'',updated_at:created,revision:1,request_id:requestId});
    addEvent_(kind,id,'create',actor,{to_status:'accepted'});
    return mapStorage_(find_(SHEETS.storage,'storage_id',id));
  }
  const masterId=String(p.assigned_master_id||''), staff=masterId?find_(SHEETS.staff,'employee_id',masterId):null;
  append_(SHEETS.repairs,{repair_id:id,'Номер ремонта':orderNo,intake_id:id,'Создано':created,'Статус':'Принят','Мастер':staff?staff['ФИО']:'','Диагностика':'','Работы':'[]','Стоимость работ':0,'Запчасти':0,'Скидка':0,'Итого':0,'Гарантия, дней':0,'Начато':'','Завершено':'','Выдано':'','Примечание':'',updated_at:created,'Строки запчастей':'[]','Оплачено':0,master_id:masterId,'Контроль качества':false,'Плановая дата':String(p.promised_date||''),storage_id:String(p.storage_id||''),revision:1,request_id:requestId,'Согласовано, ₽':'','Примечание согласования':''});
  addEvent_(kind,id,'create',actor,{to_status:'accepted'});
  return mapRepair_(find_(SHEETS.repairs,'repair_id',id));
}
function updateOrder_(p,actor){
  validateOrderUpdate_(p,actor);
  const kind=p.kind==='storage'?'storage':'repair';
  if(kind==='storage'){
    const r=find_(SHEETS.storage,'storage_id',p.id); if(!r) throw httpError_('Хранение не найдено',404);
    requireOrderAccess_(actor,kind,r); const rev=assertRevision_(r,p);
    const fromStatus=normStatus_(r['Статус'],'storage'), toStatus=String(p.status||fromStatus);
    patchRow_(SHEETS.storage,r.__row,{'Статус':humanStatus_(toStatus,'storage'),'Ячейка / место':p.storage_location===undefined?r['Ячейка / место']:p.storage_location,'План возврата':p.planned_return_date===undefined?r['План возврата']:p.planned_return_date,'Примечание':p.handover_notes===undefined?r['Примечание']:p.handover_notes,'Выдано':toStatus==='returned'?now_():r['Выдано'],updated_at:now_(),revision:rev+1});
    addEvent_(kind,p.id,'update',actor,{from_status:fromStatus,to_status:toStatus,note:String(p.reopen_reason||p.handover_notes||'')});
    return mapStorage_(find_(SHEETS.storage,'storage_id',p.id));
  }
  const r=find_(SHEETS.repairs,'repair_id',p.id); if(!r) throw httpError_('Ремонт не найден',404);
  requireOrderAccess_(actor,kind,r); const rev=assertRevision_(r,p);
  const works=Array.isArray(p.works)?p.works:parseJson_(r['Работы'],[]), parts=Array.isArray(p.parts)?p.parts:parseJson_(r['Строки запчастей'],[]), oldParts=parseJson_(r['Строки запчастей'],[]);
  const totalsById=a=>a.reduce((m,x)=>{const id=String(x.part_id||'');if(id)m[id]=(m[id]||0)+Math.max(0,Math.floor(num_(x.quantity)||1));return m;},{});
  const before=totalsById(oldParts), after=totalsById(parts), ids=[...new Set([...Object.keys(before),...Object.keys(after)])];
  ids.forEach(id=>{const delta=(after[id]||0)-(before[id]||0);if(delta>0){const pr=find_(SHEETS.products,'product_id',id);if(!pr)throw httpError_('Запчасть со склада не найдена',404);if(num_(pr['Остаток, шт.'])<delta)throw httpError_('Недостаточно на складе: '+pr['Модель / название'],409);}});
  ids.forEach(id=>{const delta=(after[id]||0)-(before[id]||0);if(delta>0)stock_({part_id:id,movement_type:'issue',quantity:delta,note:'Установлено в ремонт '+r['Номер ремонта'],reference_id:r.repair_id},actor);else if(delta<0)stock_({part_id:id,movement_type:'return',quantity:-delta,note:'Возврат из ремонта '+r['Номер ремонта'],reference_id:r.repair_id},actor);});
  const worksTotal=works.reduce((sum,x)=>sum+Math.max(1,num_(x.quantity)||1)*num_(x.price),0), partsTotal=parts.reduce((sum,x)=>sum+Math.max(1,num_(x.quantity)||1)*num_(x.price),0), total=Math.max(0,worksTotal+partsTotal-num_(p.discount));
  const masterId=p.assigned_master_id===undefined?String(r.master_id||''):String(p.assigned_master_id||''), staff=masterId?find_(SHEETS.staff,'employee_id',masterId):null, status=String(p.status||normStatus_(r['Статус'],'repair'));
  const fromStatus=normStatus_(r['Статус'],'repair'), approvalAmount=bool_(p.approve)?total:r['Согласовано, ₽'], approvalNote=bool_(p.approve)?String(p.approval_note||''):r['Примечание согласования'];
  patchRow_(SHEETS.repairs,r.__row,{'Статус':humanStatus_(status,'repair'),'Мастер':staff?staff['ФИО']:String(p.assigned_master||r['Мастер']||''),'Диагностика':p.diagnostics_notes===undefined?r['Диагностика']:String(p.diagnostics_notes||''),'Работы':JSON.stringify(works),'Стоимость работ':worksTotal,'Запчасти':partsTotal,'Скидка':num_(p.discount),'Итого':total,'Гарантия, дней':num_(p.warranty_days),'Начато':!r['Начато']&&['diagnostics','repair','waiting_parts'].includes(status)?now_():r['Начато'],'Завершено':status==='ready'?now_():r['Завершено'],'Выдано':status==='issued'?now_():r['Выдано'],'Примечание':p.note===undefined?r['Примечание']:String(p.note||''),updated_at:now_(),'Строки запчастей':JSON.stringify(parts),master_id:masterId,'Контроль качества':p.quality_checked===undefined?bool_(r['Контроль качества']):bool_(p.quality_checked),'Плановая дата':p.promised_date===undefined?r['Плановая дата']:String(p.promised_date||''),revision:rev+1,'Согласовано, ₽':approvalAmount,'Примечание согласования':approvalNote});
  addEvent_(kind,p.id,'update',actor,{from_status:fromStatus,to_status:status,note:String(p.reopen_reason||'')});
  return mapRepair_(find_(SHEETS.repairs,'repair_id',p.id));
}
function payment_(p,actor){
  requireManager_(actor);
  const kind=p.kind==='storage'?'storage':'repair', id=String(p.id||p.storage_id||p.repair_id||''), req=String(p.request_id||'');
  if(req){ const old=find_(SHEETS.payments,'request_id',req); if(old) return old; }
  const amount=num_(p.amount); if(!amount) throw httpError_('Сумма не может быть нулевой',400);
  const target=kind==='storage'?find_(SHEETS.storage,'storage_id',id):find_(SHEETS.repairs,'repair_id',id); if(!target) throw httpError_('Заказ не найден',404);
  requireOrderAccess_(actor,kind,target); assertOpen_(target,kind);
  const paidBefore=num_(target['Оплачено']), paidAfter=paidBefore+amount; if(paidAfter<0) throw httpError_('Возврат больше оплаченной суммы',409);
  if(amount<0){requireAdmin_(actor);if(!String(p.note||'').trim())throw httpError_('Укажите причину возврата',400);}
  const due=num_(target[kind==='storage'?'Сумма':'Итого']);if(amount>0&&paidAfter>due)throw httpError_('Оплата превышает долг',409);
  const row={payment_id:uid_(),'Дата':now_(),'Тип':kind,record_id:id,'Сумма':amount,'Способ оплаты':String(p.method||'cash'),'Сотрудник':actor.email||actor.id||'','Комментарий':String(p.note||''),request_id:req,updated_at:now_()}; append_(SHEETS.payments,row);
  if(kind==='storage'){ const total=num_(target['Сумма']); patchRow_(SHEETS.storage,target.__row,{'Оплачено':paidAfter,revision:num_(target.revision||1)+1,'Статус оплаты':paidAfter<=0?'Не оплачено':paidAfter>=total?'Оплачено':'Частично',updated_at:now_()}); }
  else patchRow_(SHEETS.repairs,target.__row,{'Оплачено':paidAfter,revision:num_(target.revision||1)+1,updated_at:now_()});
  addEvent_(kind,id,'payment',actor,{amount:amount,note:String(p.note||'')});
  return paymentView_(row);
}
function upload_(p,actor){
  const kind=p.kind==='storage'?'storage':'repair', rec=kind==='storage'?find_(SHEETS.storage,'storage_id',p.id):find_(SHEETS.repairs,'repair_id',p.id);
  if(!rec) throw httpError_('Заказ не найден',404); requireOrderAccess_(actor,kind,rec);
  const bytes=Utilities.base64Decode(String(p.content_base64||'')); if(bytes.length>10*1024*1024) throw httpError_('Файл больше 10 МБ',413);
  const url=kind==='storage'?rec['Папка фото']:(find_(SHEETS.intakes,'intake_id',rec.intake_id)||{})['Папка фото'];
  const match=String(url||'').match(/folders\/([^/?]+)/), folderId=match?match[1]:String(setting_('documents_folder_id'));
  const folder=DriveApp.getFolderById(folderId), mime=String(p.content_type||'application/octet-stream'), name=String(p.file_name||('file-'+Date.now()));
  assertPrivate_(folder); const file=folder.createFile(Utilities.newBlob(bytes,mime,name)); assertPrivate_(file); documents_({...p,paths:[file.getUrl()]},actor); return {path:file.getUrl()};
}
function documents_(p,actor){
  const kind=p.kind==='storage'?'storage':'repair', rec=kind==='storage'?find_(SHEETS.storage,'storage_id',p.id):find_(SHEETS.repairs,'repair_id',p.id);
  if(!rec) throw httpError_('Заказ не найден',404); requireOrderAccess_(actor,kind,rec);
  const paths=Array.isArray(p.paths)?p.paths:[], slot=String(p.slot||'photos'), row=find_(SHEETS.intakes,'intake_id',rec.intake_id);
  paths.forEach(path=>{ if(rows_(SHEETS.files).some(x=>String(x.record_id)===String(p.id)&&String(x['Google Drive URL'])===String(path))) return; const fileId=driveFileId_(path); let size=0,name=''; try{const f=DriveApp.getFileById(fileId);size=f.getSize();name=f.getName();}catch(_){} append_(SHEETS.files,{object_id:fileId||uid_(),'Исходный путь':name,'Размер, байт':size,'Создан':now_(),'Google Drive URL':String(path),'Статус миграции':'Drive','Тип':slot==='signed'?'Подписанный документ':'Фото','Связанная приёмка':kind==='storage'?rec['Номер']:rec['Номер ремонта'],'Примечание':'Загружено через FastGo',updated_at:now_(),record_id:String(p.id),slot:slot}); });
  if(row&&paths.length) patchRow_(SHEETS.intakes,row.__row,{'Папка документов':row['Папка документов']||row['Папка фото'],updated_at:now_()});
  if(paths.length) addEvent_(kind,p.id,'documents',actor,{count:paths.length,slot:slot});
  return {ok:true,paths:paths};
}
function extend_(p,actor){
  requireManager_(actor); const r=find_(SHEETS.storage,'storage_id',p.id); if(!r) throw httpError_('Хранение не найдено',404);
  assertOpen_(r,'storage'); const rev=assertRevision_(r,p), months=Math.max(1,Math.floor(num_(p.months)||1)), extra=months*1990, currentEnd=new Date(String(r['План возврата']||'')+'T12:00:00Z');
  let nextEnd=r['План возврата']; if(Number.isFinite(currentEnd.getTime())){const d=new Date(currentEnd),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));nextEnd=d.toISOString().slice(0,10);}
  patchRow_(SHEETS.storage,r.__row,{'Сумма':num_(r['Сумма'])+extra,'Статус':'На хранении','План возврата':nextEnd,'Примечание':String(r['Примечание']||'')+'; продление '+months+' мес. +'+extra+' ₽'+(p.note?' — '+String(p.note):''),updated_at:now_(),revision:rev+1});
  addEvent_('storage',p.id,'extend',actor,{amount:extra,note:String(p.note||''),months:months});
  return mapStorage_(find_(SHEETS.storage,'storage_id',p.id));
}
function contact_(p,actor){
  const kind=p.kind==='storage'?'storage':'repair', rec=kind==='storage'?find_(SHEETS.storage,'storage_id',p.id):find_(SHEETS.repairs,'repair_id',p.id);
  if(!rec) throw httpError_('Заказ не найден',404); requireOrderAccess_(actor,kind,rec); assertOpen_(rec,kind); const rev=assertRevision_(rec,p);
  const intake=find_(SHEETS.intakes,'intake_id',rec.intake_id); if(!intake) throw httpError_('Приёмка не найдена',404);
  const current=splitName_(intake['Клиент']), oldVehicle=String(intake['Бренд / модель']||'').split(' ');
  const name=[p.last_name===undefined?current.last_name:p.last_name,p.first_name===undefined?current.first_name:p.first_name,p.middle_name===undefined?current.middle_name:p.middle_name].filter(Boolean).join(' ').trim();
  const brandModel=[p.brand===undefined?(oldVehicle[0]||''):p.brand,p.model===undefined?oldVehicle.slice(1).join(' '):p.model].filter(Boolean).join(' ');
  patchRow_(SHEETS.intakes,intake.__row,{'Клиент':name,'Телефон':p.phone===undefined?intake['Телефон']:p.phone,Email:p.email===undefined?intake['Email']:p.email,'Бренд / модель':brandModel,'Серийный номер':p.serial_number===undefined?intake['Серийный номер']:p.serial_number,'Комплектность':p.accessories===undefined?intake['Комплектность']:p.accessories,'Состояние при приёмке':p.condition_notes===undefined?intake['Состояние при приёмке']:p.condition_notes,'Описание неисправности':p.issue_description===undefined?intake['Описание неисправности']:p.issue_description,updated_at:now_()});
  const client=intake.client_id?find_(SHEETS.clients,'client_id',intake.client_id):null;
  if(client) patchRow_(SHEETS.clients,client.__row,{'ФИО':name,'Телефон':p.phone===undefined?client['Телефон']:p.phone,Email:p.email===undefined?client['Email']:p.email,updated_at:now_()});
  if(kind==='storage') patchRow_(SHEETS.storage,rec.__row,{'Клиент':name,'Телефон':p.phone===undefined?rec['Телефон']:p.phone,'Техника':brandModel,updated_at:now_(),revision:rev+1});
  else patchRow_(SHEETS.repairs,rec.__row,{updated_at:now_(),revision:rev+1});
  addEvent_(kind,p.id,'contact',actor,{});
  return kind==='storage'?mapStorage_(find_(SHEETS.storage,'storage_id',p.id)):mapRepair_(find_(SHEETS.repairs,'repair_id',p.id));
}

