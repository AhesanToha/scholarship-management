import {normalizedDigits,normalizedSchoolName,normalizeText,legacySchoolMatch} from './form-validation.js';
export function validateRegistration(exam={}){
 if(exam.registrationClosed!==undefined&&typeof exam.registrationClosed!=='boolean')throw Error('Invalid registration status.');
 if(exam.registrationDeadline!==undefined&&exam.registrationDeadline!==''&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(exam.registrationDeadline)||!Number.isFinite(Date.parse(exam.registrationDeadline))||new Date(exam.registrationDeadline).toISOString().replace('.000Z','Z')!==exam.registrationDeadline.replace('.000Z','Z')))throw Error('Invalid registration deadline.');
}
export function registrationStatus(exam={},now=Date.now()){
 const deadline=exam.registrationDeadline||null;
 const reason=exam.registrationClosed?'manual':exam.locked?'locked':deadline&&now>=Date.parse(deadline)?'deadline':null;
 return {open:!reason,reason,deadline,serverNow:now};
}
export function fromDhakaInput(value){
 if(!value)return '';
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Enter a valid deadline.');
 const date=new Date(value+':00+06:00');
 if(!Number.isFinite(date.getTime())||toDhakaInput(date.toISOString())!==value)throw Error('Enter a valid deadline.');
 return date.toISOString();
}
export function toDhakaInput(value){if(!value)return '';return new Date(Date.parse(value)+6*60*60*1000).toISOString().slice(0,16)}
export function schoolRoster(state,school){
 const submissions=(state.schoolSubmissions||[]).filter(s=>s.schoolId===school.id);
 const linked=new Map((state.students||[]).filter(s=>s.submissionId).map(s=>[s.submissionId,s]));
 const rows=submissions.map(s=>{const student=linked.get(s.id);return {...s,...(student?{...student,status:'approved',examRoll:student.roll}:{}),status:student?'approved':s.status==='approved'?'removed':s.status}});
 const represented=new Set(submissions.map(s=>s.id));
 for(const s of state.students||[])if((s.schoolId===school.id||legacySchoolMatch(state,s,school))&&(!s.submissionId||!represented.has(s.submissionId)))rows.push({...s,status:'approved',examRoll:s.roll});
 return rows;
}
export function progressFromRows(rows){const active=rows.filter(s=>s.status!=='removed');return {total:active.length,approved:active.filter(s=>s.status==='approved').length,pending:active.filter(s=>s.status==='pending').length,returned:active.filter(s=>s.status==='rejected').length,missingPhoto:active.filter(s=>!s.photoId).length}}
export const schoolProgress=(state,school)=>progressFromRows(schoolRoster(state,school));
const identityName=value=>normalizeText(value).toLocaleLowerCase().replace(/[\s.'’ʼ\-]+/g,'');
const duplicateKey=(schoolId,s)=>JSON.stringify([schoolId,normalizedDigits(s.grade),identityName(s.name),identityName(s.fatherName)]);
export function buildDuplicateIndex(state){
 const names=new Map();for(const school of state.schools||[]){const name=normalizedSchoolName(school.name);names.set(name,names.has(name)?null:school.id)}
 const main=state.students||[],represented=new Set(main.map(s=>s.submissionId).filter(Boolean)),index=new Map();
 const add=(s,status)=>{const schoolId=s.schoolId||names.get(normalizedSchoolName(s.school));if(!schoolId)return;const key=duplicateKey(schoolId,s);if(!index.has(key))index.set(key,[]);index.get(key).push({id:s.id,submissionId:s.submissionId,name:s.name,fatherName:s.fatherName||'',grade:s.grade,roll:s.roll||null,status})};
 for(const s of main)add(s,'approved');for(const s of state.schoolSubmissions||[])if(!represented.has(s.id)&&!['removed','rejected'].includes(s.status))add(s,s.status);
 return index;
}
export function possibleDuplicates(state,input,{schoolId=input.schoolId,excludeId=input.id,index=buildDuplicateIndex(state)}={}){
 return (index.get(duplicateKey(schoolId,input))||[]).filter(s=>s.id!==excludeId&&s.submissionId!==excludeId);
}
