const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const digest=data=>crypto.createHash('sha256').update(data).digest('hex');
const runtimePackage=p=>({name:p.name,version:p.version,main:p.main,dependencies:p.dependencies||{}});
function walk(root,prefix=''){return fs.readdirSync(root,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>{if(e.isSymbolicLink())throw Error('Release input cannot be a symlink: '+e.name);const name=prefix+e.name;return e.isDirectory()?walk(path.join(root,e.name),name+'/'):[name];});}
function create(root){
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'))),files={},resources={};
 for(const pattern of pkg.build.files){
  if(pattern==='release-content.json')continue;
  if(pattern==='package.json'){files[pattern]=digest(JSON.stringify(runtimePackage(pkg)));continue;}
  const folder=pattern.endsWith('/**/*')?pattern.slice(0,-5):null;
  if(!folder&&/[*!?]/.test(pattern))throw Error('Unsupported release input pattern: '+pattern);
  for(const name of folder?walk(path.join(root,folder)).map(n=>folder+'/'+n):[pattern]){
   // Repository transport metadata is not a runtime asset; electron-builder always removes it.
   if(path.basename(name)==='.gitattributes')continue;
   files[name]=digest(fs.readFileSync(path.join(root,name)));
  }
 }
 for(const resource of pkg.build.extraResources||[]){
  if(typeof resource!=='object'||!resource.from||!resource.to||resource.filter)throw Error('Unsupported extra resource definition');
  for(const name of walk(path.resolve(root,resource.from)))resources[resource.to+'/'+name]=digest(fs.readFileSync(path.resolve(root,resource.from,name)));
 }
 const inputs={};
 for(const name of ['package.json','package-lock.json',pkg.build.nsis?.include].filter(Boolean))inputs[name]=digest(fs.readFileSync(path.join(root,name)));
 const stable=map=>Object.fromEntries(Object.entries(map).sort(([a],[b])=>a<b?-1:a>b?1:0));
 const content={schema:1,app:pkg.name,version:pkg.version,files:stable(files),resources:stable(resources),inputs:stable(inputs)};
 return {...content,fingerprint:digest(JSON.stringify(content))};
}
function write(root){const receipt=create(root);fs.writeFileSync(path.join(root,'release-content.json'),JSON.stringify(receipt,null,2)+'\n');return receipt;}
function verify(root,archive,resources,asar){
 const receipt=JSON.parse(asar.extractFile(archive,'release-content.json').toString()),expected=create(root);
 if(JSON.stringify(receipt)!==JSON.stringify(expected))throw Error('Packaged release identity differs from tested source');
 for(const [name,hash] of Object.entries(receipt.files)){
  let bytes;try{bytes=asar.extractFile(archive,path.normalize(name));}catch(error){
   console.error('Archive entries near missing file:',asar.listPackage?.(archive).filter(n=>n.toLowerCase().includes(path.basename(name).toLowerCase())||n.replaceAll('\\','/').includes('/'+path.posix.dirname(name)+'/')).slice(0,30));throw error;
  }
  const actual=name==='package.json'?digest(JSON.stringify(runtimePackage(JSON.parse(bytes)))):digest(bytes);
  if(actual!==hash)throw Error('Stale packaged file: '+name);
 }
 for(const [name,hash] of Object.entries(receipt.resources))if(digest(fs.readFileSync(path.join(resources,name)))!==hash)throw Error('Stale packaged resource: '+name);
 fs.writeFileSync(path.join(root,'dist','release-content.json'),JSON.stringify(receipt,null,2)+'\n');
 return receipt;
}
function sameRelease(previous,next){if(!previous||previous.schema!==1||previous.app!==next.app||previous.version!==next.version||previous.fingerprint!==next.fingerprint)throw Error('Published version has different or unverified contents. Increase the application version.');return true;}
module.exports={create,write,verify,sameRelease};
if(require.main===module)console.log('Release content identity: '+write(path.resolve(process.argv[2]||'.')).fingerprint);
