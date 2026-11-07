const fs=require('node:fs'),path=require('node:path');
function prepareBackup(out,phoneRoot){
 const file=path.join(out,'workshop/core.js');let source=fs.readFileSync(file,'utf8');
 const marker='async function refresh(){';if(!source.includes(marker))throw Error('Phone auth refresh entry changed; native backup integration requires review');
 source=source.replace(marker,marker+"if(window.fastgoNativeRefreshSession){if(!refreshing)refreshing=window.fastgoNativeRefreshSession(session?.access_token||'').then(s=>{saveSession(s);return true;}).catch(e=>{if(!localStorage.getItem(STORE))clearSession();throw e;}).finally(()=>refreshing=null);return refreshing;}");fs.writeFileSync(file,source);
 fs.copyFileSync(path.join(phoneRoot,'backup-bootstrap.js'),path.join(out,'backup-bootstrap.js'));
 // Inventory opens warehouse.html?unified=1. Its prepared compat bundle must
 // share the same protected session and refresh coordinator as the service UI.
 for(const name of ['client.js','app-compat.js']){const file=path.join(out,'warehouse',name);if(!fs.existsSync(file))continue;const original=fs.readFileSync(file,'utf8');let matches=0;
  const transformed=original.replace(/request\((['"])\/auth\/v1\/token\?grant_type=refresh_token\1,\s*\{\s*refresh_token:\s*session\.refresh_token\s*\}\)/g,match=>{matches++;return '(unified&&window.fastgoNativeRefreshSession?window.fastgoNativeRefreshSession(session.access_token):'+match+')';});if(!matches)throw Error('Phone warehouse refresh changed; backup session integration requires review');fs.writeFileSync(file,transformed);
 }
}
module.exports={prepareBackup};
