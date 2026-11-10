import {storage} from './storage';
import {warehouseTarget} from './warehouse-workspace';
import {mcpActor} from './mcp/context';
import type {DispatchRow} from './warehouse-dispatch';
import {transportCanSee} from './transport';
import {roleProfiles,materialProfileWork,treasuryTestTarget,salesBankRowTarget,salesBankTestTarget,type ProfileWork} from './role-profiles';
import {coverage,nextWork} from './sourcing';
import type {Session} from './permissions';
import {rewardPeriods,salesRewardProgress} from './sales-rewards';
import {dayAt} from './duties';
import {rial,salesAccounts,salesOrderProgress} from './sales-contract';
import {shortageRoles,canActOnShortage,shortageStages,type Shortage} from './handoff-shortage';
import {treasuryProfileTest,treasuryRows} from './treasury';
import {bankEntities} from './sales-bank';
import {bankAmbiguities} from './sales-bank-contract';
import {runBankProfileTest} from './sales-bank-profile-test';

export async function handoffShortageWork(user:Session):Promise<ProfileWork[]>{
 const roles=shortageRoles(user);
 if(!Object.values(roles).some(Boolean))return [];
 const rows=(await storage().prepare("SELECT id,data FROM flow_entities WHERE type='handoff' AND json_type(data,'$.shortages')='object' AND json_extract(data,'$.state')='pending'").all()).results;
 return rows.flatMap(row=>{
  const id=String(row.id),data=JSON.parse(String(row.data));
  return Object.entries(data.shortages as Record<string,Shortage>).filter(([,item])=>canActOnShortage(roles,item.stage)).map(([deviceId,item])=>({
   id:id+':'+deviceId,title:shortageStages[item.stage]+' · '+deviceId.replace(/^device:/,''),section:'fulfillment',target:'handoff-shortage:'+id,sourceId:id,state:item.stage,
  }));
 });
}
/** Position queue from real domain stages, never fabricated assignees. */
export async function profileWork(user:Session){
 const profile=roleProfiles.find(p=>p.id===user.profileReview?.id);if(!profile?.operational)return {work:[],pendingQuality:0};
 const db=storage(),rows=(await db.prepare("SELECT id,type,data FROM flow_entities WHERE type IN ('receipt','request','sourcing_plan','sourcing_quote','purchase_order','worker_output','scrap_transfer','scrap_sale_request','build','inventory_count','build_project','handoff','worker_nonconforming','line_return','worker_count_round','receipt_observation','routine_lot','transport') ORDER BY id").all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)}));
 const work:ProfileWork[]=materialProfileWork(profile.id,rows);
 const competing=new Set<string>();
 if(profile.id==='finance-director'){
  const accounts=await treasuryProfileTest(user,treasuryRows);
  for(const account of accounts.filter(row=>row.data.state==='review'))work.push({id:account.id+':treasury-test',title:'تأیید حساب آزمایشی · '+account.data.title,section:'treasury',target:treasuryTestTarget+account.id,sourceId:account.id,state:'review'});
 }
 if(profile.id==='sales-finance'){
  const live=await bankEntities(),test=await runBankProfileTest(user,()=>bankEntities());
  for(const [records,target] of [[live,salesBankRowTarget],[test,salesBankTestTarget]] as const){
   for(const {row,assessment} of bankAmbiguities(records)){
    for(const candidate of assessment.candidates)competing.add(candidate.id);
    work.push({id:row.id+':bank-conflict',title:'مغایرت واریز بانکی'+(target===salesBankTestTarget?' آزمایشی':''),section:'sales-bank',target:target+row.id,sourceId:row.id,state:'pending'});
   }
  }
  for(const payment of test.filter(row=>row.type==='sales_payment'&&row.data.state==='pending'&&!competing.has(row.id)))work.push({id:payment.id+':payment-test',title:'بررسی اعلام واریز آزمایشی',section:'sales-bank',target:salesBankTestTarget,sourceId:payment.id,state:'pending'});
 }
 if(profile.workflowRoles.length){for(const plan of rows.filter(r=>r.type==='sourcing_plan')){
  const steps=nextWork(plan,rows.filter(r=>r.type==='sourcing_quote'&&r.data.planId===plan.id),rows.filter(r=>r.type==='purchase_order'&&r.data.planId===plan.id),await coverage(plan));
  for(const step of steps.filter(s=>profile.workflowRoles.includes(s.role)))work.push({id:plan.id+':'+step.key,title:step.title,section:step.sourceSection||'sourcing',target:step.sourceId||plan.id,sourceId:plan.id,state:plan.data.state});
 }}
 if(profile.id==='logistics'){
  for(const mission of rows.filter(row=>row.type==='transport')){
   const d=mission.data;
   const title=d.blocker?.state==='open'?'پیگیری مانع حمل':d.state==='requested'?'تخصیص مأموریت حمل':d.state==='disputed'?'رسیدگی به مغایرت حمل':!d.inbound&&['carrier','offered'].includes(d.state)?'پیگیری تحویل محموله':'';
   if(title&&await transportCanSee(user,mission)){
    work.push({id:mission.id+':transport',title:title+' · '+d.code,section:'transport',target:mission.id,sourceId:mission.id,state:d.state});
   }
  }
 }
 if(profile.id==='driver'&&user.profileReview?.missionId){
  const mission=rows.find(row=>row.type==='transport'&&row.id===user.profileReview?.missionId);
  const d=mission?.data;
  const title=d?.blocker?.state==='open'?'پیگیری مانع حمل':d?.state==='assigned'?'چک‌لیست و تحویل‌گیری بار':d?.state==='collected'?'ثبت تحویل یا ارسال بار':d?.missingDocuments?'تکمیل مدارک حمل':'';
  if(mission&&title)work.push({id:mission.id+':driver',title:title+' · '+d.code,section:'transport',target:mission.id,sourceId:mission.id,state:d.state});
 }
 if(profile.id==='central-store'){
  const {GET}=await import('@/app/api/warehouse/dispatch/route');
  const response=await mcpActor.run(user,()=>GET(new Request('https://internal.invalid/api/warehouse/dispatch')));
  if(response.ok){
   const {rows:dispatch}=await response.json() as {rows:DispatchRow[]};
   for(const order of dispatch.filter(row=>['منتظر رزرو / آماده‌سازی','منتظر آماده‌سازی','آماده ارسال','منتظر حواله انبار'].includes(row.state))){
    work.push({id:order.id+':dispatch',title:'آماده‌سازی و ارسال سفارش '+order.reference,section:'warehouse',target:warehouseTarget('fulfillment',order.id,'dispatch'),sourceId:order.sourceId,state:order.state});
   }
  }
 }
 const {returnRoles,returnActions}=await import('./sales-return-contract');
 if(Object.values(returnRoles(user)).some(Boolean)){
  const {returnWorkspace}=await import('./sales-return-workflow'),{items=[]}=await returnWorkspace(user);
  for(const item of items)for(const action of item.actions)work.push({id:item.id+':'+action,title:returnActions[action]+' · '+item.serial,section:'sales-returns',target:item.id,sourceId:item.id,state:'open'});
 }
 if(['home-sales','hospital-sales','sales-manager','sales-finance','sales-representative'].includes(profile.id)){
  const {salesRows,salesVisible,salesDelivery}=await import('./sales'),sales=await salesRows();
  const buyerIds=new Set<string>();
  for(const buyer of sales.filter(row=>row.type==='sales_agent'&&row.data.active))if(await salesVisible(user,buyer))buyerIds.add(buyer.id);
  const own=sales.filter(row=>buyerIds.has(row.data.agentId));
  function addWork(row:any,title:string,section='sales',target=''){
   work.push({id:row.id+':'+profile!.id,title,section,target,sourceId:row.id,state:row.data.state});
  }
  for(const row of own){
   if(profile.id==='sales-finance'&&row.type==='sales_reward'&&row.data.state==='active'&&salesRewardProgress(row,sales,dayAt()).ready){
    const period=row.data.period as keyof typeof rewardPeriods;
    addWork(row,'تأیید '+rewardPeriods[period],'sales','sales-view:reward-'+period+':'+row.id);
   }
   if(profile.id==='sales-manager'&&row.type==='sales_order'&&row.data.state==='submitted')addWork(row,'بررسی سفارش '+row.data.code,'sales','order:'+row.id);
   if(profile.id==='sales-finance'&&row.type==='sales_order'&&['credit_review','sales_approved'].includes(row.data.state))addWork(row,'بررسی مالی سفارش '+row.data.code,'sales','order:'+row.id);
   if(profile.id==='sales-finance'&&row.type==='sales_payment'&&!competing.has(row.id)&&(row.data.state==='pending'||row.data.disposition?.state==='pending'))addWork(row,'بررسی پرداخت یا چک','sales','account:'+row.data.agentId);

  }
  if(['home-sales','hospital-sales'].includes(profile.id)){
   const {isPartner,partnerFollowup,readSalesCalls}=await import('./sales-calls');
   const {usesSalesCallSample,withSalesCallSample}=await import('./sales-call-sample');
   if(usesSalesCallSample(user)){
    const sample=await withSalesCallSample(user,()=>readSalesCalls(user));
    for(const buyer of sample.open.filter(row=>row.due<=sample.today))addWork({id:buyer.id,data:{state:'open'}},'پیگیری '+buyer.name+' · '+buyer.reasons.join('؛ '),'sales','sales-view:calls:'+buyer.id);
   }
   for(const buyer of sales.filter(row=>row.type==='sales_agent'&&buyerIds.has(row.id)&&isPartner(row))){
    const follow=partnerFollowup(buyer,sales,dayAt());
    if(follow.reasons.length&&follow.due<=dayAt())addWork(buyer,'پیگیری '+buyer.data.name+' · '+follow.reasons.join('؛ '),'sales','sales-view:calls:'+buyer.id);
   }
  }
  if(profile.id==='sales-manager'){
   const {readSalesCalls}=await import('./sales-calls');
   const {withSalesCallSample}=await import('./sales-call-sample');
   const callReview=await withSalesCallSample(user,()=>readSalesCalls(user));
   for(const call of callReview.referrals.filter(row=>row.data.referral.state==='open')){
    addWork(call,'رسیدگی به ارجاع تماس · '+call.data.name,'sales','sales-view:calls:referral:'+call.id);
   }
  }
  if(profile.id==='home-sales'){
   const today=dayAt(),deliveries=await salesDelivery(own,[...buyerIds]);
   for(const order of own.filter(row=>row.type==='sales_order'&&!['cancelled','rejected'].includes(row.data.state))){
    const progress=salesOrderProgress(order,deliveries,today);
    if(progress.stage!=='delivered')addWork(order,'پیگیری سفارش '+order.data.code,'sales','order:'+order.id);
   }
   for(const buyerId of buyerIds){
    const account=salesAccounts(own,buyerId,today);
    for(const invoice of account.invoices){
     if(invoice.installments.some((part:any)=>part.days<=7&&rial(part.remaining)>BigInt(0))){
      addWork(invoice,'پیگیری سررسید فاکتور '+invoice.data.reference,'sales','account:'+buyerId);
     }
    }
   }
  }
  if(['hospital-sales','sales-manager'].includes(profile.id)&&buyerIds.size){
   const intakes=(await db.prepare("SELECT id,data FROM flow_entities WHERE type='build_intake' AND json_extract(data,'$.state')=?").bind(profile.id==='sales-manager'?'commercial_review':'returned').all()).results;
   for(const row of intakes){const data=JSON.parse(String(row.data));if(buyerIds.has(data.agentId))addWork({id:row.id,data},profile.id==='sales-manager'?'بررسی تجاری سفارش ساخت':'اصلاح مشخصات سفارش ساخت','build-intake',String(row.id));}
  }
  if(profile.id==='sales-representative'){
   const seen=new Set<string>();
   for(const delivery of await salesDelivery(own,[...buyerIds])){
    const mission=delivery.transport;
    if(mission&&!mission.awaitingWaybill&&!seen.has(mission.id)&&['carrier','offered'].includes(mission.state)){seen.add(mission.id);addWork({id:mission.id,data:{state:mission.state}},'تأیید دریافت محموله '+mission.code,'transport',mission.id);}
   }
  }
 }
 const allowed=work.filter(w=>!w.warehouseId||!['central-store','line-store','quality'].includes(profile.id)||user.profileReview!.warehouseIds.includes(w.warehouseId));
 return {work:allowed,pendingQuality:profile.id==='central-store'?rows.filter(r=>r.type==='receipt'&&['pending_qc','awaiting_qc_template'].includes(r.data.state)&&user.profileReview!.warehouseIds.includes(r.data.warehouseId)).length:0};
}
