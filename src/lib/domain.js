import {validateRegistration} from './operations.js';
import {validateCategories,shiftForStudent} from './categories.js';
import {studentErrors,normalizedSchoolName,normalizeText,normalizedDigits,legacySchoolMatch} from './form-validation.js';
import {validateShifts,DEFAULT_SHIFTS} from './shifts.js';
import {seatTopology,pairConflict,seatConflicts} from './seat-rules.js';
export const KEY='seat-desk-demo-v1';
export const uid=()=>crypto.randomUUID();
export const DEMO_SCHOOLS=['Aunushilon Academy','Grammer School'];
// Demo students (mainly for testing / demo): 50 from Aunushilon Academy in
// Class 6-8 (17 + 17 + 16) and 50 from Grammer School across Class 4-8
// (10 per class). Total still 100, so Shift 1 (Class 4-5) has 20 students
// and Shift 2 (Class 6-8) has 80.
export function demoStudents(){const names=['আরিফ','সুমাইয়া','রাফি','নুসরাত','আয়েশা','তানভীর','মেহজাবিন','সাদমান','ফারহান','তাসনিম','রায়হান','মাহিয়া','নাফিস','সামিয়া','ইমরান','ফারিয়া','আদনান','নাবিলা','সাকিব','জান্নাত'],surnames=['হাসান','ইসলাম','রহমান','আহমেদ','চৌধুরী'];const plan=[];for(let i=0;i<50;i++)plan.push({school:'Aunushilon Academy',grade:String(6+Math.floor(i/17))});for(let i=0;i<50;i++)plan.push({school:'Grammer School',grade:String(4+Math.floor(i/10))});return plan.map(({school,grade},i)=>({id:uid(),name:names[i%20]+' '+surnames[Math.floor(i/20)],school,grade,roll:String(260401+i),present:false,seat:null,demoBatch:2}))}

export function demoRoom(index){return {id:uid(),name:'D'+String(index).padStart(2,'0'),building:'Demo',floor:'নিচতলা',benches:10,per:2,columnBenches:[5,5],directions:'Demo ভবনের নিচতলায় রুম D'+String(index).padStart(2,'0')+'।',demoBatch:2}}

export function seed(){return {demoVersion:3,exam:{name:'SCIENCE QUEST 2026',center:'নমুনা বিদ্যালয়',date:'2026-12-18',time:'10:00',locked:false,shifts:DEFAULT_SHIFTS.map(s=>({...s})),categories:[{id:'primary',name:'PRIMARY',from:4,to:5,shiftId:'shift-1'},{id:'junior',name:'JUNIOR',from:6,to:8,shiftId:'shift-2'}]},rooms:Array.from({length:5},(_,i)=>demoRoom(i+1)),students:demoStudents()}}

