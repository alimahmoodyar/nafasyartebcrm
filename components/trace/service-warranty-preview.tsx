'use client';
import {useEffect,useState} from 'react';
import {formatDate,isIsoDay} from '@/lib/persian-date';
import {normalizeSerial} from '@/lib/distribution';
import {serviceWarrantyStates} from '@/lib/service-warranty-labels';
export function ServiceWarrantyDetails({w}:{w:any}){
 const rows=[['وضعیت گارانتی',serviceWarrantyStates[w.state]||serviceWarrantyStates.unknown],['مدل دستگاه',w.model||'ثبت نشده'],['تاریخ شروع',w.activatedAt?formatDate(w.activatedAt):'ثبت نشده'],['تاریخ پایان',w.endsAt?formatDate(w.endsAt):'قابل تعیین نیست'],['مدت گارانتی',w.months>0?Number(w.months).toLocaleString('fa-IR')+' ماه':'ثبت نشده'],['نمایندگی در سابقه فروش',w.salesDealer?.state==='recorded'?w.salesDealer.name:w.salesDealer?.state==='conflict'?'سوابق فروش متفاوت است؛ نیازمند بررسی':'نمایندگی فروش ثبت نشده']];
 return <><dl style={{display:'grid',gridTemplateColumns:'minmax(140px, 1fr) 2fr',gap:'8px 16px',marginBlock:12}}>{rows.map(([label,value])=><div key={label} style={{display:'contents'}}><dt className="subtle">{label}</dt><dd style={{margin:0}}>{value}</dd></div>)}</dl>{w.explanation&&<p>{w.explanation}</p>}{w.state==='active'&&<p>باقی‌مانده در تاریخ تماس: {Number(w.remainingDays).toLocaleString('fa-IR')} روز</p>}<p className="subtle">نمایندگی از فروش تحویل‌شدهٔ مرتبط با سریال خوانده می‌شود. پوشش فنی خرابی پس از عیب‌یابی تعیین می‌شود.</p></>;
}
export function ServiceWarrantyPreview({serial,day,domain,accountId}:{serial:string;day:string;domain:string;accountId:string}){
 const normalized=normalizeSerial(serial||''),key=JSON.stringify([normalized,day,domain,accountId]);
 const [result,setResult]=useState<{key:string;w?:any;error?:string}|null>(null),[retry,setRetry]=useState(0);
 useEffect(()=>{if(!normalized||!isIsoDay(day))return;let active=true;const controller=new AbortController();const timer=setTimeout(async()=>{try{
 const q=new URLSearchParams({serial:normalized,day,domain}),r=await fetch('/api/after-sales/warranty?'+q,{cache:'no-store',headers:{'x-assistant-account':accountId},signal:controller.signal}),d:any=await r.json();
 if(!r.ok)throw Error(d.error||'استعلام انجام نشد.');if(d.accountId!==accountId)throw Error('حساب ورود تغییر کرده است.');if(active)setResult({key,w:d.warranty});
 }catch(e){if(active&&!controller.signal.aborted)setResult({key,error:(e as Error).message});}},350);
 return()=>{active=false;clearTimeout(timer);controller.abort();};},[key,retry]);
 const current=result?.key===key?result:null,w=current?.w;
 return <section className="notice" aria-label="وضعیت گارانتی پیش از تشکیل پرونده" aria-live="polite" aria-busy={!!normalized&&isIsoDay(day)&&!current} style={{marginBlock:16}}><strong>وضعیت گارانتی دستگاه</strong>{!normalized?<p>برای استعلام، سریال دستگاه را وارد کنید.</p>:!isIsoDay(day)?<p>تاریخ تماس را انتخاب کنید.</p>:current?.error?<><p role="alert">{current.error}</p><button type="button" className="link" onClick={()=>{setResult(null);setRetry(n=>n+1);}}>استعلام دوباره</button></>:!w?<p>در حال بررسی سریال و تاریخ تماس…</p>:<><ServiceWarrantyDetails w={w}/><p>مبنای بررسی: تاریخ تماس {formatDate(w.checkedAt)}.</p></>}</section>;
}
