import {returnTaskStatements} from './sales-return-tasks';
import type {Session} from './permissions';
import {storage} from './storage';
import {salesEntity,salesFail as fail,sreq as req,salesDecode,salesRows,salesVisible,salesLock,liveSalesUser} from './sales';
import {salesAccounts,rial} from './sales-contract';
import {dayAt} from './duties';
import {warehouseDirectory,warehouseMember} from './material-warehouses';
import {assertWarehouseNotCounting} from './stocktake-lock';
import {qmsDispatchGuard} from './qms-release';
import {returnRoles,returnActions,returnActionRoles,returnStatus,pendingReturnActions,refundAllocation,type ReturnAction} from './sales-return-contract';

export async function returnActor(u:Session){
 return u.isAdmin||u.profileReview?u:liveSalesUser(u);
}

export async function returnAccess(u:Session,row:any,mode?:ReturnAction){
 const roles=returnRoles(u),d=row.data;
 const buyer=await salesEntity(d.agentId,'sales_agent');
 const commercial=(roles.rep||roles.sales||roles.finance)&&await salesVisible(u,buyer);
 const internal=roles.service||roles.logistics||roles.technical||roles.factory||roles.line||roles.quality;
 if(!commercial&&!internal)fail('پرونده در دسترسی شما نیست.',404);
 if(roles.rep&&!buyer.data.active)fail('نمایندگی غیرفعال است.',403);
 if(mode&&!returnActionRoles[mode].some(key=>roles[key]&&(!['rep','sales','finance'].includes(key)||commercial)))
  fail('اقدام در دسترسی این کارتابل نیست.',403);
 return {roles,commercial,buyer};
}

export async function replacementState(d:any){
 if(!d.replacement)return undefined;
 const row=await storage().prepare("SELECT data FROM flow_entities WHERE id=? AND type='sale'").bind(d.replacement.saleId).first<{data:string}>();
 if(!row)return undefined;const sale=JSON.parse(row.data);return sale.state==='reserved'&&(sale.salesOrderId||sale.replacementReady)?'attached':sale.state as string;
}

export async function returnWorkspace(u:Session,id='',device=''){
 const db=storage(),roles=returnRoles(u);
 if(device){
  if(!u.isAdmin&&!u.permissions.read.includes('device'))fail('دسترسی شناسنامه دستگاه لازم است.',403);
  if(roles.rep||u.permissions.serviceAgentId)fail('دسترسی شناسنامه دستگاه لازم است.',403);
  const rows=(await db.prepare("SELECT * FROM flow_entities WHERE type='sales_return' AND json_extract(data,'$.deviceIds[0]')=? AND json_extract(data,'$.workflowVersion')=1 ORDER BY created DESC").bind(device).all()).results.map(salesDecode);
  return {history:await Promise.all(rows.map(async row=>{
   const d=row.data;
   return {id:row.id,serial:d.serials[0],reason:d.reason,openedAt:row.created,status:returnStatus(d,await replacementState(d)),serviceReport:d.inspection?.report,technicalResult:d.technical?.action,repairs:d.repairs||[],quality:d.quality||[],restockedAt:d.restockedAt};
  }))};
 }
 if(!Object.values(roles).some(Boolean))fail('دسترسی به کارتابل مرجوعی ندارید.',403);
 const rows=(await db.prepare("SELECT * FROM flow_entities WHERE type='sales_return' AND json_extract(data,'$.workflowVersion')=1 AND (?='' OR id=?) ORDER BY updated DESC").bind(id,id).all()).results.map(salesDecode);
 const items=[];
 for(const row of rows){
  let access;
  try{access=await returnAccess(u,row);}catch(error){if((error as {status?:number}).status===404)continue;throw error;}
  const d=row.data,state=await replacementState(d);
  const actions=pendingReturnActions(d,state).filter(a=>returnActionRoles[a].some(k=>roles[k]&&(!['rep','sales','finance'].includes(k)||access.commercial)));
  if(roles.factory&&!u.isAdmin&&d.factoryWarehouseId){
   const w=(await warehouseDirectory()).find(w=>w.id===d.factoryWarehouseId&&w.data.active);
   if(!w||!warehouseMember(u,w,'inventory'))for(const a of ['factory','line','pack']){const i=actions.indexOf(a as ReturnAction);if(i>=0)actions.splice(i,1);}
  }
  if(!access.commercial&&!roles.service&&!roles.technical&&!actions.length&&!id)continue;
  items.push({id:row.id,revision:row.revision,serial:d.serials[0],deviceId:d.deviceIds[0],invoiceId:d.invoiceId,buyer:access.buyer.data.name,agentId:d.agentId,reason:d.reason,resolution:d.resolution,status:returnStatus(d,state),intake:d.intake,deviceStage:d.deviceStage,
   waybill:d.waybill,inspection:d.inspection,technical:d.technical?{action:d.technical.action,...(roles.technical?{personnel:d.technical.personnel}:{})}:undefined,
   settlement:access.commercial?d.settlement:undefined,replacement:access.commercial?d.replacement:undefined,actions});
 }
 const warehouses=roles.factory?(await warehouseDirectory()).filter(w=>w.data.active&&w.data.warehouseType==='storage'&&warehouseMember(u,w,'inventory')).map(w=>({id:w.id,name:w.data.name})):[];
 return {items,warehouses};
}

