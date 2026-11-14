import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {build} from 'esbuild';import {seed,ensureTokens,buildAllocationPlan,applyAllocationPlan,snapshot} from '../src/lib/domain.js';import {createExamStore} from '../src/lib/store.js';
await build({entryPoints:['src/App.jsx','src/pages/AdmitCards.jsx'],bundle:true,platform:'node',format:'esm',outdir:'tests/.compiled',packages:'external',jsx:'automatic'});
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://example.org/volunteer'});globalThis.window=dom.window;globalThis.document=dom.window.document;Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.location=dom.window.location;globalThis.localStorage=dom.window.localStorage;globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.confirm=()=>true;globalThis.alert=()=>{};globalThis.FormData=dom.window.FormData;globalThis.HTMLElement=dom.window.HTMLElement;globalThis.HTMLInputElement=dom.window.HTMLInputElement;window.print=()=>prints++;let prints=0;globalThis.URL.createObjectURL=()=> 'blob:backup';globalThis.URL.revokeObjectURL=()=>{};dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
const media=query=>({matches:false,media:query,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){},dispatchEvent(){return false}});window.matchMedia=media;globalThis.matchMedia=media;globalThis.getComputedStyle=window.getComputedStyle.bind(window);globalThis.requestAnimationFrame=fn=>setTimeout(fn,0);globalThis.cancelAnimationFrame=clearTimeout;globalThis.ResizeObserver=class{observe(){} unobserve(){} disconnect(){}};window.ResizeObserver=globalThis.ResizeObserver;window.HTMLElement.prototype.scrollIntoView=function(){};const {default:React,act}=await import('react'),{createRoot}=await import('react-dom/client'),{renderToStaticMarkup}=await import('react-dom/server'),{default:App}=await import('./.compiled/App.js'),{AdmitCard}=await import('./.compiled/pages/AdmitCards.js');

