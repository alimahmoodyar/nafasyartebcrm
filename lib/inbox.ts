import {storedAccessPermissions} from './permissions';
import {salesScope,salesStaff,salesFinance} from './sales';
import {storage} from './storage';
import {AccessError,can} from './authorization';
import {memberId,taskAccess} from './duties';
import type {Session} from './permissions';
import {roleProfiles} from './role-profiles';
import {AsyncLocalStorage} from 'node:async_hooks';
export const inboxAssistantExecution=new AsyncLocalStorage<boolean>();
export const inboxDecode=(r:any)=>r?({...r,data:JSON.parse(r.data)}):null;
export async function inboxIdentity(u:Session){const id=await memberId(u);if(id)return id;if(u.isAdmin||u.profileReview)return '@owner';throw new AccessError('حساب فعال برای مکاتبه یافت نشد.',403);}
// Operational notices still use the authenticated account. Interactive previews use a separate mailbox.
const profileAddress=(id:string)=>'@profile:'+id;
const representativeInboxProfiles=new Set(['sales','home-sales','hospital-sales','sales-manager','sales-finance','logistics','home-service','hospital-service']);
export async function inboxMailbox(u:Session){
 const preview=u.profileReview;
 if(!preview)return {id:await inboxIdentity(u),name:u.name,profileTitle:null};
 const profile=roleProfiles.find(p=>p.id===preview.id);
 if(!profile)throw new AccessError('پروفایل آزمایشی صندوق پیام پیدا نشد.',403);
 return {id:profileAddress(profile.id),name:profile.title+' (آزمایشی)',profileTitle:profile.title};
}
export function checkInboxMailbox(expected:unknown,actual:string){
 if(expected!=null&&expected!==actual)throw new AccessError('صندوق پیام عوض شده است. صفحه را دوباره باز کنید.',409);
}
export async function accountInboxDirectory(u:Session){const me=await inboxIdentity(u),db=storage();let users=(await db.prepare("SELECT m.id,m.name,m.unit,m.permissions,EXISTS(SELECT 1 FROM flow_entities f WHERE f.type='account_profile' AND f.id='profile:'||CASE WHEN EXISTS(SELECT 1 FROM password_accounts a WHERE a.member_id=m.id) THEN 'local:'||m.id ELSE m.subject END AND COALESCE(json_extract(f.data,'$.image'),'')<>'') AS hasPhoto FROM app_members m WHERE m.status='active' ORDER BY m.name,m.id").all()).results as any[];
 if(!u.isAdmin&&u.permissions.serviceAgentId)users=users.filter(r=>{const p=storedAccessPermissions(r.permissions);return !p.serviceAgentId&&p.serviceRoles?.some((x:string)=>['manager','coordinator'].includes(x))&&p.serviceDomains?.some((x:string)=>u.permissions.serviceDomains?.includes(x));});
 if(!u.isAdmin&&u.permissions.salesAgentId){
  await salesScope(u,u.permissions.salesAgentId);
  users=users.filter(r=>{
   const p=storedAccessPermissions(r.permissions),actor={isAdmin:false,permissions:p} as Session;
   if(p.salesAgentId||p.serviceAgentId||p.hospitalCenterId)return false;
   return salesStaff(actor)||salesFinance(actor)||p.transportRoles?.includes('manager')||
    p.serviceRoles?.some(role=>['manager','coordinator','support','intake'].includes(role));
  });
 }
 const photoUrl=(id:string)=>'/api/inbox?avatar='+encodeURIComponent(id);
 const people=users.map(({id,name,unit,hasPhoto})=>({id,name,unit,avatarUrl:hasPhoto?photoUrl(id):null}));
 const owner=await db.prepare("SELECT EXISTS(SELECT 1 FROM flow_entities f WHERE f.type='account_profile' AND f.id='profile:'||i.subject AND COALESCE(json_extract(f.data,'$.image'),'')<>'') AS hasPhoto FROM app_identity i WHERE i.id='owner'").first<{hasPhoto:number}>();
 if(owner)people.unshift({id:'@owner',name:'مدیر سامانه',unit:'مدیریت',avatarUrl:owner.hasPhoto?photoUrl('@owner'):null});
 const positions=(await db.prepare("SELECT * FROM flow_entities WHERE type='position' AND json_extract(data,'$.active')=1 ORDER BY created,id").all()).results.map(inboxDecode).filter((r:any)=>!u.permissions.serviceAgentId||r.data.members.some((id:string)=>people.some(p=>p.id===id))).map((r:any)=>({id:r.id,name:r.data.name,unit:r.data.unit,members:r.data.members.filter((id:string)=>people.some(p=>p.id===id))}));
 const titles=new Map<string,string[]>();
 for(const position of positions)for(const id of position.members){
  const names=titles.get(id)||[];
  if(position.name&&!names.includes(position.name))titles.set(id,[...names,position.name]);
 }
 return {me,people:people.map(person=>({...person,positions:titles.get(person.id)||[]})),positions:!u.isAdmin&&(u.permissions.serviceAgentId||u.permissions.salesAgentId)?[]:positions};}
