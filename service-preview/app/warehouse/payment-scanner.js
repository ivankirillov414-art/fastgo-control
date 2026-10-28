import {bindScanner} from './scanner.js';
import {scanError} from './scan-policy.js';
import {matchBarcode} from './client.js';
import {normalizeScan} from './scan-normalize.js';

// The laptop's keyboard-wedge scanner is a payment device. TSD scan modes
// remain separate and never pass through this router.
export function paymentScan(code,parts){
 const value=normalizeScan(code);
 if(value.startsWith('FGPARTS1.'))return {kind:'parts',code:value};
 if(!scanError('repair',value))return {kind:'repair',code:value};
 const problem=scanError('sale',value);if(problem)throw Error(problem);
 const found=matchBarcode(parts,code);
 if(found.length!==1)throw Object.assign(Error(found.length?'Код неоднозначен':'Товар не найден. Получен код: '+value.replace(/[\x00-\x1f\x7f]/g,'').slice(0,80)+'. Скан отменён.'),{code:found.length?'ambiguous':'product_not_found'});
 return {kind:'sale',code:found[0].barcode||value,part:found[0]};
}
export function installPaymentScanner({enabled,parts,accept,error,refresh,observed=()=>{}}){
 const form=document.createElement('form');form.className='scanner-sink';form.setAttribute('aria-hidden','true');
 form.innerHTML='<input data-payment-scan autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="none" tabindex="-1">';
 document.body.append(form);const input=form.firstElementChild;let chain=Promise.resolve();
 form.onsubmit=e=>{e.preventDefault();const code=input.value.trim();input.value='';if(!code)return;
  chain=chain.then(async()=>{
   if(!enabled())throw Error('Завершите текущую операцию перед оплатой. Скан отменён.');
   let scan;
   try{try{scan=paymentScan(code,parts());}catch(e){if(e.code!=='product_not_found'||!refresh)throw e;await refresh();scan=paymentScan(code,parts());}}
   catch(e){try{observed({received:true,matched:false,characters:code.length,normalized:normalizeScan(code)!==code,code:normalizeScan(code)});}catch{}throw e;}
   try{observed({received:true,matched:true,characters:code.length,normalized:normalizeScan(code)!==code,code:scan.kind==='sale'?scan.part.barcode:''});}catch{}
   return accept(scan);
  }).catch(e=>error(e.message));
 };
 return bindScanner(input,form,enabled,{silent:true});
}
