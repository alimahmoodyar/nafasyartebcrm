import {formatDate,isIsoDay,parseCalendarDay,solarParts,solarToIso} from './persian-date';

export const holidayType='hr_holiday_calendar';
export const officialCalendarSite='https://calendar.ut.ac.ir/';
const days1405:Record<number,number[]>={1:[1,2,3,4,12,13,25],3:[6,14,15],4:[3,4],5:[13,21,22,30],6:[8],8:[22],10:[2,16],11:[4,22],12:[9,19,20,29]};
export const officialCalendar1405={
 source:'https://calendar.ut.ac.ir/documents/2139738/7092644/Calendar-1405.pdf/64228cbb-f4de-dc32-4d2b-57db3c8e322f?t=1761972997587',
 days:Object.entries(days1405).flatMap(([month,days])=>days.map(day=>solarToIso(1405,Number(month),day)))
};

export function calendarWorking(rows:any[],day:string,shiftId:string,weeklyWork:boolean,shiftHoliday:boolean,location:string){
 let official=false,work=false;
 for(const {type,data} of rows){
  if(type!==holidayType||data.state!=='published')continue;
  if(data.kind==='official'&&day>=data.effective&&data.days.includes(day))official=true;
  if(data.day!==day||data.shiftId&&data.shiftId!==shiftId||data.location&&data.location!==location)continue;
  if(data.kind==='closure')return false;
  if(data.kind==='work')work=true;
 }
 return official?work:weeklyWork&&!shiftHoliday;
}

type Fail=(message:string,status?:number)=>never;
type Schedule=(rows:any[],memberId:string,day:string)=>{working:boolean;minutes:number};

