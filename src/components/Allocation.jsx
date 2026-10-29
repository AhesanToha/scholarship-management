import React, {useEffect, useMemo, useState} from 'react';
import {Paper, Text, Badge} from '@mantine/core';
import {useNavigate} from 'react-router-dom';
import {ActionButton, FieldInput, FieldSelect, DataTable} from './ui.jsx';
import {useExam} from '../context.jsx';
import {gradeNames, schoolNames, allocationCandidates, buildAllocationPlan, applyAllocationPlan} from '../lib/domain.js';

const seatShift = (s) => s.seat?.shiftId || s.shiftId;

export default function Allocation({initialRoomId = '', centerId = '', shiftId = ''}) {
  const {state, store, notify} = useExam();
  const navigate = useNavigate();
  const centres = state.exam.centers || [];
  const shifts = [...(state.exam.shifts || [])].sort((a, b) => a.order - b.order);
  const activeCentre = centerId || centres[0]?.id || '';
  const activeShift = shiftId || shifts[0]?.id || '';
  const centreRooms = state.rooms.filter((r) => r.centerId === activeCentre);

  const [config, setConfig] = useState(() => ({
    centreId: activeCentre,
    shiftId: activeShift,
    roomId: centreRooms.some((r) => r.id === initialRoomId) ? initialRoomId : centreRooms[0]?.id || '',
    grades: ['4', '5'],
    schools: [],
    rebuild: false,
  }));
  const [excluded, setExcluded] = useState(new Set());
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setConfig((c) => {
      const rooms = state.rooms.filter((r) => r.centerId === (centerId || c.centreId));
      const roomId = rooms.some((r) => r.id === initialRoomId)
        ? initialRoomId
        : rooms.some((r) => r.id === c.roomId)
          ? c.roomId
          : rooms[0]?.id || '';
      return {...c, centreId: centerId || c.centreId, shiftId: shiftId || c.shiftId, roomId};
    });
    setPlan(null);
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId, shiftId, initialRoomId]);

  const candidates = useMemo(() => allocationCandidates(state, config), [state, config]);
  const room = state.rooms.find((r) => r.id === config.roomId);
  const shift = shifts.find((s) => s.id === config.shiftId);
  const used = state.students.filter((s) => s.seat?.roomId === room?.id && (!config.shiftId || seatShift(s) === config.shiftId)).length;

  function change(patch) {
    setConfig((c) => ({...c, ...patch}));
    setExcluded(new Set());
    setPlan(null);
    setError('');
  }

  function toggle(key, value) {
    change({[key]: config[key].includes(value) ? config[key].filter((x) => x !== value) : [...config[key], value]});
  }

  function preview(e) {
    e.preventDefault();
    try {
      setPlan(buildAllocationPlan(state, {...config, studentIds: candidates.filter((s) => !excluded.has(s.id)).map((s) => s.id)}));
      setError('');
    } catch (err) {
      setPlan(null);
      setError(err.message);
    }
  }

  function apply() {
    try {
      if (plan.rebuild && plan.changed && !confirm(`Rearrange this room's existing ${plan.changed} ${shift?.name || ''} assignments? Unselected students will become unassigned. Other rooms and permanent QR codes will stay the same.`)) return;
      store.commit((next) => applyAllocationPlan(next, plan));
      setPlan(null);
      setExcluded(new Set());
      navigate('/rooms/' + plan.roomId + '?allocate=1');
      notify(plan.assignments.length + ' students assigned. Select another room for the remaining students.');
    } catch (err) {
      setError(err.message);
      setPlan(null);
    }
  }

  return (
    <Paper className="panel no-print">
      <h2>Allocate seating</h2>
      <p className="muted">
        {shift ? `${shift.name} shift · ${shift.start}. ` : ''}Select a room and at least two classes. Class and school separation rules are enforced; some seats may remain empty.
      </p>
      <form onSubmit={preview}>
        <div className="form">
          <label>Select a room
            <FieldSelect value={config.roomId} onChange={(e) => change({roomId: e.target.value})}>
              <option value="">Room</option>
              {centreRooms.map((r) => <option value={r.id} key={r.id}>{r.building} / {r.name} · {r.benches * r.per} seats</option>)}
            </FieldSelect>
          </label>
          <label>Allocation mode
            <FieldSelect value={config.rebuild ? 'yes' : 'no'} onChange={(e) => change({rebuild: e.target.value === 'yes'})}>
              <option value="no">Fill empty seats</option>
              <option value="yes">Rebuild this room</option>
            </FieldSelect>
          </label>
        </div>
        <h3 style={{marginTop: 20}}>Classes · select at least two</h3>
        <div className="allocation-room-list">
          {gradeNames(state).map((g) => (
            <label key={g}><FieldInput type="checkbox" checked={config.grades.includes(g)} onChange={() => toggle('grades', g)} />Class {g}</label>
          ))}
        </div>
        <h3 style={{marginTop: 20}}>Schools · select one or more</h3>
        <div className="allocation-room-list">
          {schoolNames(state).map((school) => (
            <label key={school}><FieldInput type="checkbox" checked={config.schools.includes(school)} onChange={() => toggle('schools', school)} />{school}</label>
          ))}
        </div>
        <p className="muted">Leave schools unselected to include all schools. Seats remain empty when separation rules cannot be met.</p>
        <div id="available-candidates">
          <div className="candidate-heading">
            <h3>{config.rebuild ? 'Available for reassignment' : 'Unassigned'}: {candidates.length} students</h3>
            <span className="muted">Available seats: {room ? room.benches * room.per - used : 0} seats</span>
          </div>
          <label className="candidate-select-all">
            <FieldInput
              type="checkbox"
              checked={candidates.length > 0 && candidates.every((s) => !excluded.has(s.id))}
              onChange={(e) => {
                setExcluded(e.target.checked ? new Set() : new Set(candidates.map((s) => s.id)));
                setPlan(null);
              }}
            />
            Select all students
          </label>
          <div className="table-wrap allocation-preview-table">
            <DataTable>
              <DataTable.Thead>
                <DataTable.Tr>
                  <DataTable.Th>Select</DataTable.Th>
                  <DataTable.Th>Roll</DataTable.Th>
                  <DataTable.Th>Name / school</DataTable.Th>
                  <DataTable.Th>Class</DataTable.Th>
                  <DataTable.Th>Status</DataTable.Th>
                </DataTable.Tr>
              </DataTable.Thead>
              <DataTable.Tbody>
                {candidates.map((s) => (
                  <DataTable.Tr key={s.id}>
                    <DataTable.Td>
                      <FieldInput
                        type="checkbox"
                        aria-label={'Selected: ' + s.roll}
                        checked={!excluded.has(s.id)}
                        onChange={() => {
                          setExcluded((old) => {
                            const next = new Set(old);
                            next.has(s.id) ? next.delete(s.id) : next.add(s.id);
                            return next;
                          });
                          setPlan(null);
                        }}
                      />
                    </DataTable.Td>
                    <DataTable.Td>{s.roll}</DataTable.Td>
                    <DataTable.Td>{s.name}<br />{s.school}</DataTable.Td>
                    <DataTable.Td>{s.grade}</DataTable.Td>
                    <DataTable.Td>{s.seat ? 'Assigned to this room' : 'Unassigned'}</DataTable.Td>
                  </DataTable.Tr>
                ))}
              </DataTable.Tbody>
            </DataTable>
            {!candidates.length && <p className="empty">No unassigned students match your selection</p>}
          </div>
        </div>
        <ActionButton type="submit" disabled={state.exam.locked}>Preview allocation</ActionButton>
        {state.exam.locked && <p className="error">Seating is locked. Unlock the allocation first.</p>}
      </form>

      {error && <p className="error" role="alert">{error}</p>}

      {plan && (
        <div>
          <h3 style={{marginTop: 22}}>
            Preview: {plan.assignments.length} students will receive a seat <Badge variant="light" color="teal">{shift?.name}</Badge>
          </h3>
          <Text size="sm" c="dimmed">
            Of the selected {plan.candidateCount} students, {plan.remaining.length} remain unassigned. This room will have {plan.free} empty seats.
            {plan.rebuild && ` Existing ${plan.changed} assignments will be rearranged.`} This preview is not saved yet. Adjust your selection if needed.
          </Text>
          <div className="table-wrap allocation-preview-table">
            <DataTable>
              <DataTable.Thead>
                <DataTable.Tr>
                  <DataTable.Th>Roll</DataTable.Th>
                  <DataTable.Th>Name / school</DataTable.Th>
                  <DataTable.Th>Class</DataTable.Th>
                  <DataTable.Th>Room</DataTable.Th>
                  <DataTable.Th>Bench / seat</DataTable.Th>
                </DataTable.Tr>
              </DataTable.Thead>
              <DataTable.Tbody>
                {plan.assignments.map((a) => {
                  const student = state.students.find((s) => s.id === a.studentId);
                  return (
                    <DataTable.Tr key={a.studentId}>
                      <DataTable.Td>{student.roll}</DataTable.Td>
                      <DataTable.Td>{student.name}<br />{student.school}</DataTable.Td>
                      <DataTable.Td>{student.grade}</DataTable.Td>
                      <DataTable.Td>{a.seat.room}</DataTable.Td>
                      <DataTable.Td>{a.seat.bench} / {a.seat.position}</DataTable.Td>
                    </DataTable.Tr>
                  );
                })}
              </DataTable.Tbody>
            </DataTable>
          </div>
          <ActionButton style={{marginTop: 15}} onClick={apply}>Confirm allocation</ActionButton>
        </div>
      )}
    </Paper>
  );
}
