import {reminderRecipient,prepareReminderDispatch,reminderThread,delegationSourceSnapshot,delegationSourceGuard} from './reminder-delegation';
import {storage} from './storage';
import {session,resolveIdentity,AccessError} from './authorization';
import {localPrincipal} from './password-auth';
import {validatePermissions,type Session} from './permissions';
import {trainingContext} from './training-context';
import {reminderSources} from './reminder-sources';
export {reminderSources};
export const reminderFail=(message:string,status=400):never=>{throw new AccessError(message,status)};
export async function reminderActor(){
 if(trainingContext.getStore())reminderFail('یادآورها در محیط اطلاعات شرکت فعال‌اند.',403);
 const u=await session();if(u.isAdmin)return u;
 const m:any=await storage().prepare("SELECT * FROM app_members WHERE (id=? OR subject=?) AND status='active'").bind(u.userId.replace(/^local:/,''),u.userId).first();
 if(!m)reminderFail('حساب فعال نیست.',403);return {...u,permissions:validatePermissions(JSON.parse(m.permissions))};
}
export const reminderDecode=(r:any)=>({...r,data:JSON.parse(r.data)});
export async function reminderTarget(u:Session,d:any,cache=new Map<string,Promise<any[]>>()){
 const key=u.userId+':'+d.linkType+(['development','inbox','tasks'].includes(d.linkType)?':'+d.linkId:'');if(!cache.has(key))cache.set(key,reminderSources(u,d.linkType,d.linkId));return (await cache.get(key)!).find(r=>r.id===d.linkId&&(!d.entityType||r.type===d.entityType))||null;
}
export async function reminderPublic(r:any,u:Session,targets:Map<string,any>,sources=new Map<string,Promise<any[]>>()){const d=r.data,key=d.linkType+':'+d.linkId;let target=null;
 if(d.linkType!=='none'){if(!targets.has(key))targets.set(key,await reminderTarget(u,d,sources));target=targets.get(key);}
 const thread=d.delegation?.threadId?await reminderThread(u,d):null;
 return {id:r.id,revision:r.revision,created:r.created,updated:r.updated,data:{delegation:d.delegation?{...d.delegation,state:thread?.data.state||d.delegation.lastState}:null,title:d.title,notes:d.notes,dueAt:d.dueAt,state:d.state,trigger:d.trigger,eventField:d.eventField,eventCondition:d.eventCondition,eventValue:d.eventValue,eventValueLabel:target?.fields[d.eventField]?.options[d.eventValue]||d.eventValue,linkType:d.linkType,linkId:d.linkId,linkLabel:target?.title||'',linkAvailable:d.linkType==='none'||!!target,eventAt:target?d.eventAt:null,alerts:(d.alerts||[]).filter((a:any)=>a.kind!=='event'||!!target),completedAt:d.completedAt}};
}
export async function reminderMembers(){return (await storage().prepare('SELECT id,status,subject,permissions FROM app_members ORDER BY id').all()).results;}
export function reminderGuard(db:D1Database,op:string,members:any[]){return db.prepare("UPDATE inventory_operations SET guard=CASE WHEN (SELECT json_group_array(json_object('id',id,'status',status,'subject',subject,'permissions',permissions)) FROM (SELECT * FROM app_members ORDER BY id))=? THEN guard ELSE 0 END WHERE id=?").bind(JSON.stringify(members),op);}
/** Event facts are captured atomically by the database trigger. Delivery rechecks live access. */
export async function syncReminders(owner?:Session,now=new Date()){
 if(trainingContext.getStore())return 0;
 const db=storage(),rows=(await db.prepare("SELECT * FROM personal_reminders WHERE json_extract(data,'$.state')='active'"+(owner?' AND owner=?':'')).bind(...(owner?[owner.userId]:[])).all()).results.map(reminderDecode),actors=new Map<string,Session|null>(),sources=new Map<string,Promise<any[]>>();
 if(owner)actors.set(owner.userId,owner);let changed=0;
 for(const r of rows){let u=actors.get(r.owner);if(!actors.has(r.owner)){try{u=r.owner.startsWith('local:')?await localPrincipal(r.owner.slice(6)):await resolveIdentity({userId:r.owner,email:r.data.ownerEmail,displayName:r.owner,fullName:null});}catch{u=null}actors.set(r.owner,u||null)}if(!u)continue;
 const members=await reminderMembers(),sourceSnapshot=r.data.delegation&&!r.data.delegation.threadId?await delegationSourceSnapshot():null,d=structuredClone(r.data),alerts=d.alerts||[],op=crypto.randomUUID();let touched=false;const extra:D1PreparedStatement[]=[];
 if(d.trigger==='event'&&d.eventPending&&!d.eventAt&&await reminderTarget(u,d,sources)){d.eventAt=d.eventPending.at;for(const a of alerts)if(a.kind==='followup')a.readAt=a.readAt||now.toISOString();alerts.push({key:'event',kind:'event',at:d.eventAt,readAt:null});touched=true;}
 if(!d.delegation?.threadId&&d.dueAt&&d.dueAt<=now.toISOString()&&!alerts.some((a:any)=>a.key==='due:'+d.dueAt)&&!d.eventAt){alerts.push({key:'due:'+d.dueAt,kind:d.trigger==='event'?'followup':'due',at:now.toISOString(),readAt:null});touched=true;}
 if(d.delegation){
 if(d.delegation.threadId){const thread=await reminderThread(u,d);if(thread&&thread.data.state!==d.delegation.lastState){d.delegation.lastState=thread.data.state;for(const a of alerts)if(a.kind==='result')a.readAt=a.readAt||now.toISOString();if(['blocked','submitted','completed','closed','cancelled'].includes(thread.data.state))alerts.push({key:'result:'+thread.revision,kind:'result',state:thread.data.state,at:now.toISOString(),readAt:null});if(['completed','closed','cancelled'].includes(thread.data.state)){d.state=thread.data.state==='cancelled'?'cancelled':'done';d.completedAt=now.toISOString();}extra.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN guard ELSE 0 END WHERE id=?').bind(thread.id,thread.revision,op));touched=true;}}
 else if(d.trigger==='event'?!!d.eventAt:!!d.dueAt&&d.dueAt<=now.toISOString()){
 try{const recipient=await reminderRecipient(u,d.delegation.recipientId);if(d.linkType!=='none'&&(!await reminderTarget(u,d,sources)||!await reminderTarget(recipient,d,sources)))throw new AccessError('دسترسی یکی از طرفین به پرونده مرتبط تغییر کرده است.',403);extra.push(delegationSourceGuard(db,op,sourceSnapshot!),...await prepareReminderDispatch(u,r,d,op,now));for(const a of alerts)if(a.kind==='delegation_blocked')a.readAt=a.readAt||now.toISOString();touched=true;
 }catch(e){if(!(e instanceof AccessError))throw e;const reason=e.message;if(d.delegation.blockedReason!==reason){d.delegation.blockedReason=reason;alerts.push({key:'delegation_blocked:'+now.toISOString(),kind:'delegation_blocked',at:now.toISOString(),readAt:null});touched=true;}}
 }
 }
 if(!touched)continue;d.alerts=alerts.slice(-50);
 const checks=[db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'personal_reminder_tick','{}','scheduler',?,1)").bind(op,now.toISOString()),reminderGuard(db,op,members),db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM personal_reminders WHERE id=? AND owner=? AND revision=?) THEN guard ELSE 0 END WHERE id=?').bind(r.id,r.owner,r.revision,op),...extra,db.prepare('UPDATE personal_reminders SET data=?,revision=revision+1,updated=? WHERE id=? AND owner=? AND revision=?').bind(JSON.stringify(d),now.toISOString(),r.id,r.owner,r.revision)];
 await db.batch(checks);changed++;
 }return changed;
}
