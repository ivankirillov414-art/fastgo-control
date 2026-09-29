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
   assert.equal(await page.locator('#delete-storage').count(),['developer','owner','receiver'].includes(role)?1:0);
   assert.equal(await page.locator('#close-storage').count(),['developer','owner','receiver'].includes(role)?1:0);
  }
  if(role==='developer'){await page.goto(origin+'/workshop.html#account');await page.getByRole('heading',{name:'Аккаунт',exact:true}).waitFor();const body=(await page.locator('body').innerText()).toLowerCase();assert.equal(body.includes('developer'),false);assert.equal(body.includes('разработчик'),false);}
  assert.deepEqual(errors,[]);await context.close();
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
 await page.getByRole('button',{name:'+ Позиция',exact:true}).click();
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

 console.log('PASS',kind,'five widths, six roles, table default, board, price groups, storage buttons');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
