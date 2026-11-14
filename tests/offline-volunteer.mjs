import assert from 'node:assert/strict';
import {seed,ensureTokens,buildAllocationPlan,applyAllocationPlan} from '../src/lib/domain.js';
import {buildOfflinePack,verifyOfflinePack,offlineSeatResult,offlineRollForToken,sha256Hex} from '../src/lib/offline-pack.js';
import {api} from '../worker/api.js';

// 1. Pack contents: no personal data, shift on every record, QR works
// through a token-hash map, checksum verifies, tampering fails.
let state=seed();ensureTokens(state);
applyAllocationPlan(state,buildAllocationPlan(state,{roomId:state.rooms[0].id,grades:['6','7']}));
state.exam.locked=true;
const pack=await buildOfflinePack(state);
assert.equal(pack.v,1);
assert.equal(pack.totalCount,state.students.length);
assert.equal(pack.examDate,state.exam.date);
const dumped=JSON.stringify(pack);
for(const s of state.students){
 assert(!dumped.includes(s.name),'pack must not contain student names');
 assert(!dumped.includes(s.qrToken),'pack must not contain plain QR tokens');
}
assert(!dumped.includes('Aunushilon Academy')&&!dumped.includes('Grammer School'),'pack must not contain school names');
assert(!dumped.includes('fatherName')&&!dumped.includes('guardianPhone')&&!dumped.includes('photoId'),'pack must not contain personal fields');
const seated=state.students.filter(s=>s.seat);
assert.equal(pack.seats.filter(s=>s.seat).length,seated.length);
assert(pack.seats.every(s=>s.shift==='shift-1'||s.shift==='shift-2'),'every record must carry its shift');
assert.equal(await verifyOfflinePack(pack),true);
const tampered=structuredClone(pack);tampered.seats.find(s=>s.seat).seat.bench=9;
assert.equal(await verifyOfflinePack(tampered),false);
const versionChanged=structuredClone(state);const firstSeat=versionChanged.students.find(s=>s.seat);firstSeat.seat.position=firstSeat.seat.position==='A'?'B':'A';
assert.notEqual((await buildOfflinePack(versionChanged)).version,pack.version,'any seat change must change the pack version');
assert.equal(await sha256Hex('offline-test'),await sha256Hex('offline-test'),'hashing must be deterministic');
// Roll lookup returns the live response shape, marked offline.
const known=state.students.find(s=>s.seat);
const result=offlineSeatResult(pack,known.roll);
assert.equal(result.roll,known.roll);assert.equal(result.live,false);
assert.equal(result.seat.bench,known.seat.bench);
assert.equal(result.seat.room,state.rooms.find(r=>r.id===known.seat.roomId).name);
assert.equal(result.exam.shift.label,'Shift 2');
assert.equal(offlineSeatResult(pack,known.roll.replace(/[0-9]/g,n=>'০১২৩৪৫৬৭৮৯'[Number(n)])).roll,known.roll,'Bengali digits must work offline too');
assert.equal(offlineSeatResult(pack,'999999'),null);
const unassigned=state.students.find(s=>!s.seat);
assert.equal(offlineSeatResult(pack,unassigned.roll).seat,null,'unassigned students resolve with no seat, like live');
// QR lookup: token hash -> roll; a wrong token finds nothing.
assert.equal(await offlineRollForToken(pack,known.qrToken),known.roll);
assert.equal(await offlineRollForToken(pack,'not-a-real-token-1234567890'),null);

// 2. Worker endpoint: locked-only, version-only check, no state -> 404.
let stored=JSON.stringify(state),version=1;
const bucket={async get(){return stored?{etag:String(version),json:async()=>JSON.parse(stored)}:null},async head(){return stored?{etag:String(version)}:null},async put(k,v){stored=v;version++;return {etag:String(version)}}};
const env={BUCKET:bucket,ADMIN_EMAIL:'owner@example.org'};
let res=await api(new Request('https://example.org/api/volunteer/offline-pack'),env);
assert.equal(res.status,200);
const fetched=await res.json();
assert.equal(fetched.version,pack.version,'same seating must produce the same version');
assert.equal(fetched.totalCount,state.students.length);
assert.equal(await verifyOfflinePack(fetched),true);
res=await api(new Request('https://example.org/api/volunteer/offline-pack?version=1'),env);
const info=await res.json();
assert.equal(info.version,pack.version);assert.equal(info.locked,true);assert.equal(info.totalCount,state.students.length);
assert(!('seats' in info),'version check must not send the pack');
const unlocked=structuredClone(state);unlocked.exam.locked=false;stored=JSON.stringify(unlocked);
assert.equal((await api(new Request('https://example.org/api/volunteer/offline-pack'),env)).status,409,'pack must require locked seating');
stored=null;
assert.equal((await api(new Request('https://example.org/api/volunteer/offline-pack'),env)).status,404);

// 3. IndexedDB storage round-trip, with a small in-memory fake.
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
const {savePack,loadPack,clearPack}=await import('../src/lib/offline-seats.js');
const saved=await savePack(pack);
assert.equal(saved.version,pack.version);assert(saved.downloadedAt);
const loaded=await loadPack();
assert.equal(loaded.version,pack.version);assert.equal(loaded.totalCount,pack.totalCount);
assert.equal(offlineSeatResult(loaded,known.roll).seat.bench,known.seat.bench);
await clearPack();
assert.equal(await loadPack(),null);
await assert.rejects(()=>savePack(tampered),/integrity/,'a tampered pack must never be stored');
delete globalThis.indexedDB;
assert.equal(await loadPack(),null,'without IndexedDB the lookup must degrade to null, never throw');
console.log('PASS: offline volunteer pack — no personal data, shift per record, QR hash map + roll lookup, locked-only endpoint with version check, IndexedDB round-trip');
