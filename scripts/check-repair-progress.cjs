const {createServer}=require('node:http');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const engines=require('playwright'),browserName=process.env.FASTGO_REPAIR_BROWSER||'chromium';
assert.ok(['chromium','firefox','webkit'].includes(browserName),'Unknown repair test browser');
const root=path.resolve(__dirname,'..');
const server=createServer((req,res)=>{
 const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return res.writeHead(404).end();
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await engines[browserName].launch(browserName==='chromium'&&process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--no-sandbox']}:{});
 fs.mkdirSync('browser-results',{recursive:true});
 try{for(const viewport of [{width:1366,height:768},{width:1280,height:720},{width:390,height:844},{width:320,height:568}]){
  const context=await browser.newContext({viewport}),page=await context.newPage(),errors=[],updates=[];
  let personalStock=false,failUpdate=false,role='owner',permission={can_mark_ready:true,can_issue:true,can_cancel:true};
  let record={id:'progress-fixture',repair_number:16,revision:1,status:'accepted',brand:'Kugoo',model:'M4',last_name:'Тест',first_name:'Клиент',phone:'+79990000000',created_at:'2026-10-16',promised_date:'2026-10-20',works:[{name:'Назначенная стоимость ремонта',quantity:1,price:500}],parts:[],approved_amount:null,diagnostics_notes:'',paid_amount:0,total_amount:500,fault_photo_paths:['photo-one.jpg','photo-two.jpg'],signed_document_paths:[]};
  await context.addInitScript(()=>localStorage.setItem('fastgo_workshop_session',JSON.stringify({access_token:'progress-fixture',user_id:'progress-fixture',expires_at:4102444800})));
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{
   const req=route.request();if(req.url().startsWith(origin))return route.continue();
   if(!req.url().includes('/functions/v1/fastgo-workshop-api'))return route.abort();
   const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'};
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
   const {action,params}=req.postDataJSON();let data={};
   if(action==='request_access')data={active:true};
   if(action==='me')data={role,name:'Тест',profile_id:'progress-fixture',active:true,status_permissions:permission};
   if(action==='parts_pickup')data={code:'FGPARTS1.fixture.signed',number:16,vehicle:'Kugoo M4',master_name:'Мастер'};
   if(action==='get')data={record,events:[],payments:[],linked:[]};
   if(action==='signed_url')data={url:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="400" height="600" fill="'+(params.path==='photo-one.jpg'?'#24455c':'#416a73')+'"/><text x="80" y="300" fill="white">'+params.path+'</text></svg>')};
   if(action==='catalog')data={services:[{id:'tube',title:'Замена камеры',labor_price:600,active:true},{id:'brake',title:'Настройка тормозов',labor_price:400,active:true}],parts:personalStock?[{id:'22222222-2222-4222-8222-222222222222',name:'Камера мастера',retail_price:300,quantity:0,active:true}]:[],master_holdings:personalStock?[{master_id:'progress-fixture',part_id:'22222222-2222-4222-8222-222222222222',name:'Камера мастера',quantity:2}]:[],staff:[],categories:[]};
   if(action==='list')data={items:[],count:0};
   if(action==='update'){
    if(failUpdate){failUpdate=false;return route.fulfill({status:409,headers,json:{error:'Карточка уже изменена другим сотрудником. Обновите страницу.'}});}
    assert.equal(params.revision,record.revision);
    updates.push(structuredClone(params));record={...record,...params,revision:record.revision+1};
    record.total_amount=[...record.works,...record.parts].reduce((sum,x)=>sum+x.price*x.quantity,0);
    if(params.approve)record.approved_amount=record.total_amount;if(params.no_parts===true)record.parts_status={mode:'none'};else if(params.no_parts===false)record.parts_status={mode:'pending'};
    if(['diagnostics','waiting_parts','repair'].includes(record.status))record.quality_checked=false;
    data=record;
   }
   return route.fulfill({headers,json:{data}});
  });
  const pane=async id=>{if(viewport.width<=760)await page.locator('[data-repair-pane="'+id+'"]').click();};
  let navigation=0;const open=async()=>{
   await page.goto(origin+'/workshop.html?fixture='+(++navigation)+'#order?legacy=1&kind=repair&id=progress-fixture');
   await page.locator('#work-search').waitFor({state:'attached'});await pane('work');
  };
  const transition=async name=>{await page.locator('.repair-status-menu > summary').click();await page.getByRole('button',{name,exact:true}).click();};
  const saved=async action=>{
   const form=await page.locator('#order-form').elementHandle(),count=updates.length;
   await action();await page.waitForFunction(form=>!form.isConnected,form);
   assert.equal(updates.length,count+1);await pane('work');await page.locator('#repair-save').waitFor();
  };
  try{
   await open();
   assert.equal(await page.locator('#f-status,#f-promised_date,#catalog-picker').count(),0);
   assert.ok(await page.locator('#repair-save').isVisible());
   if(viewport.width>760){await page.locator('.repair-photo-thumbnail img').first().waitFor();await page.getByRole('button',{name:'Фото 2',exact:true}).click();assert.match(await page.locator('#order-vehicle-photo img').getAttribute('src'),/photo-two/);}await pane('payment');
   await page.locator('#payment').click();await page.locator('#f-amount').waitFor();assert.equal(updates.length,0);
   await page.locator('#dialog [aria-label="Закрыть"]').click();
   await pane('vehicle');await page.locator('#edit-intake').click();await page.locator('#f-last_name').waitFor();await page.locator('#dialog [aria-label="Закрыть"]').click();
   assert.equal(await page.locator('#repair-save').evaluate(x=>x.form.id),'order-form');
   await page.locator('.repair-menu-button').click();await page.locator('#dialog a[href="#stock"]').waitFor();await page.locator('#dialog [aria-label="Закрыть"]').click();
   if(viewport.width>760)await page.locator('#repair-details-panel > summary').click();
   assert.equal(await page.locator('#approve').evaluate(x=>x.form.id),'order-form');
   await pane('photos');await page.locator('#refresh-photos').click();if(viewport.width>760)await page.waitForFunction(()=>document.querySelector('#order-vehicle-photo img')?.src.includes('photo-two'));await pane('payment');
   if(viewport.width>760)await page.locator('.repair-payment-options > summary').click();
   await page.locator('#f-approval_note').fill('Проверка сохранения подробной информации');assert.equal(await page.evaluate(()=>window.fastgoHasUnsavedChanges()),true);
   if(viewport.width>760)await page.locator('#repair-details-panel > summary').click();await page.evaluate(()=>window.scrollTo(0,0));
   await pane('work');await page.screenshot({path:`browser-results/repair-card-initial-${viewport.width}.png`});
   await page.locator('#work-search').fill('замена');
   await page.getByRole('option',{name:/Замена камеры/}).waitFor();
   await page.locator('#work-search').press('ArrowDown');await page.locator('#work-search').press('Enter');
   assert.equal(await page.locator('#work-rows .cost-row').count(),2);
   assert.equal(await page.locator('#work-rows [data-prop="price"]').last().inputValue(),'600');
   await page.locator('#work-search').fill('несуществующая работа');await page.locator('#work-search').press('Enter');assert.equal(updates.length,0);
   await page.locator('#work-search').fill('');
   await page.locator('#add-work').click();await page.locator('#work-rows [data-prop="name"]').last().fill('Своя работа');
   await page.locator('#work-rows [data-prop="price"]').last().fill('200');
   await page.screenshot({path:`browser-results/repair-progress-${viewport.width}.png`});
   await saved(()=>page.locator('#repair-save').click());
   assert.deepEqual(updates.at(-1).parts,[]);assert.equal(updates.at(-1).status,'accepted');assert.equal(Object.hasOwn(updates.at(-1),'promised_date'),false);
   assert.equal(record.promised_date,'2026-10-20');
   // Saving refreshes the inline card and its permitted transitions.
   assert.equal(await page.locator('[data-guide-advance]').innerText(),'Начать диагностику');
   await saved(()=>page.locator('[data-guide-advance]').click());
   assert.equal(record.status,'diagnostics');assert.equal(await page.locator('[data-repair-status=repair]').count(),1);
   await page.locator('[data-guide-advance]').click();
   await page.locator('#f-flow_diagnostics').fill('Прокол камеры; клиент принёс свою камеру');
   await page.locator('[name="flow_approved"]').check();await page.locator('#f-flow_approval_note').fill('Согласовано при приёмке');
   await saved(()=>page.locator('#modal-form button[type="submit"]').click());
   assert.equal(record.status,'repair');assert.deepEqual(record.parts,[]);
   await page.locator('[data-guide-advance]').click();
   await page.locator('[name="flow_quality"]').check();
   const completionWrites=updates.length;await page.locator('#modal-form button[type="submit"]').click();
   assert.equal(await page.locator('[name="flow_no_parts"]').evaluate(input=>input.validity.valueMissing),true);assert.equal(updates.length,completionWrites);assert.equal(record.status,'repair');
   await page.locator('[name="flow_no_parts"]').check();
   await saved(()=>page.locator('#modal-form button[type="submit"]').click());
   assert.equal(record.status,'ready');assert.deepEqual(record.parts,[]);
   assert.ok(await page.locator('[data-guide-advance]').isDisabled());
   assert.equal(await page.locator('[data-repair-status=issued]').count(),1);
   assert.equal(await page.locator('#part-picker,#scan-part,#customer-part,#add-part').count(),0);
   // Revoking an existing choice stays explicit and blocks the next issue transition.
   await pane('parts');assert.equal(await page.locator('#no-parts').isChecked(),true);await page.locator('#no-parts').uncheck();
   await saved(()=>page.locator('#repair-save').click());assert.equal(updates.at(-1).no_parts,false);assert.equal(record.parts_status.mode,'pending');
   await transition('Выдать клиенту');await page.locator('#f-flow_handover').fill('Комплектно');const issueWrites=updates.length;
   await page.locator('#modal-form button[type="submit"]').click();assert.equal(updates.length,issueWrites);assert.equal(record.status,'ready');assert.equal(await page.locator('[name="flow_no_parts"]').isChecked(),false);
   await page.locator('#dialog [aria-label="Закрыть"]').click();
   // Price edits at an advanced stage offer approval here, not in a hidden panel.
   await page.locator('#work-rows [data-prop="price"]').first().fill('550');
   await page.locator('#repair-save').click();await page.locator('[name="flow_approved"]').check();
   await page.locator('#f-flow_approval_note').fill('Доплата согласована');
   await saved(()=>page.locator('#modal-form button[type="submit"]').click());
   assert.equal(record.approved_amount,1350);
   failUpdate=true;await page.locator('#work-rows [data-prop="name"]').first().fill('Новое название');
   assert.equal(await page.locator('#work-rows [data-prop="name"]').first().inputValue(),'Новое название');await page.locator('#repair-save').click();await page.locator('#repair-save-error').filter({hasText:/другим сотрудником/}).waitFor();
   assert.equal(await page.locator('#work-rows [data-prop="name"]').first().inputValue(),'Новое название');
   assert.ok(await page.locator('#repair-save').isEnabled());
   // No horizontal overflow; sticky save remains in view at both scroll extremes.
   for(const bottom of [false,true]){
    await page.evaluate(bottom=>window.scrollTo(0,bottom?document.documentElement.scrollHeight:0),bottom);
    assert.ok(await page.locator('#repair-save').isVisible());
    const box=await page.locator('#repair-save').boundingBox();assert.ok(box.y>=0&&box.y+box.height<=viewport.height,JSON.stringify(box));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   }
   await page.screenshot({path:`browser-results/repair-progress-saved-${viewport.width}.png`});
   // Fresh roles still control transitions, and closed records stay read-only.
   record.status='repair';permission={};await page.reload();await page.locator('#repair-progress-panel').waitFor({state:'attached'});await pane('work');
   assert.equal(await page.locator('[data-repair-status="ready"],[data-repair-status="cancelled"]').count(),0);assert.equal(await page.locator('[data-guide-advance]').count(),0);
   record.status='issued';await page.reload();await page.locator('#repair-progress-panel').waitFor({state:'attached'});await pane('work');
   assert.equal(await page.locator('#repair-save,[data-repair-status]').count(),0);assert.ok(await page.locator('#add-work').isDisabled());
   record.status='stored';await page.goto(origin+'/workshop.html#order?kind=storage&id=progress-fixture');
   await page.getByRole('button',{name:'Хранение и выдача'}).click();
   assert.ok(await page.locator('#f-status').isVisible());assert.ok(await page.locator('#f-planned_return_date').isVisible());
   personalStock=true;record.status='accepted';record.assigned_master_id='progress-fixture';await open();assert.equal(await page.locator('[data-held-part]').count(),0);await pane('parts');await page.locator('#take-parts').click();await page.getByRole('dialog',{name:'Взять запчасти'}).waitFor();assert.ok(await page.locator('[data-pickup-qr] svg').count());await page.getByRole('dialog',{name:'Взять запчасти'}).getByRole('button',{name:'Закрыть',exact:true}).click();
   // A text-only historic line or a zero quantity cannot hide the mandatory choice.
   permission={can_mark_ready:true,can_issue:true,can_cancel:true};role='mechanic';
   for(const line of [{name:'Камера клиента',quantity:1,price:0},{part_id:'stock-part',name:'Нулевая старая строка',quantity:0,price:0}]){
    record={...record,status:'repair',works:[],parts:[line],parts_status:{mode:'legacy'},total_amount:0,approved_amount:0,diagnostics_notes:'Проверено',quality_checked:true,assigned_master_id:'progress-fixture'};
    await open();await pane('parts');assert.equal(await page.locator('#no-parts').count(),1);assert.equal(await page.locator('#repair-parts-condition').getAttribute('data-parts-condition'),'pending');
    const count=updates.length;await transition('Ремонт готов');await page.locator('#modal-form button[type="submit"]').click();assert.equal(updates.length,count);assert.equal(record.status,'repair');assert.equal(await page.locator('[name="flow_no_parts"]').evaluate(input=>input.validity.valueMissing),true);await page.locator('#dialog [aria-label="Закрыть"]').click();
   }
   // Previously linked product-ID allocations count without a second issue or manual stock edit.
   record={...record,parts:[{id:'old-product-id',name:'Ранее выданный амортизатор',quantity:2,price:0}],parts_status:{mode:'legacy'}};await open();await pane('parts');assert.equal(await page.locator('#no-parts').count(),0);assert.equal(await page.locator('#repair-parts-condition').getAttribute('data-parts-condition'),'issued');
   await saved(()=>transition('Ремонт готов'));assert.equal(record.status,'ready');assert.equal(Object.hasOwn(updates.at(-1),'no_parts'),false);assert.equal(record.parts[0].quantity,2);
   // A cashier cannot impersonate the assigned mechanic's confirmation.
   role='receiver';record={...record,status:'repair',parts:[],parts_status:{mode:'pending'},assigned_master_id:'another-mechanic'};await open();await pane('parts');assert.equal(await page.locator('#no-parts').isDisabled(),true);const noPermissionWrites=updates.length;await transition('Ремонт готов');assert.equal(await page.locator('#modal-form [type="submit"]').isDisabled(),true);assert.equal(await page.locator('[name="flow_no_parts"]').count(),0);assert.equal(updates.length,noPermissionWrites);await page.locator('#dialog [aria-label="Закрыть"]').click();
   assert.deepEqual(errors,[]);console.log(`PASS ${viewport.width}: work suggestions, own work, inline layout and saving, diagnostics → repair → ready without parts, pickup QR, manual parts removed, price approval, conflict, permissions and storage`);
  }catch(error){console.error('PAGE',await page.locator('body').innerText(),errors);throw error;}finally{await context.close();}
 }}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
