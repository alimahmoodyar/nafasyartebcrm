// Calendar days, calculated from an ISO calendar day (never elapsed 24h/DST).
export const hasDeliveryDays=(d:any)=>Number.isInteger(d?.deliveryDays)&&d.deliveryDays>=0&&d.deliveryDays<=3650;
export function addDeliveryDays(start:string,days:number){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!hasDeliveryDays({deliveryDays:days}))throw Error('مدت یا مبدأ تحویل معتبر نیست.');
 const date=new Date(start+'T12:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==start)throw Error('مبدأ تحویل معتبر نیست.');
 date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);
}
export function quoteEstimatedEta(d:any,today:string){return hasDeliveryDays(d)?addDeliveryDays(today,d.deliveryDays):d?.eta||'';}
export function needsPurchaseConfirmation(d:any){return (hasDeliveryDays(d)||!!d?.termsAmendment)&&!d.purchaseConfirmedAt;}
export function deliveryDaysInput(value:unknown){
 if(typeof value!=='number'&&typeof value!=='string'||!/^\d{1,4}$/.test(String(value)))throw Error('مدت تحویل باید تعداد روز صحیح از صفر تا ۳۶۵۰ باشد.');
 const n=Number(value);if(!hasDeliveryDays({deliveryDays:n}))throw Error('مدت تحویل باید تعداد روز صحیح از صفر تا ۳۶۵۰ باشد.');return n;
}

export function purchaseDeliveryStatus(order:any,receipts:any[],today:string){
 const data=order.data,due=data.approvedDeliveryDue||data.promisedEta;
 if(!due||data.pendingSupplierCredit||needsPurchaseConfirmation(data)||!['issued','paid','preparing','shipped','closed'].includes(data.state))return null;
 const arrivals=receipts.filter(r=>r.data.purchaseOrderId===order.id);
 const effectiveQuantity=(r:any)=>Math.max(0,r.data.quantity-(r.data.rejected||0));
 const received=arrivals.reduce((sum,r)=>sum+effectiveQuantity(r),0);
 const receivedOnTime=arrivals.filter(r=>r.data.day<=due).reduce((sum,r)=>sum+effectiveQuantity(r),0);
 const missing=Math.max(0,data.quantity-received);
 const untilDue=(Date.parse(due)-Date.parse(today))/86400000;
 const start=data.deliveryStartedOn,days=hasDeliveryDays(data)?data.deliveryDays:null,elapsed=start?(Date.parse(today)-Date.parse(start))/86400000:0;const midpoint=days!==null&&days>=4&&elapsed>=Math.floor(days/2);const near=untilDue<=Math.min(2,Math.max(0,Math.floor((days??4)/2)));
 if(data.procurementVersion!==3)return {due,missing,reminderPhase:'legacy',reminder:data.state!=='closed'&&missing>0&&untilDue<=3,late:untilDue<0&&receivedOnTime<data.quantity};
 const reminderPhase=untilDue<0?'late':near?'near':'mid';
 return {due,missing,reminderPhase,reminder:data.lastFollowupPhase!==reminderPhase&&data.state!=='closed'&&missing>0&&(near||midpoint),late:untilDue<0&&receivedOnTime<data.quantity};
}
