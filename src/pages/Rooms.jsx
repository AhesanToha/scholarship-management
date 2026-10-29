import React, {useState} from 'react';
import {Link, useNavigate, useParams, useSearchParams} from 'react-router-dom';
import {Paper, Group, Text, Badge} from '@mantine/core';
import {seatConflicts} from '../lib/seat-rules.js';
import {capacity, mapColumns, deleteRoomModel} from '../lib/domain.js';
import {ActionButton, FieldSelect, DataTable} from '../components/ui.jsx';
import BenchMap from '../components/BenchMap.jsx';
import RoomEditor from '../components/RoomEditor.jsx';
import LayoutEditor from '../components/LayoutEditor.jsx';
import Allocation from '../components/Allocation.jsx';
import {Modal} from '../components/common.jsx';
import {useExam} from '../context.jsx';

const seatShift = (s) => s.seat?.shiftId || s.shiftId;

function Roster({room, students, shiftId}) {
  const rows = students.filter((s) => s.seat?.roomId === room.id && (!shiftId || seatShift(s) === shiftId));
  return (
    <div className="table-wrap">
      <DataTable>
        <DataTable.Thead>
          <DataTable.Tr>
            <DataTable.Th>Bench / seat</DataTable.Th>
            <DataTable.Th>Roll</DataTable.Th>
            <DataTable.Th>Name</DataTable.Th>
            <DataTable.Th>School</DataTable.Th>
            <DataTable.Th>Class</DataTable.Th>
          </DataTable.Tr>
        </DataTable.Thead>
        <DataTable.Tbody>
          {rows.map((s) => (
            <DataTable.Tr key={s.id}>
              <DataTable.Td>{s.seat.bench} / {s.seat.position}</DataTable.Td>
              <DataTable.Td>{s.roll}</DataTable.Td>
              <DataTable.Td>{s.name}</DataTable.Td>
              <DataTable.Td>{s.school}</DataTable.Td>
              <DataTable.Td>{s.grade}</DataTable.Td>
            </DataTable.Tr>
          ))}
        </DataTable.Tbody>
      </DataTable>
    </div>
  );
}

