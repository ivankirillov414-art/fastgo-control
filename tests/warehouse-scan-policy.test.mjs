import test from 'node:test';import assert from 'node:assert/strict';import {scanError} from '../warehouse/scan-policy.js';
const qr='https://ivankirillov414-art.github.io/fastgo-control/workshop.html#order?kind=repair&id=359b6650-b0a6-4260-88b7-7c54b99a3fcf';
test('scan policy separates home, stock, repair and master pickup',()=>{
 for(const kind of ['sale','receipt']){assert.equal(scanError(kind,'FGP-00000001'),'');for(const code of [qr,'FGPARTS1.token','https://example.com','www.example.com'])assert.notEqual(scanError(kind,code),'');}
 assert.equal(scanError('repair',qr),'');for(const code of ['FGP-00000001','FGPARTS1.token','https://example.com'])assert.notEqual(scanError('repair',code),'');
 assert.equal(scanError('parts','FGP-00000001'),'');assert.equal(scanError('parts','FGPARTS1.token'),'');assert.notEqual(scanError('parts',qr),'');assert.notEqual(scanError('',qr),'');
});
