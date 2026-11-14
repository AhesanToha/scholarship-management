// Shared data-model migration. Runs in the browser, the Worker and Node tests.
// Additive by design: old backups keep working after one pass.
const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const newId = () => globalThis.crypto.randomUUID();

export const SCHEMA_VERSION = 3;

export function toAsciiDigits(value) {
  return String(value ?? '').replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

export function isTime(value) {
  return TIME.test(String(value ?? ''));
}

/** Default shift for a class, from the exam category ranges. */
export function shiftForGrade(state, grade) {
  const list = state?.exam?.categories;
  const value = Number(toAsciiDigits(grade).trim());
  if (Array.isArray(list) && Number.isFinite(value)) {
    const match = list.find(
      (c) => c && Number.isInteger(c.from) && Number.isInteger(c.to) && value >= c.from && value <= c.to,
    );
    if (match?.shiftId) return match.shiftId;
  }
  return state?.exam?.shifts?.[0]?.id || null;
}

/** Default centre for a school. */
export function centerForSchool(state, school) {
  return school?.centerId || state?.exam?.centers?.[0]?.id || null;
}

/**
 * Fill every v3 field that is missing. Existing values are never replaced,
 * so running this twice is a no-op. Returns the same object.
 */
export function migrateState(state) {
  if (!state || typeof state !== 'object') return state;
  const exam = state.exam ?? (state.exam = {});
  state.rooms = Array.isArray(state.rooms) ? state.rooms : [];
  state.students = Array.isArray(state.students) ? state.students : [];
  if (!Array.isArray(state.schools)) state.schools = [];
  state.schemaVersion = SCHEMA_VERSION;

  if (!Number.isInteger(exam.year)) {
    const parsed = Number(String(exam.date || '').slice(0, 4));
    exam.year = Number.isInteger(parsed) && parsed > 2000 && parsed < 2100 ? parsed : new Date().getFullYear();
  }
  if (!Number.isInteger(exam.seatVersion)) exam.seatVersion = 0;
  if (exam.publishedAt === undefined) exam.publishedAt = null;

  if (!Array.isArray(exam.centers) || !exam.centers.length) {
    exam.centers = [
      {
        id: 'centre-main',
        name: String(exam.center || 'Main Centre').trim() || 'Main Centre',
        address: '',
        code: 'C1',
      },
    ];
  }
  exam.centers.forEach((center, index) => {
    if (!center || typeof center !== 'object') return;
    if (typeof center.id !== 'string' || !center.id) center.id = newId();
    if (typeof center.name !== 'string' || !center.name.trim()) center.name = `Centre ${index + 1}`;
    if (typeof center.address !== 'string') center.address = '';
    if (typeof center.code !== 'string' || !center.code) center.code = `C${index + 1}`;
  });
  const defaultCenter = exam.centers[0].id;

  if (!Array.isArray(exam.shifts) || !exam.shifts.length) {
    exam.shifts = [
      {
        id: 'shift-main',
        name: 'Morning',
        start: isTime(exam.time) ? exam.time : '10:00',
        reportBy: '',
        duration: typeof exam.duration === 'string' && exam.duration ? exam.duration : '1 Hour 20 Minutes',
        order: 1,
      },
    ];
  }
  exam.shifts.forEach((shift, index) => {
    if (!shift || typeof shift !== 'object') return;
    if (typeof shift.id !== 'string' || !shift.id) shift.id = newId();
    if (typeof shift.name !== 'string' || !shift.name.trim()) shift.name = `Shift ${index + 1}`;
    if (!isTime(shift.start)) shift.start = '10:00';
    if (typeof shift.reportBy !== 'string') shift.reportBy = '';
    if (typeof shift.duration !== 'string' || !shift.duration) {
      shift.duration = typeof exam.duration === 'string' && exam.duration ? exam.duration : '1 Hour 20 Minutes';
    }
    if (!Number.isInteger(shift.order)) shift.order = index + 1;
  });
  const defaultShift = exam.shifts[0].id;

  for (const room of state.rooms) {
    if (room && typeof room === 'object' && !room.centerId) room.centerId = defaultCenter;
  }

  for (const school of state.schools) {
    if (!school || typeof school !== 'object') continue;
    if (!school.centerId) school.centerId = defaultCenter;
    if (!school.shiftId) school.shiftId = defaultShift;
  }

  for (const student of state.students) {
    if (!student || typeof student !== 'object') continue;
    if (!student.shiftId && student.seat?.shiftId) student.shiftId = student.seat.shiftId;
    if (!student.centerId && student.seat?.roomId) {
      const room = state.rooms.find((r) => r.id === student.seat.roomId);
      if (room?.centerId) student.centerId = room.centerId;
    }
    if (!student.centerId) student.centerId = student.seat ? defaultCenter : null;
    if (!student.shiftId) student.shiftId = defaultShift;
    if (!student.status) student.status = 'active';
    if (student.gender === undefined) student.gender = null;
    if (student.dob === undefined) student.dob = null;
    if (student.section === undefined) student.section = null;
    if (student.presentAt === undefined) student.presentAt = null;
    if (student.presentBy === undefined) student.presentBy = null;
    if (student.seat) {
      const room = state.rooms.find((r) => r.id === student.seat.roomId);
      if (room?.centerId) student.centerId = room.centerId;
      if (!student.seat.shiftId) student.seat.shiftId = student.shiftId;
      if (!student.seat.centerId) student.seat.centerId = room?.centerId || student.centerId;
    } else {
      student.centerId = null;
    }
  }

  return state;
}
