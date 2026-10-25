const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {serve,backend,scan,launchOptions,part}=require('./warehouse-browser-fixture.cjs');
(async()=>{const {server,base}=await serve(),browser=await chromium.launch(launchOptions);try{
 for(const unified of [false,true]){
  const fixture=backend(),tc=await browser.newContext(),dc=await browser.newContext({viewport:{width:1280,height:850}});await fixture.connect(tc,true);await fixture.connect(dc,false,{unified});
  const terminal=await tc.newPage(),laptop=await dc.newPage(),errors=[];for(const page of [terminal,laptop]){page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));}laptop.on('dialog',d=>d.accept());
  await Promise.all([terminal.goto(base+'/warehouse-terminal.html'),laptop.goto(base+(unified?'/workshop.html#stock':'/warehouse.html'))]);await laptop.locator('#inventory').waitFor();
  await terminal.locator('#pay').click();await scan(terminal);await laptop.locator('#live-cancel').waitFor();fixture.state.failCancelResponse=true;await laptop.getByRole('button',{name:'Отменить оплату',exact:true}).click();await laptop.locator('#receipt').waitFor();await terminal.locator('#pay').waitFor();assert.equal(fixture.payments.length,0);assert([...fixture.jobs.values()].every(j=>j.state==='done'&&j.result.cancelled));
  await terminal.locator('#repair-scan').click();await scan(terminal,'https://ivankirillov414-art.github.io/fastgo-control/workshop.html#order?kind=repair&id='+fixture.quote.id);await laptop.locator('#repair-cancel').waitFor();await laptop.locator('#repair-total-edit').click();await laptop.getByLabel('Стоимость ремонта',{exact:true}).fill('700');fixture.state.failCancelResponse=true;await laptop.getByRole('button',{name:'Отменить оплату',exact:true}).click();await laptop.locator('#receipt').waitFor();await terminal.locator('#pay').waitFor();assert.equal(fixture.quote.total,1500);assert.equal(fixture.quote.paid,500);assert.equal(fixture.payments.length,0);
  const legacy={id:'99999999-9999-4999-8999-999999999999',state:'queued',payload:{kind:'sale',items:[{part_id:part,quantity:1}]},created_at:new Date().toISOString()};fixture.jobs.set(legacy.id,legacy);await laptop.locator('#checkout-cancel').waitFor();await laptop.getByRole('button',{name:'Отменить оплату',exact:true}).click();await laptop.locator('#receipt').waitFor();assert.equal(legacy.result.cancelled,true);assert.equal(fixture.payments.length,0);
  await laptop.reload();await laptop.locator(unified?'#stock-list':'#receipt').waitFor();assert.equal(await laptop.locator('#repair-pay,#live-submit,#checkout').count(),0);assert.deepEqual(errors,[]);
  await tc.close();await dc.close();
 }
 console.log('PASS: standalone and unified laptop cancel TSD sales, repair payments and legacy baskets; lost responses recover, no payment is written, terminal and reload stay closed');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
