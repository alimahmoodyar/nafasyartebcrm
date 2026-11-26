'use client';

import type {ReactNode} from 'react';
import {Archive,ChevronDown,ClipboardList,ShieldCheck,Store,UserRound} from 'lucide-react';
import {calendarLocale} from '@/lib/persian-date';
import {activationWarranty,formatActivationTime,importedActivationWarranty,phoneCustomerFields,type PhoneActivationHistoryRow} from '@/lib/phone-activation-contract';

type Dossier=Pick<PhoneActivationHistoryRow,'serial'|'at'|'activatedAt'|'warrantyStartDay'|'legacy'|'customer'|'dealer'|'model'|'months'|'actor'>;
type Field=[label:string,value:ReactNode];
const peopleDate=new Intl.DateTimeFormat(calendarLocale,{dateStyle:'long',timeZone:'UTC'});
const count=new Intl.NumberFormat('fa-IR');

function Fields({fields,className=''}:{fields:Field[];className?:string}){
 return <dl className={`activation-dossier-fields ${className}`.trim()}>{fields.map(([label,value])=><div key={label}>
  <dt>{label}</dt><dd><bdi>{value||'ثبت نشده'}</bdi></dd>
 </div>)}</dl>;
}

export function ActivationDossier({record,showCustomer=true,legacyDateConfirmed=true,today}:{
 record:Dossier;showCustomer?:boolean;legacyDateConfirmed?:boolean;today?:string;
}){
 const {legacy,customer}=record,details=legacy?.details;
 const activationAt=record.activatedAt||legacy?.activeDate||record.at;
 const serial=legacy?.deviceSetSerial||record.serial;
 const warranty=record.warrantyStartDay?activationWarranty(record.warrantyStartDay,record.months??0,today)
  :legacy&&legacyDateConfirmed?importedActivationWarranty(legacy,today):null;
 const duration=legacy||record.warrantyStartDay?'۲ سال از تاریخ فعال‌سازی':record.months!==undefined?count.format(record.months)+' ماه':'مدت گارانتی ثبت نشده';
 const agencyActive=details?.agencyActive;
 return <article className="activation-dossier" dir="rtl">
  <header className="activation-dossier-hero">
   <div className="activation-dossier-heading">
    <span className="activation-dossier-icon"><ClipboardList size={23} aria-hidden="true"/></span>
    <div><h3>شناسنامهٔ دستگاه</h3>{record.warrantyStartDay?<p>اصلاح سامانه قدیم</p>:legacy&&<p>سابقهٔ فعال‌سازی از سیستم قبلی</p>}</div>
   </div>
   <Fields className="activation-dossier-overview" fields={[
    ['سریال ثبت‌شدهٔ دستگاه',serial],
    [record.warrantyStartDay?'زمان ثبت اصلاح':'زمان ثبت فعال‌سازی',activationAt?formatActivationTime(activationAt,!!legacy&&!record.activatedAt&&!record.warrantyStartDay):undefined],
    ['محصول و مدل',record.model],
    ...(record.actor?[['ثبت‌کننده',record.actor] as Field]:[]),
   ]}/>
  </header>

  <section className="activation-dossier-warranty" data-expired={warranty?.remainingDays===0}>
   <header className="activation-dossier-heading">
    <span className="activation-dossier-icon"><ShieldCheck size={21} aria-hidden="true"/></span>
    <div><h4>گارانتی دستگاه</h4><p>{duration}</p></div>
   </header>
   {warranty?<dl className="activation-dossier-warranty-facts" data-has-start={!!record.warrantyStartDay}>
    {record.warrantyStartDay&&<div><dt>تاریخ شروع گارانتی</dt><dd><time dateTime={record.warrantyStartDay}>{peopleDate.format(new Date(record.warrantyStartDay))}</time></dd></div>}
    <div><dt>تاریخ پایان گارانتی</dt><dd><time dateTime={warranty.endsOn}>{peopleDate.format(new Date(warranty.endsOn))}</time></dd></div>
    <div><dt>روز باقی‌مانده</dt><dd className="activation-dossier-balance"><strong>{count.format(warranty.remainingDays)}</strong> روز
     {warranty.remainingDays===0&&<small>منقضی شده</small>}
    </dd></div>
   </dl>:legacy&&<p className="activation-dossier-warranty-note">تاریخ فعال‌سازی برای محاسبهٔ پایان گارانتی نیاز به بررسی دارد.</p>}
  </section>

  <div className={'activation-dossier-columns'+(showCustomer?' has-customer':'')}>
   {showCustomer&&<section className="activation-dossier-section">
    <header className="activation-dossier-heading">
     <span className="activation-dossier-icon"><UserRound size={18} aria-hidden="true"/></span><h4>اطلاعات مشتری</h4>
    </header>
    <Fields fields={[
     ...phoneCustomerFields.map(([key,label]):Field=>[label,customer[key]]),
     ['آدرس',customer.address],['شمارهٔ تلفن',customer.telephone],['ایمیل',customer.email],
    ]}/>
   </section>}
   <section className="activation-dossier-section">
    <header className="activation-dossier-heading">
     <span className="activation-dossier-icon"><Store size={18} aria-hidden="true"/></span><h4>نمایندگی در سابقه</h4>
    </header>
    <Fields fields={[
     ['نمایندگی',record.dealer],...(legacy?.agencyName&&legacy.agencyName!==record.dealer?[['نام در سیستم قبلی',legacy.agencyName] as Field]:[]),
     ['شهر نمایندگی',details?.agencyCity],
     ['وضعیت نمایندگی در زمان خروجی',agencyActive&&<span className={'badge'+(agencyActive==='1'?' good':'')}>{agencyActive==='1'?'فعال':'غیرفعال'}</span>],
    ]}/>
   </section>
  </div>

  {legacy&&<details className="activation-dossier-archive">
   <summary>
    <span className="activation-dossier-icon"><Archive size={18} aria-hidden="true"/></span>
    جزئیات ثبت قبلی
    <ChevronDown size={18} className="activation-dossier-chevron" aria-hidden="true"/>
   </summary>
   <Fields fields={[
    ['کد ده‌رقمی نمایشگر در سابقه',legacy.serial],['کد پنج‌رقمی صادرشده در سابقه',details?.issuedCode],
    ['سریال در سیستم قبلی',legacy.setSerial],['شناسهٔ فعال‌سازی',legacy.activeId],['شناسهٔ دستگاه',legacy.setId],
    ...(showCustomer?[['شناسهٔ پروفایل مشتری',details?.profileId] as Field]:[]),
    ['شناسهٔ نمایندگی',legacy.agencyId],
   ]}/>
  </details>}
 </article>;
}
