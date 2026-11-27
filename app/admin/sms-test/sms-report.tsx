'use client';

import {useEffect,useState,type FormEvent} from 'react';
import {formatDateTime,latinDigits} from '@/lib/persian-date';

const purposes={
 recovery_enroll:'ثبت شمارهٔ بازیابی',
 recovery_reset:'بازیابی رمز عبور',
 admin_test:'تست پیامک',
 warranty_activation:'کد فعال‌سازی گارانتی',
 warranty_welcome:'خوش‌آمدگویی گارانتی',
 asset_otp:'کد تأیید اموال',
 other:'سایر پیامک‌ها',
} as const;
const outcomes={
 invalid_mobile:'شمارهٔ همراه نامعتبر بود',
 rate_limited:'محدودیت تعداد درخواست فعال شد',
 invalid_password:'رمز فعلی تأیید نشد',
 backup_required:'کد پشتیبان مدیر تأیید نشد',
 mobile_in_use:'شماره برای حساب دیگری ثبت شده است',
 config_unavailable:'تنظیمات یا دسترسی به پنل پیامک آماده نبود',
 account_mismatch:'حساب یا شمارهٔ بازیابی تطبیق نداشت',
 recovery_mobile_unverified:'شمارهٔ بازیابی برای این حساب هنوز تأیید نشده است',
 recovery_mobile_mismatch:'شمارهٔ واردشده با شمارهٔ بازیابی تأییدشدهٔ حساب فرق دارد',
 recovery_backup_unavailable:'کد پشتیبان بازیابی مدیر اصلی هنوز آماده نیست',
 schema_unavailable:'به‌روزرسانی پایگاه دادهٔ بازیابی کامل نشده است',
 challenge_unavailable:'درخواست تأیید آماده نشد',
 network_timeout:'مهلت پاسخ پنل تمام شد',
 network_dns:'نشانی پنل پیدا نشد',
 network_tls:'اتصال امن به پنل برقرار نشد',
 network_error:'پاسخی از پنل دریافت نشد',
 provider_rejected:'پنل ارسال را تأیید نکرد',
 provider_response_unknown:'نتیجهٔ ارسال از پاسخ پنل مشخص نشد',
 provider_accepted:'پنل ارسال را پذیرفت',
 challenge_changed:'درخواست تأیید در حین ارسال تغییر کرد',
 internal_error:'خطای داخلی هنگام پردازش درخواست',
} as const;
const panelErrors:Partial<Record<number,string>>={
 10:'کلید پنل نامعتبر است',
 11:'کلید پنل غیرفعال است',
 12:'نشانی IP سرور در پنل مجاز نیست',
 13:'حساب پنل غیرفعال است',
 14:'حساب پنل تعلیق شده است',
 20:'پنل تعداد درخواست‌ها را محدود کرد',
 101:'خط فرستنده را بررسی کنید',
 102:'اعتبار پنل کافی نیست',
 104:'پنل شمارهٔ مقصد را نامعتبر دانست',
 111:'پنل این شناسهٔ پیامک را پیدا نکرد',
};
const deliveryStates:Partial<Record<number,string>>={
 1:'به گوشی تحویل شد',
 2:'به گوشی تحویل نشد',
 3:'اپراتور در حال پردازش است',
 4:'پیام به اپراتور نرسید',
 5:'اپراتور پیام را دریافت کرد',
 6:'تحویل با خطا روبه‌رو شد',
 7:'شماره در فهرست مسدودی پیامک است',
};
type Purpose=keyof typeof purposes;
type Filters={last4:string;purpose:Purpose|''};
type Entry={
 id:string;
 at:string;
 purpose:string;
 outcome:string;
 last4?:string|null;
 httpStatus?:number|null;
 panelCode?:number|null;
 messageId?:number|null;
};
type Page={entries:Entry[];nextCursor:string|null};

const noFilters:Filters={last4:'',purpose:''};
const unavailable='خواندن گزارش پیامک ممکن نشد. دوباره تلاش کنید.';

