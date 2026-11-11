import {list,ledger,monthsAfter} from './after-sales';
import {dayAt,addDay} from './duties';
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
   result.push({orderId:o.id,shipmentId:s.id,exitDay:s.data.exitDay,due:monthsAfter(s.data.exitDay,1),amountRial:amount.toString()});
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
 const [account,orders,shipments,claims,cases,policy]=await Promise.all([ledger(agentId),list('as_order'),list('as_shipment'),list('as_claim'),list('as_case'),collectionPolicy()]);
 const ownOrders=orders.filter(o=>o.data.agentId===agentId),maturities=serviceMaturities(ownOrders,shipments),held=claims.filter(c=>c.data.agentId===agentId&&claimCollectionHold(c,cases.find(r=>r.id===c.data.caseId),policy,today));
 const net=account.reduce((n:bigint,r:any)=>n+BigInt(r.debit)-BigInt(r.credit),BigInt(0)),positive=(n:bigint)=>n>BigInt(0)?n:BigInt(0),min=(a:bigint,b:bigint)=>a<b?a:b;
 let holdTotal=BigInt(0);
 const collectibleOrders:any[]=[];
 for(const o of ownOrders){const invoice=account.find(r=>r.kind==='invoice'&&r.source_id===o.id);if(!invoice)continue;const matured=maturities.filter(m=>m.orderId===o.id&&m.due<=today),maturedRial=matured.reduce((n,m)=>n+BigInt(m.amountRial),BigInt(0)),allocated=positive(BigInt(invoice.debit)-BigInt(invoice.remaining));const open=positive(maturedRial-allocated),hold=held.filter(c=>c.data.orderId===o.id&&c.data.due<=today).reduce((n,c)=>n+BigInt(c.data.amountRial),BigInt(0));collectibleOrders.push({orderId:o.id,due:matured.map(m=>m.due).sort()[0]||'',amountRial:positive(open-hold).toString()});holdTotal+=held.filter(c=>c.data.orderId===o.id).reduce((n,c)=>n+BigInt(c.data.amountRial),BigInt(0));}
 // Cash paid back is a real debit too. Ignoring it would incorrectly reuse the
 // same unallocated credit both for a payout and for an outstanding invoice.
 const otherDebits=account.filter(r=>BigInt(r.debit)>BigInt(0)&&!ownOrders.some(o=>r.kind==='invoice'&&r.source_id===o.id)&&(r.due||r.data.day||r.created.slice(0,10))<=today);
 let credit=account.reduce((n:bigint,r:any)=>n+(BigInt(r.credit)>BigInt(0)?BigInt(r.remaining):BigInt(0)),BigInt(0));
 for(const row of collectibleOrders.sort((a,b)=>a.due.localeCompare(b.due))){const n=BigInt(row.amountRial),offset=min(n,credit);row.amountRial=(n-offset).toString();credit-=offset;}
 const due=collectibleOrders.reduce((n:bigint,r:any)=>n+BigInt(r.amountRial),BigInt(0))+positive(otherDebits.reduce((n:bigint,r:any)=>n+BigInt(r.remaining),BigInt(0))-credit);
 return {netRial:net.toString(),debtorRial:positive(net).toString(),creditorRial:positive(-net).toString(),heldWarrantyRial:holdTotal.toString(),collectibleRial:min(positive(net),due).toString(),collectibleOrders,maturities,heldClaims:held.map(c=>({id:c.id,caseId:c.data.caseId,amountRial:c.data.amountRial,state:c.data.state,due:c.data.due})),policy};
}
