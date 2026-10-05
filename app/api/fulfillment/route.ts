import {salesStaff,salesLock} from '@/lib/sales';
import {storage} from '@/lib/storage';
import {requireAccess,checkOrigin,AccessError,accessResponse} from '@/lib/authorization';
import {flowRole,warehouseAccess,entity} from '@/lib/material-flow';
import {boundedBody} from '@/lib/firmware-storage';
import {tehranDay} from '@/lib/serials';
const fail=(m:string,s=400):never=>{throw new AccessError(m,s)};
const text=(v:unknown,max=200)=>{if(typeof v!=='string'||v.length>max)fail('متن معتبر نیست.');return (v as string).trim()};
const needed=(v:unknown,max=200)=>{const s=text(v,max);if(!s)fail('فیلد الزامی خالی است.');return s};
const ids=(v:unknown)=>{if(!Array.isArray(v)||!v.length||v.length>100||new Set(v).size!==v.length)fail('بین ۱ تا ۱۰۰ سریال غیرتکراری انتخاب کنید.');return (v as unknown[]).map(x=>needed(x));};
const json=(v:unknown)=>Response.json(v,{headers:{'Cache-Control':'no-store'}});
export async function GET(){try{
 const u=await requireAccess(),production=flowRole(u,'production'),inventory=warehouseAccess(u,'finished'),sales=salesStaff(u),logistics=flowRole(u,'logistics');
 if(!production&&!inventory&&!sales&&!logistics)fail('دسترسی محصول نهایی ندارید.',403);
 const db=storage(),all=(await db.prepare("SELECT * FROM flow_entities WHERE type IN ('build','handoff','sale','party','print','finaltest') ORDER BY created DESC,id DESC").all()).results.map(entity);
 const records=(await db.prepare("SELECT id,kind,payload FROM records WHERE kind IN ('device','product')").all()).results.map((r:any)=>({id:r.id,kind:r.kind,data:JSON.parse(r.payload)}));
 const rows=records.filter((r:any)=>r.kind==='product'||production||inventory||sales||all.some(e=>e.type==='sale'&&e.data.deviceIds?.includes(r.id)&&['local:'+e.data.carrierId,e.data.carrierSubject].includes(u.userId)));
 const prints=new Set(all.filter(e=>e.type==='print').map(e=>e.data.planId));
 const builds=all.filter(e=>e.type==='build').filter(e=>production||inventory||sales&&['finished','reserved','in_transit'].includes(e.data.state)).map(e=>{
 const legacy=all.find(t=>t.type==='finaltest'&&t.data.deviceId===e.id&&t.data.buildRevision===e.revision);
 return {id:e.id,revision:e.revision,created:e.created,data:{...e.data,latestQc:e.data.latestQc===undefined&&legacy?{verdict:legacy.data.verdict,by:legacy.data.by,reportId:legacy.data.reportId}:e.data.latestQc},printRecorded:prints.has(e.data.planId)};});
 const members=(await db.prepare("SELECT id,name,subject,permissions FROM app_members WHERE status='active'").all()).results.map((m:any)=>({id:m.id,name:m.name,subject:m.subject,permissions:JSON.parse(m.permissions)}));
 return json({builds,rows,handoffs:production||inventory?all.filter(e=>e.type==='handoff'):[],sales:all.filter(e=>e.type==='sale'&&(inventory||sales||logistics&&['local:'+e.data.carrierId,e.data.carrierSubject].includes(u.userId))),parties:inventory||sales?all.filter(e=>e.type==='party'):[],carriers:inventory?members.filter(m=>(m.permissions.flowRoles?.includes('logistics')||m.permissions.transportRoles?.includes('driver'))).map(m=>({id:m.id,name:m.name})):[],roles:{production,inventory,sales,logistics}});
 }catch(e){return accessResponse(e)||Response.json({error:'دریافت کارتابل محصول نهایی انجام نشد.'},{status:503})}}
