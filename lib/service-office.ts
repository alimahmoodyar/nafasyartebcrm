import type {Session} from './permissions';
import {storedAccessPermissions} from './permissions';
import {storage} from './storage';
import {officeServiceAccess} from './service-office-access';
export {officeServiceAccess} from './service-office-access';
import {AccessError} from './authorization';
import {memberId} from './duties';
import {parseServiceDeviceQr,serviceDeviceSerial,serviceDeviceQr} from './service-device-contract';
export async function serviceWorkPerformer(u:Session,b:any){
 const own=await memberId(u)||u.userId,id=String(b.performerId||own);let name=u.name,member:any=null;
 if(id!==own&&id!==u.userId){
  if(!u.isAdmin&&!u.permissions.serviceRoles?.includes('manager'))throw new AccessError('ثبت کار به نام همکار فقط با مسئول مجاز است.',403);
  if(typeof b.performerReason!=='string'||!b.performerReason.trim()||b.performerReason.length>2000)throw new AccessError('دلیل ثبت به نام سرویسکار دیگر لازم است.',400);
  member=await storage().prepare("SELECT id,name,permissions,revision FROM app_members WHERE id=? AND status='active'").bind(id).first<any>();
  const p=member?storedAccessPermissions(member.permissions):null;
  if(!member||!p?.serviceDomains?.includes('home')||!p.serviceRoles?.includes('technician')||p.serviceAgentId||p.salesAgentId||p.hospitalCenterId)throw new AccessError('سرویسکار فعال خدمات خانگی را انتخاب کنید.',400);
  name=member.name;
 }
 return {performerId:id===u.userId?own:id,performerName:name,recordedBy:u.userId,recordedByName:u.name,reason:member?b.performerReason.trim():'',member};
}
export async function readOfficeService(u:Session,q:URLSearchParams){
 if(!officeServiceAccess(u))throw new AccessError('دسترسی خدمات دفتر شرکت لازم است.',403);
 const db=storage(),view=q.get('view')||'open',page=Number(q.get('page')||1),search=(q.get('q')||'').trim();
 if(!['open','history'].includes(view)||!Number.isSafeInteger(page)||page<1||page>1000000||search.length>100)throw new AccessError('بخش یا جست‌وجو معتبر نیست.',400);
 const raw=q.get('code')||'',serial=(raw?parseServiceDeviceQr(raw):serviceDeviceSerial(q.get('serial')||''))||'';
 if(raw&&!serial||serial.length>160)throw new AccessError('کد لیبل دستگاه معتبر نیست.',400);
 const base="type='as_case' AND json_extract(data,'$.domain')='home' AND COALESCE(json_extract(data,'$.agentId'),'')=''",closed="json_extract(data,'$.state') IN ('closed','resolved','returned','delivered')";
 const filter=base+' AND '+(serial?"json_extract(data,'$.serial')=?":view==='history'?closed:'NOT ('+closed+')')+" AND (?='' OR instr(json_extract(data,'$.serial'),?)>0 OR instr(json_extract(data,'$.customer'),?)>0 OR instr(json_extract(data,'$.phone'),?)>0 OR instr(COALESCE(json_extract(data,'$.model'),''),?)>0)",args=[...(serial?[serial]:[]),search,search,search,search,search];
 const total:any=await db.prepare('SELECT COUNT(*) n FROM flow_entities WHERE '+filter).bind(...args).first();
 const rows=(await db.prepare('SELECT id,revision,data FROM flow_entities WHERE '+filter+' ORDER BY created DESC,id LIMIT 20 OFFSET ?').bind(...args,(page-1)*20).all()).results.map((r:any)=>{const d=JSON.parse(r.data);return {id:r.id,revision:r.revision,serial:d.serial,model:d.model,customer:d.customer,state:d.state,day:d.intake?.day||d.contactDay,estimate:d.estimateVersion?d.customerTotal:null}});
 const active:any=serial?await db.prepare('SELECT id FROM flow_entities WHERE '+base+" AND json_extract(data,'$.serial')=? AND json_extract(data,'$.state') NOT IN ('closed','resolved','returned') ORDER BY created DESC,id LIMIT 1").bind(serial).first():null;
 const device:any=serial?await db.prepare("SELECT payload FROM records WHERE kind='device' AND json_extract(payload,'$.code')=? LIMIT 1").bind(serial).first():null;
 return {rows,total:total?.n||0,page,pages:Math.max(1,Math.ceil((total?.n||0)/20)),serial,qr:serial?serviceDeviceQr(serial):'',activeCaseId:active?.id||'',model:device?JSON.parse(device.payload).model||'':'',known:!!(device||total?.n)};
}
