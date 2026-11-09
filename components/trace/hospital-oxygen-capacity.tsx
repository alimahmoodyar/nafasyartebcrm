'use client';
import {useState,type FormEvent} from 'react';
import {estimateCylinderOxygen,groupedOxygenSections,oxygenSections,type OxygenSection,type OxygenEstimate} from '@/lib/hospital-oxygen';

const format=(value:number)=>value.toLocaleString('fa-IR',{maximumFractionDigits:3});
const sections=Object.entries(oxygenSections) as [OxygenSection,(typeof oxygenSections)[OxygenSection]][];
const groups=[...new Set(sections.map(([,section])=>section.group))];
type Ward={kind:OxygenSection;count:string;department:string};
type Cylinder={volume:string;count:string};
const emptyCylinder=():Cylinder=>({volume:'',count:''});

export function HospitalOxygenCapacity(){
 const [method,setMethod]=useState<'htm'|'cylinder'>('htm');
 return <section className="panel inside" dir="rtl">
  <h2>ظرفیت‌سنجی اولیه اکسیژن بیمارستان</h2>
  <div className="tools" aria-label="روش ظرفیت‌سنجی">
   <button type="button" className={method==='htm'?'btn primary':'btn'} aria-pressed={method==='htm'} onClick={()=>setMethod('htm')}>روش HTM</button>
   <button type="button" className={method==='cylinder'?'btn primary':'btn'} aria-pressed={method==='cylinder'} onClick={()=>setMethod('cylinder')}>تطبیق کپسولی</button>
  </div>
  <div hidden={method!=='htm'}><HtmForm/></div>
  <div hidden={method!=='cylinder'}><CylinderForm/></div>
  <p>انتخاب دستگاه به تأیید فنی اوج مصرف، فشار، خلوص، شرایط محل و منبع پشتیبان نیاز دارد.</p>
 </section>;
}

