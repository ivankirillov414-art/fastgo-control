const {createServer}=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium,firefox,webkit}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=createServer((req,res)=>{
 const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');
 fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const kind=process.argv[2]||'chromium',browser=await ({chromium,firefox,webkit})[kind].launch();
 fs.mkdirSync('browser-results',{recursive:true});
 try{
 for(const role of ['developer','owner','receiver','admin','manager','mechanic']){
  const context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(()=>localStorage.setItem('fastgo_workshop_session',JSON.stringify({access_token:'fixture-only',user_id:'fixture',expires_at:4102444800})));
  const me={role,name:'Тестовый сотрудник',profile_id:'fixture',active:true,backend:'POSTGRES_GOOGLE_MIRROR'};
  const record={id:'test',repair_number:1,storage_number:1,status:'stored',revision:1,brand:'Тестовая техника',model:'Модель',last_name:'Тест',first_name:'Клиент',phone:'+70000000000',created_at:'2026-09-21',storage_amount:0,paid_amount:0,total_amount:0,fault_photo_paths:[],signed_document_paths:[],works:[],parts:[]};
  await page.route('**/*',async route=>{
   const req=route.request();if(req.url().startsWith(origin))return route.continue();
   if(req.url().includes('/functions/v1/fastgo-workshop-api')){
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'}});
    const {action}=req.postDataJSON();
    const data=({me,request_access:{active:true},catalog:{services:[{id:'s1',title:'Электрическая диагностика',labor_price:2000},{id:'s2',title:'Монтаж ручки',labor_price:400}],staff:[],parts:[],categories:[]},list:{count:1,items:[record]},get:{record,events:[],payments:[],linked:[],legal:{}},overview:{repairs:1,ready:0,overdue:0,storage:1,storage_due:0,debt:0,today_payments:0},legal:{legal_name:'Тест'},health:{capabilities:{}}})[action]||{};
    return route.fulfill({json:{data},headers:{'Access-Control-Allow-Origin':'*'}});
   }
   return route.abort();
  });
  for(const [width,height] of [[360,800],[768,1024],[1024,768],[1366,768],[1920,1080]]){
   await page.setViewportSize({width,height});await page.goto(origin+'/workshop.html#repairs');
   await page.locator('.records').waitFor();
   assert.equal(await page.locator('.topbar,#refresh-data').count(),0);
   assert.equal(await page.locator('.nav a[href="#settings"]').count(),['developer','owner'].includes(role)?1:0);
   const sizes=await page.evaluate(()=>({page:document.documentElement.scrollWidth,width:innerWidth,side:document.querySelector('.sidebar').scrollWidth,sideWidth:document.querySelector('.sidebar').clientWidth}));
   assert.ok(sizes.page<=sizes.width+1,JSON.stringify({kind,role,width,sizes}));
   if(width>760)assert.ok(sizes.side<=sizes.sideWidth+1,JSON.stringify(sizes));
   await page.locator('.view-switch a').filter({hasText:'Доска'}).click();await page.locator('.order-board').waitFor();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if(role==='owner')await page.screenshot({path:`browser-results/${kind}-${width}.png`,fullPage:true});
  }
  await page.goto(origin+'/workshop.html#catalog');await page.getByRole('heading',{name:'Электрические работы',exact:true}).waitFor();
  if(role!=='mechanic'){
   await page.goto(origin+'/workshop.html#order?kind=storage&id=test');await page.locator('#order-form').waitFor();
   assert.equal(await page.locator('#delete-storage').count(),['developer','owner','receiver'].includes(role)?1:0);
   assert.equal(await page.locator('#close-storage').count(),['developer','owner','receiver'].includes(role)?1:0);
  }
  if(role==='developer'){await page.goto(origin+'/workshop.html#account');await page.getByRole('heading',{name:'Аккаунт',exact:true}).waitFor();const body=(await page.locator('body').innerText()).toLowerCase();assert.equal(body.includes('developer'),false);assert.equal(body.includes('разработчик'),false);}
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS',kind,'five widths, six roles, table default, board, price groups, storage buttons');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
