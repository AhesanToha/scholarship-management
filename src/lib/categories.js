export function categories(exam = {}) {
  return (
    exam.categories || [
      { id: 'primary', name: 'PRIMARY', from: 4, to: Number(exam.primaryMax || 5) },
      { id: 'junior', name: 'JUNIOR', from: Number(exam.primaryMax || 5) + 1, to: Number(exam.juniorMax || 8) },
    ]
  );
}
export function validateCategories(exam) {
  if (exam.categories === undefined) return;
  const list = exam.categories;
  if (!Array.isArray(list) || !list.length || list.length > 6) throw Error('Add between 1 and 6 categories.');
  const ids = new Set(),
    grades = new Set();
  for (const c of list) {
    if (
      !c ||
      typeof c.id !== 'string' ||
      !c.id ||
      ids.has(c.id) ||
      typeof c.name !== 'string' ||
      !c.name.trim() ||
      c.name.length > 30 ||
      !Number.isInteger(c.from) ||
      !Number.isInteger(c.to) ||
      c.from < 1 ||
      c.to > 12 ||
      c.from > c.to
    )
      throw Error('Enter a category name and a valid class range (1–12).');
    if (c.shiftId !== undefined && (typeof c.shiftId !== 'string' || !c.shiftId || c.shiftId.length > 100))
      throw Error('Invalid category shift.');
    ids.add(c.id);
    for (let g = c.from; g <= c.to; g++) {
      if (grades.has(g)) throw Error('Class ranges cannot overlap.');
      grades.add(g);
    }
  }
}
export function allowedGrades(exam = {}) {
  return [
    ...new Set(
      categories(exam).flatMap((c) => Array.from({ length: Math.max(0, c.to - c.from + 1) }, (_, i) => String(c.from + i))),
    ),
  ].sort((a, b) => Number(a) - Number(b));
}
export function categoryFor(grade, exam = {}) {
  return categories(exam).find((c) => Number(grade) >= c.from && Number(grade) <= c.to)?.name || '—';
}
