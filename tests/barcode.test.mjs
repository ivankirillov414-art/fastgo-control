import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
test('the shipped scanner decodes the shipped label generator at 1x, 2x and 3x',()=>{
  const context=vm.createContext({window:{}});
  for(const file of ['zxing-browser-0.2.1.min.js','jsbarcode-3.12.3.min.js'])vm.runInContext(fs.readFileSync(new URL('../vendor/'+file,import.meta.url),'utf8'),context);
  for(const code of ['FGP-00000001','FGP-00000080','FGP-99999999'])for(const scale of [1,2,3]){
    const output={};context.window.JsBarcode(output,code,{format:'CODE128'});
    const bits='0'.repeat(20)+output.encodings.map(x=>x.data).join('')+'0'.repeat(20),a=[...bits].flatMap(x=>Array(scale).fill(x==='1'));
    const row={getSize:()=>a.length,get:i=>a[i],getNextSet:i=>{while(i<a.length&&!a[i])i++;return i},getNextUnset:i=>{while(i<a.length&&a[i])i++;return i},isRange:(start,end,v)=>a.slice(start,end).every(x=>x===v),reverse:()=>a.reverse()};
    const reader=new context.ZXingBrowser.BrowserMultiFormatOneDReader();assert.equal(reader.reader.decodeRow(0,row,new Map()).getText(),code);
  }
});
