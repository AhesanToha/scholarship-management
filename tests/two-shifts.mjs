import assert from 'node:assert/strict';
import {seed,ensureTokens,buildAllocationPlan,applyAllocationPlan,validateBackup,filteredStudents} from '../src/lib/domain.js';
import {seatConflicts} from '../src/lib/seat-rules.js';
import {shiftsFor,validateShifts,shiftById,formatShiftTime} from '../src/lib/shifts.js';
import {categories,shiftForGrade,shiftForStudent,gradesForShift} from '../src/lib/categories.js';

// 1. Defaults: two shifts, 10:00 AM and 2:00 PM; PRIMARY -> Shift 1, JUNIOR -> Shift 2.
let state=seed();ensureTokens(state);
assert.deepEqual(shiftsFor(state.exam).map(s=>[s.label,s.time]),[['Shift 1','10:00'],['Shift 2','14:00']]);
assert.equal(formatShiftTime('10:00'),'10:00 AM');
assert.equal(formatShiftTime('14:00'),'2:00 PM');
assert.equal(shiftForGrade('4',state.exam),'shift-1');
assert.equal(shiftForGrade('5',state.exam),'shift-1');
assert.equal(shiftForGrade('6',state.exam),'shift-2');
assert.equal(shiftForGrade('8',state.exam),'shift-2');
assert.deepEqual(gradesForShift(state.exam,'shift-1'),['4','5']);
assert.deepEqual(gradesForShift(state.exam,'shift-2'),['6','7','8']);
assert.equal(shiftForStudent(state.students.find(s=>s.grade==='4'),state.exam),'shift-1');

// 2. Dynamic: changing the category -> shift mapping in Settings changes the shift.
// (This is what the Settings UI saves: categories[].shiftId.)
state.exam.categories=categories(state.exam).map(c=>c.id==='primary'?{...c,shiftId:'shift-2'}:{...c,shiftId:'shift-1'});
assert.equal(shiftForGrade('4',state.exam),'shift-2');
assert.equal(shiftForGrade('6',state.exam),'shift-1');
assert.equal(shiftById(state.exam,'shift-2').time,'14:00');
// Changing a shift time is picked up too.
state.exam.shifts=[{id:'shift-1',label:'Shift 1',time:'09:00'},{id:'shift-2',label:'Shift 2',time:'15:00'}];
assert.equal(formatShiftTime(shiftById(state.exam,'shift-1').time),'9:00 AM');
assert.equal(formatShiftTime(shiftById(state.exam,'shift-2').time),'3:00 PM');

// 3. Validation: bad shift time / unknown category shift are rejected.
assert.throws(()=>validateShifts({shifts:[{id:'shift-1',label:'Shift 1',time:'25:00'}]}));
assert.throws(()=>validateBackup({...structuredClone(seed()),exam:{...seed().exam,categories:[{id:'primary',name:'PRIMARY',from:4,to:5,shiftId:'nope'}]}}));

// 4. Seating is per shift: the same bench can be reused in the other shift,
// but two students of the SAME shift on the same bench still conflict.
state=seed();ensureTokens(state);
const room=state.rooms[0];
const plan1=buildAllocationPlan(state,{roomId:room.id,shiftId:'shift-1',grades:['4','5']});
assert(plan1.assignments.length>0);
applyAllocationPlan(state,plan1);
assert.equal(seatConflicts(state).length,0);
// Shift 2 allocates the SAME room: it must be able to reuse benches.
const plan2=buildAllocationPlan(state,{roomId:room.id,shiftId:'shift-2',grades:['6','7','8']});
assert(plan2.assignments.length>0);
applyAllocationPlan(state,plan2);
assert.equal(seatConflicts(state).length,0);
validateBackup(structuredClone(state));
// The two shifts share at least one bench (reuse actually happened).
const bySeat=new Map();
for(const s of state.students.filter(s=>s.seat?.roomId===room.id)){
 const k=s.seat.bench+':'+s.seat.position;
 if(!bySeat.has(k))bySeat.set(k,new Set());
 bySeat.get(k).add(shiftForStudent(s,state.exam));
}
assert([...bySeat.values()].some(set=>set.size===2),'expected a bench reused across shifts');
// Same-shift duplicate seat is still a conflict.
const dup=structuredClone(state);
const a=dup.students.find(s=>s.seat?.roomId===room.id&&shiftForStudent(s,dup.exam)==='shift-1');
const b=dup.students.find(s=>s.seat?.roomId===room.id&&shiftForStudent(s,dup.exam)==='shift-1'&&s.id!==a.id&&s.seat.bench!==a.seat.bench);
b.seat={...a.seat};
assert(seatConflicts(dup).length>0);
assert.throws(()=>validateBackup(dup));

// 5. Filters: Students / admit / room lists can filter by shift.
assert(filteredStudents(state,{shift:'shift-1'}).every(s=>shiftForStudent(s,state.exam)==='shift-1'));
assert(filteredStudents(state,{shift:'shift-2'}).length>0);
// Old data without any shift info still works (defaults apply).
const legacy=seed();delete legacy.exam.shifts;delete legacy.exam.categories;
assert.equal(shiftForGrade('4',legacy.exam),'shift-1');
assert.equal(shiftForGrade('7',legacy.exam),'shift-2');
validateBackup(structuredClone(legacy));

console.log('PASS: dynamic category-to-shift mapping in Settings, per-shift seating with bench reuse across shifts, same-shift conflicts still rejected, shift filters and legacy defaults');
