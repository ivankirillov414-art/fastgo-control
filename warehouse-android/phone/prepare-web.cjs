const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'src/main/assets/fastgo');
fs.mkdirSync(out,{recursive:true});
for(const folder of ['workshop','vendor','warehouse'])fs.cpSync(path.join(root,folder),path.join(out,folder),{recursive:true,filter:p=>!p.endsWith('.apk')&&!p.includes(path.sep+'native'+path.sep)});
for(const file of ['workshop.html','workshop.css','fastgo-logo.png','warehouse.html','repair-status.html'])fs.copyFileSync(path.join(root,file),path.join(out,file));
for(const file of ['documents.js','customer-link.js','repair-print.js']){const p=path.join(out,'workshop',file);let s=fs.readFileSync(p,'utf8');s=s.replaceAll("new URL('workshop.html',location.href)","new URL('https://ivankirillov414-art.github.io/fastgo-control/workshop.html')").replaceAll("new URL('repair-status.html',location.href)","new URL('https://ivankirillov414-art.github.io/fastgo-control/repair-status.html')");fs.writeFileSync(p,s);}
const manifest={platform:'android',version:'1.0.0',bundle_source:'installed-apk',files:{}};
for(const file of ['workshop.html','workshop/app.js','warehouse.html','warehouse/app-compat.js','warehouse/style.css'])manifest.files[file]=crypto.createHash('sha256').update(fs.readFileSync(path.join(out,file))).digest('hex');
fs.writeFileSync(path.join(out,'bundle-receipt.json'),JSON.stringify(manifest,null,2));console.log('Prepared Android phone bundle',manifest.version);
