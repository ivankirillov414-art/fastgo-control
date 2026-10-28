// Deduplicate concurrent loads; failures remove the failed script so retry works.
export function createLibraryLoader({document,window,setTimeout=globalThis.setTimeout,clearTimeout=globalThis.clearTimeout,timeout=15000}) {
  const pending=new Map();
  return function loadLibrary(src,name) {
    if(window[name])return Promise.resolve(window[name]);
    const key=src+'|'+name;if(pending.has(key))return pending.get(key);
    const promise=new Promise((resolve,reject)=>{
      const s=document.createElement('script');let finished=false;
      const finish=(error)=>{if(finished)return;finished=true;clearTimeout(timer);s.onload=s.onerror=null;if(error){s.remove();reject(error);}else resolve(window[name]);};
      const timer=setTimeout(()=>finish(new Error('Модуль не загрузился вовремя. Проверьте интернет и повторите.')),timeout);
      s.src=src;s.defer=true;s.onload=()=>finish(window[name]?null:new Error('Модуль загрузился некорректно. Повторите.'));s.onerror=()=>finish(new Error('Не удалось загрузить модуль. Проверьте интернет и повторите.'));document.head.appendChild(s);
    });pending.set(key,promise);promise.then(()=>pending.delete(key),()=>pending.delete(key));return promise;
  };
}
let browserLoader;
export function loadLibrary(src,name){browserLoader??=createLibraryLoader({document,window});return browserLoader(src,name);}
