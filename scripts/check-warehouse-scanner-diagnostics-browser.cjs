const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {serve,launchOptions}=require('./warehouse-browser-fixture.cjs');
(async()=>{const {server,base}=await serve();let browser;try{
 browser=await chromium.launch(launchOptions);const page=await browser.newPage();
 await page.goto(base+'/warehouse.html');
 await page.evaluate(async()=>{
  document.body.innerHTML='<header></header>';window.scanReports=[];
  window.warehouseDesktop={scannerStatus:async()=>({devices:[{name:'АТОЛ',kind:'Keyboard',status:'OK',hardware:'HID\\VID_2AAF&PID_C001'}]})};
  const {installScannerDiagnostics}=await import('./warehouse/scanner-diagnostics.js');
  installScannerDiagnostics({parts:()=>[{id:'part-1',barcode:'FGP-00000036',name:'Амортизатор'}],report:async value=>window.scanReports.push(value)});
 });
 await page.locator('#hardware-scanner').click();await page.getByText('АТОЛ',{exact:true}).waitFor();
 const input=page.locator('[data-scan]'),result=page.locator('[data-result]');
 for(const [code,suffix] of [['FGP-00000036','Enter'],['ъС0АПЗ-00000036','Tab'],[']C0FGP-00000036',''],['FGP-00000036','Enter']]){
  const before=await page.evaluate(()=>scanReports.filter(x=>x.scan_test).length);
  await input.focus();await page.keyboard.insertText(code);if(suffix)await page.keyboard.press(suffix);
  await page.waitForFunction(n=>scanReports.filter(x=>x.scan_test).length===n+1,before);
  assert.match(await result.innerText(),/Амортизатор/);assert.equal(await input.inputValue(),'');
  await page.waitForTimeout(260);assert.equal(await page.evaluate(()=>scanReports.filter(x=>x.scan_test).length),before+1);
 }
 await input.fill('UNKNOWN-000000');await page.keyboard.press('Enter');await page.waitForFunction(()=>scanReports.filter(x=>x.scan_test).length===5);
 assert.match(await result.innerText(),/совпадений в каталоге: 0/);
 await input.fill('FGP-00000036');await page.locator('[data-close]').click();await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>scanReports.filter(x=>x.scan_test).length),5,'closing cancels delayed scan');
 await page.locator('#hardware-scanner').click();await input.fill('FGP-00000036');await page.keyboard.press('Enter');
 await page.waitForFunction(()=>scanReports.filter(x=>x.scan_test).length===6);
 const reports=await page.evaluate(()=>scanReports.filter(x=>x.scan_test));assert.equal(reports.filter(x=>x.scan_test.matched).length,5);
 assert(reports.every(x=>!JSON.stringify(x).includes('FGP-')&&!JSON.stringify(x).includes('АПЗ')),'diagnostics do not store raw labels');
 console.log('PASS: ATOL diagnostic repeated labels, Russian layout, AIM, Enter/Tab/no suffix, no duplicates, unknown label, close/reopen, no raw-code reporting');
 }finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
