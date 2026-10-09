'use client';
import {useEffect,useState} from 'react';
import {formatDate,isIsoDay} from '@/lib/persian-date';
import {normalizeSerial} from '@/lib/distribution';
import {serviceWarrantyStates} from '@/lib/service-warranty-labels';
export function ServiceWarrantyPreview({serial,day,domain,accountId}:{serial:string;day:string;domain:string;accountId:string}){
 const normalized=normalizeSerial(serial||''),key=JSON.stringify([normalized,day,domain,accountId]);
 const [result,setResult]=useState<{key:string;w?:any;error?:string}|null>(null),[retry,setRetry]=useState(0);
 useEffect(()=>{if(!normalized||!isIsoDay(day))return;let active=true;const controller=new AbortController();const timer=setTimeout(async()=>{try{
 const q=new URLSearchParams({serial:normalized,day,domain}),r=await fetch('/api/after-sales/warranty?'+q,{cache:'no-store',headers:{'x-assistant-account':accountId},signal:controller.signal}),d:any=await r.json();
 if(!r.ok)throw Error(d.error||'استعلام انجام نشد.');if(d.accountId!==accountId)throw Error('حساب ورود تغییر کرده است.');if(active)setResult({key,w:d.warranty});
 }catch(e){if(active&&!controller.signal.aborted)setResult({key,error:(e as Error).message});}},350);
 return()=>{active=false;clearTimeout(timer);controller.abort();};},[key,retry]);
 const current=result?.key===key?result:null,w=current?.w;
 return <section className="notice" aria-label="وضعیت گارانتی پیش از تشکیل پرونده" aria-live="polite" aria-busy={!!normalized&&isIsoDay(day)&&!current} style={{marginBlock:16}}><strong>وضعیت گارانتی دستگاه</strong>{!normalized?<p>برای استعلام، سریال دستگاه را وارد کنید.</p>:!isIsoDay(day)?<p>تاریخ تماس را انتخاب کنید.</p>:current?.error?<><p role="alert">{current.error}</p><button type="button" className="link" onClick={()=>{setResult(null);setRetry(n=>n+1);}}>استعلام دوباره</button></>:!w?<p>در حال بررسی سریال و تاریخ تماس…</p>:<><p><strong>{serviceWarrantyStates[w.state]||serviceWarrantyStates.unknown}</strong>{w.model?' · مدل '+w.model:''}</p><p>شروع: {w.activatedAt?formatDate(w.activatedAt):'ثبت نشده'} · پایان: {w.endsAt?formatDate(w.endsAt):'نامشخص'}{w.months>0?' · مدت '+Number(w.months).toLocaleString('fa-IR')+' ماه':''}</p>{w.state==='active'&&<p>باقی‌مانده در تاریخ تماس: {Number(w.remainingDays).toLocaleString('fa-IR')} روز</p>}<p>مبنای بررسی: تاریخ تماس {formatDate(w.checkedAt)}. پوشش فنی خرابی پس از عیب‌یابی و بررسی مسئول خدمات تعیین می‌شود.</p></>}</section>;
}