export async function POST(request:Request){try{
 checkOrigin(request);const u=await requireAccess(),b=JSON.parse(new TextDecoder().decode(await boundedBody(request,128000))),id=needed(b.id),mode=needed(b.mode),db=storage(),now=new Date().toISOString();
 if(!/^[a-f0-9-]{36}$/i.test(id))fail('شناسه عملیات معتبر نیست.');
 const allowed=mode==='handoff'||mode==='cancel_handoff'?flowRole(u,'production'):['receive','dispatch'].includes(mode)?warehouseAccess(u,'finished'):['party','reserve','cancel_sale'].includes(mode)?salesStaff(u):mode==='acknowledge'?flowRole(u,'logistics'):false;
 if(!allowed)fail('مجوز این عملیات یا انبار را ندارید.',403);
 const signature=JSON.stringify(b),prior:any=await db.prepare('SELECT payload,actor FROM inventory_operations WHERE id=?').bind(id).first();if(prior){if(prior.payload!==signature||prior.actor!==u.userId)fail('شناسه تکراری با درخواست متفاوت.',409);return json({saved:true,repeated:true});}
 const statements:D1PreparedStatement[]=[],checks:D1PreparedStatement[]=await salesLock(db,id);
 const guard=(q:string,...args:any[])=>checks.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN '+q+' THEN 1 ELSE 0 END WHERE id=?').bind(...args,id));
 async function get(eid:string,type:string){const r:any=await db.prepare('SELECT * FROM flow_entities WHERE id=? AND type=?').bind(eid,type).first();if(!r)fail('رکورد پیدا نشد.',404);guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',r.id,r.revision);return entity(r)}
 const put=(eid:string,type:string,data:any,old?:any)=>statements.push(old?db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(data),now,eid,old.revision):db.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').bind(eid,type,JSON.stringify(data),now,now));
 const entry=(item:string,warehouse:string,delta:number)=>{const bid=item+'@'+warehouse;statements.push(db.prepare('INSERT INTO inventory_balances(id,item_id,warehouse,quantity) VALUES(?,?,?,0) ON CONFLICT(id) DO NOTHING').bind(bid,item,warehouse),db.prepare('UPDATE inventory_balances SET quantity=quantity+? WHERE id=?').bind(delta,bid),db.prepare('INSERT INTO inventory_entries(id,operation_id,item_id,warehouse,delta) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),id,item,warehouse,delta));};
 const event=(device:string,stage:string,extra:any={})=>statements.push(db.prepare("INSERT INTO records(id,kind,payload,created) VALUES(?,'event',?,?)").bind(crypto.randomUUID(),JSON.stringify({device,stage,date:tehranDay(),operator:u.name,operationId:id,...extra}),now));
 async function device(did:string){const r:any=await db.prepare("SELECT payload FROM records WHERE id=? AND kind='device'").bind(did).first();if(!r)fail('دستگاه یافت نشد.');return JSON.parse(r.payload)}
 async function passed(build:any){if(build.data.latestQc!==undefined){if(build.data.latestQc?.verdict!=='pass')fail('کنترل کیفیت معتبر و قبول‌شده لازم است.');return build.data.latestQc;}
 const tests=(await db.prepare("SELECT * FROM flow_entities WHERE type='finaltest' AND json_extract(data,'$.deviceId')=? ORDER BY created DESC,id DESC").bind(build.id).all()).results.map(entity),test=tests[0];if(!test||test.data.buildRevision!==build.revision||test.data.verdict!=='pass')fail('کنترل کیفیت معتبر و قبول‌شده لازم است.');return {reportId:test.data.reportId,verdict:'pass',by:test.data.by};}
 if(mode==='party'){
 const partyId=b.partyId?needed(b.partyId):id,old=b.partyId?await get(partyId,'party'):undefined;if(old&&old.revision!==b.revision)fail('مشخصات گیرنده تغییر کرده است.',409);
 if(!['agent','representative','branch'].includes(b.kind))fail('نوع گیرنده معتبر نیست.');
 put(partyId,'party',{...(old?.data||{}),name:needed(b.name),kind:b.kind,phone:text(b.phone||'',50),address:needed(b.address,2000),active:b.active!==false},old);
 }else if(mode==='handoff'){
 const deviceIds=ids(b.deviceIds);if(b.packaged!==true)fail('بسته‌بندی و نصب برچسب دستگاه‌ها را تأیید کنید.');
 for(const did of deviceIds){const build=await get(did,'build');if(build.data.state!=='assembled')fail('سریال آماده تحویل نیست یا قبلاً ارجاع شده است.');const qc=await passed(build);
 if(!await db.prepare("SELECT id FROM flow_entities WHERE type='print' AND json_extract(data,'$.planId')=? LIMIT 1").bind(build.data.planId).first())fail('ابتدا چاپ برچسب این برنامه را ثبت کنید.');
 put(did,'build',{...build.data,latestQc:qc,state:'awaiting_receipt',handoffId:id,packagedAt:now},build);event(did,'ارجاع به انبار محصول نهایی',{notes:text(b.notes||'',4000)});}
 put(id,'handoff',{deviceIds,pending:deviceIds,received:[],state:'pending',by:u.name,actor:u.userId,notes:text(b.notes||'',4000),history:[]});
 }else if(mode==='receive'||mode==='cancel_handoff'){
 const h=await get(needed(b.handoffId),'handoff'),selected=ids(b.deviceIds);if(h.data.state!=='pending'||selected.some(d=>!h.data.pending.includes(d)))fail('سریال انتخاب‌شده در انتظار این تحویل نیست.',409);
 const notes=text(b.notes||'',4000);if(mode==='cancel_handoff'&&!notes)fail('علت بازگرداندن به خط تولید لازم است.');if(mode==='receive'&&selected.length<h.data.pending.length&&!notes)fail('علت تحویل جزئی را بنویسید.');
 for(const did of selected){const build=await get(did,'build');if(build.data.state!=='awaiting_receipt'||build.data.handoffId!==h.id)fail('وضعیت سریال تغییر کرده است.',409);
 put(did,'build',{...build.data,state:mode==='receive'?'finished':'assembled',...(mode==='receive'?{receivedAt:now,receivedBy:u.name}:{handoffId:null})},build);
 if(mode==='receive')entry(did,'finished',1000);event(did,mode==='receive'?'دریافت انبار محصول نهایی':'بازگشت درخواست تحویل به خط',{notes});}
 const pending=h.data.pending.filter((d:string)=>!selected.includes(d));put(h.id,'handoff',{...h.data,pending,received:mode==='receive'?[...h.data.received,...selected]:h.data.received,state:pending.length?'pending':'closed',history:[...h.data.history,{mode,deviceIds:selected,by:u.name,actor:u.userId,at:now,notes}]},h);
 }else if(mode==='reserve'){
 const order=b.salesOrderId?await get(needed(b.salesOrderId),'sales_order'):null;
 let p:any;
 if(order){
  if(order.data.state!=='approved')fail('سفارش باید تأیید مالی و فاکتور شده باشد.');
  const agent=await get(order.data.agentId,'sales_agent');if(!agent.data.active)fail('نمایندگی غیرفعال است.');
  const partyId='sales-party:'+agent.id,old:any=await db.prepare("SELECT * FROM flow_entities WHERE id=? AND type='party'").bind(partyId).first();
  p=old?entity(old):{id:partyId,data:{...order.data.recipient,kind:'representative',active:true,salesAgentId:agent.id}};
  if(!old)put(p.id,'party',p.data);else {guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',p.id,p.revision);if(p.data.salesAgentId!==agent.id)fail('ارتباط گیرنده تغییر کرده است.');}
  // Shipping address is frozen with the accepted order, regardless of later profile edits.
  p={...p,data:{...p.data,...order.data.recipient}};
 }else {p=await get(needed(b.partyId),'party');if(p.data.salesAgentId)fail('برای این نماینده سفارش تأییدشده انتخاب کنید.');}
 if(!p.data.active)fail('گیرنده غیرفعال است.');const productId=needed(b.productId),count=Number(b.count);if(!Number.isInteger(count)||count<1||count>100)fail('تعداد بین ۱ تا ۱۰۰ باشد.');
 if(order){const line=order.data.lines.find((l:any)=>l.productId===productId);if(!line)fail('محصول در سفارش نیست.');const used:any=await db.prepare("SELECT COALESCE(SUM(json_extract(data,'$.count')),0) AS n FROM flow_entities WHERE type='sale' AND json_extract(data,'$.salesOrderId')=? AND json_extract(data,'$.productId')=? AND json_extract(data,'$.state')!='cancelled'").bind(order.id,productId).first();if(used.n+count>line.quantity)fail('تعداد حواله‌ها از تعداد سفارش بیشتر می‌شود.');}
 let selected:string[];
 if(Array.isArray(b.deviceIds)&&b.deviceIds.length)selected=ids(b.deviceIds);else selected=(await db.prepare("SELECT f.id FROM flow_entities f JOIN records r ON r.id=f.id WHERE f.type='build' AND json_extract(f.data,'$.state')='finished' AND json_extract(r.payload,'$.product')=? ORDER BY json_extract(f.data,'$.receivedAt'),f.id LIMIT ?").bind(productId,count).all()).results.map((r:any)=>r.id);
 if(selected.length!==count)fail('موجودی آزاد برای این تعداد کافی نیست.',409);
 for(const did of selected){const build=await get(did,'build'),d=await device(did);if(d.product!==productId||build.data.state!=='finished')fail('سریال هم‌مدل و آزاد در انبار انتخاب کنید.',409);guard("EXISTS(SELECT 1 FROM inventory_balances WHERE item_id=? AND warehouse='finished' AND quantity=1000)",did);put(did,'build',{...build.data,state:'reserved',saleId:id},build);event(did,'رزرو فروش',{notes:p.data.name});}
 put(id,'sale',{salesOrderId:order?.id||'',salesAgentId:order?.data.agentId||'',productId,partyId:p.id,recipient:p.data,deviceIds:selected,count,state:'reserved',by:u.name,actor:u.userId,notes:text(b.notes||'',4000)});
 }else if(mode==='cancel_sale'){
 const sale=await get(needed(b.saleId),'sale');if(sale.data.state!=='reserved')fail('فقط رزرو ارسال‌نشده قابل لغو است.');const reason=needed(b.reason,4000);
 for(const did of sale.data.deviceIds){const build=await get(did,'build');if(build.data.state!=='reserved'||build.data.saleId!==sale.id)fail('وضعیت رزرو تغییر کرده است.',409);put(did,'build',{...build.data,state:'finished',saleId:null},build);event(did,'لغو رزرو فروش',{notes:reason});}put(sale.id,'sale',{...sale.data,state:'cancelled',reason,cancelledBy:u.name,cancelledAt:now},sale);
 }else if(mode==='dispatch'){
 const sale=await get(needed(b.saleId),'sale');if(sale.data.state!=='reserved')fail('این حواله قبلاً خارج یا لغو شده است.',409);const selected=ids(b.deviceIds);if(selected.length!==sale.data.count)fail('تعداد سریال خروج باید برابر حواله باشد.');const carrierId=needed(b.carrierId),carrier:any=await db.prepare("SELECT id,name,subject,permissions FROM app_members WHERE id=? AND status='active'").bind(carrierId).first();if(!carrier||!(JSON.parse(carrier.permissions).flowRoles?.includes('logistics')||JSON.parse(carrier.permissions).transportRoles?.includes('driver')))fail('تحویل‌گیرنده فعال از واحد تدارکات انتخاب کنید.');
 guard("EXISTS(SELECT 1 FROM app_members WHERE id=? AND status='active' AND permissions=?)",carrier.id,carrier.permissions);
 const changed=JSON.stringify([...selected].sort())!==JSON.stringify([...sale.data.deviceIds].sort());const reason=text(b.reason||'',4000);if(changed&&!reason)fail('علت تغییر سریال‌های پیشنهادی را بنویسید.');if(b.handedOver!==true)fail('تحویل فیزیکی به تدارکات را تأیید کنید.');
 for(const did of sale.data.deviceIds.filter((d:string)=>!selected.includes(d))){const build=await get(did,'build');if(build.data.state!=='reserved'||build.data.saleId!==sale.id)fail('رزرو تغییر کرده است.',409);put(did,'build',{...build.data,state:'finished',saleId:null},build);event(did,'آزادسازی سریال رزرو',{notes:reason});}
 for(const did of selected){const build=await get(did,'build'),d=await device(did);if(d.product!==sale.data.productId||!(build.data.state==='finished'||build.data.state==='reserved'&&build.data.saleId===sale.id))fail('سریال خروج موجود نیست یا برای حواله دیگری رزرو شده است.',409);
 entry(did,'finished',-1000);entry(did,'in_transit',1000);put(did,'build',{...build.data,state:'in_transit',saleId:sale.id,dispatchedAt:now,carrierId:carrier.id,recipient:sale.data.recipient},build);event(did,'خروج انبار ـ تحویل تدارکات',{notes:'مقصد: '+sale.data.recipient.name+' · تحویل‌گیرنده: '+carrier.name,recipient:sale.data.recipient.name,carrier:carrier.name});}
 put(sale.id,'sale',{...sale.data,originalDeviceIds:sale.data.deviceIds,deviceIds:selected,state:'in_transit',carrierId:carrier.id,carrierSubject:carrier.subject||'',carrierName:carrier.name,dispatchedBy:u.name,dispatchedActor:u.userId,dispatchedAt:now,reason,receiptReference:text(b.receiptReference||'',300)},sale);
 }else if(mode==='acknowledge'){
 const sale=await get(needed(b.saleId),'sale');if(sale.data.transportId)fail('تأیید دریافت را در مأموریت تدارکات انجام دهید.');if(sale.data.state!=='in_transit'||sale.data.acknowledgedAt)fail('این حواله در انتظار تأیید تدارکات نیست.',409);if(!u.isAdmin&&!['local:'+sale.data.carrierId,sale.data.carrierSubject].includes(u.userId))fail('فقط تحویل‌گیرنده تعیین‌شده می‌تواند تأیید کند.',403);
 put(sale.id,'sale',{...sale.data,acknowledgedAt:now,acknowledgedBy:u.name,acknowledgedActor:u.userId,carrierNotes:text(b.notes||'',4000)},sale);for(const did of sale.data.deviceIds)event(did,'تأیید دریافت تدارکات',{notes:text(b.notes||'',4000)});
 }
 await db.batch([db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(id,'fulfillment_'+mode,signature,u.userId,now),...checks,...statements,db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,id,'fulfillment_'+mode,signature,now)]);
 return json({saved:true});
 }catch(e){return accessResponse(e)||Response.json({error:/constraint|SQLITE|D1|Database/i.test(String(e))?'موجودی یا وضعیت هم‌زمان تغییر کرده است؛ هیچ تغییری ثبت نشد. تازه‌سازی کنید.':'ثبت انجام نشد؛ ورودی‌ها را بررسی کنید.'},{status:409})}}
