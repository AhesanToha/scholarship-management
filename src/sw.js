// Seat Desk offline shell (service worker).
//
// Precaches the app shell — /index.html plus the hashed JS/CSS — so the
// volunteer desk (and every other page) OPENS with no network at all.
// Seat data still comes from the downloaded offline pack (IndexedDB); live
// API calls are NEVER cached or intercepted, so admin data, auth and the
// pack download itself always go to the network.
//
// __CACHE_NAME__ and __PRECACHE_URLS__ are filled in by
// scripts/build-react.mjs at build time, so each deploy gets its own cache
// and the old one is deleted on activate.
const CACHE='__CACHE_NAME__';
const PRECACHE=__PRECACHE_URLS__;

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PRECACHE)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.startsWith('/api/'))return; // live data: network only
  if(request.mode==='navigate'){
    // Shell: network first so updates arrive when online; the cached shell
    // when offline. A fresh shell is saved for next time.
    event.respondWith(
      fetch(request).then(response=>{
        // Only an HTML page may become the cached shell: a direct
        // navigation to /sw.js or an asset returns JavaScript, and caching
        // that as /index.html would break the next offline open.
        if(response&&response.ok&&response.headers?.get?.('content-type')?.includes('text/html')){
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put('/index.html',copy)).catch(()=>{});
        }
        return response;
      }).catch(()=>caches.match('/index.html'))
    );
    return;
  }
  if(url.pathname.startsWith('/assets/')){
    // Hashed assets never change: cache first, fill the cache on a miss.
    event.respondWith(
      caches.match(request).then(hit=>{
        if(hit)return hit;
        return fetch(request).then(response=>{
          if(response&&response.ok){
            const copy=response.clone();
            caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{});
          }
          return response;
        });
      })
    );
  }
});
