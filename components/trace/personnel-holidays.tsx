'use client';

import {useState} from 'react';
import {SolarDate} from './solar-date';
import {formatDate,latinDigits,solarParts,solarToIso} from '@/lib/persian-date';
import {holidayType,officialCalendar1405,officialCalendarSite} from '@/lib/personnel-holiday-calendar';

const types={official:'تقویم رسمی سال',closure:'تعطیلی اعلامی',work:'شیفت کاری در تعطیلی رسمی',cancel:'لغو استثنا'} as const;
type Kind=keyof typeof types;

export function PersonnelHolidays({records,today,busy,onSave}:{records:any[];today:string;busy:boolean;onSave:(fields:Record<string,unknown>)=>Promise<unknown>}){
 const [kind,setKind]=useState<Kind>('official');
 const [year,setYear]=useState(String(solarParts(today).year));
 const [effective,setEffective]=useState(today);
 const [source,setSource]=useState('');
 const [dates,setDates]=useState('');
 const [day,setDay]=useState('');
 const [shiftId,setShiftId]=useState('');
 const [location,setLocation]=useState('');
 const [notes,setNotes]=useState('');
 const [target,setTarget]=useState<any>(null);
 const rows=records.filter(row=>row.type===holidayType);
 const shifts=records.filter(row=>row.type==='hr_shift'&&row.data.state==='published');
 const locations=[...new Set<string>(records.filter(row=>row.type==='hr_employee'&&row.data.state==='active').map(row=>row.data.location).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fa'));
 const annual=rows.filter(row=>row.data.kind==='official').sort((a,b)=>b.data.year-a.data.year);
 const exceptions=rows.filter(row=>row.data.kind!=='official').sort((a,b)=>b.data.day.localeCompare(a.data.day));
 const preset=year==='1405';
 const scope=(entry:any)=>[entry.location,shifts.find(row=>row.id===entry.shiftId)?.data.title].filter(Boolean).join(' · ')||'همهٔ شیفت‌ها';
 const selectKind=(value:Kind)=>{setKind(value);setNotes('');setTarget(null);};
 async function save(){
  const fields=kind==='official'?{
   holidayYear:Number(latinDigits(year)),holidayEffective:effective,holidaySource:preset?officialCalendar1405.source:source.trim(),
   ...(preset?{}:{holidayDays:dates.split(/[\s،,]+/).filter(Boolean)})
  }:kind==='cancel'?{recordId:target.id,revision:target.revision}:{holidayDay:day,shiftId,holidayLocation:location};
  if(await onSave({mode:'holiday_calendar',holidayKind:kind,notes:kind==='official'?'ورود نسخهٔ رسمی تقویم سال':notes.trim(),...fields})){
   setNotes('');
   setDay('');
   if(kind==='cancel')selectKind('closure');
  }
 }
 return <section className="panel inside" aria-label="تقویم تعطیلی‌ها">
  <h3>تقویم تعطیلی‌ها</h3>
  <p className="muted">تقویم هر سال یک‌بار وارد می‌شود و از تاریخ آغاز اعمال، مبنای مرخصی و کارکرد است.</p>
  <div className="tools">
   {(['official','closure','work'] as const).map(value=><button key={value} type="button" className={'btn '+(kind===value?'primary':'')} onClick={()=>selectKind(value)}>{types[value]}</button>)}
  </div>
  <form onSubmit={event=>{event.preventDefault();void save()}}>
   <div className="formgrid">
    {kind==='official'&&<>
     <label className="field">سال شمسی<input required inputMode="numeric" maxLength={4} value={year} onChange={event=>{
      const value=latinDigits(event.target.value);setYear(value);
      setEffective(value===String(solarParts(today).year)?today:solarToIso(Number(value),1,1));
     }}/></label>
     <SolarDate required label="آغاز اعمال تقویم" value={effective} onChange={setEffective}/>
     {preset?<p><a href={officialCalendar1405.source} target="_blank" rel="noreferrer">نسخهٔ رسمی ۱۴۰۵</a> · {officialCalendar1405.days.length.toLocaleString('fa-IR')} روز تعطیل رسمی آمادهٔ ورود</p>:<>
      <label className="field">نشانی فایل رسمی سال<input required type="url" value={source} onChange={event=>setSource(event.target.value)}/></label>
      <label className="field">تاریخ‌های تعطیل شمسی<textarea required placeholder="۱۴۰۷/۰۱/۰۱" value={dates} onChange={event=>setDates(event.target.value)}/></label>
      <p className="muted"><a href={officialCalendarSite} target="_blank" rel="noreferrer">دریافت تقویم رسمی سال</a> · هر تاریخ را در یک خط وارد کنید.</p>
     </>}
    </>}
    {(kind==='closure'||kind==='work')&&<>
     <SolarDate required label="تاریخ (شمسی)" value={day} onChange={setDay}/>
     <label className="field">برنامهٔ شیفت<select required={kind==='work'} value={shiftId} onChange={event=>setShiftId(event.target.value)}>
      <option value="">{kind==='work'?'شیفت را انتخاب کنید':'همهٔ شیفت‌ها'}</option>
      {shifts.map(row=><option key={row.id} value={row.id}>{row.data.title}</option>)}
     </select></label>
     <label className="field">محل کار<select value={location} onChange={event=>setLocation(event.target.value)}>
      <option value="">همهٔ محل‌ها</option>{locations.map(name=><option key={name} value={name}>{name}</option>)}
     </select></label>
    </>}
    {kind==='cancel'&&target&&<p>لغو {types[target.data.kind as Kind]} در {formatDate(target.data.day)} · {scope(target.data)}</p>}
    {kind!=='official'&&<label className="field">علت یا مرجع اعلام<input required maxLength={4000} value={notes} onChange={event=>setNotes(event.target.value)}/></label>}
   </div>
   <button type="submit" className="btn primary" disabled={busy||kind==='official'&&!effective||kind!=='official'&&!notes.trim()||kind!=='official'&&kind!=='cancel'&&!day}>
    {kind==='official'?'ورود و اعمال تقویم رسمی':kind==='cancel'?'تأیید لغو':'ثبت در تقویم'}
   </button>
  </form>
  {annual.map(row=><details key={row.id}>
   <summary>تقویم رسمی {row.data.year.toLocaleString('fa-IR')} · آغاز اعمال {formatDate(row.data.effective)}</summary>
   <p>{row.data.days.map((date:string)=>formatDate(date)).join('، ')}</p>
   <a href={row.data.source} target="_blank" rel="noreferrer">منبع رسمی</a>
  </details>)}
  {exceptions.map(row=><article className="flow-card" key={row.id}>
   <p>{formatDate(row.data.day)} · {types[row.data.kind as Kind]} · {scope(row.data)}</p>
   <p className="muted">{row.data.reason}</p>
   {row.data.state==='cancelled'?<p className="muted">لغوشده · {row.data.cancelReason}</p>:<button type="button" className="btn" disabled={busy} onClick={()=>{selectKind('cancel');setTarget(row);}}>لغو این ثبت</button>}
  </article>)}
 </section>;
}
