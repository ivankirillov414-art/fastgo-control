// Session-memory cache only. Customer records never enter persistent storage.
export function createReadCache({now=Date.now,ttl=20000,max=80}={}){
 const values=new Map(),pending=new Map();let generation=0,writes=0;
 const clear=()=>{generation++;values.clear();pending.clear();};
 return {
  clear,
  beginWrite(){writes++;clear();let ended=false;return()=>{if(ended)return;ended=true;writes--;clear();};},
  async read(key,load,{fresh=false,retain=true}={}){
   if(fresh){values.delete(key);}
   const saved=values.get(key);
   if(!fresh&&!writes&&saved&&saved.expires>now())return structuredClone(saved.data);
   if(!pending.has(key)){
    const revision=generation;const cacheable=!writes&&retain;
    const promise=Promise.resolve().then(load).then(data=>{
     if(cacheable&&!writes&&revision===generation){values.delete(key);values.set(key,{data:structuredClone(data),expires:now()+ttl});while(values.size>max)values.delete(values.keys().next().value);}
     return data;
    }).finally(()=>{if(pending.get(key)===promise)pending.delete(key);});
    pending.set(key,promise);
   }
   return structuredClone(await pending.get(key));
  }
 };
}
