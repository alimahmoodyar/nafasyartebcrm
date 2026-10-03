'use client';
import {formatMonth} from '@/lib/persian-date';
import {SolarDate} from '@/components/trace/solar-date';
import {useEffect,useState} from 'react';
import {BarChart,Bar,XAxis,YAxis,CartesianGrid,Tooltip} from 'recharts';
import {buckets,localDay,solarParts,type DailyCount} from '@/lib/device-analytics';
import type {Row} from '@/lib/model';
const num=(n:number)=>new Intl.NumberFormat('fa-IR').format(n);
function Plot({title,description,rows,from,to}:{title:string;description:string;rows:DailyCount[];from:string;to:string}){
 const [monthly,setMonthly]=useState(false);
 const shown=buckets(rows,from,to,monthly),total=shown.reduce((s,r)=>s+r.count,0);
 const range=shown.length?`${shown[0].label} تا ${shown[shown.length-1].label}`:'';
 const width=Math.max(500,shown.length*(monthly?145:44)+65);
 const months:{key:string;label:string;days:number}[]=[];
 if(!monthly)for(const row of shown){const p=solarParts(row.date),key=`${p.year}/${p.month}`;const last=months[months.length-1];if(last?.key===key)last.days++;else months.push({key,label:formatMonth(row.date),days:1});}
 return <section className="panel"><div className="panelhead" style={{flexWrap:'wrap',gap:12}}><div><h2>{title}</h2><p className="subtle">{description}</p></div><div className="tools" role="group" aria-label={'بازه نمایش '+title}><button className={'btn '+(!monthly?'primary':'')} aria-pressed={!monthly} onClick={()=>setMonthly(false)}>روزانه</button><button className={'btn '+(monthly?'primary':'')} aria-pressed={monthly} onClick={()=>setMonthly(true)}>ماهانه</button></div></div><div className="inside">
 <p>مجموع کل بازه انتخابی: <strong>{num(total)} دستگاه</strong></p>
 <p>بازه کامل نمودار و جدول: <strong>{range}</strong></p><p className="subtle">تمام روزهای بازه، از ابتدا تا انتها، نمایش داده می‌شوند. برای دیدن ادامه نمودار آن را افقی بکشید؛ جدول نیز به پایین پیمایش می‌شود.</p>
 {!total&&<p className="subtle">در این بازه رکوردی ثبت نشده است.</p>}
 <div key={`${from}-${to}-${monthly}`} style={{overflowX:'auto',width:'100%'}} dir="ltr" tabIndex={0} aria-label={'نمودار قابل پیمایش '+title}>
 <div style={{width}}><BarChart width={width} height={340} data={shown} margin={{top:20,right:20,bottom:15,left:0}} accessibilityLayer>
 <CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" type="category" interval={0} height={40} tickLine={false} tick={({x,y,payload})=>{const row=shown.find(r=>r.date===payload.value);return <text x={x} y={Number(y)+22} textAnchor="middle" fontSize={13} fill="#475569" direction="rtl">{monthly?row?.label:row?num(solarParts(row.date).day):""}</text>;}}/>
 <YAxis allowDecimals={false} tickFormatter={num} width={45}/><Tooltip labelFormatter={v=>shown.find(r=>r.date===v)?.label||String(v)} formatter={value=>[num(Number(value)),'تعداد دستگاه']} contentStyle={{direction:'rtl',borderRadius:12}}/>
 <Bar dataKey="count" name="تعداد دستگاه" fill="#414a9c" radius={[4,4,0,0]} maxBarSize={48} isAnimationActive={false}/></BarChart>{!monthly&&<div style={{display:'flex',marginLeft:45,marginRight:20,paddingBottom:12,alignItems:'stretch'}}>{months.map(m=><div key={m.key} style={{flex:m.days,minWidth:0,borderTop:'2px solid #cbd5e1',borderInlineEnd:'1px solid #cbd5e1',padding:'8px 2px',textAlign:'center',fontSize:13,overflowWrap:'anywhere'}} dir="rtl">{m.label}</div>)}</div>}</div></div>
 <details open><summary style={{cursor:'pointer'}}>جدول تاریخ و تعداد — کل بازه انتخابی</summary><div style={{maxHeight:420,overflow:'auto'}}><table style={{width:'100%',textAlign:'right'}}><thead><tr><th>{monthly?'ماه شمسی':'تاریخ و روز'}</th><th>تعداد دستگاه</th></tr></thead><tbody>{shown.map(r=><tr key={r.date}><td>{r.label}</td><td>{num(r.count)}</td></tr>)}</tbody><tfoot><tr><th>مجموع کل بازه</th><td>{num(total)}</td></tr></tfoot></table></div></details></div></section>;
}
export function DeviceAnalytics({demo,records,onBack}:{demo:boolean;records:Row[];onBack:()=>void}){
 const [data,setData]=useState<{production:DailyCount[];activation:DailyCount[]|null}|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const end=demo?'2026-09-23':localDay(new Date().toISOString());const start=new Date(end+'T12:00:00Z');start.setUTCDate(start.getUTCDate()-89);
 const [from,setFrom]=useState(start.toISOString().slice(0,10)),[to,setTo]=useState(end);
 useEffect(()=>{const controller=new AbortController();setData(null);setError('');
 if(demo){const days=new Map<string,number>();for(const r of records.filter(r=>r.kind==='device'))days.set(r.data.date,(days.get(r.data.date)||0)+1);setData({production:[...days].map(([date,count])=>({date,count})),activation:[{date:'2026-09-09',count:2},{date:'2026-09-10',count:1}]});return;}
 fetch('/api/device-analytics',{signal:controller.signal}).then(async r=>{const d=await r.json() as {production:DailyCount[];activation:DailyCount[]|null;error?:string};if(!r.ok)throw new Error(d.error);setData(d);}).catch(e=>{if(e.name!=='AbortError')setError(e.message||'دریافت گزارش انجام نشد.');});return()=>controller.abort();
 },[demo,records,retry]);
 const span=(Date.parse(to)-Date.parse(from))/86400000;const valid=!!from&&!!to&&Number.isFinite(span)&&span>=0&&span<=3660;
 return <div><div className="tools" style={{marginBottom:16}}><button className="btn" onClick={onBack}>بازگشت به نمای کلی</button><button className="btn" onClick={()=>setRetry(r=>r+1)}>تازه‌سازی نمودارها</button></div><div className="panel inside"><h2>گزارش تولید و فعال‌سازی دستگاه‌ها</h2><div className="formgrid" style={{marginTop:16}}><SolarDate label="از تاریخ" value={from} onChange={setFrom}/><SolarDate label="تا تاریخ" value={to} onChange={setTo}/></div><p className="subtle">نمودارها با تقویم شمسی و ساعت ایران نمایش داده می‌شوند. مجموع ماه‌های ابتدا و انتها فقط شامل روزهای بازه انتخابی است.</p>{demo&&<p className="notice">داده آموزشی — فعال‌سازی‌های این گزارش فرضی‌اند و به اطلاعات شرکت اضافه نمی‌شوند.</p>}{!valid&&<p role="alert" className="notice error">بازه معتبر و حداکثر ده‌ساله انتخاب کنید.</p>}</div>{error?<p role="alert" className="notice error">{error}</p>:!data?<p role="status" className="panel inside">در حال دریافت گزارش…</p>:valid&&<><Plot title="تعداد دستگاه‌های تولیدشده" description="مبنا: تاریخ شروع تولید در شناسنامه؛ هر دستگاه یک بار شمرده می‌شود، نه رزرو یا چاپ سریال و نه پایان تولید." rows={data.production} from={from} to={to}/>{data.activation===null?<p className="notice">برای مشاهده آمار فعال‌سازی، دسترسی مشاهده «نماینده و مشتری» لازم است.</p>:<><Plot title="تعداد دستگاه‌های فعال‌شده" description="مبنا: تاریخ صدور اولین کد فعال‌سازی گارانتی؛ هر دستگاه یک بار شمرده می‌شود." rows={data.activation} from={from} to={to}/>{!demo&&<p className="subtle">صدور کد با فرمول اختصاصی گارانتی هنوز راه‌اندازی نشده است؛ تاریخ فروش یا تحویل جایگزین تاریخ فعال‌سازی نمی‌شود.</p>}</>}</>}</div>;
}
