import {storage} from './storage';
import {warehouseTarget} from './warehouse-workspace';
import {mcpActor} from './mcp/context';
import type {DispatchRow} from './warehouse-dispatch';
import {roleProfiles,materialProfileWork,type ProfileWork} from './role-profiles';
import {coverage,nextWork} from './sourcing';
import type {Session} from './permissions';
/** Position queue from real domain stages, never fabricated assignees. */
export async function profileWork(user:Session){
 const profile=roleProfiles.find(p=>p.id===user.profileReview?.id);if(!profile?.operational)return {work:[],pendingQuality:0};
 const db=storage(),rows=(await db.prepare("SELECT id,type,data FROM flow_entities WHERE type IN ('receipt','request','sourcing_plan','sourcing_quote','purchase_order','worker_output','scrap_transfer','scrap_sale_request','build','inventory_count','build_project','handoff','worker_nonconforming','line_return','worker_count_round','receipt_observation','routine_lot') ORDER BY id").all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)}));
 const work:ProfileWork[]=materialProfileWork(profile.id,rows);
 if(profile.workflowRoles.length){for(const plan of rows.filter(r=>r.type==='sourcing_plan')){
  const steps=nextWork(plan,rows.filter(r=>r.type==='sourcing_quote'&&r.data.planId===plan.id),rows.filter(r=>r.type==='purchase_order'&&r.data.planId===plan.id),await coverage(plan));
  for(const step of steps.filter(s=>profile.workflowRoles.includes(s.role)))work.push({id:plan.id+':'+step.key,title:step.title,section:step.sourceSection||'sourcing',target:step.sourceId||plan.id,sourceId:plan.id,state:plan.data.state});
 }}
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
 const allowed=work.filter(w=>!w.warehouseId||!['central-store','line-store','quality'].includes(profile.id)||user.profileReview!.warehouseIds.includes(w.warehouseId));
 return {work:allowed,pendingQuality:profile.id==='central-store'?rows.filter(r=>r.type==='receipt'&&['pending_qc','awaiting_qc_template'].includes(r.data.state)&&user.profileReview!.warehouseIds.includes(r.data.warehouseId)).length:0};
}
