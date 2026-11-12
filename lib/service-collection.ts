import {list,ledger,monthsAfter} from './after-sales';
import {dayAt,addDay} from './duties';
import {storage} from './storage';
import {servicePaymentProjection} from './service-payment-schedule';
export const collectionPolicyId='service-collection:home';
export const defaultCollectionPolicy={dispatchDays:7,reviewDays:3};
export async function collectionPolicy(){const row=(await list('as_service_collection_policy')).find(r=>r.id===collectionPolicyId);return {id:collectionPolicyId,revision:row?.revision||0,...defaultCollectionPolicy,...row?.data};}
// Invoice debt is created at order time. Dispatch creates maturity, never another debit.
export function serviceMaturities(orders:any[],shipments:any[]){
 const result:any[]=[];
 for(const o of orders){const d=o.data;if(d.state==='rejected')continue;
  if(d.deadlineBasis!=='warehouse_exit'){if(d.due)result.push({orderId:o.id,shipmentId:'',due:d.due,amountRial:d.totalRial});continue;}
  const used:Record<string,number>={};
  for(const s of shipments.filter(s=>s.data.orderId===o.id&&s.data.exitDay).sort((a,b)=>a.data.exitDay.localeCompare(b.data.exitDay)||a.id.localeCompare(b.id))){let amount=BigInt(0);
   for(const row of s.data.lines){const line=d.lines.find((l:any)=>l.id===row.lineId);if(!line)continue;const before=used[line.id]||0,after=Math.min(line.quantity,before+row.quantity);const allocated=(q:number)=>BigInt(line.totalRial)*BigInt(q)/BigInt(line.quantity);amount+=allocated(after)-allocated(before);used[line.id]=after;}
   result.push({orderId:o.id,shipmentId:s.id,exitDay:s.data.exitDay,shipmentLabel:s.data.tracking||'محموله '+s.id.slice(0,8),due:monthsAfter(s.data.exitDay,1),amountRial:amount.toString()});
  }
 }
 return result;
}
export function claimCollectionHold(claim:any,report:any,policy:any,today:string){
 const d=claim.data,r=report?.data;if(!r?.reportSubmittedAt||!d.due||dayAt(new Date(r.reportSubmittedAt))>d.due||d.rejectedAt||['rejected','credited','approved'].includes(d.state))return false;
 const deadline=addDay(dayAt(new Date(r.reportSubmittedAt)),r.returnDispatchDays||policy.dispatchDays);
 if(['sent','received'].includes(d.state))return dayAt(new Date(d.sentAt||d.receivedAt))<=deadline;
 return d.state==='awaiting_return'&&today<=addDay(dayAt(new Date(r.reportSubmittedAt)),r.returnDispatchDays||policy.dispatchDays);
}
export async function serviceCollection(agentId:string,today=dayAt()){
 const scoped=async(type:string)=>(await storage().prepare("SELECT * FROM flow_entities WHERE type=? AND json_extract(data,'$.agentId')=? ORDER BY created,id").bind(type,agentId).all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)}));
 const [account,orders,shipments,claims,cases,policy]=await Promise.all([ledger(agentId),scoped('as_order'),scoped('as_shipment'),scoped('as_claim'),scoped('as_case'),collectionPolicy()]);
 const ownOrders=orders.filter(o=>o.data.agentId===agentId),maturities=serviceMaturities(ownOrders,shipments),held=claims.filter(c=>c.data.agentId===agentId&&claimCollectionHold(c,cases.find(r=>r.id===c.data.caseId),policy,today));
 const net=account.reduce((n:bigint,r:any)=>n+BigInt(r.debit)-BigInt(r.credit),BigInt(0)),positive=(n:bigint)=>n>BigInt(0)?n:BigInt(0);
 const {paymentSchedule,collectibleRial}=servicePaymentProjection(account,ownOrders,maturities,held,today);
 const holdTotal=held.reduce((n:bigint,c:any)=>n+BigInt(c.data.amountRial),BigInt(0));
 const collectibleOrders=ownOrders.map(o=>{const rows=paymentSchedule.filter(r=>r.orderId===o.id&&r.days<=0);return {orderId:o.id,due:rows[0]?.due||'',amountRial:rows.reduce((n:bigint,r:any)=>n+BigInt(r.payableNowRial),BigInt(0)).toString()}});
 return {netRial:net.toString(),debtorRial:positive(net).toString(),creditorRial:positive(-net).toString(),heldWarrantyRial:holdTotal.toString(),collectibleRial,collectibleOrders,maturities,heldClaims:held.map(c=>({id:c.id,caseId:c.data.caseId,amountRial:c.data.amountRial,state:c.data.state,due:c.data.due})),policy,asOf:today,paymentSchedule};
}
