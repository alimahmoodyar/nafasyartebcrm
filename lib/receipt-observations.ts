import {AccessError} from './authorization';
import {storage} from './storage';
import {storedAccessPermissions} from './permissions';
import {financialAccess} from './financial-access';
import {flowRole} from './material-flow';
import {warehouseDirectory,warehouseMember} from './material-warehouses';
import {inboxIdentity,prepareInboxCreate,inboxCreateGuards} from './inbox';
export const receiptNoteTarget=(id:string)=>'receipt-note:'+id;
export const internalReceiptUser=(u:any)=>!u.permissions.salesAgentId&&!u.permissions.serviceAgentId&&!u.permissions.hospitalCenterId;
export function receiptNoteRole(u:any,role:string,route=''){
 if(!internalReceiptUser(u))return false;
 return u.isAdmin||role==='finance'&&(financialAccess(u,'control',true)||u.permissions.supplyRoles?.includes('finance'))||role==='supply'&&u.permissions.supplyRoles?.some((r:string)=>['commerce_manager',...(route?[route]:['domestic','foreign'])].includes(r));
}
export async function receiptObservationAccess(u:any,id:string){
 const db=storage(),row:any=await db.prepare("SELECT * FROM flow_entities WHERE id=? AND type='receipt_observation'").bind(id).first();if(!row)throw new AccessError('یادداشت دریافت یافت نشد.',404);const d=JSON.parse(row.data),me=await inboxIdentity(u);
 if(!internalReceiptUser(u))throw new AccessError('دسترسی یادداشت دریافت ندارید.',403);
 const warehouse=(await warehouseDirectory()).find(w=>w.id===d.warehouseId);
 if(!u.isAdmin&&(d.actor!==u.userId||!!u.profileReview)&&!d.personRecipients.includes(me)&&!d.roleRecipients.some((r:string)=>receiptNoteRole(u,r,d.route))&&!(warehouse&&(warehouseMember(u,warehouse,'inventory')||warehouseMember(u,warehouse,'qc'))))throw new AccessError('یادداشت دریافت یافت نشد.',404);
 return {...row,data:d};
}
export async function receiptNotePeople(){return (await storage().prepare("SELECT id,name,permissions FROM app_members WHERE status='active' ORDER BY name,id").all()).results.filter((m:any)=>internalReceiptUser({permissions:storedAccessPermissions(m.permissions)})).map((m:any)=>({id:m.id,name:m.name,permissions:storedAccessPermissions(m.permissions)}));}

/** Same transaction as receipt: evidence, observation, inbox and source links commit together. */
export async function prepareReceiptObservation(u:any,b:any,receiptId:string,warehouseId:string,materialName:string,route:string,automatic:any,context?:{reviewKind:'receipt_edit';quarantineWarehouseId?:string}){
 const db=storage(),now=new Date().toISOString(),content=typeof b.receiptNote==='string'?b.receiptNote.trim():'',roles=b.noteRoles??[],people=b.notePeople??[],files=b.evidenceIds??[];
 if(content.length>4000||!Array.isArray(roles)||roles.length>2||roles.some((r:any)=>!['supply','finance'].includes(r))||new Set(roles).size!==roles.length||!Array.isArray(people)||people.length>20||new Set(people).size!==people.length||!Array.isArray(files)||files.length>6||new Set(files).size!==files.length)throw new AccessError('یادداشت، مخاطبان یا پیوست‌ها معتبر نیستند.',400);
 const directory=await receiptNotePeople(),me=await inboxIdentity(u);if(people.some((id:any)=>typeof id!=='string'||id===me||!directory.some(p=>p.id===id)))throw new AccessError('مخاطب داخلی فعال دیگری انتخاب کنید.',400);
 if(!content&&!files.length&&(roles.length||people.length))throw new AccessError('برای ارجاع، یادداشت یا عکس ثبت کنید.',400);
 const roleRecipients=[...new Set([...roles,...(automatic?['supply']:[])])];if(!content&&!files.length&&!automatic)return {id:'',statements:[] as D1PreparedStatement[]};
 const id='receipt-observation:'+b.id+(automatic?':quantity':''),attachments:any[]=[],statements:D1PreparedStatement[]=[];
 for(const fileId of files){const f:any=await db.prepare("SELECT * FROM flow_entities WHERE id=? AND type='receipt_evidence'").bind(fileId).first();if(!f)throw new AccessError('پیوست دریافت پیدا نشد.',400);const d=JSON.parse(f.data);if(d.actor!==u.userId||d.draftId!==b.id||d.state!=='staged')throw new AccessError('پیوست متعلق به این پیش‌نویس نیست.',403);statements.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN guard ELSE 0 END WHERE id=?').bind(f.id,f.revision,b.id),db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify({...d,state:'attached',observationId:id,receiptId}),now,f.id,f.revision));attachments.push({id:f.id,filename:d.filename,size:d.size});}
 const body=[content,...(automatic?[automatic.message]:[])].filter(Boolean).join('\n'),data={receiptId,warehouseId,materialName,body,...context,automatic:automatic||null,roleRecipients,personRecipients:people,attachments,route:route||'',state:context?.reviewKind==='receipt_edit'||roleRecipients.length||people.length?'open':'recorded',actor:u.userId,by:u.name,createdAt:now,responses:[],history:[]};
 statements.push(db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'receipt_observation',?,1,?,?)").bind(id,JSON.stringify(data),now,now));
 const recipients=[...new Set([...people,...directory.filter(m=>roleRecipients.some(r=>receiptNoteRole({isAdmin:false,permissions:m.permissions},r,route))).map(m=>m.id)])].filter(x=>x!==me);
 for(const recipientId of recipients){const threadId='receipt-notice:'+b.id+(automatic?':quantity':'')+':'+recipientId,prepared=await prepareInboxCreate(u,{recipientType:'person',recipientId,kind:'message',priority:'normal',title:'یادداشت دریافت '+materialName,body:body||'عکس‌های ثبت‌شده هنگام دریافت کالا را بررسی کنید.'});const link={section:'tasks',id:receiptNoteTarget(id)};statements.push(...inboxCreateGuards(db,b.id,'person',recipientId),db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'inbox_thread',?,1,?,?)").bind(threadId,JSON.stringify({...prepared.data,link,receiptObservationId:id}),now,now),db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'inbox_message',?,1,?,?)").bind('inbox-msg:'+threadId,JSON.stringify({thread:threadId,body:prepared.body,mode:'create',author:me,authorName:u.name}),now,now));}
 return {id,statements};
}

export async function receiptEditReviewer(u:any,d:any){if(d.reviewKind!=='receipt_edit')return false;const w=(await warehouseDirectory()).find(w=>w.id===d.warehouseId),q=(await warehouseDirectory()).find(w=>w.id===d.quarantineWarehouseId)||w;return u.isAdmin||!!w&&(warehouseMember(u,w,'inventory')||warehouseMember(u,q,'qc'));}

export async function receiptNoteResponder(u:any,n:any){const d=n.data,me=await inboxIdentity(u);return u.isAdmin||d.personRecipients.includes(me)||d.roleRecipients.some((r:string)=>receiptNoteRole(u,r,d.route))||await receiptEditReviewer(u,d);}