function HtmForm(){
 const [counts,setCounts]=useState<Partial<Record<OxygenSection,string>>>({});
 const [wardGroups,setWardGroups]=useState<Partial<Record<OxygenSection,string>>>({});
 const [wards,setWards]=useState<Ward[]>([]);
 const [specialUse,setSpecialUse]=useState('unknown'),[extra,setExtra]=useState('');
 const [result,setResult]=useState<OxygenEstimate|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 function clear(){setResult(null);setError('');}
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;clear();setBusy(true);
  try{
   const inputs=[...sections.map(([kind])=>({kind,count:counts[kind]||'',department:wardGroups[kind]||''})),...wards];
   const rows=inputs.filter(row=>Number(row.count)>0).map(row=>({kind:row.kind,count:Number(row.count),...(row.department.trim()?{department:row.department}:{})}));
   const response=await fetch('/api/build-intake/oxygen-capacity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rows,specialUse,...(specialUse==='assessed'?{extraPeakLpm:Number(extra)}:{})})});
   const data=await response.json() as OxygenEstimate&{error?:string};
   if(!response.ok)throw Error(data.error||'محاسبه انجام نشد.');
   setResult(data);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <form onSubmit={submit}>
  <fieldset disabled={busy} className="space-y-4">
   <legend>روش HTM</legend>
   <p>تعداد تخت، اتاق یا جایگاه را در ردیف بخش مربوط وارد کنید. بخش‌های بدون مصرف را خالی بگذارید.</p>
   {groups.map(group=><fieldset key={group} className="flow-card">
    <legend>{group}</legend>
    <div className="form-grid">{sections.filter(([,section])=>section.group===group).map(([kind,section])=><label className="field" key={kind}>
     {section.label} · تعداد {section.unit}
     <input type="number" min="0" max="10000" step="1" value={counts[kind]||''} onChange={e=>{setCounts({...counts,[kind]:e.target.value});clear();}}/>
    </label>)}</div>
   </fieldset>)}
   <details open={wards.length>0||undefined}>
    <summary>تفکیک چند واحد بستری در یک دپارتمان</summary>
    <p>تعداد تخت هر واحد را جدا وارد کنید و برای واحدهای یک دپارتمان نام گروه یکسان بنویسید.</p>
    {groupedOxygenSections.map(kind=><label key={kind} className="field">نام گروه ردیف اصلی {oxygenSections[kind].label}<input maxLength={80} value={wardGroups[kind]||''} onChange={e=>{setWardGroups({...wardGroups,[kind]:e.target.value});clear();}}/></label>)}
    {wards.map((row,index)=><div className="form-grid" key={index}>
     <label className="field">نوع واحد<select value={row.kind} onChange={e=>{setWards(wards.map((r,i)=>i===index?{...r,kind:e.target.value as OxygenSection}:r));clear();}}>{groupedOxygenSections.map(kind=><option key={kind} value={kind}>{oxygenSections[kind].label}</option>)}</select></label>
     <label className="field">تعداد تخت<input type="number" min="1" max="10000" step="1" required value={row.count} onChange={e=>{setWards(wards.map((r,i)=>i===index?{...r,count:e.target.value}:r));clear();}}/></label>
     <label className="field">نام گروه<input maxLength={80} value={row.department} onChange={e=>{setWards(wards.map((r,i)=>i===index?{...r,department:e.target.value}:r));clear();}}/></label>
     <button type="button" className="btn" onClick={()=>{setWards(wards.filter((_,i)=>i!==index));clear();}}>حذف واحد</button>
    </div>)}
    <button type="button" className="btn" disabled={wards.length+sections.length>=100} onClick={()=>{setWards([...wards,{kind:'ward',count:'',department:''}]);clear();}}>افزودن واحد بستری</button>
   </details>
   <label className="field">مصرف ویژه خارج از ردیف‌ها، مثل اکسیژن پُردبی<select value={specialUse} onChange={e=>{setSpecialUse(e.target.value);clear();}}><option value="unknown">هنوز بررسی نشده</option><option value="none">مصرف اضافه ندارد</option><option value="assessed">دبی افزوده مشخص است</option></select></label>
   {specialUse==='assessed'&&<label className="field">دبی افزودهٔ اوج پس از حذف هم‌پوشانی (لیتر بر دقیقه)<input type="number" min="0" max="100000" step="any" value={extra} required onChange={e=>{setExtra(e.target.value);clear();}}/></label>}
   <button type="submit" className="btn primary">{busy?'در حال محاسبه…':'محاسبه ظرفیت اولیه'}</button>
  </fieldset>
  {error&&<p className="notice error" role="alert">{error}</p>}
  {result&&<div className="notice space-y-2" aria-live="polite">
   <p><strong>دبی پایهٔ شبکه</strong> · {format(result.subtotalLpm)} لیتر بر دقیقه</p>
   {result.designLpm===null?<p>جمع دبی طراحی پس از تعیین مصرف ویژه مشخص می‌شود.</p>:<p><strong>دبی طراحی در سناریوی واردشده</strong> · {format(result.designLpm)} لیتر بر دقیقه، معادل {format(result.designM3h!)} مترمکعب بر ساعت</p>}
  </div>}
 </form>;
}

function CylinderForm(){
 const [rows,setRows]=useState<Cylinder[]>([emptyCylinder()]);
 const [pressure,setPressure]=useState('120'),[hours,setHours]=useState('');
 const [result,setResult]=useState<ReturnType<typeof estimateCylinderOxygen>|null>(null);
 function change(index:number,field:keyof Cylinder,value:string){setRows(rows.map((row,i)=>i===index?{...row,[field]:value}:row));setResult(null);}
 function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  setResult(estimateCylinderOxygen(rows.map(row=>({volume:Number(row.volume),count:Number(row.count)})),Number(pressure),Number(hours)));
 }
 return <form onSubmit={submit}>
  <fieldset className="space-y-4">
   <legend>تطبیق کپسولی</legend>
   <p>برای هر اندازهٔ کپسول، حجم اسمی و مصرف روزانه را وارد کنید. برآورد اوج فرض می‌کند کل حجم روزانه در ساعت‌های اوج مصرف شود.</p>
   {rows.map((row,index)=><div className="form-grid" key={index}>
    <label className="field">حجم اسمی کپسول (لیتر)<input type="number" min="0.1" max="1000" step="any" required value={row.volume} onChange={e=>change(index,'volume',e.target.value)}/></label>
    <label className="field">تعداد کپسول مصرفی در روز<input type="number" min="0.001" max="100000" step="any" required value={row.count} onChange={e=>change(index,'count',e.target.value)}/></label>
    {rows.length>1&&<button type="button" className="btn" onClick={()=>{setRows(rows.filter((_,i)=>i!==index));setResult(null);}}>حذف اندازه</button>}
   </div>)}
   <button type="button" className="btn" onClick={()=>{setRows([...rows,emptyCylinder()]);setResult(null);}}>افزودن اندازهٔ کپسول</button>
   <div className="form-grid">
    <label className="field">فشار پرشدن کپسول (بار)<input type="number" min="1" max="400" step="any" value={pressure} required onChange={e=>{setPressure(e.target.value);setResult(null);}}/></label>
    <label className="field">چند ساعت در روز اوج مصرف دارید؟<input type="number" min="0.01" max="24" step="any" value={hours} required onChange={e=>{setHours(e.target.value);setResult(null);}}/></label>
   </div>
   <button type="submit" className="btn primary">محاسبه ظرفیت اولیه</button>
  </fieldset>
  {result&&<div className="notice space-y-2" aria-live="polite">
   <p>حجم تقریبی روزانه · {format(result.volume)} لیتر</p>
   <p>میانگین شبانه‌روز · {format(result.average)} لیتر بر دقیقه</p>
   <p><strong>برآورد دبی در ساعت‌های اوج</strong> · {format(result.peak)} لیتر بر دقیقه، معادل {format(result.peak*0.06)} مترمکعب بر ساعت</p>
   <p>اختلاف اوج برآوردی با میانگین شبانه‌روز · {format(result.peak-result.average)} لیتر بر دقیقه</p>
  </div>}
 </form>;
}
