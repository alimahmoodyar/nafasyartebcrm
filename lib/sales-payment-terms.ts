import {solarParts,solarToIso,solarMonthDays} from './persian-date';

export const maxSalesPaymentDays=366;
export function addSolarMonths(day:string,months:number){
 const p=solarParts(day),n=p.month-1+months,y=p.year+Math.floor(n/12),m=n%12+1;
 return solarToIso(y,m,Math.min(p.day,solarMonthDays(y,m)));
}
export function addPaymentDays(day:string,days:number){return new Date(Date.parse(day+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);}
// Calendar-month snapshots remain intact. Their day equivalent depends on the
// actual sale day, rather than an assumed 30-day month.
const monthDays=(day:string,months:number)=>Math.round((Date.parse(addSolarMonths(day,months))-Date.parse(day))/86400000);
export function salesPaymentDays(terms:any,day:string):number{return terms?.days!==undefined?terms.days:monthDays(day,Number(terms?.months??1));}
export function salesPaymentMaxDays(terms:any,day:string):number{return terms?.maxDays!==undefined?terms.maxDays:terms?.days!==undefined?maxSalesPaymentDays:monthDays(day,Number(terms?.maxMonths??12));}