export function holidayCalendarChange(rows:any[],body:any,old:any,reason:string,today:string,schedule:Schedule,fail:Fail){
 const kind=body.holidayKind;
 let data:any;
 let days:string[];
 if(kind==='cancel'){
  if(old?.type!==holidayType||old.data.state!=='published'||old.data.kind==='official')fail('فقط تعطیلی اعلامی یا استثنای کاری ثبت‌شده قابل لغو است.');
  data={...old.data,state:'cancelled',cancelReason:reason};
  days=[old.data.day];
 }else if(kind==='official'){
  if(old||body.recordId)fail('ثبت تقویم رسمی باید پروندهٔ جدید باشد.');
  const year=body.holidayYear;
  const effective=parseCalendarDay(body.holidayEffective);
  if(!Number.isSafeInteger(year)||year<1400||year>1499||!effective||solarParts(effective).year!==year)fail('سال شمسی و تاریخ آغاز اعمال همان سال را انتخاب کنید.');
  if(rows.some(row=>row.type===holidayType&&row.data.kind==='official'&&row.data.year===year))fail('تقویم رسمی این سال قبلاً وارد شده است.',409);
  const preset=year===1405&&body.holidaySource===officialCalendar1405.source;
  const source=body.holidaySource;
  if(typeof source!=='string'||source.length>1000||!/^https:\/\/calendar\.ut\.ac\.ir\/(?!$)/.test(source))fail('نشانی نسخهٔ رسمی مرکز تقویم دانشگاه تهران را وارد کنید.');
  const supplied=body.holidayDays;
  if(!preset&&(!Array.isArray(supplied)||!supplied.length||supplied.length>60))fail('تاریخ‌های تعطیل نسخهٔ رسمی را وارد کنید.');
  const allDays=preset?officialCalendar1405.days:(supplied as string[]).map(date=>parseCalendarDay(date));
  if(allDays.some(day=>!day||solarParts(day).year!==year)||new Set(allDays).size!==allDays.length)fail('همهٔ تاریخ‌ها باید معتبر، غیرتکراری و در همان سال شمسی باشند.');
  days=allDays.filter(day=>day>=effective).sort();
  data={kind,year,effective,days:[...allDays].sort(),source,state:'published'};
 }else{
  if(old||body.recordId||!['closure','work'].includes(kind))fail('نوع تغییر تقویم معتبر نیست.');
  const day=body.holidayDay;
  const shiftId=body.shiftId||'';
  const location=body.holidayLocation||'';
  if(!isIsoDay(day)||day<today)fail('برای تعطیلی اعلامی یا شیفت کاری استثنا، امروز یا تاریخ آینده را انتخاب کنید.');
  const shift=rows.find(row=>row.id===shiftId&&row.type==='hr_shift'&&row.data.state==='published')?.data;
  if(shiftId&&!shift)fail('برنامهٔ کاری معتبر انتخاب کنید.');
  if(location&&!rows.some(row=>row.type==='hr_employee'&&row.data.state==='active'&&row.data.location===location))fail('محل کار معتبر انتخاب کنید.');
  if(kind==='work'&&(!shiftId||!rows.some(row=>row.type===holidayType&&row.data.kind==='official'&&row.data.state==='published'&&day>=row.data.effective&&row.data.days.includes(day))))fail('شیفت کاری استثنا را برای یک برنامه مشخص و در تعطیلی رسمی فعال ثبت کنید.');
  if(kind==='work'){
   const weekday=new Date(day+'T12:00:00Z').getUTCDay();
   const rule=shift.dayRules?shift.dayRules.find((entry:any)=>entry.weekday===weekday):shift;
   const minutes=(time:string)=>Number(time?.slice(0,2))*60+Number(time?.slice(3));
   const duration=(minutes(rule?.endTime)-minutes(rule?.startTime)+1440)%1440;
   if(!duration||duration<=(rule.paidBreak?0:rule.breakMinutes))fail('ابتدا ساعت معتبر کار و استراحت برای روز هفته در این شیفت تعیین کنید.');
  }
  if(rows.some(row=>row.type===holidayType&&row.data.state==='published'&&row.data.kind===kind&&row.data.day===day&&row.data.shiftId===shiftId&&(row.data.location||'')===location))fail('این تاریخ برای همین محدوده قبلاً ثبت شده است.',409);
  data={kind,day,shiftId,location,reason,state:'published'};
  days=[day];
 }
 const projected=[...rows.filter(row=>row.id!==old?.id),{type:holidayType,data}];
 const conflicts:string[]=[];
 for(const day of days){
  const protectedMembers=new Map<string,Set<string>>();
  const add=(memberId:string,reason:string)=>{
   if(!protectedMembers.has(memberId))protectedMembers.set(memberId,new Set());
   protectedMembers.get(memberId)!.add(reason);
  };
  for(const row of rows){
   const d=row.data;
   if(d.start>day||d.end<day)continue;
   if(row.type==='hr_request'&&d.kind==='leave'&&d.state==='approved')add(d.memberId,'مرخصی تأییدشده');
   if(row.type==='hr_request'&&d.kind==='leave'&&d.hourly&&d.leaveType==='annual'&&['substitute','manager','hr'].includes(d.state))add(d.memberId,'مرخصی ساعتی در انتظار بررسی');
   if(row.type==='hr_period'&&d.state!=='draft')for(const mid of d.memberIds||[])if(!d.payrollV2||d.work?.[mid])add(mid,'کارکرد بسته‌شده');
  }
  for(const [mid,reasons] of protectedMembers){
   let before;
   try{before=schedule(rows,mid,day)}catch{continue}
   const after=schedule(projected,mid,day);
   if(before.working!==after.working||before.minutes!==after.minutes){
    const name=rows.find(row=>row.type==='hr_employee'&&row.data.memberId===mid)?.data.name||mid;
    conflicts.push(formatDate(day)+'، '+name+' ('+[...reasons].join(' و ')+')');
   }
  }
 }
 if(conflicts.length)fail('ابتدا سوابق متأثر را بررسی کنید: '+conflicts.slice(0,8).join('؛ ')+(conflicts.length>8?' و '+(conflicts.length-8)+' مورد دیگر':''),409);
 return data;
}
