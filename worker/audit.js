// History is appended inside the same conditional state write as the change.
const LIMIT=3000;
const fields={students:['name','fatherName','grade','schoolId','school','roll','photoId','guardianName','guardianPhone','seat','present'],rooms:['name','building','floor','directions','benches','per','columnBenches'],schools:['name','contactName','phone','email','address','active','notice','noticeUrgent'],schoolSubmissions:['name','fatherName','grade','photoId','status','note','duplicateReview'],schoolEditRequests:['status','note']};
const same=(a,b)=>(a??null)===(b??null)||JSON.stringify(a??null)===JSON.stringify(b??null);
export function appendAudit(next,previous,actor={type:'admin',label:'Admin (shared account)'}){
 const entries=[],at=new Date().toISOString();
 const add=(entity,id,label,action,changes)=>entries.push({id:crypto.randomUUID(),at,actor,entity,entityId:id,label,action,changes});
 for(const [entity,keys] of Object.entries(fields)){
  const before=new Map((previous?.[entity]||[]).map(s=>[s.id,s])),after=new Map((next[entity]||[]).map(s=>[s.id,s]));
  for(const [id,row] of after){const old=before.get(id),label=row.name||row.original?.name||row.roll||id;
   if(!old){add(entity,id,label,'created',{});continue}
   const changes={};for(const k of keys)if(!same(old[k],row[k]))changes[k]={from:old[k]??null,to:row[k]??null};
   if(Object.keys(changes).length)add(entity,id,label,'updated',changes);
  }
  for(const [id,row] of before)if(!after.has(id))add(entity,id,row.name||row.original?.name||id,'removed',{});
 }
 const changes={};for(const k of ['name','center','date','time','duration','committee','signatory','instructions','calculatorAllowed','signaturePhotoId','categories','locked','registrationClosed','registrationDeadline'])if(!same(previous?.exam?.[k],next.exam?.[k]))changes[k]={from:previous?.exam?.[k]??null,to:next.exam?.[k]??null};
 if(Object.keys(changes).length)add('exam','exam','Exam settings',previous?'updated':'created',changes);
 const history=[...(previous?.auditLog||[]),...entries];
 next.auditLog=history.slice(-LIMIT);next.auditDropped=(previous?.auditDropped||0)+Math.max(0,history.length-LIMIT);
 return entries;
}
