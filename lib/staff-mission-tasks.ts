import {storage} from './storage';
import {notice,dayAt} from './duties';
import {storedAccessPermissions,type Session} from './permissions';
import {missionRow,missionRights,missionRead,internalMissionMember,missionStates} from './staff-missions';
import {trainingContext} from './training-context';

const sweepId='staff-mission-task-sweep',pageSize=50;
function sourceReferences(r:any,source:any){const refs=[{id:r.data.source.id,revision:source?.revision||0}];if(source?.type==='hospital_job')for(const id of [source.data.centerId,source.data.assetId])refs.push({id,revision:source.missionRelated.find((x:any)=>x.id===id)?.revision||0});return refs;}
function referenceGuard(db:D1Database,op:string,refs:{id:string;revision:number}[]){return db.prepare('UPDATE inventory_operations SET guard=CASE WHEN '+refs.map(()=> 'COALESCE((SELECT revision FROM flow_entities WHERE id=?),0)=?').join(' AND ')+' THEN guard ELSE 0 END WHERE id=?').bind(...refs.flatMap(r=>[r.id,r.revision]),op);}

// Keyset pages revisit every mission, including old failed follow-ups. The cursor
// advances only after the whole page; replaying an interrupted page is idempotent.
export async function syncStaffMissionTasks(missionId?:string){
 if(trainingContext.getStore())return;const db=storage(),cursor=missionId?null:await missionRow(sweepId,'workflow_health'),lastId=typeof cursor?.data.lastId==='string'?cursor.data.lastId:'';
 const selected=missionId?[await missionRow(missionId)].filter(Boolean):(await db.prepare("SELECT * FROM flow_entities WHERE type='staff_mission' AND id>? ORDER BY id LIMIT 51").bind(lastId).all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)}));
 const rows=selected.slice(0,pageSize),hasMore=!missionId&&selected.length>pageSize;
 // Inactive target snapshots also protect retirement. The full member-directory
 // read is existing scale debt; growing mission history is always page-bounded.
 const allMembers=(await db.prepare('SELECT id,name,status,subject,permissions FROM app_members ORDER BY id').all()).results as any[],members=allMembers.filter(internalMissionMember);
 for(const r of rows){
  const source=await missionRow(r.data.source.id,r.data.source.type),refs=sourceReferences(r,source),sourceRevision=source?.revision||0,state=r.data.state,wanted=[] as string[];
  for(const m of members){const u={userId:m.subject||'local:'+m.id,name:m.name,isAdmin:false,permissions:storedAccessPermissions(m.permissions)} as Session,a={id:m.id,member:m,u,admin:false},rights=missionRights(a,r,source);if(state==='draft'&&rights.plan||['review','return_review'].includes(state)&&rights.approve&&!r.data.memberIds.includes(m.id)||state==='return_completion'&&u.userId===r.data.finishedBy||['approved','travelling'].includes(state)&&rights.own)wanted.push(m.id);}
  const existing=(await db.prepare("SELECT * FROM duty_runs WHERE template_id='staff-mission' AND period=?").bind(r.id).all()).results as any[],now=new Date().toISOString();
  for(const mid of new Set([...wanted,...existing.map(t=>t.assignee)])){
   const id='staff-mission:'+r.id+':'+mid,old=existing.find(t=>t.id===id),active=wanted.includes(mid),next=active?'open':'completed';if(!active&&!old)continue;
   const previous=old?JSON.parse(old.data):null,title=missionStates[state]+' · '+r.data.source.customer,due=(['return_review','return_completion'].includes(state)?dayAt(new Date((state==='return_completion'?r.data.returnReviews?.at(-1)?.at:r.data.returnCompletions?.at(-1)?.at)||r.data.finishedAt)):r.data.startDay||dayAt(new Date(r.created)))+'T16:00:00+03:30';
   if(old&&old.state===next&&previous.stage===state&&previous.missionRevision===r.revision&&previous.sourceRevision===sourceRevision&&JSON.stringify(previous.sourceReferences)===JSON.stringify(refs)&&old.due===due&&previous.title===title)continue;
   const data={staffMissionWorkflow:true,recordId:r.id,sourceSection:'personnel',sourceId:'mission:'+r.id,stage:state,missionRevision:r.revision,sourceRevision,sourceReferences:refs,title,instructions:'برنامه و نتیجه مأموریت را در فرم مأموریت ثبت کنید.',evidence:'text',remindHours:24,escalateHours:48,history:previous?.history||[]},op=crypto.randomUUID(),m=allMembers.find(m=>m.id===mid);
   const memberGuard=m?db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM app_members WHERE id=? AND status=? AND permissions=? AND name=? AND subject IS ?) THEN guard ELSE 0 END WHERE id=?').bind(m.id,m.status,m.permissions,m.name,m.subject,op):db.prepare('UPDATE inventory_operations SET guard=CASE WHEN NOT EXISTS(SELECT 1 FROM app_members WHERE id=?) THEN guard ELSE 0 END WHERE id=?').bind(mid,op);
   await db.batch([
    db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'staff_mission_task','{}','scheduler',?,CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) AND COALESCE((SELECT revision FROM duty_runs WHERE id=?),0)=? THEN 1 ELSE 0 END)").bind(op,now,r.id,r.revision,id,old?.revision||0),referenceGuard(db,op,refs),memberGuard,
    old?db.prepare('UPDATE duty_runs SET state=?,data=?,due=?,revision=revision+1,updated=? WHERE id=?').bind(next,JSON.stringify(data),due,now,id):db.prepare("INSERT INTO duty_runs(id,template_id,period,assignee,supervisor,due,state,data,revision,created,updated) VALUES(?,'staff-mission',?,?,'@admin',?,?,?,1,?,?)").bind(id,r.id,mid,due,next,JSON.stringify(data),now,now),
    ...(active?[notice(id,mid,'mission:'+r.revision+':'+refs.map(x=>x.revision).join('-')+':'+state,data.title,now)]:[])
   ]);
  }
 }
 if(!missionId){
  const nextId=hasMore?rows[rows.length-1].id:'',now=new Date().toISOString(),op=crypto.randomUUID(),data={...(cursor?.data||{}),module:'staff-mission',lastId:nextId,processedAt:now,pageSize};
  await db.batch([
   db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'staff_mission_task_cursor',?,'scheduler',?,CASE WHEN COALESCE((SELECT revision FROM flow_entities WHERE id=? AND type='workflow_health'),0)=? THEN 1 ELSE 0 END)").bind(op,JSON.stringify({from:lastId,to:nextId,processed:rows.length}),now,sweepId,cursor?.revision||0),
   cursor?db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=?').bind(JSON.stringify(data),now,sweepId):db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'workflow_health',?,1,?,?)").bind(sweepId,JSON.stringify(data),now,now)
  ]);
 }
 return {processed:rows.length,hasMore};
}

export async function staffMissionProfileWork(user:Session){
 const p=user.permissions;if(trainingContext.getStore()||p.salesAgentId||p.serviceAgentId||p.hospitalCenterId||p.salesRoles?.includes('agent')||p.serviceRoles?.includes('agent'))return {work:[],hasMore:false};
 const view=await missionRead(user,new URLSearchParams({pageSize:'50',queue:'actionable'}));
 return {work:view.records.map(r=>({id:'staff-mission:'+r.id,title:missionStates[r.data.state]+' · '+r.data.source.customer,section:'personnel',target:'mission:'+r.id,sourceId:r.id,state:r.data.state})),hasMore:view.hasMore};
}
