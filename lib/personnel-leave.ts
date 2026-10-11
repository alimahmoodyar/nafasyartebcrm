import {isIsoDay,solarMonthDays,solarParts,solarToIso} from './persian-date';

export const monthlyLeaveDays=2.5;
export type LeaveSchedule={minutes:number;working:boolean;start:number;end:number};
export type LeaveScheduleReader=(day:string)=>LeaveSchedule;
const reservedStates=['substitute','manager','hr','approved'];
const roundDays=(days:number)=>Math.round(days*1000000)/1000000;
const addDay=(day:string,n:number)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
function validRange(data:any){
 if(!isIsoDay(data.start)||!isIsoDay(data.end)||data.end<data.start||(Date.parse(data.end)-Date.parse(data.start))/86400000>=366)throw Error('بازهٔ مرخصی ثبت‌شده معتبر نیست.');
}
function requestDayMinutes(data:any,day:string,shift:LeaveSchedule){
 if(!Number.isFinite(shift.minutes)||shift.minutes<0)throw Error('مدت شیفت معتبر نیست.');
 if(!data.hourly)return shift.minutes;
 if(data.start!==data.end||!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.startTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.endTime))throw Error('بازهٔ مرخصی ساعتی ثبت‌شده معتبر نیست.');
 const time=(clock:string)=>{let at=Date.parse(day+'T'+clock+':00+03:30');if(at<shift.start)at+=86400000;return at;},start=time(data.startTime),end=time(data.endTime);
 if(!shift.working||start<shift.start||end>shift.end||end<=start)throw Error('مرخصی ساعتی ثبت‌شده خارج از شیفت است.');
 return Math.min(shift.minutes,(end-start)/60000);
}

/** Day fractions always use the work schedule on the leave date, never a fixed eight-hour day. */
export function leaveRequestDays(data:any,schedule:LeaveScheduleReader,from=data.start,to=data.end){
 validRange(data);let minutes=0,days=0;
 const start=data.start>from?data.start:from,end=data.end<to?data.end:to;
 for(let day=start;day<=end;day=addDay(day,1)){
  const shift=schedule(day),used=requestDayMinutes(data,day,shift);
  if(used){if(!shift.working||shift.minutes<=0)throw Error('برنامهٔ کاری مرخصی ثبت‌شده معتبر نیست.');minutes+=used;days+=used/shift.minutes;}
 }
 return {minutes,days};
}

export function leaveMonthCalendar(employee:any,schedule:LeaveScheduleReader,anchor:string){
 if(!isIsoDay(anchor))throw Error('ماه تقویم معتبر نیست.');const p=solarParts(anchor),start=solarToIso(p.year,p.month,1),end=solarToIso(p.year,p.month,solarMonthDays(p.year,p.month));
 const days:{day:string;working:boolean;minutes:number|null;status:'working'|'off'|'unavailable'}[]=[];
 for(let day=start;day<=end;day=addDay(day,1)){
  if(!employee||!isIsoDay(employee.start)||day<employee.start||employee.end&&day>employee.end){days.push({day,working:false,minutes:0,status:'off'});continue;}
  try{const s=schedule(day);if(!Number.isFinite(s.minutes)||s.minutes<0)throw Error('شیفت نامعتبر');days.push({day,working:s.working&&s.minutes>0,minutes:s.minutes,status:s.working&&s.minutes>0?'working':'off'});}catch{days.push({day,working:false,minutes:null,status:'unavailable'});}
 }
 return {year:p.year,month:p.month,start,end,days};
}

