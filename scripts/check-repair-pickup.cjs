const assert=require('node:assert/strict');
module.exports=async function({browser,origin}){
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[],writes=[];
 let role='mechanic',pickups=0;
 let record={id:'pickup-fixture',repair_number:41,revision:1,status:'diagnostics',brand:'Kugoo',model:'Max Speed',last_name:'Тест',first_name:'Клиент',phone:'+70000000000',created_at:'2026-10-26',works:[],parts:[],total_amount:0,paid_amount:0,diagnostics_notes:'Проверено',fault_photo_paths:[],signed_document_paths:[]};
 page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>localStorage.setItem('fastgo_workshop_session',JSON.stringify({access_token:'fixture',user_id:'fixture',expires_at:4102444800})));
 await page.route('**/*',async route=>{
  const req=route.request();if(req.url().startsWith(origin))return route.continue();
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  if(!req.url().includes('/functions/v1/fastgo-workshop-api'))return route.abort();
  const {action,params:p={}}=req.postDataJSON();let data={};
  if(action==='request_access')data={active:true};
  else if(action==='me')data={profile_id:'fixture',role,can_sell:true,status_permissions:{can_mark_ready:true,can_cancel:true}};
  else if(action==='get')data={record,events:[],payments:[],linked:[]};
  else if(action==='catalog')data={services:[],parts:[],staff:[],categories:[]};
  else if(action==='parts_pickup'){pickups++;data={code:'FGPARTS1.fixture.signature',number:41,vehicle:'Kugoo Max Speed',master_name:'Тестовый мастер'};}
  else if(action==='update'){writes.push(p);record={...record,...p,revision:record.revision+1};data=record;}
  return route.fulfill({headers,json:{data}});
 });
 const pane=id=>page.locator('[data-repair-pane="'+id+'"]').click();
 let navigation=0;const open=async()=>{await page.goto(origin+'/workshop.html?fixture='+(++navigation)+'#order?legacy=1&kind=repair&id=pickup-fixture');await page.locator('.repair-pane-tabs').waitFor();};
 try{
  await open();assert.equal(await page.locator('#payment,#refund,[data-return-part]').count(),0);
  assert.equal(await page.locator('[data-repair-pane=payment],[data-repair-pane=history]').count(),0);
  assert.equal(await page.locator('.nav a[href="#stock"],.nav a[href="#finance"],.nav a[href="#cash"]').count(),0);
  assert.equal(await page.locator('#repair-details-panel > summary').isVisible(),false);
  for(const blocked of ['stock','finance','cash']){await page.goto(origin+'/workshop.html#'+blocked);await page.getByText('Этот раздел недоступен вашей роли',{exact:true}).waitFor();}
  await open();await pane('work');await page.locator('#f-diagnostics_notes').fill('Изменённая диагностика');
  await pane('parts');await page.locator('#take-parts').click();await page.locator('#dialog').filter({hasText:'Сначала сохраните'}).waitFor();await page.locator('#dialog [aria-label="Закрыть"]').click();assert.equal(pickups,0);
  await pane('work');const form=await page.locator('#order-form').elementHandle();await page.locator('#repair-save').click();await page.waitForFunction(x=>!x.isConnected,form);
  await pane('parts');await page.locator('#take-parts').click();await page.getByRole('dialog',{name:'Взять запчасти'}).waitFor();assert.equal(pickups,1);
  assert.equal(await page.locator('[data-pickup-qr] svg').count(),1);
  record={...record,revision:record.revision+1,parts:[{part_id:'cash-part',name:'Амортизатор',quantity:2,price:1500,tsd_issue_id:'cash-issued'}],parts_status:{mode:'issued'}};
  await page.getByRole('dialog',{name:'Взять запчасти'}).waitFor({state:'detached',timeout:9000});await pane('parts');
  await page.locator('#part-rows').filter({hasText:'2 шт.'}).waitFor();assert.equal(writes.length,1);assert.deepEqual(writes[0].parts,[]);
  assert.equal(await page.locator('[data-return-part],#part-picker,#scan-part,#add-part').count(),0);
  const bounds=await page.locator('.repair-card').boundingBox();assert.ok(bounds.y+bounds.height<844-60);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('.repair-status-menu summary').click();await page.locator('[data-repair-status=cancelled]').click();
  assert.equal(await page.locator('#f-flow_cancel').count(),0);await page.locator('[name=cancel_reason_0]').check();
  // The fixture must not pretend an actual cancellation can return issued parts.
  await page.locator('#dialog [aria-label="Закрыть"]').click();
  role='receiver';await open();await pane('payment');assert.equal(await page.locator('#payment').isVisible(),false); // no debt in this fixture
  assert.deepEqual(errors,[]);console.log('Phone repair panes, role restrictions, dirty guard and TSD pickup refresh passed');
 }finally{await context.close();}
};
