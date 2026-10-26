import {bindScanner} from './scanner.js';
import {scanError} from './scan-policy.js';
import {matchBarcode} from './client.js';

// The laptop's keyboard-wedge scanner is a payment device. TSD scan modes
// remain separate and never pass through this router.
export function paymentScan(code,parts){
 const value=String(code||'').trim();
 if(value.startsWith('FGPARTS1.'))return {kind:'parts',code:value};
 if(!scanError('repair',value))return {kind:'repair',code:value};
 const problem=scanError('sale',value);if(problem)throw Error(problem);
 const found=matchBarcode(parts,value);
 if(found.length!==1)throw Error(found.length?'Код неоднозначен':'Товар не найден. Скан отменён.');
 return {kind:'sale',code:value,part:found[0]};
}
export function installPaymentScanner({enabled,parts,accept,error}){
 const form=document.createElement('form');form.className='scanner-sink';form.setAttribute('aria-hidden','true');
 form.innerHTML='<input data-payment-scan autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="none" tabindex="-1">';
 document.body.append(form);const input=form.firstElementChild;let chain=Promise.resolve();
 form.onsubmit=e=>{e.preventDefault();const code=input.value.trim();input.value='';if(!code)return;
  chain=chain.then(()=>{if(!enabled())throw Error('Завершите текущую операцию перед оплатой. Скан отменён.');return accept(paymentScan(code,parts()));}).catch(e=>error(e.message));
 };
 return bindScanner(input,form,enabled,{silent:true});
}
