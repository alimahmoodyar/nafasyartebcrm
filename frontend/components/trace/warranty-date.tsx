'use client';
import {useEffect,useState} from 'react';

export function WarrantyDateValue({at,loading=false,error=false}:{at:string|null;loading?:boolean;error?:boolean}) {
 const valid=at&&Number.isFinite(new Date(at).getTime());
 return <div className="kv"><p>تاریخ فعال‌سازی گارانتی</p><strong role="status">{loading?'در حال دریافت…':error?'دریافت تاریخ انجام نشد؛ دوباره باز کنید.':at?(valid?new Date(at).toLocaleString('fa-IR',{timeZone:'Asia/Tehran',dateStyle:'medium',timeStyle:'short'}):'تاریخ نیازمند بررسی است'):'هنوز فعال نشده'}</strong></div>;
}

export function WarrantyDateField({deviceId,demo}:{deviceId?:string;demo:boolean}) {
 const [result,setResult]=useState<{deviceId:string;at:string|null;error?:boolean}|null>(null);
 useEffect(()=>{
  if(!deviceId||demo)return;
  const controller=new AbortController();
  fetch('/api/distribution?'+new URLSearchParams({device:deviceId,view:'warranty'}),{signal:controller.signal})
   .then(async response=>{if(!response.ok)throw new Error('Failed');const data=await response.json() as {warrantyActivatedAt:string|null};if(!controller.signal.aborted)setResult({deviceId,at:data.warrantyActivatedAt});})
   .catch(()=>{if(!controller.signal.aborted)setResult({deviceId,at:null,error:true});});
  return()=>controller.abort();
 },[deviceId,demo]);
 const current=result?.deviceId===deviceId?result:null;
 return <div className="field wide">{deviceId?<WarrantyDateValue at={demo?null:current?.at||null} loading={!demo&&!current} error={!demo&&current?.error}/>:<div className="kv"><p>تاریخ فعال‌سازی گارانتی</p><strong>ابتدا سریال ثبت‌شده را وارد کنید.</strong></div>}<p className="subtle">از زمان اولین صدور موفق کد فعال‌سازی، به وقت ایران؛ این تاریخ خودکار ثبت می‌شود.</p></div>;
}
