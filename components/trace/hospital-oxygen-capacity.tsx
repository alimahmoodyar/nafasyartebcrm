'use client';
import {useState,type FormEvent} from 'react';
import {oxygenSections,oxygenDemandFields,oxygenSources,type OxygenSection,type OxygenEstimate} from '@/lib/hospital-oxygen';

type Draft={id:number;kind:OxygenSection;count:string;department:string;demand:Record<string,string>};
const blank=(id:number,kind:OxygenSection='ward'):Draft=>({id,kind,count:'',department:'',demand:{}});
const format=(value:number)=>value.toLocaleString('fa-IR',{maximumFractionDigits:3});

export function HospitalOxygenCapacity(){
 const [rows,setRows]=useState<Draft[]>([blank(0)]),[nextId,setNextId]=useState(1);
 const [specialUse,setSpecialUse]=useState('unknown'),[extra,setExtra]=useState('');
 const [result,setResult]=useState<OxygenEstimate|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 function change(id:number,update:Partial<Draft>){setRows(rows.map(row=>row.id===id?{...row,...update}:row));setResult(null);setError('');}
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(busy)return;
  setResult(null);setError('');setBusy(true);
  try{
   const payload={
    rows:rows.map(row=>({
     kind:row.kind,count:row.count===''?null:Number(row.count),...(row.kind==='ward'&&row.department.trim()?{department:row.department}:{}),
     ...(Object.values(row.demand).some(v=>v!=='')?{demand:Object.fromEntries(Object.keys(oxygenDemandFields).map(key=>[key,row.demand[key]?Number(row.demand[key]):null]))}:{})
    })),
    specialUse,...(specialUse==='assessed'?{extraPeakLpm:Number(extra)}:{})
   };
   const response=await fetch('/api/build-intake/oxygen-capacity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const data=await response.json() as OxygenEstimate&{error?:string};
   if(!response.ok)throw Error(data.error||'محاسبه انجام نشد.');
   setResult(data);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <section className="panel inside" dir="rtl">
  <h2>ظرفیت‌سنجی اولیه اکسیژن بیمارستان</h2>
  <p>هر واحد بستری را در ردیف جدا ثبت کنید. برای واحدهای بستری یک دپارتمان، نام گروه یکسان بگذارید. در روش HTM، گروه‌بندی و فرمول‌ها مربوط به سطح ورودی بخش و دپارتمان‌اند.</p>
  <form onSubmit={submit}>
   <fieldset disabled={busy} className="space-y-4">
    <legend>بخش‌های بیمارستان</legend>
    {rows.map((row,i)=><article className="flow-card" key={row.id}>
     <h4>بخش {format(i+1)}</h4>
     <div className="form-grid">
      <label className="field">نوع بخش<select value={row.kind} onChange={e=>change(row.id,{kind:e.target.value as OxygenSection,department:''})}>{Object.entries(oxygenSections).map(([key,section])=><option key={key} value={key}>{section.label}</option>)}</select></label>
      <label className="field">تعداد {oxygenSections[row.kind].unit}<input type="number" min="0" max="10000" step="1" value={row.count} onChange={e=>change(row.id,{count:e.target.value})} required/></label>
      {row.kind==='ward'&&<label className="field">نام گروه بستری (اختیاری)<input maxLength={80} value={row.department} onChange={e=>change(row.id,{department:e.target.value})}/></label>}
      {rows.length>1&&<button type="button" className="btn" onClick={()=>{setRows(rows.filter(r=>r.id!==row.id));setResult(null);setError('');}}>حذف این بخش</button>}
     </div>
     <details><summary>داده‌های مصرف برای برآورد تقاضا (اختیاری)</summary>
      <p>برای برآورد کل بیمارستان، چهار مقدار را برای همهٔ بخش‌های دارای تخت یا جایگاه وارد کنید.</p>
      <div className="form-grid">{Object.entries(oxygenDemandFields).map(([key,field])=><label className="field" key={key}>{field.label}<input type="number" min={field.min} max={field.max} step="any" value={row.demand[key]||''} onChange={e=>change(row.id,{demand:{...row.demand,[key]:e.target.value}})}/></label>)}</div>
     </details>
     {result?.rows[i]&&<p>دبی پایهٔ این بخش پیش از تجمیع گروه <strong>{format(result.rows[i].designLpm)} لیتر بر دقیقه</strong></p>}
    </article>)}
    <button type="button" className="btn" disabled={rows.length>=100} onClick={()=>{setRows([...rows,blank(nextId)]);setNextId(nextId+1);setResult(null);setError('');}}>افزودن بخش</button>
    <label className="field">مصرف ویژه مانند اکسیژن پُردبی، سی‌پپ یا ونتیلاتور<select value={specialUse} onChange={e=>{setSpecialUse(e.target.value);setResult(null);setError('');}}><option value="unknown">هنوز بررسی نشده</option><option value="none">تأیید شده که مصرف ویژه ندارد</option><option value="assessed">دبی افزوده را واحد فنی محاسبه کرده است</option></select></label>
    {specialUse==='assessed'&&<label className="field">دبی افزودهٔ اوج، پس از حذف هم‌پوشانی با بخش‌ها (لیتر بر دقیقه)<input type="number" min="0" max="100000" step="any" value={extra} required onChange={e=>{setExtra(e.target.value);setResult(null);setError('');}}/></label>}
    <button type="submit" className="btn primary">{busy?'در حال محاسبه…':'محاسبه ظرفیت اولیه'}</button>
   </fieldset>
  </form>
  {error&&<p className="notice error" role="alert">{error}</p>}
  {result&&<div className="notice space-y-2" aria-live="polite">
   <p><strong>دبی پایهٔ شبکه، جدول ۱۳ اچ‌تی‌ام</strong> · {format(result.subtotalLpm)} لیتر بر دقیقه</p>
   {result.grouped.filter(group=>group.wardCount>1).map(group=><p key={group.department}>گروه {group.department} · {format(group.designLpm)} لیتر بر دقیقه پس از تجمیع. اختلاف ظرفیت واحدهای یک گروه را واحد فنی بررسی کند.</p>)}
   {result.designLpm===null?<p>تا بررسی مصرف ویژه، جمع دبی طراحی نمایش داده نمی‌شود.</p>:<p><strong>دبی طراحی در سناریوی واردشده</strong> · {format(result.designLpm)} لیتر بر دقیقه، معادل {format(result.designM3h!)} مترمکعب بر ساعت در همان شرایط مرجع</p>}
   {result.demandLpm===null?<p>برآورد تقاضای پایه پس از تکمیل داده‌های مصرف همهٔ بخش‌ها نمایش داده می‌شود.</p>:<p><strong>تقاضای میانگین بخش‌های ثبت‌شده</strong> · {format(result.demandLpm)} لیتر بر دقیقه، معادل {format(result.demandM3day!)} مترمکعب در روز. این برآورد بر پایهٔ ورودی‌های ابزار یونیسف و تبدیل موارد سالانه به میانگین هم‌زمان است.</p>}
  </div>}
  <p>انتخاب دستگاه به تأیید فنی اوج مصرف، فشار، خلوص، شرایط محل و منبع پشتیبان نیاز دارد.</p>
  <p className="tools"><a className="link" href={oxygenSources.htm} target="_blank" rel="noopener noreferrer">جدول ۱۳ اچ‌تی‌ام</a><a className="link" href={oxygenSources.unicef} target="_blank" rel="noopener noreferrer">روش برآورد یونیسف</a><a className="link" href={oxygenSources.who} target="_blank" rel="noopener noreferrer">مشخصات فنی سازمان جهانی بهداشت</a></p>
 </section>;
}
