const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'web');if(path.dirname(out)!==__dirname)throw Error('Invalid output path');fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(const folder of ['workshop','vendor','warehouse'])fs.cpSync(path.join(root,folder),path.join(out,folder),{recursive:true,filter:source=>!source.endsWith('.apk')&&!source.includes(path.sep+'native'+path.sep)});
for(const name of ['workshop.html','workshop.css','fastgo-logo.png','warehouse.html'])fs.copyFileSync(path.join(root,name),path.join(out,name));
for(const name of ['documents.js','customer-link.js','repair-print.js']){const file=path.join(out,'workshop',name);if(!fs.existsSync(file))continue;let s=fs.readFileSync(file,'utf8');s=s.replaceAll("new URL('workshop.html',location.href)","new URL('https://ivankirillov414-art.github.io/fastgo-control/workshop.html')").replaceAll("new URL('repair-status.html',location.href)","new URL('https://ivankirillov414-art.github.io/fastgo-control/repair-status.html')");fs.writeFileSync(file,s);}
// An iPhone loads its UI from the installed bundle. UI changes arrive in a new IPA.
let s=fs.readFileSync(path.join(out,'warehouse/app-compat.js'),'utf8');s='window.fastgoInstalledApp=Object.freeze({platform:"ios",version:"1.0.12",bundled:true});\n'+s;fs.writeFileSync(path.join(out,'warehouse/app-compat.js'),s);
const manifest={platform:'ios',version:'1.0.12',bundle_source:'installed-ipa',api:'https://oqgpjfikjpcplnxueoki.supabase.co',files:{},native_files:{}};
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);}
for(const file of walk(out))if(/\.(?:js|css|html|json|svg|txt|webmanifest|map)$/.test(file))fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'));
for(const file of walk(out).sort())manifest.files[path.relative(out,file).split(path.sep).join('/')]=sha(fs.readFileSync(file));
for(const file of ['ios/FastGo/AppDelegate.swift','ios/FastGo/Info.plist','ios/FastGo.xcodeproj/project.pbxproj'])manifest.native_files[file]=sha(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n'));
manifest.source_fingerprint=sha(JSON.stringify({version:manifest.version,files:manifest.files,native_files:manifest.native_files}));
fs.writeFileSync(path.join(out,'bundle-receipt.json'),JSON.stringify(manifest,null,2));console.log('Prepared iPhone bundle',manifest.version,manifest.source_fingerprint);
