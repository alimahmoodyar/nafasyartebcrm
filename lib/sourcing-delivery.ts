// Calendar days, calculated from an ISO calendar day (never elapsed 24h/DST).
export const hasDeliveryDays=(d:any)=>Number.isInteger(d?.deliveryDays)&&d.deliveryDays>=0&&d.deliveryDays<=3650;
export function addDeliveryDays(start:string,days:number){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!hasDeliveryDays({deliveryDays:days}))throw Error('مدت یا مبدأ تحویل معتبر نیست.');
 const date=new Date(start+'T12:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==start)throw Error('مبدأ تحویل معتبر نیست.');
 date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);
}
export function quoteEstimatedEta(d:any,today:string){return hasDeliveryDays(d)?addDeliveryDays(today,d.deliveryDays):d?.eta||'';}
export function needsPurchaseConfirmation(d:any){return hasDeliveryDays(d)&&!d.purchaseConfirmedAt;}
export function deliveryDaysInput(value:unknown){
 if(typeof value!=='number'&&typeof value!=='string'||!/^\d{1,4}$/.test(String(value)))throw Error('مدت تحویل باید تعداد روز صحیح از صفر تا ۳۶۵۰ باشد.');
 const n=Number(value);if(!hasDeliveryDays({deliveryDays:n}))throw Error('مدت تحویل باید تعداد روز صحیح از صفر تا ۳۶۵۰ باشد.');return n;
}
