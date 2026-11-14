import {shiftsFor,defaultShiftIdForIndex} from './shifts.js';
export function categories(exam={}){
 return exam.categories||[{id:'primary',name:'PRIMARY',from:4,to:Number(exam.primaryMax||5)},{id:'junior',name:'JUNIOR',from:Number(exam.primaryMax||5)+1,to:Number(exam.juniorMax||8)}];
}
// A category's shift: its saved shiftId when valid, otherwise the default
// for its position (1st category -> Shift 1, 2nd -> Shift 2, ...).
// categories() itself is kept shape-stable for existing callers/tests.
export function categoryShiftId(category,exam={},index=0){
 if(typeof category?.shiftId==='string'&&shiftsFor(exam).some(s=>s.id===category.shiftId))return category.shiftId;
 return defaultShiftIdForIndex(index,exam);
}
export function validateCategories(exam){
 if(exam.categories===undefined)return;const list=exam.categories;if(!Array.isArray(list)||!list.length||list.length>6)throw Error("Add between 1 and 6 categories.");const ids=new Set(),grades=new Set();const shiftIds=new Set(shiftsFor(exam).map(s=>s.id));
 for(const c of list){if(!c||typeof c.id!=='string'||!c.id||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||c.name.length>30||!Number.isInteger(c.from)||!Number.isInteger(c.to)||c.from<1||c.to>12||c.from>c.to)throw Error("Enter a category name and a valid class range (1–12).");if(c.shiftId!==undefined&&(typeof c.shiftId!=='string'||!shiftIds.has(c.shiftId)))throw Error("Select a valid shift for each category.");ids.add(c.id);for(let g=c.from;g<=c.to;g++){if(grades.has(g))throw Error("Class ranges cannot overlap.");grades.add(g)}}
}
export function allowedGrades(exam={}){return [...new Set(categories(exam).flatMap(c=>Array.from({length:Math.max(0,c.to-c.from+1)},(_,i)=>String(c.from+i))))].sort((a,b)=>Number(a)-Number(b))}
export function categoryObjFor(grade,exam={}){return categories(exam).find(c=>Number(grade)>=c.from&&Number(grade)<=c.to)||null}
// Kept as a name string for existing callers/tests (e.g. AdmitCards).
export function categoryFor(grade,exam={}){return categoryObjFor(grade,exam)?.name||'—'}
export function categoryNameFor(grade,exam={}){return categoryFor(grade,exam)}
// A student's shift comes from its category (Settings → category → shift).
// An explicit student.shiftId, when valid, wins — so an admin can move
// one student without changing the whole category.
export function shiftForGrade(grade,exam={}){const list=categories(exam),i=list.findIndex(c=>Number(grade)>=c.from&&Number(grade)<=c.to);if(i<0)return shiftsFor(exam)[0].id;return categoryShiftId(list[i],exam,i)}
export function shiftForStudent(student={},exam={}){if(typeof student.shiftId==='string'&&shiftsFor(exam).some(s=>s.id===student.shiftId))return student.shiftId;return shiftForGrade(student.grade,exam)}
export function gradesForShift(exam={},shiftId){return allowedGrades(exam).filter(g=>shiftForGrade(g,exam)===shiftId)}
