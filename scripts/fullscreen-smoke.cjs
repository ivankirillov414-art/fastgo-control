// Run only in the isolated Electron CI fixtures, never against an installed profile.
const assert=require('node:assert/strict');
module.exports=async function fullscreenSmoke({app,page}){
 const state=()=>page.evaluate(()=>window.fastgoWindow.state());
 const wait=value=>page.waitForFunction(value=>document.body.classList.contains('fastgo-window-fullscreen')===value,value);
 assert.equal((await state()).fullscreen,false);
 await page.getByRole('button',{name:'Полный экран (F11)',exact:true}).click();await wait(true);assert.equal((await state()).fullscreen,true);
 assert.equal(await page.locator('.fastgo-window-frame button:visible').count(),3);
 await page.keyboard.press('Escape');await wait(false);assert.equal((await state()).fullscreen,false);
 await page.keyboard.press('F11');await wait(true);
 await page.evaluate(()=>{const d=document.createElement('dialog');d.id='fullscreen-smoke-dialog';d.innerHTML='<input value="Сохранить ввод">';document.body.append(d);d.showModal();});
 await page.keyboard.press('F11');await wait(false);assert.equal(await page.locator('#fullscreen-smoke-dialog').evaluate(d=>d.open),true);
 await page.keyboard.press('F11');await wait(true);assert.equal(await page.locator('#fullscreen-smoke-dialog').evaluate(d=>d.open),true);
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#fullscreen-smoke-dialog').open);assert.equal((await state()).fullscreen,true);
 assert.equal(await page.locator('#fullscreen-smoke-dialog input').inputValue(),'Сохранить ввод');await page.evaluate(()=>document.querySelector('#fullscreen-smoke-dialog').remove());
 await page.keyboard.press('Escape');await wait(false);
 await page.keyboard.press('F11');await wait(true);await page.getByRole('button',{name:'Вернуть окно',exact:true}).click();await wait(false);
 assert.equal(await page.locator('.fastgo-window-frame:visible').count(),0);assert.equal((await state()).fullscreen,false);
 const frame=await app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows().find(w=>/^fastgo:\/\/app\/(workshop|warehouse)\.html/.test(w.webContents.getURL()));return {minimizable:win.isMinimizable(),maximizable:win.isMaximizable(),closable:win.isClosable()};});
 assert.deepEqual(frame,{minimizable:true,maximizable:true,closable:true});
};
