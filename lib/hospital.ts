import {financialAccess} from './financial-access';
import {session,AccessError} from './authorization';
import {storage} from './storage';
import type {Session} from './permissions';
import {serviceSupervisor,domainWriteAccess} from './service-access';
const staff=(u:Session)=>!u.permissions.hospitalCenterId&&!u.permissions.serviceAgentId&&!u.permissions.salesAgentId&&!u.permissions.serviceRoles?.includes('agent')&&!u.permissions.salesRoles?.includes('agent');
export const hospitalManager=(u:Session)=>staff(u)&&(u.isAdmin||domainWriteAccess(u,'hospital')&&u.permissions.serviceRoles?.some(r=>['manager','coordinator'].includes(r)));
export const hospitalFinance=(u:Session)=>staff(u)&&(u.isAdmin||financialAccess(u,'hospital',true)||domainWriteAccess(u,'hospital')&&u.permissions.serviceRoles?.includes('finance'));
export const hospitalTech=(u:Session)=>hospitalManager(u)||staff(u)&&domainWriteAccess(u,'hospital')&&u.permissions.serviceRoles?.includes('technician');
export const hospitalQuoteWriter=(u:Session)=>hospitalTech(u)||staff(u)&&domainWriteAccess(u,'hospital')&&!!u.permissions.serviceRoles?.includes('support');
export const hospitalInventory=(u:Session)=>staff(u)&&(u.isAdmin||domainWriteAccess(u,'hospital')&&u.permissions.serviceRoles?.includes('inventory'));
export const hospitalLogistics=(u:Session)=>staff(u)&&(u.isAdmin||domainWriteAccess(u,'hospital')&&u.permissions.serviceRoles?.includes('logistics'));
export const hospitalRead=(u:Session)=>!!u.permissions.hospitalCenterId||serviceSupervisor(u)||hospitalManager(u)||hospitalFinance(u)||!!(staff(u)&&domainWriteAccess(u,'hospital')&&u.permissions.serviceRoles?.some(r=>['support','intake','technician','inventory','logistics'].includes(r)));
// Creating requests and asking the device assistant were available to hospital
// staff and center accounts. Supervisory reading alone does not add those rights.
export const hospitalOperationAccess=(u:Session)=>!!u.permissions.hospitalCenterId||!!hospitalFinance(u)||domainWriteAccess(u,'hospital')&&staff(u);
export async function hospitalUser(){const u=await session();if(!hospitalRead(u))throw new AccessError('دسترسی خدمات بیمارستانی ندارید.',403);if(u.permissions.hospitalCenterId)await hospitalCenter(u,u.permissions.hospitalCenterId);return u;}
export const htext=(v:unknown,max=4000)=>{if(typeof v!=='string'||v.length>max)throw new AccessError('متن معتبر وارد کنید.',400);return v.trim()};
export const hreq=(v:unknown,max=200)=>{const s=htext(v,max);if(!s)throw new AccessError('فیلد الزامی خالی است.',400);return s};
export async function hrow(id:string,type:string){const r:any=await storage().prepare('SELECT * FROM flow_entities WHERE id=? AND type=?').bind(id,type).first();if(!r)throw new AccessError('پرونده پیدا نشد.',404);return {...r,data:JSON.parse(r.data)};}
export async function hospitalCenter(u:Session,id:string){if(u.permissions.hospitalCenterId&&u.permissions.hospitalCenterId!==id)throw new AccessError('پرونده پیدا نشد.',404);const c=await hrow(id,'hospital_center');if(!c.data.active)throw new AccessError('مرکز غیرفعال است.',403);return c;}
export async function hospitalAsset(u:Session,id:string){const a=await hrow(id,'hospital_asset');await hospitalCenter(u,a.data.centerId);return a;}
export async function hospitalRows(){return (await storage().prepare("SELECT * FROM flow_entities WHERE type GLOB 'hospital_*' ORDER BY created,id").all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)}));}
export const hospitalStates:Record<string,string>={requested:'درخواست جدید',quoted:'منتظر تأیید پیش‌فاکتور',accepted:'پیش‌فاکتور تأییدشده',declined:'پیش‌فاکتور ردشده',scheduled:'اعزام برنامه‌ریزی‌شده',dispatched:'تکنسین اعزام‌شده',completed:'منتظر تأیید عملکرد مرکز',confirmed:'عملکرد تأییدشده',disputed:'اعتراض مرکز؛ نیازمند پیگیری'};
export function hospitalBalance(rows:any[],centerId:string){const invoices=rows.filter(r=>r.type==='hospital_invoice'&&r.data.centerId===centerId),payments=rows.filter(r=>r.type==='hospital_payment'&&r.data.centerId===centerId&&r.data.state==='approved');const debit=invoices.reduce((n,r)=>n+BigInt(r.data.amount),BigInt(0)),credit=payments.reduce((n,r)=>n+BigInt(r.data.amount),BigInt(0));return {debit:String(debit),credit:String(credit),balance:String(debit-credit),invoices:invoices.map(i=>({...i,remaining:String(BigInt(i.data.amount)-payments.filter(p=>p.data.invoiceId===i.id).reduce((n,p)=>n+BigInt(p.data.amount),BigInt(0)))}))};}
export function hospitalPublic(r:any){const d=r.data;if(r.type==='hospital_center')return {...r,data:{name:d.name,phone:d.phone,address:d.address,active:d.active,contacts:d.contacts||[]}};if(r.type==='hospital_file'){const {objectKey,...safe}=d;return {...r,data:safe};}if(r.type==='hospital_job'){const {internalNotes,...safe}=d;return {...r,data:{...safe,history:(d.history||[]).map(({actor,...h}:any)=>h)}};}return r;}
