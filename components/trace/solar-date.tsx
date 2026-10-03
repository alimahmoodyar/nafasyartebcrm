'use client';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {isIsoDay,localDay,parseCalendarDay,solarParts,solarMonthDays,solarToIso,solarMonths} from '@/lib/persian-date';
const nf=new Intl.NumberFormat('fa-IR',{useGrouping:false});
type Props={label:string;value?:string;onChange:(s:string)=>void;required?:boolean;disabled?:boolean};
export function SolarDate({label,value='',onChange,required=true,disabled=false}:Props){
 const valid=isIsoDay(value),p=solarParts(valid?value:localDay()),days=solarMonthDays(p.year,p.month);
 const startYear=Math.min(1300,p.year-10),endYear=Math.max(1500,p.year+10);
 function update(key:'year'|'month'|'day',v:string){const next={...p,[key]:Number(v)};next.day=Math.min(next.day,solarMonthDays(next.year,next.month));onChange(solarToIso(next.year,next.month,next.day));}
 return <fieldset disabled={disabled} className="field solar-date" style={{minWidth:0}}><legend>{label} (شمسی){!required?' — اختیاری':''}</legend>
 <div style={{display:'flex',flexWrap:'wrap',gap:8}}>{(['day','month','year'] as const).map(key=><Select key={key} dir="rtl" required={required||!!value} disabled={disabled} value={valid?String(p[key]):''} onValueChange={v=>update(key,v)}><SelectTrigger aria-label={label+' — '+(key==='day'?'روز':key==='month'?'ماه':'سال')} aria-invalid={!!value&&!valid}><SelectValue placeholder={key==='day'?'روز':key==='month'?'ماه':'سال'}/></SelectTrigger><SelectContent>{(key==='day'?Array.from({length:days},(_,i)=>i+1):key==='month'?Array.from({length:12},(_,i)=>i+1):Array.from({length:endYear-startYear+1},(_,i)=>startYear+i)).map(n=><SelectItem key={n} value={String(n)}>{key==='month'?solarMonths[n-1]:nf.format(n)}</SelectItem>)}</SelectContent></Select>)}</div>
 {!!value&&!valid&&<><input aria-label={label+' — اصلاح تاریخ شمسی'} required value={value} dir="ltr" placeholder="۱۴۰۵/۰۷/۱۱" onChange={e=>onChange(parseCalendarDay(e.target.value)||e.target.value)}/><small role="alert">تاریخ معتبر انتخاب کنید؛ روز، ماه و سال شمسی را بررسی کنید.</small></>}
 {!required&&!!value&&!disabled&&<button type="button" className="link" onClick={()=>onChange('')}>پاک کردن تاریخ</button>}
 </fieldset>;
}
