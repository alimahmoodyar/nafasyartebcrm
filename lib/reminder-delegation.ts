import {storage} from './storage';
import {AccessError} from './authorization';
import {allPermissions,validatePermissions,type Session} from './permissions';
import {inboxDirectory,inboxIdentity,prepareInboxCreate,inboxCreateGuards} from './inbox';
import {reminderNavigation} from './reminder-contract';
import {env} from 'cloudflare:workers';
export async function reminderRecipients(u:Session){
 if(u.permissions.hospitalCenterId)throw new AccessError('این حساب به صندوق ارجاع همکاران دسترسی ندارد.',403);
 const dir=await inboxDirectory(u),rows=(await storage().prepare("SELECT id,permissions FROM app_members WHERE status='active'").all()).results as any[];
 return dir.people.filter(p=>p.id!==dir.me&&(p.id==='@owner'||rows.some(m=>m.id===p.id&&!JSON.parse(m.permissions).hospitalCenterId)));
}
/** Read-only principal for applying the recipient's existing record visibility. Never grants new rights. */
export async function reminderRecipient(u:Session,id:string){
 if(!(await reminderRecipients(u)).some(p=>p.id===id))throw new AccessError('مسئول فعال و مجاز دیگری انتخاب کنید.',403);
 if(id==='@owner'){const row:any=await storage().prepare("SELECT subject FROM app_identity WHERE id='owner'").first();if(!row||!env.TRACE_OWNER_EMAIL)throw new AccessError('مدیر سامانه در دسترس نیست.',403);return {userId:row.subject,email:env.TRACE_OWNER_EMAIL,name:'مدیر سامانه',isAdmin:true,permissions:allPermissions} as Session;}
 const row:any=await storage().prepare("SELECT m.*,EXISTS(SELECT 1 FROM password_accounts p WHERE p.member_id=m.id) AS password_login FROM app_members m WHERE m.id=? AND m.status='active'").bind(id).first();if(!row)throw new AccessError('مسئول غیرفعال شده است.',403);
 return {userId:row.password_login||!row.subject?'local:'+row.id:row.subject,email:row.email,name:row.name,isAdmin:false,permissions:validatePermissions(JSON.parse(row.permissions))} as Session;
}
export async function prepareReminderDispatch(u:Session,r:any,d:any,op:string,now:Date){
 const db=storage(),at=now.toISOString(),deadline=new Date(now.getTime()+d.delegation.hours*3600000+210*60000).toISOString().slice(0,16)+':00+03:30';
 const prepared=await prepareInboxCreate(u,{recipientType:'person',recipientId:d.delegation.recipientId,kind:d.delegation.kind,priority:'normal',title:d.title,body:d.notes,due:deadline,link:d.linkType==='none'?null:{section:reminderNavigation[d.linkType],id:d.linkId,reminderKind:d.linkType}},now);
 const threadId='reminder-task:'+r.id;
 const body=(d.trigger==='event'?'رویداد تعیین‌شده در سامانه ثبت شد.':'زمان تعیین‌شده برای ارجاع فرا رسید.')+'\n\n'+prepared.body;
 const writes=[...inboxCreateGuards(db,op,'person',prepared.recipient.id),db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'inbox_thread',?,1,?,?)").bind(threadId,JSON.stringify(prepared.data),at,at),db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'inbox_message',?,1,?,?)").bind('inbox-msg:'+op,JSON.stringify({thread:threadId,body,mode:'create',author:prepared.me,authorName:u.name,viaAssistant:false}),at,at),db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'inbox_state',?,1,?,?)").bind('inbox-state:'+threadId+':'+prepared.me,JSON.stringify({readRevision:1,snoozeUntil:''}),at,at),db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(op,u.userId,threadId,'reminder_dispatch',JSON.stringify({reminderId:r.id,recipientId:prepared.recipient.id}),at)];
 d.delegation={...d.delegation,threadId,dispatchedAt:at,blockedReason:'',lastState:'open'};return writes;
}
export async function reminderThread(u:Session,d:any){
 if(!d.delegation?.threadId)return null;const row:any=await storage().prepare("SELECT id,data,revision FROM flow_entities WHERE id=? AND type='inbox_thread'").bind(d.delegation.threadId).first();if(!row)return null;const data=JSON.parse(row.data);if(data.sender!==await inboxIdentity(u)||data.recipientId!==d.delegation.recipientId)return null;return {...row,data};
}

// Authorization can depend on record ownership, positions and related process records.
// Snapshot revisions before permission reads; a concurrent change must abort dispatch, not leak a notice.
const sourceSnapshotSql="SELECT json_group_array(json_array(id,revision)) AS snapshot FROM (SELECT id,revision FROM flow_entities ORDER BY id)";
export async function delegationSourceSnapshot(){return (await storage().prepare(sourceSnapshotSql).first<{snapshot:string}>())!.snapshot;}
export function delegationSourceGuard(db:D1Database,op:string,snapshot:string){return db.prepare('UPDATE inventory_operations SET guard=CASE WHEN ('+sourceSnapshotSql+')=? THEN guard ELSE 0 END WHERE id=?').bind(snapshot,op);}
