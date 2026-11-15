import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';import {build} from 'esbuild';
import {seed,ensureTokens,allocationCandidates,buildMultiRoomAllocationPlan,applyMultiRoomAllocationPlan,validateBackup} from '../src/lib/domain.js';
import {seatConflicts} from '../src/lib/seat-rules.js';
import {shiftForStudent} from '../src/lib/categories.js';
import {createExamStore} from '../src/lib/store.js';

// 1. Domain: auto-allocate Shift 1 (Class 4-5, 20 demo students, all from
// one school — strict rules spread them across rooms) and Shift 2 (80).
let state=seed();ensureTokens(state);
const multi=buildMultiRoomAllocationPlan(state,{shiftId:'shift-1',grades:['4','5']});
assert.equal(multi.assignments.length,20);
assert(multi.plans.length>=2,'expected one-school Shift 1 students to spread across rooms');
assert.deepEqual(multi.remaining,[]);
assert.equal(multi.plans[0].roomId,state.rooms[0].id);
applyMultiRoomAllocationPlan(state,multi);
assert.equal(seatConflicts(state).length,0);
assert.equal(state.students.filter(s=>s.seat&&shiftForStudent(s,state.exam)==='shift-1').length,20);
validateBackup(structuredClone(state));
// Shift 2 can still reuse the same benches afterwards.
const multi2=buildMultiRoomAllocationPlan(state,{shiftId:'shift-2',grades:['6','7','8']});
assert.equal(multi2.assignments.length,80);
assert.equal(multi2.plans.length,5,'expected the last rooms to take 10 each once one school/class dominates the remainder');
applyMultiRoomAllocationPlan(state,multi2);
assert.equal(seatConflicts(state).length,0);
// Stale preview guard: changing data after preview blocks the apply.
const stale=buildMultiRoomAllocationPlan(seed(),{shiftId:'shift-1',grades:['4','5']});
const changed=seed();changed.students[0].name='Changed';
assert.throws(()=>applyMultiRoomAllocationPlan(changed,stale),/Data has changed/);
// Fill mode only: no candidates left -> clear error, not a silent empty plan.
assert.throws(()=>buildMultiRoomAllocationPlan(state,{shiftId:'shift-1',grades:['4','5']}),/No unassigned students/);
// Candidates are per-shift/per-class: a Shift-2-only student set has no
// Shift 1 candidates, even though 80 students are unassigned in total.
// The panel must say which shift/class the 0 belongs to (see UI test 3).
const onlyShift2=seed();onlyShift2.students=onlyShift2.students.filter(s=>['6','7','8'].includes(s.grade));
assert.equal(allocationCandidates(onlyShift2,{shiftId:'shift-1',grades:['4','5']}).length,0);
assert.equal(onlyShift2.students.filter(s=>!s.seat).length,80);

