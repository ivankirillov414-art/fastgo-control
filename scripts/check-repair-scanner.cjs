const assert=require('node:assert/strict');

// Isolated repair fixture. Every business request is intercepted; no live writes.
module.exports=async function checkRepairScanner({browser,origin,kind}){
 const context=await browser.newContext({viewport:{width:360,height:800}}),page=await context.newPage(),errors=[];
 const updates=[],actions=[];
 let holdCatalog=false,releaseCatalog,notifyCatalogHeld;
 page.on('pageerror',error=>errors.push(error.message));
 await context.addInitScript(()=>{
  localStorage.setItem('fastgo_workshop_session',JSON.stringify({access_token:'scanner-fixture',user_id:'scanner-fixture',expires_at:4102444800}));
  window.repairCameraStarts=0;window.repairCameraStops=0;window.repairCameraDenied=false;
  window.ZXingBrowser={BrowserMultiFormatReader:class{
   async decodeFromConstraints(constraints,video,callback){
    if(window.repairCameraDenied)throw Object.assign(new Error('denied'),{name:'NotAllowedError'});
    if(constraints.video.facingMode.ideal!=='environment')throw new Error('Expected rear camera');
    window.repairCameraStarts++;window.repairDecode=callback;
    return {stop:()=>window.repairCameraStops++};
   }
  }};
 });
 const catalogParts=[
  {id:'a0000000-0000-4000-8000-000000000001',name:'Амортизатор',barcode:'FGP-00000001',sku:'AM-1',quantity:10,retail_price:800,active:true},
  {id:'a0000000-0000-4000-8000-000000000002',name:'Камера колеса',barcode:'FGP-00000002',sku:'C-2',quantity:10,retail_price:300,active:true},
  {id:'a0000000-0000-4000-8000-000000000003',name:'Архивная запчасть',barcode:'FGP-00000003',quantity:10,retail_price:100,active:false},
  {id:'a0000000-0000-4000-8000-000000000004',name:'Модель 1',barcode:'FGP-00000004',sku:'DUPE',quantity:10,retail_price:100,active:true},
  {id:'a0000000-0000-4000-8000-000000000005',name:'Модель 2',barcode:'FGP-00000005',sku:'DUPE',quantity:10,retail_price:100,active:true}
 ];
 let record={id:'scanner-order',repair_number:7,storage_number:7,status:'accepted',revision:1,brand:'Тест',model:'Самокат',last_name:'Тест',first_name:'Клиент',phone:'+79991234567',created_at:'2026-10-10',approved_amount:null,diagnostics_notes:'',works:[{name:'Сборка',price:400,quantity:1}],parts:[{name:'Амортизатор · согласованная цена',price:650,quantity:1,part_id:'a0000000-0000-4000-8000-000000000001'}],total_amount:1050,paid_amount:0,fault_photo_paths:[],signed_document_paths:[]};
 await page.route('**/*',async route=>{
  const req=route.request();if(req.url().startsWith(origin))return route.continue();
  if(!req.url().includes('/functions/v1/fastgo-workshop-api'))return route.abort();
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  const {action,params}=req.postDataJSON();actions.push(action);let data={};
  if(action==='request_access')data={active:true};
  if(action==='me')data={role:'mechanic',name:'Мастер',profile_id:'scanner-fixture',active:true,status_permissions:{}};
  if(action==='catalog'){
   if(holdCatalog){holdCatalog=false;await new Promise(resolve=>{releaseCatalog=resolve;notifyCatalogHeld?.();});}
   data={services:[],staff:[],parts:catalogParts,categories:[]};
  }
  if(action==='get')data={record,events:[],payments:[],linked:[]};
  if(action==='list')data={items:[],count:0};
  if(action==='update'){
   updates.push(params);record={...record,...params,revision:record.revision+1};data=record;
  }
  return route.fulfill({json:{data},headers});
 });
 const quantities=()=>page.locator('#part-rows [data-prop="quantity"]').evaluateAll(inputs=>inputs.map(input=>Number(input.value)));
 const submitCode=async code=>{
  const input=page.locator('#repair-part-code');await input.fill(code);await input.press('Enter');
 };
 const feedback=pattern=>page.locator('#repair-part-feedback').filter({hasText:pattern}).waitFor();
 try{
  await page.goto(origin+'/workshop.html#order?kind=repair&id=scanner-order');await page.locator('#order-form').waitFor();
  await page.locator('#f-diagnostics_notes').fill('Не потерять комментарий мастера');
  await page.locator('#work-rows [data-prop="price"]').fill('450');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('#scan-part').click();await page.waitForFunction(()=>window.repairCameraStarts===1);
  const fit=await page.locator('#repair-part-scanner').evaluate(dialog=>({width:dialog.clientWidth,scroll:dialog.scrollWidth,left:dialog.getBoundingClientRect().left,right:dialog.getBoundingClientRect().right,view:innerWidth}));
  assert.ok(fit.scroll<=fit.width+1&&fit.left>=0&&fit.right<=fit.view+1,JSON.stringify(fit));
  await page.screenshot({path:`browser-results/${kind}-repair-scanner.png`});
  // Two frames of the same physical scan add exactly once.
  await page.evaluate(()=>{window.repairDecode({getText:()=> 'FGP-00000001'});window.repairDecode({getText:()=> 'FGP-00000001'});});
  await feedback(/Добавлено/);assert.deepEqual(await quantities(),[2]);assert.equal(updates.length,0);
  assert.equal(await page.locator('#part-rows [data-prop="price"]').inputValue(),'650');
  await page.locator('#repair-part-retry').click();await page.waitForFunction(()=>window.repairCameraStarts===2);
  await page.evaluate(()=>window.repairDecode({getText:()=> 'fgp-00000001'}));
  await feedback(/3 шт/);assert.deepEqual(await quantities(),[3]);
  await submitCode('C-2');await feedback(/Камера колеса/);assert.deepEqual(await quantities(),[3,1]);
  // USB/Bluetooth readers enter characters then Enter into the focused field.
  await page.locator('#repair-part-code').fill('');await page.locator('#repair-part-code').focus();
  await page.keyboard.type('FGP-00000002',{delay:2});await page.keyboard.press('Enter');
  await feedback(/2 шт/);assert.deepEqual(await quantities(),[3,2]);assert.equal(updates.length,0);
  assert.equal(await page.locator('#part-rows [data-prop="price"]').nth(1).inputValue(),'300');
  for(const [code,message] of [['FGC-000001',/категории/],['FGP-00000003',/отключ|архив|неактив/],['DUPE',/нескольк|неоднознач|разным/],['MISSING',/не найден/]]){
   await submitCode(code);await feedback(message);assert.deepEqual(await quantities(),[3,2]);
  }
  const orderURL=page.url();await submitCode('https://example.test/workshop.html#order?id=other');await feedback(/не найден/);assert.equal(page.url(),orderURL);
  catalogParts.push({id:'a0000000-0000-4000-8000-000000000006',name:'Новая колодка',barcode:'FGP-00000006',quantity:4,retail_price:250,active:true});
  await submitCode('FGP-00000006');await feedback(/Новая колодка/);assert.deepEqual(await quantities(),[3,2,1]);
  assert.equal(await page.locator('#part-picker option[value="a0000000-0000-4000-8000-000000000006"]').count(),1);
  // Closing while the fresh catalogue is loading must cancel the addition.
  catalogParts.push({id:'a0000000-0000-4000-8000-000000000007',name:'Поздний ответ',barcode:'FGP-00000007',quantity:4,retail_price:200,active:true});
  holdCatalog=true;const catalogHeld=new Promise(resolve=>notifyCatalogHeld=resolve);
  await submitCode('FGP-00000007');await catalogHeld;
  await page.locator('#repair-part-scanner [data-part-scan-close]').first().click();
  const replied=page.waitForResponse(response=>response.request().method()==='POST'&&response.url().includes('/functions/v1/fastgo-workshop-api')&&response.request().postDataJSON()?.action==='catalog');
  releaseCatalog();await replied;
  await page.waitForFunction(()=>!document.getElementById('repair-part-scanner'));
  // A denied camera must still allow a keyboard reader, without saving the order.
  await page.evaluate(()=>window.repairCameraDenied=true);await page.locator('#scan-part').click();
  await page.locator('#repair-part-camera-status').filter({hasText:/Разрешите|недоступна/}).waitFor();
  assert.deepEqual(await quantities(),[3,2,1]);
  await submitCode('AM-1');await feedback(/4 шт/);assert.deepEqual(await quantities(),[4,2,1]);assert.equal(updates.length,0);
  await page.keyboard.press('Escape');await page.locator('#repair-part-scanner').waitFor({state:'detached'});
  assert.equal(await page.locator('#f-diagnostics_notes').inputValue(),'Не потерять комментарий мастера');
  assert.equal(await page.locator('#work-rows [data-prop="price"]').inputValue(),'450');
  const formBeforeSave=await page.locator('#order-form').elementHandle();
  await page.locator('#order-form button[type="submit"]').click();
  await page.getByRole('status').filter({hasText:'Изменения сохранены'}).waitFor();
  await page.waitForFunction(form=>!form.isConnected,formBeforeSave);await page.locator('#order-form').waitFor();
  assert.equal(updates.length,1);assert.deepEqual(updates[0].parts.map(part=>[part.part_id,part.quantity,part.price]),[['a0000000-0000-4000-8000-000000000001',4,650],['a0000000-0000-4000-8000-000000000002',2,300],['a0000000-0000-4000-8000-000000000006',1,250]]);
  assert.equal(updates[0].diagnostics_notes,'Не потерять комментарий мастера');assert.equal(updates[0].works[0].price,450);
  assert.equal(actions.includes('stock'),false);assert.equal(actions.includes('sale'),false);
  // Route replacement also closes a running camera.
  await page.evaluate(()=>window.repairCameraDenied=false);await page.locator('#scan-part').click();
  await page.waitForFunction(()=>window.repairCameraStarts>window.repairCameraStops);
  await page.evaluate(()=>location.hash='#repairs');await page.locator('#repair-part-scanner').waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>window.repairCameraStarts===window.repairCameraStops),true);
  record.status='issued';await page.goto(origin+'/workshop.html?scanner-closed#order?kind=repair&id=scanner-order');await page.locator('#order-form').waitFor();
  assert.equal(await page.locator('#scan-part').isDisabled(),true);
  record.status='stored';await page.goto(origin+'/workshop.html?scanner-storage#order?kind=storage&id=scanner-order');await page.locator('#order-form').waitFor();
  assert.equal(await page.locator('#scan-part').count(),0);assert.deepEqual(errors,[]);
  console.log(kind+': repair part camera, keyboard scanner, retry, cancellation and save passed');
 }finally{
  releaseCatalog?.();await context.close();
 }
};
