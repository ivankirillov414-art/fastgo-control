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
 const {screen,nativeImage}=require('electron'),width=Math.ceil(widthMm*203/25.4),height=Math.ceil(heightMm*203/25.4),child=new BrowserWindow({show:false,parent,frame:false,useContentSize:true,webPreferences:{backgroundThrottling:false,sandbox:true,contextIsolation:true,nodeIntegration:false}});
 let timer;
 try{
  return await Promise.race([(async()=>{
   child.webContents.setWindowOpenHandler(()=>({action:'deny'}));child.webContents.on('will-navigate',e=>e.preventDefault());
   const scale=screen.getDisplayMatching(child.getBounds()).scaleFactor;
   child.setContentSize(Math.ceil((width+2)/scale),Math.ceil((height+2)/scale));
   await child.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));
   child.webContents.setZoomMode('isolated');child.webContents.setZoomFactor(203/96/scale);
   // Capture text through Chromium, but draw the validated SVG rectangles on
   // the final dot grid ourselves. Windows display zoom can otherwise filter
   // narrow bars through a fractional compositor scale, even with crispEdges.
   const bars=await child.webContents.executeJavaScript(`(()=>{const svg=document.querySelector('.label svg');if(!svg)throw Error('Missing barcode');const d=devicePixelRatio,result=[];for(const rect of svg.querySelectorAll('rect')){const style=getComputedStyle(rect),color=style.fill.match(/[\\d.]+/g)?.map(Number),matrix=rect.getScreenCTM();if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)<.5||Number(style.fillOpacity)<.5)continue;if(!color||color.length<3)throw Error('Invalid barcode ink');if((color[0]+color[1]+color[2])/3>=160)continue;if(!matrix||Math.abs(matrix.b)>.001||Math.abs(matrix.c)>.001)throw Error('Rotated barcode');const r=rect.getBoundingClientRect();result.push([r.left*d,r.top*d,r.right*d,r.bottom*d].map(Math.round));}svg.style.visibility='hidden';return result;})()`);
   await child.webContents.executeJavaScript('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
   const shot=await child.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});
   // Drop display-density metadata, then crop white edge padding. Never resize
   // or resample barcode modules to obtain the printer's exact dot dimensions.
   const image=nativeImage.createFromBuffer(shot.toPNG({scaleFactor:1})),actual=image.getSize(1);
   if(actual.width<width||actual.height<height)throw Error('Неполный растр PC-365; печать остановлена');
   const cropped=image.crop({x:0,y:0,width,height}),pixels=cropped.toBitmap({scaleFactor:1});
   if(!Array.isArray(bars)||bars.length<10)throw Error('Неполный штрихкод PC-365');
   for(const [left,top,right,bottom]of bars){if(left<0||top<0||right>width||bottom>height||right<=left||bottom<=top)throw Error('Штрихкод вышел за край этикетки');for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){const i=(y*width+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=0;pixels[i+3]=255;}}
   monochrome(pixels,width,height);
   return {pixels,width,height,png:nativeImage.createFromBitmap(pixels,{width,height,scaleFactor:1}).toPNG()};
  })(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Не удалось подготовить растр PC-365 за 15 секунд')),15000);})]);
 }finally{clearTimeout(timer);if(!child.isDestroyed())child.destroy();}
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
