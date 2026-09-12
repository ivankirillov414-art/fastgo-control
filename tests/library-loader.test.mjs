import test from 'node:test';
import assert from 'node:assert/strict';
import {createLibraryLoader} from '../workshop/library-loader.js';
function mock(){const scripts=[],window={},document={createElement:()=>({remove(){this.removed=true;}}),head:{appendChild:s=>scripts.push(s)}};return {scripts,window,document};}
test('concurrent library callers share one load',async()=>{const h=mock(),load=createLibraryLoader(h);const a=load('/lib.js','Lib'),b=load('/lib.js','Lib');assert.equal(a,b);assert.equal(h.scripts.length,1);h.window.Lib={ok:true};h.scripts[0].onload();assert.deepEqual(await a,{ok:true});});
test('failed script removed and next call retries',async()=>{const h=mock(),load=createLibraryLoader(h),a=load('/lib.js','Lib');h.scripts[0].onerror();await assert.rejects(a,/Не удалось/);assert.equal(h.scripts[0].removed,true);const b=load('/lib.js','Lib');assert.equal(h.scripts.length,2);h.window.Lib=42;h.scripts[1].onload();assert.equal(await b,42);});
test('loaded script without API rejected rather than hanging',async()=>{const h=mock(),load=createLibraryLoader(h),p=load('/lib.js','Lib');h.scripts[0].onload();await assert.rejects(p,/некорректно/);});
test('timeout removes script and allows retry',async()=>{const h=mock();let expire;const load=createLibraryLoader({...h,setTimeout:fn=>(expire=fn,1),clearTimeout:()=>{}}),p=load('/lib.js','Lib');expire();await assert.rejects(p,/вовремя/);assert.equal(h.scripts[0].removed,true);});
