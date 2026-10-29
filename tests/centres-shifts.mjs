import assert from 'node:assert/strict';
import {api} from '../worker/api.js';
import {seed, ensureTokens} from '../src/lib/domain.js';

const objects = new Map();
let revision = 0;
const BUCKET = {
  async get(key) {
    const o = objects.get(key);
    return o ? {etag: o.etag, json: async () => JSON.parse(o.value)} : null;
  },
  async head(key) {
    const o = objects.get(key);
    return o ? {etag: o.etag} : null;
  },
  async put(key, value, options = {}) {
    const o = objects.get(key);
    if (options.onlyIf?.etagMatches && o?.etag !== options.onlyIf.etagMatches) return null;
    if (options.onlyIf?.etagDoesNotMatch === '*' && o) return null;
    const etag = String(++revision);
    objects.set(key, {value, etag});
    return {etag};
  },
  async delete(key) {
    objects.delete(key);
  },
};
const env = {BUCKET, ADMIN_EMAIL: 'owner@example.org'};
const owner = {'oai-authenticated-user-id': 'owner', 'oai-authenticated-user-email': 'owner@example.org'};

async function req(path, method = 'GET', payload, headers = owner) {
  const response = await api(
    new Request('https://example.org' + path, {
      method,
      headers: {Origin: 'https://example.org', 'Content-Type': 'application/json', ...headers},
      body: payload ? JSON.stringify(payload) : undefined,
    }),
    env,
  );
  return {status: response.status, response, data: await response.json()};
}
async function readState() {
  return (await req('/api/state')).data;
}
async function update(fn) {
  const current = await readState();
  fn(current.state);
  const result = await req('/api/state', 'PUT', current);
  assert.equal(result.status, 200, JSON.stringify(result.data));
}

const data = seed();
ensureTokens(data);
const firstShift = data.exam.shifts[0].id;
data.exam.centers.push({id: 'centre-two', name: 'Second Building', address: 'Road 2', code: 'C2'});
data.exam.shifts.push({id: 'shift-afternoon', name: 'Afternoon', start: '14:00', reportBy: '13:30', duration: '1 Hour 20 Minutes', order: 2});
data.rooms.push({id: 'room-two', name: '201', building: 'B', floor: '1', directions: 'Left', benches: 5, per: 2, columnBenches: [3, 2], centerId: 'centre-two'});
await BUCKET.put('scholarship/state.json', JSON.stringify(data));

let current = await readState();
assert.equal(current.state.exam.centers.length, 2);
assert.equal(current.state.exam.shifts.length, 2);

const invalid = structuredClone(current.state);
invalid.rooms[0].centerId = 'missing-centre';
assert.equal((await req('/api/state', 'PUT', {state: invalid, revision: current.revision})).status, 400);

const school = (await req('/api/schools', 'POST', {name: 'Centre School', contactName: 'Teacher', phone: '01711111111', username: 'centre.school', password: 'test-password'})).data.school;
assert.equal(school.centerId, data.exam.centers[0].id);

const added = await req('/api/school-admin/students', 'POST', {
  name: 'Shift Student',
  fatherName: 'Shift Father',
  schoolId: school.id,
  grade: '6',
  centerId: 'centre-two',
  shiftId: 'shift-afternoon',
});
assert.equal(added.status, 201, JSON.stringify(added.data));
const addedStudent = added.data.students[0];
assert.equal(addedStudent.centerId, 'centre-two');
assert.equal(addedStudent.shiftId, 'shift-afternoon');

await update((state) => {
  const student = state.students.find((s) => s.id === addedStudent.id);
  student.seat = {shiftId: 'shift-afternoon', centerId: 'centre-two', roomId: 'room-two', room: '201', building: 'B', floor: '1', directions: 'Left', bench: 1, position: 'A'};
});

const blocked = await req('/api/school-admin/students/' + addedStudent.id, 'PATCH', {
  name: 'Shift Student',
  fatherName: 'Shift Father',
  schoolId: school.id,
  grade: '6',
  centerId: 'centre-two',
  shiftId: firstShift,
});
assert.equal(blocked.status, 409, JSON.stringify(blocked.data));

await update((state) => {
  state.students.find((s) => s.id === addedStudent.id).seat = null;
});
const moved = await req('/api/school-admin/students/' + addedStudent.id, 'PATCH', {
  name: 'Shift Student',
  fatherName: 'Shift Father',
  schoolId: school.id,
  grade: '6',
  centerId: 'centre-two',
  shiftId: firstShift,
});
assert.equal(moved.status, 200, JSON.stringify(moved.data));
assert.equal((await readState()).state.students.find((s) => s.id === addedStudent.id).shiftId, firstShift);

const login = await req('/api/school/' + school.id + '/login', 'POST', {username: 'centre.school', password: 'test-password'}, {});
const cookie = login.response.headers.get('Set-Cookie').split(';')[0];
const submission = await req('/api/school/' + school.id + '/students', 'POST', {name: 'Portal Shift', fatherName: 'Portal Father', grade: '7', shiftId: 'shift-afternoon'}, {Cookie: cookie});
assert.equal(submission.status, 201, JSON.stringify(submission.data));
assert.equal(submission.data.submission.shiftId, 'shift-afternoon');
assert.equal((await req('/api/school-submissions/' + submission.data.submission.id + '/review', 'POST', {action: 'approved'})).status, 200);
const approved = (await readState()).state.students.find((s) => s.name === 'Portal Shift');
assert.equal(approved.shiftId, 'shift-afternoon');
assert.equal(approved.centerId, school.centerId);

console.log('PASS: multiple centres/shifts, room centre validation, admin centre/shift, seat-change guard, school submission shift');
