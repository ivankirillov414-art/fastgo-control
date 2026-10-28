// Native WebView updates independently of Android. Keep common data helpers
// available on older supported WebViews without changing the desktop bundle.
(function(){
 if(!crypto.randomUUID)crypto.randomUUID=function(){return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g,function(c){return (Number(c)^crypto.getRandomValues(new Uint8Array(1))[0]&15>>Number(c)/4).toString(16);});};
 if(!Object.fromEntries)Object.fromEntries=function(entries){var out={};for(var pair of entries)Object.defineProperty(out,pair[0],{value:pair[1],writable:true,enumerable:true,configurable:true});return out;};
 if(!Array.prototype.at)Object.defineProperty(Array.prototype,'at',{value:function(index){index=Math.trunc(index)||0;return this[index<0?this.length+index:index];},configurable:true,writable:true});
 if(!String.prototype.replaceAll)Object.defineProperty(String.prototype,'replaceAll',{value:function(search,replacement){if(search instanceof RegExp){if(!search.global)throw new TypeError('Global expression required');return this.replace(search,replacement);}return this.replace(new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'),replacement);},configurable:true,writable:true});
 if(!window.structuredClone)window.structuredClone=function(value){function clone(v){if(!v||typeof v!=='object')return v;if(v instanceof Date)return new Date(v);if(v instanceof ArrayBuffer)return v.slice(0);if(ArrayBuffer.isView(v))return new v.constructor(v);if(v instanceof Blob)return v.slice(0,v.size,v.type);if(v instanceof Map)return new Map(Array.from(v,function(pair){return [clone(pair[0]),clone(pair[1])];}));if(v instanceof Set)return new Set(Array.from(v,clone));if(Array.isArray(v))return v.map(clone);var out={};Object.keys(v).forEach(function(k){Object.defineProperty(out,k,{value:clone(v[k]),enumerable:true,writable:true,configurable:true});});return out;}return clone(value);};
 if(window.AbortSignal&&!AbortSignal.timeout)AbortSignal.timeout=function(ms){var controller=new AbortController();setTimeout(function(){controller.abort();},ms);return controller.signal;};
 window.fastgoInstalledApp=Object.freeze({platform:'android',version:'1.0.0',bundled:true});
})();
