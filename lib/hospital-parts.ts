import {AccessError} from './authorization';
import {storage} from './storage';
import {hospitalInventory,hospitalLogistics,hospitalTech,hreq,htext,hrow} from './hospital';
import {memberId,dayAt} from './duties';
import {integer} from './sales';
import type {Session} from './permissions';
const fail=(message:string,status=400):never=>{throw new AccessError(message,status)};
export const hospitalPartStates:Record<string,string>={requested:'منتظر بررسی دفتر خدمات',approved:'تأییدشده؛ منتظر حواله انبار',rejected:'ردشده',issued:'حواله صادرشده؛ منتظر ارسال',shipped:'ارسال‌شده؛ منتظر تأیید تکنسین',received:'تحویل تکنسین شد'};
// Quantities in the inventory ledger are thousandths; request quantities are whole units.
export async function hospitalPartStock(u:Session){
 if(!hospitalInventory(u)||!u.isAdmin&&!u.permissions.warehouses?.includes('raw'))return [];
 const db=storage();
 return (await db.prepare(`SELECT r.id,r.payload,i.quantity,s.location,s.quantity AS locationQuantity,
 COALESCE((SELECT SUM(h.quantity) FROM sourcing_holds h WHERE h.source_type='stock' AND h.source_id=r.id),0) held,
 COALESCE((SELECT SUM(v.quantity) FROM inventory_balances v WHERE v.item_id=r.id AND v.warehouse IN ('raw','line')),0) total
 FROM records r JOIN inventory_balances i ON i.item_id=r.id AND i.warehouse='raw'
 LEFT JOIN flow_slots s ON s.batch_id=r.id AND s.quantity>0
 WHERE r.kind='batch' AND i.quantity>0 AND json_extract(r.payload,'$.status')='تأیید'
 AND (COALESCE(json_extract(r.payload,'$.expiry'),'')='' OR json_extract(r.payload,'$.expiry')>=?)
 ORDER BY r.created,r.id,s.location`).bind(dayAt()).all()).results.map((r:any)=>{const p=JSON.parse(r.payload);return {batchId:r.id,code:p.code,partCode:p.partCode,unit:p.unit,expiry:p.expiry||'',location:r.location||'',available:Math.max(0,Math.min(r.quantity,r.locationQuantity??r.quantity,r.total-r.held))};});
}
type Context={u:Session;b:any;id:string;mode:string;db:D1Database;now:string;today:string;stmts:D1PreparedStatement[];touched:string[];guard:(sql:string,...args:any[])=>any;get:(id:string,type:string,revision?:boolean)=>Promise<any>;put:(id:string,type:string,data:any,old?:any)=>void};
export async function hospitalPartAction(c:Context){
 const {u,b,id,mode,db,now,today,stmts,touched,guard,get,put}=c;
 if(mode==='part_issue'&&!hospitalInventory(u)||mode==='part_ship'&&!hospitalLogistics(u)||mode==='part_receive'&&!hospitalTech(u))fail('مجوز این مرحله را ندارید.',403);
 const r=await get(hreq(b.requestId),'hospital_part_request',true),d={...r.data};
 const stage='hospital:staged:'+r.id,transit='hospital:transit:'+r.id,custody='hospital:technician:'+d.technicianId;
 const entry=(batch:string,wh:string,delta:number)=>{touched.push(batch);stmts.push(
  db.prepare('INSERT INTO inventory_balances(id,item_id,warehouse,quantity) VALUES(?,?,?,0) ON CONFLICT(id) DO NOTHING').bind(batch+'@'+wh,batch,wh),
  db.prepare('UPDATE inventory_balances SET quantity=quantity+? WHERE item_id=? AND warehouse=?').bind(delta,batch,wh),
  db.prepare('INSERT INTO inventory_entries(id,operation_id,item_id,warehouse,delta) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),id,batch,wh,delta));};
 const note={notes:hreq(b.notes,3000),by:u.userId,name:u.name,at:now};
 if(mode==='part_issue'){
  if(d.state!=='approved')fail('درخواست تأییدشده بدون حواله لازم است.');
  if(!u.isAdmin&&!u.permissions.warehouses?.includes('raw'))fail('مجوز برداشت انبار مواد اولیه لازم است.',403);
  const job=await get(d.jobId,'hospital_job');if(job.data.technicianId!==d.technicianId)fail('تکنسین مأموریت تغییر کرده؛ دفتر خدمات درخواست را بررسی کند.',409);
  const tech:any=await db.prepare("SELECT id,permissions FROM app_members WHERE id=? AND status='active'").bind(d.technicianId).first();
  if(!tech||!hospitalTech({isAdmin:false,permissions:JSON.parse(tech.permissions)} as Session))fail('تکنسین دریافت‌کننده فعال نیست.');
  guard("EXISTS(SELECT 1 FROM app_members WHERE id=? AND status='active' AND permissions=?)",tech.id,tech.permissions);
  const material=await hrow('material:'+hreq(d.partCode,12),'material');if(material.data.unit!=='عدد'||d.unit!=='عدد')fail('دفتر خدمات ابتدا کد قطعه با واحد عدد را تأیید کند.');
  guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',material.id,material.revision);
  if(!Array.isArray(b.allocations)||!b.allocations.length||b.allocations.length>30)fail('بچ و محل برداشت را انتخاب کنید.');
  const lines:any[]=[],keys=new Set<string>();let total=0;
  for(const v of b.allocations){
   const batchId=hreq(v.batchId),location=htext(v.location||'',100),quantity=integer(Number(v.quantity),1,10000),scaled=quantity*1000,key=batchId+'@'+location;
   if(keys.has(key))fail('بچ و محل تکراری را در یک ردیف ثبت کنید.');keys.add(key);total+=quantity;
   const batch:any=await db.prepare("SELECT payload FROM records WHERE id=? AND kind='batch'").bind(batchId).first();if(!batch)fail('بچ انتخاب‌شده پیدا نشد.');const p=JSON.parse(batch.payload);
   if(p.partCode!==d.partCode||p.unit!=='عدد'||p.status!=='تأیید'||p.expiry&&p.expiry<today)fail('بچ باید متعلق به قطعه تأییدشده، با واحد عدد، معتبر و قبول‌شده در کیفیت باشد.');
   guard('EXISTS(SELECT 1 FROM records WHERE id=? AND payload=?)',batchId,batch.payload);
   const located:any=await db.prepare("SELECT id,data,revision FROM flow_entities WHERE id=? AND type='receipt'").bind(batchId).first();
   if(located){const receipt=JSON.parse(located.data);if(receipt.state!=='stored'||receipt.expiry&&receipt.expiry<today)fail('محموله باید جانمایی‌شده و معتبر باشد.');guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',located.id,located.revision);}
   const slots=await db.prepare('SELECT batch_id FROM flow_slots WHERE batch_id=? LIMIT 1').bind(batchId).first();
   if(located||slots){if(!location)fail('محل برداشت این بچ الزامی است.');guard('EXISTS(SELECT 1 FROM flow_slots WHERE batch_id=? AND location=? AND quantity>=?)',batchId,location,scaled);stmts.push(db.prepare('UPDATE flow_slots SET quantity=quantity-? WHERE batch_id=? AND location=?').bind(scaled,batchId,location));}
   else if(location)fail('برای بچ بدون جانمایی، محل برداشت خالی باشد.');
   guard("EXISTS(SELECT 1 FROM inventory_balances WHERE item_id=? AND warehouse='raw' AND quantity>=?)",batchId,scaled);
   entry(batchId,'raw',-scaled);entry(batchId,stage,scaled);
   lines.push({batchId,batchCode:p.code,partCode:p.partCode,quantity,unit:'عدد',location});
  }
  if(total!==d.quantity)fail('جمع حواله باید برابر تعداد تأییدشده درخواست باشد.');
  d.state='issued';d.issue={...note,reference:id,lines};
 }else if(mode==='part_ship'){
  if(d.state!=='issued'||!d.issue?.lines?.length)fail('حواله آماده ارسال لازم است.');
  for(const l of d.issue.lines){entry(l.batchId,stage,-l.quantity*1000);entry(l.batchId,transit,l.quantity*1000);}
  d.state='shipped';d.shipment={...note,carrier:hreq(b.carrier,200),tracking:hreq(b.tracking,300)};
 }else{
  if(d.technicianId!==await memberId(u))fail('فقط تکنسین دریافت‌کننده همین درخواست مجاز به تأیید تحویل است.',403);
  if(d.state!=='shipped'||b.confirmedReceived!==true||!d.issue?.lines?.length)fail('ارسال ثبت‌شده و تأیید دریافت تمام اقلام لازم است.');
  for(const l of d.issue.lines){entry(l.batchId,transit,-l.quantity*1000);entry(l.batchId,custody,l.quantity*1000);}
  d.state='received';d.receipt={...note,confirmedReceived:true};
 }
 put(r.id,r.type,d,r);
}