async function loadPage(filters:Filters,before?:string,signal?:AbortSignal):Promise<Page>{
 const params=new URLSearchParams();
 if(filters.last4)params.set('last4',filters.last4);
 if(filters.purpose)params.set('purpose',filters.purpose);
 if(before)params.set('before',before);
 const response=await fetch('/api/admin/sms-report?'+params,{cache:'no-store',signal});
 if(response.status===401||response.status===403)throw new Error('برای دیدن گزارش پیامک با حساب مدیر وارد شوید.');
 if(!response.ok)throw new Error(unavailable);
 const data=await response.json() as Page;
 if(!data||!Array.isArray(data.entries)||(data.nextCursor!==null&&typeof data.nextCursor!=='string'))throw new Error(unavailable);
 return data;
}

function DeliveryLookup({entryId}:{entryId:string}){
 const [busy,setBusy]=useState(false);
 const [state,setState]=useState<number|null|undefined>(undefined);
 const [error,setError]=useState('');

 async function check(){
  if(busy)return;
  setBusy(true);
  setError('');
  setState(undefined);
  try{
   const params=new URLSearchParams({entry:entryId});
   const response=await fetch('/api/admin/sms-report?'+params,{cache:'no-store'});
   if(response.status===429)throw new Error('تعداد بررسی‌ها زیاد است. کمی بعد دوباره تلاش کنید.');
   const data=await response.json() as {deliveryState:number|null;error?:string};
   if(!response.ok)throw new Error(data.error||'دریافت وضعیت تحویل از پنل ممکن نشد.');
   if(!data||(data.deliveryState!==null&&!Number.isInteger(data.deliveryState)))throw new Error('پاسخ وضعیت تحویل قابل خواندن نبود.');
   setState(data.deliveryState);
  }catch(e){
   setError(e instanceof Error&&!(e instanceof SyntaxError)?e.message:'ارتباط با پنل برقرار نشد.');
  }finally{
   setBusy(false);
  }
 }

 return <div className="sms-report-delivery">
  <button className="btn" type="button" disabled={busy} onClick={()=>void check()}>{busy?'در حال بررسی…':'بررسی تحویل'}</button>
  {error&&<span className="public-warranty-error" role="alert">{error}</span>}
  {state!==undefined&&<span role="status">{state===null?'وضعیت تحویل هنوز اعلام نشده است.':deliveryStates[state]||<>کد وضعیت تحویل در پنل <bdi>{state}</bdi></>}</span>}
 </div>;
}

