import {storage} from './storage';
import {AccessError} from './authorization';
import {trainingContext} from './training-context';
import {personnelStaff} from './personnel-profile';
import type {Session} from './permissions';

export type MemberContact={memberId:string;mobile:string;contactEmail:string;revision:number;canEdit:true};
type ContactData={memberId:string;mobile:string;contactEmail:string};
const fail=(message:string,status=400):never=>{throw new AccessError(message,status)};
const owns=(o:any,key:string)=>Object.prototype.hasOwnProperty.call(o,key);
export const memberContactId=(memberId:string)=>'member-contact:'+memberId;
export function contactPatch(value:any,previous:{mobile:string;contactEmail:string}={mobile:'',contactEmail:''}){
 const next={mobile:previous.mobile,contactEmail:previous.contactEmail};
 if(owns(value,'mobile')){
  if(typeof value.mobile!=='string'||value.mobile.length>60)fail('شماره موبایل معتبر نیست.');
  let s=value.mobile.trim().replace(/[۰-۹]/g,(c:string)=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,(c:string)=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[\s()\-]/g,'');
  if(s.startsWith('0098'))s='0'+s.slice(4);else if(s.startsWith('+98'))s='0'+s.slice(3);else if(/^9\d{9}$/.test(s))s='0'+s;
  if(s&&!/^09\d{9}$/.test(s))fail('شماره موبایل را کامل وارد کنید؛ مانند ۰۹۱۲۱۲۳۴۵۶۷.');
  next.mobile=s;
 }
 if(owns(value,'contactEmail')){
  if(typeof value.contactEmail!=='string')fail('ایمیل تماس معتبر نیست.');
  const s=value.contactEmail.trim().toLowerCase();
  if(s.length>254||s&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)||/[\x00-\x1f\x7f]/.test(s))fail('ایمیل تماس معتبر وارد کنید یا آن را خالی بگذارید.');
  next.contactEmail=s;
 }
 return next;
}
async function context(actor:Session){
 if(trainingContext.getStore())fail('اطلاعات تماس حساب فقط در اطلاعات شرکت قابل دسترسی است.',403);
 const db=storage(),members=(await db.prepare('SELECT id,name,status,subject,permissions FROM app_members ORDER BY id').all()).results as any[],identities=(await db.prepare('SELECT id,subject FROM app_identity ORDER BY id').all()).results as any[];
 const own=members.find(m=>m.subject===actor.userId||m.id===(actor.userId.startsWith('local:')?actor.userId.slice(6):actor.userId));
 const admin=actor.isAdmin&&identities.some(i=>i.id==='owner'&&i.subject===actor.userId||i.id==='local_admin'&&i.subject===own?.id&&own?.status==='active');
 if(actor.isAdmin&&!admin)fail('هویت مدیر تغییر کرده است؛ دوباره وارد شوید.',403);
 if(!admin&&own?.status!=='active')fail('حساب فعال لازم است.',403);
 let p:any;try{p=JSON.parse(own?.permissions||'{}')}catch{p={}}
 const hr=personnelStaff(own)&&Array.isArray(p.personnelRoles)&&p.personnelRoles.includes('hr');
 return {db,members,identities,own,admin,hr};
}
function target(c:Awaited<ReturnType<typeof context>>,memberId?:string){
 const id=memberId===undefined||memberId===''?c.own?.id:memberId;
 if(typeof id!=='string'||!id.length||id.length>200)fail('حساب متصل به فرد یافت نشد.',404);
 const m=c.members.find(m=>m.id===id&&m.status!=='deleted');
 if(!m)fail('حساب یافت نشد یا حذف شده است.',404);
 if(!c.admin&&!(m.id===c.own?.id&&m.status==='active')&&!(c.hr&&personnelStaff(m)))fail('اطلاعات تماس این فرد در دسترسی شما نیست.',403);
 return m;
}
export async function memberContactsForAccounts(memberIds:string[]):Promise<MemberContact[]>{
 if(!memberIds.length)return [];
 const wanted=new Set(memberIds),requested=[...wanted],rows:any[]=[],found=new Map<string,MemberContact>();
 for(let index=0;index<requested.length;index+=80){const ids=requested.slice(index,index+80).map(memberContactId),result=await storage().prepare("SELECT id,data,revision FROM flow_entities WHERE type='member_contact' AND id IN ("+ids.map(()=>'?').join(',')+") ORDER BY id").bind(...ids).all();rows.push(...result.results);}
 for(const row of rows){let d:any;try{d=JSON.parse(row.data)}catch{return fail('اطلاعات تماس ثبت‌شده نامعتبر است؛ مدیر سامانه بررسی کند.',409)}
  if(!wanted.has(d?.memberId)||row.id!==memberContactId(d.memberId)||!Number.isSafeInteger(row.revision)||row.revision<1||typeof d.mobile!=='string'||typeof d.contactEmail!=='string')fail('اطلاعات تماس ثبت‌شده نامعتبر است؛ مدیر سامانه بررسی کند.',409);
  const clean=contactPatch(d);if(clean.mobile!==d.mobile||clean.contactEmail!==d.contactEmail)fail('اطلاعات تماس ثبت‌شده نیاز به بررسی مدیر سامانه دارد.',409);
  found.set(d.memberId,{memberId:d.memberId,...clean,revision:row.revision,canEdit:true});
 }
 return memberIds.map(memberId=>found.get(memberId)||{memberId,mobile:'',contactEmail:'',revision:0,canEdit:true});
}
export async function readMemberContact(actor:Session,memberId?:string){const c=await context(actor),m=target(c,memberId);return (await memberContactsForAccounts([m.id]))[0];}
export async function personnelContactProjection(actor:Session,visibleEmployeeIds:string[]){
 const c=await context(actor),personalContact=c.own&&c.own.status==='active'?(await memberContactsForAccounts([target(c,c.own.id).id]))[0]:null;
 const ids=c.admin||c.hr?[...new Set(visibleEmployeeIds)].filter(id=>{const m=c.members.find(m=>m.id===id);return personnelStaff(m)}):[];
 return {personalContact,contacts:await memberContactsForAccounts(ids)};
}
/** Guard the permission/identity snapshot inside the same transaction as a contact write. */
export function memberContactGuards(db:D1Database,operationId:string,c:{members:any[];identities:any[]}){
 return [db.prepare("UPDATE inventory_operations SET guard=CASE WHEN (SELECT json_group_array(json_object('id',id,'name',name,'status',status,'subject',subject,'permissions',permissions)) FROM (SELECT * FROM app_members ORDER BY id))=? THEN guard ELSE 0 END WHERE id=?").bind(JSON.stringify(c.members.map(m=>({id:m.id,name:m.name,status:m.status,subject:m.subject,permissions:m.permissions}))),operationId),db.prepare("UPDATE inventory_operations SET guard=CASE WHEN (SELECT json_group_array(json_object('id',id,'subject',subject)) FROM (SELECT * FROM app_identity ORDER BY id))=? THEN guard ELSE 0 END WHERE id=?").bind(JSON.stringify(c.identities.map(i=>({id:i.id,subject:i.subject}))),operationId)];
}
export async function memberContactAdminContext(actor:Session){const c=await context(actor);if(!c.admin)fail('مدیریت کاربران فقط برای مدیر سامانه مجاز است.',403);return c;}
export function contactRevisionGuard(db:D1Database,operationId:string,memberId:string,revision:number){return revision===0?db.prepare('UPDATE inventory_operations SET guard=CASE WHEN NOT EXISTS(SELECT 1 FROM flow_entities WHERE id=?) THEN guard ELSE 0 END WHERE id=?').bind(memberContactId(memberId),operationId):db.prepare("UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND type='member_contact' AND revision=?) THEN guard ELSE 0 END WHERE id=?").bind(memberContactId(memberId),revision,operationId);}
export function memberContactWrite(db:D1Database,memberId:string,values:{mobile:string;contactEmail:string},now:string){const data:ContactData={memberId,...values};return db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'member_contact',?,1,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=flow_entities.revision+1,updated=excluded.updated").bind(memberContactId(memberId),JSON.stringify(data),now,now);}
export async function applyMemberContact(actor:Session,body:any){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['id','confirmed','memberId','revision','mobile','contactEmail'].includes(k))||body.confirmed!==true||typeof body.id!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id)||!Number.isSafeInteger(body.revision)||body.revision<0||!owns(body,'mobile')&&!owns(body,'contactEmail'))fail('تأیید، نسخه و اطلاعات تماس معتبر لازم است.');
 const c=await context(actor),m=target(c,body.memberId),old=(await memberContactsForAccounts([m.id]))[0],values=contactPatch(body,old),signature=JSON.stringify({memberId:m.id,revision:body.revision,...(owns(body,'mobile')?{mobile:values.mobile}:{}),...(owns(body,'contactEmail')?{contactEmail:values.contactEmail}:{})}),prior:any=await c.db.prepare('SELECT actor,payload FROM inventory_operations WHERE id=?').bind(body.id).first();
 if(prior){if(prior.actor!==actor.userId||prior.payload!==signature)fail('شناسه عملیات قبلاً استفاده شده است.',409);return {saved:true,...old,repeated:true};}
 if(body.revision!==old.revision)fail('اطلاعات تماس تغییر کرده است؛ صفحه را تازه کنید.',409);
 const now=new Date().toISOString(),next={memberId:m.id,...values,revision:old.revision+1,canEdit:true as const};
 await c.db.batch([c.db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(body.id,'member_contact_update',signature,actor.userId,now),...memberContactGuards(c.db,body.id,c),contactRevisionGuard(c.db,body.id,m.id,old.revision),memberContactWrite(c.db,m.id,values,now),c.db.prepare('INSERT INTO access_audit(id,actor,target,action,before,after,at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),actor.userId,m.id,'member_contact_update',JSON.stringify(old),JSON.stringify(next),now)]);
 return {saved:true,...next};
}
