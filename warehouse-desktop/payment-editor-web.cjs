const fs=require('node:fs'),path=require('node:path');
// Windows-only controls keep the independently signed phone assets unchanged.
module.exports=function preparePaymentEditor(out){
 const modify=(name,transform)=>{const file=path.join(out,name);fs.writeFileSync(file,transform(fs.readFileSync(file,'utf8')));};
 const replace=(source,before,after)=>{if(!source.includes(before))throw Error('Payment editor injection needs review: '+before);return source.replace(before,after);};
 fs.copyFileSync(path.join(__dirname,'renderer/payment-corrections.js'),path.join(out,'warehouse/payment-corrections.js'));
 modify('warehouse/final-report.js',source=>{
  source="import {mountPaymentCorrections} from './payment-corrections.js';\n"+source;
  source=replace(source,'mountFinalReport({root,call})','mountFinalReport({root,call,onCorrected})');
  source=replace(source,'async function refresh(){','const corrections=mountPaymentCorrections({root,call,onSaved:async()=>{await refresh();await onCorrected?.();}});\n async function refresh(){');
  source=replace(source,"esc(x.actor)+'</small></div><strong>'+money(x.amount)","esc(x.actor)+'</small>'+corrections.controls(x)+'</div><strong>'+money(x.amount)");
  source=replace(source,"$('[data-grand-total]').textContent=money(data.total);","corrections.setEditable(data.can_manage_payments);\n   $('[data-grand-total]').textContent=money(data.total);");
  return replace(source,'dispose(){disposed=true;','dispose(){corrections.dispose();disposed=true;');
 });
 modify('warehouse/app.js',s=>replace(s,"mountFinalReport({root:$('final-report-root'),call})","mountFinalReport({root:$('final-report-root'),call,onCorrected:catalog})"));
 modify('warehouse.html',s=>s.replace(/<script defer src="warehouse\/app-compat\.js[^"]*"><\/script>/,'<script type="module" src="warehouse/app.js"></script>'));
 modify('warehouse/web-update.js',s=>s.replace('../warehouse-desktop/update-clock.cjs','./update-clock.js'));
 fs.writeFileSync(path.join(out,'warehouse/update-clock.js'),fs.readFileSync(path.join(__dirname,'update-clock.cjs'),'utf8').replace('module.exports={createDailyCheck};','export {createDailyCheck};'));
 fs.appendFileSync(path.join(out,'warehouse/style.css'),'\n.payment-correction{width:min(560px,calc(100vw - 24px));max-height:90vh;overflow:auto;border:1px solid #d7dfe8;border-radius:14px;padding:24px;color:#172538;background:white;box-sizing:border-box}.payment-correction::backdrop{background:#15253899}.payment-correction form{display:grid;gap:14px}.payment-correction h2,.payment-correction p{margin:0}.payment-correction label{display:grid;gap:6px}.payment-correction input,.payment-correction select,.payment-correction textarea{box-sizing:border-box;width:100%;font:inherit;padding:10px;border:1px solid #9caab9;border-radius:6px}.payment-correction .correction-checkbox{display:flex;align-items:start;gap:10px}.payment-correction input[type=checkbox]{width:20px;height:20px;flex-shrink:0}.payment-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.payment-actions button{font-size:13px}.payment-state{display:block;color:#65501a;font-weight:600}.correction-note{background:#f2f5f8;padding:10px;border-radius:6px}.payment-correction [data-error]{color:#9b2020;overflow-wrap:anywhere}\n');
};
