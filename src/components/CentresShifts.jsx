import React, {useState} from 'react';
import {Paper, Group, Text, Badge} from '@mantine/core';
import {ActionButton, FieldInput, FieldSelect, DataTable} from './ui.jsx';
import {useExam} from '../context.jsx';

const blankCentre = {name: '', address: '', code: ''};
const blankShift = {name: '', start: '14:00', reportBy: '13:30', duration: '1 Hour 20 Minutes'};

export default function CentresShifts() {
  const {state, store, run, notify} = useExam();
  const centres = state.exam.centers || [];
  const shifts = [...(state.exam.shifts || [])].sort((a, b) => a.order - b.order);
  const [newCentre, setNewCentre] = useState(blankCentre);
  const [newShift, setNewShift] = useState(blankShift);
  const [editCentre, setEditCentre] = useState(null);
  const [editShift, setEditShift] = useState(null);

  const roomsIn = (id) => state.rooms.filter((r) => r.centerId === id).length;
  const studentsIn = (id) => state.students.filter((s) => s.centerId === id).length;
  const shiftStudents = (id) => state.students.filter((s) => s.shiftId === id).length;

  function commit(fn) {
    run(() => {
      store.commit(fn);
      notify('Saved');
    });
  }

  function addCentre(e) {
    e.preventDefault();
    const name = newCentre.name.trim();
    if (!name) return notify('Enter a centre name.');
    commit((next) => {
      next.exam.centers.push({
        id: crypto.randomUUID(),
        name,
        address: newCentre.address.trim(),
        code: newCentre.code.trim() || 'C' + (next.exam.centers.length + 1),
      });
    });
    setNewCentre(blankCentre);
  }

  function saveCentre(e) {
    e.preventDefault();
    const name = editCentre.name.trim();
    if (!name) return notify('Enter a centre name.');
    commit((next) => {
      const centre = next.exam.centers.find((c) => c.id === editCentre.id);
      Object.assign(centre, {name, address: editCentre.address.trim(), code: editCentre.code.trim() || centre.code});
      if (next.exam.centers[0].id === centre.id) next.exam.center = name;
    });
    setEditCentre(null);
  }

  function removeCentre(centre) {
    if (centres.length <= 1) return notify('Keep at least one centre.');
    const used = roomsIn(centre.id) || studentsIn(centre.id) || (state.schools || []).some((s) => s.centerId === centre.id);
    if (used) return notify('Move or remove this centre’s rooms, students and schools first.');
    if (!confirm(`Delete centre “${centre.name}”?`)) return;
    commit((next) => {
      next.exam.centers = next.exam.centers.filter((c) => c.id !== centre.id);
      if (next.exam.center === centre.name) next.exam.center = next.exam.centers[0].name;
    });
  }

  function addShift(e) {
    e.preventDefault();
    const name = newShift.name.trim();
    if (!name) return notify('Enter a shift name.');
    commit((next) => {
      next.exam.shifts.push({
        id: crypto.randomUUID(),
        name,
        start: newShift.start || '10:00',
        reportBy: newShift.reportBy || '',
        duration: newShift.duration.trim() || '1 Hour 20 Minutes',
        order: Math.max(0, ...next.exam.shifts.map((s) => s.order || 0)) + 1,
      });
    });
    setNewShift(blankShift);
  }

  function saveShift(e) {
    e.preventDefault();
    const name = editShift.name.trim();
    if (!name) return notify('Enter a shift name.');
    commit((next) => {
      const shift = next.exam.shifts.find((s) => s.id === editShift.id);
      Object.assign(shift, {
        name,
        start: editShift.start,
        reportBy: editShift.reportBy || '',
        duration: editShift.duration.trim() || shift.duration,
        order: Number(editShift.order) || shift.order,
      });
      if (next.exam.shifts[0].id === shift.id) {
        next.exam.time = shift.start;
        next.exam.duration = shift.duration;
      }
    });
    setEditShift(null);
  }

  function removeShift(shift) {
    if (shifts.length <= 1) return notify('Keep at least one shift.');
    const used =
      shiftStudents(shift.id) ||
      (state.exam.categories || []).some((c) => c.shiftId === shift.id) ||
      (state.schools || []).some((s) => s.shiftId === shift.id);
    if (used) return notify('Move students and category defaults out of this shift first.');
    if (!confirm(`Delete shift “${shift.name}”?`)) return;
    commit((next) => {
      next.exam.shifts = next.exam.shifts.filter((s) => s.id !== shift.id);
    });
  }

  return (
    <>
      <Paper className="panel">
        <Group justify="space-between" mb="sm">
          <div>
            <h2>Centres</h2>
            <Text size="xs" c="dimmed">Each centre is a separate building with its own rooms.</Text>
          </div>
          <Badge variant="light" color="teal">{centres.length} centres</Badge>
        </Group>
        <div className="table-wrap">
          <DataTable>
            <DataTable.Thead>
              <DataTable.Tr>
                {['Centre', 'Code', 'Address', 'Rooms', 'Students', ''].map((v) => (
                  <DataTable.Th key={v}>{v}</DataTable.Th>
                ))}
              </DataTable.Tr>
            </DataTable.Thead>
            <DataTable.Tbody>
              {centres.map((centre) => (
                <DataTable.Tr key={centre.id}>
                  <DataTable.Td><b>{centre.name}</b></DataTable.Td>
                  <DataTable.Td>{centre.code}</DataTable.Td>
                  <DataTable.Td>{centre.address || '—'}</DataTable.Td>
                  <DataTable.Td>{roomsIn(centre.id)}</DataTable.Td>
                  <DataTable.Td>{studentsIn(centre.id)}</DataTable.Td>
                  <DataTable.Td>
                    <Group gap="xs">
                      <ActionButton className="secondary" onClick={() => setEditCentre({...centre})}>Edit</ActionButton>
                      <ActionButton className="danger" onClick={() => removeCentre(centre)}>Remove</ActionButton>
                    </Group>
                  </DataTable.Td>
                </DataTable.Tr>
              ))}
            </DataTable.Tbody>
          </DataTable>
        </div>
        {editCentre ? (
          <form className="form" onSubmit={saveCentre} style={{marginTop: 18}}>
            <FieldInput label="Centre name" required value={editCentre.name} maxLength={120} onChange={(e) => setEditCentre({...editCentre, name: e.target.value})} />
            <FieldInput label="Code" value={editCentre.code} maxLength={20} onChange={(e) => setEditCentre({...editCentre, code: e.target.value})} />
            <FieldInput label="Address" value={editCentre.address} maxLength={300} onChange={(e) => setEditCentre({...editCentre, address: e.target.value})} />
            <Group>
              <ActionButton type="submit">Save centre</ActionButton>
              <ActionButton className="secondary" onClick={() => setEditCentre(null)}>Cancel</ActionButton>
            </Group>
          </form>
        ) : (
          <form className="form" onSubmit={addCentre} style={{marginTop: 18}}>
            <FieldInput label="New centre name" required value={newCentre.name} maxLength={120} placeholder="e.g. City College Building" onChange={(e) => setNewCentre({...newCentre, name: e.target.value})} />
            <FieldInput label="Code" value={newCentre.code} maxLength={20} placeholder="C2" onChange={(e) => setNewCentre({...newCentre, code: e.target.value})} />
            <FieldInput label="Address" value={newCentre.address} maxLength={300} onChange={(e) => setNewCentre({...newCentre, address: e.target.value})} />
            <ActionButton type="submit">Add centre</ActionButton>
          </form>
        )}
      </Paper>

      <Paper className="panel">
        <Group justify="space-between" mb="sm">
          <div>
            <h2>Shifts</h2>
            <Text size="xs" c="dimmed">Rooms are shared by every shift; seats are allocated per shift.</Text>
          </div>
          <Badge variant="light" color="teal">{shifts.length} shifts</Badge>
        </Group>
        <div className="table-wrap">
          <DataTable>
            <DataTable.Thead>
              <DataTable.Tr>
                {['Shift', 'Start', 'Report by', 'Duration', 'Students', 'Order', ''].map((v) => (
                  <DataTable.Th key={v}>{v}</DataTable.Th>
                ))}
              </DataTable.Tr>
            </DataTable.Thead>
            <DataTable.Tbody>
              {shifts.map((shift) => (
                <DataTable.Tr key={shift.id}>
                  <DataTable.Td><b>{shift.name}</b></DataTable.Td>
                  <DataTable.Td>{shift.start}</DataTable.Td>
                  <DataTable.Td>{shift.reportBy || '—'}</DataTable.Td>
                  <DataTable.Td>{shift.duration}</DataTable.Td>
                  <DataTable.Td>{shiftStudents(shift.id)}</DataTable.Td>
                  <DataTable.Td>{shift.order}</DataTable.Td>
                  <DataTable.Td>
                    <Group gap="xs">
                      <ActionButton className="secondary" onClick={() => setEditShift({...shift})}>Edit</ActionButton>
                      <ActionButton className="danger" onClick={() => removeShift(shift)}>Remove</ActionButton>
                    </Group>
                  </DataTable.Td>
                </DataTable.Tr>
              ))}
            </DataTable.Tbody>
          </DataTable>
        </div>
        {editShift ? (
          <form className="form" onSubmit={saveShift} style={{marginTop: 18}}>
            <FieldInput label="Shift name" required value={editShift.name} maxLength={40} onChange={(e) => setEditShift({...editShift, name: e.target.value})} />
            <FieldInput label="Start time" type="time" required value={editShift.start} onChange={(e) => setEditShift({...editShift, start: e.target.value})} />
            <FieldInput label="Report by" type="time" value={editShift.reportBy} onChange={(e) => setEditShift({...editShift, reportBy: e.target.value})} />
            <FieldInput label="Duration" value={editShift.duration} maxLength={100} onChange={(e) => setEditShift({...editShift, duration: e.target.value})} />
            <FieldInput label="Order" type="number" min={1} max={99} value={editShift.order} onChange={(e) => setEditShift({...editShift, order: Number(e.target.value)})} />
            <Group>
              <ActionButton type="submit">Save shift</ActionButton>
              <ActionButton className="secondary" onClick={() => setEditShift(null)}>Cancel</ActionButton>
            </Group>
          </form>
        ) : (
          <form className="form" onSubmit={addShift} style={{marginTop: 18}}>
            <FieldInput label="New shift name" required value={newShift.name} maxLength={40} placeholder="e.g. Afternoon" onChange={(e) => setNewShift({...newShift, name: e.target.value})} />
            <FieldInput label="Start time" type="time" required value={newShift.start} onChange={(e) => setNewShift({...newShift, start: e.target.value})} />
            <FieldInput label="Report by" type="time" value={newShift.reportBy} onChange={(e) => setNewShift({...newShift, reportBy: e.target.value})} />
            <FieldInput label="Duration" value={newShift.duration} maxLength={100} onChange={(e) => setNewShift({...newShift, duration: e.target.value})} />
            <ActionButton type="submit">Add shift</ActionButton>
          </form>
        )}
      </Paper>
    </>
  );
}
