import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';import {build} from 'esbuild';
import {seed,ensureTokens} from '../src/lib/domain.js';
import {createExamStore} from '../src/lib/store.js';

// UI: choosing a CSV file opens a detailed confirmation popup (per school,
// per class, per shift) instead of importing silently; confirming imports
// only the valid rows, shows the result, and the new students are visible
// in the list right away.
await build({entryPoints:['src/App.jsx'],bundle:true,platform:'node',format:'esm',outdir:'tests/.compiled',packages:'external',jsx:'automatic'});
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://example.org/students'});globalThis.window=dom.window;globalThis.document=dom.window.document;Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.location=dom.window.location;globalThis.localStorage=dom.window.localStorage;globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.confirm=()=>true;globalThis.alert=()=>{};globalThis.FormData=dom.window.FormData;globalThis.HTMLElement=dom.window.HTMLElement;globalThis.HTMLInputElement=dom.window.HTMLInputElement;globalThis.URL.createObjectURL=()=>'blob:x';globalThis.URL.revokeObjectURL=()=>{};
const media=query=>({matches:false,media:query,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){},dispatchEvent(){return false}});window.matchMedia=media;globalThis.matchMedia=media;globalThis.getComputedStyle=window.getComputedStyle.bind(window);globalThis.requestAnimationFrame=fn=>setTimeout(fn,0);globalThis.cancelAnimationFrame=clearTimeout;globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};window.ResizeObserver=globalThis.ResizeObserver;window.HTMLElement.prototype.scrollIntoView=function(){};window.print=()=>{};
// This jsdom version has no Blob.text(), which the import reads the file
// with — polyfill it from FileReader (real browsers have it natively).
if(!window.File.prototype.text)window.File.prototype.text=function(){return new Promise((res,rej)=>{const r=new window.FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsText(this)})};
const {default:React,act}=await import('react'),{createRoot}=await import('react-dom/client'),{default:App}=await import('./.compiled/App.js');
let model=seed();ensureTokens(model);
model.students=model.students.filter(s=>s.school==='Aunushilon Academy');
model.schools=[{id:'school-aunushilon',name:'Aunushilon Academy',active:true,username:'aunushilon',createdAt:new Date().toISOString()},{id:'school-grammer',name:'Grammer School',active:true,username:'grammer',createdAt:new Date().toISOString()}];
model.schoolSubmissions=[];model.schoolEditRequests=[];
let revision='1';
let bulkFails=false;
const fetcher=async(path,options={})=>{
  if(path==='/api/me')return {json:async()=>({owner:true,testing:true,configured:true})};
  if(path==='/api/school-admin/students/bulk'&&options.method==='POST'){
    if(bulkFails)return {ok:false,json:async()=>({error:'Seating is locked.'})};
    const body=JSON.parse(options.body);
    const incoming=body.students.map((s,i)=>({...s,id:crypto.randomUUID(),school:'Grammer School',roll:'2699'+String(model.students.length+i).padStart(3,'0'),qrToken:'token-'+i,seat:null,present:false,registrationSource:'admin',createdAt:new Date().toISOString()}));
    model.students.push(...incoming);
    return {ok:true,json:async()=>({students:incoming,count:incoming.length})};
  }
  if(options.method==='PUT'){const body=JSON.parse(options.body);model=body.state;revision=String(Number(revision)+1);return {ok:true,json:async()=>({revision})}}
  return {ok:true,json:async()=>({state:structuredClone(model),revision})};
};
globalThis.fetch=fetcher;
const store=createExamStore({initial:structuredClone(model),fetcher,persist(){}});
const pause=()=>new Promise(r=>setTimeout(r,5));
async function waitForText(text){for(let i=0;i<60;i++){if(document.body.textContent.includes(text))return;await pause()}assert(document.body.textContent.includes(text),'expected the page to show: '+text)}
async function click(el){await act(async()=>{el.dispatchEvent(new window.MouseEvent('click',{bubbles:true}));await pause();await pause()})}
const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes(text));
async function chooseCsv(text){
  const file=new window.File([text],'students.csv',{type:'text/csv'});
  const input=document.querySelector('input[type="file"][accept=".csv"]');
  Object.defineProperty(input,'files',{value:[file],configurable:true});
  await act(async()=>{input.dispatchEvent(new window.Event('change',{bubbles:true}));await pause();await pause()});
}
const root=createRoot(document.getElementById('root'));
await act(async()=>{root.render(React.createElement(App,{store}));await pause();await pause();await pause()});
assert(document.body.textContent.includes('Showing 50 / 50 students'),'expected the Students page with the 50 Aunushilon students');

// A clean 4-row Grammer file opens the confirmation popup with the detail.
await chooseCsv('name,school,grade\nRahim,"Grammer School",4\nKarim,"Grammer School",4\nSalma,"Grammer School",6\nNadia,"Grammer School",6\n');
await waitForText('Confirm CSV import');
assert(document.body.textContent.includes('Grammer School — 4 students'),'popup should name the school and its count');
assert(document.body.textContent.includes('Class 4: 2 · Shift 1'),'popup should break down Class 4 into its shift');
assert(document.body.textContent.includes('Class 6: 2 · Shift 2'),'popup should break down Class 6 into its shift');
assert(document.body.textContent.includes('Shift 1: 2 students'),'popup should total Shift 1');
assert(document.body.textContent.includes('Shift 2: 2 students'),'popup should total Shift 2');
assert(!document.body.textContent.includes('will be skipped'),'a clean file has no skipped rows');
// Nothing is imported until confirmed.
assert.equal(store.getSnapshot().state.students.length,50,'choosing a file must not import yet');
// Confirm: only the valid rows go, the result shows, and the list now
// shows the imported school's students.
await click(button('Import 4 students'));
await waitForText('4 students imported. Total students now: 54.');
assert(document.body.textContent.includes('Showing Grammer School students below.'),'result should say which students are shown');
await click(button('Done'));
assert(!document.querySelector('.mantine-Modal-root'),'popup should close');
assert(document.body.textContent.includes('Showing 4 / 54 students'),'the list should show the 4 new Grammer students right away');
assert(document.body.textContent.includes('Rahim'),'the imported student should be in the list');

// A file with a bad row: the popup lists the problem, imports only the
// good row, and the bad row is skipped — never a silent whole-batch failure.
await chooseCsv('name,school,grade\nTania,"Grammer School",5\nBabul,"Unknown School",5\n');
await waitForText('Confirm CSV import');
assert(document.body.textContent.includes('1 row will be skipped'),'popup should warn about the skipped row');
assert(document.body.textContent.includes('Row 3:'),'popup should give the bad row number');
assert(document.body.textContent.includes('not a registered active school'),'popup should give the reason');
await click(button('Import 1 student'));
await waitForText('1 student imported. Total students now: 55.');
await click(button('Done'));
assert(document.body.textContent.includes('Showing 5 / 55 students'),'the list should show all 5 Grammer students now');

// A failed import keeps the popup open with the error, so the user can
// retry without picking the file again.
bulkFails=true;
await chooseCsv('name,school,grade\nZaman,"Grammer School",5\n');
await waitForText('Confirm CSV import');
await click(button('Import 1 student'));
await waitForText('Seating is locked.');
assert(document.querySelector('.mantine-Modal-root'),'a failed import must keep the popup open');
await click(button('Cancel'));
assert(!document.querySelector('.mantine-Modal-root'),'popup should close');
await act(async()=>{root.unmount()});
console.log('PASS: CSV import UI — detailed confirmation popup, valid rows only, result with new total, imported students visible immediately');
