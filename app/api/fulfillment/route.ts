import {splitShippingPackages} from '@/lib/shipping-packages';
import {withServiceRolePreview} from '@/lib/service-role-preview';
import {dispatchInstallments} from '@/lib/sales-dispatch-terms';
import {list} from '@/lib/after-sales';
import {annualCountMovementStatements,assertWarehouseNotCounting,type CountMovement} from '@/lib/stocktake-lock';
import {warehouseDirectory,warehouseMember} from '@/lib/material-warehouses';
import {captureForm} from '@/lib/form-control';
import {storedAccessPermissions} from '@/lib/permissions';
import {qmsDispatchGuard} from '@/lib/qms-release';
import {scanSalesMonitor} from '@/lib/sales-monitor';
import {syncSalesTasks} from '@/lib/sales-tasks';
import {salesRep,salesStaff,salesLock} from '@/lib/sales';
import {storage} from '@/lib/storage';
import {requireAccess,checkOrigin,AccessError,accessResponse} from '@/lib/authorization';
import {flowRole,warehouseAccess,entity} from '@/lib/material-flow';
import {boundedBody} from '@/lib/firmware-storage';
import {tehranDay} from '@/lib/serials';
import {shortageRoles,shortageActions,canActOnShortage,handoffHasOpenWork,type Shortage,type ShortageAction} from '@/lib/handoff-shortage';
const fail=(m:string,s=400):never=>{throw new AccessError(m,s)};
const text=(v:unknown,max=200)=>{if(typeof v!=='string'||v.length>max)fail('متن معتبر نیست.');return (v as string).trim()};
const needed=(v:unknown,max=200)=>{const s=text(v,max);if(!s)fail('فیلد الزامی خالی است.');return s};
const ids=(v:unknown)=>{if(!Array.isArray(v)||!v.length||v.length>100||new Set(v).size!==v.length)fail('بین ۱ تا ۱۰۰ سریال غیرتکراری انتخاب کنید.');return (v as unknown[]).map(x=>needed(x));};
const json=(v:unknown)=>Response.json(v,{headers:{'Cache-Control':'no-store'}});
async function get(){try{
 const u=await requireAccess(),production=flowRole(u,'production'),inventory=warehouseAccess(u,'finished'),sales=salesStaff(u)||salesRep(u),logistics=flowRole(u,'logistics');
 const shortage=shortageRoles(u);
 if(!production&&!inventory&&!sales&&!logistics&&!Object.values(shortage).some(Boolean))fail('دسترسی محصول نهایی ندارید.',403);
 const db=storage(),physical=await warehouseDirectory(),ownIds=new Set(physical.filter(w=>w.data.active&&warehouseMember(u,w,'inventory')).map(w=>w.id)),all=(await db.prepare("SELECT * FROM flow_entities WHERE type IN ('build','handoff','sale','sales_order','print','finaltest') ORDER BY created DESC,id DESC").all()).results.map(entity);
 const records=(await db.prepare("SELECT id,kind,payload FROM records WHERE kind IN ('device','product')").all()).results.map((r:any)=>({id:r.id,kind:r.kind,data:JSON.parse(r.payload)}));
 const handoffs=all.filter(e=>e.type==='handoff'&&(production||inventory&&(!e.data.warehouseId||ownIds.has(e.data.warehouseId))||Object.values(e.data.shortages||{}).some(s=>canActOnShortage(shortage,(s as Shortage).stage))));
 const shortageDeviceIds=new Set(handoffs.flatMap(h=>Object.keys(h.data.shortages||{})));
 const rows=records.filter((r:any)=>r.kind==='product'||production||inventory||sales||shortageDeviceIds.has(r.id)||all.some(e=>e.type==='sale'&&e.data.deviceIds?.includes(r.id)&&['local:'+e.data.carrierId,e.data.carrierSubject].includes(u.userId)));
 const prints=new Set(all.filter(e=>e.type==='print').map(e=>e.data.planId));
 const builds=all.filter(e=>e.type==='build').filter(e=>production||inventory&&(!e.data.warehouseId||ownIds.has(e.data.warehouseId))||sales&&['finished','reserved','in_transit','consigned','delivered'].includes(e.data.state)).map(e=>{
 const legacy=all.find(t=>t.type==='finaltest'&&t.data.deviceId===e.id&&t.data.buildRevision===e.revision);
 return {id:e.id,revision:e.revision,created:e.created,data:{...e.data,latestQc:e.data.latestQc===undefined&&legacy?{verdict:legacy.data.verdict,by:legacy.data.by,reportId:legacy.data.reportId}:e.data.latestQc},printRecorded:prints.has(e.data.planId)};});
 const members=(await db.prepare("SELECT id,name,subject,permissions FROM app_members WHERE status='active'").all()).results.map((m:any)=>({id:m.id,name:m.name,subject:m.subject,permissions:storedAccessPermissions(m.permissions)}));
 const salesVisible=all.filter(e=>e.type==='sale'&&(!e.data.replacementReturnId||e.data.replacementReady)&&(!inventory||!e.data.salesOrderId||!all.some(order=>order.id===e.data.salesOrderId&&order.data.securedPolicy&&order.data.state!=='approved'))&&(inventory||salesStaff(u)||salesRep(u)&&e.data.salesAgentId===u.permissions.salesAgentId||logistics&&['local:'+e.data.carrierId,e.data.carrierSubject].includes(u.userId)));
 const orderVisible=all.filter(e=>e.type==='sales_order'&&e.data.state==='approved'&&(inventory||salesStaff(u)||salesRep(u)&&e.data.agentId===u.permissions.salesAgentId));
 return json({warehouses:physical.filter(w=>w.data.active&&(production||warehouseMember(u,w,'inventory'))).map(w=>({id:w.id,name:w.data.name,canReceive:warehouseMember(u,w,'inventory')})),builds,rows,handoffs,sales:salesVisible,orders:orderVisible.map(e=>({id:e.id,created:e.created,data:{code:e.data.code,agentId:e.data.agentId,recipient:e.data.recipient,lines:e.data.lines,deliveryMode:e.data.deliveryMode}})),carriers:inventory?members.filter(m=>(m.permissions.flowRoles?.includes('logistics')||m.permissions.transportRoles?.includes('driver'))).map(m=>({id:m.id,name:m.name})):[],roles:{production,inventory,sales,logistics,shortage}});
 }catch(e){return accessResponse(e)||Response.json({error:'دریافت کارتابل محصول نهایی انجام نشد.'},{status:503})}}
