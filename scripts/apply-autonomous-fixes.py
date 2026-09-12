"""Narrow, idempotent source edits; never handles credentials or business data."""
from pathlib import Path
import re

def replace(path, old, new):
    p=Path(path);s=p.read_text()
    if old in s: p.write_text(s.replace(old,new))
    elif new not in s: raise RuntimeError('Source changed, refusing to overwrite '+path)

path='workshop/inventory-ui.js'
replace(path,"import {api,esc,money,csvDownload} from './core.js';","import {api,esc,money,csvDownload} from './core.js';\nimport {loadLibrary as loadScript} from './library-loader.js';")
p=Path(path);s=p.read_text()
if 'const loadScript=' in s:
    a=s.index('const loadScript=');b=s.index('\n\nasync function getCatalog',a);s=s[:a]+s[b:];p.write_text(s)
replace(path,"await loadScript(ZXING_URL,'ZXingBrowser');\n      const reader","await loadScript(ZXING_URL,'ZXingBrowser');\n      if(done)return;\n      const reader")
replace(path,"if(me&&['owner','admin'].includes(me.role)&&confirm('Такого товара ещё нет. Создать новую позицию?'))","if(e.status===404&&!String(code).startsWith('FGC-')&&me&&['owner','admin'].includes(me.role)&&confirm('Такого товара ещё нет. Создать новую позицию?'))")
replace(path,"if(!code)return null;\n  return api('part_by_barcode'","if(!code)return null;\n  if(String(code).trim().toUpperCase().startsWith('FGC-')){const e=new Error('Это штрих-код категории. Для прихода или продажи выберите конкретную модель с кодом FGP.');e.status=400;throw e;}\n  return api('part_by_barcode'")
replace('workshop/core.js',"try{return(await request('/functions/v1/fastgo-workshop-api',{action,params},session?.access_token)).data;}","try{const response=await request('/functions/v1/fastgo-workshop-api',{action,params},session?.access_token);if(!response||!Object.prototype.hasOwnProperty.call(response,'data')||response.data===null){const e=new Error('Сервер не подтвердил результат. Не создавайте новую операцию; обновите карточку для сверки.');e.status=502;throw e;}return response.data;}")
path='supabase/functions/fastgo-workshop-api/index.ts'
replace(path,"const RELEASE = 'workshop-reliability-2026-09-12';","const RELEASE = 'workshop-autonomous-2026-09-13';")
replace(path,"code>=400&&code<600?code:400);}return j?.data;","code>=400&&code<600?code:400);}\n    if(!j||Array.isArray(j)||!Object.prototype.hasOwnProperty.call(j,'data')||j.data===null)fail('Google не подтвердил результат операции. Ответ проверки доступности не является результатом записи. Сверьте карточку перед повторением.',502);\n    return j.data;")
replace(path,"release:RELEASE,authentication:'required'","release:RELEASE,authentication:'required',upstream_checked:false")
replace(path,"d.staff=staff||[];d.capabilities=(await g('health')).capabilities||{};","if(!d||!Array.isArray(d.parts)||!Array.isArray(d.services)||!Array.isArray(d.categories))fail('Google вернул неполный каталог. Повторите чтение позже.',502);d.staff=staff||[];d.capabilities=(await g('health')).capabilities||{};")
replace(path,"if(action==='extend'){p.months=","if(action==='contact'&&p.phone!==undefined&&!/^\\+7\\d{10}$/.test(String(p.phone)))fail('Введите полный телефон: +7 и 10 цифр');\n      if(action==='extend'){p.months=")
p=Path('tests/google-cutover.test.mjs');s=p.read_text()
if 'rawGoogle' not in s:
    s=s.replace('connected=true,google}={}','connected=true,google,rawGoogle}={}')
    s=s.replace("const b=JSON.parse(o.body);return Response.json({data:google?google(b)","const b=JSON.parse(o.body);if(rawGoogle)return Response.json(rawGoogle(b));return Response.json({data:google?google(b)")
    s=s.replace("retail_price:100}],services:[]}","retail_price:100}],services:[],categories:[]}")
    s+=r'''
test('doGet availability response cannot masquerade as successful data or write',async()=>{for(const action of ['catalog','stock']){const s=setup({rawGoogle:()=>({ok:true,service:'FastGo Google Sheets API'})});const r=await s.go({action,params:{part_id:pid,request_id:rid,quantity:1,movement_type:'receipt',note:'test'}});assert.equal(r.status,502);assert.ok(!(await r.text()).includes(secret));}});
test('null or missing upstream result fails closed',async()=>{for(const value of [{},{data:null}])assert.equal((await setup({rawGoogle:()=>value}).go({action:'catalog'})).status,502);});
test('malformed catalogue is rejected with 502',async()=>{assert.equal((await setup({google:()=>({parts:[],services:[]})}).go({action:'catalog'})).status,502);});
test('public health declares upstream is not checked',async()=>{assert.equal((await (await setup().go({},false,'GET')).json()).upstream_checked,false);});
test('contact phone checked at server boundary',async()=>{assert.equal((await setup().go({action:'contact',params:{id:rid,revision:1,phone:'123'}})).status,400);});
'''
    p.write_text(s)