export async function inboxDirectory(u:Session){
 const mailbox=await inboxMailbox(u);
 if(!mailbox.profileTitle)return {...await accountInboxDirectory(u),mailboxName:mailbox.name,profileTitle:null};
 const people=roleProfiles
  .filter(p=>profileAddress(p.id)!==mailbox.id&&(u.profileReview?.id!=='sales-representative'||representativeInboxProfiles.has(p.id)))
  .map(p=>({id:profileAddress(p.id),name:p.title,unit:'آزمایشی'}));
 return {me:mailbox.id,mailboxName:mailbox.name,profileTitle:mailbox.profileTitle,people,positions:[]};
}
export async function inboxContactAvatar(u:Session,id:string){
 const directory=await inboxDirectory(u);
 if(directory.profileTitle||!directory.people.some(p=>p.id===id&&'avatarUrl' in p&&p.avatarUrl))throw new AccessError('عکس مخاطب در دسترس نیست.',404);
 const db=storage();
 const account=id==='@owner'
  ?await db.prepare("SELECT subject AS account FROM app_identity WHERE id='owner'").first<{account:string|null}>()
  :await db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM password_accounts a WHERE a.member_id=m.id) THEN 'local:'||m.id ELSE m.subject END AS account FROM app_members m WHERE m.id=? AND m.status='active'").bind(id).first<{account:string|null}>();
 const row=account?.account?await db.prepare("SELECT json_extract(data,'$.image') AS image FROM flow_entities WHERE id=? AND type='account_profile'").bind('profile:'+account.account).first<{image:string|null}>():null;
 if(!row?.image)throw new AccessError('عکس مخاطب در دسترس نیست.',404);
 return Uint8Array.from(atob(row.image),c=>c.charCodeAt(0));
}
export async function positionMembers(id:string){const p:any=await storage().prepare("SELECT data FROM flow_entities WHERE id=? AND type='position' AND json_extract(data,'$.active')=1").bind(id).first();if(!p)return [];const ids=JSON.parse(p.data).members||[];const active=(await storage().prepare("SELECT id FROM app_members WHERE status='active'").all()).results as any[];return ids.filter((id:string)=>active.some(a=>a.id===id));}
export async function inboxAccess(id:string,u:Session){const row=inboxDecode(await storage().prepare("SELECT * FROM flow_entities WHERE id=? AND type='inbox_thread'").bind(id).first()),mailbox=await inboxMailbox(u),me=mailbox.id;if(!row)throw new AccessError('گفت‌وگو یافت نشد.',404);const d=row.data,recipients=d.recipientType==='position'?await positionMembers(d.recipientId):[d.recipientId];if(d.sender!==me&&!recipients.includes(me))throw new AccessError('گفت‌وگو یافت نشد.',404);const responsible=d.recipientType==='person'?d.recipientId:recipients.includes(d.assignee)?d.assignee:'';return {...row,me,mailboxName:mailbox.name,profileTitle:mailbox.profileTitle,isSender:d.sender===me,isRecipient:recipients.includes(me),responsible,canWork:recipients.includes(me)&&responsible===me};}
export async function inboxLink(u:Session,link:any){if(!link?.id||!link?.section)return null;const db=storage();if(link.reminderKind){const {reminderSources}=await import('./reminder-sources'),{reminderNavigation}=await import('./reminder-contract');if(!Object.hasOwn(reminderNavigation,link.reminderKind)||!(await reminderSources(u,link.reminderKind,link.id)).some(r=>r.id===link.id))throw new AccessError('دسترسی پرونده مرتبط ندارید.',404);return {section:reminderNavigation[link.reminderKind],id:link.id,reminderKind:link.reminderKind};}if(link.section==='tasks'&&link.id.startsWith('receipt-note:'))await (await import('./receipt-observations')).receiptObservationAccess(u,link.id.slice('receipt-note:'.length));else if(link.section==='tasks')await taskAccess(link.id,u);else if(link.section==='assets'){await (await import('./assets')).assetAccess(u,link.id);}else if(link.section==='transport'){await (await import('./transport')).transportAccess(u,link.id);}else if(link.section==='after-sales'){await (await import('./after-sales')).caseAccess(link.id,u);}else if(link.section==='sourcing'){if(!u.isAdmin&&!u.permissions.supplyRoles?.length)throw new AccessError('دسترسی ندارید.',403);if(!await db.prepare("SELECT id FROM flow_entities WHERE id=? AND type='sourcing_plan'").bind(link.id).first())throw new AccessError('برنامه یافت نشد.',404);}else{const r:any=await db.prepare('SELECT kind FROM records WHERE id=?').bind(link.id).first();if(!r||r.kind!==link.section||!can(u,r.kind,'read'))throw new AccessError('دسترسی پرونده ندارید.',404);}return {section:link.section,id:link.id};}
export const inboxClosed=(state:string)=>['completed','closed','cancelled'].includes(state);
export async function inboxState(thread:string,me:string){const row:any=await storage().prepare("SELECT data FROM flow_entities WHERE id=? AND type='inbox_state'").bind('inbox-state:'+thread+':'+me).first();return row?JSON.parse(row.data):{readRevision:0,snoozeUntil:''};}
export async function inboxView(t:any,savedState?:any){const state=savedState||await inboxState(t.id,t.me),d=t.data,needsReview=t.isSender&&d.state==='submitted',needsWork=d.kind==='request'&&t.isRecipient&&(!t.responsible||t.canWork)&&!inboxClosed(d.state)&&d.state!=='submitted',unread=state.readRevision<t.revision;
 return {id:t.id,revision:t.revision,created:t.created,updated:t.updated,...d,isSender:t.isSender,isRecipient:t.isRecipient,canWork:t.canWork,responsible:t.responsible,unread,snoozeUntil:state.snoozeUntil,needsReview,overdue:!!d.due&&Date.parse(d.due)<Date.now()&&!inboxClosed(d.state),needsAttention:(!state.snoozeUntil||Date.parse(state.snoozeUntil)<=Date.now())&&(unread||needsReview||needsWork)};}
