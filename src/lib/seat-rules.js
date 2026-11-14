import {shiftForStudent} from './categories.js';
export const normalizeGrade=g=>String(g).trim().replace(/[০-৯]/g,c=>'০১২৩৪৫৬৭৮৯'.indexOf(c));
export const sameSchool=(a,b)=>a.schoolId&&b.schoolId?a.schoolId===b.schoolId:String(a.school||'').trim().toLocaleLowerCase()===String(b.school||'').trim().toLocaleLowerCase();
export function countsFor(room){const c=room.columnBenches;if(Array.isArray(c)&&c.length&&c.length<=6&&c.every(n=>Number.isInteger(n)&&n>0)&&c.reduce((a,b)=>a+b,0)===room.benches)return c;const cols=Number.isInteger(room.mapColumns)&&room.mapColumns>=1&&room.mapColumns<=6?Math.min(room.benches,room.mapColumns):Math.min(3,room.benches);return Array.from({length:cols},(_,i)=>Math.floor(room.benches/cols)+(i<room.benches%cols?1:0))}
export function seatTopology(room){const nodes=[],edges=[],columns=[];let bench=1;for(const [col,count] of countsFor(room).entries()){columns[col]=[];for(let row=0;row<count;row++){const seats=[];for(let pos=0;pos<room.per;pos++){const node={index:nodes.length,bench,position:'ABCD'[pos],row,col,pos,neighbors:[]};seats.push(node.index);nodes.push(node)}columns[col].push(seats);bench++}}
 function link(a,b,kind,classRule){const edge={a,b,kind,classRule};edges.push(edge);nodes[a].neighbors.push({index:b,...edge});nodes[b].neighbors.push({index:a,...edge})}
 for(const rows of columns)for(let row=0;row<rows.length;row++){const seats=rows[row];for(let a=0;a<seats.length;a++)for(let b=a+1;b<seats.length;b++)link(seats[a],seats[b],'bench',true);if(row>0)for(let pos=0;pos<room.per;pos++)link(rows[row-1][pos],seats[pos],'front-back',false)}
 for(let col=1;col<columns.length;col++)for(let row=0;row<Math.min(columns[col-1].length,columns[col].length);row++)link(columns[col-1][row][room.per-1],columns[col][row][0],'side-by-side',true);
 return {nodes,edges};}
export function pairConflict(a,b,classRule){return sameSchool(a,b)?'school':classRule&&normalizeGrade(a.grade)===normalizeGrade(b.grade)?'class':null}
// Conflicts are checked WITHIN one shift only: the same bench may be reused
// by another shift later in the day. With no shiftId given, every shift is
// checked separately and the results are combined — so the old single-shift
// behaviour (and its tests) is unchanged.
export function seatConflicts(state,roomId,shiftId){
 const exam=state.exam||{};
 const shiftOf=s=>{try{return shiftForStudent(s,exam)}catch{return 'shift-1'}};
 const shifts=shiftId?[shiftId]:[...new Set(state.students.filter(s=>s.seat).map(shiftOf))];
 if(!shifts.length)return [];
 const result=[];
 for(const shift of shifts){
  for(const room of state.rooms.filter(r=>!roomId||r.id===roomId)){
   const {nodes,edges}=seatTopology(room),placed=new Map();
   for(const s of state.students.filter(s=>s.seat?.roomId===room.id&&shiftOf(s)===shift)){
    const n=nodes.find(n=>n.bench===s.seat.bench&&n.position===s.seat.position);
    if(n){if(placed.has(n.index))result.push({roomId:room.id,a:s.id,b:placed.get(n.index).id,kind:'duplicate',rule:'seat',bench:s.seat.bench,shift});placed.set(n.index,s)}
   }
   for(const edge of edges){const a=placed.get(edge.a),b=placed.get(edge.b);if(a&&b){const rule=pairConflict(a,b,edge.classRule);if(rule)result.push({roomId:room.id,a:a.id,b:b.id,kind:edge.kind,rule,bench:nodes[edge.a].bench,otherBench:nodes[edge.b].bench,shift})}}
  }
 }
 return result;
}
export function assertChangedSeatRules(next,old){const key=(c,state)=>{const r=state.rooms.find(r=>r.id===c.roomId),a=state.students.find(s=>s.id===c.a),b=state.students.find(s=>s.id===c.b);return JSON.stringify([c.roomId,c.a,c.b,c.kind,c.rule,c.shift||null,countsFor(r),r.per,a?.seat?[a.seat.roomId,a.seat.bench,a.seat.position]:null,b?.seat?[b.seat.roomId,b.seat.bench,b.seat.position]:null,a?.grade,b?.grade,a?.school,b?.school,a?.schoolId,b?.schoolId])};const prior=new Set(seatConflicts(old||{rooms:[],students:[]}).map(c=>key(c,old)));if(seatConflicts(next).some(c=>!prior.has(key(c,next))))throw Error('Strict seat rule conflict: same school next to/front-back, or same class on bench/side-by-side. Rebuild the affected room.');}
