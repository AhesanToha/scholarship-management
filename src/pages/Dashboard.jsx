import React, {useState} from 'react';
import {Link} from 'react-router-dom';
import {Paper, SimpleGrid, Group, Stack, Text, Title, ThemeIcon, Badge, Progress, Button} from '@mantine/core';
import {IconUsers, IconArmchair, IconBuilding, IconUserCheck, IconCheck, IconClock} from '@tabler/icons-react';
import {useExam} from '../context.jsx';
import {capacity, schoolNames} from '../lib/domain.js';
import {FieldSelect} from '../components/ui.jsx';

export default function Dashboard() {
  const {state, cloud} = useExam();
  const centres = state.exam.centers || [];
  const shifts = [...(state.exam.shifts || [])].sort((a, b) => a.order - b.order);
  const [centerId, setCenterId] = useState('');
  const students = state.students.filter((s) => !centerId || s.centerId === centerId);
  const assigned = students.filter((s) => s.seat).length;
  const total = students.length;
  const percent = total ? Math.round((assigned / total) * 100) : 0;
  const active = students.filter((s) => s.status !== 'withdrawn').length;
  const rooms = state.rooms.filter((r) => !centerId || r.centerId === centerId);
  const metrics = [
    ['Total students', total, schoolNames({...state, students}).length + ' participating schools', IconUsers, 'blue'],
    ['Seats assigned', assigned, 'Assigned students', IconArmchair, 'teal'],
    ['Total capacity', capacity(state, centerId || undefined), rooms.length + ' exam rooms', IconBuilding, 'violet'],
    ['Students present', students.filter((s) => s.present).length, 'Attendance today', IconUserCheck, 'orange'],
  ];

  return (
    <>
      <div className="toolbar no-print" style={{justifyContent: 'flex-end'}}>
        <label>Centre
          <FieldSelect aria-label="Centre filter" value={centerId} onChange={(e) => setCenterId(e.target.value)}>
            <option value="">All centres</option>
            {centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </FieldSelect>
        </label>
      </div>

      {(state.schoolSubmissions || []).some((s) => s.status === 'pending' && !state.students.some((x) => x.submissionId === s.id)) && (
        <Paper p="lg" mb="lg">
          <Group justify="space-between">
            <div>
              <Text fw={700}>New registrations</Text>
              <Text size="sm" c="dimmed">
                {(state.schoolSubmissions || []).filter((s) => s.status === 'pending' && !state.students.some((x) => x.submissionId === s.id)).length} students awaiting approval
              </Text>
            </div>
            <Button component={Link} to="/schools">Review applications</Button>
          </Group>
        </Paper>
      )}

      <SimpleGrid cols={{base: 1, sm: 2, xl: 4}} spacing="lg" className="metric-grid">
        {metrics.map(([label, n, hint, Icon, color]) => (
          <Paper key={label} p="lg" className="metric-card">
            <Group justify="space-between">
              <Text c="dimmed" size="sm" fw={550}>{label}</Text>
              <ThemeIcon size={38} radius="md" variant="light" color={color}><Icon size={20} /></ThemeIcon>
            </Group>
            <Text className="metric-number" fw={750} size="32px" my="sm">{n}</Text>
            <Text c="dimmed" size="xs">{hint}</Text>
          </Paper>
        ))}
      </SimpleGrid>

      <Paper p="lg" mt="xl">
        <Group justify="space-between" mb="md">
          <div>
            <Text fw={700}>Shifts</Text>
            <Text size="xs" c="dimmed">Seats are allocated per shift; rooms are shared.</Text>
          </div>
          <Badge variant="light" color="teal">{shifts.length} shifts</Badge>
        </Group>
        <SimpleGrid cols={{base: 1, sm: 2, lg: Math.max(1, Math.min(4, shifts.length))}} spacing="md">
          {shifts.map((shift) => {
            const shiftStudents = students.filter((s) => s.shiftId === shift.id);
            const shiftAssigned = shiftStudents.filter((s) => s.seat).length;
            const pct = shiftStudents.length ? Math.round((shiftAssigned / shiftStudents.length) * 100) : 0;
            return (
              <Paper p="md" withBorder key={shift.id}>
                <Group justify="space-between">
                  <Text fw={650}>{shift.name}</Text>
                  <Badge variant="light">{shift.start}{shift.reportBy ? ` · report ${shift.reportBy}` : ''}</Badge>
                </Group>
                <Text size="xs" c="dimmed" mt={4}>{shiftStudents.length} students · {shiftAssigned} assigned</Text>
                <Progress value={pct} color="teal" size="sm" radius="xl" mt="sm" />
              </Paper>
            );
          })}
        </SimpleGrid>
      </Paper>

      <Paper className="dashboard-actions" p="lg" mt="xl">
        <Group justify="space-between">
          <div>
            <Text fw={700}>Quick actions</Text>
            <Text size="xs" c="dimmed" mt={4}>{state.exam.date} · {shifts[0]?.start || state.exam.time}</Text>
          </div>
          <Group>
            <Button component={Link} to="/rooms">Allocate seats</Button>
            <Button variant="default" component={Link} to="/admit-cards">Admit cards</Button>
            <Button variant="light" component={Link} to="/volunteer" target="_blank">Volunteer desk ↗</Button>
          </Group>
        </Group>
      </Paper>

      <SimpleGrid cols={{base: 1, md: 2}} spacing="xl" mt="xl">
        <Paper p="xl">
          <Group justify="space-between" mb="lg">
            <Title order={3} size="h4">Seating progress</Title>
            <Badge color="teal" variant="light">{percent}% complete</Badge>
          </Group>
          <Text size="sm" c="dimmed">{assigned} assigned · {total - assigned} unassigned</Text>
          <Progress value={percent} color="teal" size="md" radius="xl" mt="lg" mb="xl" />
          <SimpleGrid cols={2}>
            <div><Text size="xs" c="dimmed">Unassigned</Text><Text size="xl" fw={700}>{total - assigned}</Text></div>
            <div><Text size="xs" c="dimmed">Available seats</Text><Text size="xl" fw={700}>{Math.max(0, capacity(state, centerId || undefined) - assigned)}</Text></div>
          </SimpleGrid>
        </Paper>
        <Paper p="xl">
          <Group justify="space-between" mb="lg">
            <Title order={3} size="h4">Exam readiness</Title>
            <Badge color={state.exam.locked ? 'teal' : 'gray'} variant="light">{state.exam.locked ? 'Finalized' : 'In progress'}</Badge>
          </Group>
          <Stack gap="lg">
            {[
              ['Student records', total > 0, 'Names, classes, schools and rolls'],
              ['Admit cards ready', cloud.ready, 'Data synchronized'],
              ['Seats assigned', active > 0 && students.filter((s) => s.status !== 'withdrawn' && !s.seat).length === 0, `${assigned} / ${total} students assigned`],
              ['Final review & lock', state.exam.locked, 'Confirm allocations before the exam'],
            ].map(([label, done, hint]) => (
              <Group key={label} align="flex-start" gap="sm">
                <ThemeIcon variant="light" color={done ? 'teal' : 'gray'} radius="xl" size="sm">{done ? <IconCheck size={14} /> : <IconClock size={14} />}</ThemeIcon>
                <div>
                  <Text fw={600} size="sm">{label}</Text>
                  <Text c="dimmed" size="xs" mt={3}>{hint}</Text>
                </div>
              </Group>
            ))}
          </Stack>
        </Paper>
      </SimpleGrid>
    </>
  );
}
