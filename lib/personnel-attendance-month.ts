import {storage} from './storage';
import {hrFail,scheduled,workSummary} from './personnel';
import {leaveRequestDays} from './personnel-leave';
import {readPayrollMissionRows} from './personnel-payroll-missions';
import {addDay} from './duties';
import {isIsoDay,solarParts,solarToIso,solarMonthDays} from './persian-date';

export async function attendanceMonth(memberId:string,anchor:string,today:string){
 if(!isIsoDay(anchor))hrFail('تاریخ معتبر نیست.');
 const {year,month}=solarParts(anchor),start=solarToIso(year,month,1);
 if(start>today)hrFail('کارکرد ماه آینده در دسترس نیست.');
 const last=solarToIso(year,month,solarMonthDays(year,month)),end=last<today?last:today;
 const result=await storage().prepare(`WITH own AS (
 SELECT * FROM flow_entities WHERE type IN ('hr_employee','hr_request','hr_assignment','hr_punch')
 AND json_extract(data,'$.memberId')=? AND (
 type='hr_employee' OR (type='hr_punch' AND json_extract(data,'$.day') BETWEEN ? AND ?)
 OR (type IN ('hr_request','hr_assignment') AND json_extract(data,'$.start')<=? AND json_extract(data,'$.end')>=?)))
 SELECT * FROM own UNION ALL SELECT * FROM flow_entities WHERE
 (type='hr_shift' AND id IN (SELECT json_extract(data,'$.shiftId') FROM own))
 OR (type='hr_holiday_calendar' AND json_extract(data,'$.state')='published' AND
 (json_extract(data,'$.day') BETWEEN ? AND ? OR (json_extract(data,'$.kind')='official' AND json_extract(data,'$.effective')<=?
 AND EXISTS (SELECT 1 FROM json_each(data,'$.days') WHERE value BETWEEN ? AND ?))))
 ORDER BY created,id LIMIT 6001`).bind(memberId,start,end,last,start,start,last,last,start,last).all<{id:string,type:string,data:string}>();
 if(result.results.length>6000)hrFail('تعداد رکوردهای ماه بیش از حد قابل پردازش است.',409);
 const rows=result.results.map(r=>({...r,data:JSON.parse(r.data)}));
 rows.push(...await readPayrollMissionRows([memberId],start,end));
 const employee=rows.find(r=>r.type==='hr_employee')?.data;
 const approved=rows.filter(r=>r.type==='hr_request'&&r.data.kind==='leave'&&r.data.state==='approved');
 const holidays=rows.filter(r=>r.type==='hr_holiday_calendar').map(r=>r.data);
 const punches=rows.filter(r=>r.type==='hr_punch').map(({id,data:d})=>({id,data:{day:d.day,at:d.at,direction:d.direction,reference:d.reference,location:d.location}})).sort((a,b)=>a.data.at.localeCompare(b.data.at));
 const days=[],calendar:Record<string,string>={},issues:Record<string,string>={};
 for(let day=start;day<=last;day=addDay(day,1)){
  const weekly=new Date(day+'T12:00Z').getUTCDay()===5;
  const official=holidays.some(h=>h.kind==='official'&&h.effective<=day&&h.days.includes(day));
  let shift:ReturnType<typeof scheduled>|undefined;
  try{shift=scheduled(rows,memberId,day)}catch(e){if(day<=end&&employee?.state==='active'&&day>=employee.start&&(!employee.end||day<=employee.end))issues[day]=(e as Error).message}
  const closure=holidays.some(h=>h.kind==='closure'&&h.day===day&&(!h.location||h.location===employee?.location)&&(!h.shiftId||h.shiftId===shift?.shiftId));
  if(closure||official||weekly)calendar[day]=closure?'تعطیلی اعلامی':official?'تعطیل رسمی':'تعطیل هفتگی';
  if(!shift||day>end||employee?.state!=='active')continue;
  const d=workSummary(rows,memberId,day,day).days[0];if(!d)continue;
  let leave=0,unpaidLeave=0;
  for(const {data} of approved.filter(r=>r.data.start<=day&&r.data.end>=day)){
   const {minutes}=leaveRequestDays(data,()=>shift!,day,day);
   leave+=minutes;if(data.leaveType==='unpaid')unpaidLeave+=minutes;
  }
  days.push({day,worked:d.worked,expected:d.expected,credited:d.credited,overtime:d.overtime,incomplete:d.incomplete,leave,unpaidLeave});
 }
 return {days,punches,calendar,issues,error:employee?.state==='active'?undefined:'پروندهٔ پرسنلی فعال لازم است.'};
}
