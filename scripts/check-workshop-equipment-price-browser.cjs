const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {serve,launchOptions}=require('./warehouse-browser-fixture.cjs');
(async()=>{const {server,base}=await serve(),browser=await chromium.launch(launchOptions);try{
 for(const width of [390,1366]){
  const context=await browser.newContext({viewport:{width,height:844}}),part={id:'equipment-fixture',name:'Kugoo Max Speed',model:'Max Speed',category:'Техника · Электросамокат',sku:'EQ-001',barcode:'FGP-00000088',quantity:1,retail_price:30000,unit_cost:18000,active:true},saved=[];
  await context.addInitScript(()=>localStorage.setItem('fastgo_workshop_session',JSON.stringify({user_id:'test',access_token:'test',expires_at:4102444800})));
  await context.route('https://**/*',async route=>{const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'};if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});if(!route.request().url().includes('/functions/v1/fastgo-workshop-api'))return route.abort();const {action,params}=route.request().postDataJSON();let data={};if(action==='request_access')data={active:true};if(action==='me')data={role:'owner',name:'Тест',profile_id:'test'};if(action==='catalog')data={parts:[part],staff:[],services:[],categories:[]};if(action==='part_save'){saved.push(params);Object.assign(part,params);data=part;}return route.fulfill({headers,json:{data}});});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/workshop.html#equipment');await page.locator('[data-equipment-edit]').click();
  await page.locator('#dialog [name=unit_cost]').fill('19500.50');await page.locator('#modal-form button[type=submit]').click();await page.getByText(/19.?500,5(?:0)? ₽/,{exact:true}).waitFor();
  assert.equal(saved.length,1);assert.equal(saved[0].unit_cost,19500.50);assert.equal(saved[0].retail_price,30000);assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await context.close();
 }
 console.log('PASS: equipment purchase cost edits persist separately from retail price on phone and laptop');
 }finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
