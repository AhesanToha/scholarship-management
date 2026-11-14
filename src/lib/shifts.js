// Exam shifts: same day, same centre, different start times.
// The list itself is dynamic in Settings (times / labels can change),
// and each category points at one shift — see categories.js.
// Everything here is backward compatible: an exam without `shifts`
// behaves exactly like the old single-shift exam (Shift 1, 10:00).
export const DEFAULT_SHIFTS=[
 {id:'shift-1',label:'Shift 1',time:'10:00'},
 {id:'shift-2',label:'Shift 2',time:'14:00'},
];
export function shiftsFor(exam={}){
 if(!Array.isArray(exam.shifts)||!exam.shifts.length)return DEFAULT_SHIFTS.map(s=>({...s}));
 return exam.shifts.map(s=>({id:String(s.id),label:String(s.label||s.id),time:String(s.time)}));
}
export function shiftById(exam={},id){
 const list=shiftsFor(exam);
 return list.find(s=>s.id===id)||list[0];
}
export function validateShifts(exam={}){
 if(exam.shifts===undefined)return;
 const list=exam.shifts;
 if(!Array.isArray(list)||!list.length||list.length>4)throw Error('Add between 1 and 4 shifts.');
 const ids=new Set();
 for(const s of list){
  if(!s||typeof s.id!=='string'||!s.id||ids.has(s.id))throw Error('Each shift needs a unique id.');
  ids.add(s.id);
  if(typeof s.label!=='string'||!s.label.trim()||s.label.length>30)throw Error('Enter a shift name (up to 30 characters).');
  if(typeof s.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time))throw Error('Enter a valid shift start time (HH:MM).');
 }
}
export function defaultShiftIdForIndex(index,exam={}){
 const list=shiftsFor(exam);
 return list[Math.min(index,list.length-1)].id;
}
export function formatShiftTime(time){
 if(typeof time!=='string')return '—';
 const m=time.match(/^(\d{2}):(\d{2})$/);
 if(!m)return time;
 let h=Number(m[1]);const ampm=h>=12?'PM':'AM';h=h%12||12;
 return `${h}:${m[2]} ${ampm}`;
}
export function shiftDisplay(exam={},id){
 const s=shiftById(exam,id);
 return `${s.label} · ${formatShiftTime(s.time)}`;
}
