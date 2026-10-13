import assert from 'node:assert/strict';
import {api} from '../worker/api.js';
import {seed,ensureTokens,filteredStudents} from '../src/lib/domain.js';
import {categories,allowedGrades,validateCategories,categoryFor} from '../src/lib/categories.js';
import {studentErrors} from '../src/lib/form-validation.js';
import QRCode from '../src/lib/qr.js';
import jsQR from 'jsqr';
import {build} from 'esbuild';
await build({entryPoints:['src/components/QRScanner.jsx'],outfile:'tests/.compiled/QRScanner.js',bundle:true,packages:'external',platform:'node',format:'esm',jsx:'automatic'});
const {qrTokenFrom}=await import('./.compiled/QRScanner.js');
const objects=new Map();let n=0,conflict=false;
const BUCKET={async get(k){const o=objects.get(k);return o?{etag:o.etag,json:async()=>JSON.parse(o.value)}:null},async head(k){return objects.has(k)?{etag:objects.get(k).etag}:null},async put(k,value,options={}){const old=objects.get(k);if(conflict&&k==='scholarship/state.json'||options.onlyIf?.etagMatches&&old?.etag!==options.onlyIf.etagMatches||options.onlyIf?.etagDoesNotMatch==='*'&&old)return null;const etag=String(++n);objects.set(k,{value,etag});return {etag}},async delete(k){objects.delete(k)}};
const env={BUCKET,ADMIN_EMAIL:'owner@example.org'},owner={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.org'};
const data=seed();ensureTokens(data);await BUCKET.put('scholarship/state.json',JSON.stringify(data));
async function req(path,method='GET',payload,headers=owner){const response=await api(new Request('https://example.org'+path,{method,headers:{Origin:'https://example.org','Content-Type':'application/json',...headers},body:payload?JSON.stringify(payload):undefined}),env);return {status:response.status,response,data:await response.json()}}
async function state(){return (await req('/api/state')).data}
async function update(fn){const s=await state();fn(s.state);const result=await req('/api/state','PUT',s);assert.equal(result.status,200,JSON.stringify(result.data))}
assert.deepEqual(allowedGrades(),['4','5','6','7','8']);assert.throws(()=>validateCategories({categories:[{id:'a',name:'A',from:4,to:6},{id:'b',name:'B',from:6,to:8}]}));
const config=[{id:'lower',name:'PRIMARY',from:3,to:5},{id:'upper',name:'SECONDARY',from:9,to:10}];
await update(s=>s.exam.categories=config);
assert.deepEqual(allowedGrades({categories:config}),['3','4','5','9','10']);assert.equal(categoryFor('9',{categories:config}),'SECONDARY');assert(studentErrors({name:'Student',grade:'6'},{exam:{categories:config}}).grade);
const school=(await req('/api/schools','POST',{name:'Feature School',contactName:'Teacher',phone:'01711111111',username:'feature.school',password:'test-password'})).data.school;
const other=(await req('/api/schools','POST',{name:'Other School',contactName:'Teacher',phone:'01811111111',username:'other.school',password:'test-password'})).data.school;
const login=await req('/api/school/'+school.id+'/login','POST',{username:school.username,password:'test-password'},{}),schoolAuth={Cookie:login.response.headers.get('Set-Cookie').split(';')[0]};
const otherLogin=await req('/api/school/'+other.id+'/login','POST',{username:other.username,password:'test-password'},{}),otherAuth={Cookie:otherLogin.response.headers.get('Set-Cookie').split(';')[0]};
assert.equal((await req('/api/school/'+school.id+'/students','POST',{name:'New Student',grade:'6'},schoolAuth)).status,400);
const missingFather=await req('/api/school/'+school.id+'/students','POST',{name:'Valid Student',grade:'9'},schoolAuth);assert.equal(missingFather.status,400);assert(missingFather.data.fieldErrors.fatherName);
const submitted=await req('/api/school/'+school.id+'/students','POST',{name:'New Student',grade:'9',fatherName:'Student Father'},schoolAuth);assert.equal(submitted.status,201);
assert.equal((await req('/api/school-submissions/'+submitted.data.submission.id+'/review','POST',{action:'approved'})).status,200);
let portal=(await req('/api/school/'+school.id+'/portal','GET',null,schoolAuth)).data;assert.deepEqual(portal.exam.categories,config);const studentId=portal.submissions[0].studentId;assert(studentId);
const original=(await state()).state.students.find(s=>s.id===studentId);
const proposed={name:'Correct Student',grade:'10',fatherName:'Correct Father',guardianName:'Guardian',guardianPhone:'01722222222',photoId:'',studentId,reason:'Name spelling and class correction'};
assert.equal((await req('/api/school/'+other.id+'/edit-requests','POST',proposed,otherAuth)).status,404);
assert.equal((await req('/api/school/'+school.id+'/edit-requests','POST',{...proposed,reason:''},schoolAuth)).status,400);
let request=(await req('/api/school/'+school.id+'/edit-requests','POST',proposed,schoolAuth));assert.equal(request.status,201);const q=request.data.request;
assert.equal((await req('/api/school/'+school.id+'/edit-requests','POST',proposed,schoolAuth)).status,409);
assert.equal((await state()).state.students.find(s=>s.id===studentId).name,original.name);
assert.equal((await req('/api/school-edit-requests/'+q.id+'/review','POST',{action:'approved'},schoolAuth)).status,403);
assert.equal((await req('/api/school-edit-requests/'+q.id+'/review','POST',{action:'approved'})).status,200);
let changed=(await state()).state.students.find(s=>s.id===studentId);assert.equal(changed.name,proposed.name);assert.equal(changed.grade,'10');assert.equal(changed.roll,original.roll);assert.equal(changed.qrToken,original.qrToken);
portal=(await req('/api/school/'+school.id+'/portal','GET',null,schoolAuth)).data;assert.equal(portal.submissions[0].grade,'10');assert.equal(portal.editRequests[0].status,'approved');assert.equal((await req('/api/school/'+other.id+'/portal','GET',null,otherAuth)).data.editRequests.length,0);
await update(s=>{s.schoolEditRequests=[]});assert.equal((await state()).state.schoolEditRequests.length,1,'state sync erased request history');
request=await req('/api/school/'+school.id+'/edit-requests','POST',{...proposed,name:'Later Student'},schoolAuth);assert.equal(request.status,201);
assert.equal((await req('/api/school-admin/students/'+studentId,'PATCH',{...changed,name:'Admin Correction'})).status,200);
assert.equal((await req('/api/school-edit-requests/'+request.data.request.id+'/review','POST',{action:'approved'})).status,409,'stale edit overwrote admin correction');
assert.equal((await req('/api/school-edit-requests/'+request.data.request.id+'/review','POST',{action:'rejected',note:'Resubmit latest information'})).status,200);
assert.equal((await req('/api/schools/'+school.id,'PATCH',{notice:'Bring the original documents.\nDeadline tomorrow.',noticeUrgent:true})).status,200);
assert((await req('/api/school/'+school.id+'/portal','GET',null,schoolAuth)).data.school.notice.includes('documents'));assert(!(await req('/api/school/'+other.id+'/portal','GET',null,otherAuth)).data.school.notice);
await update(s=>s.exam.name='Updated Exam');assert((await state()).state.schools.find(s=>s.id===school.id).notice);
assert.equal((await req('/api/schools/'+school.id,'PATCH',{notice:'',noticeUrgent:false})).status,200);assert.equal((await req('/api/school/'+school.id+'/portal','GET',null,schoolAuth)).data.school.notice,'');
// Strict seat rules also guard approved corrections.
await update(s=>{s.exam.categories=[{id:'all',name:'ALL',from:3,to:10}];const a=s.students.find(x=>x.id===studentId),b=s.students.find(x=>x.school===s.students.find(x=>x.id===studentId).school?false:x.grade==='4');a.grade='9';b.schoolId=other.id;b.school=other.name;const room=s.rooms[0];for(const [student,position] of [[a,'A'],[b,'B']])student.seat={roomId:room.id,room:room.name,building:room.building,floor:room.floor,directions:room.directions,bench:1,position}});
changed=(await state()).state.students.find(s=>s.id===studentId);assert.equal((await req('/api/school-admin/students/'+studentId,'PATCH',{...changed,grade:'4'})).status,409);
request=await req('/api/school/'+school.id+'/edit-requests','POST',{...proposed,grade:'4'},schoolAuth);assert.equal(request.status,201);assert.equal((await req('/api/school-edit-requests/'+request.data.request.id+'/review','POST',{action:'approved'})).status,409);
assert.equal((await state()).state.students.find(s=>s.id===studentId).grade,'9');
// Decode the exact admit QR with the bundled fallback; ensure old hash and new URL compatibility.
for(const token of [original.qrToken,'1234567890abcdefghijklmnopqrstuv']){const url='https://example.org/#lookup='+token,qr=new QRCode(-1,0);qr.addData(url);qr.make();const scale=6,width=(qr.getModuleCount()+8)*scale,pixels=new Uint8ClampedArray(width*width*4);for(let y=0;y<width;y++)for(let x=0;x<width;x++){const mx=Math.floor(x/scale)-4,my=Math.floor(y/scale)-4,dark=mx>=0&&my>=0&&mx<qr.getModuleCount()&&my<qr.getModuleCount()&&qr.isDark(my,mx),i=(y*width+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=dark?0:255;pixels[i+3]=255}const decoded=jsQR(pixels,width,width);assert.equal(decoded.data,url);assert.equal(qrTokenFrom(decoded.data,'https://example.org'),token);assert.equal(qrTokenFrom('https://example.org/seat/'+token,'https://example.org'),token);assert.equal(qrTokenFrom('https://evil.example/seat/'+token,'https://example.org'),null)}
assert.equal(filteredStudents(data,{roll:'২৬০৪০১'}).length,1);assert.equal(filteredStudents(data,{roll:'26040'}).length,0);
console.log('PASS: dynamic categories across forms/API/portal, scoped notices, edit requests approval/rejection/stale guard, immutable roll/QR, strict seat correction rules, exact roll filtering and real QR decoder');
// Exercise scanner lifecycle with a simulated camera delivering actual QR pixels.
const {JSDOM}=await import('jsdom');const dom=new JSDOM('<div id="root"></div>',{url:'https://example.org/seat-lookup'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.location=dom.window.location;Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.HTMLElement=dom.window.HTMLElement;globalThis.getComputedStyle=dom.window.getComputedStyle.bind(dom.window);globalThis.IS_REACT_ACT_ENVIRONMENT=true;window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});globalThis.requestAnimationFrame=fn=>setTimeout(()=>fn(1000),1);globalThis.cancelAnimationFrame=clearTimeout;globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};window.ResizeObserver=globalThis.ResizeObserver;
const qr=new QRCode(-1,0);qr.addData('https://example.org/#lookup='+original.qrToken);qr.make();const w=(qr.getModuleCount()+8)*6,pixels=new Uint8ClampedArray(w*w*4);for(let y=0;y<w;y++)for(let x=0;x<w;x++){const mx=Math.floor(x/6)-4,my=Math.floor(y/6)-4,dark=mx>=0&&my>=0&&mx<qr.getModuleCount()&&my<qr.getModuleCount()&&qr.isDark(my,mx),i=(y*w+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=dark?0:255;pixels[i+3]=255}
window.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},getImageData(){return {data:pixels,width:w,height:w}}});window.HTMLVideoElement.prototype.play=async function(){Object.defineProperty(this,'readyState',{value:2,configurable:true});Object.defineProperty(this,'videoWidth',{value:w,configurable:true});Object.defineProperty(this,'videoHeight',{value:w,configurable:true})};let stopped=0,scanned=null;Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>({getTracks:()=>[{stop(){stopped++}}]})},configurable:true});
const {default:React,act}=await import('react'),{createRoot}=await import('react-dom/client'),{MantineProvider}=await import('@mantine/core'),{default:Scanner}=await import('./.compiled/QRScanner.js');let root=createRoot(document.getElementById('root'));const pause=()=>new Promise(r=>setTimeout(r,40));await act(async()=>{root.render(React.createElement(MantineProvider,null,React.createElement(Scanner,{onScan:token=>scanned=token,onClose(){}})));await pause()});await act(async()=>await pause());assert.equal(scanned,original.qrToken);assert(stopped>0,'camera not stopped after scan');await act(async()=>root.unmount());
Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>{throw Object.assign(Error('Denied'),{name:'NotAllowedError'})}},configurable:true});root=createRoot(document.getElementById('root'));await act(async()=>{root.render(React.createElement(MantineProvider,null,React.createElement(Scanner,{onScan(){},onClose(){}})));await pause()});assert(document.body.textContent.includes('Allow camera access'));await act(async()=>root.unmount());dom.window.close();console.log('PASS: camera frame decoding, track shutdown after scan/unmount, camera permission error');