export async function inboxList(u:Session){const me=(await inboxMailbox(u)).id,rows=(await storage().prepare("SELECT t.* FROM flow_entities t WHERE t.type='inbox_thread' AND (json_extract(t.data,'$.sender')=? OR (json_extract(t.data,'$.recipientType')='person' AND json_extract(t.data,'$.recipientId')=?) OR (json_extract(t.data,'$.recipientType')='position' AND EXISTS(SELECT 1 FROM flow_entities p,json_each(p.data,'$.members') m WHERE p.type='position' AND p.id=json_extract(t.data,'$.recipientId') AND json_extract(p.data,'$.active')=1 AND m.value=?))) ORDER BY t.updated DESC,t.id LIMIT 301").bind(me,me,me).all()).results;const positions=(await storage().prepare("SELECT id,data FROM flow_entities WHERE type='position' AND json_extract(data,'$.active')=1").all()).results as any[],active=(await storage().prepare("SELECT id FROM app_members WHERE status='active'").all()).results as any[],states=(await storage().prepare("SELECT id,data FROM flow_entities WHERE type='inbox_state' AND substr(id,-length(?))=?").bind(':'+me,':'+me).all()).results as any[],stateMap=new Map(states.map(r=>[r.id,JSON.parse(r.data)]));const threads=[];for(const row of rows.slice(0,300) as any[]){const t=inboxDecode(row),d=t.data,p=positions.find(p=>p.id===d.recipientId),recipients=d.recipientType==='person'?[d.recipientId]:(p?JSON.parse(p.data).members.filter((id:string)=>active.some(a=>a.id===id)):[]),responsible=d.recipientType==='person'?d.recipientId:recipients.includes(d.assignee)?d.assignee:'';threads.push(await inboxView({...t,me,isSender:d.sender===me,isRecipient:recipients.includes(me),responsible,canWork:recipients.includes(me)&&responsible===me},stateMap.get('inbox-state:'+t.id+':'+me)||{readRevision:0,snoozeUntil:''}));}return {threads,limited:rows.length>300};}

