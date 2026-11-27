'use client';
import {useEffect,useState} from 'react';
import {formatDate,formatDateTime,iranWeekdays,solarMonths,solarMonthDays,solarParts,solarToIso} from '@/lib/persian-date';

type Punch={id:string,data:{day:string,at:string,direction:string,reference?:string,location?:string}};
type Day={day:string,worked:number,expected:number,credited:number,overtime:number,incomplete:boolean,holiday:string,leave:number,unpaidLeave:number};
type Report={days:Day[],punches:Punch[],calendar:Record<string,string>,issues:Record<string,string>,error?:string};
const digits=new Intl.NumberFormat('fa-IR',{useGrouping:false});
function duration(minutes:number){
 const total=Math.round(minutes);
 return digits.format(Math.floor(total/60))+':'+digits.format(total%60).padStart(2,'۰');
}
export function AttendanceMonth({today}:{today:string}){
 const [month,setMonth]=useState(()=>solarParts(today)),[selected,setSelected]=useState(today);
 const [report,setReport]=useState<Report|null>(null),[error,setError]=useState('');
 const [from,setFrom]=useState(1),[to,setTo]=useState(31);
 const first=solarToIso(month.year,month.month,1),count=solarMonthDays(month.year,month.month);
 const offset=(new Date(first+'T12:00:00Z').getUTCDay()+1)%7;
 useEffect(()=>{
  const controller=new AbortController();setReport(null);setError('');
  let loading=false;async function refresh(){if(loading||document.hidden)return;loading=true;await fetch('/api/personnel/attendance-month?month='+first,{cache:'no-store',signal:controller.signal}).then(async response=>{
   if(!response.ok)throw Error('دریافت کارکرد ممکن نشد.');const result=await response.json();
   if(!controller.signal.aborted){setReport(result as Report);setError('')}
  }).catch(e=>{if(!controller.signal.aborted)setError(e.message)}).finally(()=>{loading=false})}
  void refresh();const timer=window.setInterval(refresh,30000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  return ()=>{controller.abort();clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)};
 },[first]);
 function move(step:number){
  const index=month.year*12+month.month-1+step,year=Math.floor(index/12),m=index%12+1;
  setMonth({year,month:m,day:1});setSelected(solarToIso(year,m,1));setFrom(1);setTo(solarMonthDays(year,m));
 }
 const days=Array.from({length:count},(_,i)=>i+1);
 const visible=(report?.days||[]).filter(d=>{const n=solarParts(d.day).day;return n>=from&&n<=to});
 const sums=visible.reduce((s,d)=>({worked:s.worked+d.worked,overtime:s.overtime+d.overtime,leave:s.leave+d.leave,absence:s.absence+(d.day<today&&!d.incomplete?Math.max(0,d.expected-d.credited-d.unpaidLeave):0)}),{worked:0,overtime:0,leave:0,absence:0});
 const punches=report?.punches.filter(p=>p.data.day===selected)||[];
 const detail=visible.find(d=>d.day===selected);
 return <section className="attendance-month"><div className="tools"><button className="btn" onClick={()=>move(-1)}>ماه قبل</button><strong>{solarMonths[month.month-1]} {digits.format(month.year)}</strong><button className="btn" disabled={today<=solarToIso(month.year,month.month,count)} onClick={()=>move(1)}>ماه بعد</button></div>
 <div className="tools">{['از روز','تا روز'].map((label,i)=><label key={label}>{label} <select value={i?Math.min(to,count):from} onChange={e=>{const n=Number(e.target.value);if(i){setTo(n);if(from>n)setFrom(n)}else{setFrom(n);if(to<n)setTo(n)}}}>{days.map(n=><option key={n} value={n}>{digits.format(n)}</option>)}</select></label>)}</div>
 {error||report?.error?<p role="alert">{error||report?.error}</p>:!report?<p role="status">در حال دریافت کارکرد…</p>:<p>حضور {duration(sums.worked)} · اضافه‌کاری تأییدشده {duration(sums.overtime)} · کسری حضور {duration(sums.absence)} · مرخصی {duration(sums.leave)}</p>}
 {report&&Object.keys(report.issues).length>0&&<p>جمع کارکرد فقط برای روزهای دارای برنامه محاسبه شده است.</p>}<div className="attendance-grid">{iranWeekdays.map(d=><small key={d.id} title={d.label}>{d.label}</small>)}{Array.from({length:offset},(_,i)=><span key={'blank'+i}/>)}{days.map(n=>{
 const iso=solarToIso(month.year,month.month,n),day=visible.find(d=>d.day===iso),holiday=report?.calendar[iso]||((offset+n-1)%7===6?'تعطیل هفتگی':'');
 return <button key={n} type="button" disabled={n<from||n>to} aria-pressed={selected===iso} title={holiday} className={holiday?'holiday':''} onClick={()=>setSelected(iso)}><b>{digits.format(n)}</b>{day&&(day.worked>0||!holiday)&&<small>زمان حضور <bdi>{duration(day.worked)}</bdi></small>}{holiday&&<small>{holiday}</small>}</button>;
 })}</div>{selected>=solarToIso(month.year,month.month,from)&&selected<=solarToIso(month.year,month.month,Math.min(count,to))&&<article className="flow-card"><h4>{formatDate(selected)}</h4>{report?.issues[selected]&&<p>{report.issues[selected]}</p>}{detail?.incomplete&&<p>تردد ناقص</p>}{punches.map(p=><p key={p.id}>{p.data.direction==='in'?'ورود':'خروج'} · {formatDateTime(p.data.at)} · {p.data.reference||p.data.location}</p>)}{report&&!punches.length&&<p>ترددی ثبت نشده است.</p>}</article>}</section>;
}
