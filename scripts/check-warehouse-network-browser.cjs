const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:820,height:800}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   window.networkCalls={probe:0,save:0};const state={online:true,busy:false,sampled_at:'2026-10-24T11:30:00Z',local:{wifi:[{ssid:'<img src=x onerror="window.injected=true">',signal_percent:28,receive_mbps:72}],adapters:[{name:'Wi-Fi',status:'Up',link_speed:'72 Mbps',ipv4:['192.0.2.10']}],gateway_ping:{status:'no_reply'},warnings:[]},download:{status:'downloading',transferred:4*1048576,bytes_per_second:262144,stalled_seconds:50},probes:{api:{reachable:true,ok:true,status:204,elapsed_ms:125},feed:{reachable:true,ok:true,status:200,elapsed_ms:225},download:{reachable:false,ok:false,error:'timeout'},dns:{ok:true}},history:[{kind:'wifi_disconnected',at:'2026-10-24T11:20:00Z',reason:'test fixture'}],conclusions:[{level:'warning',message:'Слабый сигнал Wi‑Fi; загрузка ждёт восстановления связи.'}]};
   window.fastgoNetwork={status:async()=>state,probe:async()=>{window.networkCalls.probe++;await new Promise(r=>setTimeout(r,75));return state;},save:async()=>{window.networkCalls.save++;return {saved:true};}};
  });
  await page.goto(pathToFileURL(path.resolve(__dirname,'../warehouse-desktop/network.html')).href);
  await page.locator('#wifi').getByText('28%',{exact:true}).waitFor();assert.equal(await page.locator('#wifi img').count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);
  assert((await page.locator('#download').innerText()).includes('0,25 МБ/с'));assert((await page.locator('#probes').innerText()).includes('превышено время ожидания'));assert((await page.locator('#gateway').innerText()).includes('Не ответил на ping'));
  await page.getByRole('button',{name:'Проверить сеть',exact:true}).click();await page.waitForFunction(()=>!document.getElementById('probe').disabled);await page.getByRole('button',{name:'Сохранить отчёт',exact:true}).click();await page.getByText('Отчёт сохранён',{exact:true}).waitFor();assert.deepEqual(await page.evaluate(()=>window.networkCalls),{probe:1,save:1});
  const out=path.resolve(__dirname,'../warehouse-desktop/test-results');fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'network-diagnostics.png'),fullPage:true});
  for(const width of [600,360]){await page.setViewportSize({width,height:800});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Diagnostics must not overflow horizontally');}
  assert.deepEqual(errors,[]);console.log('PASS: network diagnostics shows real-rate units, weak Wi-Fi, file timeouts and history; safe text, report actions and responsive layout');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