export async function applyReturnAction(u:Session,b:any){
 const mode=req(b.mode) as ReturnAction,id=req(b.id,80),returnId=req(b.returnId);
 if(!Object.hasOwn(returnActions,mode)||!/^[0-9a-f-]{36}$/i.test(id)||b.confirmed!==true)fail('اقدام معتبر و تأیید لازم است.');
 const db=storage(),row=await salesEntity(returnId,'sales_return'),access=await returnAccess(u,row,mode);
 if(row.data.workflowVersion!==1)fail('این پرونده از روال قبلی استفاده می‌کند.',409);
 const signature=JSON.stringify(b),prior=await db.prepare('SELECT actor,payload FROM inventory_operations WHERE id=?').bind(id).first<{actor:string;payload:string}>();
 if(prior){if(prior.actor!==u.userId||prior.payload!==signature)fail('شناسه عملیات قبلاً استفاده شده است.',409);return {saved:true,repeated:true};}
 const lock=await salesLock(db,id);
 if(row.revision!==b.revision||!pendingReturnActions(row.data,await replacementState(row.data)).includes(mode))fail('وضعیت پرونده تغییر کرده است؛ تازه‌سازی کنید.',409);
 const d={...row.data},now=new Date().toISOString(),did=d.deviceIds[0],serial=d.serials[0],writes:D1PreparedStatement[]=[],guards:D1PreparedStatement[]=[];
 const guard=(condition:string,...args:any[])=>guards.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN '+condition+' THEN guard ELSE 0 END WHERE id=?').bind(...args,id));
 const protect=(r:any)=>guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',r.id,r.revision);
 const update=(r:any,value:any)=>{protect(r);writes.push(db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=?').bind(JSON.stringify(value),now,r.id));};
 const insert=(key:string,type:string,data:any)=>writes.push(db.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').bind(key,type,JSON.stringify(data),now,now));
 const actor={by:u.userId,at:now};
 const scanned=()=>{if(req(b.serial,200)!==serial)fail('سریال اسکن‌شده با پرونده منطبق نیست.',409);};
 const stageEvent=(stage:string,notes:string)=>writes.push(db.prepare("INSERT INTO records(id,kind,payload,created) VALUES(?,'event',?,?)").bind(crypto.randomUUID(),JSON.stringify({device:did,stage,date:dayAt(),operator:u.name,operationId:id,returnId,notes}),now));
 async function transfer(from:string,to:string,buildState:string,warehouseId?:string){
  const build=await salesEntity(did,'build');protect(build);
  for(const wid of new Set([build.data.warehouseId,warehouseId].filter(Boolean))){
   await assertWarehouseNotCounting(db,wid);
   guard("NOT EXISTS(SELECT 1 FROM flow_entities WHERE type='inventory_count' AND json_extract(data,'$.kind')='annual' AND json_extract(data,'$.warehouseId')=? AND json_extract(data,'$.state') IN ('counting','review','awaiting_reopen'))",wid);
  }
  if(from==='delivered'&&(build.data.state!=='delivered'||build.data.saleId!==d.sourceSaleId))fail('دستگاه در وضعیت تحویل‌شده نیست.',409);
  for(const [warehouse,delta] of [[from,-1000],[to,1000]] as const){
   if(warehouse==='delivered'&&delta<0&&!await db.prepare("SELECT 1 FROM inventory_balances WHERE item_id=? AND warehouse='delivered' AND quantity<>0").bind(did).first()){
    guard("NOT EXISTS(SELECT 1 FROM inventory_balances WHERE item_id=? AND warehouse='delivered' AND quantity<>0)",did);continue;
   }
   if(delta<0)guard('EXISTS(SELECT 1 FROM inventory_balances WHERE item_id=? AND warehouse=? AND quantity=1000)',did,warehouse);
   else guard('NOT EXISTS(SELECT 1 FROM inventory_balances WHERE item_id=? AND warehouse=? AND quantity<>0)',did,warehouse);
   writes.push(db.prepare('INSERT INTO inventory_balances(id,item_id,warehouse,quantity) VALUES(?,?,?,0) ON CONFLICT(id) DO NOTHING').bind(did+'@'+warehouse,did,warehouse),
    db.prepare('UPDATE inventory_balances SET quantity=quantity+? WHERE item_id=? AND warehouse=?').bind(delta,did,warehouse),
    db.prepare('INSERT INTO inventory_entries(id,operation_id,item_id,warehouse,delta) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),id,did,warehouse,delta));
  }
  update(build,{...build.data,state:buildState,returnId,warehouseId:warehouseId??build.data.warehouseId,...(to==='finished'?{saleId:null,recipient:null,customerName:'',customerMobile:'',customerAddress:'',customerNationalId:'',receivedAt:now,receivedBy:u.name}:{} )});
 }
 async function factoryWarehouse(id:string){
  const w=(await warehouseDirectory()).find(w=>w.id===id&&w.data.active&&w.data.warehouseType==='storage'&&warehouseMember(u,w,'inventory'));
  if(!w)fail('انبار کارخانه در محدوده مسئولیت شما نیست.',403);
  protect(w);
  return w;
 }
 protect(access.buyer);
 if(mode==='review'){
  if(typeof b.approved!=='boolean')fail('نتیجه بررسی را انتخاب کنید.');
  d.precheck={...actor,report:req(b.notes,4000),approved:b.approved};
  d.intake=b.approved?'approved':'rejected';
  if(!b.approved)d.state='rejected';
 }else if(mode==='waybill'){
  scanned();
  const file=await salesEntity(req(b.fileId),'sales_file');
  if(file.data.agentId!==d.agentId||file.data.returnId!==row.id)fail('پیوست بارنامه متعلق به این پرونده نیست.',404);
  protect(file);
  d.waybill={...actor,number:req(b.reference,200),fileId:file.id,filename:file.data.filename};
  d.intake='shipment';
 }else if(mode==='pickup'){
  scanned();
  d.pickup={...actor,reference:req(b.reference,200)};
  d.intake='at_service';
  await transfer('delivered','sales_return_service','sales_return_service');
  stageEvent('دریافت مرجوعی در خدمات پس از فروش','تحویل سریال از باربری');
 }else if(mode==='inspect'){
  scanned();
  if(typeof b.approved!=='boolean')fail('نتیجه بررسی را مشخص کنید.');
  d.inspection={...actor,report:req(b.notes,4000),confirmed:b.approved};
  d.intake=b.approved?'inspected':'handback';
  d.deviceStage='at_service';
  stageEvent('بررسی حضوری مرجوعی',d.inspection.report);
 }else if(mode==='handback'){
  scanned();
  d.handback={...actor,reference:req(b.reference,200)};
  await transfer('sales_return_service','delivered','delivered');
  d.deviceStage='returned_to_buyer';d.intake='rejected';d.state='rejected';
  stageEvent('تحویل مجدد دستگاه به نماینده',d.handback.reference);
 }else if(mode==='technical'){
  d.technical={...actor,action:req(b.notes,4000),personnel:typeof b.personnel==='string'?b.personnel.trim().slice(0,4000):''};
 }else if(mode==='factory'){
  scanned();
  const w=await factoryWarehouse(req(b.warehouseId));
  await transfer('sales_return_service','sales_return_factory','sales_return_factory',w.id);
  d.factoryWarehouseId=w.id;
  d.deviceStage='factory';
  stageEvent('دریافت مرجوعی در انبار کارخانه',w.data.name);
 }else if(mode==='line'){
  scanned();await factoryWarehouse(d.factoryWarehouseId);
  await transfer('sales_return_factory','sales_return_line','sales_return_line',d.factoryWarehouseId);
  d.deviceStage='line';
  stageEvent('ارجاع مرجوعی به خط تولید','');
 }else if(mode==='repair'){
  const repair={...actor,part:req(b.part,200),method:req(b.method,20),report:req(b.notes,4000)};
  if(!['repair','replace'].includes(repair.method))fail('تعمیر یا تعویض قطعه را انتخاب کنید.');
  d.repairs=[...(d.repairs||[]),repair];d.deviceStage='repaired';
  stageEvent('تعمیر دستگاه برگشتی',repair.part+' · '+repair.report);
 }else if(mode==='quality'){
  if(typeof b.approved!=='boolean')fail('نتیجه کنترل کیفیت را انتخاب کنید.');
  const quality={...actor,passed:b.approved,report:req(b.notes,4000)};
  d.quality=[...(d.quality||[]),quality];d.deviceStage=b.approved?'passed':'line';
  stageEvent('کنترل کیفیت دستگاه برگشتی',quality.report);
 }else if(mode==='pack'){
  scanned();await factoryWarehouse(d.factoryWarehouseId);
  if(b.packed!==true)fail('بسته‌بندی و برچسب سریال را تأیید کنید.');
  await transfer('sales_return_line','finished','finished',d.factoryWarehouseId);
  d.deviceStage='sellable';d.restockedAt=now;
  stageEvent('برگشت دستگاه به موجودی قابل فروش','بسته‌بندی و سریال کنترل شد.');
 }else if(mode==='settle'){
  const account=salesAccounts(await salesRows(),d.agentId,dayAt());
  const settlement=refundAllocation(account.invoices,rial(d.amount));
  for(const [index,a] of settlement.allocations.entries())insert(id+':'+index,'sales_allocation',{...a,agentId:d.agentId,creditId:row.id,by:u.userId,policy:'sales_return'});
  d.settlement={...actor,offset:settlement.offset,payable:settlement.payable};
  d.state='credited';d.reviewedAt=now;
 }else if(mode==='refund'){
  if(req(b.paidAmount,18)!==d.settlement.payable)fail('مبلغ پرداخت ثبت‌شده باید برابر ماندهٔ قابل پرداخت باشد.');
  d.settlement={...d.settlement,paidAt:now,paidBy:u.userId,paymentReference:req(b.reference,200)};
 }else if(mode==='reserve'){
  const candidates=(await db.prepare("SELECT f.* FROM flow_entities f JOIN records r ON r.id=f.id JOIN inventory_balances b ON b.item_id=f.id AND b.warehouse='finished' AND b.quantity=1000 WHERE f.type='build' AND json_extract(f.data,'$.state')='finished' AND json_extract(r.payload,'$.product')=? AND f.id<>? ORDER BY json_extract(f.data,'$.receivedAt'),f.id").bind(d.lines[0].productId,did).all()).results.map(salesDecode);
  let selected;
  for(const candidate of candidates){
   try{guards.push(await qmsDispatchGuard(candidate.id,id));selected=candidate;break;}catch(error){if((error as {status?:number}).status!==409)throw error;}
  }
  if(!selected)fail('دستگاه سالم از همین مدل هنوز در انبار قابل رزرو نیست.',409);
  const a=access.buyer.data,recipient={name:a.name,phone:a.phone||a.mobile||'',address:a.address||'',kind:a.kind,salesAgentId:d.agentId};
  insert(id,'sale',{salesOrderId:'',replacementReturnId:row.id,replacementReady:false,salesAgentId:d.agentId,partyId:d.agentId,productId:d.lines[0].productId,invoiceId:'',deliveryMode:'sale',recipient,deviceIds:[selected.id],count:1,state:'reserved',by:u.name,actor:u.userId,notes:'جایگزین مرجوعی',handedOverDeviceIds:[]});
  update(selected,{...selected.data,state:'reserved',saleId:id});
  d.replacement={...actor,saleId:id,deviceId:selected.id};
 }else if(mode==='dispatch'){
  const sale=await salesEntity(d.replacement.saleId,'sale');
  if(sale.data.salesOrderId||sale.data.state!=='reserved')fail('رزرو قابل ارسال جداگانه نیست.',409);
  update(sale,{...sale.data,replacementReady:true});
  d.replacement={...d.replacement,separate:true};
 }
 update(row,d);
 const nextSaleState=mode==='reserve'?'reserved':mode==='dispatch'?'attached':await replacementState(d);
 writes.push(...await returnTaskStatements(row.id,d,access.buyer.data,nextSaleState));
 writes.push(db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,row.id,'sales_return_'+mode,JSON.stringify({mode,intake:d.intake,deviceStage:d.deviceStage}),now));
 try{
  await db.batch([db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(id,'sales_return_'+mode,signature,u.userId,now),...lock,...guards,...writes]);
 }catch(error){
  if(/guard|constraint/i.test(String(error)))fail('پرونده یا موجودی تغییر کرده است؛ تازه‌سازی کنید.',409);
  throw error;
 }
 return {saved:true};
}
