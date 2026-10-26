const {chromium,firefox,webkit}=require('playwright'),assert=require('node:assert/strict');
const {serve}=require('./warehouse-browser-fixture.cjs');
(async()=>{const {server,base}=await serve(),kind=process.argv[2]||'chromium',browser=await ({chromium,firefox,webkit})[kind].launch();try{
 for(const mode of ['unbound-android','bound-android','bound-iphone','expired']){
  const iphone=mode==='bound-iphone',context=await browser.newContext({viewport:{width:390,height:844},userAgent:iphone?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1':'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'});let sent=0,changed=0,logout=0;
  await context.route('https://**/*',async route=>{const req=route.request(),headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,PUT,OPTIONS'};if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});const p=req.postDataJSON()||{};
   if(req.url().includes('/auth/v1/recover')){sent++;assert.equal(p.email,'recovery@example.invalid');return route.fulfill({headers,json:{}});}
   if(req.url().endsWith('/auth/v1/user')){assert.equal(req.method(),'PUT');assert.equal(req.headers().authorization,'Bearer recovery-fixture');assert.equal(p.password,'Fixture-password-42');changed++;return route.fulfill({headers,json:{id:'fixture'}});}
   if(req.url().includes('/auth/v1/logout')){logout++;return route.fulfill({status:204,headers});}
   if(req.url().includes('/functions/v1/fastgo-workshop-api')){const {action}=p;if(mode==='expired'&&action==='me')return route.fulfill({status:401,headers,json:{error:'expired'}});let data={};if(action==='me')data={profile_id:'fixture',name:'Сотрудник',email:'recovery@example.invalid',role:'owner'};if(action==='owner_device_status')data={registered:mode!=='unbound-android',trusted:iphone};return route.fulfill({headers,json:{data}});}
   return route.abort();
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/workshop.html');await page.getByRole('button',{name:'Забыли пароль?'}).click();await page.locator('#f-recovery_email').fill('recovery@example.invalid');await page.getByRole('button',{name:'Отправить письмо',exact:true}).click();await page.getByText('письмо со ссылкой отправлено',{exact:false}).waitFor();assert.equal(await page.locator('#recovery-code').count(),0);assert.equal(sent,1);
  await page.goto(base+'/workshop.html#type=recovery&access_token=recovery-fixture');
  if(mode==='bound-android'){await page.getByText('Восстановление этой учётной записи доступно на её доверенном iPhone.',{exact:true}).waitFor();assert.equal(changed,0);}
  else if(mode==='expired'){await page.getByText('Подтверждение восстановления недействительно или истекло.',{exact:false}).waitFor();assert.equal(changed,0);}
  else{await page.locator('#f-new_password').fill('Fixture-password-42');await page.locator('#f-confirm_password').fill('Fixture-password-43');await page.getByRole('button',{name:'Сохранить новый пароль'}).click();await page.getByText('Пароли не совпадают',{exact:true}).waitFor();assert.equal(changed,0);await page.locator('#f-confirm_password').fill('Fixture-password-42');await page.getByRole('button',{name:'Сохранить новый пароль'}).click();await page.getByText('Пароль изменён. Войдите с новым паролем.',{exact:true}).waitFor();assert.equal(changed,1);assert.equal(logout,1);}
  assert.equal(await page.evaluate(()=>JSON.stringify(localStorage).includes('recovery-fixture')||JSON.stringify(localStorage).includes('Fixture-password-42')),false);assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS '+kind+': email link, no OTP prompt, unbound owner Android recovery, bound iPhone restriction, expired link, matching passwords and no stored recovery credentials');
 }finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
