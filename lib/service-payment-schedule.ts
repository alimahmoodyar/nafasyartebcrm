const zero=BigInt(0),positive=(n:bigint)=>n>zero?n:zero,min=(a:bigint,b:bigint)=>a<b?a:b;
export function serviceTimeline(exit:string,due:string,today:string){
 const start=Date.parse(exit+'T00:00:00Z'),end=Date.parse(due+'T00:00:00Z'),now=Date.parse(today+'T00:00:00Z');if(!Number.isFinite(start)||!Number.isFinite(end)||!Number.isFinite(now)||end<=start)return null;
 const extent=Math.max(end,now)-start,ratio=(value:number)=>Math.max(0,Math.min(100,(value-start)/extent*100)),duePct=ratio(end),todayPct=ratio(now);
 return {duePct,todayPct,normalPct:Math.min(duePct,todayPct),overduePct:Math.max(0,todayPct-duePct)};
}
/** Read-only aging. Invoice-level settlements use oldest-maturity-first allocation. */
export function servicePaymentProjection(account:any[],orders:any[],maturities:any[],held:any[],today:string){
 const rows:any[]=[],orderIds=new Set(orders.map(o=>o.id));
 for(const order of orders){
  const invoice=account.find(r=>r.kind==='invoice'&&r.source_id===order.id);if(!invoice)continue;
  let allocated=positive(BigInt(invoice.debit)-BigInt(invoice.remaining));
  for(const maturity of maturities.filter(m=>m.orderId===order.id).sort((a,b)=>a.due.localeCompare(b.due)||a.shipmentId.localeCompare(b.shipmentId))){
   const amount=BigInt(maturity.amountRial),settled=min(amount,allocated);allocated-=settled;
   const remaining=amount-settled,hold=min(remaining,held.filter(c=>c.data.orderId===order.id&&(c.data.shipmentId?c.data.shipmentId===maturity.shipmentId:c.data.due===maturity.due)).reduce((n,c)=>n+BigInt(c.data.amountRial),zero));
   rows.push({...maturity,orderCode:order.data.code||'سفارش '+order.id.slice(0,8),settledRial:settled.toString(),remainingRial:remaining.toString(),heldRial:hold.toString(),paymentRial:(remaining-hold).toString(),days:Math.round((Date.parse(maturity.due+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000)});
  }
 }
 rows.sort((a,b)=>a.due.localeCompare(b.due)||a.orderId.localeCompare(b.orderId)||a.shipmentId.localeCompare(b.shipmentId));
 let credit:bigint=account.reduce((n:bigint,r:any)=>n+(BigInt(r.credit)>zero?BigInt(r.remaining):zero),zero);
 const offset=(row:any)=>{const used=min(BigInt(row.paymentRial),credit);credit-=used;row.paymentRial=(BigInt(row.paymentRial)-used).toString();row.remainingRial=(BigInt(row.remainingRial)-used).toString();row.settledRial=(BigInt(row.settledRial)+used).toString();};
 rows.filter(r=>r.days<=0).forEach(offset);
 // Due non-order debits (e.g. money paid back) consume credit before future maturities.
 const otherDue=account.filter(r=>BigInt(r.debit)>zero&&!(r.kind==='invoice'&&orderIds.has(r.source_id))&&(r.due||r.data?.day||r.created.slice(0,10))<=today).reduce((n:bigint,r:any)=>n+BigInt(r.remaining),zero);
 const otherPayable=positive(otherDue-credit);credit=positive(credit-otherDue);rows.filter(r=>r.days>0).forEach(offset);
 // One projection supplies both the total demand and per-shipment figures.
 const net=positive(account.reduce((n:bigint,r:any)=>n+BigInt(r.debit)-BigInt(r.credit),zero));
 const collectibleRial=min(net,rows.filter(r=>r.days<=0).reduce((n:bigint,r:any)=>n+BigInt(r.paymentRial),zero)+otherPayable).toString();
 let demand=BigInt(collectibleRial);
 for(const row of rows){row.payableNowRial=row.days<=0?min(BigInt(row.paymentRial),demand).toString():'0';demand-=BigInt(row.payableNowRial);}
 return {paymentSchedule:rows.filter(r=>BigInt(r.remainingRial)>zero),collectibleRial};
}
export function serviceSchedulePage(collection:any,page=1,pageSize=10){
 const {paymentSchedule=[],...rest}=collection,total=paymentSchedule.length,pages=Math.max(1,Math.ceil(total/pageSize)),current=Math.min(page,pages);
 return {...rest,paymentSchedule:paymentSchedule.slice((current-1)*pageSize,current*pageSize),schedulePage:current,schedulePages:pages,scheduleTotal:total,asOf:collection.asOf};
}
export function servicePaymentSteps(rows:any[],orderId:string){
 return rows.filter(r=>r.orderId===orderId&&r.days<=7&&BigInt(r.days<=0?r.payableNowRial:r.paymentRial)>zero).flatMap(r=>['agent','coordinator','finance'].map(role=>({key:'payment:'+(r.shipmentId||'invoice'),role,due:r.due,title:r.days<0?'پیگیری پرداخت سررسیدگذشته قطعات':r.days===0?'پرداخت قطعات — سررسید امروز':'یادآوری سررسید قطعات',sourceId:'service-orders:'+orderId,instructions:'مبلغ باقیمانده این بخش: '+(r.days<=0?r.payableNowRial:r.paymentRial)+' ریال؛ تاریخ سررسید: '+r.due+'. '+(r.days<0?-r.days+' روز تأخیر':r.days===0?'سررسید امروز':r.days+' روز تا سررسید')+'. مبالغ متوقف گارانتی در مبلغ پرداخت نیست. پرداخت فقط پس از تأیید و ثبت در حساب اثر دارد.'})));
}
