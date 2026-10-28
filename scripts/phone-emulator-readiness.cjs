// Readiness retries only capture the emulator screen. They never reinstall the app.
async function waitForScreen(read,ready,{timeoutMs=90000,pollMs=500,now=Date.now,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 const deadline=now()+timeoutMs;let screen='',captures=0;
 while(now()<deadline){
  try{screen=await read();}
  catch(error){const detail=[error.message,error.stdout,error.stderr].join(' ');if(error.code!=='ETIMEDOUT'&&!/null root node/i.test(detail))throw error;captures++;await sleep(pollMs);continue;}
  if(ready(screen))return screen;
  await sleep(pollMs);
 }
 throw Object.assign(Error('Android screen did not become ready within '+timeoutMs+' ms'),{screen,captureErrors:captures});
}
module.exports={waitForScreen};
