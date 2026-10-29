const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {barcodePrintHTML}=require('../warehouse-desktop/barcode-print.cjs');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const context=await browser.newContext({deviceScaleFactor:203/96,viewport:{width:700,height:800},bypassCSP:true}),page=await context.newPage(),decoder=await context.newPage();
 await decoder.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../vendor/jsbarcode-3.12.3.min.js'),'utf8')});await decoder.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../vendor/zxing-browser-0.2.1.min.js'),'utf8')});
 const barcode='FGP-00000082',svg=await decoder.evaluate(code=>{const s=document.createElementNS('http://www.w3.org/2000/svg','svg');JsBarcode(s,code,{format:'CODE128',displayValue:false,width:2,height:72,margin:0,marginLeft:20,marginRight:20});return s.outerHTML;},barcode);
 fs.mkdirSync('browser-results',{recursive:true});
 for(const details of [{model:'0',sku:'FG-5683962873E4'},{sku:'FG-5683962873E4'},{model:'Размер изделия с длинным описанием'}]){
  const p={name:'Диск',barcode,price:2500,quantity:12,format:'label',deviceName:'4BARCODE 3B-365B',widthMm:58,heightMm:27,svg,...details};await page.setContent(barcodePrintHTML(p));
  const boxes=await page.locator('.label').evaluateAll(labels=>labels.map(label=>{const r=label.getBoundingClientRect(),title=label.querySelector('.label-heading').getBoundingClientRect(),meta=label.querySelector('.label-details').getBoundingClientRect(),bars=label.querySelector('svg').getBoundingClientRect(),caption=label.querySelector('small').getBoundingClientRect(),mm=25.4/96;return {top:r.top,height:r.height,head:(title.top-r.top)*mm,end:(caption.bottom-r.top)*mm,metadataBottom:meta.bottom,barTop:bars.top,barBottom:bars.bottom,captionTop:caption.top};}));
  assert.equal(boxes.length,12);for(let i=0;i<boxes.length;i++){const b=boxes[i];assert(b.head>=3.99,JSON.stringify(b));assert(b.end<=23.01,JSON.stringify(b));assert(b.metadataBottom<b.barTop);assert(b.barBottom<b.captionTop);if(i)assert(Math.abs(b.top-boxes[i-1].top-27*96/25.4)<.05);}
  const raster=(await page.locator('.label svg').first().screenshot()).toString('base64');assert.equal(await decoder.evaluate(async raw=>(await new ZXingBrowser.BrowserMultiFormatReader().decodeFromImageUrl('data:image/png;base64,'+raw)).getText(),raster),barcode);
  const suffix=details.model&&details.sku?'photo':details.model?'model':'sku';await page.locator('.label').first().screenshot({path:'browser-results/pc365-58x27-'+suffix+'-fixed.png'});const pdf=await page.pdf({path:'browser-results/pc365-58x27-'+suffix+'-fixed.pdf',preferCSSPageSize:true,printBackground:true});assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,12);
  console.log('PASS PC365 58x27 '+suffix+': 12 exact pages, 4mm safe bands, metadata clear of bars, optical Code128 decode');
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