window.HTMLCanvasElement.prototype.getContext=()=>({});
const calls=[];let fail=false,fetchMode='live';globalThis.fetch=async(path)=>{calls.push(path);if(fetchMode==='throw')throw Error('NetworkError');if(fetchMode==='500')return {ok:false,status:500,json:async()=>({error:'Server error'})};if(fetchMode==='404')return {ok:false,status:404,json:async()=>({error:'Roll not found.'})};return {ok:!fail,status:fail?404:200,json:async()=>fail?{error:"Roll not found."}:{roll:'260401',live:true,exam:{name:'Exam',center:'School',date:'2026-10-17',time:'10:00'},seat:{room:'101',building:'A',floor:'Ground',bench:3,position:'B',directions:'Go right'},layout:null}}};
const root=createRoot(document.getElementById('root'));const pause=()=>new Promise(r=>setTimeout(r,10));
await act(async()=>{root.render(React.createElement(App));await pause()});
assert(!document.querySelector('aside'));assert.equal(calls.length,0,'Volunteer must not boot admin state');
async function enter(value){await act(async()=>{const field=document.querySelector("input[aria-label=\"Exam roll\"]");Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(field,value);field.dispatchEvent(new window.Event('input',{bubbles:true}));await pause()})}
async function submit(){await act(async()=>{document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await pause()})}
async function click(label){const button=[...document.querySelectorAll('button')].find(b=>b.textContent.includes(label));assert(button);await act(async()=>{button.dispatchEvent(new window.MouseEvent('click',{bubbles:true}));await pause()})}
await enter('২৬০৪০১');await submit();assert.equal(calls[0],'/api/volunteer/seat?roll=260401');assert(document.querySelector('.seat-result').textContent.includes('101'));
await click("Refresh seat");assert.equal(calls.length,2);await click("Next student");assert(!document.querySelector('.seat-result'));assert.equal(document.querySelector('input').value,'');
fail=true;await enter('9999');await submit();assert(document.querySelector('[role="alert"]').textContent.includes("Roll not found"));assert(!document.querySelector('.seat-result'));
await click("Next student");await click("Scan QR code");assert(document.querySelector('.qr-scanner'));await click("Close camera");assert(!document.querySelector('.qr-scanner'));
assert(calls.every(path=>!path.includes('/api/state')&&!path.includes('/api/me')));
// Offline fallback (reviewer correction): the live-vs-offline branching is
// the safety-critical part of the offline pack, so it needs UI tests, not
// just a code trace. Fake IndexedDB (same harness as
// tests/offline-volunteer.mjs §3), a pack built from a locked,
// partially-allocated seed, and a fetch mock that can fail per case.
const __stores=new Map();
class FakeRequest{
 constructor(){this.onsuccess=null;this.onerror=null;this.result=undefined;this.error=null}
 _resolve(v){this.result=v;queueMicrotask(()=>this.onsuccess?.({target:this}))}
}
class FakeStore{
 constructor(){this.map=new Map()}
 put(v,k){const r=new FakeRequest();this.map.set(k,structuredClone(v));r._resolve(undefined);return r}
 get(k){const r=new FakeRequest();const v=this.map.get(k);r._resolve(v===undefined?undefined:structuredClone(v));return r}
 delete(k){const r=new FakeRequest();this.map.delete(k);r._resolve(undefined);return r}
}
function fakeDb(){
 return {
  objectStoreNames:{contains:n=>__stores.has(n)},
  createObjectStore(n){if(!__stores.has(n))__stores.set(n,new FakeStore());return __stores.get(n)},
  transaction(n){const s=__stores.get(n);return {objectStore:()=>s}},
  close(){}
 };
}
globalThis.indexedDB={open(){const req=new FakeRequest();req.result=fakeDb();queueMicrotask(()=>{try{req.onupgradeneeded?.({target:req})}catch{}req.onsuccess?.({target:req})});return req}};
const {buildOfflinePack}=await import('../src/lib/offline-pack.js');
const {savePack}=await import('../src/lib/offline-seats.js');
let packState=seed();ensureTokens(packState);
applyAllocationPlan(packState,buildAllocationPlan(packState,{roomId:packState.rooms[0].id,grades:['6','7']}));
packState.exam.locked=true;
await savePack(await buildOfflinePack(packState));
const seated=packState.students.find(s=>s.seat),seatedRoll=seated.roll,seatedToken=seated.qrToken;
// Re-mount so the page picks up the saved pack (badge time + version check).
// The mount effect loads the pack asynchronously (IndexedDB + checksum),
// so wait for the badge instead of guessing a fixed pause.
async function waitFor(fn,msg){await act(async()=>{const deadline=Date.now()+3000;while(Date.now()<deadline){if(fn())return;await new Promise(r=>setTimeout(r,10))}});assert(fn(),msg)}
fetchMode='throw';
await act(async()=>{root.unmount()});
const root2=createRoot(document.getElementById('root'));
await act(async()=>{root2.render(React.createElement(App));await pause()});
await waitFor(()=>document.body.textContent.includes('Offline ready'),'saved pack should show Offline ready');
// Case A — a live 4xx error is never overridden by the pack, even when the
// pack contains that roll.
fetchMode='404';await enter(seatedRoll);await submit();
await waitFor(()=>document.querySelector('[role="alert"]'),'live 404 should show an error');
assert(document.querySelector('[role="alert"]').textContent.includes('Roll not found'));
assert(!document.querySelector('.seat-result'),'live 404 must not fall back to the offline pack');
await click("Next student");
// Case B — network failure falls back to the pack (roll lookup).
fetchMode='throw';await enter(seatedRoll);await submit();
await waitFor(()=>document.querySelector('.seat-result'),'offline roll lookup should show a seat');
assert(document.body.textContent.includes('Offline'),'offline result must carry the Offline badge');
assert(document.querySelector('.seat-result').textContent.includes(packState.rooms[0].name),'offline result must come from the pack, not the live mock');
await click("Next student");
// Case D — a live 5xx falls back to the pack instead of showing the error.
fetchMode='500';await enter(seatedRoll);await submit();
await waitFor(()=>document.querySelector('.seat-result'),'5xx should fall back to the offline pack');
assert(!document.querySelector('[role="alert"]'),'5xx must not show the server error when the pack has the seat');
await click("Next student");
// Case C — offline QR: drive the exact callback the scanner invokes after
// decoding (jsdom has no camera, so the callback is invoked directly).
fetchMode='throw';await click("Scan QR code");assert(document.querySelector('.qr-scanner'));
const scannerEl=document.querySelector('.qr-scanner');
const fiberKey=Object.keys(scannerEl).find(k=>k.startsWith('__reactFiber$'));
let fiber=scannerEl[fiberKey];
while(fiber&&typeof fiber.memoizedProps?.onScan!=='function')fiber=fiber.return;
assert(fiber,'scanner onScan callback not found');
await act(async()=>{fiber.memoizedProps.onScan(seatedToken);await pause();await pause()});
await waitFor(()=>document.querySelector('.seat-result'),'offline QR lookup should show a seat');
assert(document.body.textContent.includes('Offline'),'offline QR result must carry the Offline badge');
await act(async()=>{root2.unmount()});dom.window.close();console.log('PASS: volunteer UI has no admin state, Bengali roll submission, result, refresh/reset, error, scanner opening/closing, offline fallback (live 4xx kept, network/5xx fall back, offline QR)');
