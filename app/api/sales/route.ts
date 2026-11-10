import {deferDispatchBalance} from '@/lib/sales-dispatch-terms';
import {withRepresentativeSample} from '@/lib/representative-sample';
import {returnTaskStatements} from '@/lib/sales-return-tasks';
import {qmsDispatchGuard} from '@/lib/qms-release';
import {assertWarehouseNotCounting} from '@/lib/stocktake-lock';
import {normalizeIranLocation,iranProvinces,iranLocalities} from '@/lib/iran-locations';
import {salesRepresentationLinks,salesLinkWorkspace} from '@/lib/representative-links';
import {storedAccessPermissions} from '@/lib/permissions';
import {buildIntakeRoles} from '@/lib/build-intake-access';
import {productProductionMode} from '@/lib/model';
import {usesAssignedSalesAccounts} from '@/lib/sales-contract';
import {bankCode} from '@/lib/sales-bank-contract';
import {digest} from '@/lib/password-auth';
import {automaticRepresentativeAccount,initialRepresentativeAccount,representativePublic} from '@/lib/representative-account';
import {termsPlan,allocationPlan} from '@/lib/sales-network-contract';
import {leadMembers,leadMemberGuard} from '@/lib/sales-leads';
import {salesVisible,liveSalesUser} from '@/lib/sales';
import {trainingContext} from '@/lib/training-context';
import {leadConvert} from '@/lib/sales-leads';
import {syncLeadTasks} from '@/lib/sales-lead-tasks';
import {goalProgress} from '@/lib/sales-monitor-contract';
import {scanSalesMonitor} from '@/lib/sales-monitor';
import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {storage} from '@/lib/storage';
import {boundedBody} from '@/lib/firmware-storage';
import {dayAt,addDay,memberId} from '@/lib/duties';
import {salesRoles,salesActions,salesHelp,salesAccounts,salesCheckPosition,salesSecuredCredit,salesTargetProgress,salesMilestones,salesProxyModes,salesOrderProgress,rial,total} from '@/lib/sales-contract';
import {salesFail as fail,salesRep,salesManager,salesStaff,salesFinance,salesRead,salesWarehouse,salesViewer,salesReportRead,salesScope,salesLock,salesRows,salesEntity,salesQuote,salesSubmission,salesPaymentSubmission,salesDelivery,publicSalesFile,sreq as req,stxt as txt,money,integer,arr,sday} from '@/lib/sales';
import {syncSalesTasks} from '@/lib/sales-tasks';
const json=(d:any,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
async function dbReceivingAccounts(){return (await storage().prepare("SELECT id,revision,data FROM flow_entities WHERE type='treasury_account' AND json_extract(data,'$.state')='active' AND json_extract(data,'$.kind')='bank' AND json_extract(data,'$.currency')='IRR'").all()).results.map((a:any)=>{const d=JSON.parse(a.data);return {id:a.id,revision:a.revision,title:d.title,number:d.number,currency:d.currency};});}
async function get(request:Request){try{
 const u=await liveSalesUser(await requireAccess());if(!salesRead(u)&&!salesWarehouse(u))fail('دسترسی فروش ندارید.',403);const q=new URL(request.url).searchParams;if(q.get('locations')==='1'){if(!salesManager(u))fail('مجوز تعریف نماینده لازم است.',403);return json({provinces:iranProvinces,localities:q.has('province')?iranLocalities(q.get('province')):[]});}const all=await salesRows(),selected=new URL(request.url).searchParams.get('agent')||'',own=salesRep(u)?u.permissions.salesAgentId!:selected;if(salesRep(u)&&selected&&selected!==own)fail('پرونده پیدا نشد یا دسترسی ندارید.',404);if(own)await salesScope(u,own,'read');
 const candidates=all.filter(r=>r.type==='sales_agent'&&(!own||r.id===own)),visible=await Promise.all(candidates.map(a=>salesVisible(u,a,'read'))),agents=candidates.filter((_,i)=>visible[i]),ids=agents.map(a=>a.id),rows=all.filter(r=>ids.includes(r.data.agentId)||r.type==='sales_price'&&r.data.agentId==='');const today=dayAt();
 const warehouseOnly=!salesRead(u);if(warehouseOnly)return json({warehouseOnly:true,roles:{warehouse:true},agents:agents.map(a=>({id:a.id,data:{name:a.data.name}})),returns:rows.filter(r=>r.type==='sales_return'&&!r.data.workflowVersion).map(r=>({...r,data:{agentId:r.data.agentId,state:r.data.state,deviceIds:r.data.deviceIds,serials:r.data.serials,reason:r.data.reason,receipt:r.data.receipt}})),help:salesHelp});
 const links=await salesLinkWorkspace(storage(),u,agents);
 const receivingAccounts=(salesStaff(u)||salesFinance(u)||salesRep(u))?(await dbReceivingAccounts()).filter(account=>!salesRep(u)||agents.some(agent=>!usesAssignedSalesAccounts(agent.data.kind)||agent.data.receivingAccountIds?.includes(account.id))):[];
 const products=(await storage().prepare("SELECT id,payload FROM records WHERE kind='product'").all()).results.map((r:any)=>{const p=JSON.parse(r.payload);return {id:r.id,name:p.name||p.model||p.code,model:p.model||'',status:p.status,productionMode:productProductionMode(p)};});
 const canOperate=await Promise.all(agents.map(a=>salesVisible(u,a)));
 const bankRowsById=new Map(rows.filter(row=>row.type==='sales_bank_row').map(row=>[row.id,row.data]));
 const bankStatements=salesRep(u)?all.filter(row=>row.type==='sales_bank_statement'):[];
 const incomingBankRows=salesRep(u)?all.filter(row=>row.type==='sales_bank_row'&&row.data.direction==='in'):[];
 const accounts=agents.map(a=>{const account=salesAccounts(rows,a.id,today);const publicReturn=(r:any)=>{if(!r.data.workflowVersion)return r;const {agentId,invoiceId,state,deviceIds,serials,amount,reason,workflowVersion}=r.data;return {...r,data:{agentId,invoiceId,state,deviceIds,serials,amount,reason,workflowVersion}};};return {agentId:a.id,...account,payments:account.payments.map(payment=>{
  const bankRow=bankRowsById.get(payment.data.bankRowId);
  const isTerminalPayment=bankRow?.kind==='pos'&&!!bankRow.terminalId&&bankRow.paymentId===payment.id;
  const claim=payment.data;
  let bankMatchMissing=false;
  if(salesRep(u)&&claim.method==='bank'&&claim.state==='pending'&&!claim.bankRowId&&claim.receivingAccountId&&claim.day&&bankCode(claim.reference||'')){
   const uploadDays=new Set<string>();
   for(const statement of bankStatements){
    if(statement.data.accountId===claim.receivingAccountId&&statement.created>=payment.created&&statement.data.to>=claim.day){
     uploadDays.add(dayAt(new Date(statement.created)));
    }
   }
   const consecutiveUploads=[...uploadDays].some(day=>uploadDays.has(addDay(day,1)));
   const matchingEntry=incomingBankRows.some(row=>row.data.accountId===claim.receivingAccountId&&row.data.amount===claim.amount&&row.data.day===claim.day&&bankCode(row.data.reference||'')===bankCode(claim.reference));
   bankMatchMissing=consecutiveUploads&&!matchingEntry;
  }
  return {...payment,isTerminalPayment,bankMatchMissing};
 }),returns:account.returns.map(publicReturn),credits:account.credits.map(publicReturn),securedCredit:salesSecuredCredit(rows,a.id,today)};});
 const allMembers=!salesRep(u)?(await storage().prepare("SELECT id,name,permissions FROM app_members WHERE status='active'").all()).results.map((m:any)=>{const p=storedAccessPermissions(m.permissions),s={isAdmin:false,permissions:p} as any;return {id:m.id,name:m.name,sales:salesStaff(s),manager:salesManager(s),finance:salesFinance(s)};}).filter(m=>m.sales||m.finance):[];
 const deliveries=await salesDelivery(rows,ids),mid=await memberId(u);
 const relatedMembers=new Set([mid,...agents.flatMap(a=>[a.data.ownerId,a.data.financeId,a.data.managerId])]);
 const members=allMembers.filter(m=>salesReportRead(u)||salesFinance(u)||relatedMembers.has(m.id));
 const tasks=(await storage().prepare("SELECT id,assignee,supervisor,due,state,data FROM duty_runs WHERE template_id LIKE 'sales:%' AND state NOT IN ('completed','cancelled')").all()).results.flatMap((t:any)=>{const d=JSON.parse(t.data);if(!d.salesWorkflow||!ids.includes(d.salesAgentId)||!(salesReportRead(u)||t.assignee===mid||t.supervisor===mid))return [];return [{id:t.id,agentId:d.salesAgentId,title:d.title,role:d.workflowRole,assignee:t.assignee,assigneeName:members.find(m=>m.id===t.assignee)?.name||(t.assignee===mid?u.name:'نماینده'),supervisor:t.supervisor,due:t.due,state:t.state,late:t.due<new Date().toISOString()}];});
 const pipeline=rows.filter(r=>r.type==='sales_order').map(o=>salesOrderProgress(o,deliveries,today));
 const invoices=accounts.flatMap(a=>a.invoices),returns=rows.filter(r=>r.type==='sales_return'&&r.data.state==='credited');
 const reportProducts=products.map(p=>{const lines=invoices.filter(i=>!i.data.openingId).flatMap(i=>i.data.lines||[]).filter((l:any)=>l.productId===p.id),back=returns.flatMap(r=>r.data.lines).filter(l=>l.productId===p.id);return {...p,quantity:lines.reduce((n:number,l:any)=>n+l.quantity,0)-back.reduce((n:number,l:any)=>n+l.quantity,0),net:String(total(lines,l=>l.net)-total(back,l=>l.net))};}).filter(p=>p.quantity||p.net!=='0');
 return json({canLinkServiceDomains:links.canLinkServiceDomains,serviceAgentChoices:links.serviceAgentChoices,receivingAccounts,templates:all.filter(r=>r.type==='sales_template'),allocationPlans:accounts.flatMap(a=>a.credits.map(c=>({agentId:a.agentId,creditId:c.id,...allocationPlan(all,a.agentId,c.id,today)}))),today,me:u.userId,meName:u.name,roles:{buildIntake:buildIntakeRoles(u).sales,leads:!trainingContext.getStore()&&!u.permissions.serviceAgentId&&!u.permissions.hospitalCenterId&&salesStaff(u),agent:salesRep(u),manager:salesManager(u),staff:salesStaff(u),viewer:salesViewer(u),reportRead:salesReportRead(u),finance:salesFinance(u),warehouse:salesWarehouse(u)},agents:links.agents.map((a,i)=>({...representativePublic(a,salesManager(u)),canOperate:(salesStaff(u)||salesFinance(u)||salesRep(u))&&canOperate[i]})),products,members,goals:rows.filter(r=>r.type==='sales_goal'&&r.data.state==='active').map(g=>({...g,progress:goalProgress(g,rows,today)})),prices:rows.filter(r=>r.type==='sales_price'),targets:rows.filter(r=>r.type==='sales_target').map(t=>({...t,progress:salesTargetProgress(t,rows,today)})),orders:rows.filter(r=>r.type==='sales_order'),accounts,openings:rows.filter(r=>r.type==='sales_opening'),files:rows.filter(r=>r.type==='sales_file').map(publicSalesFile),deliveries,pipeline,tasks,reports:{products:reportProducts,netSales:String(total(invoices.filter(i=>!i.data.openingId),i=>i.data.amount)-total(returns,r=>r.data.amount)),collections:String(total(rows.filter(r=>r.type==='sales_payment'&&!r.data.openingId).flatMap(r=>r.data.financialEvents||[]),e=>e.delta)),discounts:String(total(invoices.filter(i=>!i.data.openingId),i=>i.data.discount)),returns:String(total(returns,r=>r.data.amount))},help:salesHelp});
 }catch(e){return accessResponse(e)||json({error:'دریافت فروش انجام نشد.'},503)}}
async function post(request:Request){try{
 checkOrigin(request);const u=await liveSalesUser(await requireAccess()),b=JSON.parse(new TextDecoder().decode(await boundedBody(request,128000))),db=storage(),id=req(b.id,80),mode=req(b.mode),now=new Date().toISOString(),today=dayAt();
 if(!/^[0-9a-f-]{36}$/i.test(id)||b.confirmed!==true||!Object.hasOwn(salesActions,mode))fail('شناسه عملیات و تأیید صریح لازم است.');
 const allowed=mode==='check_disposition_request'?salesRep(u):['check_disposition_review','order_finance_review'].includes(mode)?salesFinance(u):['agent','price','target'].includes(mode)?salesManager(u):['terms','invoice','payment_review','check_status','allocate','payment_reverse','return_review','opening_review'].includes(mode)?salesFinance(u):mode==='branch_release'?salesManager(u)||salesFinance(u):mode==='return_receive'?salesWarehouse(u):['order_review','order_progress','opening'].includes(mode)?salesStaff(u)||mode==='opening'&&salesFinance(u):salesRep(u)||salesStaff(u)||salesFinance(u);
 if(!allowed||mode==='return_request'&&!salesRep(u)&&!salesStaff(u))fail('مجوز این مرحله فروش را ندارید.',403);
 const agent=mode==='price'&&!b.agentId?null:mode==='agent'&&!b.agentId?null:await salesScope(u,req(b.agentId));
 if(agent?.data.kind==='referrer'&&['payment','opening','invoice','order'].includes(mode))fail('عامل معرف حساب پورسانت دارد؛ ثبت خرید یا دریافت وجه خرید مجاز نیست.');
 const signature=mode==='agent'&&!b.agentId?'sha256:'+await digest(JSON.stringify(b)):JSON.stringify(b),prior:any=await db.prepare('SELECT actor,payload FROM inventory_operations WHERE id=?').bind(id).first();if(prior){if(prior.actor!==u.userId||prior.payload!==signature)fail('شناسه برای درخواست دیگری استفاده شده است.',409);return json({saved:true,repeated:true,id:prior.target||id,automaticAccount:mode==='agent'&&!b.agentId?await initialRepresentativeAccount(db,id,'sales'):null});}
 const checks=await salesLock(db,id),stmts:D1PreparedStatement[]=[],rows=await salesRows(),membersSnapshot=await leadMembers();checks.push(leadMemberGuard(db,id,membersSnapshot));if(!u.isAdmin&&!u.profileReview&&!trainingContext.getStore()){const m=membersSnapshot.find(m=>m.status==='active'&&(m.subject===u.userId||'local:'+m.id===u.userId));if(!m||JSON.stringify(storedAccessPermissions(m.permissions))!==JSON.stringify(u.permissions))fail('دسترسی تغییر کرده است.',403);}
 const guard=(q:string,...v:any[])=>checks.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN '+q+' THEN guard ELSE 0 END WHERE id=?').bind(...v,id));
 if(agent)guard("EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)",agent.id,agent.revision);
 const get=async(eid:string,type:string)=>{const e=await salesEntity(eid,type);if(agent&&e.data.agentId!==agent.id)fail('رکورد متعلق به این نماینده نیست.',404);guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',e.id,e.revision);return e;};
 const revision=(e:any)=>{if(e.revision!==b.revision)fail('نسخه پرونده تغییر کرده است؛ تازه‌سازی کنید.',409);};
 const submission=mode==='payment'?salesPaymentSubmission(u,agent!.id,b.requestSource,now):salesProxyModes.includes(mode)?salesSubmission(u,agent!.id,b.requestSource,now,mode!=='order'):null;
 const put=(eid:string,type:string,data:any,old?:any)=>{const updated={...data,...(submission?{submission:old?.data.submission||submission,lastSubmission:submission}:{}),history:[...(old?.data.history||[]),{mode,actor:u.userId,actorName:u.name,at:now,notes:txt(b.notes||'',4000),...(submission?{submission}:{})}]};stmts.push(old?db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(updated),now,eid,old.revision):db.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').bind(eid,type,JSON.stringify(updated),now,now));const at=rows.findIndex(r=>r.id===eid),virtual={id:eid,type,data:updated,revision:(old?.revision||0)+1,created:old?.created||now,updated:now};if(at<0)rows.push(virtual);else rows[at]=virtual;return updated;};
 const state=(e:any,states:string[])=>{if(!states.includes(e.data.state))fail('وضعیت این پرونده برای اقدام انتخابی معتبر نیست.',409);};
 const notes=()=>req(b.notes,4000);const own=()=>{if(!agent)fail('نماینده لازم است.');return agent!;};const account=()=>salesAccounts(rows,own().id,today);
 async function member(mid:string,role:'sales'|'finance'|'manager'){if(!mid)return '';const r:any=await db.prepare("SELECT permissions FROM app_members WHERE id=? AND status='active'").bind(mid).first();const actor={isAdmin:false,permissions:r?storedAccessPermissions(r.permissions):{}} as any;if(!r||!(role==='sales'?salesStaff(actor):role==='manager'?salesManager(actor):salesFinance(actor)))fail('مسئول فعال با دسترسی این مرحله انتخاب کنید.');guard("EXISTS(SELECT 1 FROM app_members WHERE id=? AND status='active' AND permissions=?)",mid,r.permissions);return mid;}
 const installments=(items:any[],amount:string)=>{const result=arr(items,36).map((i,index)=>({id:String(index+1),due:sday(i.due),amount:money(i.amount,true)}));if(total(result,i=>i.amount)!==rial(amount))fail('جمع اقساط باید دقیقاً برابر مبلغ فاکتور باشد.');return result;};
 function canHold(order:any, orderId?:string){
  const credit=salesSecuredCredit(rows,own().id,today,orderId);
  return rial(order.amount)<=rial(credit.netAvailable);
 }
 async function reserveOrder(orderId:string,order:any){
  const reservations:{line:any;devices:any[];qualityChecks:D1PreparedStatement[]}[]=[];
  for(const line of order.lines){
   const devices=(await db.prepare("SELECT f.id,f.revision,f.data FROM flow_entities f JOIN records r ON r.id=f.id JOIN inventory_balances b ON b.item_id=f.id AND b.warehouse='finished' AND b.quantity=1000 WHERE f.type='build' AND json_extract(f.data,'$.state')='finished' AND json_extract(r.payload,'$.product')=? ORDER BY json_extract(f.data,'$.receivedAt'),f.id LIMIT ?").bind(line.productId,line.quantity).all()).results;
   if(devices.length!==line.quantity)return false;
   const qualityChecks:D1PreparedStatement[]=[];
   try{
    for(const row of devices)qualityChecks.push(await qmsDispatchGuard(String(row.id),id));
   }catch(error){
    if(error instanceof Error&&'status' in error&&error.status===409)return false;
    throw error;
   }
   reservations.push({line,devices,qualityChecks});
  }
  for(const [index,{line,devices,qualityChecks}] of reservations.entries()){
   checks.push(...qualityChecks);
   const saleId=orderId+':secured:'+index;
   for(const row of devices){
    const did=String(row.id),buildData=JSON.parse(String(row.data));
    await assertWarehouseNotCounting(db,buildData.warehouseId||'');
    guard("EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) AND EXISTS(SELECT 1 FROM inventory_balances WHERE item_id=? AND warehouse='finished' AND quantity=1000)",did,row.revision,did);
    put(did,'build',{...buildData,state:'reserved',saleId},{revision:row.revision,data:buildData});
   }
   put(saleId,'sale',{salesOrderId:orderId,salesAgentId:own().id,partyId:own().id,productId:line.productId,invoiceId:'',deliveryMode:'sale',recipient:order.recipient,deviceIds:devices.map(row=>row.id),count:line.quantity,state:'reserved',by:u.name,actor:u.userId,notes:'رزرو سفارش پیش از صدور فاکتور',handedOverDeviceIds:[]});
  }
  return true;
 }
 let automaticAccount:any=null;let target=id;
 if(mode==='agent'){
  if(agent)revision(agent);const active=b.active;if(typeof active!=='boolean')fail('وضعیت نماینده لازم است.');const name=req(b.name),phone=txt(b.phone||'',50),address=req(b.address,2000),location=normalizeIranLocation(b.province,b.city,agent?.data),province=location.province,city=location.city,contact=txt(b.contact||'',200)||name;
  const kind=txt(b.kind||agent?.data.kind||'representative',40);if(!['representative','reseller','branch','end_customer','referrer'].includes(kind))fail('نوع خریدار معتبر نیست.');
  target=agent?.id||id;if(!agent){const account=await automaticRepresentativeAccount(db,{agentId:target,name:contact,nationalId:b.nationalId,mobile:b.mobile,kind:'sales',active},u.userId,now);stmts.push(...account.statements);automaticAccount=account.summary;b.nationalId=account.identity.nationalId;b.mobile=account.identity.mobile;}const profile={...agent?.data,...(!agent?{nationalId:b.nationalId,mobile:b.mobile}:{}),name,phone,address,province,city,contact,contractRef:txt(b.contractRef||'',500),active,ownerId:await member(txt(b.ownerId||'',200),'sales'),financeId:await member(txt(b.financeId||'',200),'finance'),managerId:await member(txt(b.managerId??agent?.data.managerId??'',200),'manager'),kind,creditLimit:agent?.data.creditLimit||'0',termDays:agent?.data.termDays||0};const linked=await salesRepresentationLinks({db,user:u,operationId:id,now,guard,put},b,agent,profile);put(target,'sales_agent',linked,agent);
 }else if(mode==='terms'){
  revision(own());notes();put(agent!.id,'sales_agent',{...agent!.data,creditLimit:money(b.creditLimit),termDays:integer(b.termDays,0,365)},agent);target=agent!.id;
 }else if(mode==='price'){
  if(rows.some(r=>r.type==='sales_price'&&r.data.productId===b.productId&&r.data.pricingApprovalId))fail('برای این محصول قیمت مصوب بهای تمام‌شده داریم؛ تغییر قیمت از پیشنهاد قیمت و سود با تأیید مدیرعامل انجام می‌شود.',403);
  const productId=req(b.productId),product:any=await db.prepare("SELECT payload FROM records WHERE id=? AND kind='product'").bind(productId).first();if(!product)fail('محصول یافت نشد.',404);guard("EXISTS(SELECT 1 FROM records WHERE id=? AND kind='product' AND payload=?)",productId,product.payload);const old=b.priceId?await salesEntity(req(b.priceId),'sales_price'):null;if(old?.data.pricingApprovalId)fail('قیمت مصوب بهای تمام‌شده فقط با مصوبه جدید مدیرعامل تغییر می‌کند.',403);if(old){revision(old);if(old.data.agentId!==(agent?.id||'')||old.data.productId!==productId)fail('نماینده و محصول قیمت قابل تغییر نیست.');}if(typeof b.active!=='boolean')fail('وضعیت قیمت لازم است.');
  if(rows.some(r=>r.type==='sales_price'&&r.id!==old?.id&&r.data.agentId===(agent?.id||'')&&r.data.productId===productId))fail('این قیمت وجود دارد؛ همان ردیف را ویرایش کنید.',409);target=old?.id||id;put(target,'sales_price',{agentId:agent?.id||'',productId,unitPrice:money(b.unitPrice,true),active:b.active,reference:req(b.reference,300)},old);
 }else if(mode==='target'){
  const start=sday(b.start),end=sday(b.end);if(start>end||end<today)fail('بازه تارگت معتبر نیست.');if(!['net','units'].includes(b.basis))fail('مبنای تارگت معتبر نیست.');const productIds=b.productIds;if(!Array.isArray(productIds)||productIds.length>100||new Set(productIds).size!==productIds.length)fail('فهرست محصولات معتبر نیست.');for(const pid of productIds){if(!await db.prepare("SELECT id FROM records WHERE id=? AND kind='product'").bind(req(pid)).first())fail('محصول تارگت یافت نشد.');guard("EXISTS(SELECT 1 FROM records WHERE id=? AND kind='product')",pid);}
  const tiers=arr(b.tiers,12).map(t=>({threshold:money(t.threshold,true),discountBps:integer(t.discountBps,0,9000)}));if(tiers.some((t,i)=>i>0&&(rial(t.threshold)<=rial(tiers[i-1].threshold)||t.discountBps<=tiers[i-1].discountBps)))fail('آستانه و درصد هر پلکان باید صعودی باشد.');
  const previous=b.previousId?await get(req(b.previousId),'sales_target'):null;if(previous){revision(previous);state(previous,['active']);put(previous.id,'sales_target',{...previous.data,state:'retired',replacementId:id},previous);}if(rows.some(r=>r.type==='sales_target'&&r.id!==previous?.id&&r.data.agentId===own().id&&r.data.state==='active'&&r.data.start<=end&&r.data.end>=start))fail('بازه با تارگت فعال دیگر همپوشانی دارد.');
  put(id,'sales_target',{agentId:own().id,start,end,basis:b.basis,productIds,tiers,title:req(b.title),state:'active',previousId:previous?.id||'',version:(previous?.data.version||0)+1,policy:'net-invoiced-next-order-v1',notes:notes()});
 }else if(mode==='order'){
  if(b.referrerId)await salesScope(u,req(b.referrerId));const quote=await salesQuote(own(),b.items,rows,b);for(const l of quote.lines){const p:any=await db.prepare("SELECT payload FROM records WHERE id=? AND kind='product'").bind(l.productId).first();if(!p||JSON.parse(p.payload).status!=='فعال')fail('محصول فعال نیست.');guard("EXISTS(SELECT 1 FROM records WHERE id=? AND kind='product' AND payload=?)",l.productId,p.payload);}if(quote.quoteHash!==b.quoteHash)fail('پیش‌فاکتور تغییر کرده؛ قیمت تازه را ببینید و تأیید کنید.',409);if(b.leadId){const conversion=await leadConvert(u,req(b.leadId),b.leadRevision,id,own().id,b.items,id);stmts.push(...conversion.statements);}const secured=own().data.kind==='representative'&&quote.deliveryMode!=='consignment';
  const overdue=rial(account().overdue)>BigInt(0), within=secured&&canHold(quote), staffOrder=salesStaff(u)&&!salesRep(u);
  const auto=within&&!overdue&&staffOrder&&await reserveOrder(id,quote);
  put(id,'sales_order',{...quote,...(secured?{securedPolicy:true,securedHold:auto?quote.amount:'0',salesBlock:overdue?'overdue':!within?'credit':auto?'':'review'}:{}),...(b.leadId?{leadId:b.leadId}:{}),code:'SO-'+id.slice(0,8).toUpperCase(),state:auto?'sales_approved':'submitted',createdBy:u.userId,customerReference:txt(b.customerReference||'',200),notes:txt(b.notes||'',4000),promisedDay:'',milestone:'waiting_stock'});
 }else if(['order_review','order_finance_review','order_progress','order_cancel','invoice','branch_release'].includes(mode)){
  const order=await get(req(b.orderId),'sales_order');revision(order);target=order.id;
  if(order.data.securedPolicy&&['order_review','order_finance_review'].includes(mode)){
   if(typeof b.approved!=='boolean')fail('نتیجه بررسی لازم است.');
   const financial=mode==='order_finance_review';
   if(!financial&&!salesManager(u))fail('بررسی سفارش فقط با مدیر فروش است.',403);
   state(order,[financial?'credit_review':'submitted']);
   const reason=notes();
   if(!b.approved){
    put(order.id,'sales_order',{...order.data,state:financial?'submitted':'rejected',salesBlock:financial?'overdue':'',salesReview:reason},order);
   }else if(!financial&&rial(account().overdue)>BigInt(0)){
    put(order.id,'sales_order',{...order.data,state:'credit_review',salesReview:reason},order);
   }else{
    if(!canHold(order.data,order.id))fail('اعتبار کافی نیست؛ پرداخت یا ضمانت تکمیلی را ثبت کنید.',409);
    const reserved=await reserveOrder(order.id,order.data);
    if(!reserved&&order.data.dispatchPaymentDays===undefined)fail('موجودی آزاد برای رزرو کل سفارش کافی نیست.',409);
    put(order.id,'sales_order',{...order.data,state:'sales_approved',securedHold:order.data.amount,salesBlock:'',salesReview:reason,...(financial?{overdueApprovedBy:u.userId,overdueApprovedAt:now}:{})},order);
   }
  }else if(mode==='order_review'){if(order.data.salesTerms&&!salesManager(u))fail('تأیید پیش‌فاکتور فقط با مدیر فروش است.',403);if(order.data.salesTerms&&order.data.createdBy===u.userId)fail('پیشنهاد خود را مدیر دیگری تأیید کند.',403);state(order,['submitted']);if(typeof b.approved!=='boolean')fail('نتیجه بررسی لازم است.');put(order.id,'sales_order',{...order.data,state:b.approved?'sales_approved':'rejected',salesReview:notes()},order);
  }else if(mode==='order_cancel'){state(order,['submitted','sales_approved','credit_review']);if(order.data.securedPolicy&&order.data.state==='sales_approved'){
   const openSales=(await db.prepare("SELECT id,revision,data FROM flow_entities WHERE type='sale' AND json_extract(data,'$.salesOrderId')=? AND json_extract(data,'$.state')='reserved'").bind(order.id).all()).results;
   for(const sale of openSales){
    const d=JSON.parse(String(sale.data));
    for(const did of d.deviceIds){
     const row=await salesEntity(did,'build');
     if(row.data.state!=='reserved'||row.data.saleId!==sale.id)fail('وضعیت رزرو تغییر کرده است.',409);
     guard("EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)",did,row.revision);
     put(did,'build',{...row.data,state:'finished',saleId:null},row);
    }
    guard("EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)",sale.id,sale.revision);
    put(String(sale.id),'sale',{...d,state:'cancelled',cancelledBy:u.name,cancelledAt:now},sale);
   }
  }put(order.id,'sales_order',{...order.data,state:'cancelled',cancelReason:notes()},order);
  }else if(mode==='order_progress'){state(order,['sales_approved','approved']);if(!Object.hasOwn(salesMilestones,b.milestone))fail('مرحله معتبر انتخاب کنید.');const promisedDay=sday(b.promisedDay);if(promisedDay<today)fail('موعد وعده جدید در گذشته نباشد.');put(order.id,'sales_order',{...order.data,promisedDay,milestone:b.milestone,progressNote:notes()},order);
  }else if(mode==='branch_release'){
   if(order.data.deliveryMode!=='consignment'||agent!.data.kind!=='branch')fail('فقط سفارش شعبه با مسیر امانی قابل آزادسازی است.');
   state(order,['sales_approved']);
   put(order.id,'sales_order',{...order.data,state:'approved',invoiceId:'',consignmentApprovedBy:u.userId,consignmentApprovedAt:now,approvedBy:u.userId,approvedAt:now},order);
  }else{
   if(order.data.deliveryMode==='consignment'||agent!.data.kind==='branch')fail('سفارش شعبه امانی فاکتور فروش قطعی ندارد؛ از تأیید ارسال امانی استفاده کنید.');
   state(order,['sales_approved']);if(!own().data.active)fail('نمایندگی غیرفعال است.');const a=account(),exposure=rial(a.balance)+rial(order.data.amount),limit=rial(order.data.securedPolicy?salesSecuredCredit(rows,own().id,today,order.id).ceiling:agent!.data.creditLimit);const exception=order.data.securedPolicy?rial(a.overdue)>BigInt(0):exposure>limit||rial(a.overdue)>BigInt(0);if(order.data.securedPolicy&&(!canHold(order.data,order.id)||exception&&!order.data.overdueApprovedBy))fail('شرایط مالی یا سقف ضمانت تغییر کرده است؛ سفارش نیاز به بررسی دارد.',409);if(!order.data.securedPolicy&&exception&&(b.creditException!==true||!txt(b.exceptionReason||'',2000)))fail('سقف اعتبار یا بدهی معوق مانع تأیید است؛ تصمیم استثنای مستند مالی لازم است.');
   const reference=req(b.reference,300);if(rows.some(r=>r.type==='sales_invoice'&&r.data.reference===reference))fail('شماره فاکتور تکراری است.');const dispatchPaymentDays=order.data.dispatchPaymentDays;
   const plan=order.data.salesTerms||dispatchPaymentDays!==undefined
    ?termsPlan(order.data.amount,order.data.salesTerms||{cashBps:0,days:dispatchPaymentDays},today)
    :installments(b.installments,order.data.amount);
   if((order.data.salesTerms||dispatchPaymentDays!==undefined)&&b.installments&&JSON.stringify(b.installments.map((p:any)=>({due:p.due,amount:p.amount})))!==JSON.stringify(plan.map(p=>({due:p.due,amount:p.amount}))))fail('اقساط باید عین شرایط مصوب مدیر باشد.');if(plan.some(i=>i.due<today))fail('سررسید فاکتور جدید در گذشته نباشد.');
   put(id,'sales_invoice',{agentId:own().id,orderId:order.id,reference,day:today,salesTerms:order.data.salesTerms||null,referral:order.data.referral||null,lines:order.data.lines,amount:order.data.amount,discount:order.data.discount,installments:dispatchPaymentDays===undefined?plan:deferDispatchBalance(plan),dispatchPaymentDays,openingId:'',creditReview:{exposure:String(exposure),limit:String(limit),overdue:a.overdue,exception,reason:exception?(order.data.securedPolicy?order.data.salesReview:req(b.exceptionReason,2000)):'',by:u.userId},province:own().data.province});
   if(order.data.securedPolicy){
    const held=(await db.prepare("SELECT id,revision,data FROM flow_entities WHERE type='sale' AND json_extract(data,'$.salesOrderId')=? AND json_extract(data,'$.state')='reserved'").bind(order.id).all()).results;
    for(const line of order.data.lines){
     if(dispatchPaymentDays===undefined&&held.filter(row=>JSON.parse(String(row.data)).productId===line.productId).reduce((count,row)=>count+Number(JSON.parse(String(row.data)).count),0)!==line.quantity)fail('رزرو کامل سفارش لازم است.',409);
    }
    for(const row of held){
     guard("EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)",row.id,row.revision);
     put(String(row.id),'sale',{...JSON.parse(String(row.data)),invoiceId:id},row);
    }
   }
   put(order.id,'sales_order',{...order.data,state:'approved',invoiceId:id,approvedBy:u.userId,approvedAt:now},order);
   const replacements=(await db.prepare("SELECT * FROM flow_entities WHERE type='sale' AND json_extract(data,'$.salesAgentId')=? AND json_extract(data,'$.replacementReturnId') IS NOT NULL AND json_extract(data,'$.state')='reserved' AND COALESCE(json_extract(data,'$.replacementReady'),0)=0 AND COALESCE(json_extract(data,'$.salesOrderId'),'')='' ORDER BY created,id").bind(own().id).all()).results.map(row=>({id:String(row.id),revision:Number(row.revision),created:String(row.created),data:JSON.parse(String(row.data))}));
   if(order.data.deliveryMode!=='consignment')for(const sale of replacements){
    guard("EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)",sale.id,sale.revision);
    put(String(sale.id),'sale',{...sale.data,salesOrderId:order.id,invoiceId:id,recipient:order.data.recipient,replacementReady:true},sale);
    const returned=await get(sale.data.replacementReturnId,'sales_return');stmts.push(...await returnTaskStatements(returned.id,returned.data,own().data,'attached'));
   }
  }
 }else if(mode==='payment'){
  const old=b.paymentId?await get(req(b.paymentId),'sales_payment'):null;if(old){revision(old);state(old,['pending','rejected']);if(old.data.openingId)fail('افتتاحیه از فرم پرداخت تغییر نمی‌کند.');}
  if(!['bank','cash','check'].includes(b.method))fail('روش پرداخت معتبر نیست.');
  const amount=money(b.amount,true),day=sday(b.day);if(day>today)fail('تاریخ پرداخت در آینده نیست.');
  const receivingAccountId=b.method==='bank'?txt(b.receivingAccountId||'',200):'';
  const assigned=usesAssignedSalesAccounts(own().data.kind);
  const existingDestination=old?.data.method==='bank'&&old.data.receivingAccountId===receivingAccountId;
  const destinations=b.method==='bank'?await dbReceivingAccounts():[];
  const destination=destinations.find(account=>account.id===receivingAccountId);
  if(b.method==='bank'&&!existingDestination){
   if(!receivingAccountId&&(assigned||destinations.length))fail('حساب مقصد شرکت را برای این واریز انتخاب کنید.');
   if(receivingAccountId&&(!destination||assigned&&!own().data.receivingAccountIds?.includes(receivingAccountId)))fail('این حساب مقصد برای خریدار فعال یا تخصیص داده نشده است.');
   if(assigned)guard("EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)",own().id,own().revision);
   if(destination)guard("EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)",destination.id,destination.revision);
  }
  const bank=destination?.title||(existingDestination?old!.data.bank:txt(b.bank||'',200));
  const normalizedBank=bank.toLowerCase().replace(/\s+/g,''),reference=req(b.reference,300),normalizedReference=reference.toLowerCase().replace(/\s+/g,'');
  if(b.method!=='cash'&&!bank)fail('بانک لازم است.');
  if(rows.some(r=>r.type==='sales_payment'&&r.id!==old?.id&&r.data.method===b.method&&(!receivingAccountId||!r.data.receivingAccountId)&&(r.data.normalizedBank||r.data.bank?.toLowerCase().replace(/\s+/g,''))===normalizedBank&&r.data.normalizedReference===normalizedReference))fail('این مرجع پرداخت قبلاً ثبت شده است؛ سابقه را بررسی کنید.',409);
  const file=b.fileId?await get(req(b.fileId),'sales_file'):null;
  if(b.method==='check'&&!file)fail('تصویر چک همین نماینده لازم است.');
  if(receivingAccountId&&rows.some(r=>r.type==='sales_payment'&&r.id!==old?.id&&r.data.receivingAccountId===receivingAccountId&&r.data.normalizedReference===normalizedReference))fail('این تراکنش برای حساب مقصد قبلاً ثبت شده است.',409);
  if(b.method==='bank'&&rows.some(r=>r.type==='sales_payment'&&r.id!==old?.id&&r.data.bankRowId&&bankCode(r.data.reference||'')===bankCode(reference)&&(!receivingAccountId||r.data.receivingAccountId===receivingAccountId)))fail('این پیگیری قبلاً به وصول بانکی متصل شده است؛ سابقه بانک را بررسی کنید.',409);
  const checkDue=b.method==='check'?sday(b.checkDue):'';const cashOrderId=txt(b.cashOrderId||'',200),checkInvoiceId=txt(b.checkInvoiceId||'',200);if(cashOrderId){if(b.method==='check')fail('وجه نقد خرید جدید نمی‌تواند چک باشد.');const o=await get(cashOrderId,'sales_order');state(o,['sales_approved','approved']);if(!o.data.salesTerms)fail('خرید فاقد شرایط مصوب است.');if(!rows.some(r=>r.type==='sales_invoice'&&r.data.orderId===o.id))fail('ابتدا فاکتور خرید جدید صادر شود تا وجه نقد به قسط مصوب متصل شود.');}if(b.method==='check'&&b.checkPurpose==='collateral'&&checkInvoiceId)fail('چک ضمانت به فاکتور پرداخت متصل نمی‌شود.');if(checkInvoiceId)await get(checkInvoiceId,'sales_invoice');target=old?.id||id;put(target,'sales_payment',{agentId:own().id,method:b.method,receivingAccountId,amount,day,bank,normalizedBank,reference,normalizedReference,fileId:file?.id||'',checkDue,cashOrderId,checkInvoiceId,...(b.method==='check'?{checkVerification:{}}:{}),state:'pending',checkPurpose:b.method==='check'&&b.checkPurpose==='collateral'?'collateral':'payment',submittedBy:u.userId,notes:txt(b.notes||'',4000)},old);
 }else if(['check_disposition_request','check_disposition_review'].includes(mode)){
  const payment=await get(req(b.paymentId),'sales_payment');
  revision(payment);
  state(payment,['received']);
  if(payment.data.method!=='check'||payment.data.bankRowId)fail('چک پرداخت وصول‌نشده لازم است.');
  const position=salesCheckPosition(payment,account(),today);
  const previous=payment.data.disposition;
  let disposition;
  let next=payment.data.state;
  if(mode==='check_disposition_request'){
   if(!position.canRequest||!['return','collateral'].includes(b.disposition))fail('درخواست تنها پس از سررسید و تسویهٔ کامل پیش از موعد مجاز است.',409);
   disposition={kind:b.disposition,state:'pending',requestedBy:u.userId,requestedAt:now};
  }else{
   if(previous?.state!=='pending'||typeof b.approved!=='boolean')fail('درخواست باز و نتیجهٔ بررسی لازم است.',409);
   const reason=notes();
   disposition={...previous,state:b.approved?'approved':'rejected',reviewedBy:u.userId,reviewedAt:now,reason};
   if(b.approved){
    if(!position.settledBeforeDue)fail('تسویهٔ فاکتور تغییر کرده است؛ درخواست را دوباره بررسی کنید.',409);
    if(previous.kind==='collateral'){
     const amount=money(b.amount,true);
     if(rial(amount)>rial(payment.data.amount))fail('مبلغ ضمانت از مبلغ چک بیشتر است.');
     disposition.amount=amount;
     next='check_collateral';
    }else{
     next='check_returned';
    }
   }
  }
  target=payment.id;
  put(payment.id,'sales_payment',{...payment.data,state:next,disposition,previousDispositions:mode==='check_disposition_request'&&previous?[...(payment.data.previousDispositions||[]),previous]:payment.data.previousDispositions},payment);
 }else if(['payment_review','check_status','payment_reverse'].includes(mode)){
  const p=await get(req(b.paymentId),'sales_payment');revision(p);target=p.id;let next='',checkVerification=p.data.checkVerification;
  if(mode==='payment_review'&&b.approved===true&&p.data.method==='bank'&&rows.some(r=>r.type==='sales_payment'&&r.id!==p.id&&r.data.bankRowId&&bankCode(r.data.reference||'')===bankCode(p.data.reference||'')&&(!p.data.receivingAccountId||r.data.receivingAccountId===p.data.receivingAccountId)))fail('این پرداخت با وصول بانکی دیگری تعارض دارد؛ از بخش تطبیق بانک بررسی کنید.',409);
  if(mode==='payment_review'){
   state(p,['pending']);
   if(typeof b.approved!=='boolean')fail('نتیجه بررسی لازم است.');
   if(!b.approved)next='rejected';
   else if(p.data.method!=='check')next='cleared';
   else {
    const evidence=b.checkEvidence;
    if(evidence!=='physical'&&evidence!=='registry')fail('دریافت اصل چک یا تأیید سامانه‌ای را جداگانه ثبت کنید.');
    if(checkVerification?.[evidence])fail('این مرحله قبلاً ثبت شده است.',409);
    checkVerification={...checkVerification,[evidence]:{by:u.userId,at:now}};
    next=checkVerification.physical&&checkVerification.registry?(p.data.checkPurpose==='collateral'?'check_collateral':'received'):'pending';
   }
  }
  if(mode==='check_status'){if(p.data.method!=='check')fail('این پرداخت چک نیست.');if(!['cleared','bounced'].includes(b.state))fail('وضعیت چک معتبر نیست.');state(p,b.state==='cleared'?['received']:['received','cleared','check_collateral']);if(b.state==='cleared'&&salesCheckPosition(p,account(),today).requiresReview)fail('مبلغ چک بیشتر از مانده فاکتور است؛ ابتدا چک را تعیین تکلیف کنید.',409);if(p.data.checkDue>today)fail('تاریخ وصول چک هنوز نرسیده است.');next=b.state;}
  if(p.data.bankRowId)fail('وصول متصل به بانک را از بخش پوز و تطبیق دریافت‌ها بررسی یا برگشت بزنید.');
  if(mode==='payment_reverse'){state(p,['cleared']);next='reversed';}
  const events=[...(p.data.financialEvents||[])];if(next==='cleared'||p.data.state==='cleared')events.push({id,day:today,at:now,delta:next==='cleared'?p.data.amount:String(-rial(p.data.amount)),state:next});
  put(p.id,'sales_payment',{...p.data,financialEvents:events,state:next,...(checkVerification?{checkVerification}:{}),...(next==='check_collateral'?{disposition:{kind:'collateral',state:'approved',amount:p.data.amount,reviewedBy:u.userId,reviewedAt:now}}:{}),reviewedBy:u.userId,reviewedAt:now,reviewNotes:notes()},p);
 }else if(mode==='allocate'){
  const plan=allocationPlan(rows,own().id,req(b.creditId),today);if(!plan.allocations.length)fail('اعتبار آزاد قابل تخصیص وجود ندارد.');
  if(b.allocations&&JSON.stringify(b.allocations)!==JSON.stringify(plan.allocations))fail('تخصیص باید مطابق اولویت خودکار باشد؛ پیش‌نمایش را تازه کنید.',409);
  plan.allocations.forEach((l,i)=>put(id+':'+i,'sales_allocation',{agentId:own().id,creditId:b.creditId,...l,by:u.userId,policy:plan.policy}));
  plan.recoveries.forEach((r,i)=>put(id+':recovery:'+i,'sales_check_recovery',{agentId:own().id,creditId:b.creditId,...r,by:u.userId}));notes();
 }else if(mode==='return_request'){
  if(!['refund','replacement'].includes(b.resolution))fail('عودت وجه یا جایگزین را انتخاب کنید.');const invoice=await get(req(b.invoiceId),'sales_invoice');if(invoice.data.openingId)fail('برگشت افتتاحیه بدون اتصال سریال قابل ثبت نیست.');const deviceIds=arr(b.deviceIds,100).map(v=>req(v));if(deviceIds.length!==1)fail('برای هر سریال برگشتی یک پرونده جدا ثبت کنید.');const deliveries=await salesDelivery(rows,[own().id]),lines:any[]=[],serials:string[]=[];let sourceSaleId='';
  for(const did of deviceIds){const sale=deliveries.find(s=>s.orderId===invoice.data.orderId&&s.state==='delivered'&&s.deviceIds.includes(did))!;if(!sale)fail('سریال باید تحویل‌شده همین فاکتور باشد.');const build=await salesEntity(did,'build');if(build.data.state!=='delivered'||build.data.saleId!==sale.id)fail('این سریال در تحویل جاری همین مشتری نیست.',409);guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',build.id,build.revision);sourceSaleId=sale.id;if(rows.some(r=>r.type==='sales_return'&&r.data.invoiceId===invoice.id&&r.data.state!=='rejected'&&r.data.deviceIds.includes(did)))fail('برای این سریال پرونده برگشت موجود است.');const original=invoice.data.lines.find((l:any)=>l.productId===sale.productId);if(!original)fail('ردیف فاکتور با سریال منطبق نیست.');const productLine=lines.find(l=>l.productId===sale.productId);if(productLine){productLine.quantity++;productLine.net=String(rial(productLine.net)+rial(original.unitNet));}else lines.push({productId:sale.productId,name:original.name,quantity:1,unitNet:original.unitNet,net:original.unitNet});const r:any=await db.prepare("SELECT payload FROM records WHERE id=? AND kind='device'").bind(did).first();serials.push(r?JSON.parse(r.payload).code:did);}
  const createdReturn=put(id,'sales_return',{agentId:own().id,invoiceId:invoice.id,deviceIds,serials,lines,amount:String(total(lines,l=>l.net)),state:'requested',reason:notes(),workflowVersion:1,intake:'review',resolution:b.resolution,sourceSaleId});
  stmts.push(...await returnTaskStatements(id,createdReturn,own().data));
 }else if(mode==='return_receive'){
  const r=await get(req(b.returnId),'sales_return');if(r.data.workflowVersion)fail('این پرونده را در کارتابل مرجوعی دنبال کنید.',409);revision(r);state(r,['requested']);if(b.physicallyReceived!==true)fail('دریافت فیزیکی باید تأیید شود.');const receipt=req(b.receipt,300);for(const did of r.data.deviceIds){const build=await salesEntity(did,'build');await assertWarehouseNotCounting(db,build.data.warehouseId||'');guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',build.id,build.revision);if(build.data.state!=='delivered')fail('وضعیت دستگاه برای برگشت معتبر نیست.');stmts.push(db.prepare('INSERT INTO inventory_balances(id,item_id,warehouse,quantity) VALUES(?,?,?,0) ON CONFLICT(id) DO NOTHING').bind(did+'@quarantine',did,'quarantine'),db.prepare("UPDATE inventory_balances SET quantity=quantity+1000 WHERE item_id=? AND warehouse='quarantine'").bind(did),db.prepare('INSERT INTO inventory_entries(id,operation_id,item_id,warehouse,delta) VALUES(?,?,?,?,1000)').bind(crypto.randomUUID(),id,did,'quarantine'));put(did,'build',{...build.data,state:'sales_return_quarantine',returnId:r.id},build);}
  put(r.id,'sales_return',{...r.data,state:'returned',receipt,receivedBy:u.userId,receivedAt:now,condition:notes()},r);target=r.id;
 }else if(mode==='return_review'){
  const r=await get(req(b.returnId),'sales_return');if(r.data.workflowVersion)fail('این پرونده را در کارتابل مرجوعی دنبال کنید.',409);revision(r);if(typeof b.approved!=='boolean')fail('نتیجه بررسی لازم است.');state(r,b.approved?['returned']:['requested']);put(r.id,'sales_return',{...r.data,state:b.approved?'credited':'rejected',reviewedBy:u.userId,reviewedAt:now,reviewNotes:notes()},r);target=r.id;
 }else if(mode==='opening'){
  const source=req(b.source,200),asOf=sday(b.asOf),reference=req(b.reference,300);if(asOf>today)fail('تاریخ مبنا در آینده نیست.');const items=arr(b.items,100).map((i,index)=>{if(!['invoice','credit','check'].includes(i.kind))fail('نوع ردیف افتتاحیه معتبر نیست.');const day=sday(i.day);if(day>asOf)fail('تاریخ ردیف پس از تاریخ مبنا نیست.');return {index,kind:i.kind,legacyId:req(i.legacyId,200),reference:req(i.reference,300),amount:money(i.amount,true),day,due:i.kind==='credit'?'':sday(i.due),bank:i.kind==='check'?req(i.bank,200):'',key:JSON.stringify([source,req(i.legacyId,200)])};});
  if(new Set(items.map(i=>i.key)).size!==items.length)fail('شناسه قدیمی در فایل تکرار شده است.');const debt=String(total(items.filter(i=>i.kind==='invoice'),i=>i.amount)),credit=String(total(items.filter(i=>i.kind==='credit'),i=>i.amount));if(money(b.expectedDebt)!==debt||money(b.expectedCredit)!==credit)fail('جمع اعلامی منبع با ردیف‌ها تطبیق ندارد.');
  put(id,'sales_opening',{agentId:own().id,source,asOf,reference,items,debt,credit,state:'pending',preparedBy:u.userId,notes:notes()});
 }else if(mode==='opening_review'){
  const o=await get(req(b.openingId),'sales_opening');revision(o);state(o,['pending']);if(typeof b.approved!=='boolean')fail('نتیجه تطبیق لازم است.');if(b.approved){for(const i of o.data.items){if(rows.some(r=>['sales_invoice','sales_payment'].includes(r.type)&&r.data.openingKey===i.key||i.kind==='invoice'&&r.type==='sales_invoice'&&!r.data.openingId&&r.data.reference===i.reference||i.kind==='check'&&r.type==='sales_payment'&&r.data.method==='check'&&r.data.reference===i.reference&&r.data.bank.toLowerCase().replace(/\s+/g,'')===i.bank.toLowerCase().replace(/\s+/g,'')))fail('این ردیف قدیمی قبلاً وارد شده است: '+i.legacyId,409);const eid=o.id+':'+i.index,common={agentId:own().id,openingId:o.id,openingKey:i.key,legacyId:i.legacyId,source:o.data.source,reference:i.reference,amount:i.amount,day:i.day};if(i.kind==='invoice')put(eid,'sales_invoice',{...common,orderId:'',lines:[],discount:'0',installments:[{id:'1',due:i.due,amount:i.amount}],province:own().data.province});else put(eid,'sales_payment',{...common,method:i.kind==='check'?'check':'opening',state:i.kind==='check'?'received':'cleared',checkDue:i.due,bank:i.bank,normalizedReference:i.reference.toLowerCase().replace(/\s+/g,''),reviewedBy:u.userId});}}
  put(o.id,'sales_opening',{...o.data,state:b.approved?'approved':'rejected',reconciledBy:u.userId,reconciledAt:now,reconciliation:notes()},o);target=o.id;
 }else fail('عملیات ناشناخته است.');
 // Allocate newly confirmed credit and free balances atomically with the financial event.
 if(agent&&['invoice','payment_review','check_status','return_review','opening_review'].includes(mode)){
  const credits=salesAccounts(rows,agent.id,today).credits.sort((a,b)=>a.created.localeCompare(b.created)||a.id.localeCompare(b.id));
  for(const [ci,c] of credits.entries()){const plan=allocationPlan(rows,agent.id,c.id,today);plan.allocations.forEach((l,i)=>put(id+':auto:'+ci+':'+i,'sales_allocation',{agentId:agent.id,creditId:c.id,...l,policy:plan.policy,by:u.userId}));plan.recoveries.forEach((r,i)=>put(id+':recovery:'+ci+':'+i,'sales_check_recovery',{agentId:agent.id,creditId:c.id,...r,by:u.userId}));}
 }
 await db.batch([db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(id,'sales_'+mode,signature,u.userId,now),...checks,...stmts,db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,target,'sales_'+mode,signature,now)]);
 let followupPending=false;try{await syncSalesTasks();if(b.leadId)await syncLeadTasks();await scanSalesMonitor({reports:false,source:'event'});}catch{followupPending=true;}return json({saved:true,id:target,followupPending,automaticAccount});
 }catch(e){return accessResponse(e)||json({error:/constraint|SQLITE|D1/i.test(String(e))?'اطلاعات هم‌زمان تغییر کرده است؛ فهرست را تازه و نتیجه را بررسی کنید.':'ثبت انجام نشد؛ ورودی‌ها را بررسی کنید.'},409)}}

export const GET=withRepresentativeSample(get);
export const POST=withRepresentativeSample(post);
