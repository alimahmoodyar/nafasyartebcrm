import {storage} from './storage';
import {AccessError} from './authorization';

/** One operational mission, never a duplicate HR approval or a guessed allowance. */
export function approvedMissionFacts(rows:any[],memberId:string,start:string,end:string){
 const from=Date.parse(start+'T00:00:00+03:30'),until=Date.parse(end+'T23:59:59.999+03:30');
 return rows.filter(r=>r.type==='staff_mission'&&r.data.memberIds?.includes(memberId)&&r.data.state==='completed'&&Date.parse(r.data.startedAt)<=until&&Date.parse(r.data.finishedAt)>=from).map(r=>{
  const d=r.data,review=(d.returnReviews||[]).filter((x:any)=>x.decision==='approve').at(-1);
  return {id:r.id,revision:r.revision,title:d.goal||'مأموریت کاری',kind:d.kind,domain:d.domain,source:d.source,startedAt:d.startedAt,finishedAt:d.finishedAt,returnPoint:d.finish?.actualReturnPoint||d.returnPoint||'',review:review||null,amount:null as string|null,calculationStatus:'pending_policy'};
 });
}

export async function readPayrollMissionRows(memberIds:string[],start:string,end:string){
 if(!memberIds.length)return [];
 if(memberIds.length>100)throw new AccessError('حداکثر صد نفر در یک دوره انتخاب شوند.',400);
 const db=storage(),result:any[]=[];
 for(const memberId of memberIds){
  // Overlapping complete/in-progress trips are needed to expose unresolved work,
  // not only whichever 20 missions happen to appear in an operational list.
  const q=await db.prepare("SELECT id,type,data,revision,created,updated FROM flow_entities WHERE type='staff_mission' AND EXISTS(SELECT 1 FROM json_each(json_extract(data,'$.memberIds')) WHERE value=?) AND json_extract(data,'$.startedAt')<=? AND (json_extract(data,'$.finishedAt')>=? OR json_extract(data,'$.finishedAt') IS NULL) ORDER BY id LIMIT 101").bind(memberId,new Date(end+'T23:59:59.999+03:30').toISOString(),new Date(start+'T00:00:00+03:30').toISOString()).all();
  if(q.results.length>100)throw new AccessError('تعداد سفرهای این دوره بیش از سقف پردازش است؛ دوره را تفکیک کنید.',409);
  for(const row of q.results as any[])if(!result.some(x=>x.id===row.id)){const data=JSON.parse(row.data);if(!Number.isFinite(Date.parse(data.startedAt))||data.state==='completed'&&(!Number.isFinite(Date.parse(data.finishedAt))||Date.parse(data.finishedAt)<Date.parse(data.startedAt)||!(data.returnReviews||[]).some((r:any)=>r.decision==='approve')))throw new AccessError('زمان یا تأیید پایان مأموریت نیازمند بررسی منبع است.',409);result.push({...row,data});}
 }
 return result;
}

export function missionIntervalCredit(rows:any[],memberId:string,day:string,shift:{start:number;end:number;minutes:number},presence:number[][]){
 const missions=approvedMissionFacts(rows,memberId,day,day),ranges=[...presence];
 for(const mission of missions)ranges.push([Math.max(shift.start,Date.parse(mission.startedAt)),Math.min(shift.end,Date.parse(mission.finishedAt))]);
 const merged:number[][]=[];
 for(const [a,b] of ranges.filter(([a,b])=>Number.isFinite(a)&&b>a).sort((x,y)=>x[0]-y[0])){
  const last=merged.at(-1);if(last&&a<=last[1])last[1]=Math.max(last[1],b);else merged.push([a,b]);
 }
 const minutes=(xs:number[][])=>xs.reduce((n,[a,b])=>n+Math.max(0,Math.min(b,shift.end)-Math.max(a,shift.start))/60000,0);
 // Only the uncovered part of the scheduled shift is credited. Travel outside
 // the shift is neither overtime nor a financial mission premium.
 return {minutes:Math.max(0,Math.min(shift.minutes,minutes(merged))-Math.min(shift.minutes,minutes(presence))),missions};
}

export function unresolvedMissionFacts(rows:any[],memberId:string,start:string,end:string){
 const a=Date.parse(start+'T00:00:00+03:30'),b=Date.parse(end+'T23:59:59.999+03:30');
 return rows.filter(r=>r.type==='staff_mission'&&r.data.memberIds?.includes(memberId)&&r.data.state!=='completed'&&r.data.startedAt&&Date.parse(r.data.startedAt)<=b&&(!r.data.finishedAt||Date.parse(r.data.finishedAt)>=a)).map(r=>({id:r.id,state:r.data.state,title:r.data.goal||'مأموریت'}));
}

/** Guard the complete overlapping set as well as revisions (new trips count). */
export function payrollMissionGuards(db:D1Database,op:string,rows:any[],members:string[],start:string,end:string){
 return members.map(mid=>{const expected=rows.filter(r=>r.data.memberIds?.includes(mid));return db.prepare("UPDATE inventory_operations SET guard=CASE WHEN (SELECT COUNT(*) FROM flow_entities WHERE type='staff_mission' AND EXISTS(SELECT 1 FROM json_each(json_extract(data,'$.memberIds')) WHERE value=?) AND json_extract(data,'$.startedAt')<=? AND (json_extract(data,'$.finishedAt')>=? OR json_extract(data,'$.finishedAt') IS NULL))=? AND (SELECT COALESCE(SUM(revision),0) FROM flow_entities WHERE type='staff_mission' AND EXISTS(SELECT 1 FROM json_each(json_extract(data,'$.memberIds')) WHERE value=?) AND json_extract(data,'$.startedAt')<=? AND (json_extract(data,'$.finishedAt')>=? OR json_extract(data,'$.finishedAt') IS NULL))=? THEN guard ELSE 0 END WHERE id=?").bind(mid,new Date(end+'T23:59:59.999+03:30').toISOString(),new Date(start+'T00:00:00+03:30').toISOString(),expected.length,mid,new Date(end+'T23:59:59.999+03:30').toISOString(),new Date(start+'T00:00:00+03:30').toISOString(),expected.reduce((n,r)=>n+r.revision,0),op);});
}
