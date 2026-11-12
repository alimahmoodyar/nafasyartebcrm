import type {Session} from './permissions';
import {storage} from './storage';
import {memberId,dayAt} from './duties';
import {entity,fail} from './after-sales';
import {domainWriteAccess,role} from './service-access';
import {sreq,sday,salesLock} from './sales';
import {transportAccess,transportDriver,transportDriverCanAct,transportDriverPreview} from './transport';
import {normalizeSerial} from './distribution';
import {driverReceiptId} from './driver-receipt-contract';
export const canReceiveDriverReceipt=(u:Session,domain:string)=>!transportDriverPreview(u)&&u.profileReview?.id!=='home-service'&&!u.permissions.serviceAgentId&&!u.permissions.salesAgentId&&!u.permissions.hospitalCenterId&&domainWriteAccess(u,domain)&&role(u,'intake');
const allowedDomain=(domain:string)=>{if(!['home','hospital'].includes(domain))fail('حوزهٔ خدمات معتبر لازم است.');return domain};
const optional=(v:any,max=1000)=>v===undefined||v===null||v===''?'':sreq(v,max);
export async function driverReceiptAccess(u:Session,id:string){
 if(!driverReceiptId(id))fail('شناسه رسید معتبر نیست.');const row=await entity(id,'transport_receipt'),d=row.data,mid=await memberId(u);
 if(!(transportDriver(u)&&d.driverId===mid||canReceiveDriverReceipt(u,d.domain)||u.isAdmin&&!transportDriverPreview(u)))fail('رسید در دسترس این حساب نیست.',404);return row;
}
export async function readDriverReceipts(u:Session,q:URLSearchParams){
 const domain=allowedDomain(q.get('domain')||'home'),intake=q.get('view')==='intake',mid=await memberId(u),db=storage();
 if(intake?!canReceiveDriverReceipt(u,domain):!transportDriver(u)&&!u.isAdmin)fail('دسترسی دریافت اولیه ندارید.',403);
 if(q.get('id')){const receipt=await driverReceiptAccess(u,driverReceiptId(q.get('id')||''));if(intake&&receipt.data.domain!==domain)fail('حوزهٔ رسید متفاوت است.',404);const caseChoices=intake&&receipt.data.serial?(await db.prepare("SELECT id,data FROM flow_entities WHERE type='as_case' AND json_extract(data,'$.domain')=? AND json_extract(data,'$.serial')=? AND json_extract(data,'$.state') NOT IN ('closed','resolved','returned') ORDER BY created DESC LIMIT 5").bind(domain,receipt.data.serial).all()).results.map((row:any)=>({id:row.id,serial:JSON.parse(row.data).serial,customer:JSON.parse(row.data).customer})):[];return {receipt,caseChoices,canReceive:canReceiveDriverReceipt(u,receipt.data.domain)}}
 const page=Number(q.get('page')||1);if(!Number.isSafeInteger(page)||page<1)fail('صفحه معتبر نیست.');
 const bucket=intake?'all':q.get('bucket')||'active';if(!['active','history','all'].includes(bucket))fail('بخش رسیدها معتبر نیست.');
 const where="type='transport_receipt' AND "+(intake?"json_extract(data,'$.domain')=?":"json_extract(data,'$.driverId')=?")+(intake||bucket==='all'?'':bucket==='active'?" AND json_extract(data,'$.state')='with_driver'":" AND json_extract(data,'$.state')<>'with_driver'"),args=[intake?domain:mid],count:any=await db.prepare('SELECT COUNT(*) n FROM flow_entities WHERE '+where).bind(...args).first(),pages=Math.max(1,Math.ceil(count.n/20)),current=Math.min(page,pages);
 const rows=(await db.prepare('SELECT * FROM flow_entities WHERE '+where+' ORDER BY created DESC,id LIMIT 20 OFFSET ?').bind(...args,(current-1)*20).all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)}));
 return {bucket,receipts:rows,page:current,pages,total:count.n,canReceive:intake,today:dayAt()};
}
export async function applyDriverReceipt(u:Session,b:any){
 if(!b||b.confirmed!==true||!driverReceiptId(b.id)||!['create','receive','link_case'].includes(b.mode))fail('شناسه، مرحله و تأیید معتبر لازم است.');
 const db=storage(),mid=await memberId(u),now=new Date().toISOString(),signature=JSON.stringify(b),prior:any=await db.prepare('SELECT actor,payload FROM inventory_operations WHERE id=?').bind(b.id).first();
 if(prior){if(prior.actor!==u.userId||prior.payload!==signature)fail('شناسه برای درخواست دیگری استفاده شده است.',409);return {saved:true,repeated:true,id:b.receiptId||b.id}}
 let old:any=null,id=b.receiptId||b.id,data:any;const checks=await salesLock(db,b.id),extra:D1PreparedStatement[]=[];
 if(b.mode==='create'){
  if(!transportDriver(u)&&!u.isAdmin)fail('ثبت دریافت با راننده است.',403);
  const domain=allowedDomain(b.domain),day=sday(b.day);if(day>dayAt())fail('تاریخ دریافت در آینده نیست.');let missionId='',caseId='';
  if(b.missionId){const mission=await transportAccess(u,sreq(b.missionId));if(!u.isAdmin&&!transportDriverCanAct(u,mission,mid))fail('مأموریت متعلق به راننده نیست.',403);if(mission.data.kind!=='as_case'||!mission.data.inbound||mission.data.domain!==domain||['cancelled','delivered'].includes(mission.data.state))fail('مأموریت دریافت دستگاهِ همین حوزه لازم است.');missionId=mission.id;caseId=mission.data.sourceId||'';checks.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN guard ELSE 0 END WHERE id=?').bind(mission.id,mission.revision,b.id))}
  data={domain,code:'DR-'+b.id.slice(0,8).toUpperCase(),day,sender:sreq(b.sender,200),phone:sreq(b.phone,50),carrier:sreq(b.carrier,200),waybill:sreq(b.waybill,200),serial:b.serial?normalizeSerial(sreq(b.serial,160)):'',model:optional(b.model,200),condition:sreq(b.condition,2000),accessories:optional(b.accessories,2000),missionId,caseId,state:'with_driver',driverId:mid,driverName:u.name,createdBy:u.userId,history:[{mode:'create',actor:u.userId,at:now}]};
 }else{
  old=await driverReceiptAccess(u,sreq(b.receiptId));data={...old.data,history:[...(old.data.history||[])]};if(!canReceiveDriverReceipt(u,data.domain))fail('تأیید تحویل با پذیرش همین حوزه است.',403);if(old.revision!==b.revision)fail('رسید تغییر کرده است؛ بازخوانی کنید.',409);
  if(b.mode==='receive'){if(data.state!=='with_driver')fail('دستگاه قبلاً تحویل پذیرش شده است.',409);if(b.physicallyReceived!==true)fail('دریافت فیزیکی را تأیید کنید.');data.state=data.caseId?'linked':'received_office';data.receivedBy=u.userId;data.receivedAt=now;data.receivedDay=dayAt();data.receiveNotes=optional(b.notes,2000)}
  else {if(data.state!=='received_office'||data.caseId)fail('ابتدا دریافت فیزیکیِ رسید بدون پرونده تأیید شود.',409);const c=await entity(sreq(b.caseId),'as_case');if(c.data.domain!==data.domain||['closed','resolved','returned'].includes(c.data.state)||data.serial&&data.serial!==c.data.serial)fail('پرونده با حوزه یا سریال رسید سازگار نیست.');data.caseId=c.id;data.state='linked';checks.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN guard ELSE 0 END WHERE id=?').bind(c.id,c.revision,b.id))}
  if(data.caseId){const c=await entity(data.caseId,'as_case');if(c.data.domain!==data.domain)fail('حوزهٔ پرونده با رسید متفاوت است.',409);checks.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN guard ELSE 0 END WHERE id=?').bind(c.id,c.revision,b.id));extra.push(db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify({...c.data,transportReceiptId:c.data.transportReceiptId||id,transportReceiptIds:[...new Set([...(c.data.transportReceiptIds||[]),...(c.data.transportReceiptId?[c.data.transportReceiptId]:[]),id])],physicalArrival:{day:data.receivedDay||dayAt(),by:data.receivedBy,driverReceiptId:id}}),now,c.id,c.revision));}
  data.history.push({mode:b.mode,actor:u.userId,at:now,caseId:data.caseId||'',notes:optional(b.notes,2000)});
  checks.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN guard ELSE 0 END WHERE id=?').bind(old.id,old.revision,b.id));
 }
 if(!old&&data.serial){const exists:any=await db.prepare("SELECT COUNT(*) n FROM flow_entities WHERE type='transport_receipt' AND json_extract(data,'$.domain')=? AND json_extract(data,'$.serial')=? AND json_extract(data,'$.state') IN ('with_driver','received_office')").bind(data.domain,data.serial).first();if(exists.n)fail('برای این سریال، رسیدِ هنوز تعیین‌تکلیف‌نشده وجود دارد.',409);checks.push(db.prepare("UPDATE inventory_operations SET guard=CASE WHEN NOT EXISTS(SELECT 1 FROM flow_entities WHERE type='transport_receipt' AND json_extract(data,'$.domain')=? AND json_extract(data,'$.serial')=? AND json_extract(data,'$.state') IN ('with_driver','received_office')) THEN guard ELSE 0 END WHERE id=?").bind(data.domain,data.serial,b.id));}
 extra.push(old?db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(data),now,id,old.revision):db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'transport_receipt',?,1,?,?)").bind(id,JSON.stringify(data),now,now));
 await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'driver_receipt',?,?,?,1)").bind(b.id,signature,u.userId,now),...checks,...extra,db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,id,'driver_receipt_'+b.mode,JSON.stringify({mode:b.mode,state:data.state,caseId:data.caseId||''}),now)]);return {saved:true,id,state:data.state};
}
