const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const playwright=require(process.env.FASTGO_PLAYWRIGHT?path.join(process.env.FASTGO_PLAYWRIGHT,'node_modules/playwright'):'playwright');
const root=path.resolve(__dirname,'..');
async function check(browser,origin,kind){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[],calls=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>localStorage.setItem('fastgo_workshop_session',JSON.stringify({access_token:'search-fixture',user_id:'search-fixture',expires_at:4102444800})));
 const parts=Array.from({length:20},(_,i)=>({id:'part-'+i,name:'Амортизатор '+(i+1),model:i===0?'для электросамоката с очень длинным названием M4 Pro Max Speed Plus':'M'+i,sku:'FGP-'+String(i+1).padStart(3,'0'),barcode:'FGP-'+String(i+1).padStart(8,'0'),quantity:2,retail_price:1200,active:true}));
 await page.route('https://**/*',async route=>{
  if(!route.request().url().includes('/functions/v1/fastgo-workshop-api'))return route.abort();
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'};
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
  const {action}=route.request().postDataJSON();calls.push(action);let data={};
  if(action==='request_access')data={active:true};
  else if(action==='me')data={role:'owner',name:'Тест',profile_id:'search-fixture',active:true,status_permissions:{}};
  else if(action==='catalog')data={parts,services:[],staff:[],categories:[],capabilities:{private_product_photos:true,atomic_writes:true}};
  else if(action==='list')data={items:[],count:0};
  return route.fulfill({json:{data},headers});
 });
 await page.goto(origin+'/workshop.html#stock');
 const input=page.locator('#stock-search input'),box=page.locator('#stock-search .stock-suggestions');
 await input.tap();await box.waitFor({state:'hidden'});
 assert.equal(await input.getAttribute('aria-expanded'),'false');
 await input.fill('аморт');await box.waitFor({state:'visible'});
 assert.equal(await box.locator('button').count(),12);
 await input.evaluate(e=>e.scrollIntoView({block:'start'}));
 let layout=await box.evaluate(el=>{const r=el.getBoundingClientRect(),i=document.querySelector('#stock-search input').getBoundingClientRect();return {height:r.height,width:r.width,inputWidth:i.width,top:r.top,inputBottom:i.bottom,scrollable:el.scrollHeight>el.clientHeight,pageWidth:document.documentElement.scrollWidth,viewport:innerWidth};});
 assert.ok(layout.height<=209);assert.ok(layout.top>=layout.inputBottom);assert.ok(Math.abs(layout.width-layout.inputWidth)<2);assert.ok(layout.scrollable);assert.ok(layout.pageWidth<=layout.viewport+1);
 assert.equal(await box.locator('button').first().evaluate(el=>el.offsetHeight),52);
 // Touch scrolling stays inside the compact list, including on WebKit.
 await box.evaluate(el=>el.scrollTop=150);assert.ok(await box.evaluate(el=>el.scrollTop>0));
 await box.locator('button').nth(4).tap();
 await page.waitForFunction(()=>new URLSearchParams(location.hash.split('?')[1]).get('search')==='Амортизатор 5');
 await page.waitForFunction(()=>document.querySelectorAll('table.records tbody tr').length===1&&document.querySelector('table.records tbody tr td b')?.textContent==='Амортизатор 5');
 assert.equal(await page.locator('table.records tbody tr').count(),1);
 assert.equal(await page.locator('#stock-search input').inputValue(),'Амортизатор 5');
 assert.equal(await page.locator('#stock-search .stock-suggestions').isHidden(),true);
 assert.equal(await page.locator('#stock-search input').evaluate(e=>document.activeElement===e),false);
 await input.fill('аморт');await box.waitFor({state:'visible'});
 await page.locator('.pagehead h1').tap();await box.waitFor({state:'hidden'});
 await input.tap();await box.waitFor({state:'visible'});await input.press('Escape');await box.waitFor({state:'hidden'});
 await input.fill('');await box.waitFor({state:'hidden'});await input.fill('нет такой детали');await page.waitForTimeout(200);assert.equal(await box.isHidden(),true);
 // Model/SKU matches remain usable through the picker.
 await input.fill('FGP-007');await box.waitFor({state:'visible'});assert.equal(await box.locator('button').count(),1);
 await input.press('ArrowDown');await input.press('Enter');
 await page.waitForFunction(()=>document.querySelector('table.records tbody tr td b')?.textContent==='Амортизатор 7'&&document.querySelector('#stock-search input')?.dataset.suggestions==='true');
 await input.fill('аморт');await box.waitFor({state:'visible'});
 await input.evaluate(e=>e.scrollIntoView({block:'center'}));
 // Model the visual viewport left by the phone keyboard; resize repositions
 // above the field instead of covering the input or disappearing under keys.
 await page.evaluate(()=>{const r=document.querySelector('#stock-search input').getBoundingClientRect();window.originalViewport=window.visualViewport;const viewport=new EventTarget();viewport.offsetTop=0;viewport.height=r.bottom+70;Object.defineProperty(window,'visualViewport',{value:viewport,configurable:true});window.dispatchEvent(new Event('resize'));viewport.dispatchEvent(new Event('resize'));});
 layout=await box.evaluate(el=>{const r=el.getBoundingClientRect(),i=document.querySelector('#stock-search input').getBoundingClientRect();return{top:r.top,bottom:r.bottom,height:r.height,inputTop:i.top,side:el.dataset.side};});
 assert.equal(layout.side,'above');assert.ok(layout.bottom<=layout.inputTop);assert.ok(layout.top>=0);assert.ok(layout.height<=209);
 await page.screenshot({path:path.join(root,'browser-results',kind+'-stock-search.png')});
 await page.evaluate(()=>Object.defineProperty(window,'visualViewport',{value:window.originalViewport,configurable:true}));
 await input.press('Escape');await page.setViewportSize({width:1366,height:768});
 await input.fill('аморт');await box.waitFor({state:'visible'});
 assert.ok(await box.evaluate(el=>Math.abs(el.getBoundingClientRect().width-document.querySelector('#stock-search input').getBoundingClientRect().width)<2));
 assert.deepEqual(errors,[]);assert.equal(calls.filter(x=>x==='catalog').length,1);
 console.log(JSON.stringify({browser:kind,compact:true,scrollable:true,keyboardSpace:true,touchSelection:true,outsideDismiss:true,desktop:true,catalogRequests:1}));
 await context.close();
}
(async()=>{
 fs.mkdirSync(path.join(root,'browser-results'),{recursive:true});
 const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(e,data)=>{res.writeHead(e?404:200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[path.extname(file)]||'application/octet-stream'});res.end(e?'Not found':data);});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{for(const kind of (process.env.FASTGO_SEARCH_BROWSERS||'chromium,webkit').split(',')){
  const options=process.env.FASTGO_CHROMIUM?{executablePath:process.env.FASTGO_CHROMIUM,args:require('/tmp/fastgo-print-render/node_modules/@sparticuz/chromium').args}:{};
  const browser=await playwright[kind].launch({headless:true,...(kind==='chromium'?options:{})});
  try{await check(browser,'http://127.0.0.1:'+server.address().port,kind);}finally{await browser.close();}
 }}finally{server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
