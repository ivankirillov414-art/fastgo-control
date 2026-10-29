const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const {labelSize}=require('./printer-profiles.cjs'),{isPC365}=require('./pc365-setup.cjs'),{atomicWrite}=require('./backup-replica.cjs');
function monochrome(pixels,width,height){
 if(!Buffer.isBuffer(pixels)||pixels.length!==width*height*4)throw Error('Неполный растр этикетки');
 const rowBytes=Math.ceil(width/8),data=Buffer.alloc(rowBytes*height,255);let black=0;
 // TSPL BITMAP uses zero for ink. Keep byte padding and quiet zones white.
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;if(pixels[i+3]>127&&(pixels[i]+pixels[i+1]+pixels[i+2])/3<160){data[y*rowBytes+(x>>3)]&=~(128>>(x&7));black++;}}
 if(black<50)throw Error('Получилась пустая этикетка; печать остановлена');
 return {data,rowBytes};
}
function packet({widthMm,heightMm,quantity,pixels,width,height}){
 const size=labelSize({widthMm,heightMm});if(!Number.isInteger(quantity)||quantity<1||quantity>1000||width!==Math.ceil(size.widthMm*203/25.4)||height!==Math.ceil(size.heightMm*203/25.4))throw Error('Неверный размер растра PC-365');
 const {data,rowBytes}=monochrome(pixels,width,height);
 // No Windows pages and no GAP 0 command: each copy follows the calibrated
 // hardware gap, including copies 6, 7 and the end of a long roll batch.
 return Buffer.concat([Buffer.from('SIZE '+size.widthMm.toFixed(1)+' mm,'+size.heightMm.toFixed(1)+' mm\r\nGAPDETECT\r\nREFERENCE 0,0\r\nOFFSET 0 mm\r\nHOME\r\nCLS\r\nBITMAP 0,0,'+rowBytes+','+height+',0,','ascii'),data,Buffer.from('\r\nPRINT 1,'+quantity+'\r\n','ascii')]);
}
async function render({BrowserWindow,parent,html,widthMm,heightMm}){
 const scale=203/96,width=Math.ceil(widthMm*203/25.4),height=Math.ceil(heightMm*203/25.4),child=new BrowserWindow({show:false,parent,webPreferences:{backgroundThrottling:false,sandbox:true,contextIsolation:true,nodeIntegration:false,javascript:false}});
 try{
  child.webContents.setWindowOpenHandler(()=>({action:'deny'}));child.webContents.on('will-navigate',e=>e.preventDefault());
  child.webContents.debugger.attach('1.3');
  await child.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride',{width:Math.ceil(width/scale),height:Math.ceil(height/scale),deviceScaleFactor:scale,mobile:false});
  await child.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));
  const capture=await child.webContents.debugger.sendCommand('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:true,clip:{x:0,y:0,width:width/scale,height:height/scale,scale:1}});
  const png=Buffer.from(capture.data,'base64'),image=require('electron').nativeImage.createFromBuffer(png),actual=image.getSize(1);
  if(actual.width!==width||actual.height!==height)throw Error('Масштаб растра PC-365 отличается от 203 dpi; печать остановлена');
  const pixels=image.toBitmap({scaleFactor:1});monochrome(pixels,width,height);
  return {pixels,width,height,png};
 }finally{if(!child.isDestroyed())child.destroy();}
}
class PC365Raster{
 constructor({dir,BrowserWindow,enabled=true,platform=process.platform,run=promisify(execFile),renderRaster=render}){Object.assign(this,{dir,BrowserWindow,run,renderRaster});this.enabled=enabled&&platform==='win32';}
 async print({parent,html,deviceName,widthMm,heightMm,quantity,prepare=async()=>{},beforeSubmit=()=>{}}){
  if(!this.enabled||!isPC365({name:deviceName}))throw Error('Нативная печать доступна только для PC-365 в Windows');
  const bitmap=await this.renderRaster({BrowserWindow:this.BrowserWindow,parent,html,widthMm,heightMm}),bytes=packet({...bitmap,widthMm,heightMm,quantity});
  fs.mkdirSync(this.dir,{recursive:true});const file=path.join(this.dir,'label-'+crypto.randomUUID()+'.bin'),helper=path.join(this.dir,'pc365-media.ps1');
  atomicWrite(file,bytes);atomicWrite(helper,fs.readFileSync(path.join(__dirname,'pc365-media.ps1')));
  try{
   await prepare();
   beforeSubmit();let response;
   try{const {stdout}=await this.run(path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helper,'-PrinterName',deviceName,'-WidthMm',String(widthMm),'-HeightMm',String(heightMm),'-Mode','Print','-DataFile',file],{windowsHide:true,timeout:45000,maxBuffer:32768,encoding:'utf8'});response=JSON.parse(stdout.replace(/^\uFEFF/,'').trim());}
   catch(e){let result;try{result=JSON.parse(String(e.stdout||'').replace(/^\uFEFF/,'').trim());}catch{}throw Object.assign(Error(result?.message||'Передача PC-365 прервалась. Проверьте принтер перед повторной печатью.'),{notSubmitted:result?.may_have_submitted===false});}
   if(response.status!=='submitted'||!Number.isSafeInteger(response.job_id)||response.job_id<1)throw Error('PC-365 не подтвердил передачу. Проверьте печать перед повтором.');
   try{atomicWrite(path.join(this.dir,'media.json'),Buffer.from(JSON.stringify({mode:'tspl-gap',widthMm,heightMm,quantity,deviceName,job_id:response.job_id,windows_media:response.windows_media||null,submitted_at:new Date().toISOString(),physical_result_verified:false})));}catch{}
   return {printed:true,deviceName,transport:'tspl-gap',job_id:response.job_id};
  }finally{try{fs.unlinkSync(file);}catch{}}
 }
}
module.exports={PC365Raster,render,packet,monochrome};