# The following Google changes are SOURCE ONLY until the owner publishes the script.
p=Path('google-apps-script/Code.gs');s=p.read_text()
if 'function categoryEnsure_' not in s:
    start=s.index('function partSave_(p){');end=s.index('\nfunction stockHistory_',start)
    body=r'''function barcodeNext_(sheet,column,key,prefix,width){
  const values=rows_(sheet).map(r=>String(r[column]||'')), used=new Set(values);
  const maximum=values.filter(v=>v.indexOf(prefix)===0&&/^\d+$/.test(v.slice(prefix.length))).reduce((n,v)=>Math.max(n,Number(v.slice(prefix.length))),0);
  let n=Math.max(1,Math.floor(Number(setting_(key))||1),maximum+1);
  while(used.has(prefix+pad_(n,width)))n++;
  if(n>=Math.pow(10,width))throw httpError_('Закончился диапазон штрих-кодов',409);
  setSetting_(key,n+1);return prefix+pad_(n,width);
}
function categoryEnsure_(value){
  const name=String(value||'').trim().slice(0,100),norm=v=>String(v||'').trim().toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ');
  if(!name)throw httpError_('Укажите категорию',400);
  const matches=rows_(SHEETS.categories).filter(r=>norm(r['Категория (ключ)'])===norm(name)||norm(r['Понятное название'])===norm(name));
  if(matches.length>1)throw httpError_('В справочнике дубли категорий',409);
  if(matches.length){const row=matches[0];if(!row['Штрих-код категории'])patchRow_(SHEETS.categories,row.__row,{'Штрих-код категории':barcodeNext_(SHEETS.categories,'Штрих-код категории','next_category_seq','FGC-',6)});return String(row['Категория (ключ)']);}
  append_(SHEETS.categories,{'Категория (ключ)':name,'Понятное название':name,'Штрих-код категории':barcodeNext_(SHEETS.categories,'Штрих-код категории','next_category_seq','FGC-',6),'Основное фото':'','Примечание':''});return name;
}
function partSave_(p){
  const r=p.id?find_(SHEETS.products,'product_id',p.id):null,now=now_(),name=String(p.name||'').trim().slice(0,200),sku=String(p.sku===undefined?r&&r['Артикул / SKU']||'':p.sku).trim().slice(0,100);
  if(p.id&&!r)throw httpError_('Товар не найден; новая позиция не создана',404);
  if(!name)throw httpError_('Укажите название',400);
  const price=(v,old)=>{const n=Number(v===undefined?old||0:v);if(v===null||typeof v==='boolean'||!Number.isFinite(n)||n<0||n>1e9)throw httpError_('Проверьте цену товара',400);return n;};
  const cost=price(p.unit_cost,r&&r['Цена закупки, ₽']),retail=price(p.retail_price,r&&r['Цена продажи, ₽']);
  const norm=v=>String(v||'').trim().toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ');
  const category=categoryEnsure_(p.category===undefined?r&&r['Категория']:p.category),model=String(p.model===undefined?r&&r['Модель']||'':p.model).trim().slice(0,120);
  const others=rows_(SHEETS.products).filter(x=>x.product_id&&x.product_id!==p.id);
  if(sku&&others.some(x=>norm(x['Артикул / SKU'])===norm(sku)))throw httpError_('Артикул уже принадлежит другому товару',409);
  if(others.some(x=>norm(x['Категория'])===norm(category)&&norm(x['Модель'])===norm(model)&&norm(x['Модель / название'])===norm(name)))throw httpError_('Эта модель уже есть на складе. Выберите существующую позицию',409);
  const value={'Категория':category,'Модель / название':name,'Модель':model,'Артикул / SKU':sku,'Ед.':String(p.unit||r&&r['Ед.']||'шт').trim().slice(0,20),'Цена закупки, ₽':cost,'Цена продажи, ₽':retail,'Активен':p.active===undefined?(r?r['Активен']!==false:true):p.active!==false,updated_at:now};
  if(r){patchRow_(SHEETS.products,r.__row,value);return mapProduct_(find_(SHEETS.products,'product_id',p.id));}
  const id=uid_(),barcode=barcodeNext_(SHEETS.products,'Штрих-код','next_product_seq','FGP-',8);
  append_(SHEETS.products,{...value,'Штрих-код':barcode,'Приход, шт.':0,'Сумма прихода, ₽':0,'Фото / примечание':'',product_id:id,'Остаток, шт.':0,'Фото URL':''});
  return mapProduct_(find_(SHEETS.products,'product_id',id));
}'''
    p.write_text(s[:start]+body+s[end:])