async function post(request:Request){try{
 checkOrigin(request);const u=await requireAccess(),b=JSON.parse(new TextDecoder().decode(await boundedBody(request,128000))),id=needed(b.id),mode=needed(b.mode),db=storage(),now=new Date().toISOString();
 if(!/^[a-f0-9-]{36}$/i.test(id))fail('شناسه عملیات معتبر نیست.');
 const shortage=shortageRoles(u);
 const allowed=mode==='shortage_action'?Object.values(shortage).some(Boolean):mode==='handoff'||mode==='cancel_handoff'?flowRole(u,'production'):['receive','dispatch','pack'].includes(mode)?warehouseAccess(u,'finished'):['reserve','cancel_sale'].includes(mode)?salesStaff(u):mode==='handover'?salesStaff(u)||salesRep(u):mode==='acknowledge'?flowRole(u,'logistics'):false;
 if(!allowed)fail('مجوز این عملیات یا انبار را ندارید.',403);
 const signature=JSON.stringify(b),prior:any=await db.prepare('SELECT payload,actor FROM inventory_operations WHERE id=?').bind(id).first();if(prior){if(prior.payload!==signature||prior.actor!==u.userId)fail('شناسه تکراری با درخواست متفاوت.',409);return json({saved:true,repeated:true});}
 const statements:D1PreparedStatement[]=[],checks:D1PreparedStatement[]=await salesLock(db,id);
 const guard=(q:string,...args:any[])=>checks.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN '+q+' THEN 1 ELSE 0 END WHERE id=?').bind(...args,id));
 async function get(eid:string,type:string){const r:any=await db.prepare('SELECT * FROM flow_entities WHERE id=? AND type=?').bind(eid,type).first();if(!r)fail('رکورد پیدا نشد.',404);guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',r.id,r.revision);return entity(r)}
 const put=(eid:string,type:string,data:any,old?:any)=>statements.push(old?db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(data),now,eid,old.revision):db.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').bind(eid,type,JSON.stringify(data),now,now));
 const countMovements:CountMovement[]=[];
 const entry=(item:string,warehouse:string,delta:number)=>{countMovements.push({itemId:item,stage:warehouse,delta});const bid=item+'@'+warehouse;statements.push(db.prepare('INSERT INTO inventory_balances(id,item_id,warehouse,quantity) VALUES(?,?,?,0) ON CONFLICT(id) DO NOTHING').bind(bid,item,warehouse),db.prepare('UPDATE inventory_balances SET quantity=quantity+? WHERE id=?').bind(delta,bid),db.prepare('INSERT INTO inventory_entries(id,operation_id,item_id,warehouse,delta) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),id,item,warehouse,delta));};
 const event=(device:string,stage:string,extra:any={})=>statements.push(db.prepare("INSERT INTO records(id,kind,payload,created) VALUES(?,'event',?,?)").bind(crypto.randomUUID(),JSON.stringify({device,stage,date:tehranDay(),operator:u.name,operationId:id,...extra}),now));
 async function device(did:string){const r:any=await db.prepare("SELECT payload FROM records WHERE id=? AND kind='device'").bind(did).first();if(!r)fail('دستگاه یافت نشد.');return JSON.parse(r.payload)}
 async function passed(build:any){if(build.data.latestQc!==undefined){if(build.data.latestQc?.verdict!=='pass')fail('کنترل کیفیت معتبر و قبول‌شده لازم است.');return build.data.latestQc;}
 const tests=(await db.prepare("SELECT * FROM flow_entities WHERE type='finaltest' AND json_extract(data,'$.deviceId')=? ORDER BY created DESC,id DESC").bind(build.id).all()).results.map(entity),test=tests[0];if(!test||test.data.buildRevision!==build.revision||test.data.verdict!=='pass')fail('کنترل کیفیت معتبر و قبول‌شده لازم است.');return {reportId:test.data.reportId,verdict:'pass',by:test.data.by};}
 if(mode==='handoff'){
 const directory=await warehouseDirectory(),destination=directory.find(w=>w.id===b.warehouseId&&w.data.active);if(directory.length&&!destination)fail('انبار مقصد محصول را انتخاب کنید.');if(destination)guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',destination.id,destination.revision);
 const deviceIds=ids(b.deviceIds);if(b.packaged!==true)fail('بسته‌بندی و نصب برچسب دستگاه‌ها را تأیید کنید.');
 for(const did of deviceIds){const build=await get(did,'build');if(build.data.state!=='assembled')fail('سریال آماده تحویل نیست یا قبلاً ارجاع شده است.');const qc=await passed(build);if(build.data.workflowVersion>=3){if(!build.data.lineReceived||!build.data.materialsConsumed)fail('ابتدا انبار خط محصول بسته‌بندی‌شده را با اسکن دریافت کند.');entry(did,'line_finished',-1000);entry(did,'product_transit',1000);}
 if(!await db.prepare("SELECT id FROM flow_entities WHERE type='print' AND json_extract(data,'$.planId')=? LIMIT 1").bind(build.data.planId).first())fail('ابتدا چاپ برچسب این برنامه را ثبت کنید.');
 put(did,'build',{...build.data,latestQc:qc,state:'awaiting_receipt',handoffId:id,packagedAt:now},build);event(did,'ارجاع به انبار محصول نهایی',{notes:text(b.notes||'',4000)});}
 put(id,'handoff',{warehouseId:destination?.id||'',deviceIds,pending:deviceIds,received:[],state:'pending',by:u.name,actor:u.userId,notes:text(b.notes||'',4000),history:[]});
 }else if(mode==='receive'||mode==='cancel_handoff'){
 const h=await get(needed(b.handoffId),'handoff'),selected=mode==='receive'&&b.reportShortage===true&&Array.isArray(b.deviceIds)&&!b.deviceIds.length?[]:ids(b.deviceIds);if(h.data.state!=='pending'||!h.data.pending.length||selected.some(d=>!h.data.pending.includes(d)))fail('سریال انتخاب‌شده در انتظار این تحویل نیست.',409);
 if(mode==='receive'){
  const scans=Array.isArray(b.scannedCodes)?b.scannedCodes.map((v:unknown)=>needed(v)):[],expected=await Promise.all(selected.map(async did=>String((await device(did)).code)));
  if(scans.length!==expected.length||new Set(scans).size!==scans.length||expected.some(code=>!scans.includes(code)))fail('سریال روی همهٔ کارتن‌های رسیده را اسکن کنید.');
 }
 if(mode==='receive'&&h.data.warehouseId&&b.warehouseId&&h.data.warehouseId!==b.warehouseId)fail('انبار دریافت باید همان مقصد ثبت‌شدهٔ تحویل باشد.');let physical:any;const wid=h.data.warehouseId||b.warehouseId||'';if(mode==='receive'){const ws=await warehouseDirectory();physical=ws.find(w=>w.id===wid&&w.data.active);if(ws.length&&!physical)fail('انبار دریافت محصول را انتخاب کنید.');if(physical&&!warehouseMember(u,physical,'inventory'))fail('دریافت این انبار در مسئولیت شما نیست.',403);if(physical)await assertWarehouseNotCounting(db,physical.id);if(physical)guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',physical.id,physical.revision);}
 const notes=text(b.notes||'',4000);if(mode==='cancel_handoff'&&!notes)fail('علت بازگرداندن به خط تولید لازم است.');if(mode==='receive'&&selected.length<h.data.pending.length&&!notes)fail('علت تحویل جزئی را بنویسید.');
 for(const did of selected){const build=await get(did,'build');if(build.data.state!=='awaiting_receipt'||build.data.handoffId!==h.id)fail('وضعیت سریال تغییر کرده است.',409);
 put(did,'build',{...build.data,state:mode==='receive'?'finished':'assembled',...(mode==='receive'?{receivedAt:now,receivedBy:u.name,warehouseId:physical?.id||''}:{handoffId:null})},build);
 if(build.data.workflowVersion>=3){entry(did,'product_transit',-1000);if(mode==='cancel_handoff')entry(did,'line_finished',1000);}if(mode==='receive')entry(did,'finished',1000);event(did,mode==='receive'?'دریافت انبار محصول نهایی':'بازگشت درخواست تحویل به خط',{notes});}
 let pending=h.data.pending.filter((d:string)=>!selected.includes(d));
 const shortages:Record<string,Shortage>={...h.data.shortages},reported=mode==='receive'&&b.reportShortage===true?pending:[];
 for(const did of reported)shortages[did]={stage:'line',notes,at:now,by:u.name};
 if(reported.length)pending=[];
 put(h.id,'handoff',{...h.data,pending,shortages,received:mode==='receive'?[...h.data.received,...selected]:h.data.received,state:handoffHasOpenWork(pending,shortages)?'pending':'closed',history:[...h.data.history,{mode,deviceIds:selected,shortageIds:reported,by:u.name,actor:u.userId,at:now,notes}]},h);
 }else if(mode==='shortage_action'){
 const h=await get(needed(b.handoffId),'handoff'),did=needed(b.deviceId),action=needed(b.action) as ShortageAction;
 const shortages:Record<string,Shortage>={...h.data.shortages},current=shortages[did];
 if(!Object.hasOwn(shortageActions,action)||!current||current.stage!==shortageActions[action][0])fail('مرحلهٔ کسری تغییر کرده است.',409);
 if(!canActOnShortage(shortage,current.stage))fail('این مرحله در مسئولیت شما نیست.',403);
 const notes=needed(b.notes,4000),build=await get(did,'build');
 if(build.data.state!=='awaiting_receipt'||build.data.handoffId!==h.id)fail('سریال در این حواله باز نیست.',409);
 const next={...current,notes,at:now,by:u.name};
 const pending=[...h.data.pending];
 switch(action){
  case 'resend':
   if(needed(b.scannedCode)!==String((await device(did)).code))fail('سریال همین کارتن را اسکن کنید.');
   pending.push(did);delete shortages[did];break;
  case 'escalate_shortage':next.stage='production';break;
  case 'found_device':case 'return_parts':next.stage=action==='found_device'?'line':'production';break;
  case 'propose_parts':
   if(!build.data.materialsConsumed||!build.data.materials?.length)fail('مصرف ثبت‌شدهٔ قابل برگشت برای دستگاه یافت نشد.');
   next.parts=build.data.materials.map((m:any)=>({batchId:m.batchId,quantity:m.quantity}));next.stage='parts';break;
  case 'report_loss':next.stage='finance';break;
  case 'review_loss':next.stage='ceo';break;
  case 'return_loss':next.stage='finance';break;
  case 'confirm_parts':{
   const parts=next.parts||[];
   if(b.confirmed!==true||!parts.length)fail('شمارش و دریافت تمام قطعات را تأیید کنید.');
   for(const part of parts){if(!Number.isSafeInteger(part.quantity)||part.quantity<=0)fail('مقدار قطعه معتبر نیست.');await get(part.batchId,'receipt');entry(part.batchId,'line',part.quantity);}
   next.stage='recovered';break;
  }
  case 'approve_loss':
   if(b.confirmed!==true)fail('تأیید نهایی مفقودی لازم است.');
   if(h.data.history.some((event:any)=>event.mode==='review_loss'&&event.deviceIds.includes(did)&&event.actor===u.userId))fail('تأیید مدیرعامل باید توسط حسابی جدا از بررسی‌کنندهٔ مالی انجام شود.',403);
   next.stage='lost';break;
 }
 if(action!=='resend')shortages[did]=next;
 if(next.stage==='recovered'||next.stage==='lost'){
  if(build.data.workflowVersion>=3){guard("EXISTS(SELECT 1 FROM inventory_balances WHERE item_id=? AND warehouse='product_transit' AND quantity>=1000)",did);entry(did,'product_transit',-1000);}
  put(did,'build',{...build.data,state:'handoff_shortage_closed',shortageResolution:next.stage},build);
 }
 event(did,shortageActions[action][1],{notes});
 put(h.id,'handoff',{...h.data,pending,shortages,state:handoffHasOpenWork(pending,shortages)?'pending':'closed',history:[...h.data.history,{mode:action,deviceIds:[did],by:u.name,actor:u.userId,at:now,notes}]},h);
 }else if(mode==='reserve'){
 const order=await get(needed(b.salesOrderId),'sales_order');
 if(order.data.state!=='approved')fail('سفارش باید تأیید مالی و فاکتور شده باشد.');
 const agent=await get(order.data.agentId,'sales_agent');if(!agent.data.active)fail('نمایندگی یا عامل غیرفعال است.');
 // Use the registered profile directly; keep only a shipment snapshot, never a separate party master.
 const p={id:agent.id,data:{name:needed(agent.data.name),phone:text(agent.data.phone||agent.data.mobile||'',50),address:needed(agent.data.address,2000),kind:agent.data.kind||'representative',salesAgentId:agent.id}};
 const productId=needed(b.productId),count=Number(b.count);if(!Number.isInteger(count)||count<1||count>100)fail('تعداد بین ۱ تا ۱۰۰ باشد.');
 if(order){const line=order.data.lines.find((l:any)=>l.productId===productId);if(!line)fail('محصول در سفارش نیست.');const used:any=await db.prepare("SELECT COALESCE(SUM(json_extract(data,'$.count')),0) AS n FROM flow_entities WHERE type='sale' AND json_extract(data,'$.salesOrderId')=? AND json_extract(data,'$.productId')=? AND json_extract(data,'$.state')!='cancelled' AND json_extract(data,'$.replacementReturnId') IS NULL").bind(order.id,productId).first();if(used.n+count>line.quantity)fail('تعداد حواله‌ها از تعداد سفارش بیشتر می‌شود.');}
 let selected:string[];
 if(Array.isArray(b.deviceIds)&&b.deviceIds.length)selected=ids(b.deviceIds);else selected=(await db.prepare("SELECT f.id FROM flow_entities f JOIN records r ON r.id=f.id WHERE f.type='build' AND json_extract(f.data,'$.state')='finished' AND json_extract(r.payload,'$.product')=? ORDER BY json_extract(f.data,'$.receivedAt'),f.id LIMIT ?").bind(productId,count).all()).results.map((r:any)=>r.id);
 if(selected.length!==count)fail('موجودی آزاد برای این تعداد کافی نیست.',409);
 for(const did of selected){checks.push(await qmsDispatchGuard(did,id));const build=await get(did,'build'),d=await device(did);if(d.product!==productId||build.data.state!=='finished')fail('سریال هم‌مدل و آزاد در انبار انتخاب کنید.',409);guard("EXISTS(SELECT 1 FROM inventory_balances WHERE item_id=? AND warehouse='finished' AND quantity=1000)",did);put(did,'build',{...build.data,state:'reserved',saleId:id},build);event(did,'رزرو فروش',{notes:p.data.name});}
 put(id,'sale',{salesOrderId:order?.id||'',salesAgentId:order?.data.agentId||'',productId,partyId:p.id,invoiceId:order?.data.invoiceId||'',deliveryMode:order?.data.deliveryMode||'sale',recipient:p.data,deviceIds:selected,count,state:'reserved',by:u.name,actor:u.userId,notes:text(b.notes||'',4000),handedOverDeviceIds:[]});
 }else if(mode==='cancel_sale'){
 const sale=await get(needed(b.saleId),'sale');if(sale.data.state!=='reserved')fail('فقط رزرو ارسال‌نشده قابل لغو است.');const reason=needed(b.reason,4000);
 for(const did of sale.data.deviceIds){const build=await get(did,'build');if(build.data.state!=='reserved'||build.data.saleId!==sale.id)fail('وضعیت رزرو تغییر کرده است.',409);put(did,'build',{...build.data,state:'finished',saleId:null},build);event(did,'لغو رزرو فروش',{notes:reason});}put(sale.id,'sale',{...sale.data,state:'cancelled',reason,cancelledBy:u.name,cancelledAt:now},sale);
 }else if(mode==='pack'){
 const sale=await get(needed(b.saleId),'sale');if(sale.data.state!=='reserved'||sale.data.shippingPackages?.length)fail('بسته‌بندی فقط یک بار برای حوالهٔ رزروشده ثبت می‌شود؛ بستهٔ ثبت‌شده قابل چاپ مجدد است.',409);
 const selected=ids(b.deviceIds);if(selected.length!==sale.data.deviceIds.length||selected.some(did=>!sale.data.deviceIds.includes(did)))fail('تمام سریال‌های رزروشدهٔ همین حواله را انتخاب کنید.');
 if(b.confirmed!==true)fail('محتویات بسته‌ها را تأیید کنید.');
 const items=[];
 for(const did of selected){const build=await get(did,'build'),d=await device(did);if(build.data.state!=='reserved'||build.data.saleId!==sale.id||d.product!==sale.data.productId)fail('رزرو سریال تغییر کرده است.',409);
 if(build.data.warehouseId){const w=(await warehouseDirectory()).find(w=>w.id===build.data.warehouseId&&w.data.active);if(!w||!warehouseMember(u,w,'inventory'))fail('این دستگاه در مسئولیت انبار شما نیست.',403);guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',w.id,w.revision);}
 const product:any=await db.prepare("SELECT payload FROM records WHERE id=? AND kind='product'").bind(d.product).first();if(!product)fail('محصول پیدا نشد.');guard('EXISTS(SELECT 1 FROM records WHERE id=? AND payload=?)',d.product,product.payload);const p=JSON.parse(product.payload);items.push({deviceId:did,serial:d.code,productId:d.product,model:p.model||p.name,capacity:p.packageCapacity});}
 const sender={name:needed(b.senderName),phone:needed(b.senderPhone,50),city:needed(b.senderCity),address:needed(b.senderAddress,2000)};
 const recipient={...sale.data.recipient,city:needed(b.recipientCity||sale.data.recipient?.city),phone:needed(sale.data.recipient?.phone||sale.data.recipient?.mobile,50),address:needed(sale.data.recipient?.address,2000)};
 const packages=splitShippingPackages(items,()=>crypto.randomUUID());
 const order=sale.data.salesOrderId?await get(sale.data.salesOrderId,'sales_order'):null;
 put(sale.id,'sale',{...sale.data,shippingPackages:packages,packageOrderCode:order?.data.code||sale.data.salesOrderId||'',packageSender:sender,packageRecipient:recipient,packedAt:now,packedBy:u.userId},sale);
 }else if(mode==='dispatch'){
 const primary=await get(needed(b.saleId),'sale');if(primary.data.state!=='reserved'||primary.data.replacementReturnId&&!primary.data.replacementReady)fail('این حواله قبلاً خارج یا لغو شده است.',409);
 if(primary.data.salesOrderId){
  const order=await get(primary.data.salesOrderId,'sales_order');
  if(order.data.securedPolicy&&(order.data.state!=='approved'||!order.data.invoiceId))fail('ابتدا مالی فاکتور سفارش را صادر کند.',409);
 }
 const related=b.includeOrder===true&&primary.data.salesOrderId?(await list('sale')).filter(line=>line.id!==primary.id&&line.data.salesOrderId===primary.data.salesOrderId&&line.data.state==='reserved'):[];
 const sales=[primary,...related];
 const recipientKey=(r:any)=>[r?.name,r?.phone||r?.mobile,r?.address];
 if(related.some(line=>line.data.salesAgentId!==primary.data.salesAgentId||line.data.partyId!==primary.data.partyId||JSON.stringify(recipientKey(line.data.recipient))!==JSON.stringify(recipientKey(primary.data.recipient))))fail('گیرندهٔ حواله‌های این سفارش یکسان نیست.');
 const chosen=ids(b.deviceIds);
 for(const line of sales){if(!line.data.shippingPackages?.length)fail('ابتدا بسته‌بندی و برچسب همین حواله را ثبت کنید.',409);const packed=line.data.shippingPackages.flatMap((p:any)=>p.deviceIds);if(packed.some((did:string)=>!chosen.includes(did)))fail('سریال خروج باید عین محتویات بسته‌های چاپ‌شده باشد.',409);}
 if(chosen.length!==sales.reduce((sum,line)=>sum+line.data.count,0))fail('تعداد سریال خروج باید برابر مجموع حواله‌های آماده باشد.');
 const swaps=new Map<string,string[]>();
 const reserved=new Set(sales.flatMap(line=>line.data.deviceIds));
 for(const did of chosen)if(!reserved.has(did)){const product=(await device(did)).product;const rows=swaps.get(product)||[];rows.push(did);swaps.set(product,rows);}
 const carrierId=needed(b.carrierId),carrier:any=await db.prepare("SELECT id,name,subject,permissions FROM app_members WHERE id=? AND status='active'").bind(carrierId).first();if(!carrier||!(storedAccessPermissions(carrier.permissions).flowRoles?.includes('logistics')||storedAccessPermissions(carrier.permissions).transportRoles?.includes('driver')))fail('تحویل‌گیرنده فعال از واحد تدارکات انتخاب کنید.');
 guard("EXISTS(SELECT 1 FROM app_members WHERE id=? AND status='active' AND permissions=?)",carrier.id,carrier.permissions);
 const shipped:{productId:string;deviceIds:string[]}[]=[];
 for(const sale of sales){
 const selected=chosen.filter(did=>sale.data.deviceIds.includes(did));
 selected.push(...(swaps.get(sale.data.productId)||[]).splice(0,sale.data.count-selected.length));
 if(sale.data.replacementReturnId&&selected.some(did=>!sale.data.deviceIds.includes(did)))fail('سریال جایگزین را از همان پرونده مرجوعی پیگیری کنید.',409);
 if(selected.length!==sale.data.count)fail('تعداد سریال هر مدل باید با حوالهٔ همان مدل برابر باشد.');
 const changed=JSON.stringify([...selected].sort())!==JSON.stringify([...sale.data.deviceIds].sort());const reason=text(b.reason||'',4000);if(changed&&!reason)fail('علت تغییر سریال‌های پیشنهادی را بنویسید.');if(b.handedOver!==true)fail('تحویل فیزیکی به تدارکات را تأیید کنید.');
 for(const did of sale.data.deviceIds.filter((d:string)=>!selected.includes(d))){const build=await get(did,'build');if(build.data.state!=='reserved'||build.data.saleId!==sale.id)fail('رزرو تغییر کرده است.',409);put(did,'build',{...build.data,state:'finished',saleId:null},build);event(did,'آزادسازی سریال رزرو',{notes:reason});}
 const sourceWarehouses:{id:string;name:string}[]=[];
 for(const did of selected){checks.push(await qmsDispatchGuard(did,id));const build=await get(did,'build'),d=await device(did);if(d.product!==sale.data.productId||!(build.data.state==='finished'||build.data.state==='reserved'&&build.data.saleId===sale.id))fail('سریال خروج موجود نیست یا برای حواله دیگری رزرو شده است.',409);
 if(build.data.warehouseId){const w=(await warehouseDirectory()).find(w=>w.id===build.data.warehouseId&&w.data.active);if(!w||!warehouseMember(u,w,'inventory'))fail('خروج این محصول در مسئولیت انبار شما نیست.',403);guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',w.id,w.revision);if(!sourceWarehouses.some(v=>v.id===w.id))sourceWarehouses.push({id:w.id,name:w.data.name});}
 entry(did,'finished',-1000);entry(did,'in_transit',1000);put(did,'build',{...build.data,state:'in_transit',saleId:sale.id,dispatchedAt:now,carrierId:carrier.id,recipient:sale.data.recipient},build);event(did,'خروج انبار ـ تحویل تدارکات',{notes:'مقصد: '+sale.data.recipient.name+' · تحویل‌گیرنده: '+carrier.name,recipient:sale.data.recipient.name,carrier:carrier.name});}
 if(!sale.data.replacementReturnId)shipped.push({productId:sale.data.productId,deviceIds:selected});
 put(sale.id,'sale',{...sale.data,originalDeviceIds:sale.data.deviceIds,dispatchBatchId:id,sourceWarehouses,deviceIds:selected,state:'in_transit',carrierId:carrier.id,carrierSubject:carrier.subject||'',carrierName:carrier.name,dispatchedBy:u.name,dispatchedActor:u.userId,dispatchedAt:now,reason,receiptReference:text(b.receiptReference||'',300)},sale);
 }
 if(primary.data.salesOrderId&&shipped.length){
  const order=await get(primary.data.salesOrderId,'sales_order');
  if(order.data.dispatchPaymentDays!==undefined){
   const invoice=await get(needed(order.data.invoiceId),'sales_invoice');
   if(invoice.data.orderId!==order.id)fail('فاکتور به سفارش ارسال مرتبط نیست.',409);
   const installments=dispatchInstallments(invoice.data,id,tehranDay(new Date(now)),shipped);
   if(installments!==invoice.data.installments)put(invoice.id,'sales_invoice',{...invoice.data,installments},invoice);
  }
 }
 }else if(mode==='handover'){
 const sale=await get(needed(b.saleId),'sale');const agent=await get(sale.data.salesAgentId||sale.data.partyId,'sales_agent');if(!agent.data.active)fail('نماینده یا شعبه غیرفعال است.');if(salesRep(u)&&agent.id!==u.permissions.salesAgentId)fail('این حواله متعلق به حساب شما نیست.',403);if(!['branch','representative','reseller','end_customer'].includes(agent.data.kind))fail('این حواله برای تحویل مشتری معتبر نیست.');const selected=ids(b.deviceIds);const handed=new Set<string>(sale.data.handedOverDeviceIds||[]);if(selected.some(d=>!sale.data.deviceIds.includes(d)||handed.has(d)))fail('سریال برای این تحویل معتبر نیست یا قبلاً ثبت شده است.',409);const customerName=needed(b.customerName,200),customerMobile=text(b.customerMobile||'',50),customerNationalId=text(b.customerNationalId||'',20),customerCity=text(b.customerCity||'',100),customerAddress=needed(b.customerAddress,2000),notes=text(b.notes||'',2000);if(customerNationalId&&!/^\d{10}$/.test(customerNationalId))fail('کد ملی مشتری باید ۱۰ رقم باشد.');if(customerMobile&&!/^(?:09\d{9}|\+989\d{9})$/.test(customerMobile))fail('موبایل مشتری معتبر نیست.');const order= sale.data.salesOrderId?await get(sale.data.salesOrderId,'sales_order'):null;const invoice=order?.data.invoiceId||sale.data.invoiceId||'';const day=tehranDay(),dealerName=agent.data.name,distributionId=(did:string)=>'distribution:'+did;
 for(const did of selected){const build=await get(did,'build');if(sale.data.deliveryMode==='consignment'){if(build.data.state!=='consigned'||build.data.saleId!==sale.id)fail('سریال شعبه امانی آماده تحویل نهایی نیست.',409);entry(did,'consignment:'+agent.id,-1000);entry(did,'delivered',1000);put(did,'build',{...build.data,state:'delivered',deliveredAt:now,customerName,customerMobile,customerNationalId,customerAddress},build);}else if(build.data.state!=='delivered'||build.data.saleId!==sale.id)fail('سریال فروش قطعی در وضعیت تحویل مقصد نیست.',409);const current:any=await db.prepare("SELECT * FROM records WHERE id=? AND kind='distribution'").bind(distributionId(did)).first();const previous=current?JSON.parse(current.payload):{};if(previous.customerName&&previous.customerName!==customerName)fail('برای این سریال مشتری نهایی قبلاً ثبت شده است.',409);const next={...previous,serial:(await device(did)).code,dealerCode:agent.id,dealerName,dealerDate:previous.dealerDate||day,invoice:previous.invoice||invoice,customerName,customerMobile,customerNationalId,customerCity,customerAddress,notes,device:did,deliveryDate:day,updatedAt:now,updatedBy:u.name,source:'تحویل نهایی فروش'};if(current){guard('EXISTS(SELECT 1 FROM records WHERE id=? AND payload=?)',current.id,current.payload);statements.push(db.prepare('UPDATE records SET payload=? WHERE id=? AND payload=?').bind(JSON.stringify(next),current.id,current.payload),db.prepare('INSERT INTO access_audit(id,actor,target,action,before,after,at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,distributionId(did),'handover_distribution',current.payload,JSON.stringify(next),now));}else{statements.push(db.prepare("INSERT INTO records(id,kind,payload,created) VALUES(?,'distribution',?,?)").bind(distributionId(did),JSON.stringify(next),now),db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,distributionId(did),'handover_distribution',JSON.stringify(next),now));}event(did,'تحویل مشتری نهایی',{customerName,customerMobile,customerCity,notes});}
 const allHanded=[...handed,...selected],nextState=allHanded.length===sale.data.deviceIds.length?'delivered':sale.data.deliveryMode==='consignment'?'consignment_received':sale.data.state;put(sale.id,'sale',{...sale.data,handedOverDeviceIds:allHanded,customerHandoverAt:now,customerHandoverBy:u.name,state:nextState},sale);
 }else if(mode==='acknowledge'){
 const sale=await get(needed(b.saleId),'sale');if(sale.data.transportId)fail('تأیید دریافت را در مأموریت تدارکات انجام دهید.');if(sale.data.state!=='in_transit'||sale.data.acknowledgedAt)fail('این حواله در انتظار تأیید تدارکات نیست.',409);if(!u.isAdmin&&!['local:'+sale.data.carrierId,sale.data.carrierSubject].includes(u.userId))fail('فقط تحویل‌گیرنده تعیین‌شده می‌تواند تأیید کند.',403);
 const sales=sale.data.dispatchBatchId?(await list('sale')).filter(line=>line.data.dispatchBatchId===sale.data.dispatchBatchId):[sale];
 const selected=ids(b.deviceIds),pending=new Set<string>();
 for(const line of sales)for(const did of line.data.deviceIds)if(!line.data.acknowledgedDeviceIds?.includes(did))pending.add(did);
 if(selected.some(did=>!pending.has(did)))fail('سریال باید از ماندهٔ همان ارسال باشد.',409);
 const complete=selected.length===pending.size;
 const notes=complete?text(b.notes||'',4000):needed(b.notes||'',4000);
 for(const line of sales){
  if(line.data.transportId||line.data.state!=='in_transit')fail('وضعیت حواله‌های این ارسال تغییر کرده است.',409);
  const received=selected.filter(did=>line.data.deviceIds.includes(did));
  const acknowledgedDeviceIds=[...(line.data.acknowledgedDeviceIds||[]),...received];
  const pickupShortageIds=line.data.deviceIds.filter((did:string)=>!acknowledgedDeviceIds.includes(did));
  put(line.id,'sale',{...line.data,acknowledgedDeviceIds,pickupShortageIds,
   ...(complete?{acknowledgedAt:now,acknowledgedBy:u.name,acknowledgedActor:u.userId}:{}),
   carrierNotes:notes,carrierReceipts:[...(line.data.carrierReceipts||[]),...(received.length?[{deviceIds:received,by:u.name,actor:u.userId,at:now,notes}]:[])]},line);
 }
 for(const did of selected)event(did,'تأیید دریافت تدارکات',{notes});
 }
 const formStatements=await captureForm(id,'fulfillment.'+mode,b,u);
 await db.batch([db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(id,'fulfillment_'+mode,signature,u.userId,now),...checks,...await annualCountMovementStatements(db,id,b,countMovements),...statements,...formStatements,db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,id,'fulfillment_'+mode,signature,now)]);
 let followup=true;try{await syncSalesTasks();await scanSalesMonitor({reports:false,source:'event'});}catch{followup=false;}return json({saved:true,followupPending:!followup});
 }catch(e){return accessResponse(e)||Response.json({error:/constraint|SQLITE|D1|Database/i.test(String(e))?'موجودی یا وضعیت هم‌زمان تغییر کرده است؛ هیچ تغییری ثبت نشد. تازه‌سازی کنید.':'ثبت انجام نشد؛ ورودی‌ها را بررسی کنید.'},{status:409})}}

export const GET=withServiceRolePreview(get);
export const POST=withServiceRolePreview(post);
