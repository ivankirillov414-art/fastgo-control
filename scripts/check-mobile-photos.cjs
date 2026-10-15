const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const playwright=require(process.env.FASTGO_PLAYWRIGHT?path.join(process.env.FASTGO_PLAYWRIGHT,'node_modules/playwright'):'playwright');
const root=path.resolve(__dirname,'..'),png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS9sAAAAASUVORK5CYII=';
async function check(browser,origin,kind){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[],calls=[],uploads=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>localStorage.setItem('fastgo_workshop_session',JSON.stringify({access_token:'photo-fixture',user_id:'photo-fixture',expires_at:4102444800})));
 const parts=['one','two'].map((id,i)=>({id,name:'Тормозная колодка '+id,category:'Тормоза',quantity:2,retail_price:100,active:true,primary_photo_path:'native:'+id,barcode:'FGP-0000000'+i}));
 const record={id:'order-one',repair_number:9,storage_number:9,status:'accepted',revision:1,brand:'Kugoo',model:'M4',last_name:'Тест',first_name:'Клиент',phone:'+70000000000',approved_amount:null,works:[],parts:[],fault_photo_paths:['native:old-photo'],signed_document_paths:[],paid_amount:0,total_amount:0};
 let hold=null,failNext=false,failSecond=false;
 await page.route('https://**/*',async route=>{
  if(!route.request().url().includes('/functions/v1/fastgo-workshop-api'))return route.abort();
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'};
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
  const {action,params:p}=route.request().postDataJSON();calls.push({action,p});let data={};
  if(action==='request_access')data={active:true};
  else if(action==='me')data={role:'owner',name:'Тест',profile_id:'photo-fixture',active:true,status_permissions:{}};
  else if(action==='catalog')data={parts,services:[],staff:[],categories:[{name:'Тормоза'}],capabilities:{private_product_photos:true,atomic_writes:true}};
  else if(action==='part_photos')data=[{id:'old',path:'native:'+p.part_id,primary:true}];
  else if(['part_photo_url','signed_url'].includes(action))data={url:png};
  else if(action==='get')data={record,events:[],payments:[],linked:[]};
  else if(action==='list')data={items:[],count:0};
  else if(['part_photo_upload','upload'].includes(action)){
   uploads.push({action,p});if(hold)await hold;
   if(failNext||(failSecond&&p.file_name==='second.jpg')){failNext=false;failSecond=false;return route.fulfill({status:503,headers,json:{error:'Связь прервалась'}});}
   data={path:'native:'+p.request_id,photo_id:p.request_id};
   if(action==='upload'&&!record.fault_photo_paths.includes(data.path))record.fault_photo_paths.push(data.path);
  }
  return route.fulfill({json:{data},headers});
 });
 await page.goto(origin+'/workshop.html#stock');await page.locator('[data-product-photo="two"] img').waitFor();
 const source=await page.evaluate(async()=>{
  const c=document.createElement('canvas');c.width=4032;c.height=3024;const ctx=c.getContext('2d'),pixels=ctx.createImageData(c.width,c.height);let seed=17;
  for(let i=0;i<pixels.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;pixels.data[i]=seed&255;pixels.data[i+1]=(seed>>>8)&255;pixels.data[i+2]=(seed>>>16)&255;pixels.data[i+3]=255;}
  ctx.putImageData(pixels,0,0);return c.toDataURL('image/jpeg',.94).split(',')[1];
 });
 const file={name:'camera.jpg',mimeType:'image/jpeg',buffer:Buffer.from(source,'base64')};
 assert.ok(file.buffer.length>5*1024*1024);
 await page.locator('#stock-search input').fill('Несохранённый поиск');
 await page.evaluate(()=>{window.originalTable=document.querySelector('table.records');window.otherPhoto=document.querySelector('[data-product-photo="two"] img');});
 await page.locator('[data-product-photo="one"]').click();await page.locator('#part-photo-file').waitFor();
 let release;hold=new Promise(r=>release=r);const catalogBefore=calls.filter(x=>x.action==='catalog').length;
 assert.equal(await page.locator('#part-photo-camera').getAttribute('capture'),'environment');
 await page.locator('#part-photo-camera').setInputFiles(file);
 await page.waitForFunction(()=>document.querySelector('#part-photo-progress')?.textContent.includes('Отправляем'));
 assert.equal(await page.locator('#part-photo-upload').isDisabled(),true);
 await page.screenshot({path:path.join(root,'browser-results',kind+'-photo-progress.png')});
 while(!uploads.length)await page.waitForTimeout(20);
 const compressed=Buffer.from(uploads[0].p.content_base64,'base64');assert.ok(compressed.length<800*1024);assert.equal(uploads[0].p.content_type,'image/jpeg');
 release();hold=null;await page.locator('#inventory-dialog[open]').waitFor({state:'hidden'});
 assert.equal(await page.locator('[data-product-photo="one"] img').getAttribute('src').then(s=>s.startsWith('blob:')),true);
 assert.equal(await page.evaluate(()=>window.originalTable===document.querySelector('table.records')&&window.otherPhoto===document.querySelector('[data-product-photo="two"] img')),true);
 assert.equal(await page.locator('#stock-search input').inputValue(),'Несохранённый поиск');assert.equal(calls.filter(x=>x.action==='catalog').length,catalogBefore);
 // Failed upload stays open, keeps selection and reuses its durable request id.
 await page.locator('[data-product-photo="one"]').click();failNext=true;await page.locator('#part-photo-file').setInputFiles({...file,name:'retry.jpg'});
 await page.locator('#part-photo-progress[data-state="error"]').waitFor();assert.equal(await page.locator('#inventory-dialog').evaluate(e=>e.open),true);
 const failedId=uploads.at(-1).p.request_id;await page.locator('#part-photo-upload').click();await page.locator('#inventory-dialog[open]').waitFor({state:'hidden'});assert.equal(uploads.at(-1).p.request_id,failedId);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({browser:kind,originalBytes:file.buffer.length,uploadedBytes:compressed.length,reduction:Math.round((1-compressed.length/file.buffer.length)*100)+'%',stableCards:true,automaticClose:true,retryWithoutDuplicates:true}));
 await context.close();
}
(async()=>{
 fs.mkdirSync(path.join(root,'browser-results'),{recursive:true});
 const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(e,data)=>{res.writeHead(e?404:200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[path.extname(file)]||'application/octet-stream'});res.end(e?'Not found':data);});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{for(const kind of (process.env.FASTGO_PHOTO_BROWSERS||'chromium,webkit').split(',')){
  const options=process.env.FASTGO_CHROMIUM?{executablePath:process.env.FASTGO_CHROMIUM,args:require('/tmp/fastgo-print-render/node_modules/@sparticuz/chromium').args}:{};
  const browser=await playwright[kind].launch({headless:true,...(kind==='chromium'?options:{})});
  try{await check(browser,'http://127.0.0.1:'+server.address().port,kind);}finally{await browser.close();}
 }}finally{server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
