'use client';

import {useRef,useState} from 'react';
import {formatDateTime,formatDate} from '@/lib/persian-date';
import {phoneCustomerFields,type PhoneActivationCustomer,type PhoneActivationDevice,type PhoneActivationProduct,type PhoneActivationPurpose,type PhoneActivationResult} from '@/lib/phone-activation-contract';
import {NumberInput} from './number-input';
import {ActivationDossier} from './activation-dossier';

type Lookup={device:PhoneActivationDevice;snapshot:string;today:string;linkedProductId:string};
const purposes={activate:'فعال‌سازی دستگاه',board:'تعویض برد الکترونیکی'} as const;

export function PhoneActivationPanel({accountId}:{accountId:string}){
 const [purpose,setPurpose]=useState<PhoneActivationPurpose>('activate');
 const [serial,setSerial]=useState(''),[code,setCode]=useState(''),[reference,setReference]=useState('');
 const [found,setFound]=useState<Lookup|null>(null),[customer,setCustomer]=useState<Partial<PhoneActivationCustomer>>({});
 const [products,setProducts]=useState<PhoneActivationProduct[]>([]),[productId,setProductId]=useState(''),[query,setQuery]=useState('');
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[searched,setSearched]=useState(false);
 const [result,setResult]=useState<PhoneActivationResult|null>(null),[copied,setCopied]=useState(false);
 const pending=useRef<{key:string;id:string}|null>(null),lock=useRef(false);
 const headers={'x-assistant-account':accountId};
 const device=found?.device;
 const first=purpose==='activate'&&device?.state==='new';
 const chooseProduct=first&&device?.months===null&&!found?.linkedProductId;
 const selectedProduct=products.find(product=>product.id===productId);
 const months=device?.months??selectedProduct?.months;
 const canSubmit=!!device&&device.state!=='review'&&(purpose==='activate'||device.devicesKnown);
 const today=found?.today;

 async function request<T>(query:string,body?:Record<string,unknown>):Promise<T>{
  const response=await fetch('/api/phone-activation'+query,body?{
   method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)
  }:{cache:'no-store',headers});
  const data=await response.json() as T&{accountId:string;error?:string};
  if(!response.ok||data.accountId!==accountId)throw Error(data.error||'حساب ورود تغییر کرده است.');
  return data;
 }
 function clear(){
  setFound(null);setCustomer({});setResult(null);setCopied(false);setQuery('');setProducts([]);setProductId('');setSearched(false);setError('');setCode('');setReference('');
 }
 async function searchProducts(term:string){
  const data=await request<{products:PhoneActivationProduct[]}>('?'+new URLSearchParams({view:'products',query:term}));
  setProducts(data.products);setSearched(true);
 }
 async function run(work:()=>Promise<void>){
  if(lock.current)return;
  lock.current=true;setBusy(true);setError('');
  try{await work();}
  catch(error){setError((error as Error).message);}
  finally{lock.current=false;setBusy(false);}
 }
 async function search(value:string,nextPurpose:PhoneActivationPurpose){
  await run(async()=>{
   clear();
   setPurpose(nextPurpose);
   const lookup=await request<Lookup>('?'+new URLSearchParams({serial:value,purpose:nextPurpose}));
   setSerial(lookup.device.serial);
   setFound(lookup);
   setCustomer(Object.fromEntries(phoneCustomerFields.map(([key])=>[key,lookup.device.customer[key]||''])));
   if(nextPurpose==='activate'&&lookup.device.state==='new'&&lookup.device.months===null&&!lookup.linkedProductId)await searchProducts('');
  });
 }
 async function submit(event:React.FormEvent){
  event.preventDefault();
  if(!canSubmit||!found||!purpose)return;
  await run(async()=>{
   setResult(null);setCopied(false);
   const draft={serial:found.device.serial,purpose,deviceCode:code,reference,snapshot:found.snapshot,...(first?{customer,productId}:{})};
   const key=JSON.stringify(draft);
   if(pending.current?.key!==key)pending.current={key,id:crypto.randomUUID()};
   const issued=await request<PhoneActivationResult>('',{...draft,confirmed:true,id:pending.current.id});
   const newEntry={purpose,at:issued.at,actorName:issued.actorName,reference};
   setFound(current=>current&&({...current,device:{...current.device,history:[newEntry,...current.device.history].slice(0,20)}}));
   pending.current=null;
   setResult(issued);
  });
 }

 return <section dir="rtl" className="panel inside" aria-label="صدور کد فعال‌سازی">
  <h2>صدور کد فعال‌سازی</h2>
  <form className="tools" onSubmit={event=>{event.preventDefault();void search(serial,purpose);}}>
   <label className="field">سریال روی بدنهٔ دستگاه<input dir="ltr" maxLength={160} required value={serial} disabled={busy} onChange={event=>{setSerial(event.target.value);clear();}}/></label>
   <button type="submit" className="btn primary" disabled={busy}>باز کردن فرم</button>
  </form>
  {error&&<p role="alert" className="notice error">{error}</p>}
  {device&&<section aria-label="شناسنامهٔ دستگاه">
   <h3>شناسنامهٔ دستگاه <bdi>{device.serial}</bdi></h3>
   <fieldset disabled={busy}>
    <legend>نوع درخواست</legend>
    <div className="tools">
     {Object.entries(purposes).map(([key,label])=><button type="button" key={key} className={'btn'+(key===purpose?' primary':'')} aria-pressed={key===purpose} onClick={()=>{if(key!==purpose)void search(device.serial,key as PhoneActivationPurpose);}}>{label}</button>)}
    </div>
   </fieldset>
   {device.state==='activated'&&<p className="notice">فعال‌سازی قبلی در {formatDate(device.activatedDay)} ثبت شده است. {device.basis}</p>}
   {device.state==='review'&&<p role="status" className="notice error">سوابق این سریال نیاز به بررسی دارند. تاریخ فعال‌سازی قبلی حفظ می‌شود.</p>}
   {purpose==='board'&&!device.devicesKnown&&<p role="status" className="notice">برای این سریال شناسنامه یا سابقه‌ای پیدا نشد. سریال روی بدنه را دوباره بررسی کنید.</p>}
   {(device.state==='activated'||device.legacy||purpose==='board'&&device.devicesKnown)&&<ActivationDossier showCustomer={purpose==='activate'} record={{
    serial:device.serial,at:device.legacy?.activeDate||device.activatedDay,legacy:device.legacy,
    customer:device.customer,dealer:device.dealer,model:[device.productName,device.model].filter(Boolean).join(' · '),
    months:device.months??undefined,
   }}/>}
   {first&&today&&<p>تاریخ شروع گارانتی پس از صدور، {formatDate(today)} ثبت می‌شود.</p>}
   {chooseProduct&&<div className="tools">
    <label className="field">جست‌وجوی مدل<input value={query} maxLength={80} disabled={busy} onChange={event=>setQuery(event.target.value)}/></label>
    <button type="button" className="btn" disabled={busy} onClick={()=>void run(()=>searchProducts(query))}>جست‌وجوی محصول</button>
   </div>}
   {canSubmit&&!result&&<form onSubmit={submit}>
    <fieldset className="formgrid" disabled={busy}>
     {chooseProduct&&<label className="field">محصول دارای مدت گارانتی مشخص
      <select required value={productId} onChange={event=>setProductId(event.target.value)}>
       <option value="">محصول را انتخاب کنید</option>
       {products.map(product=><option key={product.id} value={product.id}>{[product.name,product.model,product.code].filter(Boolean).join(' · ')}</option>)}
      </select>
      {searched&&!products.length&&<small>محصول مطابق با مدت گارانتی مشخص پیدا نشد.</small>}
     </label>}
     {months!==undefined&&months!==null&&<p>{months?'مدت گارانتی '+months.toLocaleString('fa-IR')+' ماه':'بدون گارانتی'}</p>}
     {first&&phoneCustomerFields.map(([key,label])=><label key={key} className="field">{label}{key==='referrer'?' (اختیاری)':' *'}
      <input required={key!=='referrer'} dir={['mobile','nationalId','postalCode'].includes(key)?'ltr':undefined} inputMode={['mobile','nationalId','postalCode'].includes(key)?'numeric':undefined} maxLength={key==='referrer'?120:key==='name'?100:20} value={customer[key]||''} onChange={event=>setCustomer({...customer,[key]:event.target.value})}/>
     </label>)}
     <label className="field">کد ۱۰رقمی روی نمایشگر *
      <NumberInput fieldKey="code" dir="ltr" inputMode="numeric" autoComplete="off" required maxLength={10} value={code} onChange={event=>setCode(event.target.value)}/>
     </label>
     <label className="field">شمارهٔ پروندهٔ تعمیر یا توضیح (اختیاری)<input maxLength={180} value={reference} onChange={event=>setReference(event.target.value)}/></label>
    </fieldset>
    <button type="submit" className="btn primary" disabled={busy}>{first?'ثبت فعال‌سازی و تولید کد':'تأیید و تولید کد پنج‌رقمی'}</button>
   </form>}
   {result&&<div role="status" className="notice">
    <p>کد پنج‌رقمی <strong dir="ltr" style={{fontSize:32,letterSpacing:4}}>{result.activationCode}</strong></p>
    <p>ثبت‌کننده {result.actorName} · {formatDateTime(result.at)}</p>
    {result.first&&<p>شروع فعال‌سازی {formatDate(result.activatedDay)}</p>}
    <button type="button" className="btn" onClick={async()=>{try{await navigator.clipboard.writeText(result.activationCode);setCopied(true);}catch{setError('کد را دستی انتخاب و کپی کنید.');}}}>{copied?'کپی شد':'کپی کد'}</button>
   </div>}
   {!!device.history.length&&<section aria-label="سابقهٔ صدور کد">
    <h3>سابقهٔ صدور کد</h3>
    {device.history.map((entry,index)=><div className="recordline" key={entry.at+':'+index}><p>{entry.purpose==='board'?'صدور کد تعویض برد':'صدور کد فعال‌سازی'} · {entry.actorName} · {formatDateTime(entry.at)}</p>{entry.reference&&<small>{entry.reference}</small>}</div>)}
   </section>}
  </section>}
 </section>;
}