/** Shared authenticated create preparation for immediate and scheduled requests. Caller commits atomically. */
export async function prepareInboxCreate(u:Session,b:any,now=new Date(),mailboxDirectory?:Awaited<ReturnType<typeof inboxDirectory>>){
 const fail=(s:string):never=>{throw new AccessError(s,400)},req=(v:any,max:number)=>{if(typeof v!=='string'||!v.trim()||v.length>max)fail('متن الزامی یا طول نامعتبر است.');return v.trim();};
 const dir=mailboxDirectory||await accountInboxDirectory(u),me=dir.me;if(!['person','position'].includes(b.recipientType))fail('نوع گیرنده معتبر نیست.');
 const recipient:any=(b.recipientType==='person'?dir.people:dir.positions).find((x:any)=>x.id===b.recipientId);if(!recipient)fail('گیرنده فعال انتخاب کنید.');
 if(b.recipientType==='person'&&recipient.id===me||b.recipientType==='position'&&!recipient.members.some((x:string)=>x!==me))fail('گیرنده باید شخص دیگری یا سمتی دارای همکار فعال باشد.');
 if(!['message','request'].includes(b.kind)||!['normal','urgent'].includes(b.priority))fail('نوع یا اولویت معتبر نیست.');
 let due='';if(b.kind==='request'){const value=req(b.due,40);if(!/^\d{4}-\d\d-\d\dT([01]\d|2[0-3]):[0-5]\d:00\+03:30$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value.slice(0,10)).toISOString().slice(0,10)!==value.slice(0,10)||Date.parse(value)<=now.getTime())fail('مهلت آینده با ساعت تهران انتخاب کنید.');due=new Date(value).toISOString();}
 const data={title:req(b.title,180),kind:b.kind,priority:b.priority,sender:me,senderName:mailboxDirectory?.mailboxName||u.name,recipientType:b.recipientType,recipientId:recipient.id,recipientName:recipient.name,assignee:b.recipientType==='person'?recipient.id:'',state:'open',due,link:b.link?.id?await inboxLink(u,b.link):null};
 return {data,body:req(b.body,12000),recipient,me};
}
export function inboxCreateGuards(db:D1Database,op:string,recipientType:string,recipientId:string){
 const sql=recipientType==='position'?"EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND type='position' AND json_extract(data,'$.active')=1)":"EXISTS(SELECT 1 FROM app_members WHERE id=? AND status='active')";
 // The preview directory validates fixed profile addresses. They have no mutable member row.
 if(recipientType==='person'&&(recipientId==='@owner'||roleProfiles.some(p=>profileAddress(p.id)===recipientId)))return [];
 return [db.prepare('UPDATE inventory_operations SET guard=CASE WHEN '+sql+' THEN guard ELSE 0 END WHERE id=?').bind(recipientId,op)];
}
