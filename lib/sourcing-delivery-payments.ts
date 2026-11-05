import {moneyMicro} from './costing';

// Only posted, non-void advance payments for this supplier/order. Plans,
// authorizations, unrelated invoice allocations and future postings never count.
export function purchaseAdvanceEvidence(order:any,cases:any[],today:string){
 const d=order.data;if(d.deliveryStart!=='advance_payment')return {satisfied:true,sources:[] as {caseId:string;revision:number;paymentIds:string[]}[]};
 if(typeof d.requiredAdvanceRial!=='string'||!/^\d+$/.test(d.requiredAdvanceRial)||BigInt(d.requiredAdvanceRial)<=BigInt(0))return {satisfied:false,sources:[]};
 let paid=BigInt(0);const sources:{caseId:string;revision:number;paymentIds:string[]}[]=[];
 for(const c of cases){if(c.data.supplierId!==d.supplierId||c.data.route!==d.route)continue;
  const advances=(c.data.advances||[]).filter((a:any)=>!a.voided&&a.orderId===order.id&&!a.serviceId),ids:string[]=[];
  for(const p of c.data.payments||[]){if(p.voided||p.serviceId||!p.advanceId||!advances.some((a:any)=>a.id===p.advanceId)||p.orderId&&p.orderId!==order.id||!/^\d{4}-\d{2}-\d{2}$/.test(p.day||'')||p.day>today)continue;
   const amount=moneyMicro(p.amount);if(amount<=BigInt(0))continue;paid+=amount;ids.push(p.id);
  }
  if(ids.length)sources.push({caseId:c.id,revision:c.revision,paymentIds:ids});
 }
 return {satisfied:paid>=BigInt(d.requiredAdvanceRial)*BigInt(1000000),sources};
}
