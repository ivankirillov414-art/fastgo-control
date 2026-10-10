const {createServer}=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium,firefox,webkit}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=createServer((req,res)=>{
 const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');
 fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const kind=process.argv[2]||'chromium',browser=await ({chromium,firefox,webkit})[kind].launch();
 fs.mkdirSync('browser-results',{recursive:true});
 try{
 for(const role of ['developer','owner','receiver','admin','manager','mechanic']){
  const context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(()=>localStorage.setItem('fastgo_workshop_session',JSON.stringify({access_token:'fixture-only',user_id:'fixture',expires_at:4102444800})));
  const me={role,name:'Тестовый сотрудник',profile_id:'fixture',active:true,backend:'POSTGRES_GOOGLE_MIRROR'};
  const record={id:'test',repair_number:1,storage_number:1,status:'stored',revision:1,brand:'Тестовая техника',model:'Модель',last_name:'Тест',first_name:'Клиент',phone:'+70000000000',created_at:'2026-09-21',storage_amount:0,paid_amount:0,total_amount:0,fault_photo_paths:[],signed_document_paths:[],works:[],parts:[]};
  await page.route('**/*',async route=>{
   const req=route.request();if(req.url().startsWith(origin))return route.continue();
   if(req.url().includes('/functions/v1/fastgo-workshop-api')){
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'}});
    const {action}=req.postDataJSON();
    const data=({me,request_access:{active:true},catalog:{services:[{id:'s1',title:'Электрическая диагностика',labor_price:2000},{id:'s2',title:'Монтаж ручки',labor_price:400}],staff:[],parts:[],categories:[]},list:{count:1,items:[record]},get:{record,events:[],payments:[],linked:[],legal:{}},overview:{repairs:1,ready:0,overdue:0,storage:1,storage_due:0,debt:0,today_payments:0},legal:{legal_name:'Тест'},health:{capabilities:{}}})[action]||{};
    return route.fulfill({json:{data},headers:{'Access-Control-Allow-Origin':'*'}});
   }
   return route.abort();
  });
  for(const [width,height] of [[360,800],[768,1024],[1024,768],[1366,768],[1920,1080]]){
   await page.setViewportSize({width,height});await page.goto(origin+'/workshop.html#repairs');
   await page.locator('.records').waitFor();
   assert.equal(await page.locator('.topbar,#refresh-data').count(),0);
   assert.equal(await page.locator('.nav a[href="#settings"]').count(),['developer','owner'].includes(role)?1:0);
   const sizes=await page.evaluate(()=>({page:document.documentElement.scrollWidth,width:innerWidth,side:document.querySelector('.sidebar').scrollWidth,sideWidth:document.querySelector('.sidebar').clientWidth}));
   assert.ok(sizes.page<=sizes.width+1,JSON.stringify({kind,role,width,sizes}));
   if(width>760)assert.ok(sizes.side<=sizes.sideWidth+1,JSON.stringify(sizes));
   await page.locator('.view-switch a').filter({hasText:'Доска'}).click();await page.locator('.order-board').waitFor();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if(role==='owner')await page.screenshot({path:`browser-results/${kind}-${width}.png`,fullPage:true});
  }
  await page.goto(origin+'/workshop.html#catalog');await page.getByRole('heading',{name:'Электрические работы',exact:true}).waitFor();
  if(role!=='mechanic'){
   await page.goto(origin+'/workshop.html#order?kind=storage&id=test');await page.locator('#order-form').waitFor();
   assert.equal(await page.locator('#delete-storage').count(),['developer','owner','receiver','manager','mechanic'].includes(role)?1:0);
   assert.equal(await page.locator('#close-storage').count(),['developer','owner','receiver','manager','mechanic'].includes(role)?1:0);
   // Printing reuses the current authenticated app instead of launching a new one.
   const printLink=page.getByRole('link',{name:'Лист мастера + QR',exact:true});
   assert.equal(await printLink.getAttribute('target'),null);
   await printLink.click();await page.locator('.print-page #document-qr img').waitFor();
   assert.equal(context.pages().length,1);
   assert.equal(await page.locator('#login').count(),0);
   assert.equal(await page.getByRole('button',{name:'Печать',exact:true}).count(),1);
   await page.getByRole('link',{name:'К карточке',exact:true}).click();await page.locator('#order-form').waitFor();

  }
  if(role==='developer'){await page.goto(origin+'/workshop.html#account');await page.getByRole('heading',{name:'Аккаунт',exact:true}).waitFor();const body=(await page.locator('body').innerText()).toLowerCase();assert.equal(body.includes('developer'),false);assert.equal(body.includes('разработчик'),false);}
  assert.deepEqual(errors,[]);await context.close();
 }

 await require('./check-repair-scanner.cjs')({browser,origin,kind});

 // Phone uploads, compression, partial retry and cross-device gallery refresh.
 {
 const context=await browser.newContext(),page=await context.newPage(),errors=[];let paths=[],uploads=[],failSecond=true;
 page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>localStorage.setItem('fastgo_workshop_session',JSON.stringify({access_token:'fixture-only',user_id:'photo-fixture',expires_at:4102444800})));
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGO4o6EBAAMQAS0ujiXaAAAAAElFTkSuQmCC';
 const record=()=>({id:'photo-order',repair_number:9,status:'accepted',revision:1,brand:'Тест',model:'Тест',last_name:'Тест',first_name:'Клиент',phone:'+79991234567',created_at:'2026-10-10',works:[],parts:[],total_amount:0,paid_amount:0,fault_photo_paths:[...paths],signed_document_paths:[]});
 await page.route('**/*',async route=>{
  const req=route.request();if(req.url().startsWith(origin)||req.url().startsWith('blob:'))return route.continue();if(!req.url().includes('/functions/v1/fastgo-workshop-api'))return route.abort();
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'};if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  const {action,params:p}=req.postDataJSON();let data={};
  if(action==='me')data={role:'mechanic',name:'Мастер',profile_id:'photo-fixture',active:true,status_permissions:{}};
  if(action==='request_access')data={active:true};if(action==='catalog')data={services:[],staff:[],parts:[],categories:[]};
  if(action==='get')data={record:record(),events:[],payments:[],linked:[]};if(action==='signed_url')data={url:image};
  if(action==='upload'){
   uploads.push(p);if(uploads.length===2&&failSecond){failSecond=false;return route.fulfill({status:503,json:{error:'Тестовый обрыв соединения'},headers});}
   const path='native:photo-'+p.request_id;if(!paths.includes(path))paths.push(path);data={path};
  }
  return route.fulfill({json:{data},headers});
 });
 await page.setViewportSize({width:390,height:844});await page.goto(origin+'/workshop.html#order?kind=repair&id=photo-order');await page.locator('#photo-grid').filter({hasText:'не добавлены'}).waitFor();
 await page.locator('#phone-photos').click();await page.locator('#phone-photo-link img').waitFor();assert.ok((await page.locator('#phone-photo-link a').getAttribute('href')).includes('id=photo-order'));
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=2400;c.height=1800;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,2400,1800);g.addColorStop(0,'red');g.addColorStop(1,'blue');x.fillStyle=g;x.fillRect(0,0,2400,1800);return c.toDataURL('image/png').split(',')[1];});
 const file={name:'phone.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')};
 await page.locator('#f-diagnostics_notes').fill('Несохранённый комментарий');
 await page.locator('#photos').setInputFiles([file,{...file,name:'second.png'}]);await page.locator('#photos-progress').filter({hasText:'Повторить'}).waitFor();
 assert.equal(uploads.length,2,await page.locator('#photos-progress').innerText());assert.equal(uploads[0].content_type,'image/jpeg');
 const dimensions=await page.evaluate(async s=>{const i=new Image();await new Promise((r,j)=>{i.onload=r;i.onerror=j;i.src='data:image/jpeg;base64,'+s;});return [i.naturalWidth,i.naturalHeight];},uploads[0].content_base64);assert.deepEqual(dimensions,[1600,1200]);
 await page.locator('#upload-photos').click();await page.locator('#photos-progress').filter({hasText:'Файлы сохранены'}).waitFor();await page.waitForFunction(()=>document.querySelectorAll('#photo-grid img').length===2);
 assert.equal(uploads.length,3);assert.equal(uploads[1].request_id,uploads[2].request_id);assert.equal(await page.locator('#f-diagnostics_notes').inputValue(),'Несохранённый комментарий');
 paths.push('native:added-from-another-phone');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForFunction(()=>document.querySelectorAll('#photo-grid img').length===3);
 assert.equal(await page.locator('#f-diagnostics_notes').inputValue(),'Несохранённый комментарий');
 await page.locator('#photo-camera').setInputFiles({...file,name:'camera.png'});await page.waitForFunction(()=>document.querySelectorAll('#photo-grid img').length===4);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 await context.close();console.log(kind+': phone photos, compression, retry and cross-device refresh passed');
 }

 // Intake fixture: validation, minimal repair, retries and storage, no live writes.
 {
 const context=await browser.newContext(),page=await context.newPage(),errors=[];let creates=[],failNext=false,record;
 page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>localStorage.setItem('fastgo_workshop_session',JSON.stringify({access_token:'fixture-only',user_id:'intake-fixture',expires_at:4102444800})));
 await page.route('**/*',async route=>{
  const req=route.request();if(req.url().startsWith(origin))return route.continue();
  if(!req.url().includes('/functions/v1/fastgo-workshop-api'))return route.abort();
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  const {action,params:p}=req.postDataJSON();let data={};
  if(action==='me')data={role:'mechanic',name:'Мастер',profile_id:'intake-fixture',active:true,status_permissions:{}};
  if(action==='request_access')data={active:true};
  if(action==='catalog')data={services:[],staff:[],parts:[],categories:[]};
  if(action==='create'){
   creates.push(p);if(failNext){failNext=false;return route.fulfill({status:503,json:{error:'Временно не удалось сохранить'},headers});}
   record={...p,id:'intake-'+creates.length,repair_number:7,storage_number:8,status:p.kind==='storage'?'stored':'accepted',revision:1,created_at:'2026-10-10',works:[],parts:[],total_amount:0,paid_amount:0,storage_amount:1990,fault_photo_paths:[],signed_document_paths:[]};data=record;
  }
  if(action==='get')data={record,events:[],payments:[],linked:[]};
  return route.fulfill({json:{data},headers});
 });
 for(const width of [360,1366]){
  await page.setViewportSize({width,height:900});await page.goto(origin+'/workshop.html#new?kind=repair');await page.locator('#intake-form').waitFor();
  assert.equal(await page.locator('#intake-form input[required]').count(),5);
  assert.equal(await page.locator('#f-promised_date').isVisible(),false);
  const before=creates.length;await page.locator('#intake-save').click();await page.locator('#intake-error').filter({hasText:'Телефон'}).waitFor();assert.equal(creates.length,before);
  for(const [name,value] of Object.entries({phone:'89991234567',last_name:'Иванов',first_name:'Иван',brand:'Ninebot',model:'G30'}))await page.locator('#f-'+name).fill(value);
  failNext=true;await page.locator('#intake-save').click();await page.locator('#intake-error').filter({hasText:'Временно'}).waitFor();assert.equal(await page.locator('#intake-save').isEnabled(),true);
  await page.evaluate(()=>document.querySelector('#intake-form').requestSubmit());await page.locator('#order-form').waitFor();
  assert.equal(creates.length,before+2);assert.equal(creates[before].request_id,creates[before+1].request_id);assert.equal(creates[before+1].phone,'+79991234567');assert.equal(creates[before+1].promised_date,'');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.goto(origin+'/workshop.html#new?kind=storage');await page.locator('#intake-form').waitFor();
  for(const [name,value] of Object.entries({phone:'89991234567',last_name:'Иванов',first_name:'Иван',brand:'Ninebot',model:'G30'}))await page.locator('#f-'+name).fill(value);
  await page.locator('#f-storage_tariff').selectOption('season');assert.equal(await page.locator('#f-storage_months').isVisible(),false);
  await page.locator('#intake-save').click();await page.locator('#order-form').waitFor();assert.equal(creates.at(-1).storage_tariff,'season');assert.ok(creates.at(-1).planned_return_date>=creates.at(-1).starts_on);
 }
 assert.deepEqual(errors,[]);await context.close();console.log(kind+': simplified intake, validation and retry passed');
 }

 // Isolated fixture: never writes live business data.
 {
 const context=await browser.newContext(),page=await context.newPage(),errors=[];let attempts=0,requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>localStorage.setItem('fastgo_workshop_session',JSON.stringify({access_token:'fixture-only',user_id:'seller-fixture',expires_at:4102444800})));
 await page.route('**/*',async route=>{
  const req=route.request();if(req.url().startsWith(origin))return route.continue();
  if(!req.url().includes('/functions/v1/fastgo-workshop-api'))return route.abort();
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  const {action,params}=req.postDataJSON();let data={};
  if(action==='request_access')data={active:true};
  if(action==='me')data={role:'seller',name:'Продажник',profile_id:'seller-fixture',active:true};
  if(action==='catalog')data={services:[],staff:[],parts:[{id:'part-1',name:'Руль',barcode:'FGP-00000001',quantity:0,retail_price:100,active:true}],categories:[]};
  if(action==='stock_receipts')data=[];
  if(action==='stock_receive'){
   requests.push(params);attempts++;
   if(attempts===1)return route.fulfill({status:503,headers,json:{error:'Тест потери ответа'}});
   data={id:'receipt-1',note:params.note,created_at:'2026-09-29T12:00:00Z',items:params.items.map((x,i)=>({id:x.part_id||'new-1',name:x.name||'Руль',barcode:'FGP-0000000'+(i+1),quantity:x.quantity,balance:x.quantity}))};
  }
  return route.fulfill({json:{data},headers});
 });
 await page.setViewportSize({width:360,height:800});
 await page.goto(origin+'/workshop.html#stock');await page.getByRole('link',{name:'+ Приход списком'}).click();
 await page.getByLabel('Поставщик / накладная').fill('Поставка 15');
 await page.locator('[data-field="quantity"]').fill('15');
 await page.locator('#receipt-add').click();
 const row=page.locator('#receipt-lines section').nth(1);
 await row.locator('select').selectOption('');
 await row.getByLabel('Название',{exact:true}).fill('Камера');
 await row.getByLabel('Категория',{exact:true}).fill('Колёса');
 await row.getByLabel('Количество',{exact:true}).fill('2');
 await page.getByRole('button',{name:'Сохранить весь приход'}).click();
 await page.getByText('Тест потери ответа',{exact:true}).waitFor();
 assert.equal(await page.locator('[data-field="quantity"]').first().isDisabled(),true);
 await page.reload();
 await page.getByRole('button',{name:'Проверить и повторить сохранение'}).click();
 await page.getByRole('heading',{name:'Приход сохранён'}).waitFor();
 assert.equal(attempts,2);assert.deepEqual(requests[0],requests[1]);assert.equal(requests[1].items[0].quantity,15);assert.equal(requests[1].items[1].name,'Камера');
 assert.equal(await page.getByRole('button',{name:'Этикетка',exact:true}).count(),2);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(errors,[]);await page.screenshot({path:`browser-results/${kind}-receipt.png`,fullPage:true});await context.close();
 }


 // Recovery fixture: no real mail, accounts, codes or password changes.
 {
 const context=await browser.newContext({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'}),page=await context.newPage(),errors=[];
 let verified=0,updated=0,logout=0,loggedIn=0,trust=false;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const req=route.request();if(req.url().startsWith(origin))return route.continue();
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,PUT,OPTIONS'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  const p=req.postDataJSON();
  if(req.url().includes('/auth/v1/recover')){assert.equal(p.email,'recovery@example.invalid');assert.equal(new URL(req.url()).searchParams.get('redirect_to'),origin+'/workshop.html');return route.fulfill({json:{},headers});}
  if(req.url().includes('/auth/v1/verify')){
   assert.equal(p.type,'recovery');assert.equal(p.email,'recovery@example.invalid');
   if(p.token==='00000000')return route.fulfill({status:403,json:{error_code:'otp_expired',msg:'expired'},headers});
   verified++;return route.fulfill({json:{access_token:'recovery-fixture',refresh_token:'unused'},headers});
  }
  if(req.url().endsWith('/auth/v1/user')){assert.equal(req.method(),'PUT');assert.equal(req.headers().authorization,'Bearer recovery-fixture');assert.equal(p.password,'Fixture-password-42');updated++;return route.fulfill({json:{id:'fixture'},headers});}
  if(req.url().includes('/auth/v1/logout')){logout++;return route.fulfill({status:204,headers});}
  if(req.url().includes('/auth/v1/token')){loggedIn++;return route.fulfill({json:{access_token:'normal-fixture',refresh_token:'normal-refresh',expires_in:3600,user:{id:'fixture'}},headers});}
  if(req.url().includes('/functions/v1/fastgo-workshop-api')){
   let data={};const {action}=p;
   if(action==='me')data={role:'owner',email:'recovery@example.invalid',profile_id:'fixture',name:'Тест',active:true};
   if(action==='owner_device_status')data={trusted:trust};
   if(action==='request_access')data={active:true};
   if(action==='catalog')data={parts:[],services:[],staff:[],categories:[]};
   if(action==='overview')data={repairs:0,storage:0,ready:0,overdue:0,storage_due:0,debt:0,today_payments:0};
   if(action==='list')data={count:0,items:[]};
   return route.fulfill({json:{data},headers});
  }
  return route.abort();
 });
 await page.goto(origin+'/workshop.html');
 await page.getByRole('button',{name:'Забыли пароль?'}).click();
 await page.getByLabel('Электронная почта',{exact:false}).fill('recovery@example.invalid');
 await page.getByRole('button',{name:'Отправить письмо',exact:true}).click();
 await page.getByLabel('Код из письма').fill('00000000');
 await page.getByRole('button',{name:'Подтвердить код'}).click();
 await page.getByText('Код неверный или срок его действия истёк.',{exact:false}).waitFor();
 assert.equal(updated,0);
 await page.getByLabel('Код из письма').fill('12345678');
 await page.getByRole('button',{name:'Подтвердить код'}).click();
 await page.getByText('Этот iPhone не является доверенным устройством владельца.',{exact:true}).waitFor();
 assert.equal(updated,0);
 trust=true;
 await page.getByRole('button',{name:'Забыли пароль?'}).click();
 await page.getByLabel('Электронная почта',{exact:false}).fill('recovery@example.invalid');
 await page.getByRole('button',{name:'Отправить письмо',exact:true}).click();
 await page.getByLabel('Код из письма').fill('12345678');
 await page.getByRole('button',{name:'Подтвердить код'}).click();
 await page.getByRole('heading',{name:'Новый пароль',exact:true}).waitFor();
 assert.equal(await page.locator('#f-new_password').getAttribute('autocomplete'),'new-password');
 assert.equal(await page.evaluate(()=>localStorage.getItem('fastgo_workshop_session')),null);
 await page.locator('#f-new_password').fill('Fixture-password-42');
 await page.locator('#f-confirm_password').fill('Fixture-password-43');
 await page.getByRole('button',{name:'Сохранить новый пароль'}).click();
 await page.getByText('Пароли не совпадают',{exact:true}).waitFor();assert.equal(updated,0);
 await page.locator('#f-confirm_password').fill('Fixture-password-42');
 await page.getByRole('button',{name:'Сохранить новый пароль'}).click();
 await page.getByRole('heading',{name:'Вход для сотрудников',exact:true}).waitFor();
 assert.equal(verified,2);assert.equal(updated,1);assert.equal(logout,1);assert.equal(loggedIn,0);
 assert.equal(await page.locator('#f-email').inputValue(),'recovery@example.invalid');
 assert.equal(await page.locator('#f-email').getAttribute('autocomplete'),'username');
 assert.equal(await page.locator('#password').getAttribute('autocomplete'),'current-password');
 assert.equal(await page.locator('#password').inputValue(),'');
 assert.equal(await page.evaluate(()=>JSON.stringify(localStorage).includes('Fixture-password')),false);
 await page.locator('#password').fill('Fixture-password-42');await page.getByRole('button',{name:'Войти',exact:true}).click();
 await page.getByRole('heading',{name:'Заявки и хранение'}).waitFor();assert.equal(loggedIn,1);
 assert.deepEqual(errors,[]);await context.close();
 }

 // Receipt fixture: mixed new/existing products and card editing, without live stock writes.
 {
 const context=await browser.newContext(),page=await context.newPage(),errors=[];
 let product={id:'part-1',name:'Амортизатор',category:'Подвеска',model:'М2',sku:'A-1',barcode:'FGP-00000001',quantity:10,unit_cost:200,retail_price:400},saved=null,received=null;
 page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>localStorage.setItem('fastgo_workshop_session',JSON.stringify({access_token:'fixture-only',user_id:'receipt-fixture',expires_at:4102444800})));
 await page.route('**/*',async route=>{
  const req=route.request();if(req.url().startsWith(origin))return route.continue();
  if(!req.url().includes('/functions/v1/fastgo-workshop-api'))return route.abort();
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  const {action,params:p}=req.postDataJSON();let data={};
  if(action==='me')data={role:'owner',name:'Тест',profile_id:'receipt-fixture',active:true,backend:'POSTGRES_GOOGLE_MIRROR'};
  if(action==='request_access')data={active:true};
  if(action==='catalog')data={parts:[product],services:[],staff:[],categories:['Подвеска']};
  if(action==='stock_receipts')data=[];
  if(action==='part_save'){saved=p;product={...product,...p};data=product;}
  if(action==='stock_receive'){received=p;data={id:'receipt-fixture',created_at:'2026-10-10',note:p.note,items:p.items.map((x,i)=>({...product,...x,id:x.part_id||'new-'+i,name:x.part_id?product.name:x.name,balance:12}))};}
  return route.fulfill({json:{data},headers});
 });
 await page.goto(origin+'/workshop.html#stock-receive');await page.locator('#receipt-add-new').waitFor();
 await page.locator('#receipt-form [name=note]').fill('Накладная 42');
 await page.locator('#receipt-lines [data-field=quantity]').fill('2');
 await page.locator('#receipt-add-new').click();
 const newRow=page.locator('#receipt-lines > section').nth(1);
 await newRow.locator('[data-field=name]').fill('Новая покрышка');await newRow.locator('[data-field=category]').fill('Покрышки');
 await newRow.locator('[data-field=retail_price]').fill('900');await newRow.locator('[data-field=quantity]').fill('3');
 await page.locator('[data-edit-product]').click();
 await page.locator('#modal-form [name=name]').fill('Амортизатор М2');await page.locator('#modal-form [name=unit_cost]').fill('250');
 await page.locator('#modal-form [type=submit]').click();await page.locator('#dialog').waitFor({state:'hidden'});
 assert.equal(saved.id,'part-1');assert.equal(saved.unit_cost,250);assert.equal(product.barcode,'FGP-00000001');assert.equal(product.quantity,10);
 assert.equal(await page.locator('#receipt-lines > section').count(),2);
 assert.equal(await newRow.locator('[data-field=name]').inputValue(),'Новая покрышка');
 assert.equal(await page.locator('#receipt-lines [data-field=quantity]').first().inputValue(),'2');
 await page.locator('#receipt-form [type=submit]').click();await page.getByRole('heading',{name:'Приход сохранён',exact:true}).waitFor();
 assert.equal(received.items.length,2);assert.equal(received.items[0].part_id,'part-1');assert.equal(received.items[0].quantity,2);
 assert.equal(received.items[1].part_id,'');assert.equal(received.items[1].name,'Новая покрышка');assert.equal(received.items[1].quantity,3);
 assert.equal(await page.evaluate(()=>localStorage.getItem('fastgo_receipt_v1:receipt-fixture')),null);
 assert.deepEqual(errors,[]);await context.close();
 }

 // Mobile sale fixture: fake camera and API; no live orders or camera access.
 {
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>{
  localStorage.setItem('fastgo_workshop_session',JSON.stringify({access_token:'sale-fixture',user_id:'sale-fixture',expires_at:4102444800}));
  window.cameraStarts=0;window.cameraStops=0;
  window.ZXingBrowser={BrowserMultiFormatReader:class{async decodeFromConstraints(constraints,video,cb){window.cameraStarts++;window.saleDecode=cb;return {stop:()=>window.cameraStops++};}}};
 });
 const product={id:'sale-part',name:'Амортизатор рулевой длинное название модели',barcode:'FGP-00000001',quantity:10,retail_price:800,active:true};
 const shift={id:'sale-shift',number:1,register:'Основная касса',status:'open',opened_at:'2026-10-10'};
 await page.route('**/*',async route=>{
  const req=route.request();if(req.url().startsWith(origin))return route.continue();
  if(!req.url().includes('/functions/v1/fastgo-workshop-api'))return route.abort();
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  const {action}=req.postDataJSON();
  const data=({request_access:{active:true},me:{role:'owner',name:'Тест',profile_id:'sale-fixture',active:true},catalog:{parts:[product],categories:[],services:[],staff:[]},cash_state:{selected:shift,shifts:[shift],sales:[],offset:0,totals:{count:0,total:0,cash:0,card:0,transfer:0,cashless:0,expected_cash:0}},part_by_barcode:product})[action]||{};
  return route.fulfill({json:{data},headers});
 });
 for(const width of [360,390,430]){
  await page.setViewportSize({width,height:844});await page.goto(origin+'/workshop.html?mobile-sale-fixture='+width+'#cash');
  await page.locator('#cash-sale').click();await page.locator('#sale-camera-panel').waitFor({state:'visible'});
  await page.waitForFunction(()=>window.cameraStarts>window.cameraStops);
  await page.locator('#sale-search-toggle').click();await page.locator('#sale-camera-panel').waitFor({state:'hidden'});
  await page.locator('#sale-search').fill('Амортизатор');await page.locator('[data-pick]').waitFor();
  assert.equal(await page.locator('#sale-results').evaluate(el=>getComputedStyle(el).position),'static');
  await page.locator('#sale-search-toggle').click();await page.locator('#sale-search-panel').waitFor({state:'hidden'});
  await page.locator('#sale-search-toggle').click();await page.locator('[data-pick]').click();
  await page.locator('.cart-row').waitFor();await page.locator('#sale-search-panel').waitFor({state:'hidden'});
  await page.locator('#sale-scan-toggle').click();await page.locator('#sale-camera-panel').waitFor({state:'visible'});
  await page.evaluate(()=>window.saleDecode({getText:()=> 'FGP-00000001'}));
  await page.locator('#sale-camera-panel').waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.querySelector('.cart-qty strong').textContent==='2');
  for(const size of [{width,height:844},{width:844,height:390},{width,height:844}]){
   await page.setViewportSize(size);
   const fit=await page.locator('#inventory-dialog').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,height:el.clientHeight,bottom:el.querySelector('.inv-foot').getBoundingClientRect().bottom,view:innerHeight}));
   assert.ok(fit.scroll<=fit.width+1,JSON.stringify(fit));assert.ok(fit.bottom<=fit.view+1,JSON.stringify(fit));if(size.width<=700)assert.ok(fit.height>=fit.view-1,JSON.stringify(fit));
  }
  await page.screenshot({path:`browser-results/${kind}-sale-${width}.png`});
  await page.locator('#inventory-dialog .inv-head [data-inv-close]').click();
  assert.equal(await page.evaluate(()=>window.cameraStarts===window.cameraStops),true);
  await page.evaluate(()=>localStorage.removeItem('fastgo_sale_draft_v1:sale-fixture'));
 }
 assert.deepEqual(errors,[]);await context.close();
 }

 // Signup email confirmation fixture: no real messages or accounts.
 {
 const context=await browser.newContext(),page=await context.newPage(),errors=[];let requests=0,verified=0,signupURL='';
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const req=route.request();if(req.url().startsWith(origin))return route.continue();
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  if(req.url().includes('/auth/v1/signup')){signupURL=req.url();return route.fulfill({json:{id:'confirmation-fixture',identities:[{id:'fixture'}]},headers});}
  if(req.url().endsWith('/auth/v1/user')){assert.equal(req.method(),'GET');assert.equal(req.headers().authorization,'Bearer signup-fixture');verified++;return route.fulfill({json:{id:'confirmation-fixture',email:'fixture@example.invalid',email_confirmed_at:'2026-10-10',is_anonymous:false},headers});}
  if(req.url().includes('/functions/v1/fastgo-workshop-api')){const {action}=req.postDataJSON();if(action==='request_access'){assert.equal(verified,1);requests++;return route.fulfill({json:{data:{active:false,state:'pending'}},headers});}return route.fulfill({status:403,json:{error:'Нет доступа'},headers});}
  return route.abort();
 });
 await page.goto(origin+'/workshop.html');await page.getByRole('button',{name:'Создать аккаунт',exact:true}).click();
 await page.locator('#f-name').fill('Тестовый мастер');await page.locator('#f-email').fill('fixture@example.invalid');
 await page.locator('#password').fill('Fixture-password-42');await page.locator('#f-confirm').fill('Fixture-password-42');
 await page.getByRole('button',{name:'Зарегистрироваться',exact:true}).click();
 await page.getByText('Письмо для подтверждения почты отправлено.',{exact:false}).waitFor();assert.equal(requests,0);
 assert.equal(new URL(signupURL).searchParams.get('redirect_to'),origin+'/workshop.html');
 assert.equal(await page.evaluate(()=>localStorage.getItem('fastgo_workshop_session')),null);
 await page.goto(origin+'/workshop.html#access_token=signup-fixture&refresh_token=refresh-fixture&type=signup&expires_in=3600');
 await page.getByRole('heading',{name:'Заявка отправлена',exact:true}).waitFor();assert.equal(verified,1);assert.equal(requests,1);
 assert.equal(await page.evaluate(()=>location.hash),'#home');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('fastgo_workshop_session')).user_id),'confirmation-fixture');
 await page.evaluate(()=>localStorage.removeItem('fastgo_workshop_session'));
 await page.goto(origin+'/workshop.html#error=access_denied&error_code=otp_expired');
 await page.getByText('Ссылка из письма недействительна или истекла.',{exact:false}).waitFor();
 assert.equal(await page.evaluate(()=>location.hash),'#home');assert.equal(verified,1);assert.equal(requests,1);
 assert.deepEqual(errors,[]);await context.close();
 }

 console.log('PASS',kind,'five widths, six roles, table default, board, price groups, storage buttons');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
