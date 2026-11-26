'use client';

import {useEffect,useRef,useState,type FormEvent} from 'react';
import {KeyRound} from 'lucide-react';
import {formatDateTime,formatDate,isIsoDay,latinDigits} from '@/lib/persian-date';
import {legacyCorrectionMonths,phoneCustomerFields,type PhoneActivationCustomer,type PhoneActivationDevice,type PhoneActivationProduct,type PhoneActivationPurpose,type PhoneActivationResult} from '@/lib/phone-activation-contract';
import {ActivationDossier} from './activation-dossier';
import {SolarDate} from './solar-date';

type Lookup={accountId:string;device:PhoneActivationDevice;snapshot:string;today:string;linkedProductId:string};
const serialKey=(value:string)=>latinDigits(value).trim().toUpperCase();
const validSerial=(value:string)=>/^[A-Z0-9][A-Z0-9._/-]{0,159}$/.test(value);
const digitsOnly=(value:string)=>/^[0-9]{10}$/.test(value);

class ActivationRequestError extends Error{
 constructor(message:string,readonly status:number){super(message);}
}

async function request<T>(accountId:string,query:string,options:RequestInit={}):Promise<T>{
 const response=await fetch('/api/phone-activation'+query,{
  cache:'no-store',...options,
  headers:{'x-assistant-account':accountId,...(options.body?{'Content-Type':'application/json'}:{})},
 });
 const data=await response.json().catch(()=>null) as (T&{accountId:string;error?:string})|null;
 if(!response.ok)throw new ActivationRequestError(data?.error||'درخواست انجام نشد. دوباره تلاش کنید.',response.status);
 if(!data||data.accountId!==accountId)throw new Error('حساب یا پاسخ سامانه تغییر کرده است. دوباره تلاش کنید.');
 return data;
}