export function SmsReport(){
 const [draft,setDraft]=useState(noFilters);
 const [filters,setFilters]=useState(noFilters);
 const [entries,setEntries]=useState<Entry[]>([]);
 const [nextCursor,setNextCursor]=useState<string|null>(null);
 const [busy,setBusy]=useState(true);
 const [ready,setReady]=useState(false);
 const [error,setError]=useState('');

 useEffect(()=>{
  const controller=new AbortController();
  async function initialize(){
   try{
    const page=await loadPage(noFilters,undefined,controller.signal);
    if(controller.signal.aborted)return;
    setEntries(page.entries);
    setNextCursor(page.nextCursor);
    setReady(true);
   }catch(e){
    if(!controller.signal.aborted)setError(e instanceof SyntaxError?unavailable:e instanceof Error?e.message:unavailable);
   }finally{
    if(!controller.signal.aborted)setBusy(false);
   }
  }
  void initialize();
  return ()=>controller.abort();
 },[]);

 async function reload(criteria:Filters,before?:string){
  if(busy)return;
  setBusy(true);
  setError('');
  try{
   const page=await loadPage(criteria,before);
   setEntries(previous=>before?[...previous,...page.entries]:page.entries);
   setNextCursor(page.nextCursor);
   setFilters(criteria);
   setReady(true);
  }catch(e){
   setError(e instanceof SyntaxError?unavailable:e instanceof Error?e.message:unavailable);
  }finally{
   setBusy(false);
  }
 }

 function filter(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  void reload(draft);
 }

 return <section className="sms-report" aria-labelledby="sms-report-title" aria-busy={busy}>
  <h2 id="sms-report-title">گزارش ارسال پیامک</h2>
  <p className="sms-report-help">وضعیت «پنل ارسال را پذیرفت» یعنی پیامک شناسه گرفته است. با «بررسی تحویل» آخرین وضعیت را از پنل بگیرید. در گزارش فقط چهار رقم آخر شماره نمایش داده می‌شود.</p>
  <form className="sms-report-filters" onSubmit={filter}>
   <label>چهار رقم آخر شماره
    <input dir="ltr" inputMode="numeric" autoComplete="off" maxLength={4} pattern="[0-9]{4}" title="چهار رقم آخر شماره را وارد کنید" value={draft.last4}
      onChange={event=>setDraft({...draft,last4:latinDigits(event.target.value).replace(/\D/g,'')})}/>
   </label>
   <label>نوع درخواست
    <select value={draft.purpose} onChange={event=>setDraft({...draft,purpose:event.target.value as Filters['purpose']})}>
     <option value="">همهٔ درخواست‌ها</option>
     {Object.entries(purposes).map(([value,label])=><option key={value} value={value}>{label}</option>)}
    </select>
   </label>
   <div className="public-warranty-actions">
    <button type="submit" disabled={busy}>اعمال فیلتر</button>
    <button type="button" disabled={busy} onClick={()=>void reload(filters)}>تازه‌سازی</button>
   </div>
  </form>
  {error&&<p className="public-warranty-error" role="alert">{error}</p>}
  {busy&&<p role="status">در حال دریافت گزارش…</p>}
  {ready&&!busy&&!error&&entries.length===0&&<p role="status">
   {filters.last4||filters.purpose?'رویدادی با این فیلتر پیدا نشد.':'هنوز رویدادی ثبت نشده است. نتیجهٔ درخواست‌های جدید اینجا نمایش داده می‌شود.'}
  </p>}
  {entries.length>0&&<ul className="sms-report-entries" aria-label="رویدادهای ارسال پیامک">
   {entries.map(entry=><li key={entry.id}>
    <div className="sms-report-entry-heading">
     <strong>{purposes[entry.purpose as Purpose]||'درخواست پیامک'}</strong>
     <time dateTime={entry.at}>{formatDateTime(entry.at)}</time>
    </div>
    <div className="sms-report-entry-status">
     <span>{outcomes[entry.outcome as keyof typeof outcomes]||'وضعیت ثبت‌شده نامشخص است'}</span>
     {entry.last4&&<span>{entry.purpose==='recovery_reset'?'شمارهٔ واردشده با پایان':'شمارهٔ منتهی به'} <bdi>{entry.last4}</bdi></span>}
    </div>
    {(entry.httpStatus!=null||entry.panelCode!=null||entry.messageId!=null)&&<div className="sms-report-numbers">
     {entry.httpStatus!=null&&<span>وضعیت HTTP <bdi>{entry.httpStatus}</bdi></span>}
     {entry.panelCode!=null&&<span>کد پنل <bdi>{entry.panelCode}</bdi></span>}
     {entry.messageId!=null&&<span>شناسهٔ پیامک <bdi>{entry.messageId}</bdi></span>}
    </div>}
    {entry.panelCode!=null&&panelErrors[entry.panelCode]&&<p className="sms-report-panel-detail">{panelErrors[entry.panelCode]}</p>}
    {entry.messageId!=null&&<DeliveryLookup entryId={entry.id}/>}
   </li>)}
  </ul>}
  {nextCursor!==null&&<button className="btn" type="button" disabled={busy} onClick={()=>void reload(filters,nextCursor)}>نمایش رویدادهای قدیمی‌تر</button>}
 </section>;
}
