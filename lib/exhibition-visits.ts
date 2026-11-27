import {AccessError} from './authorization';
import {validDay} from './duties';

export const visitFields=['person','phone','city','company','position','specialty','roles','subject','note','action','assignee','due'] as const;
export type VisitData=Record<typeof visitFields[number],string>;
type Actor={id:string;manager:boolean};
const visible="(?=1 OR json_extract(data,'$.creator')=? OR json_extract(data,'$.assignee')=?)";
const kind="type='exhibition_visit'";
const scope=(a:Actor)=>[Number(a.manager),a.id,a.id];
export async function readVisits(db:D1Database,actor:Actor,event:string){
 if(!event){
  const rows=await db.prepare(`SELECT DISTINCT json_extract(data,'$.event') AS name FROM flow_entities WHERE ${kind} AND ${visible} ORDER BY name`).bind(...scope(actor)).all<{name:string}>();
  return {events:rows.results.map(r=>r.name)};
 }
 const rows=await db.prepare(`SELECT id,data,revision,updated FROM flow_entities WHERE ${kind} AND json_extract(data,'$.event')=? AND ${visible} ORDER BY updated DESC,id`).bind(event,...scope(actor)).all<{id:string;data:string;revision:number;updated:string}>();
 return {visits:rows.results.map(r=>({...r,data:JSON.parse(r.data)}))};
}
export async function saveVisit(db:D1Database,actor:Actor,b:any,eligible:string[]){
 const event=typeof b?.event==='string'?b.event.trim():'';
 if(!event||event.length>120||!/^visit-[a-f0-9-]{36}$/.test(b.id)||!Number.isSafeInteger(b.revision)||b.revision<0)throw new AccessError('اطلاعات نمایشگاه معتبر نیست.',400);
 const fields={} as VisitData;
 for(const k of visitFields){
  const v=b.fields?.[k]??'';
  if(typeof v!=='string'||v.length>(k==='note'?2000:200))throw new AccessError('مقدار فیلد معتبر نیست.',400);
  fields[k]=v.trim();
 }
 if(fields.due&&!validDay(fields.due))throw new AccessError('تاریخ پیگیری معتبر نیست.',400);
 if(fields.assignee&&fields.assignee!==actor.id&&!eligible.includes(fields.assignee))throw new AccessError('مسئول پیگیری فعال انتخاب کنید.',400);
 const draft=b.draft!==false||!fields.person||!fields.company||!fields.position||!fields.specialty||!!fields.action&&(!fields.phone||!fields.assignee||!fields.due);
 const now=new Date().toISOString();
 const data=JSON.stringify({...fields,event,draft,creator:actor.id});
 const result=b.revision===0
  ?await db.prepare("INSERT INTO flow_entities (id,type,data,revision,created,updated) VALUES (?,'exhibition_visit',?,1,?,?) ON CONFLICT(id) DO NOTHING").bind(b.id,data,now,now).run()
  :await db.prepare(`UPDATE flow_entities SET data=json_set(?, '$.creator',json_extract(data,'$.creator')),revision=revision+1,updated=? WHERE id=? AND ${kind} AND revision=? AND json_extract(data,'$.event')=? AND ${visible}`).bind(data,now,b.id,b.revision,event,...scope(actor)).run();
 if(!result.meta.changes)throw new AccessError('این بازدید تغییر کرده است. فهرست نمایشگاه را دوباره باز کنید.',409);
 return {id:b.id,revision:b.revision+1,draft};
}
