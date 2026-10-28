// Signed photo URLs expire. Safari can request an image again after restoring a
// page or releasing its image cache, so recovery must also work after onload.
import {cachedPhoto} from './photo-cache.js';
export function displayPrivatePhoto(img, {getUrl, url, cacheKey, isCurrent = () => img.isConnected, onLoad = () => {}, onError = () => {}}) {
  let retries = 0, stopped = false, refreshing = false, objectUrl;
  const release=()=>{if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}};
  img.loading = 'eager'; // The card's IntersectionObserver already delays loading.
  img.decoding = 'async';
  const current = () => !stopped && isCurrent();
  const fail = () => { if (current()) { stopped = true; onError(); } };
  const refresh = async () => {
    if (!current() || refreshing) return;
    refreshing = true;
    try {
      const next = url && retries===0 ? url : await getUrl();
      if (!next) throw new Error('Missing photo URL');
      let blob=null;
      try{blob=await cachedPhoto(next,cacheKey,{refresh:retries>0});}catch{}
      if (current()) {release();objectUrl=blob?URL.createObjectURL(blob):null;img.src=objectUrl||next;}
    } catch { fail(); }
    finally { refreshing = false; }
  };
  img.onload = () => { if (current()) { retries = 0; onLoad(); } };
  img.onerror = () => {
    if (!current()) return;
    if (retries++ < 1) refresh();
    else fail();
  };
  if (url && !cacheKey) img.src = url;
  else refresh();
  return () => { stopped = true; img.onload = img.onerror = null; release(); };
}
