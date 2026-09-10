import test from 'node:test';import assert from 'node:assert/strict';
globalThis.localStorage={getItem:()=>null};
const {suggestedEnd,normalizePhone,esc}=await import('../workshop/core.js');
test('monthly storage clamps end of month',()=>{assert.equal(suggestedEnd('2026-01-31','monthly',1),'2026-02-28');assert.equal(suggestedEnd('2028-01-31','monthly',1),'2028-02-29');});
test('season crosses year to March',()=>{assert.equal(suggestedEnd('2026-09-10','season',1),'2027-03-31');});
test('phone normalizes domestic and international forms',()=>{assert.equal(normalizePhone('8 (912) 123-45-67'),'+79121234567');assert.equal(normalizePhone('+7 912 123 45 67'),'+79121234567');assert.throws(()=>normalizePhone('8912'));});
test('customer text escapes HTML and attribute delimiters',()=>{assert.equal(esc('<img src="x">'), '&lt;img src=&quot;x&quot;&gt;');});