export default function Rooms() {
  const {state, store, notify, run} = useExam();
  const {roomId} = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [editing, setEditing] = useState(null);
  const centres = state.exam.centers || [];
  const shifts = [...(state.exam.shifts || [])].sort((a, b) => a.order - b.order);
  const selected = state.rooms.find((r) => r.id === roomId);
  const [centerId, setCenterId] = useState(() => selected?.centerId || centres[0]?.id || '');
  const [shiftId, setShiftId] = useState(() => shifts[0]?.id || '');
  const rooms = state.rooms.filter((r) => r.centerId === centerId);
  const centre = centres.find((c) => c.id === centerId);
  const shift = shifts.find((s) => s.id === shiftId);
  const inShift = (s) => !shiftId || seatShift(s) === shiftId;
  const assignedInRoom = (room) => state.students.filter((s) => s.seat?.roomId === room.id && inShift(s)).length;
  const assigned = state.students.filter((s) => s.seat && inShift(s)).length;
  const activeStudents = state.students.filter((s) => s.status !== 'withdrawn');

  function lock() {
    run(() => {
      if (!state.exam.locked && activeStudents.some((s) => !s.seat)) throw Error('Assign a seat to every active student first.');
      if (!state.exam.locked && seatConflicts(state).length) throw Error('School or class conflicts exist. Rebuild the affected room.');
      if (state.exam.locked && !confirm('Unlock seating to allow changes?')) return;
      store.commit((next) => (next.exam.locked = !next.exam.locked));
    });
  }

  function clear(room) {
    const count = assignedInRoom(room);
    if (!count) return notify('No assignments in this room for this shift');
    if (!confirm(`Clear this room's ${count} ${shift?.name || ''} assignments? These students will become unassigned. QR codes will stay the same.`)) return;
    run(() =>
      store.commit((next) => {
        next.students.filter((s) => s.seat?.roomId === room.id && (!shiftId || (s.seat.shiftId || s.shiftId) === shiftId)).forEach((s) => (s.seat = null));
        next.exam.locked = false;
      }),
    );
  }

  function remove(room) {
    const count = state.students.filter((s) => s.seat?.roomId === room.id).length;
    if (!confirm(`Room ${room.name}: delete this room? ${count} seat assignments (all shifts) will be removed; student records will be retained.`)) return;
    run(() => {
      store.commit((next) => deleteRoomModel(next, room.id));
      navigate('/rooms');
      notify('Room deleted');
    });
  }

  return (
    <>
      {seatConflicts(state).length > 0 && (
        <p className="notice no-print">Existing seating contains {seatConflicts(state).length} school or class conflicts. Rebuild the affected rooms.</p>
      )}
      <div className="room-dashboard no-print">
        <div className="room-dashboard-head">
          <div>
            <h2>{centre ? centre.name : 'Room overview'}</h2>
            <p className="muted">
              {rooms.length} rooms · {capacity(state, centerId)} seats · {shift?.name || 'shift'} assigned: {assigned} students
            </p>
          </div>
          <div className="toolbar">
            <ActionButton className="secondary" onClick={lock}>{state.exam.locked ? 'Unlock allocation' : 'Lock seating'}</ActionButton>
            <ActionButton className="secondary" onClick={() => window.print()}>Print all rooms</ActionButton>
          </div>
        </div>

        <div className="toolbar room-filters">
          <label>Centre
            <FieldSelect aria-label="Centre" value={centerId} onChange={(e) => setCenterId(e.target.value)}>
              {centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FieldSelect>
          </label>
          <label>Shift
            <FieldSelect aria-label="Shift" value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
              {shifts.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.start}</option>)}
            </FieldSelect>
          </label>
          <Badge variant="light" color="teal" size="lg">{shift ? `${shift.name} ${shift.start}` : 'No shift'}</Badge>
        </div>

        <div className="room-card-grid">
          {rooms.map((room, i) => {
            const roomAssigned = assignedInRoom(room);
            const total = room.benches * room.per;
            return (
              <Paper component={Link} to={'/rooms/' + room.id} className={`room-summary-card room-tint-${i % 6} ${room.id === roomId ? 'is-selected' : ''}`} key={room.id}>
                <div className="room-card-top">
                  <span className="room-card-icon">▦</span>
                  <span className="room-status">{roomAssigned === total ? 'Full' : roomAssigned ? 'Partially assigned' : 'Empty'}</span>
                </div>
                <h3>Room {room.name}</h3>
                <p>{room.building} · {room.floor}</p>
                <div className="room-card-stats">
                  <span><b>{roomAssigned}</b>Assigned</span>
                  <span><b>{total - roomAssigned}</b>Empty</span>
                  <span><b>{room.benches}</b>Bench</span>
                </div>
                <div className="occupancy-track"><div style={{width: Math.min(100, (roomAssigned / total) * 100) + '%'}} /></div>
                <div className="room-card-bottom">
                  {mapColumns(room)} columns · {room.per} seats / bench
                  <span>{room.id === roomId ? 'Selected ✓' : 'View room →'}</span>
                </div>
              </Paper>
            );
          })}
          {!rooms.length && <p className="empty">No rooms in this centre yet. Add the first room below.</p>}
        </div>
      </div>

      {selected ? (
        <section id="active-room-panel" className={`panel active-room-panel no-print room-tint-${state.rooms.indexOf(selected) % 6}`}>
          <div className="room-heading">
            <div>
              <small>SELECTED ROOM</small>
              <h2>Room {selected.name} · {selected.building} building</h2>
              <p className="muted">{selected.floor} · {selected.directions}</p>
              <p className="muted">{shift ? `${shift.name} shift · starts ${shift.start}` : ''}</p>
            </div>
            <div className="room-actions">
              <Link className="button" to={'/rooms/' + selected.id + '?allocate=1'}>Allocate this room</Link>
              <ActionButton className="secondary" onClick={() => setEditing(selected)}>Edit room</ActionButton>
              <ActionButton className="secondary" onClick={() => clear(selected)}>Clear assignments</ActionButton>
              <ActionButton className="danger" onClick={() => remove(selected)}>Delete room</ActionButton>
              <Link className="button secondary" to="/rooms">Close ✕</Link>
            </div>
          </div>
          <div className="map-toolbar">
            <div className="map-legend">
              <span><i className="occupied-dot" />Assigned: {assignedInRoom(selected)}</span>
              <span><i className="vacant-dot" />Total: {selected.benches * selected.per} seats</span>
            </div>
          </div>
          <LayoutEditor room={selected} />
          <BenchMap room={selected} students={state.students.filter((s) => !shiftId || seatShift(s) === shiftId)} />
          <p className="muted map-note">Bench numbers run front to back in each column. Select a seat to view student details.</p>
          <details className="room-roster">
            <summary>Student roster</summary>
            <Roster room={selected} students={state.students} shiftId={shiftId} />
          </details>
        </section>
      ) : (
        <div className="room-selection-hint no-print">
          {roomId ? 'Room not found.' : 'Select a room to view its seating map and student details.'}
        </div>
      )}

      <details className="room-tool no-print">
        <summary><span>Add new room</span><small>Room configuration</small></summary>
        <div className="room-tool-body">
          <RoomEditor centerId={centerId} onDone={(id) => navigate('/rooms/' + id)} />
        </div>
      </details>

      <details className="room-tool no-print" open={search.get('allocate') === '1' || undefined} key={'allocation-' + roomId + '-' + search.get('allocate') + '-' + centerId + '-' + shiftId}>
        <summary><span>Seating allocation</span><small>Select classes, schools and room, then preview</small></summary>
        <div className="room-tool-body">
          <Allocation initialRoomId={selected?.id || ''} centerId={centerId} shiftId={shiftId} />
        </div>
      </details>

      <div className="print-only">
        <h1>{centre?.name}</h1>
        <p>{shift ? `${shift.name} · starts ${shift.start}` : ''}</p>
        {rooms.map((r) => (
          <section className="room" key={r.id}>
            <h2>Room {r.name} · {r.building} · {r.floor}</h2>
            <p>{r.directions}</p>
            <BenchMap room={r} students={state.students.filter((s) => !shiftId || seatShift(s) === shiftId)} />
            <Roster room={r} students={state.students} shiftId={shiftId} />
          </section>
        ))}
      </div>

      {editing && (
        <Modal title="Edit room details" onClose={() => setEditing(null)}>
          <RoomEditor room={editing} centerId={editing.centerId} onDone={() => setEditing(null)} />
          <p className="muted">Students in removed seats must be reassigned after reducing room capacity.</p>
        </Modal>
      )}
    </>
  );
}
