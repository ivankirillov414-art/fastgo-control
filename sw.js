const CACHE='arise-shell-20260910';
const ROOT=new URL('./',self.location.href);
const ASSETS=['achievements.html','arise/app.css','arise/app.mjs','arise/core.mjs','arise/curriculum.mjs','ARISE-app-icon-180.png','rpg-icon.svg','manifest.webmanifest'];
const paths=new Set(ASSETS.map(path=>new URL(path,ROOT).pathname));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(x=>new URL(x,ROOT).href))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('arise-shell-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 // Never intercept the workshop, storefront, APIs, uploads or bearer device keys.
 if(req.method!=='GET'||url.origin!==ROOT.origin||!paths.has(url.pathname))return;
 event.respondWith(fetch(req).then(async response=>{if(response.ok){const cache=await caches.open(CACHE);await cache.put(req,response.clone());}return response;}).catch(async()=>await caches.match(req,{ignoreSearch:true})||new Response('ARISE недоступен офлайн. Подключись к интернету.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})));
});
function targetURL(raw){try{const url=new URL(raw||'achievements.html',ROOT);return url.origin===ROOT.origin&&url.pathname===new URL('achievements.html',ROOT).pathname?url.href:new URL('achievements.html#quests',ROOT).href;}catch{return new URL('achievements.html#quests',ROOT).href;}}
self.addEventListener('push',event=>{let data={};try{data=event.data?.json()||{};}catch{}event.waitUntil(self.registration.showNotification(String(data.title||'ARISE — ежедневные квесты'),{body:String(data.body||'Открой свои задания на сегодня.'),icon:new URL('ARISE-app-icon-180.png',ROOT).href,tag:String(data.tag||'arise-daily'),data:{url:targetURL(data.url)}}));});
self.addEventListener('notificationclick',event=>{event.notification.close();const url=targetURL(event.notification.data?.url);event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{const app=windows.find(w=>new URL(w.url).pathname===new URL('achievements.html',ROOT).pathname);if(app){await app.navigate(url);return app.focus();}return self.clients.openWindow(url);}));});
