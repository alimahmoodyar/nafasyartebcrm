'use client';

import {useEffect,useRef,useState,type FormEvent} from 'react';
import {formatDate} from '@/lib/persian-date';

const fields=[
 ['serial','سریال بدنه',160,'text',true,'روی برچسب بدنهٔ دستگاه'],
 ['deviceCode','کد ۱۰رقمی نمایشگر',10,'numeric',true,'کدی که نمایشگر دستگاه نشان می‌دهد'],
 ['name','نام و نام خانوادگی',100,'text',true,''],
 ['mobile','شمارهٔ همراه',20,'tel',true,''],
 ['nationalId','کد ملی',10,'numeric',true,''],
 ['referrer','نام پزشک',120,'text',false,''],
 ['postalCode','کد پستی',10,'numeric',false,''],
] as const;
type Result={activationCode:string;activatedDay:string;welcomeStatus:'pending'|'sent'|'unconfirmed'};

export function PublicWarrantyForm(){
 const [details,setDetails]=useState<Record<string,string>>({});
 const [ticket,setTicket]=useState<{token:string;mobileLast4:string}|null>(null);
 const [code,setCode]=useState(''),[result,setResult]=useState<Result|null>(null);
 const [available,setAvailable]=useState<boolean|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const pending=useRef(false),codeInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{
  const request=new AbortController();
  void fetch('/api/public-warranty',{cache:'no-store',signal:request.signal})
   .then(async r=>setAvailable(r.ok&&(await r.json() as {ready:boolean}).ready===true))
   .catch(()=>{if(!request.signal.aborted)setAvailable(false);});
  return ()=>request.abort();
 },[]);
 useEffect(()=>{if(ticket)codeInput.current?.focus();},[ticket]);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(pending.current||!available)return;
  pending.current=true;setBusy(true);setError('');
  try{
   const response=await fetch('/api/public-warranty',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(ticket?{mode:'confirm',token:ticket.token,code,details}:{mode:'request',details})});
   const data=await response.json() as Result & {error?:string;token:string;mobileLast4:string};
   if(!response.ok){
    if(response.status===410){setTicket(null);setCode('');}
    throw Error(data.error||'درخواست انجام نشد.');
   }
   if(ticket){setResult(data);setTicket(null);setDetails({});setCode('');}
   else setTicket({token:data.token,mobileLast4:data.mobileLast4});
  }catch(e){setError((e as Error).message||'ارتباط برقرار نشد. دوباره تلاش کنید.');}
  finally{pending.current=false;setBusy(false);}
 }
 if(result)return <div className="public-warranty-result" role="status">
  <h2>گارانتی ثبت شد</h2>
  <p>اگر هنوز کد را روی دستگاه وارد نکرده‌اید، از همین کد استفاده کنید.</p>
  <output aria-label="کد فعال‌سازی" dir="ltr">{result.activationCode}</output>
  <p>تاریخ شروع گارانتی {formatDate(result.activatedDay)}</p>
  <p>{result.welcomeStatus==='sent'?'ارسال پیامک خوشامد توسط پنل پیامک پذیرفته شد.':'ارسال پیامک خوشامد هنوز تأیید نشده است.'}</p>
 </div>;
 return <form onSubmit={submit} autoComplete="off">
  {available!==true&&<p role="status">{available===null?'در حال بررسی دسترسی فرم…':'ارسال پیامک فعال‌سازی در این محیط فعلاً در دسترس نیست.'}</p>}
  <fieldset disabled={busy||available!==true}>
   {ticket?<div className="public-warranty-step">
    <h2>وارد کردن کد فعال‌سازی</h2>
    <p>کد به شمارهٔ منتهی به <bdi>{ticket.mobileLast4}</bdi> ارسال شد. همان کد را در این فرم و روی دستگاه وارد کنید.</p>
    <label>کد پنج‌رقمی پیامک‌شده<input ref={codeInput} dir="ltr" inputMode="numeric" autoComplete="one-time-code" required maxLength={5} value={code} onChange={e=>setCode(e.target.value)}/></label>
   </div>:<div className="public-warranty-fields">
    {fields.map(([key,title,length,mode,required,hint])=><label key={key}>{title} <small>{required?'الزامی':'اختیاری'}</small>
     <input name={key} dir={mode==='text'&&key!=='serial'?'rtl':'ltr'} inputMode={mode} value={details[key]||''}
      maxLength={length} required={required} onChange={e=>setDetails(old=>({...old,[key]:e.target.value}))}/>
     {!!hint&&<small>{hint}</small>}
    </label>)}
    <label className="public-warranty-wide">آدرس <small>اختیاری</small><textarea rows={2} maxLength={400} value={details.address||''} onChange={e=>setDetails(old=>({...old,address:e.target.value}))}/></label>
   </div>}
  </fieldset>
  {error&&<p role="alert" className="public-warranty-error">{error}</p>}
  <div className="public-warranty-actions">
   <button type="submit" disabled={busy||available!==true}>{busy?'در حال انجام…':ticket?'تأیید کد و ثبت گارانتی':'ارسال کد پنج‌رقمی'}</button>
   {ticket&&<button type="button" disabled={busy} onClick={()=>{setCode('');setError('');setTicket(null);}}>ویرایش اطلاعات یا دریافت دوبارهٔ کد</button>}
  </div>
 </form>;
}
