'use client';
import {useState} from 'react';
import {formatDate,isIsoDay,localDay,solarMonths,solarMonthDays,solarParts,solarToIso} from '@/lib/persian-date';

export type LeaveCalendarDay={day:string;working:boolean;minutes:number|null;status:'working'|'off'|'unavailable'};
export type LeaveCalendarMonth={year:number;month:number;start:string;end:string;days:LeaveCalendarDay[]};
type Props={start:string;end:string;singleDay?:boolean;calendar?:LeaveCalendarMonth;disabled?:boolean;loading?:boolean;today?:string;onChange:(start:string,end:string)=>void;onMonthChange?:(monthStart:string)=>void};
const nf=new Intl.NumberFormat('fa-IR',{useGrouping:false});
const weekdays=['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];

/** The API remains a contiguous ISO range; holidays inside that range consume no leave. */
export function LeaveCalendar({start,end,singleDay=false,calendar,disabled=false,loading=false,today=localDay(),onChange,onMonthChange}:Props){
 const [visible,setVisible]=useState(()=>solarParts(isIsoDay(start)?start:today));
 const [awaitingEnd,setAwaitingEnd]=useState(false);
 const first=solarToIso(visible.year,visible.month,1),count=solarMonthDays(visible.year,visible.month),offset=(new Date(first+'T12:00:00Z').getUTCDay()+1)%7;
 const shown=calendar?.year===visible.year&&calendar?.month===visible.month?calendar:undefined;
 const availability=new Map((shown?.days||[]).map(day=>[day.day,day]));
 const cells=Array.from({length:Math.ceil((offset+count)/7)*7},(_,i)=>i>=offset&&i<offset+count?i-offset+1:0);
 const selectedEnd=singleDay?start:end;
 function move(delta:number){if(disabled||loading)return;const index=visible.year*12+visible.month-1+delta,next={year:Math.floor(index/12),month:index%12+1};const iso=solarToIso(next.year,next.month,1);if(!iso)return;setVisible({...next,day:1});onMonthChange?.(iso);}
 function select(day:string){if(disabled||loading||availability.get(day)?.status==='off')return;if(singleDay){setAwaitingEnd(false);onChange(day,day);return;}if(!awaitingEnd||!isIsoDay(start)){setAwaitingEnd(true);onChange(day,day);}else{setAwaitingEnd(false);onChange(day<start?day:start,day<start?start:day);}}
 return <fieldset className="leave-calendar" disabled={disabled}>
  <legend>انتخاب روزهای مرخصی</legend>
  <div className="leave-calendar-heading"><button className="btn" type="button" aria-label="ماه قبل" disabled={disabled||loading} onClick={()=>move(-1)}>ماه قبل</button><strong aria-live="polite">{solarMonths[visible.month-1]} {nf.format(visible.year)}</strong><button className="btn" type="button" aria-label="ماه بعد" disabled={disabled||loading} onClick={()=>move(1)}>ماه بعد</button></div>
  <p className="muted">{singleDay?'یک روز را برای مرخصی ساعتی انتخاب کنید.':awaitingEnd?'روز پایان را انتخاب کنید؛ برای یک روز، همان روز را دوباره بزنید.':'ابتدا روز شروع و سپس روز پایان را انتخاب کنید.'}</p>
  <table className="leave-calendar-table" aria-label={'تقویم '+solarMonths[visible.month-1]+' '+nf.format(visible.year)}><thead><tr>{weekdays.map(day=><th scope="col" key={day}><abbr title={day}>{day==='شنبه'?'ش':day==='جمعه'?'ج':day[0]}</abbr></th>)}</tr></thead><tbody>{Array.from({length:cells.length/7},(_,week)=><tr key={week}>{cells.slice(week*7,week*7+7).map((number,column)=>{
   if(!number)return <td key={column}/>;
   const iso=solarToIso(visible.year,visible.month,number),day=availability.get(iso),off=day?.status==='off',selected=isIsoDay(start)&&isIsoDay(selectedEnd)&&iso>=start&&iso<=selectedEnd;
   const status=off?'روز غیرکاری':day?.status==='working'?'روز کاری':'برنامه کاری مشخص نشده';
   return <td key={column}><button type="button" className={'leave-calendar-day'+(selected?' selected':'')+(off?' off':'')+(iso===start||iso===selectedEnd?' edge':'')} disabled={disabled||loading||off} aria-label={formatDate(iso)+'، '+status} aria-pressed={selected} aria-current={iso===today?'date':undefined} data-day={iso} title={status} onClick={()=>select(iso)}>{nf.format(number)}</button></td>;
  })}</tr>)}</tbody></table>
  <div className="leave-calendar-legend"><span><i className="selected"/>انتخاب‌شده</span><span><i className="off"/>غیرکاری؛ از مرخصی کسر نمی‌شود</span></div>
  {loading?<p role="status" className="muted">در حال دریافت برنامه کاری این ماه…</p>:(!shown||shown.days.some(day=>day.status==='unavailable'))&&<p className="muted">برنامه کاری بعضی روزها مشخص نشده است؛ محاسبه نهایی با شیفت مصوب و هنگام ثبت انجام می‌شود.</p>}
  <div className="leave-calendar-selection" aria-live="polite"><p><strong>{singleDay?'روز انتخابی: ':'شروع: '}</strong>{formatDate(start)}</p>{!singleDay&&<p><strong>پایان: </strong>{formatDate(end)}</p>}</div>
 </fieldset>;
}
