const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {serve,launchOptions,actor,catalog}=require('./warehouse-browser-fixture.cjs');
(async()=>{const{server,base}=await serve(),browser=await chromium.launch(launchOptions);try{
 for(const role of ['owner','developer','admin','seller','mechanic']){
  const context=await browser.newContext({viewport:{width:390,height:844}}),parts=structuredClone(catalog),calls=[],edits=new Map();let lose=true;
  await context.addInitScript(({actor})=>localStorage.setItem('fastgo_workshop_session',JSON.stringify({user_id:actor,access_token:'test',expires_at:4102444800})),{actor});
  await context.route('https://oqgpjfikjpcplnxueoki.supabase.co/**',async route=>{
   const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
   const p=route.request().postDataJSON()||{};calls.push(p);let data={enabled:false,jobs:[]};
   if(p.action==='request_access')data={active:true};
   else if(p.action==='me')data={profile_id:actor,role,name:'Тест',can_sell:role==='owner'};
   else if(p.action==='catalog')data={parts,staff:[],services:[],works:[]};
   else if(p.action==='inventory_edit'){
    assert.ok(['owner','developer','admin'].includes(role));const v=p.params;
    if(!edits.has(v.request_id)){const part=parts.find(x=>x.id===v.part_id);assert.equal(part[v.field],v.expected);part[v.field]=v.value;edits.set(v.request_id,structuredClone(part));}
    data=edits.get(v.request_id);if(v.field==='retail_price'&&lose){lose=false;return route.fulfill({status:503,headers,json:{error:'Ответ потерян'}});}
   }
   await route.fulfill({json:{data},headers});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/workshop.html#stock');
  if(role==='mechanic'){await page.getByText('Этот раздел недоступен вашей роли',{exact:true}).waitFor();assert(!calls.some(p=>p.action==='inventory_edit'));}
  else{
   await page.waitForURL('**/warehouse.html?unified=1&section=inventory');await page.getByText(parts[0].name,{exact:true}).waitFor();
   assert.equal(await page.locator('#nav-receipt').isDisabled(),true);assert.equal(await page.locator('#nav-pay').isDisabled(),true);assert.equal(await page.locator('#setup,#login').count(),0);
   await page.locator('.inventory-item').first().click();const dialog=page.locator('.product-dialog');await dialog.waitFor();
   assert.equal(await dialog.locator('[data-edit]').count(),role==='seller'?0:3);
   if(role!=='seller'){
    await dialog.getByRole('button',{name:'Изменить остаток',exact:true}).click();await dialog.getByRole('spinbutton',{name:'Новый остаток'}).fill('7');await dialog.getByRole('button',{name:'Сохранить',exact:true}).click();await dialog.locator('[data-metric=quantity]>strong').filter({hasText:'7 шт.'}).waitFor();
    const labels=page.getByRole('dialog',{name:'Напечатать этикетки?',exact:true});await labels.waitFor();assert.equal(await labels.locator('[name=quantity]').inputValue(),'7');await labels.getByRole('button',{name:'Не печатать',exact:true}).click();assert(!calls.some(p=>p.action==='label_enqueue'),'dismissing the offer does not print');
    await dialog.getByRole('button',{name:'Изменить цену',exact:true}).click();await dialog.getByRole('spinbutton',{name:'Новая цена'}).fill('1500.50');await dialog.getByRole('button',{name:'Сохранить',exact:true}).click();await dialog.locator('.product-error').filter({hasText:'Ответ потерян'}).waitFor();
    await dialog.getByRole('button',{name:'Сохранить',exact:true}).click();await dialog.locator('[data-metric=retail_price]>strong').filter({hasText:/1.?500,50/}).waitFor();
    const retries=calls.filter(p=>p.action==='inventory_edit'&&p.params.field==='retail_price');assert.equal(retries[0].params.request_id,retries[1].params.request_id);assert.equal(edits.size,2);
    await dialog.getByRole('button',{name:'Изменить закупочную цену',exact:true}).click();await dialog.getByRole('spinbutton',{name:'Новая закупочная цена'}).fill('700.25');await dialog.getByRole('button',{name:'Сохранить',exact:true}).click();await dialog.locator('[data-metric=unit_cost]>strong').filter({hasText:/700,25/}).waitFor();assert.equal(parts[0].retail_price,1500.50);assert.equal(parts[0].unit_cost,700.25);assert.equal(edits.size,3);
   }
   assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
   assert(!calls.some(p=>['register','checkout','receipt','live_pay','live_receive'].includes(p.action)));
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS: mobile owner/developer edit quantity and price without a cash station; lost response retry, seller read-only, master denied, two-laptop cash access preserved');
 }finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
