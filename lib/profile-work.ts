import {storage} from './storage';
import {roleProfiles,materialProfileWork,type ProfileWork} from './role-profiles';
import {coverage,nextWork} from './sourcing';
import type {Session} from './permissions';
/** Position queue from real domain stages, never fabricated assignees. */
export async function profileWork(user:Session){
 const profile=roleProfiles.find(p=>p.id===user.profileReview?.id);if(!profile?.operational)return {work:[],pendingQuality:0};
 const db=storage(),rows=(await db.prepare("SELECT id,type,data FROM flow_entities WHERE type IN ('receipt','request','sourcing_plan','sourcing_quote','purchase_order','worker_output','scrap_transfer','scrap_sale_request','build','inventory_count','build_project','handoff','worker_nonconforming','line_return','worker_count_round','receipt_observation','purchase_payable') ORDER BY id").all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)}));
 const work:ProfileWork[]=materialProfileWork(profile.id,rows);
 if(profile.workflowRoles.length){for(const plan of rows.filter(r=>r.type==='sourcing_plan')){
  const steps=nextWork(plan,rows.filter(r=>r.type==='sourcing_quote'&&r.data.planId===plan.id),rows.filter(r=>r.type==='purchase_order'&&r.data.planId===plan.id),await coverage(plan),rows.filter(r=>r.type==='receipt'));
  for(const step of steps.filter(s=>profile.workflowRoles.includes(s.role)))work.push({id:plan.id+':'+step.key,title:step.title,section:step.sourceSection||'sourcing',target:step.sourceId||plan.id,sourceId:plan.id,state:plan.data.state});
 }}
 for(const record of rows.filter(r=>r.type==='purchase_payable')){
  const route=record.data.route;
  for(const request of record.data.paymentRequests||[]){
   const add=(role:string,key:string,title:string)=>{
    if(profile.workflowRoles.includes(role))work.push({id:record.id+':'+request.id+':'+key,title,section:'sourcing',target:'purchase-payable:'+record.id,sourceId:record.id,state:request.state});
   };
   if(request.state==='finance')add('finance','review','بررسی درخواست پرداخت خرید');
   if(request.state==='approved')add('finance','execute','ثبت پرداخت مصوب خرید');
   if(request.state==='ceo'||request.state==='returned'&&request.returnedBy==='ceo'&&Object.keys(request.answers||{}).length)add('ceo','decide','تصمیم درباره درخواست پرداخت');
   if(request.state==='returned')for(const role of request.returnTo||[])if(!request.answers?.[role])add(role==='buyer'?route:role,'answer:'+role,'پاسخ به برگشت درخواست پرداخت');
   if(request.latestPaymentId&&request.paymentAcknowledgement?.paymentId!==request.latestPaymentId)add(route,'ack','مشاهده رسید پرداخت خرید');
  }
 }
 const allowed=work.filter(w=>!w.warehouseId||!['central-store','line-store','quality'].includes(profile.id)||user.profileReview!.warehouseIds.includes(w.warehouseId));
 return {work:allowed,pendingQuality:profile.id==='central-store'?rows.filter(r=>r.type==='receipt'&&['pending_qc','awaiting_qc_template'].includes(r.data.state)&&user.profileReview!.warehouseIds.includes(r.data.warehouseId)).length:0};
}
