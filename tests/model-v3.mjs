import assert from 'node:assert/strict';
import {seed, ensureTokens, validateBackup, seatKey, capacity, snapshot} from '../src/lib/domain.js';
import {seatConflicts} from '../src/lib/seat-rules.js';
import {migrateState, shiftForGrade} from '../src/lib/schema.js';

// 1. A v1/v2 backup migrates without losing seats, rolls or tokens.
const legacy = {
  exam: {name: 'Legacy Exam', center: 'Old Centre', date: '2027-01-10', time: '10:00'},
  rooms: [{id: 'r1', name: '101', building: 'A', floor: '1', directions: 'Go', benches: 4, per: 2, columnBenches: [2, 2]}],
  students: [
    {
      id: 's1',
      name: 'One',
      school: 'School A',
      grade: '5',
      roll: '260001',
      qrToken: 'token-one-1234-4234-8234-123456789abc',
      seat: {roomId: 'r1', room: '101', building: 'A', floor: '1', directions: 'Go', bench: 1, position: 'A'},
    },
    {id: 's2', name: 'Two', school: 'School B', grade: '6', roll: '260002', qrToken: 'token-two-1234-4234-8234-123456789abc'},
  ],
};
migrateState(legacy);
assert.equal(legacy.schemaVersion, 3);
assert.equal(legacy.exam.year, 2027);
assert.equal(legacy.exam.centers.length, 1);
assert.equal(legacy.exam.centers[0].name, 'Old Centre');
assert.equal(legacy.exam.shifts.length, 1);
assert.equal(legacy.exam.shifts[0].start, '10:00');
const centerId = legacy.exam.centers[0].id,
  shiftId = legacy.exam.shifts[0].id;
assert.equal(legacy.rooms[0].centerId, centerId);
assert.equal(legacy.students[0].centerId, centerId);
assert.equal(legacy.students[0].shiftId, shiftId);
assert.equal(legacy.students[0].seat.shiftId, shiftId);
assert.equal(legacy.students[0].status, 'active');
assert.equal(legacy.students[0].presentAt, null);
validateBackup(legacy);

const again = structuredClone(legacy);
migrateState(again);
assert.deepEqual(again, legacy, 'migration must be idempotent');
console.log('PASS: legacy state migrates to one centre + one shift, seats keep shift/centre, idempotent');

// 2. Same physical seat is reusable across shifts, but not inside one shift.
const state = seed();
ensureTokens(state);
validateBackup(state);
const room = state.rooms[0],
  firstShift = state.exam.shifts[0].id,
  secondShift = 'shift-afternoon';
state.exam.shifts.push({id: secondShift, name: 'Afternoon', start: '14:00', reportBy: '13:30', duration: '1 Hour 20 Minutes', order: 2});
const [a, b] = state.students;
const seat = {
  shiftId: firstShift,
  centerId: room.centerId,
  roomId: room.id,
  room: room.name,
  building: room.building,
  floor: room.floor,
  directions: room.directions,
  bench: 1,
  position: 'A',
};
a.seat = {...seat};
b.seat = {...seat};
assert.throws(() => validateBackup(structuredClone(state)), /Duplicate seat/);
b.shiftId = secondShift;
b.seat.shiftId = secondShift;
validateBackup(structuredClone(state));
assert.equal(seatConflicts(state, room.id, firstShift).length, 0);
assert.equal(seatConflicts(state, room.id, secondShift).length, 0);
assert.equal(seatConflicts(state).length, 0, 'different shifts never conflict');
assert.equal(seatKey(a.seat), firstShift + ':' + room.id + ':1:A');
console.log('PASS: duplicate seat rejected inside a shift, allowed across shifts, conflict scan is shift-aware');

// 3. Seat shift must match the student's shift.
const mismatch = structuredClone(state);
mismatch.students[1].shiftId = firstShift;
assert.throws(() => validateBackup(mismatch), /Invalid seat shift/);
console.log('PASS: seat shift must match student shift');

// 4. Withdrawn students cannot keep a seat.
const withdrawn = structuredClone(state);
withdrawn.students[0].status = 'withdrawn';
assert.throws(() => validateBackup(withdrawn), /Withdrawn/);
withdrawn.students[0].seat = null;
validateBackup(withdrawn);
console.log('PASS: withdrawn students cannot hold a seat');

// 5. Unknown centre is rejected.
const unknown = structuredClone(state);
unknown.rooms[0].centerId = 'missing-centre';
assert.throws(() => validateBackup(unknown), /Invalid capacity/);
console.log('PASS: unknown centre rejected');

// 6. Category mapping picks a shift, with a first-shift fallback.
state.exam.categories = [
  {id: 'p', name: 'PRIMARY', from: 4, to: 5, shiftId: firstShift},
  {id: 'j', name: 'JUNIOR', from: 6, to: 8, shiftId: secondShift},
];
assert.equal(shiftForGrade(state, '5'), firstShift);
assert.equal(shiftForGrade(state, '৬'), secondShift);
assert.equal(shiftForGrade(state, '9'), firstShift);
validateBackup(structuredClone(state));
console.log('PASS: category shift mapping works with Bengali digits and falls back');

// 7. Capacity and snapshot carry centre/shift context.
assert.equal(capacity(state), 5 * 10 * 2);
assert.equal(capacity(state, room.centerId), 5 * 10 * 2);
const snap = snapshot(state, a);
assert.equal(snap.shift.id, firstShift);
assert.equal(snap.center.id, room.centerId);
assert.equal(snap.v, 3);
console.log('PASS: capacity and snapshot expose centre/shift context');
