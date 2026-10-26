const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {serve,launchOptions}=require('./warehouse-browser-fixture.cjs');
const {chromium}=require(process.env.FASTGO_PLAYWRIGHT?path.join(process.env.FASTGO_PLAYWRIGHT,'node_modules/playwright'):'playwright');
const out=path.resolve(__dirname,'../../../outputs/fastgo-part-card-options');fs.mkdirSync(out,{recursive:true});
(async()=>{const {server,base}=await serve(),browser=await chromium.launch(launchOptions);try{
 const page=await browser.newPage({viewport:{width:1280,height:1060},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/design/part-card-options.html');await page.locator('image').first().waitFor();
 for(let i=1;i<=5;i++){
  await page.locator('nav button').nth(i-1).click();await page.locator('article').screenshot({path:path.join(out,'variant-'+i+'.png')});
  assert.ok(await page.locator('.hero').evaluate(e=>e.clientWidth>=350&&e.clientHeight>=250));
  await page.getByRole('button',{name:'⤢ Увеличить'}).click();assert.ok(await page.locator('.overlay').isVisible());await page.keyboard.press('Escape');
  await page.setViewportSize({width:850,height:850});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow on a small laptop');await page.setViewportSize({width:1280,height:1060});
 }
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 for(const file of ['part-card-options.html','part-card-reference.jpg'])fs.copyFileSync(path.resolve(__dirname,'../design',file),path.join(out,file));
 await page.setViewportSize({width:1540,height:900});
 await page.route('**/variant-*.png',async route=>{await route.fulfill({path:path.join(out,new URL(route.request().url()).pathname.split('/').pop())});});
 await page.setContent('<html lang="ru"><meta charset="utf-8"><style>body{margin:0;padding:24px;background:#08131f;color:#edf4ff;font:24px system-ui}h1{font-size:30px;margin:0 0 20px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0;border:1px solid #294960;border-radius:10px;overflow:hidden}figcaption{padding:12px;font-size:20px;background:#153149}img{display:block;width:100%}</style><h1>FastGo Склад · пять вариантов карточки запчасти</h1><div class="grid">'+['Фото слева','Фото сверху','Фото справа','Компактный','Фото на первом плане'].map((s,i)=>'<figure><figcaption>'+(i+1)+'. '+s+'</figcaption><img src="'+base+'/variant-'+(i+1)+'.png"></figure>').join('')+'</div></html>');
 await page.locator('img').last().evaluate(img=>img.decode());await page.screenshot({path:path.join(out,'five-variants.png'),fullPage:true});console.log('PASS: five desktop layouts, enlargement, 850px laptop and mobile sizing; previews: '+out);
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
