'use client';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {solarParts,solarMonthDays,solarToIso} from '@/lib/device-analytics';
const months=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const nf=new Intl.NumberFormat('fa-IR',{useGrouping:false});
export function SolarDate({label,value,onChange}:{label:string;value:string;onChange:(s:string)=>void}){
 const p=solarParts(value);const days=solarMonthDays(p.year,p.month);
 function update(key:'year'|'month'|'day',v:string){const next={...p,[key]:Number(v)};next.day=Math.min(next.day,solarMonthDays(next.year,next.month));onChange(solarToIso(next.year,next.month,next.day));}
 return <fieldset className="field" style={{minWidth:0}}><legend>{label} (شمسی)</legend><div style={{display:'flex',flexWrap:'wrap',gap:8}}>{(['day','month','year'] as const).map(key=><Select key={key} dir="rtl" value={String(p[key])} onValueChange={v=>update(key,v)}><SelectTrigger aria-label={`${label} — ${key==='day'?'روز':key==='month'?'ماه':'سال'}`}><SelectValue/></SelectTrigger><SelectContent>{(key==='day'?Array.from({length:days},(_,i)=>i+1):key==='month'?Array.from({length:12},(_,i)=>i+1):Array.from({length:201},(_,i)=>1300+i)).map(n=><SelectItem key={n} value={String(n)}>{key==='month'?months[n-1]:nf.format(n)}</SelectItem>)}</SelectContent></Select>)}</div></fieldset>;
}
