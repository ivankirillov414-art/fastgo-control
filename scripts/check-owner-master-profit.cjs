const {serve,launchOptions}=require('./warehouse-browser-fixture.cjs');
const playwright=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {randomUUID}=require('node:crypto');
(async()=>{
 const {createOperationsHandler}=await import('../supabase/functions/fastgo-operations/handler.js');
 const kind=process.env.FASTGO_REPAIR_BROWSER||'chromium',{server,base}=await serve(),browser=await playwright[kind].launch(kind==='chromium'?launchOptions:{headless:true});
 try{for(const width of [320,768,1366]){
  const owner=randomUUID(),master=randomUUID(),other=randomUUID(),repair=randomUUID(),product=randomUUID();
  const members=[{profile_id:master,name:'Расим',role:'mechanic',active:true},{profile_id:other,name:'Алексей',role:'mechanic',active:true}];
  const sheets={'Ремонты':{rows:[{__row:2,repair_id:repair,'Номер ремонта':'FGR-0001','Статус':'Выдан',master_id:other,'Мастер':'Алексей','Итого':1000,'Оплачено':1000,'Выдано':'2026-10-01','Работы':'[]','Строки запчастей':JSON.stringify([{part_id:product,quantity:2,unit_cost:100}])}]},'События':{rows:[{__row:2,event_id:randomUUID(),'Дата':'2026-10-01T08:00:00Z','Тип':'repair',record_id:repair,'Действие':'repair_steps',actor_id:master,'Детали':JSON.stringify({action:'complete',completion_master_name:'Расим'})},{__row:3,event_id:randomUUID(),'Дата':'2026-10-01T00:00:00Z','Тип':'payroll',record_id:master,'Действие':'payroll_rate',actor_id:owner,'Детали':JSON.stringify({employee_id:master,effective_date:'2026-10-01',daily_rate:50,basis:'working_days',revision:1})}]},'Оплаты':{rows:[{__row:2,payment_id:randomUUID(),'Дата':'2026-10-01T09:00:00Z','Тип':'repair',record_id:repair,'Сумма':1000}]},'Движения склада':{rows:[{reference_id:repair,product_id:product,'Тип':'Расход','Количество':2,'Цена закупки':100}]},'Товары':{rows:[]},'Приёмки':{rows:[]},'Сотрудники':{rows:[]}};
  let revision=1,lost=true,role='owner';const receipts=[],writes=[];
  const handler=createOperationsHandler({base:'https://fixture',key:'server-fixture',fetcher:async(url,options={})=>{
   if(url.endsWith('/user'))return Response.json({id:owner});const u=new URL(url),path=u.pathname.split('/rest/v1/')[1];
   if(path==='workshop_members')return Response.json(u.searchParams.has('profile_id')?[{role}]:members);
   if(path==='workshop_operations_settings')return Response.json([{config:{stale_days:3,long_days:14,coverage_days:7,rates:{}}}]);
   if(path==='rpc/workshop_native_snapshot')return Response.json({version:revision,sheets:structuredClone(sheets)});
   if(path==='workshop_native_receipts')return Response.json(receipts.filter(x=>x.request_id===u.searchParams.get('request_id')?.slice(3)));
   if(path==='rpc/workshop_native_commit'){
    const p=JSON.parse(options.body);writes.push(p);assert(p.p_changes.every(x=>x.sheet==='События'));
    if(p.p_version!==revision)return Response.json({retry:true});
    for(const c of p.p_changes)sheets[c.sheet].rows.push({__row:c.row,...c.values});revision++;
    receipts.push({request_id:p.p_request_id,actor_id:p.p_actor,action:p.p_action,fingerprint:p.p_fingerprint,result:p.p_result});
    if(lost&&p.p_action==='salary_rate_save'){lost=false;throw Error('Lost reply');}return Response.json({result:p.p_result});
   }throw Error('Unexpected backend '+path);
  }});
  const context=await browser.newContext({viewport:{width,height:width===320?568:900}});
  await context.addInitScript(owner=>localStorage.setItem('fastgo_workshop_session',JSON.stringify({user_id:owner,access_token:'owner-test',expires_at:4102444800})),owner);
  await context.route('https://**/*',async route=>{
   const request=route.request(),headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'};
   if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
   if(request.url().includes('fastgo-operations')){const result=await handler(new Request('https://api',{method:'POST',headers:{Authorization:'Bearer owner-test'},body:request.postData()}));return route.fulfill({status:result.status,headers,body:await result.text(),contentType:'application/json'});}
   const body=request.postDataJSON()||{};let data={};
   if(body.action==='me')data={profile_id:owner,name:'Владелец',role,active:true,status_permissions:{can_mark_ready:true,can_issue:true}};
   else if(body.action==='request_access')data={active:true};else if(body.action==='catalog')data={parts:[],services:[],staff:[],categories:[]};
   else if(request.url().includes('fastgo-avito'))data={connected:false,notifications:[],popups_allowed:false};
   else if(body.action==='staff_tasks')data={items:[]};
   return route.fulfill({headers,json:{data}});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/workshop.html#owner-analytics?tab=masters&to=2026-10-03');
  await page.getByRole('heading',{name:'Прибыль по мастерам',exact:true}).waitFor();
  await page.getByRole('button',{name:'Расим',exact:true}).click();await page.locator('[data-day="2026-10-02"]').waitFor();
  assert.equal(await page.locator('#owner-period').isVisible(),false);assert.equal(await page.locator('.mp-metrics').innerText().then(x=>x.includes('750')),true);
  await page.locator('[data-edit-rate]').click();await page.locator('#dialog input[name=daily_rate]').fill('80');await page.locator('#dialog input[name=effective_date]').fill('2026-10-02');
  await page.locator('#modal-form button[type=submit]').click();await page.locator('#modal-error').getByText('Не удалось загрузить данные.',{exact:false}).waitFor();
  await page.locator('#modal-form button[type=submit]').click();await page.locator('#dialog[open]').waitFor({state:'hidden'});assert.equal(writes.filter(x=>x.p_action==='salary_rate_save').length,1);
  await page.locator('[data-day="2026-10-02"]').selectOption('work');await page.waitForFunction(()=>document.querySelector('.mp-metrics')?.innerText.includes('670'));
  assert.equal(writes.filter(x=>x.p_action==='salary_day_save').length,1);
  await page.locator('[data-owner-tab="8"]').click();await page.getByRole('heading',{name:'Зарплаты мастеров',exact:true}).waitFor();await page.getByRole('button',{name:'Расим',exact:true}).click();
  await page.locator('[data-day="2026-10-01"]').selectOption('off');await page.waitForFunction(()=>document.querySelector('[data-day="2026-10-01"]')?.value==='off'&&!document.querySelector('[data-day="2026-10-01"]').disabled);
  for(const period of ['day','week','month']){await page.locator('[data-period="'+period+'"]').click();await page.locator('[data-period="'+period+'"][aria-pressed=true]').waitFor();}
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal document overflow');
  fs.mkdirSync('browser-results/owner-master-profit',{recursive:true});await page.screenshot({path:'browser-results/owner-master-profit/'+kind+'-'+width+'.png',fullPage:true});
  assert.deepEqual(errors,[]);assert.equal(sheets['Ремонты'].rows.length,1);assert.equal(sheets['Оплаты'].rows.length,1);assert.equal(sheets['Товары'].rows.length,0);
  role='mechanic';await page.reload();await page.getByText('Этот раздел доступен только владельцу',{exact:true}).waitFor();assert.equal(await page.locator('[data-owner-tab="8"]').count(),0);
  await context.close();console.log('PASS '+kind+' '+width+': actual performer, period controls, durable salary retry, working-day correction, owner-only access and no stock/payment mutations');
 }}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