// 2. UI: shift tabs on top, no inline allocation panel — allocation opens
// as a modal wizard from a room card or the auto-fill button. Single-room
// apply keeps the selection and offers the next room; "All rooms" previews
// and fills the rest of the shift in one go.
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
assert(tabs[0].textContent.includes('0 / 20 assigned'));
assert(tabs[1].textContent.includes('Shift 2')&&tabs[1].textContent.includes('2:00 PM'));
assert(tabs[1].textContent.includes('0 / 80 assigned'));
// No inline allocation panel any more — the page is tabs, cards, room.
assert(!document.querySelector('#allocation-panel'),'allocation must live in the wizard, not an inline panel');
assert(!document.body.textContent.includes('Allocate seating'),'no inline allocation panel on the page');
const room0=model.rooms[0].id,room1=model.rooms[1].id;
const modal=()=>document.querySelector('.mantine-Modal-root');
const modalTitle=()=>document.querySelector('.mantine-Modal-title').textContent;
const modalSelects=()=>[...modal().querySelectorAll('select')];
// Open the wizard from the room card's Allocate button.
await click(document.querySelector(`a.room-summary-card[href="/rooms/${room0}"]`));
await click(button("Allocate",document.querySelector(`a.room-summary-card[href="/rooms/${room0}"]`)));
assert(modal(),'expected the allocation wizard modal to open');
assert(modalTitle().includes('Room '+model.rooms[0].name),'wizard should name its room');
// Shift 2 for the single-room flow: its demo students come from two
// schools, so a room fills up (Shift 1's demo students are one school).
await input(modalSelects()[0],'shift-2');
const class8=[...modal().querySelectorAll('label')].find(l=>l.textContent.trim()==='Class 8');
await click(class8.querySelector('input'));
await click(button("Preview allocation"));assert(document.body.textContent.includes('Preview: 20 students'));
await click(button("Confirm allocation"));
assert.equal(store.getSnapshot().state.students.filter(s=>s.seat?.roomId===room0).length,20);
// The wizard's shift change follows the page tab, so the result is visible.
assert(document.querySelector('.shift-tab.is-active').textContent.includes('Shift 2'),'wizard shift change should follow the page tab');
// Selection is kept and the next room is offered.
assert(button("Next room"),'expected a Next room button after applying');
await click(button("Next room"));
assert(modalTitle().includes('Room '+model.rooms[1].name),'expected the wizard to move to the next room with free seats');
assert.equal(modalSelects()[0].value,'shift-2','expected the wizard shift to be kept for the next room');
// Close the wizard, switch to the Shift 2 tab, then auto-allocate the
// rest of Shift 2 in one go.
await click(button("Cancel"));
assert(!modal(),'expected the wizard to close');
await click(tabs[1]);
await click(button("Auto-fill all rooms"));
assert(modalTitle().includes('Auto-fill'),'expected the multi-room wizard');
await click(button("Preview allocation"));
assert(document.body.textContent.includes('across 4 rooms'),'expected the multi-room preview to name the room count');
await click(button("Confirm allocation"));
assert.equal(store.getSnapshot().state.students.filter(s=>s.seat&&['6','7','8'].includes(s.grade)).length,80);
assert.equal(new Set(store.getSnapshot().state.students.filter(s=>s.seat&&['6','7','8'].includes(s.grade)).map(s=>s.seat.roomId)).size,5);
const doneNotice=document.querySelector('.mantine-Modal-root [role="status"]').textContent;
assert(doneNotice.includes('All selected students have seats'),'multi done text should confirm all selected students have seats');
assert(!doneNotice.includes('No more rooms'),'multi done text must not claim no rooms have empty seats');
await click(button("Done"));
// Switching the shift tab switches the room cards and the wizard default.
await click(tabs[0]);
assert(document.querySelector('.room-summary-card').textContent.includes('Empty'),'expected room cards to show the Shift 1 (empty) state');
await click(button("Auto-fill all rooms"));
assert.equal(modalSelects()[0].value,'shift-1','expected the wizard shift to follow the tab');
await click(button("Cancel"));
// Rebuild: rearrange a full room without losing seats or breaking rules.
await click(button("Allocate",document.querySelector(`a.room-summary-card[href="/rooms/${room0}"]`)));
await input(modalSelects()[0],'shift-2');
const class8b=[...modal().querySelectorAll('label')].find(l=>l.textContent.trim()==='Class 8');
await click(class8b.querySelector('input'));
await input(modalSelects()[1],'yes');
await click(button("Preview allocation"));
assert(document.body.textContent.includes('will be rearranged'),'rebuild preview should say assignments will be rearranged');
await click(button("Confirm allocation"));
assert.equal(store.getSnapshot().state.students.filter(s=>s.seat?.roomId===room0).length,20,'rebuilt room should still hold 20 students');
assert.equal(seatConflicts(store.getSnapshot().state).length,0,'rebuilt room must not break separation rules');
await click(button("Done"));
await act(async()=>{root.unmount()});
// 3. Count honesty: with only Shift 2 students in the data, the Shift 1
// heading must still name its shift and classes, and the empty state must
// show where the unassigned students actually are — never a bare "0".
const shift2Only=seed();shift2Only.students=shift2Only.students.filter(s=>['6','7','8'].includes(s.grade));ensureTokens(shift2Only);let revision2='1';
const fetcher2=async(path,options={})=>{if(path==='/api/me')return {json:async()=>({owner:true,testing:true,configured:true})};if(options.method==='PUT'){const body=JSON.parse(options.body);shift2Only=body.state;revision2=String(Number(revision2)+1);return {ok:true,json:async()=>({revision:revision2})}}return {ok:true,json:async()=>({state:structuredClone(shift2Only),revision:revision2})}};
globalThis.fetch=fetcher2;const store2=createExamStore({initial:structuredClone(shift2Only),fetcher:fetcher2,persist(){}});const root2=createRoot(document.getElementById('root'));
await act(async()=>{root2.render(React.createElement(App,{store:store2}));await pause();await pause()});
const modal2=()=>document.querySelector('.mantine-Modal-root');
await click(button("Auto-fill all rooms"));
assert(modal2(),'expected the allocation wizard modal to open');
const heading=document.querySelector('#available-candidates h3').textContent;
assert(heading.includes('Shift 1'),'heading should name the shift');
assert(heading.includes('Class 4, 5'),'heading should name the selected classes');
assert(heading.includes('0 students'),'heading should show 0 for Shift 1');
const empty=document.querySelector('#available-candidates .empty').textContent;
assert(empty.includes('Total unassigned: 80'),'empty state should show the real total');
assert(empty.includes('Shift 2: 80'),'empty state should show where the students are');
assert(empty.includes('Shift 1: 0'),'empty state should show the empty shift too');
// The school filter must be named too: with Grammer School selected, no
// Shift or Class change can reveal the students, so the heading and the
// advice must say Schools as well.
const grammer=[...modal2().querySelectorAll('label')].find(l=>l.textContent.trim()==='Grammer School');
await click(grammer.querySelector('input'));
const heading2=document.querySelector('#available-candidates h3').textContent;
assert(heading2.includes('Grammer School'),'heading should name the selected school');
assert(heading2.includes('0 students'),'heading should still show 0 for Shift 1');
const empty2=document.querySelector('#available-candidates .empty').textContent;
assert(empty2.includes('Schools'),'empty-state advice should mention Schools when a school is selected');
await click(button("Cancel"));
await act(async()=>{root2.unmount()});

