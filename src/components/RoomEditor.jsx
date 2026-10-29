import React from 'react';
import {FieldInput, FieldSelect, ActionButton} from './ui.jsx';
import {useExam} from '../context.jsx';
import {uid, roomAffectedStudents, updateRoomModel} from '../lib/domain.js';

export default function RoomEditor({room = null, centerId = '', onDone = () => {}}) {
  const {state, store, run, notify} = useExam();
  const centres = state.exam.centers || [];
  const defaultCentre = room?.centerId || centerId || centres[0]?.id || '';

  function submit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    run(() => {
      const data = Object.fromEntries(new FormData(form));
      for (const k of ['name', 'building', 'floor', 'directions']) data[k] = String(data[k] || '').trim();
      data.benches = Number(data.benches);
      data.per = Number(data.per);
      if (!centres.some((c) => c.id === data.centerId)) throw Error('Select a centre.');
      if (
        !data.name ||
        !data.building ||
        !data.floor ||
        !data.directions ||
        !Number.isInteger(data.benches) ||
        data.benches < 1 ||
        data.benches > 200 ||
        !Number.isInteger(data.per) ||
        data.per < 1 ||
        data.per > 4
      )
        throw Error('Enter valid room, bench and seat information.');
      if (state.rooms.some((r) => r.id !== room?.id && r.name === data.name && r.building === data.building && r.centerId === data.centerId))
        throw Error('This room number already exists in the same building and centre.');
      const assigned = room ? state.students.filter((s) => s.seat?.roomId === room.id).length : 0;
      if (room && data.centerId !== room.centerId && assigned)
        throw Error('Clear this room’s seat assignments before moving it to another centre.');
      const affected = room ? roomAffectedStudents(state, room, data).length : 0;
      if ((state.exam.locked || assigned) && !confirm('Save these changes?' + (affected ? ` ${affected} student assignments will be removed.` : '') + (state.exam.locked ? ' Seating will be unlocked.' : ''))) return;
      const id = room?.id || uid();
      store.commit((next) => {
        next.exam.locked = false;
        if (room) updateRoomModel(next, next.rooms.find((r) => r.id === room.id), data);
        else next.rooms.push({...data, id});
      });
      if (!room) form.reset();
      notify(room ? 'Room updated' : 'Room added');
      onDone(id);
    });
  }

  return (
    <form className="form" onSubmit={submit}>
      <label>Centre
        <FieldSelect name="centerId" defaultValue={defaultCentre} required>
          {centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </FieldSelect>
      </label>
      {[
        ['name', 'Room number', 'text'],
        ['building', 'Building', 'text'],
        ['floor', 'Floor', 'text'],
        ['benches', 'Total benches', 'number'],
        ['per', 'Seats per bench (1–4)', 'number'],
        ['directions', 'Directions', 'text'],
      ].map(([name, label, type]) => (
        <label key={name}>{label}
          <FieldInput
            name={name}
            type={type}
            defaultValue={room?.[name] ?? ''}
            required
            min={type === 'number' ? 1 : undefined}
            max={type === 'number' ? (name === 'per' ? 4 : 200) : undefined}
            maxLength={type === 'text' ? 180 : undefined}
          />
        </label>
      ))}
      <ActionButton type="submit">{room ? 'Save changes' : 'Add room'}</ActionButton>
    </form>
  );
}
