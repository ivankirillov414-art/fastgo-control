const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {prepareOutput,writeManifest}=require('./bundle-assets.cjs');
const root=path.resolve(__dirname,'../..'),out=prepareOutput(__dirname);
for(const folder of ['workshop','vendor','warehouse'])fs.cpSync(path.join(root,folder),path.join(out,folder),{recursive:true,filter:p=>!p.endsWith('.apk')&&!p.includes(path.sep+'native'+path.sep)});
for(const file of ['workshop.html','workshop.css','fastgo-logo.png','warehouse.html','repair-status.html'])fs.copyFileSync(path.join(root,file),path.join(out,file));
for(const file of ['documents.js','customer-link.js','repair-print.js']){const p=path.join(out,'workshop',file);let s=fs.readFileSync(p,'utf8');s=s.replaceAll("new URL('workshop.html',location.href)","new URL('https://ivankirillov414-art.github.io/fastgo-control/workshop.html')").replaceAll("new URL('repair-status.html',location.href)","new URL('https://ivankirillov414-art.github.io/fastgo-control/repair-status.html')");fs.writeFileSync(p,s);}
fs.copyFileSync(path.join(__dirname,'phone-bootstrap.js'),path.join(out,'phone-bootstrap.js'));
const entry=path.join(out,'phone-entry.js');fs.writeFileSync(entry,["./workshop/app.js","./workshop/inventory-ui.js","./workshop/inventory-import.js","./workshop/inventory-launcher.js"].map(p=>'import '+JSON.stringify(p)+';').join('\n'));
const args=[entry,'--bundle','--format=iife','--target=chrome61','--define:import.meta.url="https://appassets.androidplatform.net/assets/fastgo/workshop/app-phone.js"','--outfile='+path.join(out,'workshop/app-phone.js')];
if(process.env.FASTGO_ESBUILD)execFileSync(process.env.FASTGO_ESBUILD,args,{stdio:'inherit'});else execFileSync(process.platform==='win32'?'npx.cmd':'npx',['--yes','esbuild@0.28.2',...args],{stdio:'inherit',shell:process.platform==='win32'});
fs.unlinkSync(entry);
let html=fs.readFileSync(path.join(out,'workshop.html'),'utf8');html=html.replace(/<script type="importmap">[\s\S]*?<\/script>/g,'').replace(/<script type="module"[^>]*><\/script>/g,'');html=html.replace('</head>','<script defer src="phone-bootstrap.js"></script><script defer src="workshop/app-phone.js"></script></head>');fs.writeFileSync(path.join(out,'workshop.html'),html);
html=fs.readFileSync(path.join(out,'warehouse.html'),'utf8').replace('<script defer src="vendor/','<script defer src="phone-bootstrap.js"></script><script defer src="vendor/');fs.writeFileSync(path.join(out,'warehouse.html'),html);
const manifest=writeManifest(out,{platform:'android',version:'1.0.3',bundle_source:'installed-apk'});console.log('Prepared Android phone bundle',manifest.version,Object.keys(manifest.files).length,'verified assets');
