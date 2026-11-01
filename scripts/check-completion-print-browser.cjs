const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{PDFDocument}=require('pdf-lib'),fixtures=require('../desktop/tests/print-fixtures.cjs');
const root=path.resolve(__dirname,'../desktop/web'),output=path.resolve(process.env.FASTGO_PRINT_OUTPUT||'browser-results/completion-print');fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{const name=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!name.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{const ext=path.extname(name);res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png'})[ext]||'application/octet-stream');res.end(fs.readFileSync(name));}catch{res.writeHead(404).end();}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true});try{
 for(const [name,base] of Object.entries(fixtures).filter(([name])=>['short','long'].includes(name))){
  for(const purpose of ['completion','master']){
   const page=await browser.newPage({viewport:{width:1100,height:1400}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
   const record={...base,status:'issued',paid_amount:base.total_amount,step_state:{completion_master_name:'Алексей',completion_at:'2026-11-01T10:00:00Z'}};
   await page.addInitScript(({record,purpose})=>{window.fastgoDesktop={getSession:async()=>({access_token:'fixture',expires_at:4102444800}),state:async()=>({online:true}),request:async()=>({data:{record,legal:{}}}),printContext:async()=>({kind:'repair',id:record.id,document_type:purpose,me:{role:'owner'}}),printReady:async()=>{document.documentElement.dataset.printReady='yes';}};},{record,purpose});
   await page.goto(origin+'/document-host.html');await page.waitForFunction(()=>document.documentElement.dataset.printReady==='yes');
   assert.equal(await page.locator('h1').innerText(),'АКТ ВЫПОЛНЕННЫХ РАБОТ');assert.equal(await page.locator('[data-completion-master]').innerText(),'Алексей');
   assert.equal(await page.locator('tbody tr').count(),record.works.length+record.parts.length);
   const bytes=await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true}),pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),1,name+' '+purpose+' must fit A4');
   fs.writeFileSync(path.join(output,name+'-'+purpose+'.pdf'),bytes);if(name==='long'&&purpose==='completion')await page.screenshot({path:path.join(output,'completion-preview.png'),fullPage:true});
   assert.deepEqual(errors,[]);console.log('PASS: '+name+' '+purpose+' — production renderer, completed act, all rows, one A4');await page.close();
  }
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
