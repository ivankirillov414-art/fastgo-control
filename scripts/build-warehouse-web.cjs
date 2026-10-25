const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'warehouse'),pages=['warehouse.html','warehouse-terminal.html'];
const read=p=>fs.readFileSync(path.join(root,p),'utf8').replace(/\r\n/g,'\n');
const normalize=s=>s.replace(/(<meta name="warehouse-web-version" content=")[^"]*(">)/g,'$1VERSION$2').replace(/(warehouse\/(?:style\.css|app-compat\.js)\?v=)[^"\s]+/g,'$1VERSION');
const inputs=fs.readdirSync(dir).filter(n=>n.endsWith('.js')&&n!=='app-compat.js'||n.endsWith('.css')).sort().map(n=>'warehouse/'+n).concat(pages,'warehouse-desktop/update-clock.cjs','workshop/photo-upload.js','workshop/private-photo.js','workshop/photo-cache.js','workshop/product-intake.js','workshop/notifications.js','workshop/pending.js');
const version=crypto.createHash('sha256').update(inputs.map(p=>p+'\n'+(pages.includes(p)?normalize(read(p)):read(p))).join('\n')).digest('hex').slice(0,24);
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
if(process.argv.includes('--check')){
 const m=JSON.parse(read('warehouse/web-version.json'));
 if(m.version!==version||m.bundle_sha256!==digest(read('warehouse/app-compat.js'))||pages.some(p=>!read(p).includes('content="'+version+'"')||!read(p).includes('app-compat.js?v='+version)))throw Error('Warehouse assets are stale. Run node scripts/build-warehouse-web.cjs and commit generated files.');
 console.log('Warehouse web version verified: '+version);
}else{
 const args=['warehouse/app.js','--bundle','--format=iife','--target=chrome61','--outfile=warehouse/app-compat.js'];
 if(process.env.FASTGO_ESBUILD)execFileSync(process.env.FASTGO_ESBUILD,args,{cwd:root,stdio:'inherit'});
 else execFileSync(process.platform==='win32'?'npx.cmd':'npx',['--yes','esbuild@0.28.2',...args],{cwd:root,stdio:'inherit',shell:process.platform==='win32'});
 for(const p of pages)fs.writeFileSync(path.join(root,p),normalize(read(p)).replace(/content="VERSION"/g,'content="'+version+'"').replace(/\?v=VERSION/g,'?v='+version));
 fs.writeFileSync(path.join(dir,'web-version.json'),JSON.stringify({version,bundle_sha256:digest(read('warehouse/app-compat.js'))})+'\n');
 console.log('Warehouse web version built: '+version);
}
