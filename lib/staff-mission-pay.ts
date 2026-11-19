import {AccessError} from './authorization';

/** Owner-approved internal policy, independent of tax/insurance classifications. */
export const missionPayVersion='company-mission-2026-11-19-v1';
export type MissionPayTimes={arrivedAt:string;returnStartedAt:string;work:{memberId:string;start:string;end:string;notes:string}[]};
const fail=(message:string):never=>{throw new AccessError(message,400)};
const instant=(v:any)=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d\d:\d\d)$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v.slice(0,10)+'T00:00:00Z').toISOString().slice(0,10)!==v.slice(0,10))fail('تاریخ و ساعت واقعی همراه منطقه زمانی لازم است.');return Date.parse(v);};
export const missionLocalDay=(t:number)=>new Date(t+210*60000).toISOString().slice(0,10);
export function normalizeMissionPayTimes(value:any,mission:any,finishedAt:string):MissionPayTimes{
 const start=instant(mission.startedAt),end=instant(finishedAt),arrived=instant(value?.arrivedAt),back=instant(value?.returnStartedAt);
 if(end<start||end-start>366*86400000||arrived<start||back<arrived||back>end)fail('ترتیب شروع سفر، رسیدن به مقصد، شروع برگشت و پایان سفر معتبر نیست.');
 if(!Array.isArray(value.work)||value.work.length>100)fail('حداکثر صد بازه کار واقعی در مقصد ثبت شود؛ مسیر و استراحت کار محسوب نمی‌شوند.');
 const work=value.work.map((w:any)=>{if(!w||typeof w!=='object')fail('بازه کار مقصد معتبر نیست.');const a=instant(w.start),b=instant(w.end);if(!mission.memberIds?.includes(w.memberId)||a<arrived||b>back||b<=a||typeof w.notes!=='string'||!w.notes.trim()||w.notes.length>1000)fail('هر بازه کار مقصد باید فرد، شروع، پایان و شرح کار واقعی معتبر داشته باشد.');return {memberId:w.memberId,start:new Date(a).toISOString(),end:new Date(b).toISOString(),notes:w.notes.trim()};});
 for(const mid of mission.memberIds||[]){const ranges=work.filter((w:any)=>w.memberId===mid).sort((a:any,b:any)=>a.start.localeCompare(b.start));for(let i=1;i<ranges.length;i++)if(ranges[i].start<ranges[i-1].end)fail('بازه‌های کار واقعی یک فرد نباید هم‌پوشانی داشته باشند.');}
 return {arrivedAt:new Date(arrived).toISOString(),returnStartedAt:new Date(back).toISOString(),work};
}
export function rangeMinutes(ranges:number[][],a=-Infinity,b=Infinity){const merged:number[][]=[];for(const [x,y] of ranges.map(([x,y])=>[Math.max(x,a),Math.min(y,b)]).filter(([x,y])=>y>x).sort((x,y)=>x[0]-y[0])){const last=merged.at(-1);if(last&&x<=last[1])last[1]=Math.max(last[1],y);else merged.push([x,y]);}return Math.floor(merged.reduce((n,[x,y])=>n+(y-x)/60000,0));}

/** Returns financial minutes separately from attendance and leave balances. */
export function missionPayDay(rows:any[],memberId:string,day:string,shift:{start:number;end:number;minutes:number;breakMinutes?:number;working?:boolean},office:number[][]){
 const from=Date.parse(day+'T00:00:00+03:30'),until=from+86400000;
 const trips=rows.filter(r=>r.type==='staff_mission'&&r.data.state==='completed'&&r.data.memberIds?.includes(memberId)&&Date.parse(r.data.startedAt)<until&&Date.parse(r.data.finishedAt)>from);
 if(!trips.length)return null;
 if(trips.length>1)fail('چند مأموریت در یک روز نیازمند اصلاح مستند فیش است؛ روز دوباره محاسبه نمی‌شود.');
 const trip=trips[0],d=trip.data;
 if(!d.payTimes||!d.payTimesApprovedBy)return {id:trip.id,version:missionPayVersion,status:'missing_times',day};
 const times=normalizeMissionPayTimes(d.payTimes,d,d.finishedAt),start=Date.parse(d.startedAt),end=Date.parse(d.finishedAt),arrival=Date.parse(times.arrivedAt),back=Date.parse(times.returnStartedAt);
 const travel=[[start,arrival],[back,end]],destination=times.work.filter(w=>w.memberId===memberId).map(w=>[Date.parse(w.start),Date.parse(w.end)]);
 if(office.some(([a,b])=>rangeMinutes([...travel,...destination],Math.max(a,from),Math.min(b,until))>0))fail('تردد دفتر با مسیر یا کار مقصد هم‌پوشانی دارد؛ منبع کارکرد اصلاح شود.');
 const officeRegular=shift.working===false?0:Math.max(0,rangeMinutes(office,Math.max(from,shift.start),Math.min(until,shift.end))-(office.length?(shift.breakMinutes||0):0)),destinationRegular=shift.working===false?0:rangeMinutes(destination,Math.max(from,shift.start),Math.min(until,shift.end));
 const actualOT=rangeMinutes(destination,from,until)-destinationRegular;
 const first=missionLocalDay(start)===day,last=missionLocalDay(end)===day;
 const travelMinutes=rangeMinutes(travel,from,until),officeActual=Math.max(0,rangeMinutes(office,from,until)-(office.length?(shift.breakMinutes||0):0)),thresholdMinutes=officeActual+travelMinutes;
 // The departure threshold uses actual office + travel time, never doubled hours.
 // A later return day is partial only when the return leg crossed midnight.
 const category=first?(thresholdMinutes>=960?'departure_full':'departure_hourly'):last&&(missionLocalDay(back)<day||back<shift.start)?'return_hourly':'destination_full';
 const full=category.endsWith('_full'),ordinaryMinutes=full?null:officeRegular+destinationRegular+travelMinutes;
 return {id:trip.id,revision:trip.revision,version:missionPayVersion,status:'ready',day,category,full,ordinaryMinutes,travelMinutes,officeMinutes:officeRegular,officeActualMinutes:officeActual,destinationMinutes:destinationRegular,overtimeMinutes:actualOT,thresholdMinutes,attendanceExempt:category==='return_hourly',approvedBy:d.payTimesApprovedBy};
}
