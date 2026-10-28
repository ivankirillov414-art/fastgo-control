const test=require('node:test'),assert=require('node:assert/strict');
const {barcodePrintHTML}=require('../../warehouse-desktop/barcode-print.cjs');
const payload=()=>({name:'Камера <10 × 2,5>',barcode:'FGP-00000001',quantity:3,format:'label',svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 72"><g transform="translate(8,8)"><rect x="1" y="0" width="2" height="72"/></g></svg>'});
test('exact label count, escaped product name and correct paper size reach native print document',()=>{const p=payload(),html=barcodePrintHTML(p);assert.equal((html.match(/<section /g)||[]).length,3);assert.match(html,/58mm 30mm/);assert.match(html,/&lt;10 × 2,5&gt;/);assert.match(barcodePrintHTML({...p,format:'a4'}),/size:A4/);});
test('printing rejects invalid count, active SVG content and external resources',()=>{for(const quantity of [0,1.5,1001,'3'])assert.throws(()=>barcodePrintHTML({...payload(),quantity}));for(const svg of ['<svg><script>alert(1)</script></svg>','<svg onload="x()"></svg>','<svg><image href="https://bad.invalid"/></svg>'])assert.throws(()=>barcodePrintHTML({...payload(),svg}));});


test('retail price prints in rubles for thermal and A4 labels and invalid prices are refused',()=>{
 for(const format of ['label','a4']){const html=barcodePrintHTML({...payload(),format,price:1500.50});assert.match(html,/<b class="price">1.500,5 ₽<\/b>/);}
 for(const price of [-1,NaN,Infinity,'1500'])assert.throws(()=>barcodePrintHTML({...payload(),price}));
});
test('label contains separate size and automatic article with escaped values',()=>{
 const html=barcodePrintHTML({...payload(),name:'Камера Макс Спид',model:'10 × 2,5',sku:'FG-00000002',price:300});
 assert.match(html,/Камера Макс Спид/);assert.match(html,/Размер: 10 × 2,5/);assert.match(html,/Арт\. FG-00000002/);assert.match(html,/300 ₽/);
});
