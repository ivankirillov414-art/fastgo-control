const {createServer}=require('node:http');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const engines=require('playwright'),browserName=process.env.FASTGO_REPAIR_BROWSER||'chromium';
assert.ok(['chromium','firefox','webkit'].includes(browserName),'Unknown repair test browser');
const root=path.resolve(__dirname,'..');const evidence=path.join(root,'browser-results','mobile-intake',browserName);fs.mkdirSync(evidence,{recursive:true});
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
 try{for(const viewport of [{width:390,height:844}]){
  const context=await browser.newContext({viewport}),page=await context.newPage(),errors=[],updates=[];page.setDefaultTimeout(12000);page.on('dialog',d=>d.accept());
  let personalStock=false,failUpdate=false,role='owner',permission={can_mark_ready:true,can_issue:true,can_cancel:true};
  let record={id:'progress-fixture',repair_number:16,revision:1,status:'accepted',brand:'Kugoo',model:'M4',last_name:'Тест',first_name:'Клиент',phone:'+79990000000',created_at:'2026-10-16',promised_date:'2026-10-20',works:[{name:'Назначенная стоимость ремонта',quantity:1,price:500}],parts:[],approved_amount:null,diagnostics_notes:'',paid_amount:0,total_amount:500,fault_photo_paths:['photo-one.jpg','photo-two.jpg'],signed_document_paths:[]};
  await context.addInitScript(()=>localStorage.setItem('fastgo_workshop_session',JSON.stringify({access_token:'progress-fixture',user_id:'progress-fixture',expires_at:4102444800})));
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{
   const req=route.request();if(req.url().startsWith(origin)||/^(blob:|data:)/.test(req.url()))return route.continue();
   if(!req.url().includes('/functions/v1/fastgo-workshop-api'))return route.abort();
   const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'};
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
   const {action,params}=req.postDataJSON();let data={};
   if(action==='create'){record={...record,...params,works:[],parts:[],paid_amount:0,total_amount:0};data=record;}if(action==='upload')data={path:'fixture-photo.png'};if(action==='request_access')data={active:true};
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
   await page.goto(origin+'/workshop.html?fixture='+(++navigation)+'#order?kind=repair&id=progress-fixture');
   await page.locator('#work-search').waitFor({state:'attached'});await pane('work');
  };
  const transition=async name=>{await page.locator('.repair-status-menu > summary').click();await page.getByRole('button',{name,exact:true}).click();};
  const saved=async action=>{
   const form=await page.locator('#order-form').elementHandle(),count=updates.length;
   await action();await page.waitForFunction(form=>!form.isConnected,form);
   assert.equal(updates.length,count+1);await pane('work');await page.locator('#repair-save').waitFor();
  };
  try {
   for(const size of [{width:320,height:568},{width:390,height:844},{width:430,height:932}]){
    await page.setViewportSize(size);
    await page.goto(origin+'/workshop.html?width='+size.width+'#new?kind=repair');await page.locator('[data-intake-next]').waitFor();
    await page.locator('[data-intake-next]').click();assert.equal(await page.locator('#intake-form').getAttribute('data-intake-current'),'0');
    await page.locator('#f-phone').fill('123');await page.locator('#f-last_name').fill('Учебный');await page.locator('#f-first_name').fill('Клиент');await page.locator('[data-intake-next]').click();assert.equal(await page.locator('#intake-form').getAttribute('data-intake-current'),'0');await page.locator('#f-phone').fill('+79990000000');
    await page.screenshot({path:path.join(evidence,`mobile-client-${size.width}.png`)});
    await page.locator('[data-intake-next]').click();assert.equal(await page.locator('#intake-form').getAttribute('data-intake-current'),'1');
    await page.locator('#f-equipment_name').fill('Kugoo M4');await page.locator('#f-issue_description').fill('Прокол колеса');await page.screenshot({path:path.join(evidence,`mobile-equipment-${size.width}.png`)});
    await page.locator('[data-intake-back]').click();assert.equal(await page.locator('#f-phone').inputValue(),'+79990000000');await page.locator('[data-intake-next]').click();assert.equal(await page.locator('#f-equipment_name').inputValue(),'Kugoo M4');
    await page.locator('[data-intake-next]').click();assert.equal(await page.locator('#f-intake_amount,[name=intake_amount]').count(),0);
    await page.locator('#intake-photos').setInputFiles({name:'equipment.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aANsAAAAASUVORK5CYII=','base64')});
    assert.equal(await page.locator('.intake-photo-selected').innerText(),'equipment.png');await page.locator('[data-intake-back]').click();await page.locator('[data-intake-next]').click();assert.equal(await page.locator('#intake-photos').evaluate(el=>el.files.length),1);await page.setViewportSize({width:size.width,height:360});await page.locator('#intake-save').focus();await page.locator('#intake-save').scrollIntoViewIfNeeded();await page.locator('#intake-save').click({trial:true});await page.setViewportSize(size);
    await page.screenshot({path:path.join(evidence,`mobile-confirm-${size.width}.png`)});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.locator('#intake-save').scrollIntoViewIfNeeded();await page.locator('#intake-save').click({trial:true});assert(await page.locator('[data-intake-next]').isHidden());
    if(size.width===430){await page.locator('#intake-photos').setInputFiles({name:'equipment.png',mimeType:'image/png',buffer:await page.screenshot()});await page.locator('#intake-save').click();await page.locator('.repair-card').waitFor();assert.equal(record.status,'accepted');assert.deepEqual(record.works,[]);assert.equal(record.total_amount,0);assert.equal(updates.length,0);await page.screenshot({path:path.join(evidence,'intake-saved.png')});await page.goto(origin+'/workshop.html?desktop=1#new?kind=repair');await page.locator('#intake-form').waitFor();}await page.setViewportSize({width:1366,height:768});assert(await page.locator('#f-phone').isVisible());assert(await page.locator('#f-equipment_name').isVisible());assert(await page.locator('#intake-save').isVisible());
   }
   await page.setViewportSize({width:320,height:568});await page.goto(origin+'/workshop.html#new?kind=storage');await page.locator('[data-intake-next]').waitFor();await page.locator('#f-phone').fill('123');await page.locator('#f-last_name').fill('Учебный');await page.locator('#f-first_name').fill('Клиент');await page.locator('[data-intake-next]').click();assert.equal(await page.locator('#intake-form').getAttribute('data-intake-current'),'0');await page.locator('#f-phone').fill('+79990000000');await page.locator('[data-intake-next]').click();await page.locator('#f-equipment_name').fill('Kugoo M4');await page.locator('[data-intake-next]').click();assert(await page.locator('#f-storage_tariff').isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   assert.deepEqual(errors,[]);console.log('MOBILE_INTAKE_OK: 320/390/430, required fields, back retention, file selection, save reachable, desktop, storage');
  } catch(error){console.log(JSON.stringify(await page.evaluate(()=>({viewport:[innerWidth,innerHeight],scroll:[scrollX,scrollY],save:document.querySelector("#intake-save")?.getBoundingClientRect().toJSON(),active:document.activeElement?.id,step:document.querySelector("#intake-form")?.dataset.intakeCurrent}))));await page.screenshot({path:path.join(evidence,"failure.png")});throw error;} finally {await context.close();}
 }} finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});



