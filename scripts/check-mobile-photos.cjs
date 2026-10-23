// The common app's warehouse route now opens the shared warehouse UI.
// Validate the production catalog/photo flow in both mobile browser engines.
const {spawnSync}=require('node:child_process'),path=require('node:path');
for(const kind of (process.env.FASTGO_PHOTO_BROWSERS||'chromium,webkit').split(',')){
 const result=spawnSync(process.execPath,[path.join(__dirname,'check-warehouse-catalog-browser.cjs')],{stdio:'inherit',env:{...process.env,FASTGO_CATALOG_BROWSER:kind}});
 if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);
}
