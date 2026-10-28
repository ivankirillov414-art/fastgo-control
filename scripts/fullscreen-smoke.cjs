// Run only in the isolated Electron CI fixtures, never against an installed profile.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async function fullscreenSmoke({app,page}){
 let stage='initial';
 await app.evaluate(({BrowserWindow})=>{
  const win=BrowserWindow.getAllWindows().find(w=>/^fastgo:\/\/app\/(workshop|warehouse)\.html/.test(w.webContents.getURL())),trace={initial:{visible:win.isVisible(),focused:win.isFocused(),contentsFocused:win.webContents.isFocused(),fullscreen:win.isFullScreen(),backgroundArgument:process.argv.includes('--background')},events:[],listeners:[],nativeF11KeyDown:0};
  const record=value=>{trace.events.push({time:Date.now(),...value});if(trace.events.length>80)trace.events.shift();};
  const listen=(emitter,name,listener)=>{emitter.on(name,listener);trace.listeners.push([emitter,name,listener]);};
  for(const event of ['focus','blur','enter-full-screen','leave-full-screen','maximize','unmaximize'])listen(win,event,()=>record({event,fullscreen:win.isFullScreen(),focused:win.isFocused(),contentsFocused:win.webContents.isFocused()}));
  listen(win.webContents,'before-input-event',(_event,input)=>{if(input.key==='F11'&&input.type==='keyDown')trace.nativeF11KeyDown++;if(['F11','Escape'].includes(input.key))record({event:'before-input-event',type:input.type,key:input.key,code:input.code,repeat:input.isAutoRepeat,control:input.control,alt:input.alt,meta:input.meta,fullscreen:win.isFullScreen(),focused:win.isFocused(),contentsFocused:win.webContents.isFocused()});});
  listen(win.webContents,'input-event',(_event,input)=>{if(['F11','Escape'].includes(input.key)||/key/i.test(input.type))record({event:'input-event',type:input.type,key:input.key,code:input.code,repeat:input.isAutoRepeat});});
  globalThis.fastgoFullscreenTrace=trace;
 });
 await page.evaluate(()=>{
  const trace={events:[],listeners:[]},record=value=>{trace.events.push({time:Date.now(),...value});if(trace.events.length>80)trace.events.shift();};
  for(const type of ['keydown','keyup','focusin','focusout']){const listener=event=>{if(!event.key||['F11','Escape'].includes(event.key))record({event:type,key:event.key,code:event.code,repeat:event.repeat,target:event.target?.id||event.target?.tagName,focused:document.hasFocus(),fullscreen:document.body.classList.contains('fastgo-window-fullscreen')});};document.addEventListener(type,listener,true);trace.listeners.push([type,listener]);}
  window.fastgoFullscreenTrace=trace;
 });
 try{
 const state=()=>page.evaluate(()=>window.fastgoWindow.state());
 const wait=value=>page.waitForFunction(value=>document.body.classList.contains('fastgo-window-fullscreen')===value,value);
 const focusFixture=async()=>{
  await app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows().find(w=>/^fastgo:\/\/app\/(workshop|warehouse)\.html/.test(w.webContents.getURL()));win.show();win.focus();win.webContents.focus();});
  await page.waitForFunction(()=>document.hasFocus());
  const focus=await app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows().find(w=>/^fastgo:\/\/app\/(workshop|warehouse)\.html/.test(w.webContents.getURL()));return {visible:win.isVisible(),focused:win.isFocused(),contentsFocused:win.webContents.isFocused()};});
  assert.deepEqual(focus,{visible:true,focused:true,contentsFocused:true});
 };
 // CDP Input.dispatchKeyEvent skips Electron's native before-input-event hook.
 // Exercise that hook with native input on this isolated, focused fixture window.
 const nativeF11=async()=>{await focusFixture();await app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows().find(w=>/^fastgo:\/\/app\/(workshop|warehouse)\.html/.test(w.webContents.getURL()));win.webContents.sendInputEvent({type:'keyDown',keyCode:'F11'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'F11'});});};
 stage='fixture-visible-focused';await focusFixture();
 stage='startup-fullscreen';await wait(true);assert.equal((await state()).fullscreen,true);
 stage='startup-Escape-exit';await page.keyboard.press('Escape');await wait(false);
 assert.equal((await state()).fullscreen,false);
 stage='button-enter';
 await page.getByRole('button',{name:'Полный экран (F11)',exact:true}).click();await wait(true);assert.equal((await state()).fullscreen,true);
 assert.equal(await page.locator('.fastgo-window-frame button:visible').count(),3);
 stage='Escape-exit';
 await page.keyboard.press('Escape');await wait(false);assert.equal((await state()).fullscreen,false);
 stage='F11-reenter-after-Escape';
 await nativeF11();await wait(true);
 await page.evaluate(()=>{const d=document.createElement('dialog');d.id='fullscreen-smoke-dialog';d.innerHTML='<input value="Сохранить ввод">';document.body.append(d);d.showModal();});
 stage='modal-F11-exit';
 await nativeF11();await wait(false);assert.equal(await page.locator('#fullscreen-smoke-dialog').evaluate(d=>d.open),true);
 stage='modal-F11-enter';
 await nativeF11();await wait(true);assert.equal(await page.locator('#fullscreen-smoke-dialog').evaluate(d=>d.open),true);
 stage='modal-Escape-close';
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#fullscreen-smoke-dialog').open);assert.equal((await state()).fullscreen,true);
 assert.equal(await page.locator('#fullscreen-smoke-dialog input').inputValue(),'Сохранить ввод');await page.evaluate(()=>document.querySelector('#fullscreen-smoke-dialog').remove());
 stage='Escape-after-modal';
 await page.keyboard.press('Escape');await wait(false);
 stage='F11-then-restore-window';
 await nativeF11();await wait(true);await page.getByRole('button',{name:'Вернуть окно',exact:true}).click();await wait(false);
 assert.equal(await page.locator('.fastgo-window-frame:visible').count(),0);assert.equal((await state()).fullscreen,false);
 const frame=await app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows().find(w=>/^fastgo:\/\/app\/(workshop|warehouse)\.html/.test(w.webContents.getURL()));return {minimizable:win.isMinimizable(),maximizable:win.isMaximizable(),closable:win.isClosable()};});
 assert.deepEqual(frame,{minimizable:true,maximizable:true,closable:true});
 assert.equal(await app.evaluate(()=>globalThis.fastgoFullscreenTrace.nativeF11KeyDown),4,'Every F11 press must reach the native Electron keyboard hook');
 }catch(error){
  const output=path.resolve(__dirname,'../desktop/test-results');fs.mkdirSync(output,{recursive:true});
  const kind=page.url().includes('warehouse.html')?'warehouse':'common',report={stage,url:page.url(),error:error.message};
  try{report.native=await app.evaluate(({app,BrowserWindow})=>{const win=BrowserWindow.getAllWindows().find(w=>/^fastgo:\/\/app\/(workshop|warehouse)\.html/.test(w.webContents.getURL()));return {fullscreen:win.isFullScreen(),focused:win.isFocused(),contentsFocused:win.webContents.isFocused(),visible:win.isVisible(),bounds:win.getBounds(),focusedWindowId:BrowserWindow.getFocusedWindow()?.id||null,windowId:win.id,initial:globalThis.fastgoFullscreenTrace?.initial,nativeF11KeyDown:globalThis.fastgoFullscreenTrace?.nativeF11KeyDown,events:globalThis.fastgoFullscreenTrace?.events||[]};});}catch{report.native={unavailable:true};}
  try{report.renderer=await page.evaluate(async()=>({fullscreenClass:document.body.classList.contains('fastgo-window-fullscreen'),focused:document.hasFocus(),activeElement:document.activeElement?.id||document.activeElement?.tagName,nativeState:await window.fastgoWindow.state(),events:window.fastgoFullscreenTrace?.events||[],controls:[...document.querySelectorAll('[data-window-action]')].map(el=>({action:el.dataset.windowAction,pressed:el.getAttribute('aria-pressed'),box:el.getBoundingClientRect().toJSON()}))}));}catch{report.renderer={unavailable:true};}
  fs.writeFileSync(path.join(output,'fullscreen-failure-'+kind+'.json'),JSON.stringify(report,null,2));console.error('FULLSCREEN_DIAGNOSTICS '+JSON.stringify(report));
  try{await page.screenshot({path:path.join(output,'fullscreen-failure-'+kind+'.png'),timeout:5000});}catch{}
  throw error;
 }finally{
  await app.evaluate(()=>{for(const [emitter,name,listener]of globalThis.fastgoFullscreenTrace?.listeners||[])emitter.removeListener(name,listener);delete globalThis.fastgoFullscreenTrace;}).catch(()=>{});
  await page.evaluate(()=>{for(const [type,listener]of window.fastgoFullscreenTrace?.listeners||[])document.removeEventListener(type,listener,true);delete window.fastgoFullscreenTrace;}).catch(()=>{});
 }
};
