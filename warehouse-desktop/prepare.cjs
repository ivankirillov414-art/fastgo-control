const fs=require('node:fs'),path=require('node:path');fs.copyFileSync(path.join(__dirname,'../desktop/updates.cjs'),path.join(__dirname,'updates.cjs'));
const out=path.join(__dirname,'web'),root=path.resolve(__dirname,'..');if(path.dirname(out)!==__dirname)throw Error('Invalid bundle directory');fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(const name of ['warehouse','vendor'])fs.cpSync(path.join(root,name),path.join(out,name),{recursive:true});
fs.copyFileSync(path.join(root,'warehouse.html'),path.join(out,'warehouse.html'));fs.writeFileSync(path.join(out,'migration.html'),'<!doctype html><title>FastGo migration</title>');
console.log('Prepared locally bundled warehouse interface');
