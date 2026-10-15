// Signed photo URLs expire. Safari can request an image again after restoring a
// page or releasing its image cache, so recovery must also work after onload.
export function displayPrivatePhoto(img, {getUrl, url, isCurrent = () => img.isConnected, onLoad = () => {}, onError = () => {}}) {
  let retries = 0, stopped = false, refreshing = false;
  img.loading = 'eager'; // The card's IntersectionObserver already delays loading.
  img.decoding = 'async';
  const current = () => !stopped && isCurrent();
  const fail = () => { if (current()) { stopped = true; onError(); } };
  const refresh = async () => {
    if (!current() || refreshing) return;
    refreshing = true;
    try {
      const next = await getUrl();
      if (!next) throw new Error('Missing photo URL');
      if (current()) img.src = next;
    } catch { fail(); }
    finally { refreshing = false; }
  };
  img.onload = () => { if (current()) { retries = 0; onLoad(); } };
  img.onerror = () => {
    if (!current()) return;
    if (retries++ < 1) refresh();
    else fail();
  };
  if (url) img.src = url;
  else refresh();
  return () => { stopped = true; img.onload = img.onerror = null; };
}
