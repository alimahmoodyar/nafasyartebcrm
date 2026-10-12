import {storedAccessPermissions} from './permissions';
import {storage} from './storage';
import type {Session} from './permissions';
import {dayAt,memberId as activeMemberId} from './duties';
import {normalizeSerial} from './distribution';
import {fail,req,txt,isAgent,role,domainAccess,need,visible,entity,list,past,amount,warehouse,monthsAfter} from './after-sales';
import {supplyLock} from './sourcing';
import {partRepairActions} from './part-repair-contract';
import {selectRepresentativePartTariff,representativeTariffValue,servicePartTariffGuard} from './after-sales-pricing';
import {serviceSupervisor,domainWriteAccess} from './service-access';

const type='as_part_repair';
const modeRoles:Record<string,string[]>={create:['intake','coordinator'],assign:['coordinator'],work:['technician'],review:['coordinator'],consent:['coordinator','agent'],issue:['inventory'],ship:['intake','inventory','coordinator'],receive:['agent','coordinator']};
export function partRepairRead(u:Session,domain:string){return domainAccess(u,domain)&&(serviceSupervisor(u)||['intake','coordinator','technician','inventory','agent'].some(r=>role(u,r)));}
function memberId(u:Session){return u.userId.startsWith('local:')?u.userId.slice(6):u.userId;}
function allowed(u:Session,r:any,assignedId=memberId(u)){if(!domainAccess(u,r.data.domain))return false;if(isAgent(u))return r.data.agentId===u.permissions.serviceAgentId;
 if(serviceSupervisor(u))return true;
 if(role(u,'coordinator')||role(u,'intake'))return true;
 if(role(u,'inventory')&&['awaiting_stock','ready_send','shipped','closed'].includes(r.data.state))return true;
 return role(u,'technician')&&r.data.technicianId===assignedId;
}
export function partRepairModes(u:Session,r:any,assignedId=memberId(u)){const d=r.data;if(!domainWriteAccess(u,d.domain)||!allowed(u,r,assignedId))return [];
 const modes=d.state==='received'?['assign']:d.state==='working'?['assign','work']:d.state==='review'?['review']:d.state==='consent'?['consent']:d.state==='awaiting_stock'?['issue']:d.state==='ready_send'?['ship']:d.state==='shipped'?['receive']:[];
 return modes.filter(m=>modeRoles[m].some(x=>role(u,x))&&(m!=='work'||role(u,'manager')||d.technicianId===assignedId));
}
function publicRow(u:Session,r:any,assignedId:string){const d={...r.data};if(!domainWriteAccess(u,d.domain)||!role(u,'manager')&&!role(u,'inventory')){if(d.replacement){d.replacement={...d.replacement};delete d.replacement.unitCostRial;}}
 if(!isAgent(u)&&!role(u,'coordinator')&&!role(u,'intake')&&!role(u,'inventory')){if(d.review){d.review={...d.review};delete d.review.priceRial;}delete d.consent;delete d.freightRial;}
 return {...r,data:d,actions:partRepairModes(u,r,assignedId)};
}
export async function readPartRepairs(u:Session,domain:string,id=''){
 if(!partRepairRead(u,domain))fail('مجوز قطعات تعمیری این حوزه را ندارید.',403);
 if(isAgent(u))await visible(u,{data:{domain,agentId:u.permissions.serviceAgentId}});
 const assignedId=await activeMemberId(u);
 const all=(await list(type)).filter(r=>r.data.domain===domain&&allowed(u,r,assignedId)),rows=id?all.filter(r=>r.id===id):all;
 if(id&&!rows.length)fail('پروندهٔ قطعه پیدا نشد یا دسترسی ندارید.',404);
 const agents=(await list('as_agent')).filter(r=>r.data.domain===domain&&r.data.active&&(!isAgent(u)||r.id===u.permissions.serviceAgentId)&&(role(u,'coordinator')||role(u,'intake')||isAgent(u)||all.some(x=>x.data.agentId===r.id))).map(r=>({id:r.id,name:r.data.name}));
 const technicians=!isAgent(u)&&role(u,'coordinator')?(await storage().prepare("SELECT id,name,permissions FROM app_members WHERE status='active'").all()).results.filter((r:any)=>{const p=storedAccessPermissions(r.permissions);return !p.serviceAgentId&&p.serviceDomains?.includes(domain)&&p.serviceRoles?.includes('technician')}).map((r:any)=>({id:r.id,name:r.name})):[];
 const materials=!isAgent(u)&&(role(u,'coordinator')||role(u,'intake'))?(await list('material')).map(r=>({code:r.data.code,name:r.data.name})):[];
 const lots=role(u,'inventory')&&!isAgent(u)?(await storage().prepare("SELECT l.id,l.batch_id,l.quantity,r.payload,COALESCE((SELECT SUM(quantity) FROM service_reservations s WHERE s.lot_id=l.id),0) reserved FROM service_lots l JOIN records r ON r.id=l.batch_id WHERE l.owner='office' AND l.domain=? AND l.quantity>0").bind(domain).all()).results.map((r:any)=>{const p=JSON.parse(r.payload);return {id:r.id,partCode:p.partCode,name:p.part,code:p.code,free:r.quantity-r.reserved,status:p.status,expiry:p.expiry}}).filter(r=>r.free>=1000&&r.status==='تأیید'&&(!r.expiry||r.expiry>=dayAt())):[];
 return {domain,rows:rows.map(r=>publicRow(u,r,assignedId)),agents,technicians,materials,lots,canCreate:domainWriteAccess(u,domain)&&!isAgent(u)&&modeRoles.create.some(r=>role(u,r))};
}
export async function applyPartRepair(u:Session,b:any){
 const db=storage(),mode=req(b.mode),domain=req(b.domain),op=req(b.id),now=new Date().toISOString();
 if(!Object.hasOwn(modeRoles,mode)||!Object.hasOwn(partRepairActions,mode))fail('عملیات قطعه ناشناخته است.');
 need(u,domain,...modeRoles[mode]);const assignedId=await activeMemberId(u);if(b.confirmed!==true)fail('تأیید صریح ثبت لازم است.');
 if(!/^[a-f0-9-]{36}$/i.test(op))fail('شناسهٔ عملیات معتبر نیست.');
 const signature=JSON.stringify(b),oldOp:any=await db.prepare('SELECT actor,payload FROM inventory_operations WHERE id=?').bind(op).first();
 if(oldOp){if(oldOp.actor!==u.userId||oldOp.payload!==signature)fail('شناسهٔ عملیات تکراری است.',409);return {saved:true,repeated:true,id:b.repairId||op};}
 const statements:D1PreparedStatement[]=[],checks=await supplyLock(db,op);
 const guard=(test:string,...args:any[])=>checks.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN '+test+' THEN guard ELSE 0 END WHERE id=?').bind(...args,op));
 const a=await entity(req(b.agentId||((mode!=='create'?(await entity(req(b.repairId),type)).data.agentId:'') as string)),'as_agent');
 if(!a.data.active||a.data.domain!==domain||isAgent(u)&&a.id!==u.permissions.serviceAgentId)fail('نمایندهٔ مجاز این حوزه لازم است.',403);
 guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',a.id,a.revision);
 const old=mode==='create'?null:await entity(req(b.repairId),type),id=old?.id||op;
 if(old&&(!allowed(u,old,assignedId)||old.data.domain!==domain))fail('پروندهٔ قطعه پیدا نشد یا دسترسی ندارید.',404);
 if(old&&(b.revision!==old.revision||!partRepairModes(u,old,assignedId).includes(mode)))fail(b.revision!==old.revision?'پرونده تغییر کرده؛ تازه‌سازی کنید.':'مجوز این مرحله یا وضعیت پرونده مناسب نیست.',b.revision!==old.revision?409:403);
 if(old){if(a.id!==old.data.agentId)fail('نمایندهٔ پرونده قابل تغییر نیست.');guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',old.id,old.revision);}
 const d:any=old?JSON.parse(JSON.stringify(old.data)):{domain,agentId:a.id,agentName:a.data.name,state:'received',receiptCode:'PR-'+op.slice(0,8).toUpperCase(),createdBy:u.userId,history:[]};
 const after=(v:unknown,minimum:string)=>{const day=past(v);if(day<minimum)fail('تاریخ انجام پیش از مرحلهٔ قبلی است.');return day;};
 const stock=(batch:string,wh:string,delta:number)=>statements.push(db.prepare('INSERT INTO inventory_balances(id,item_id,warehouse,quantity) VALUES(?,?,?,0) ON CONFLICT(id) DO NOTHING').bind(batch+'@'+wh,batch,wh),db.prepare('UPDATE inventory_balances SET quantity=quantity+? WHERE item_id=? AND warehouse=?').bind(delta,batch,wh),db.prepare('INSERT INTO inventory_entries(id,operation_id,item_id,warehouse,delta) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),op,batch,wh,delta));
 if(mode==='create'){
  if(b.revision!==0)fail('برای دریافت جدید نسخهٔ صفر لازم است.');
  if(isAgent(u))fail('دریافت واقعی فقط توسط واحد خدمات ثبت می‌شود.',403);
  d.partName=req(b.partName);d.partCode=txt(b.partCode,100);d.serial=b.serial?normalizeSerial(req(b.serial,160)):'';
  if(!d.serial&&b.noSerial!==true)fail('سریال را بنویسید یا نداشتن سریال را مشخص کنید.');
  if(d.serial&&b.noSerial===true)fail('سریال و گزینهٔ بدون سریال هم‌زمان نیست.');
  d.noSerial=!d.serial;d.receivedDay=past(b.day);d.requestedAction=req(b.requestedAction);d.requestNotes=txt(b.requestNotes);
  if(!['repair','program','test'].includes(d.requestedAction))fail('اقدام مورد نیاز معتبر نیست.');
  if(d.partCode&&!(await list('material')).some(r=>r.data.code===d.partCode))fail('کد کالا پیدا نشد.');
  if(d.serial&&(await list(type)).some(r=>r.data.domain===domain&&r.data.agentId===a.id&&r.data.serial===d.serial&&r.data.state!=='closed'))fail('برای این سریال قبلاً پروندهٔ باز ثبت شده است.',409);
  if(d.serial)guard("NOT EXISTS(SELECT 1 FROM flow_entities WHERE type='as_part_repair' AND json_extract(data,'$.domain')=? AND json_extract(data,'$.agentId')=? AND json_extract(data,'$.serial')=? AND json_extract(data,'$.state')!='closed')",domain,a.id,d.serial);
 }else if(mode==='assign'){
  const t:any=await db.prepare("SELECT id,name,permissions FROM app_members WHERE id=? AND status='active'").bind(req(b.technicianId)).first(),p=t?storedAccessPermissions(t.permissions):storedAccessPermissions('{}');
  if(!t||p.serviceAgentId||!p.serviceDomains?.includes(domain)||!p.serviceRoles?.includes('technician'))fail('تکنسین فعال همین حوزه را انتخاب کنید.');
  guard("EXISTS(SELECT 1 FROM app_members WHERE id=? AND status='active' AND permissions=?)",t.id,t.permissions);
  d.technicianId=t.id;d.technicianName=t.name;d.state='working';
 }else if(mode==='work'){
  d.doneDay=after(b.day,d.receivedDay);d.performedActions=req(b.performedActions,4000);d.testResult=req(b.testResult,4000);d.outcome=req(b.outcome);
  if(!['ready','unrepairable'].includes(d.outcome))fail('نتیجهٔ تست معتبر نیست.');
  d.workBy=u.userId;d.state=d.outcome==='ready'?'ready_send':'review';
 }else if(mode==='review'){
  const decision=req(b.decision);if(!['return','replace'].includes(decision))fail('تصمیم معتبر نیست.');
  d.review={decision,reason:req(b.notes,4000),by:u.userId,byName:u.name,at:now};
  if(decision==='return'){d.originalDisposition='return';d.state='ready_send';}
  else{
   const code=req(b.replacementPartCode,100);if(!(await list('material')).some(r=>r.data.code===code))fail('قطعهٔ جایگزین معتبر لازم است.');
   const coverage=req(b.coverage);if(!['warranty','paid'].includes(coverage))fail('پوشش گارانتی مشخص شود.');
   const disposition=req(b.originalDisposition);if(!['hold','return'].includes(disposition))fail('تکلیف قطعهٔ قبلی مشخص شود.');
   d.originalDisposition=disposition;d.review.coverage=coverage;d.review.partCode=code;d.review.priceRial='0';
   if(coverage==='paid'){
    const day=dayAt(),tariff=selectRepresentativePartTariff(await list('as_tariff'),code,day,domain),price=tariff?representativeTariffValue(tariff):null;
    if(!tariff||price===null||BigInt(price)<=BigInt(0))fail('تعرفهٔ مصوب فروش قطعه به نماینده لازم است.');
    const check=servicePartTariffGuard(tariff,code,day,domain,'representative');guard(check.sql,...check.args);
    d.review.priceRial=price;d.review.tariffId=tariff.id;d.review.tariffRevision=tariff.revision;d.state='consent';
   }else d.state='awaiting_stock';
  }
 }else if(mode==='consent'){
  if(typeof b.approved!=='boolean')fail('پاسخ تأیید یا رد مشخص شود.');
  if(!['phone','written','message'].includes(b.method))fail('روش پاسخ معتبر نیست.');
  d.consent={approved:b.approved,person:req(b.person),method:b.method,notes:req(b.notes,4000),priceRial:d.review.priceRial,by:u.userId,at:now};
  d.state=b.approved?'awaiting_stock':'ready_send';if(!b.approved)d.originalDisposition='return';
 }else if(mode==='issue'){
  const lot:any=await db.prepare("SELECT l.*,r.payload,COALESCE((SELECT SUM(quantity) FROM service_reservations s WHERE s.lot_id=l.id),0) reserved FROM service_lots l JOIN records r ON r.id=l.batch_id WHERE l.id=?").bind(req(b.lotId)).first();
  const p=lot?JSON.parse(lot.payload):null;
  if(!lot||lot.owner!=='office'||lot.domain!==domain||lot.quantity-lot.reserved<1000||p.partCode!==d.review.partCode||p.status!=='تأیید'||p.expiry&&p.expiry<dayAt())fail('یک قطعهٔ آزاد و تأییدشده از انبار خدمات دفتر لازم است.');
  if(d.review.coverage==='paid'&&d.consent?.approved!==true)fail('پاسخ نماینده به هزینه ثبت نشده است.');
  guard("EXISTS(SELECT 1 FROM service_lots WHERE id=? AND owner='office' AND domain=? AND quantity-COALESCE((SELECT SUM(quantity) FROM service_reservations WHERE lot_id=?),0)>=1000)",lot.id,domain,lot.id);
  guard("EXISTS(SELECT 1 FROM records WHERE id=? AND payload=?)",lot.batch_id,lot.payload);
  guard('EXISTS(SELECT 1 FROM inventory_balances WHERE item_id=? AND warehouse=? AND quantity>=1000)',lot.batch_id,warehouse('office',domain));
  statements.push(db.prepare('UPDATE service_lots SET quantity=quantity-1000 WHERE id=?').bind(lot.id));
  stock(lot.batch_id,warehouse('office',domain),-1000);stock(lot.batch_id,'service:repair:'+id,1000);
  d.replacement={lotId:lot.id,batchId:lot.batch_id,batchCode:p.code,partCode:p.partCode,partName:p.part,serial:b.replacementSerial?normalizeSerial(req(b.replacementSerial,160)):'',unitCostRial:amount(lot.unit_rial),issuedAt:now,issuedBy:u.userId};
  if(d.review.coverage==='paid')statements.push(db.prepare('INSERT INTO service_ledger(id,agent_id,domain,kind,source_id,debit,credit,due,data,created,actor) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),a.id,domain,'invoice',id,d.review.priceRial,'0',monthsAfter(dayAt(),1),JSON.stringify({partRepairId:id,receiptCode:d.receiptCode,partCode:d.review.partCode,quantity:1000,tariffId:d.review.tariffId,notes:'قطعهٔ جایگزین با پذیرش مستند نماینده'}),now,u.userId));
  d.state='ready_send';
 }else if(mode==='ship'){
  d.sentDay=after(b.day,d.replacement?dayAt(new Date(d.replacement.issuedAt)):d.doneDay);d.carrier=req(b.carrier);d.shippingReference=req(b.reference);
  d.freightRial=b.freightRial===undefined||b.freightRial===''?null:amount(b.freightRial);d.sentBy=u.userId;d.state='shipped';
 }else if(mode==='receive'){
  d.deliveredDay=after(b.day,d.sentDay);d.receivedBy=req(b.person);d.receiptReference=req(b.reference);d.deliveryRecordedBy=u.userId;
  if(d.replacement){guard('EXISTS(SELECT 1 FROM inventory_balances WHERE item_id=? AND warehouse=? AND quantity>=1000)',d.replacement.batchId,'service:repair:'+id);stock(d.replacement.batchId,'service:repair:'+id,-1000);stock(d.replacement.batchId,warehouse(a.id,domain),1000);
   statements.push(db.prepare('INSERT INTO service_lots(id,owner,domain,batch_id,quantity,unit_rial,created) VALUES(?,?,?,?,1000,?,?)').bind(id+':replacement',a.id,domain,d.replacement.batchId,d.replacement.unitCostRial,now));}
  d.state='closed';
 }
 d.stageSince=now;d.history.push({mode,by:u.userId,byName:u.name,at:now,state:d.state,notes:txt(b.notes)});
 statements.push(old?db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(d),now,id,old.revision):db.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').bind(id,type,JSON.stringify(d),now,now));
 // Ledger, stock, stage, idempotency and audit commit or roll back together.
 await db.batch([db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(op,'part_repair_'+mode,signature,u.userId,now),...checks,...statements,db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,id,'part_repair_'+mode,signature,now)]);
 return {saved:true,id};
}
