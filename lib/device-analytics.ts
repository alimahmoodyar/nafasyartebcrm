import {formatMonth} from './persian-date';
export {localDay,solarParts,solarToIso,solarMonthDays} from './persian-date';
export type DailyCount={date:string;count:number};
const persian=new Intl.DateTimeFormat('en-US-u-ca-persian',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Tehran'});
export function buckets(rows:DailyCount[],from:string,to:string,monthly:boolean){
 const counts=new Map(rows.map(r=>[r.date,r.count]));const result=new Map<string,{date:string;label:string;count:number}>();
 for(let d=new Date(from+'T12:00:00Z'),end=new Date(to+'T12:00:00Z');d<=end;d.setUTCDate(d.getUTCDate()+1)){
 const iso=d.toISOString().slice(0,10),parts=persian.formatToParts(d),get=(t:string)=>parts.find(p=>p.type===t)?.value||'';
 const key=monthly?`${get('year')}/${get('month')}`:iso;
 const label=monthly?formatMonth(iso):new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-arabext',{year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',timeZone:'Asia/Tehran'}).format(d);
 const row=result.get(key)||{date:key,label,count:0};row.count+=counts.get(iso)||0;result.set(key,row);
 }return [...result.values()];
}