// 4. Deep link: opening /rooms/<id>?allocate=1 opens the wizard for that room.
let model4=seed();ensureTokens(model4);let revision4='1';
const dom4=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://example.org/rooms/'+model4.rooms[0].id+'?allocate=1'});
globalThis.window=dom4.window;globalThis.document=dom4.window.document;Object.defineProperty(globalThis,'navigator',{value:dom4.window.navigator,configurable:true});globalThis.location=dom4.window.location;globalThis.localStorage=dom4.window.localStorage;globalThis.FormData=dom4.window.FormData;globalThis.HTMLElement=dom4.window.HTMLElement;globalThis.HTMLInputElement=dom4.window.HTMLInputElement;
window.matchMedia=media;globalThis.matchMedia=media;globalThis.getComputedStyle=window.getComputedStyle.bind(window);globalThis.requestAnimationFrame=fn=>setTimeout(fn,0);globalThis.cancelAnimationFrame=clearTimeout;globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};window.ResizeObserver=globalThis.ResizeObserver;window.HTMLElement.prototype.scrollIntoView=function(){};window.print=()=>{};
const fetcher4=async(path,options={})=>{if(path==='/api/me')return {json:async()=>({owner:true,testing:true,configured:true})};if(options.method==='PUT'){const body=JSON.parse(options.body);model4=body.state;revision4=String(Number(revision4)+1);return {ok:true,json:async()=>({revision:revision4})}}return {ok:true,json:async()=>({state:structuredClone(model4),revision:revision4})}};
globalThis.fetch=fetcher4;const store4=createExamStore({initial:structuredClone(model4),fetcher:fetcher4,persist(){}});const root4=createRoot(document.getElementById('root'));
await act(async()=>{root4.render(React.createElement(App,{store:store4}));await pause();await pause()});
assert(document.querySelector('.mantine-Modal-root'),'deep link ?allocate=1 should open the wizard');
assert(document.querySelector('.mantine-Modal-title').textContent.includes('Room '+model4.rooms[0].name),'deep link wizard should name its room');
await act(async()=>{root4.unmount()});
console.log('PASS: allocation UX — shift tabs with per-shift progress, modal wizard (setup → preview → confirm → next room), auto-fill all rooms for a shift, honest unassigned counts, rebuild mode, ?allocate=1 deep link');
