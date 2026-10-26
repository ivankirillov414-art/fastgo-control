const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {serve,launchOptions,catalog}=require('./warehouse-browser-fixture.cjs');
(async()=>{const {server,base}=await serve(),browser=await chromium.launch(launchOptions);try{
 for(const role of ['owner','mechanic']){
  const context=await browser.newContext({viewport:{width:390,height:844}}),calls=[];
  await context.route('https://oqgpjfikjpcplnxueoki.supabase.co/**',async route=>{
   const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'};if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
   const p=route.request().postDataJSON()||{};calls.push(p);
   if(route.request().url().includes('/auth/v1/token'))return route.fulfill(p.password==='fixture-correct'?{headers,json:{access_token:'test',refresh_token:'test',user:{id:'fixture-user'},expires_in:3600}}:{status:400,headers,json:{error_code:'invalid_credentials',msg:'Invalid login credentials'}});
   let data={};if(p.action==='me')data={role,name:'Тест',profile_id:'fixture-user'};if(p.action==='catalog')data={parts:catalog,staff:[]};return route.fulfill({headers,json:{data}});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/warehouse.html');await page.locator('#login').waitFor();
  assert.equal(await page.locator('#usb-scanner').isVisible(),false);await page.locator('[name=email]').fill('employee@example.invalid');await page.locator('[name=password]').fill('fixture-wrong');await page.locator('#login button').click();await page.locator('#message').filter({hasText:'Неверная почта или пароль'}).waitFor();
  await page.locator('[name=password]').fill('fixture-correct');await page.locator('#login button').click();
  if(role==='owner'){await page.locator('#stock-list').waitFor();assert.equal(await page.locator('#nav-receipt').isDisabled(),true);assert.equal(await page.locator('#nav-pay').isDisabled(),true);assert.equal(await page.locator('#setup').count(),0);await page.locator('.inventory-item').first().click();assert.equal(await page.getByRole('button',{name:'Изменить закупочную цену',exact:true}).count(),1);}
  else await page.locator('#message').filter({hasText:'Этот раздел недоступен вашей роли'}).waitFor();
  assert(!calls.some(p=>['register','connect_terminal','receipt','checkout'].includes(p.action)));assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS: phone warehouse login explains invalid credentials; valid owner reaches catalog and purchase prices without registering another cash laptop; mechanic remains denied');
 }finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
