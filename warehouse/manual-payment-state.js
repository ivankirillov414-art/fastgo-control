export function hasManualPaymentDraft(value){
 if(value==null)return false;
 if(typeof value!=='object'||Array.isArray(value))return true;
 return !!(value.pending||value.items?.length||String(value.work||'').trim()||value.method||['price','total'].some(key=>value[key]!==undefined&&value[key]!==null&&String(value[key])!==''));
}