export function PhoneActivationPanel({accountId}:{accountId:string}){
 const [purpose,setPurpose]=useState<PhoneActivationPurpose>('activate');
 const [serial,setSerial]=useState(''),[code,setCode]=useState('');
 const [found,setFound]=useState<(Lookup&{purpose:PhoneActivationPurpose})|null>(null);
 const [warrantyStartDay,setWarrantyStartDay]=useState('');
 const [customer,setCustomer]=useState<Partial<PhoneActivationCustomer>>({});
 const [products,setProducts]=useState<PhoneActivationProduct[]|null>(null),[productId,setProductId]=useState(''),[query,setQuery]=useState('');
 const [lookupError,setLookupError]=useState(''),[catalogError,setCatalogError]=useState('');
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[stale,setStale]=useState(false);
 const [result,setResult]=useState<PhoneActivationResult|null>(null),[copied,setCopied]=useState(false);
 const [lookupRevision,setLookupRevision]=useState(0);
 const pending=useRef<{key:string;id:string}|null>(null),lock=useRef(false);
 const activeLookup=useRef<AbortController|null>(null);
 const resultPanel=useRef<HTMLDivElement|null>(null);
 const normalized=serialKey(serial),isSerialValid=validSerial(normalized);
 const lookup=found?.accountId===accountId&&found.purpose===purpose&&found.device.serial===normalized?found:null;
 const device=lookup?.device;
 const first=purpose==='activate'&&device?.state==='new';
 const correction=purpose==='legacy-correction';
 const canCorrect=correction&&device?.canCorrectLegacy;
 const reissue=correction&&device?.state==='activated'&&isIsoDay(device.activatedDay)&&!canCorrect;
 const showActivationForm=first||canCorrect;
 const validStart=!!lookup&&isIsoDay(warrantyStartDay)&&warrantyStartDay>'1900-01-01'&&warrantyStartDay<=lookup.today;
 const chooseProduct=showActivationForm&&device?.months===null&&!lookup?.linkedProductId;
 const selectedProduct=products?.find(product=>product.id===productId);
 const months=correction?legacyCorrectionMonths:device?.months??selectedProduct?.months;
 const knownModel=[device?.productName,device?.model].filter(Boolean).join(' · ');
 const canSubmit=!!device&&!stale&&(correction?reissue||canCorrect&&validStart:device.state!=='review'&&(purpose==='activate'||device.devicesKnown));
 const existingCorrectionDossier=reissue||canCorrect&&device?.devicesKnown;
 const showDossier=device&&(device.state==='activated'||device.legacy||existingCorrectionDossier||purpose==='board'&&device.devicesKnown);

 useEffect(()=>{
  if(!validSerial(normalized))return;
  const controller=new AbortController();
  activeLookup.current=controller;
  const timer=setTimeout(async()=>{
   if(controller.signal.aborted)return;
   try{
    const response=await request<Lookup>(accountId,'?'+new URLSearchParams({serial:normalized,purpose}),{signal:controller.signal});
    if(controller.signal.aborted)return;
    const defaults=Object.fromEntries(phoneCustomerFields.map(([key])=>[key,response.device.customer[key]||'']));
    setCustomer(current=>({...defaults,...current}));
    setFound({...response,purpose});
   }catch(cause){
    if(!controller.signal.aborted)setLookupError((cause as Error).message);
   }
  },320);
  return ()=>{clearTimeout(timer);controller.abort();};
 },[accountId,normalized,purpose,lookupRevision]);

 useEffect(()=>{
  if(!chooseProduct)return;
  const controller=new AbortController();
  const timer=setTimeout(async()=>{
   try{
    const data=await request<{products:PhoneActivationProduct[]}>(accountId,'?'+new URLSearchParams({view:'products',query}),{signal:controller.signal});
    if(!controller.signal.aborted)setProducts(data.products);
   }catch(cause){
    if(!controller.signal.aborted)setCatalogError((cause as Error).message);
   }
  },query?250:0);
  return ()=>{clearTimeout(timer);controller.abort();};
 },[accountId,chooseProduct,query]);

 function resetResult(){
  setError('');setResult(null);setCopied(false);
 }

 function resetLookup(){
  activeLookup.current?.abort();
  setFound(null);setLookupError('');setStale(false);
  setCustomer({});setWarrantyStartDay('');setQuery('');setProductId('');setProducts(null);setCatalogError('');
  resetResult();
 }

 function refreshLookup(){
  activeLookup.current?.abort();
  setFound(null);setLookupError('');setStale(false);setError('');
  setLookupRevision(revision=>revision+1);
 }

 async function submit(event:FormEvent){
  event.preventDefault();
  if(!lookup||!canSubmit||!digitsOnly(code)||result||lock.current)return;
  lock.current=true;setBusy(true);resetResult();
  try{
   const draft={serial:lookup.device.serial,purpose,deviceCode:code,snapshot:lookup.snapshot,...(showActivationForm?{customer,productId}:{}),...(canCorrect?{warrantyStartDay}:{})};
   const key=JSON.stringify(draft);
   if(pending.current?.key!==key)pending.current={key,id:crypto.randomUUID()};
   const issued=await request<PhoneActivationResult>(accountId,'',{method:'POST',body:JSON.stringify({...draft,confirmed:true,id:pending.current.id})});
   const newEntry={purpose,at:issued.at,actorName:issued.actorName,reference:''};
   setFound(current=>current&&({...current,device:{...current.device,history:[newEntry,...current.device.history].slice(0,20)}}));
   pending.current=null;
   setResult(issued);
  }catch(cause){
   if(cause instanceof ActivationRequestError&&cause.status===409)setStale(true);
   setError((cause as Error).message);
  }finally{
   lock.current=false;setBusy(false);
  }
 }

 useEffect(()=>{
  if(result)resultPanel.current?.scrollIntoView({block:'nearest'});
 },[result]);

 return <section dir="rtl" className="panel inside phone-activation-form" aria-label="صدور کد فعال‌سازی">
  <header className="phone-activation-heading">
   <span className="phone-activation-icon"><KeyRound size={22} aria-hidden="true"/></span>
   <h2>صدور کد فعال‌سازی</h2>
  </header>
  <form onSubmit={submit}>
   <fieldset disabled={busy}>
    <div className="phone-activation-fields">
     <label className="field">کد ۱۰رقمی نمایشگر *
      <input dir="ltr" inputMode="numeric" autoComplete="off" required maxLength={10} pattern="[0-9]{10}" value={code}
       onChange={event=>{
        setCode(latinDigits(event.target.value));
        if(result)refreshLookup();
        resetResult();
       }}/>
     </label>
     <label className="field">سریال روی بدنهٔ دستگاه *
      <input dir="ltr" autoComplete="off" required maxLength={160} value={serial} onChange={event=>{
       const value=event.target.value;
       if(serialKey(value)!==normalized)resetLookup();
       setSerial(value);
      }}/>
     </label>
    </div>

    <label className="field phone-activation-purpose">نوع درخواست
     <select value={purpose} onChange={event=>{
      resetLookup();setPurpose(event.target.value as PhoneActivationPurpose);
     }}>
      <option value="activate">فعال‌سازی دستگاه</option>
      <option value="board">تعویض برد الکترونیکی</option>
      <option value="legacy-correction">اصلاح سامانه قدیم</option>
     </select>
    </label>

    <div className="phone-activation-status" role="status">
     {!normalized&&'برای بررسی سابقه، سریال روی بدنه را وارد کنید.'}
     {normalized&&!isSerialValid&&'سریال روی بدنه را بررسی کنید.'}
     {isSerialValid&&!device&&!lookupError&&'در حال بررسی سابقهٔ سریال…'}
     {device&&!canCorrect&&(device.state==='review'||correction&&!reissue)&&'سوابق این سریال نیاز به بررسی دارد.'}
     {reissue&&'شناسنامه پیدا شد. می‌توانید کد پنج‌رقمی بگیرید. تاریخ شروع گارانتی '+formatDate(device.activatedDay)+' است و قابل تغییر نیست.'}
     {device?.state==='activated'&&!correction&&'سابقهٔ فعال‌سازی این سریال پیدا شد.'}
     {canCorrect&&'برای دستگاهی که قبلاً فعال شده، تاریخ واقعی شروع گارانتی را وارد کنید.'}
     {device?.state==='new'&&purpose==='board'&&!device.devicesKnown&&'برای تعویض برد، سریال دستگاه دارای سابقه را وارد کنید.'}
    </div>

    {showActivationForm&&!result&&<fieldset className="phone-activation-first">
     <legend>{correction?'اطلاعات اصلاح سامانه قدیم':'اطلاعات فعال‌سازی اولیه'}</legend>
     <div className="phone-activation-fields">
      {chooseProduct?<label className="field">جست‌وجوی مدل
       <input value={query} maxLength={80} onChange={event=>{
        setQuery(event.target.value);setProducts(null);setCatalogError('');setProductId('');
       }}/>
      </label>:<label className="field">محصول و مدل<input readOnly value={knownModel||'متصل به شناسنامهٔ دستگاه'}/></label>}
      {chooseProduct&&<label className="field">محصول و مدل *
       <select required value={productId} onChange={event=>setProductId(event.target.value)}>
        <option value="">محصول را انتخاب کنید</option>
        {products?.map(product=><option key={product.id} value={product.id}>{[product.name,product.model,product.code].filter(Boolean).join(' · ')}</option>)}
       </select>
       {catalogError?<small>{catalogError} برای تلاش دوباره عبارت جست‌وجو را تغییر دهید.</small>
        :products===null?<small>در حال خواندن محصولات…</small>
        :!products.length&&<small>محصولی با مدت گارانتی مشخص پیدا نشد.</small>}
      </label>}
      {phoneCustomerFields.map(([key,label])=>{
       const optional=key==='postalCode'||key==='referrer';
       const numeric=key==='mobile'||key==='nationalId'||key==='postalCode';
       return <label key={key} className="field">{label}{optional?' (اختیاری)':' *'}
        <input required={!optional} dir={numeric?'ltr':undefined} inputMode={numeric?'numeric':undefined}
         maxLength={key==='postalCode'?10:key==='referrer'?120:key==='name'?100:20} value={customer[key]||''}
         onChange={event=>setCustomer({...customer,[key]:event.target.value})}/>
       </label>;
      })}
     </div>
     {months!==undefined&&<p>{months?'مدت گارانتی '+months.toLocaleString('fa-IR')+' ماه':'بدون گارانتی'}</p>}
     {correction?<SolarDate label="تاریخ شروع گارانتی" value={warrantyStartDay} onChange={setWarrantyStartDay}/>
      :lookup&&<p>شروع گارانتی پس از صدور {formatDate(lookup.today)}</p>}
     {correction&&warrantyStartDay&&!validStart&&<small role="alert">تاریخ شروع گارانتی باید معتبر و تا امروز باشد.</small>}
    </fieldset>}

    {(error||lookupError)&&<p role="alert" className="notice error">{error||lookupError}</p>}
    <div className="phone-activation-actions">
     {!result&&<button type="submit" className="btn primary" disabled={busy||!canSubmit||!digitsOnly(code)}>
      <KeyRound size={18} aria-hidden="true"/> تولید کد پنج‌رقمی
     </button>}
     {(lookupError||stale)&&<button type="button" className="btn" onClick={refreshLookup}>بررسی دوبارهٔ سریال</button>}
    </div>
   </fieldset>
  </form>

  {device&&result&&<div role="status" className="phone-activation-result" ref={resultPanel}>
   <div>
    <h3>کد پنج‌رقمی</h3>
    <p>ثبت‌کننده {result.actorName} · {formatDateTime(result.at)}</p>
    {(result.first||result.corrected||reissue)&&<p>شروع گارانتی {formatDate(result.activatedDay)}</p>}
   </div>
   <strong dir="ltr">{result.activationCode}</strong>
   <button type="button" className="btn" onClick={async()=>{
    try{await navigator.clipboard.writeText(result.activationCode);setCopied(true);}
    catch{setError('کد را دستی انتخاب و کپی کنید.');}
   }}>{copied?'کپی شد':'کپی کد'}</button>
  </div>}

  {device&&(showDossier||device.history.length>0)&&<details className="phone-activation-dossier" open={existingCorrectionDossier||undefined} key={device.serial+':'+purpose}>
   <summary>شناسنامه و سوابق دستگاه</summary>
   {(showDossier||result?.corrected)&&<ActivationDossier showCustomer={purpose!=='board'} today={lookup?.today} showStoredStart={reissue?device.activatedDay:undefined}
    legacyDateConfirmed={device.state==='activated'&&device.activatedDay===device.legacy?.activeDate.slice(0,10)} record={{
    serial:device.serial,at:device.legacy?.activeDate||device.activatedDay,legacy:device.legacy,
    customer:result?.corrected?customer:device.customer,dealer:device.dealer,
    model:result?.corrected&&selectedProduct?[selectedProduct.name,selectedProduct.model].filter(Boolean).join(' · '):knownModel,
    months:result?.corrected?legacyCorrectionMonths:device.months??undefined,
    warrantyStartDay:result?.corrected?result.activatedDay:device.warrantyCorrection?device.activatedDay:undefined,
    activatedAt:result?.corrected?result.at:device.warrantyCorrection?.at,
    actor:result?.corrected?result.actorName:device.warrantyCorrection?.actorName,
   }}/>}
   {!!device.history.length&&<section aria-label="سابقهٔ صدور کد">
    <h3>سابقهٔ صدور کد</h3>
    {device.history.map((entry,index)=><div className="recordline" key={entry.at+':'+index}>
     <p>{entry.purpose==='board'?'صدور کد تعویض برد':entry.purpose==='legacy-correction'?'اصلاح سامانه قدیم':'صدور کد فعال‌سازی'} · {entry.actorName} · {formatDateTime(entry.at)}</p>
     {entry.reference&&<small>{entry.reference}</small>}
    </div>)}
   </section>}
  </details>}
 </section>;
}
