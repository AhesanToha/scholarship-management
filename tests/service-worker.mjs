import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// 1. Build the real bundle, then test the embedded service worker — the
// exact file the Worker serves at /sw.js — not a copy of it.
execFileSync(process.execPath,['scripts/build-react.mjs'],{stdio:'pipe'});
const workerSource=readFileSync('worker/index.js','utf8');
assert(workerSource.includes('"/sw.js"'),'build must serve /sw.js');
const hash=workerSource.match(/X-Seat-Desk-Build":"([0-9a-f]{12})"/)?.[1];
assert(hash,'build hash not found in worker/index.js');
assert(workerSource.includes(`seat-desk-${hash}`),'built bundle must embed the service worker with the current cache name');
assert(workerSource.includes("serviceWorker.register(\\\"/sw.js\\\")"),'app bundle must register the service worker');
const swSource=readFileSync('src/sw.js','utf8')
 .replaceAll('__CACHE_NAME__',`seat-desk-${hash}`)
 .replaceAll('__PRECACHE_URLS__',JSON.stringify(['/index.html',`/assets/app-${hash}.js`,`/assets/app-${hash}.css`]));

// 2. Run the worker in a fake browser: captured listeners, in-memory
// caches, controllable fetch (online vs offline).
const listeners={};
const store=new Map();
const origin='https://example.org';
// Real caches key everything by absolute URL; the fake must do the same,
// or a precached '/assets/…' would never match a Request's absolute URL.
const keyOf=v=>new URL(typeof v==='string'?v:v.url,origin).href;
function fakeCache(name){
 if(!store.has(name))store.set(name,new Map());
 const map=store.get(name);
 return {
  async addAll(urls){for(const u of urls)map.set(keyOf(u),{ok:true,url:keyOf(u),body:'cached:'+u,clone(){return this}})},
  async match(req){return map.get(keyOf(req))||null},
  async put(req,res){map.set(keyOf(req),res)},
 };
}
const cachesFake={
 async open(name){return fakeCache(name)},
 async keys(){return [...store.keys()]},
 async delete(name){return store.delete(name)},
 async match(req){for(const map of store.values()){const hit=map.get(keyOf(req));if(hit)return hit}return null},
};
let fetchImpl=async()=>{throw Error('offline')};
const sandbox={
 self:{
  location:{origin:'https://example.org'},
  addEventListener(type,fn){(listeners[type]??=[]).push(fn)},
  skipWaiting(){},
  clients:{claim(){}},
 },
 caches:cachesFake,
 fetch:(...args)=>fetchImpl(...args),
 URL,
};
vm.createContext(sandbox);
vm.runInContext(swSource,sandbox);
assert.equal(listeners.install?.length,1);
assert.equal(listeners.activate?.length,1);
assert.equal(listeners.fetch?.length,1);
let pending=null;
const eventFor=request=>({waitUntil(p){pending=p;return p},request,respondWith(v){pending=v;return v}});
const nav=url=>({method:'GET',mode:'navigate',url});
const get=(url,mode='cors')=>({method:'GET',mode,url});

// Install precaches the shell: index + hashed JS/CSS.
pending=null;listeners.install[0](eventFor(null));await pending;
const shell=store.get('seat-desk-'+hash);
assert(shell?.has(origin+'/index.html'),'install must precache /index.html');
assert(shell?.has(origin+`/assets/app-${hash}.js`),'install must precache the hashed JS');
assert(shell?.has(origin+`/assets/app-${hash}.css`),'install must precache the hashed CSS');

// Activate deletes old caches and keeps the current one.
store.set('seat-desk-oldbuild',new Map([['/index.html',{ok:true}]]));
pending=null;listeners.activate[0](eventFor(null));await pending;
assert(!store.has('seat-desk-oldbuild'),'activate must delete old caches');
assert(store.has('seat-desk-'+hash),'activate must keep the current cache');

// Navigation offline: the cached shell is served.
fetchImpl=async()=>{throw Error('offline')};
pending=null;listeners.fetch[0](eventFor(nav('https://example.org/volunteer')));
assert.equal((await pending).body,'cached:/index.html','offline navigation must fall back to the cached shell');

// Navigation online: the network shell is returned and saved for later.
fetchImpl=async()=>({ok:true,url:'https://example.org/volunteer',body:'fresh shell',headers:{get:name=>name.toLowerCase()==='content-type'?'text/html; charset=utf-8':null},clone(){return this}});
pending=null;listeners.fetch[0](eventFor(nav('https://example.org/volunteer')));
assert.equal((await pending).body,'fresh shell');
assert.equal(shell.get(origin+'/index.html').body,'fresh shell','an online navigation must refresh the cached shell');
// A non-HTML navigation (e.g. straight to /sw.js) must never overwrite the shell.
fetchImpl=async()=>({ok:true,url:'https://example.org/sw.js',body:'sw source',headers:{get:()=>'text/javascript'},clone(){return this}});
pending=null;listeners.fetch[0](eventFor(nav('https://example.org/sw.js')));
await pending;
assert.equal(shell.get(origin+'/index.html').body,'fresh shell','a JavaScript navigation must not overwrite the cached shell');

// API calls are never intercepted: no respondWith, the browser fetches.
pending=null;listeners.fetch[0](eventFor(get('https://example.org/api/volunteer/seat?roll=1')));
assert.equal(pending,null,'API requests must pass through untouched');

// Hashed assets: cache-first on a hit, fetch-and-fill on a miss.
pending=null;listeners.fetch[0](eventFor(get(`https://example.org/assets/app-${hash}.js`)));
assert.equal((await pending).body,`cached:/assets/app-${hash}.js`,'cached assets must come from the cache');
store.get('seat-desk-'+hash).delete('/assets/app-new.js');
fetchImpl=async()=>({ok:true,url:'https://example.org/assets/app-new.js',body:'new asset',clone(){return this}});
pending=null;listeners.fetch[0](eventFor(get('https://example.org/assets/app-new.js')));
assert.equal((await pending).body,'new asset');
assert.equal(shell.get(origin+'/assets/app-new.js').body,'new asset','an asset miss must be fetched and cached');

// Non-GET and cross-origin requests are left alone.
pending=null;listeners.fetch[0](eventFor({method:'POST',mode:'cors',url:'https://example.org/api/state'}));
assert.equal(pending,null,'POST requests must pass through untouched');
pending=null;listeners.fetch[0](eventFor(get('https://fonts.example.com/font.woff2')));
assert.equal(pending,null,'cross-origin requests must pass through untouched');
console.log('PASS: service worker — shell precached, old caches cleaned, offline navigation serves the shell, API untouched, assets cache-first');
