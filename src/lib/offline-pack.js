// Offline volunteer seat pack — pure logic, no DOM / IndexedDB here so the
// Worker, the browser and the tests all share the same code.
//
// Privacy rule (same as the live /api/volunteer/seat response): the pack
// holds ONLY what a volunteer needs to point a student at a seat — roll,
// shift, room, bench, seat position, directions and the room map layout.
// It NEVER holds names, schools, photos, guardian phones, father names or
// plain QR tokens. QR lookup works offline through a SHA-256(token) -> roll
// map, so a stolen pack still cannot reveal who a token belongs to.
//
// The pack version IS its checksum: any seat, room or exam change produces
// a different version, so a stale pack is always detectable.
import {shiftForStudent} from './categories.js';
import {shiftsFor,shiftById,formatShiftTime} from './shifts.js';
import {normalizedDigits} from './form-validation.js';

// Canonical JSON: object keys sorted recursively, so the same payload
// always hashes to the same checksum on Worker, browser and Node.
export function canonicalJson(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalJson(value[k])).join(',')+'}';
}

export async function sha256Hex(text){
 const digest=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

function roomLayout(r){
 const counts=r?.columnBenches;
 const valid=Array.isArray(counts)&&counts.length<=6&&counts.every(n=>Number.isInteger(n)&&n>0)&&counts.reduce((a,b)=>a+b,0)===r.benches;
 return {benches:r.benches,per:r.per,columns:valid?counts.length:(Number.isInteger(r.mapColumns)?r.mapColumns:null),columnBenches:valid?counts:null};
}

// Build the pack from the live state. Only call after seating is locked.
export async function buildOfflinePack(state,generatedAt=new Date().toISOString()){
 const exam=state.exam||{};
 const shifts=shiftsFor(exam).map(s=>({id:s.id,label:s.label,time:s.time}));
 const rooms=(state.rooms||[]).map(r=>({id:r.id,name:r.name,building:r.building,floor:r.floor,directions:r.directions,...roomLayout(r)}));
 const seats=[],tokenHashes={};
 for(const s of state.students||[]){
  seats.push({roll:s.roll,shift:shiftForStudent(s,exam),seat:s.seat?{roomId:s.seat.roomId,bench:s.seat.bench,position:s.seat.position}:null});
  if(s.qrToken)tokenHashes[await sha256Hex(s.qrToken)]=normalizedDigits(s.roll);
 }
 seats.sort((a,b)=>normalizedDigits(a.roll).localeCompare(normalizedDigits(b.roll),'en',{numeric:true}));
 const payload={exam:{name:exam.name||'',center:exam.center||'',date:exam.date||'',shifts},rooms,seats};
 const checksum=await sha256Hex(canonicalJson(payload));
 return {v:1,version:checksum,checksum,generatedAt,examDate:exam.date||'',examName:exam.name||'',center:exam.center||'',totalCount:seats.length,shifts,rooms,seats,tokenHashes};
}

// Recompute the checksum from the pack's own contents. Any tampering — or
// a pack built by an older format — fails.
export async function verifyOfflinePack(pack){
 try{
  if(!pack||pack.v!==1||!Array.isArray(pack.seats)||!Array.isArray(pack.rooms)||!Array.isArray(pack.shifts)||typeof pack.checksum!=='string')return false;
  if(pack.totalCount!==pack.seats.length)return false;
  if(pack.version!==pack.checksum)return false;
  const payload={exam:{name:pack.examName||'',center:pack.center||'',date:pack.examDate||'',shifts:pack.shifts},rooms:pack.rooms,seats:pack.seats};
  return (await sha256Hex(canonicalJson(payload)))===pack.checksum;
 }catch{return false}
}

// Roll lookup inside a pack. Returns the SAME shape as the live
// /api/volunteer/seat response (so SeatResult renders it unchanged),
// with live:false so the UI can badge it "Offline".
export function offlineSeatResult(pack,roll){
 const entry=(pack.seats||[]).find(s=>normalizedDigits(s.roll)===normalizedDigits(String(roll||'')));
 if(!entry)return null;
 const shift=shiftById({shifts:pack.shifts||[]},entry.shift);
 const room=entry.seat?(pack.rooms||[]).find(r=>r.id===entry.seat.roomId):null;
 return {v:2,live:false,roll:entry.roll,shift:shift?.id,
  exam:{name:pack.examName,center:pack.center,date:pack.examDate,time:shift?.time,shift:shift?{id:shift.id,label:shift.label,time:formatShiftTime(shift.time)}:undefined},
  seat:entry.seat&&room?{roomId:entry.seat.roomId,bench:entry.seat.bench,position:entry.seat.position,room:room.name,building:room.building,floor:room.floor,directions:room.directions}:null,
  layout:room?{benches:room.benches,per:room.per,columns:room.columns,columnBenches:room.columnBenches}:null};
}

// QR lookup inside a pack: hash the scanned token, map it to a roll.
export async function offlineRollForToken(pack,token){
 if(!pack||typeof token!=='string'||!token)return null;
 return pack.tokenHashes?.[await sha256Hex(token)]||null;
}
