import {validateCategories} from './categories.js';
import {seatTopology,pairConflict,seatConflicts} from './seat-rules.js';
export const KEY='seat-desk-demo-v1';
export const uid=()=>crypto.randomUUID();
export const DEMO_SCHOOLS=['Aunushilon Academy','Grammer School','Kourok Biddapit'];
export function demoStudents(){const names=['আরিফ','সুমাইয়া','রাফি','নুসরাত','আয়েশা','তানভীর','মেহজাবিন','সাদমান','ফারহান','তাসনিম','রায়হান','মাহিয়া','নাফিস','সামিয়া','ইমরান','ফারিয়া','আদনান','নাবিলা','সাকিব','জান্নাত'],surnames=['হাসান','ইসলাম','রহমান','আহমেদ','চৌধুরী'];return Array.from({length:100},(_,i)=>({id:uid(),name:names[i%20]+' '+surnames[Math.floor(i/20)],school:DEMO_SCHOOLS[i%3],grade:String(4+Math.floor(i/20)),roll:String(260401+i),present:false,seat:null,demoBatch:2}))}

export function demoRoom(index){return {id:uid(),name:'D'+String(index).padStart(2,'0'),building:'Demo',floor:'নিচতলা',benches:10,per:2,columnBenches:[5,5],directions:'Demo ভবনের নিচতলায় রুম D'+String(index).padStart(2,'0')+'।',demoBatch:2}}

export function seed(){return {demoVersion:2,exam:{name:'SCIENCE QUEST 2026',center:'নমুনা বিদ্যালয়',date:'2026-12-18',time:'10:00',locked:false},rooms:Array.from({length:5},(_,i)=>demoRoom(i+1)),students:demoStudents()}}

