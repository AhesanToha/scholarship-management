import React, {useState} from 'react';
import {Link} from 'react-router-dom';
import {Paper} from '@mantine/core';
import {allowedGrades} from '../lib/categories.js';
import {normalizedDigits, studentErrors, normalizedSchoolName, registeredSchool} from '../lib/form-validation.js';
import {shiftForGrade} from '../lib/schema.js';
import {schoolRequest} from '../lib/school-api.js';
import PhotoUpload from '../components/PhotoUpload.jsx';
import {ActionButton, FieldInput, FieldSelect, DataTable} from '../components/ui.jsx';
import {useExam} from '../context.jsx';
import {automaticRoll, filteredStudents, parseCSV, download} from '../lib/domain.js';
import {Modal, Options} from '../components/common.jsx';

export default function Students() {
  const {state, store, cloud, run, notify} = useExam();
  const centres = state.exam.centers || [];
  const shifts = [...(state.exam.shifts || [])].sort((a, b) => a.order - b.order);
  const [photoId, setPhotoId] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [editing, setEditing] = useState(null);
  const [editPhoto, setEditPhoto] = useState('');
  const [newCenterId, setNewCenterId] = useState(centres[0]?.id || '');
  const [newShiftId, setNewShiftId] = useState(shifts[0]?.id || '');
  const [filters, setFilters] = useState({search: '', roll: '', school: '', grade: '', status: '', centerId: '', shiftId: ''});
  const [bulk, setBulk] = useState({school: '', grade: '', centerId: centres[0]?.id || '', shiftId: shifts[0]?.id || ''});
  const list = filteredStudents(state, filters);
  const filter = (key, value) => setFilters((f) => ({...f, [key]: value}));
  const registered = state.schools || [];
  const activeSchools = registered.filter((s) => s.active);
  const centreName = (id) => centres.find((c) => c.id === id)?.name || '—';
  const shiftName = (id) => shifts.find((s) => s.id === id)?.name || '—';

  async function add(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = {...Object.fromEntries(new FormData(form)), photoId};
    const fieldErrors = studentErrors(data, {schoolRequired: true, exam: state.exam});
    if (!registeredSchool(state, data.schoolId)) fieldErrors.schoolId = 'Select an active registered school.';
    if (!centres.some((c) => c.id === data.centerId)) fieldErrors.centerId = 'Select a centre.';
    if (!shifts.some((s) => s.id === data.shiftId)) fieldErrors.shiftId = 'Select a shift.';
    setErrors(fieldErrors);
    setFormError('');
    if (Object.keys(fieldErrors).length) return;
    setSaving(true);
    try {
      await store.flush();
      await schoolRequest('/api/school-admin/students', 'POST', data);
      await store.refresh();
      form.reset();
      setPhotoId('');
      setNewCenterId(centres[0]?.id || '');
      setNewShiftId(shifts[0]?.id || '');
      notify('Student added and marked as approved in the school portal.');
    } catch (err) {
      setErrors(err.fieldErrors || {});
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function importCSV(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSaving(true);
    try {
      if (state.exam.locked) throw Error('Seating is locked.');
      const rows = parseCSV((await file.text()).replace(/^\uFEFF/, ''));
      const header = rows.shift()?.map((v) => v.trim()).join(',');
      if (!['name,school,class', 'name,school,class,roll', 'name,school,grade', 'name,school,grade,roll'].includes(header)) throw Error('CSV headers must be name,school,class.');
      const incoming = rows.map((row, i) => {
        if (row.length !== (header.endsWith(',roll') ? 4 : 3)) throw Error(`Row ${i + 2} is incomplete`);
        const [name, school, grade] = row.map((v) => v.trim());
        const matches = activeSchools.filter((s) => normalizedSchoolName(s.name) === normalizedSchoolName(school));
        if (matches.length !== 1) throw Error(`Row ${i + 2}: register this school on the Schools page first.`);
        const data = {name, schoolId: matches[0].id, grade};
        const invalid = studentErrors(data, {schoolRequired: true, exam: state.exam});
        if (Object.keys(invalid).length) throw Error(`Row ${i + 2}: ` + Object.values(invalid).join(' '));
        return data;
      });
      await store.flush();
      const result = await schoolRequest('/api/school-admin/students/bulk', 'POST', {students: incoming});
      await store.refresh();
      notify(result.count + ' students imported and added to the school portal.');
    } catch (err) {
      notify(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    const data = {...Object.fromEntries(new FormData(e.currentTarget)), photoId: editPhoto};
    const invalid = studentErrors(data, {schoolRequired: true, exam: state.exam});
    setErrors(invalid);
    if (Object.keys(invalid).length) return;
    setSaving(true);
    try {
      await store.flush();
      await schoolRequest('/api/school-admin/students/' + editing.id, 'PATCH', data);
      await store.refresh();
      setEditing(null);
      notify('Details saved. Roll and QR code are unchanged.');
    } catch (err) {
      setErrors(err.fieldErrors || {});
      notify(err.message);
    } finally {
      setSaving(false);
    }
  }

  function bulkAssign(e) {
    e.preventDefault();
    const matches = state.students.filter(
      (s) => s.status !== 'withdrawn' && (!bulk.school || s.schoolId === bulk.school || s.school === bulk.school) && (!bulk.grade || s.grade === bulk.grade),
    );
    if (!matches.length) return notify('No students match this selection.');
    if (!confirm(`Set centre and shift for ${matches.length} students? Existing seats that no longer match will be cleared.`)) return;
    try {
      store.commit((next) => {
        for (const student of next.students) {
          if (student.status === 'withdrawn') continue;
          if (bulk.school && student.schoolId !== bulk.school && student.school !== bulk.school) continue;
          if (bulk.grade && student.grade !== bulk.grade) continue;
          const changed = student.centerId !== bulk.centerId || student.shiftId !== bulk.shiftId;
          student.centerId = bulk.centerId;
          student.shiftId = bulk.shiftId;
          if (changed && student.seat) student.seat = null;
        }
      });
      notify(`${matches.length} students updated.`);
    } catch (err) {
      notify(err.message);
    }
  }

  return (
    <>
      <Paper className="panel no-print">
        <h2>Add student</h2>
        {!activeSchools.length && <p className="notice">First register or activate a school in <Link to="/schools">Schools page</Link>.</p>}
        {formError && <p className="error" role="alert">{formError}</p>}
        <form className="form" noValidate onSubmit={add}>
          <FieldInput label="Student name" name="name" required withAsterisk maxLength={150} error={errors.name} />
          <FieldSelect label="Registered school" name="schoolId" required withAsterisk error={errors.schoolId} disabled={!activeSchools.length}
            onChange={(e) => {
              const school = registered.find((s) => s.id === e.target.value);
              if (school?.centerId) setNewCenterId(school.centerId);
              if (school?.shiftId) setNewShiftId(school.shiftId);
            }}>
            <option value="">Select school</option>
            {activeSchools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </FieldSelect>
          <FieldSelect label="Class" name="grade" required withAsterisk defaultValue="" error={errors.grade}
            onChange={(e) => {
              const shift = shiftForGrade(state, e.target.value);
              if (shift) setNewShiftId(shift);
            }}>
            <option value="">Select class</option>
            {allowedGrades(state.exam).map((g) => <option key={g} value={g}>{g}</option>)}
          </FieldSelect>
          <FieldSelect label="Centre" name="centerId" required error={errors.centerId} value={newCenterId} onChange={(e) => setNewCenterId(e.target.value)}>
            {centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </FieldSelect>
          <FieldSelect label="Shift" name="shiftId" required error={errors.shiftId} value={newShiftId} onChange={(e) => setNewShiftId(e.target.value)}>
            {shifts.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.start}</option>)}
          </FieldSelect>
          <FieldInput label="Father's name (optional)" name="fatherName" maxLength={150} error={errors.fatherName} />
          <FieldInput label="Guardian name (optional)" name="guardianName" maxLength={150} error={errors.guardianName} />
          <FieldInput label="Guardian phone (optional)" name="guardianPhone" maxLength={16} error={errors.guardianPhone} />
          <PhotoUpload photoId={photoId} onChange={setPhotoId} onBusy={setPhotoBusy} />
          <p className="muted">Rolls are generated automatically.</p>
          <ActionButton type="submit" disabled={state.exam.locked || photoBusy || saving || !cloud.ready || !activeSchools.length}>Add student</ActionButton>
        </form>
        <p className="muted">UTF-8 CSV: name, school, class. Use a registered school's name.</p>
        <div className="toolbar">
          <ActionButton className="secondary" disabled={!activeSchools.length || saving}
            onClick={() => download('students-template.csv', '\uFEFFname,school,grade\nSample Student,"' + activeSchools[0].name.replace(/"/g, '""') + '",5\n', 'text/csv;charset=utf-8')}>
            CSV template
          </ActionButton>
          <label className="button">CSV import
            <FieldInput type="file" accept=".csv" hidden disabled={state.exam.locked || saving || !activeSchools.length} onChange={importCSV} />
          </label>
        </div>
      </Paper>

      <details className="room-tool no-print">
        <summary><span>Bulk assign centre / shift</span><small>Apply to a school or class</small></summary>
        <div className="room-tool-body">
          <form className="form" onSubmit={bulkAssign}>
            <FieldSelect label="School" value={bulk.school} onChange={(e) => setBulk({...bulk, school: e.target.value})}>
              <option value="">All schools</option>
              {activeSchools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </FieldSelect>
            <FieldSelect label="Class" value={bulk.grade} onChange={(e) => setBulk({...bulk, grade: e.target.value})}>
              <option value="">All classes</option>
              {[...new Set(state.students.map((s) => s.grade))].sort((a, b) => Number(a) - Number(b)).map((g) => <option key={g} value={g}>{g}</option>)}
            </FieldSelect>
            <FieldSelect label="Centre" value={bulk.centerId} onChange={(e) => setBulk({...bulk, centerId: e.target.value})}>
              {centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FieldSelect>
            <FieldSelect label="Shift" value={bulk.shiftId} onChange={(e) => setBulk({...bulk, shiftId: e.target.value})}>
              {shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </FieldSelect>
            <ActionButton type="submit" disabled={state.exam.locked || saving}>Apply to matching students</ActionButton>
          </form>
          <p className="muted">Seats that no longer match the new centre or shift are cleared; rolls and QR codes stay the same.</p>
        </div>
      </details>

      <Paper className="panel">
        <div className="toolbar">
          <h2>Registered students</h2>
          <FieldInput aria-label="Search students" placeholder="Search name, school or roll" value={filters.search} onChange={(e) => filter('search', e.target.value)} />
        </div>
        <div className="toolbar">
          <FieldInput label="Exam roll" aria-label="Search by roll" placeholder="Enter exact roll" value={filters.roll} onChange={(e) => filter('roll', e.target.value)} />
          <label>School
            <FieldSelect value={filters.school} onChange={(e) => filter('school', e.target.value)}>
              <Options values={registered.map((s) => s.name)} all="All registered schools" />
            </FieldSelect>
          </label>
          <label>Class
            <FieldSelect value={filters.grade} onChange={(e) => filter('grade', e.target.value)}>
              <Options values={[...new Set(state.students.map((s) => s.grade))].sort((a, b) => Number(a) - Number(b))} all="All classes" />
            </FieldSelect>
          </label>
          <label>Centre
            <FieldSelect value={filters.centerId} onChange={(e) => filter('centerId', e.target.value)}>
              <option value="">All centres</option>
              {centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FieldSelect>
          </label>
          <label>Shift
            <FieldSelect value={filters.shiftId} onChange={(e) => filter('shiftId', e.target.value)}>
              <option value="">All shifts</option>
              {shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </FieldSelect>
          </label>
          <label>Seating status
            <FieldSelect value={filters.status} onChange={(e) => filter('status', e.target.value)}>
              <option value="">All students</option>
              <option value="unassigned">Unassigned</option>
              <option value="assigned">Assigned</option>
            </FieldSelect>
          </label>
          <ActionButton className="secondary" onClick={() => setFilters({search: '', roll: '', school: '', grade: '', status: '', centerId: '', shiftId: ''})}>Clear filters</ActionButton>
        </div>
        <p className="muted">Showing {list.length} / {state.students.length} students</p>
        <div className="table-wrap">
          <DataTable>
            <DataTable.Thead>
              <DataTable.Tr>
                {['Roll', 'Student / school', 'Class', 'Centre / shift', 'Seat', 'Attendance', ''].map((v, i) => <DataTable.Th key={i}>{v}</DataTable.Th>)}
              </DataTable.Tr>
            </DataTable.Thead>
            <DataTable.Tbody>
              {list.map((s) => (
                <DataTable.Tr key={s.id}>
                  <DataTable.Td>{s.roll}</DataTable.Td>
                  <DataTable.Td>
                    <b>{s.name}</b>
                    {s.photoId && <img className="photo-thumb small" src={'/api/photos/' + s.photoId} alt="Student photo" />}
                    <br /><span className="muted">{s.school}</span>
                  </DataTable.Td>
                  <DataTable.Td>{s.grade}</DataTable.Td>
                  <DataTable.Td>{centreName(s.centerId)}<br /><span className="muted">{shiftName(s.shiftId)}</span></DataTable.Td>
                  <DataTable.Td>{s.seat ? s.seat.room + ' · ' + s.seat.bench + s.seat.position : 'Unassigned'}</DataTable.Td>
                  <DataTable.Td>
                    <ActionButton className="secondary" onClick={() => run(() => store.commit((next) => { const student = next.students.find((x) => x.id === s.id); student.present = !student.present; }))}>
                      {s.present ? '✓ Present' : 'Mark present'}
                    </ActionButton>
                  </DataTable.Td>
                  <DataTable.Td>
                    <ActionButton className="secondary" disabled={state.exam.locked} onClick={() => { setErrors({}); setEditing(s); setEditPhoto(s.photoId || ''); }}>Edit details</ActionButton>{' '}
                    <ActionButton className="secondary" disabled={state.exam.locked} onClick={() => { if (confirm('Remove this student?')) run(() => store.commit((next) => { if (next.exam.locked) throw Error('Seating is locked.'); next.students = next.students.filter((x) => x.id !== s.id); })); }}>Remove</ActionButton>
                  </DataTable.Td>
                </DataTable.Tr>
              ))}
            </DataTable.Tbody>
          </DataTable>
          {!list.length && <p className="empty">No students found</p>}
        </div>
      </Paper>

      {editing && (
        <Modal title={editing.name + ' · ' + editing.roll} onClose={() => setEditing(null)}>
          <form className="form" noValidate onSubmit={saveEdit}>
            <FieldInput label="Exam roll" readOnly value={editing.roll} />
            <FieldInput label="Student name" name="name" required withAsterisk error={errors.name} defaultValue={editing.name} />
            <FieldSelect label="Registered school" name="schoolId" required withAsterisk error={errors.schoolId} defaultValue={editing.schoolId || activeSchools.find((s) => s.name === editing.school)?.id || ''}>
              <option value="">Select school</option>
              {activeSchools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </FieldSelect>
            <FieldSelect label="Class" name="grade" required withAsterisk error={errors.grade} defaultValue={editing.grade}>
              {allowedGrades(state.exam).map((g) => <option key={g} value={g}>{g}</option>)}
            </FieldSelect>
            <FieldSelect label="Centre" name="centerId" required defaultValue={editing.centerId || centres[0]?.id || ''}>
              {centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FieldSelect>
            <FieldSelect label="Shift" name="shiftId" required defaultValue={editing.shiftId || shifts[0]?.id || ''}>
              {shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </FieldSelect>
            {[['fatherName', "Father's name"], ['guardianName', 'Guardian name'], ['guardianPhone', 'Guardian phone']].map(([k, label]) => (
              <FieldInput key={k} label={label} name={k} error={errors[k]} defaultValue={editing[k] || ''} />
            ))}
            <PhotoUpload photoId={editPhoto} onChange={setEditPhoto} onBusy={setPhotoBusy} />
            <ActionButton type="submit" disabled={photoBusy || saving}>Save changes</ActionButton>
          </form>
          {editing.seat && <p className="muted">Changing centre or shift clears the current seat.</p>}
        </Modal>
      )}
    </>
  );
}
