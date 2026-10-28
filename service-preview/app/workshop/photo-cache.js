// Cache pixels, never expiring signed URLs. Callers obtain a newly authorized
// URL before reading this cache, including when an image is already on disk.
const NAME='fastgo-part-photos-v1',MAX_BYTES=64*1024*1024,MAX_ITEMS=100,MAX_AGE=7*86400000;
const pending=new Map();let writes=Promise.resolve();
const keyFor=key=>'https://fastgo-photo-cache.invalid/'+encodeURIComponent(key);
export async function cachedPhoto(url,key,{enabled=!!(globalThis.window?.fastgoDesktop||globalThis.window?.warehouseDesktop),refresh=false}={}){
 if(!enabled||!key||!globalThis.caches)return null;
 const address=keyFor(key),flight=address+(refresh?':refresh':'');
 if(pending.has(flight))return pending.get(flight);
 const task=(async()=>{
  const cache=await caches.open(NAME);
  if(!refresh){const hit=await cache.match(address);if(hit&&Date.now()-Number(hit.headers.get('x-fastgo-stored'))<MAX_AGE)return hit.blob();}
  const response=await fetch(url,{credentials:'omit',signal:AbortSignal.timeout(12000)});
  if(!response.ok||!response.headers.get('content-type')?.startsWith('image/'))throw Error('Photo unavailable');
  const blob=await response.blob();if(!blob.size||blob.size>5*1024*1024)return blob;
  // Quota/storage errors must not stop showing a successfully downloaded image.
  writes=writes.catch(()=>{}).then(async()=>{
   await cache.delete(address);
   await cache.put(address,new Response(blob,{headers:{'Content-Type':blob.type,'x-fastgo-stored':String(Date.now()),'x-fastgo-size':String(blob.size)}}));
   const keys=await cache.keys();let bytes=0,items=[];
   for(const request of keys){const saved=await cache.match(request),time=Number(saved.headers.get('x-fastgo-stored')),size=Number(saved.headers.get('x-fastgo-size'));if(Date.now()-time>=MAX_AGE){await cache.delete(request);continue;}bytes+=size;items.push({request,size,time});}
   items.sort((a,b)=>a.time-b.time);
   while(items.length>MAX_ITEMS||bytes>MAX_BYTES){const oldest=items.shift();bytes-=oldest.size;await cache.delete(oldest.request);}
  });await writes.catch(()=>{});return blob;
 })();pending.set(flight,task);
 try{return await task;}finally{pending.delete(flight);}
}
