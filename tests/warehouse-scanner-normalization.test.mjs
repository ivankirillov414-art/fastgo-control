import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeScan} from '../warehouse/scan-normalize.js';

test('ATOL product code survives Russian Windows layout, AIM prefix and suffix',()=>{
 for(const raw of ['FGP-00000036','АПЗ-00000036','апз-00000036',']C0FGP-00000036\r\n','ъС0АПЗ-00000036\t','\ufeffFGP-00000036\r'])assert.equal(normalizeScan(raw).toUpperCase(),'FGP-00000036');
});
test('layout recovery preserves URL punctuation and signed pickup case',()=>{
 assert.equal(normalizeScan('реезыЖ..учфьздуюштмфдшв.ф'),'https://example.invalid/a');
 assert.equal(normalizeScan('АПЗФКЕЫ1юФИС'), 'FGPARTS1.ABC');
});
test('arbitrary Cyrillic SKUs are not transliterated and unrelated text is not guessed',()=>{
 for(const code of ['КАМЕРА-25','Амортизатор','unknown-code'])assert.equal(normalizeScan(code),code);
 assert.equal(normalizeScan(']C0UNKNOWN-12'),'UNKNOWN-12');
});