export function parseCSV(text){let rows=[],row=[],v='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){v+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(v);v=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(v);if(row.some(x=>x.trim()))rows.push(row);row=[];v=''}else v+=c}if(quoted)throw Error("Incomplete CSV quotation");row.push(v);if(row.some(x=>x.trim()))rows.push(row);return rows}

// CSV import preview: what a file would import, before anything is sent.
// Valid rows are grouped by school (with a class and shift breakdown);
// problem rows are listed with the reason, so the user confirms exactly
// what will happen — no silent import, and no surprise server rejection.
export function buildCsvImportPreview(state,rows){
  const header=rows[0]?.map(v=>v.trim()).join(',');
  const headers=['name,school,class','name,school,class,roll','name,school,grade','name,school,grade,roll'];
  if(!headers.includes(header))return {headerError:'CSV headers must be name,school,grade.',totalRows:0,valid:[],problems:[],groups:[],overLimit:false};
  const columns=header.endsWith(',roll')?4:3,activeSchools=(state.schools||[]).filter(s=>s.active);
  const existing=[...(state.students||[]),...(state.schoolSubmissions||[]).filter(s=>s.status!=='rejected')];
  const valid=[],problems=[],seen=new Set();
  for(let i=1;i<rows.length;i++){
    const row=rows[i],n=i+1;
    if(row.length!==columns){problems.push({row:n,reason:'Row is incomplete.'});continue}
    const [name,school,grade]=row.map(v=>v.trim());
    const matches=activeSchools.filter(s=>normalizedSchoolName(s.name)===normalizedSchoolName(school));
    if(matches.length!==1){problems.push({row:n,reason:matches.length?`"${school}" matches more than one registered school.`:`"${school}" is not a registered active school. Register it on the Schools page first.`});continue}
    const data={name,schoolId:matches[0].id,grade},invalid=studentErrors(data,{schoolRequired:true,exam:state.exam});
    if(Object.keys(invalid).length){problems.push({row:n,reason:Object.values(invalid).join(' ')});continue}
    const key=matches[0].id+'|'+normalizedDigits(String(grade))+'|'+normalizedSchoolName(name);
    if(seen.has(key)){problems.push({row:n,reason:'This student appears twice in this file.'});continue}
    seen.add(key);
    // Same duplicate rule as the server: same grade + name + school, with
    // empty father name and guardian phone (a CSV row carries neither).
    const duplicate=existing.some(s=>s.grade===normalizedDigits(String(grade))&&normalizedSchoolName(s.name)===normalizedSchoolName(name)&&normalizeText(s.fatherName)===''&&normalizedDigits(s.guardianPhone)===''&&(s.schoolId===matches[0].id||legacySchoolMatch(state,s,matches[0])));
    if(duplicate){problems.push({row:n,reason:'This student already exists in this school.'});continue}
    valid.push({row:n,name,schoolId:matches[0].id,schoolName:matches[0].name,grade:normalizedDigits(String(grade))});
  }
  const groups=[];for(const v of valid){let g=groups.find(g=>g.schoolId===v.schoolId);if(!g){g={schoolId:v.schoolId,schoolName:v.schoolName,count:0,grades:{},shifts:{}};groups.push(g)}g.count++;g.grades[v.grade]=(g.grades[v.grade]||0)+1;const sid=shiftForStudent({grade:v.grade},state.exam);g.shifts[sid]=(g.shifts[sid]||0)+1}
  return {headerError:'',totalRows:rows.length-1,valid,problems,groups,overLimit:valid.length>500};
}
export function validateBackup(d){validateRegistration(d?.exam||{});validateShifts(d?.exam||{});validateCategories(d?.exam||{});if(!d||!d.exam||!Array.isArray(d.rooms)||!Array.isArray(d.students))throw Error("Invalid format");for(const k of ['name','center','date','time'])if(typeof d.exam[k]!=='string')throw Error("Invalid exam");const ids=new Set(),rolls=new Set();for(const r of d.rooms){for(const k of ['id','name','building','floor','directions'])if(typeof r[k]!=='string')throw Error("Invalid room");if(ids.has(r.id)||!Number.isInteger(r.benches)||r.benches<1||r.benches>200||!Number.isInteger(r.per)||r.per<1||r.per>4)throw Error("Invalid capacity");if(r.columnBenches!==undefined&&!validCounts(r.columnBenches,r.benches))throw Error("Invalid column layout");ids.add(r.id)}const seats=new Set(),studentIds=new Set();for(const s of d.students){for(const k of ['id','name','school','grade','roll'])if(typeof s[k]!=='string'||!s[k].trim())throw Error("Invalid student");if(rolls.has(normGrade(s.roll))||studentIds.has(s.id))throw Error('Duplicate student');rolls.add(normGrade(s.roll));studentIds.add(s.id);if(s.shiftId!==undefined&&typeof s.shiftId!=='string')throw Error("Invalid shift");if(s.seat){const r=d.rooms.find(r=>r.id===s.seat.roomId);if(!r||!Number.isInteger(s.seat.bench)||s.seat.bench<1||s.seat.bench>r.benches||!'ABCD'.slice(0,r.per).includes(s.seat.position)||s.seat.position.length!==1)throw Error("Invalid seat");const key=r.id+':'+s.seat.bench+':'+s.seat.position+':'+shiftForStudent(s,d.exam);if(seats.has(key))throw Error('Duplicate seat');seats.add(key);for(const k of ['room','building','floor','directions'])if(typeof s.seat[k]!=='string')throw Error("Invalid seat data")}}d.exam.locked=!!d.exam.locked}

export function validCounts(counts,total){return Array.isArray(counts)&&counts.length>=1&&counts.length<=6&&counts.every(n=>Number.isInteger(n)&&n>=1&&n<=200)&&counts.reduce((a,b)=>a+b,0)===total}

export function mapColumns(r){return validCounts(r.columnBenches,r.benches)?r.columnBenches.length:Number.isInteger(r.mapColumns)&&r.mapColumns>=1&&r.mapColumns<=6?Math.min(r.mapColumns,r.benches):Math.min(3,r.benches)}

export function balancedCounts(total,n){return Array.from({length:n},(_,i)=>Math.floor(total/n)+(i<total%n?1:0))}

export function columnCounts(r){return validCounts(r.columnBenches,r.benches)?r.columnBenches:balancedCounts(r.benches,mapColumns(r))}

export function benchPositions(r){const counts=columnCounts(r),columns=counts.map(()=>[]);let bench=1;for(let col=0;col<counts.length;col++)for(let row=0;row<counts[col];row++)columns[col].push(bench++);return columns}

export function normGrade(g){return String(g).trim().replace(/[০-৯]/g,c=>'০১২৩৪৫৬৭৮৯'.indexOf(c))}

export function roomAffectedStudents(state,r,d){return state.students.filter(s=>s.seat?.roomId===r.id&&(s.seat.bench>d.benches||!'ABCD'.slice(0,d.per).includes(s.seat.position)))}

export function updateRoomModel(state,r,d){const affected=roomAffectedStudents(state,r,d);affected.forEach(s=>s.seat=null);const oldCounts=columnCounts(r);Object.assign(r,d);if(!validCounts(oldCounts,r.benches)){r.mapColumns=Math.min(oldCounts.length,r.benches);r.columnBenches=balancedCounts(r.benches,r.mapColumns)}else r.columnBenches=oldCounts;state.students.filter(s=>s.seat?.roomId===r.id).forEach(s=>Object.assign(s.seat,{room:r.name,building:r.building,floor:r.floor,directions:r.directions}));return affected.length}

export function deleteRoomModel(state,id){state.students.filter(s=>s.seat?.roomId===id).forEach(s=>s.seat=null);state.rooms=state.rooms.filter(r=>r.id!==id)}

export function seatKey(s){return s.roomId+':'+s.bench+':'+s.position}

export function allocationCandidates(state,config){const grades=new Set(config.grades.map(normGrade)),schools=config.schools||[];return state.students.filter(s=>(!s.seat||(config.rebuild&&s.seat.roomId===config.roomId))&&(!config.shiftId||shiftForStudent(s,state.exam)===config.shiftId)&&grades.has(normGrade(s.grade))&&(!schools.length||schools.includes(s.school))).sort((a,b)=>a.roll.localeCompare(b.roll,'en',{numeric:true}))}

export function buildAllocationPlan(state,config){
 if(state.exam.locked)throw Error("Seating is locked. Unlock it first.");
 if(!Array.isArray(config.grades)||new Set(config.grades.map(normGrade)).size<2)throw Error("Select at least two classes.");
 const room=state.rooms.find(r=>r.id===config.roomId);if(!room)throw Error("Select a room.");
 const selected=config.studentIds?new Set(config.studentIds):null,candidates=allocationCandidates(state,config).filter(s=>!selected||selected.has(s.id));if(!candidates.length)throw Error("No unassigned students match your selection.");
 if(!config.rebuild&&seatConflicts(state,room.id,config.shiftId||null).length)throw Error("Existing assignments have school or class conflicts. Select Rebuild this room.");
 const {nodes}=seatTopology(room),fixed=new Map();if(!config.rebuild)for(const s of state.students.filter(s=>s.seat?.roomId===room.id&&(!config.shiftId||shiftForStudent(s,state.exam)===config.shiftId))){const node=nodes.find(n=>n.bench===s.seat.bench&&n.position===s.seat.position);if(node)fixed.set(node.index,s)}
 const freeNodes=nodes.filter(n=>!fixed.has(n.index));if(!freeNodes.length)throw Error("This room has no empty seats.");
 const grouped=new Map();for(const s of candidates){const key=normGrade(s.grade)+'|'+(s.schoolId||s.school.trim().toLowerCase());if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(s)}const groups=[...grouped.values()];
 // Bounded multi-start constraint search. Every result is valid; vacant seats
 // are allowed. This heuristic does not claim a globally optimal fill count.
 let best=[],evaluations=0;const budget=2500000;
 for(let attempt=0;attempt<16&&evaluations<budget;attempt++){
  const placed=new Map(fixed),queues=groups.map(g=>[...g]),used=groups.map(()=>0),todo=new Set(freeNodes.map(n=>n.index)),assigned=[];
  while(todo.size&&evaluations<budget){
   let selectedNode=null,domain=null,rank=-1;
   for(const index of todo){const node=nodes[index],valid=[];for(let g=0;g<queues.length;g++){evaluations++;if(queues[g].length&&node.neighbors.every(e=>!placed.has(e.index)||!pairConflict(queues[g][0],placed.get(e.index),e.classRule)))valid.push(g)}
    const score=node.neighbors.filter(e=>placed.has(e.index)).length*10+node.neighbors.length;
    if(valid.length&&(!domain||valid.length<domain.length||valid.length===domain.length&&score>rank)){selectedNode=node;domain=valid;rank=score}if(evaluations>=budget)break;
   }
   if(!selectedNode)break;
   domain.sort((a,b)=>{const score=g=>queues[g].length/(1+used[g])+(attempt%4===0?0:((g+attempt)%groups.length)/Math.max(1,groups.length));return score(b)-score(a)||((a+attempt)%groups.length)-((b+attempt)%groups.length)});
   const g=domain[0],student=queues[g].shift();used[g]++;placed.set(selectedNode.index,student);todo.delete(selectedNode.index);assigned.push({studentId:student.id,seat:{roomId:room.id,room:room.name,building:room.building,floor:room.floor,bench:selectedNode.bench,position:selectedNode.position,directions:room.directions}});
  }
  if(assigned.length>best.length)best=assigned;if(best.length===Math.min(candidates.length,freeNodes.length))break;
 }
 if(!best.length)throw Error("Unable to assign seats within the separation rules. Select other schools, classes or a different room.");
 const ids=new Set(best.map(a=>a.studentId));const plan={signature:JSON.stringify(state),assignments:best,changed:config.rebuild?state.students.filter(s=>s.seat?.roomId===room.id&&(!config.shiftId||shiftForStudent(s,state.exam)===config.shiftId)).length:0,free:freeNodes.length-best.length,remaining:candidates.filter(s=>!ids.has(s.id)).map(s=>s.id),candidateCount:candidates.length,roomId:room.id,rebuild:!!config.rebuild,shiftId:config.shiftId||null,schoolFallbacks:0,strict:true};assertPlanBenchClasses(state,plan);return plan;
}
export function assertPlanBenchClasses(state,plan){const next=structuredClone(state);if(plan.rebuild)next.students.filter(s=>s.seat?.roomId===plan.roomId&&(!plan.shiftId||shiftForStudent(s,state.exam)===plan.shiftId)).forEach(s=>s.seat=null);for(const a of plan.assignments){const student=next.students.find(s=>s.id===a.studentId);if(!student)throw Error('Student missing');student.seat=a.seat}if(seatConflicts(next,plan.roomId,plan.shiftId||null).length)throw Error("School or class conflicts detected. Allocation was not saved.");}

export function applyAllocationPlan(state,plan){if(state.exam.locked)throw Error("Seating is locked.");if(plan.signature!==JSON.stringify(state))throw Error("Data has changed. Preview the allocation again.");assertPlanBenchClasses(state,plan);if(plan.rebuild)state.students.filter(s=>s.seat?.roomId===plan.roomId&&(!plan.shiftId||shiftForStudent(s,state.exam)===plan.shiftId)).forEach(s=>s.seat=null);plan.assignments.forEach(a=>state.students.find(s=>s.id===a.studentId).seat=a.seat);return plan.assignments.length}

// Auto-allocate one shift across ALL rooms: fill rooms in order, each room
// with its own strict-rule plan, on a working copy so later rooms only see
// students still unassigned. Fill mode only — rebuild stays per-room, so a
// single room can be rearranged without clearing the whole shift.
export function buildMultiRoomAllocationPlan(state,config){
 if(state.exam.locked)throw Error("Seating is locked. Unlock it first.");
 if(!Array.isArray(config.grades)||new Set(config.grades.map(normGrade)).size<2)throw Error("Select at least two classes.");
 const selected=config.studentIds?new Set(config.studentIds):null;
 const candidates=allocationCandidates(state,{...config,rebuild:false}).filter(s=>!selected||selected.has(s.id));
 if(!candidates.length)throw Error("No unassigned students match your selection.");
 let remaining=new Set(candidates.map(s=>s.id));
 const working=structuredClone(state),plans=[],skipped=[];
 for(const room of state.rooms){
  if(!remaining.size)break;
  const used=working.students.filter(s=>s.seat?.roomId===room.id&&(!config.shiftId||shiftForStudent(s,working.exam)===config.shiftId)).length;
  if(room.benches*room.per-used<=0){skipped.push({roomId:room.id,reason:'This room has no empty seats for this shift.'});continue}
  try{
   const plan=buildAllocationPlan(working,{...config,roomId:room.id,rebuild:false,studentIds:[...remaining]});
   applyAllocationPlan(working,plan);
   plans.push(plan);
   remaining=new Set(plan.remaining);
  }catch(err){skipped.push({roomId:room.id,reason:err.message})}
 }
 if(!plans.length)throw Error(skipped[0]?.reason||"Unable to assign seats within the separation rules. Select other schools, classes or a different room.");
 return {multi:true,signature:JSON.stringify(state),plans,assignments:plans.flatMap(p=>p.assignments),remaining:[...remaining],candidateCount:candidates.length,shiftId:config.shiftId||null,skipped,rebuild:false,strict:true};
}
export function applyMultiRoomAllocationPlan(state,multi){
 if(state.exam.locked)throw Error("Seating is locked.");
 if(multi.signature!==JSON.stringify(state))throw Error("Data has changed. Preview the allocation again.");
 let total=0;for(const plan of multi.plans)total+=applyAllocationPlan(state,plan);return total;
}

export function ensureTokens(state){const tokens=new Set();for(const student of state.students){if(typeof student.qrToken!=='string'||!/^[a-zA-Z0-9_-]{20,100}$/.test(student.qrToken)||tokens.has(student.qrToken))student.qrToken=uid();tokens.add(student.qrToken)}}

export function snapshot(state,s){const r=state.rooms.find(r=>r.id===s.seat?.roomId);return {v:1,roll:s.roll,exam:state.exam,shift:shiftForStudent(s,state.exam),seat:s.seat,layout:r?{benches:r.benches,per:r.per,columns:mapColumns(r),columnBenches:columnCounts(r)}:null}}
export const capacity=state=>state.rooms.reduce((n,r)=>n+r.benches*r.per,0);
export const schoolNames=state=>[...new Set(state.students.map(s=>s.school))].sort((a,b)=>a.localeCompare(b));
export const gradeNames=state=>[...new Set(state.students.map(s=>normGrade(s.grade)))].sort((a,b)=>Number(a)-Number(b)||a.localeCompare(b));
export function loadLocal(){let data;try{data=JSON.parse(localStorage.getItem(KEY));if(data)validateBackup(data)}catch{data=null}data=data||seed();if(data.demoVersion!==3){// Demo set changed (v3): replace the old demo students with the new
 // set instead of adding on top — real (non-demo) students are untouched.
 data.students=data.students.filter(s=>s.demoBatch!==2);const incoming=demoStudents(),rolls=new Set(data.students.map(s=>s.roll));incoming.forEach(s=>{let roll=Number(s.roll);while(rolls.has(String(roll)))roll++;s.roll=String(roll);rolls.add(s.roll)});data.students.push(...incoming);let i=1;while(capacity(data)<data.students.length){const r=demoRoom(i++);if(!data.rooms.some(x=>x.name===r.name&&x.building===r.building))data.rooms.push(r)}data.demoVersion=3;data.exam.locked=false;data.demoUpgradeNotice=true}ensureTokens(data);return data}
export function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export function filteredStudents(state,{search='',roll='',school='',grade='',status='',shift=''}={}){return state.students.filter(s=>(!roll||normGrade(s.roll)===normGrade(roll))&&(!school||s.school===school)&&(!grade||normGrade(s.grade)===grade)&&(!shift||shiftForStudent(s,state.exam)===shift)&&(!status||(status==='unassigned'?!s.seat:!!s.seat))&&[s.name,s.school,s.roll].some(v=>v.toLowerCase().includes(search.toLowerCase())))}
export const seatUrl=(s,origin=location.origin)=>origin+'/#lookup='+s.qrToken;

export function automaticRoll(state,grade){const prefix=String(new Date().getFullYear()).slice(-2)+normGrade(grade).padStart(2,'0');const rolls=new Set(state.students.map(s=>normGrade(s.roll)));let n=1;while(rolls.has(prefix+String(n).padStart(4,'0')))n++;return prefix+String(n).padStart(4,'0');}
