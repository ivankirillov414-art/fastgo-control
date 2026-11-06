const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const adb=(...args)=>execFileSync('adb',args,{encoding:'utf8',timeout:45000}),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const valid=xml=>/^<\?xml\b[\s\S]*<hierarchy\b[\s\S]*<\/hierarchy>\s*$/.test(xml);
let captureId=Date.now();
async function dumpUi(file){
 assert(/^\/sdcard\/fastgo-[a-z0-9-]+\.xml$/.test(file),'Unexpected UI evidence path');
 let failure;
 for(let attempt=0;attempt<2;attempt++){
  // Remove the preceding capture: a killed dumper must never return a stale screen.
  const capture=file.replace(/\.xml$/,'-'+(++captureId)+'-'+attempt+'.xml');
  adb('shell','rm','-f',capture);let commandError;
  try{adb('shell','uiautomator','dump',capture);}catch(error){commandError=error;}
  let xml='';try{xml=adb('shell','cat',capture);}catch(error){failure=commandError||error;}
  try{adb('shell','rm','-f',capture);}catch{}
  if(commandError&&![137,null].includes(commandError.status))throw commandError;
  if(valid(xml)){
   if(commandError)console.warn('UI dumper exited after writing a fresh complete hierarchy; status='+commandError.status);
   return xml;
  }
  failure=commandError||failure||Error('UI dumper returned no complete hierarchy');
  if(attempt===0)await pause(700);
 }
 throw failure;
}
async function prepare(out){
 assert.equal(adb('shell','getprop','ro.kernel.qemu').trim(),'1','UI preparation is restricted to an emulator');
 fs.mkdirSync(out,{recursive:true});
 const readOptional=(...args)=>{try{return adb(...args).trim();}catch(error){return 'unavailable: '+String(error.stderr||error.message).slice(0,500);}};
 const properties=adb('shell','getprop');
 const bootEvidence={initialBootProperties:properties.split(/\r?\n/).filter(line=>/boot/i.test(line)),bootAnimationServiceListed:properties.includes('[init.svc.bootanim]:'),bootAnimationExit:readOptional('shell','getprop','service.bootanim.exit'),bootstat:readOptional('shell','bootstat','-p')};
 let booted=false;
 for(let i=0;i<60;i++){
  bootEvidence.completed=adb('shell','getprop','sys.boot_completed').trim();bootEvidence.animation=adb('shell','getprop','init.svc.bootanim').trim();bootEvidence.windowManager=readOptional('shell','wm','size');
  fs.writeFileSync(path.join(out,'preflight-boot.json'),JSON.stringify(bootEvidence,null,2));
  // -no-boot-anim images may have no bootanim service/property at all (API 36).
  // Boot completion, a working WM and two real stable hierarchies are still required.
  if(bootEvidence.completed==='1'&&(!bootEvidence.animation||bootEvidence.animation==='stopped')&&/Physical size: \d+x\d+/.test(bootEvidence.windowManager)){booted=true;break;}await pause(500);
 }
 assert(booted,'Android did not complete boot before the native scenario');
 adb('shell','input','keyevent','KEYCODE_WAKEUP');adb('shell','wm','dismiss-keyguard');
 let stable=0,recoveredLauncher=false;
 for(let i=0;i<8;i++){
  const xml=await dumpUi('/sdcard/fastgo-preflight.xml');fs.writeFileSync(path.join(out,'preflight-screen.xml'),xml);
  const anr=/\b(?:isn.t responding|is not responding)\b/i.test(xml);
  if(anr){
   fs.writeFileSync(path.join(out,'preflight-anr.xml'),xml);
   fs.writeFileSync(path.join(out,'preflight-anr-logcat.txt'),adb('logcat','-d','-t','400'));
   // Only the known emulator launcher may be recovered, once, before any app action.
   // FastGo, installer, permission and security failures remain scenario failures.
   assert(!recoveredLauncher&&/text="(?:Quickstep|Pixel Launcher|Launcher) (?:isn.t|is not) responding"/i.test(xml),'System is not ready: '+xml);
   const resolved=adb('shell','cmd','package','resolve-activity','--brief','-a','android.intent.action.MAIN','-c','android.intent.category.HOME').trim().split(/\r?\n/).at(-1).split('/')[0];
   assert(['com.android.launcher3','com.google.android.apps.nexuslauncher'].includes(resolved),'Unexpected launcher: '+resolved);
   adb('shell','am','force-stop',resolved);recoveredLauncher=true;stable=0;
  }else if(++stable===2){
   fs.writeFileSync(path.join(out,'preflight.json'),JSON.stringify({bootCompleted:true,keyguardDismissed:true,stableCaptures:stable,recoveredLauncher,applicationActionsRetried:0},null,2));return;
  }
  await pause(700);
 }
 throw Error('Emulator never reached a stable initial window');
}
module.exports={dumpUi,prepare};
if(require.main===module)prepare(path.resolve(process.argv[2]||'browser-results/android-preflight')).catch(error=>{console.error(error);process.exitCode=1;});
