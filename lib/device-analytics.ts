export type DailyCount={date:string;count:number};
const persian=new Intl.DateTimeFormat('en-US-u-ca-persian',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Tehran'});
export function localDay(value:string){
 if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
 const d=new Date(value);if(!Number.isFinite(d.getTime()))return '';
 const parts=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Tehran'}).formatToParts(d);
 const get=(t:string)=>parts.find(p=>p.type===t)?.value;return `${get('year')}-${get('month')}-${get('day')}`;
}
export function buckets(rows:DailyCount[],from:string,to:string,monthly:boolean){
 const counts=new Map(rows.map(r=>[r.date,r.count]));const result=new Map<string,{date:string;label:string;count:number}>();
 for(let d=new Date(from+'T12:00:00Z'),end=new Date(to+'T12:00:00Z');d<=end;d.setUTCDate(d.getUTCDate()+1)){
 const iso=d.toISOString().slice(0,10),parts=persian.formatToParts(d),get=(t:string)=>parts.find(p=>p.type===t)?.value||'';
 const key=monthly?`${get('year')}/${get('month')}`:iso;
 const label=monthly?new Intl.DateTimeFormat('fa-IR',{year:'numeric',month:'long',timeZone:'Asia/Tehran'}).format(d):new Intl.DateTimeFormat('fa-IR',{year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',timeZone:'Asia/Tehran'}).format(d);
 const row=result.get(key)||{date:key,label,count:0};row.count+=counts.get(iso)||0;result.set(key,row);
 }return [...result.values()];
}
