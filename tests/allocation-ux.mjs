import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';import {build} from 'esbuild';
import {seed,ensureTokens,buildMultiRoomAllocationPlan,applyMultiRoomAllocationPlan,validateBackup} from '../src/lib/domain.js';
import {seatConflicts} from '../src/lib/seat-rules.js';
import {shiftForStudent} from '../src/lib/categories.js';
import {createExamStore} from '../src/lib/store.js';

// 1. Domain: auto-allocate Shift 1 (Class 4-5, 40 demo students) across rooms.
let state=seed();ensureTokens(state);
const multi=buildMultiRoomAllocationPlan(state,{shiftId:'shift-1',grades:['4','5']});
assert.equal(multi.assignments.length,40);
assert.equal(multi.plans.length,2,'expected 2 rooms of 20 seats each');
assert.deepEqual(multi.remaining,[]);
assert.equal(multi.plans[0].roomId,state.rooms[0].id);
assert.equal(multi.plans[1].roomId,state.rooms[1].id);
applyMultiRoomAllocationPlan(state,multi);
assert.equal(seatConflicts(state).length,0);
assert.equal(state.students.filter(s=>s.seat&&shiftForStudent(s,state.exam)==='shift-1').length,40);
assert.equal(state.students.filter(s=>s.seat?.roomId===state.rooms[0].id).length,20);
assert.equal(state.students.filter(s=>s.seat?.roomId===state.rooms[1].id).length,20);
validateBackup(structuredClone(state));
// Shift 2 can still reuse the same benches afterwards.
const multi2=buildMultiRoomAllocationPlan(state,{shiftId:'shift-2',grades:['6','7','8']});
assert.equal(multi2.assignments.length,60);
assert.equal(multi2.plans.length,3);
applyMultiRoomAllocationPlan(state,multi2);
assert.equal(seatConflicts(state).length,0);
// Stale preview guard: changing data after preview blocks the apply.
const stale=buildMultiRoomAllocationPlan(seed(),{shiftId:'shift-1',grades:['4','5']});
const changed=seed();changed.students[0].name='Changed';
assert.throws(()=>applyMultiRoomAllocationPlan(changed,stale),/Data has changed/);
// Fill mode only: no candidates left -> clear error, not a silent empty plan.
assert.throws(()=>buildMultiRoomAllocationPlan(state,{shiftId:'shift-1',grades:['4','5']}),/No unassigned students/);

// 2. UI: shift tabs on top, allocation panel above the room cards,
// single-room apply keeps the selection and offers the next room,
// "All rooms" previews and fills the rest of the shift in one go.
await build({entryPoints:['src/App.jsx'],bundle:true,platform:'node',format:'esm',outdir:'tests/.compiled',packages:'external',jsx:'automatic'});
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://example.org/rooms'});globalThis.window=dom.window;globalThis.document=dom.window.document;Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.location=dom.window.location;globalThis.localStorage=dom.window.localStorage;globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.confirm=()=>true;globalThis.alert=()=>{};globalThis.FormData=dom.window.FormData;globalThis.HTMLElement=dom.window.HTMLElement;globalThis.HTMLInputElement=dom.window.HTMLInputElement;globalThis.URL.createObjectURL=()=>'blob:x';globalThis.URL.revokeObjectURL=()=>{};
const media=query=>({matches:false,media:query,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){},dispatchEvent(){return false}});window.matchMedia=media;globalThis.matchMedia=media;globalThis.getComputedStyle=window.getComputedStyle.bind(window);globalThis.requestAnimationFrame=fn=>setTimeout(fn,0);globalThis.cancelAnimationFrame=clearTimeout;globalThis.ResizeObserver=class{observe(){} unobserve(){} disconnect(){}};window.ResizeObserver=globalThis.ResizeObserver;window.HTMLElement.prototype.scrollIntoView=function(){};window.print=()=>{};
const {default:React,act}=await import('react'),{createRoot}=await import('react-dom/client'),{default:App}=await import('./.compiled/App.js');
let model=seed();ensureTokens(model);let revision='1';
const fetcher=async(path,options={})=>{if(path==='/api/me')return {json:async()=>({owner:true,testing:true,configured:true})};if(options.method==='PUT'){const body=JSON.parse(options.body);model=body.state;revision=String(Number(revision)+1);return {ok:true,json:async()=>({revision})}}return {ok:true,json:async()=>({state:structuredClone(model),revision})}};
globalThis.fetch=fetcher;const store=createExamStore({initial:structuredClone(model),fetcher,persist(){}});const root=createRoot(document.getElementById('root'));
const pause=()=>new Promise(r=>setTimeout(r,5));async function click(node){assert(node,'missing click target');await act(async()=>{node.dispatchEvent(new window.MouseEvent('click',{bubbles:true,cancelable:true,button:0}));await pause()})}async function input(node,value){assert(node,'missing input');await act(async()=>{const proto=window.HTMLSelectElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(node,value);node.dispatchEvent(new window.Event('change',{bubbles:true}));await pause()})}
const button=(text,within=document)=>[...within.querySelectorAll('button')].find(b=>b.textContent.includes(text));
await act(async()=>{root.render(React.createElement(App,{store}));await pause();await pause()});
const tabs=[...document.querySelectorAll('.shift-tab')];
assert.equal(tabs.length,2,'expected one tab per shift');
assert(tabs[0].textContent.includes('Shift 1')&&tabs[0].textContent.includes('10:00 AM'));
assert(tabs[0].textContent.includes('0 / 40 assigned'));
assert(tabs[1].textContent.includes('Shift 2')&&tabs[1].textContent.includes('2:00 PM'));
// Allocation panel comes before the room cards in the page.
assert(document.body.textContent.indexOf('Allocate seating')<document.body.textContent.indexOf('Room D01'),'allocation panel should be above the room cards');
const room0=model.rooms[0].id,room1=model.rooms[1].id;
await click(document.querySelector(`a.room-summary-card[href="/rooms/${room0}"]`));
await click(document.querySelector('#active-room-panel a[href$="?allocate=1"]'));
assert(location.search.includes('allocate=1'));
await click(button("Preview allocation"));assert(document.body.textContent.includes('Preview: 20 students'));
await click(button("Confirm allocation"));
assert.equal(store.getSnapshot().state.students.filter(s=>s.seat?.roomId===room0).length,20);
// Selection is kept and the next room is offered.
assert(button("Next room"),'expected a Next room button after applying');
const selects=[...document.querySelectorAll('#allocation-panel select')];
await click(button("Next room"));
assert.equal(selects[1].value,room1,'expected the room select to move to the next room with free seats');
// Auto-allocate the rest of Shift 1 in one go.
await input(selects[1],'all');
await click(button("Preview allocation"));
assert(document.body.textContent.includes('across 1 room'),'expected the multi-room preview to name the room count');
await click(button("Confirm allocation"));
assert.equal(store.getSnapshot().state.students.filter(s=>s.seat&&['4','5'].includes(s.grade)).length,40);
assert.equal(new Set(store.getSnapshot().state.students.filter(s=>s.seat&&['4','5'].includes(s.grade)).map(s=>s.seat.roomId)).size,2);
// Switching the shift tab switches the allocation shift and the room cards.
await click(tabs[1]);
assert.equal(selects[0].value,'shift-2','expected the allocation shift to follow the tab');
assert(document.querySelector('.room-summary-card').textContent.includes('Empty'),'expected room cards to show the Shift 2 (empty) state');
await act(async()=>{root.unmount()});
console.log('PASS: allocation UX — shift tabs with per-shift progress, allocation panel on top, selection kept with Next room, auto-allocate all rooms for a shift');