/** Approved dates through today are taken leave; future approvals and pending requests only reserve allowance. */
export function leaveUsage(rows:any[],memberId:string,asOf:string,schedule:LeaveScheduleReader,exclude='',accountingFrom?:string){
 if(!isIsoDay(asOf))throw Error('تاریخ گزارش مرخصی معتبر نیست.');const p=solarParts(asOf),yearStart=solarToIso(p.year,1,1),monthStart=solarToIso(p.year,p.month,1);
 const baseline=accountingFrom||yearStart;
 let yearUsedDays=0,monthUsedDays=0,annualYearUsedDays=0,annualMonthUsedDays=0,yearUsedMinutes=0,monthUsedMinutes=0,pendingDays=0,approvedFutureDays=0,annualUsedDays=0,annualUsedMinutes=0;
 for(const row of rows.filter(r=>r.id!==exclude&&r.type==='hr_request'&&r.data.memberId===memberId&&r.data.kind==='leave'&&reservedStates.includes(r.data.state))){
  const d=row.data;validRange(d);
  if(d.state==='approved'){
   const year=leaveRequestDays(d,schedule,yearStart,asOf),month=leaveRequestDays(d,schedule,monthStart,asOf);yearUsedDays+=year.days;monthUsedDays+=month.days;yearUsedMinutes+=year.minutes;monthUsedMinutes+=month.minutes;
   if(d.leaveType==='annual'){const total=leaveRequestDays(d,schedule,baseline,d.end);annualYearUsedDays+=year.days;annualMonthUsedDays+=month.days;annualUsedDays+=total.days;annualUsedMinutes+=total.minutes;approvedFutureDays+=leaveRequestDays(d,schedule,addDay(asOf,1),d.end).days;}
  }else if(d.leaveType==='annual')pendingDays+=leaveRequestDays(d,schedule).days;
 }
 return {solarYear:p.year,solarMonth:p.month,yearStart,monthStart,yearUsedDays:roundDays(yearUsedDays),monthUsedDays:roundDays(monthUsedDays),annualYearUsedDays:roundDays(annualYearUsedDays),annualMonthUsedDays:roundDays(annualMonthUsedDays),yearUsedMinutes,monthUsedMinutes,pendingDays:roundDays(pendingDays),approvedFutureDays:roundDays(approvedFutureDays),reservedDays:roundDays(pendingDays+approvedFutureDays),annualUsedDays:roundDays(annualUsedDays),annualUsedMinutes};
}

/** An imported balance must have an explicit date before automatic credits can be added safely. */
export function leaveAccrual(employee:any,asOf:string){
 if(!isIsoDay(asOf)||!isIsoDay(employee?.start)||!Number.isSafeInteger(employee?.leaveMinutes)||employee.leaveMinutes<0)throw Error('تاریخ شروع همکاری و مانده اولیه مرخصی باید توسط اداری تکمیل شود.');
 if(employee.end&&(!isIsoDay(employee.end)||employee.end<employee.start))throw Error('تاریخ پایان همکاری معتبر نیست.');
 const today=solarParts(asOf),yearStart=solarToIso(today.year,1,1),last=employee.end&&employee.end<asOf?employee.end:asOf,index=(day:string)=>{const p=solarParts(day);return p.year*12+p.month-1;};
 const entitlementFrom=employee.start>yearStart?employee.start:yearStart,theoreticalMonths=last<entitlementFrom?0:index(last)-index(entitlementFrom)+1,theoreticalEntitlementDays=theoreticalMonths*monthlyLeaveDays;
 const openingAsOf=employee.leaveOpeningAsOf||'';
 if(openingAsOf&&(!isIsoDay(openingAsOf)||openingAsOf<employee.start||openingAsOf>asOf||employee.end&&openingAsOf>employee.end))throw Error('تاریخ مانده اولیه مرخصی باید در دوره همکاری و تا امروز باشد.');
 const accountingMode=openingAsOf?'dated':employee.leaveMinutes>0?'legacy':'monthly',accountingFrom=openingAsOf?addDay(openingAsOf,1):entitlementFrom;
 const accruedMonths=accountingMode==='legacy'?0:openingAsOf?Math.max(0,index(last)-Math.max(index(openingAsOf),index(employee.start)-1)):theoreticalMonths;
 const policyNote=accountingMode==='legacy'?'مانده فعلی از اعتبار دستی قبلی محاسبه می‌شود. برای افزودن خودکار ماهی ۲٫۵ روز بدون دوباره‌شماری، واحد اداری باید مانده واقعی و تاریخ آن را ثبت کند.':openingAsOf?'مانده اولیه، اعتبار باقیمانده تا پایان تاریخ ثبت‌شده است؛ از ماه بعد، ابتدای هر ماه شمسی ۲٫۵ روز اضافه می‌شود.':'از ابتدای سال شمسی یا ماه شروع همکاری، ابتدای هر ماه ۲٫۵ روز کاری اعتبار محاسبه می‌شود. انتقال مانده سال‌های قبل نیاز به ثبت مانده اولیه تاریخ‌دار توسط اداری دارد.';
 return {accountingMode,accountingFrom,openingAsOf,monthlyEntitlementDays:monthlyLeaveDays,theoreticalEntitlementDays,accruedMonths,accruedDays:accruedMonths*monthlyLeaveDays,policyNote};
}
