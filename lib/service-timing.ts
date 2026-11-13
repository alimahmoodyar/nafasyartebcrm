import {formatDate,localDay,persianDigits,isIsoDay} from './persian-date';
const clock=new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-arabext',{hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',timeZone:'Asia/Tehran'});
export function serviceEventMillis(value:unknown):number|null{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))return null;
 if(!isIsoDay(value.slice(0,10)))return null;const n=Date.parse(value);return Number.isFinite(n)?n:null;
}
export function serviceMoment(at:unknown,day?:string){const n=serviceEventMillis(at),knownDay=day||(typeof at==='string'&&isIsoDay(at)?at:'');return n===null?(knownDay?formatDate(knownDay)+' · ساعت ثبت نشده':'ساعت ثبت نشده'):formatDate(new Date(n))+' · '+clock.format(new Date(n));}
export function serviceElapsed(ms:number|null){if(ms===null||!Number.isFinite(ms)||ms<0)return 'نامشخص';const s=Math.floor(ms/1000);return persianDigits([Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(n=>String(n).padStart(2,'0')).join(':'));}
export function serviceStageEvents(d:any){
 let previous:number|null=null;
 return (d.history||[]).map((h:any,index:number)=>{const n=serviceEventMillis(h.at),elapsedMs=n!==null&&previous!==null&&n>=previous?n-previous:null;if(n!==null)previous=n;else previous=null;return {...h,index,elapsedMs}});
}
export function serviceCaseTiming(d:any){
 const intakeAt=d.intake?.at||(d.history||[]).find((h:any)=>['office_intake','intake'].includes(h.mode))?.at||'',exitAt=d.deliveredAt||d.returnedAt||[...(d.history||[])].reverse().find((h:any)=>['deliver','return_unrepaired'].includes(h.mode))?.at||'';
 const start=serviceEventMillis(intakeAt),end=serviceEventMillis(exitAt),exitDay=d.deliveredDay||d.returnedDay||'';
 const backdated=!!(start!==null&&d.intake?.day&&localDay(intakeAt)!==d.intake.day||end!==null&&exitDay&&localDay(exitAt)!==exitDay);
 return {intakeAt,exitAt,backdated,elapsedMs:start!==null&&end!==null&&end>=start&&!backdated?end-start:null};
}