export function parseCSV(text){let rows=[],row=[],v='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){v+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(v);v=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(v);if(row.some(x=>x.trim()))rows.push(row);row=[];v=''}else v+=c}if(quoted)throw Error("Incomplete CSV quotation");row.push(v);if(row.some(x=>x.trim()))rows.push(row);return rows}

export function validateBackup(d){validateCategories(d?.exam||{});if(!d||!d.exam||!Array.isArray(d.rooms)||!Array.isArray(d.students))throw Error("Invalid format");for(const k of ['name','center','date','time'])if(typeof d.exam[k]!=='string')throw Error("Invalid exam");const ids=new Set(),rolls=new Set();for(const r of d.rooms){for(const k of ['id','name','building','floor','directions'])if(typeof r[k]!=='string')throw Error("Invalid room");if(ids.has(r.id)||!Number.isInteger(r.benches)||r.benches<1||r.benches>200||!Number.isInteger(r.per)||r.per<1||r.per>4)throw Error("Invalid capacity");if(r.columnBenches!==undefined&&!validCounts(r.columnBenches,r.benches))throw Error("Invalid column layout");ids.add(r.id)}const seats=new Set(),studentIds=new Set();for(const s of d.students){for(const k of ['id','name','school','grade','roll'])if(typeof s[k]!=='string'||!s[k].trim())throw Error("Invalid student");if(rolls.has(normGrade(s.roll))||studentIds.has(s.id))throw Error('Duplicate student');rolls.add(normGrade(s.roll));studentIds.add(s.id);if(s.seat){const r=d.rooms.find(r=>r.id===s.seat.roomId);if(!r||!Number.isInteger(s.seat.bench)||s.seat.bench<1||s.seat.bench>r.benches||!'ABCD'.slice(0,r.per).includes(s.seat.position)||s.seat.position.length!==1)throw Error("Invalid seat");const key=r.id+':'+s.seat.bench+':'+s.seat.position;if(seats.has(key))throw Error('Duplicate seat');seats.add(key);for(const k of ['room','building','floor','directions'])if(typeof s.seat[k]!=='string')throw Error("Invalid seat data")}}d.exam.locked=!!d.exam.locked}

export function validCounts(counts,total){return Array.isArray(counts)&&counts.length>=1&&counts.length<=6&&counts.every(n=>Number.isInteger(n)&&n>=1&&n<=200)&&counts.reduce((a,b)=>a+b,0)===total}

export function mapColumns(r){return validCounts(r.columnBenches,r.benches)?r.columnBenches.length:Number.isInteger(r.mapColumns)&&r.mapColumns>=1&&r.mapColumns<=6?Math.min(r.mapColumns,r.benches):Math.min(3,r.benches)}

export function balancedCounts(total,n){return Array.from({length:n},(_,i)=>Math.floor(total/n)+(i<total%n?1:0))}

export function columnCounts(r){return validCounts(r.columnBenches,r.benches)?r.columnBenches:balancedCounts(r.benches,mapColumns(r))}

export function benchPositions(r){const counts=columnCounts(r),columns=counts.map(()=>[]);let bench=1;for(let col=0;col<counts.length;col++)for(let row=0;row<counts[col];row++)columns[col].push(bench++);return columns}

export function normGrade(g){return String(g).trim().replace(/[০-৯]/g,c=>'০১২৩৪৫৬৭৮৯'.indexOf(c))}

export function roomAffectedStudents(state,r,d){return state.students.filter(s=>s.seat?.roomId===r.id&&(s.seat.bench>d.benches||!'ABCD'.slice(0,d.per).includes(s.seat.position)))}

export function updateRoomModel(state,r,d){const affected=roomAffectedStudents(state,r,d);affected.forEach(s=>s.seat=null);const oldCounts=columnCounts(r);Object.assign(r,d);if(!validCounts(oldCounts,r.benches)){r.mapColumns=Math.min(oldCounts.length,r.benches);r.columnBenches=balancedCounts(r.benches,r.mapColumns)}else r.columnBenches=oldCounts;state.students.filter(s=>s.seat?.roomId===r.id).forEach(s=>Object.assign(s.seat,{room:r.name,building:r.building,floor:r.floor,directions:r.directions}));return affected.length}

export function deleteRoomModel(state,id){state.students.filter(s=>s.seat?.roomId===id).forEach(s=>s.seat=null);state.rooms=state.rooms.filter(r=>r.id!==id);state.exam.locked=false}

export function seatKey(s){return s.roomId+':'+s.bench+':'+s.position}

export function allocationCandidates(state,config){const grades=new Set(config.grades.map(normGrade)),schools=config.schools||[];return state.students.filter(s=>(!s.seat||(config.rebuild&&s.seat.roomId===config.roomId))&&grades.has(normGrade(s.grade))&&(!schools.length||schools.includes(s.school))).sort((a,b)=>a.roll.localeCompare(b.roll,'en',{numeric:true}))}

export function buildAllocationPlan(state,config){
 if(state.exam.locked)throw Error("Seating is locked. Unlock it first.");
 if(!Array.isArray(config.grades)||new Set(config.grades.map(normGrade)).size<2)throw Error("Select at least two classes.");
 const room=state.rooms.find(r=>r.id===config.roomId);if(!room)throw Error("Select a room.");
 const selected=config.studentIds?new Set(config.studentIds):null,candidates=allocationCandidates(state,config).filter(s=>!selected||selected.has(s.id));if(!candidates.length)throw Error("No unassigned students match your selection.");
 if(!config.rebuild&&seatConflicts(state,room.id).length)throw Error("Existing assignments have school or class conflicts. Select Rebuild this room.");
 const {nodes}=seatTopology(room),fixed=new Map();if(!config.rebuild)for(const s of state.students.filter(s=>s.seat?.roomId===room.id)){const node=nodes.find(n=>n.bench===s.seat.bench&&n.position===s.seat.position);if(node)fixed.set(node.index,s)}
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
 const ids=new Set(best.map(a=>a.studentId));const plan={signature:JSON.stringify(state),assignments:best,changed:config.rebuild?state.students.filter(s=>s.seat?.roomId===room.id).length:0,free:freeNodes.length-best.length,remaining:candidates.filter(s=>!ids.has(s.id)).map(s=>s.id),candidateCount:candidates.length,roomId:room.id,rebuild:!!config.rebuild,schoolFallbacks:0,strict:true};assertPlanBenchClasses(state,plan);return plan;
}
export function assertPlanBenchClasses(state,plan){const next=structuredClone(state);if(plan.rebuild)next.students.filter(s=>s.seat?.roomId===plan.roomId).forEach(s=>s.seat=null);for(const a of plan.assignments){const student=next.students.find(s=>s.id===a.studentId);if(!student)throw Error('Student missing');student.seat=a.seat}if(seatConflicts(next,plan.roomId).length)throw Error("School or class conflicts detected. Allocation was not saved.");}

export function applyAllocationPlan(state,plan){if(state.exam.locked)throw Error("Seating is locked.");if(plan.signature!==JSON.stringify(state))throw Error("Data has changed. Preview the allocation again.");assertPlanBenchClasses(state,plan);if(plan.rebuild)state.students.filter(s=>s.seat?.roomId===plan.roomId).forEach(s=>s.seat=null);plan.assignments.forEach(a=>state.students.find(s=>s.id===a.studentId).seat=a.seat);return plan.assignments.length}

export function ensureTokens(state){const tokens=new Set();for(const student of state.students){if(typeof student.qrToken!=='string'||!/^[a-zA-Z0-9_-]{20,100}$/.test(student.qrToken)||tokens.has(student.qrToken))student.qrToken=uid();tokens.add(student.qrToken)}}

export function snapshot(state,s){const r=state.rooms.find(r=>r.id===s.seat?.roomId);return {v:1,roll:s.roll,exam:state.exam,seat:s.seat,layout:r?{benches:r.benches,per:r.per,columns:mapColumns(r),columnBenches:columnCounts(r)}:null}}
export const capacity=state=>state.rooms.reduce((n,r)=>n+r.benches*r.per,0);
export const schoolNames=state=>[...new Set(state.students.map(s=>s.school))].sort((a,b)=>a.localeCompare(b));
export const gradeNames=state=>[...new Set(state.students.map(s=>normGrade(s.grade)))].sort((a,b)=>Number(a)-Number(b)||a.localeCompare(b));
export function loadLocal(){let data;try{data=JSON.parse(localStorage.getItem(KEY));if(data)validateBackup(data)}catch{data=null}data=data||seed();if(data.demoVersion!==2){const incoming=demoStudents(),rolls=new Set(data.students.map(s=>s.roll));incoming.forEach(s=>{let roll=Number(s.roll);while(rolls.has(String(roll)))roll++;s.roll=String(roll);rolls.add(s.roll)});data.students.push(...incoming);let i=1;while(capacity(data)<data.students.length){const r=demoRoom(i++);if(!data.rooms.some(x=>x.name===r.name&&x.building===r.building))data.rooms.push(r)}data.demoVersion=2;data.exam.locked=false;data.demoUpgradeNotice=true}ensureTokens(data);return data}
export function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export function filteredStudents(state,{search='',roll='',school='',grade='',status=''}={}){return state.students.filter(s=>(!roll||normGrade(s.roll)===normGrade(roll))&&(!school||s.school===school)&&(!grade||normGrade(s.grade)===grade)&&(!status||(status==='unassigned'?!s.seat:!!s.seat))&&[s.name,s.school,s.roll].some(v=>v.toLowerCase().includes(search.toLowerCase())))}
export const seatUrl=(s,origin=location.origin)=>origin+'/#lookup='+s.qrToken;

export function automaticRoll(state,grade){const prefix=String(new Date().getFullYear()).slice(-2)+normGrade(grade).padStart(2,'0');const rolls=new Set(state.students.map(s=>normGrade(s.roll)));let n=1;while(rolls.has(prefix+String(n).padStart(4,'0')))n++;return prefix+String(n).padStart(4,'0');}