replace('google-apps-script/Reliability.gs',"function workbookDigest_(book){return digest_(JSON.stringify(book.getSheets().map(s=>({name:s.getName(),values:s.getDataRange().getValues(),formulas:s.getDataRange().getFormulas()}))));}","function workbookDigest_(book){return digest_(JSON.stringify(book.getSheets().map(s=>{const range=s.getDataRange(),values=range.getValues(),formulas=range.getFormulas();return {name:s.getName(),cells:values.map((row,i)=>row.map((value,j)=>formulas[i]?.[j]?{formula:formulas[i][j]}:{value:value instanceof Date?value.toISOString():value}))};})));}")
p=Path('tests/google-reliability.test.mjs');s=p.read_text()
if 'new model and category receive unique barcodes' not in s:
    s+=r'''
test('new model and category receive unique barcodes even with stale sequences',()=>{
 const h=harness(),a=h.run('part_save',{request_id:randomUUID(),name:'Подшипник рулевой',category:'Подшипники',model:'2008 RS',retail_price:100}),b=h.run('part_save',{request_id:randomUUID(),name:'Подшипник рулевой',category:'подшипники',model:'2008 2RS',retail_price:150});
 assert.equal(a.barcode,'FGP-00000002');assert.equal(b.barcode,'FGP-00000003');assert.equal(a.category,b.category);const cat=h.rows('Категории').find(x=>x['Категория (ключ)']==='Подшипники');assert.match(cat['Штрих-код категории'],/^FGC-\d{6}$/);assert.equal(h.rows('Категории').length,2);
});
test('duplicate SKU or exact model does not create a second stock item',()=>{const h=harness(),p={request_id:randomUUID(),name:'Новое',category:'Тест',model:'X',sku:'SKU-X',retail_price:10};h.run('part_save',p);assert.throws(()=>h.run('part_save',{...p,request_id:randomUUID(),name:'Другое'}),/Артикул/);assert.throws(()=>h.run('part_save',{...p,request_id:randomUUID(),sku:''}),/модель уже/);assert.equal(h.rows('Товары').length,2);});
test('missing product edit and negative price fail without new rows',()=>{const h=harness();assert.throws(()=>h.run('part_save',{request_id:randomUUID(),id:randomUUID(),name:'X',category:'Тест'}),/не найден/);assert.throws(()=>h.run('part_save',{request_id:randomUUID(),name:'X',category:'Тест',retail_price:-1}),/цену/);assert.equal(h.rows('Товары').length,1);});
test('backup verification compares formulas rather than volatile calculated values',()=>{const h=harness(),book=(value,formula)=>({getSheets:()=>[{getName:()=> 'Test',getDataRange:()=>({getValues:()=>[[value,42]],getFormulas:()=>[[formula,'']]})}]});assert.equal(h.context.workbookDigest_(book(100,'=NOW()')),h.context.workbookDigest_(book(200,'=NOW()')));assert.notEqual(h.context.workbookDigest_(book(100,'')),h.context.workbookDigest_(book(200,'')));});
'''
    p.write_text(s)
# HTML release tag forces re-fetch of changed entry modules; dependencies are static.
p=Path('workshop.html');s=p.read_text();s=re.sub(r'\?v=[A-Za-z0-9-]+','?v=autonomous-20260913',s);p.write_text(s)
print('Applied narrow import, scanner, response validation and pending Google-source fixes')
