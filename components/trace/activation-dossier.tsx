'use client';

import {formatActivationTime,phoneCustomerFields,type PhoneActivationHistoryRow} from '@/lib/phone-activation-contract';

type Dossier=Pick<PhoneActivationHistoryRow,'serial'|'at'|'activatedAt'|'legacy'|'customer'|'dealer'|'model'|'months'|'actor'>;

function Fields({fields}:{fields:[string,string|undefined][]}){
 return <dl className="formgrid">{fields.map(([label,value])=><div className="recordline" key={label}>
  <dt>{label}</dt><dd><bdi>{value||'ثبت نشده'}</bdi></dd>
 </div>)}</dl>;
}

export function ActivationDossier({record,showCustomer=true}:{record:Dossier;showCustomer?:boolean}){
 const {legacy,customer}=record,details=legacy?.details;
 const activationAt=record.activatedAt||legacy?.activeDate||record.at;
 return <>
  <h3>دستگاه و فعال‌سازی</h3>
  <Fields fields={[
   ['سریال ثبت‌شدهٔ دستگاه',legacy?.deviceSetSerial||record.serial],
   ['زمان ثبت فعال‌سازی',activationAt?formatActivationTime(activationAt,!!legacy&&!record.activatedAt):undefined],
   ['محصول و مدل',record.model],
   ['مدت گارانتی',record.months===undefined?undefined:record.months.toLocaleString('fa-IR')+' ماه'],
   ...(record.actor?[['ثبت‌کننده',record.actor] as [string,string]]:[]),
  ]}/>
  {showCustomer&&<><h3>اطلاعات مشتری</h3>
   <Fields fields={[
    ...phoneCustomerFields.map(([key,label]):[string,string|undefined]=>[label,customer[key]]),
    ['شمارهٔ تلفن',customer.telephone],['ایمیل',customer.email],
   ]}/>
  </>}
  <h3>نمایندگی در سابقه</h3>
  <Fields fields={[
   ['نمایندگی',record.dealer],...(legacy?.agencyName&&legacy.agencyName!==record.dealer?[['نام در سیستم قبلی',legacy.agencyName] as [string,string]]:[]),
   ['کد نمایندگی در سیستم قبلی',legacy?.agencyCode],['شهر نمایندگی',details?.agencyCity],
   ['وضعیت نمایندگی در زمان خروجی',details?.agencyActive==='1'?'فعال':details?.agencyActive==='0'?'غیرفعال':undefined],
  ]}/>
  {legacy&&<details>
   <summary>جزئیات ثبت قبلی</summary>
   <Fields fields={[
    ['کد ده‌رقمی نمایشگر در سابقه',legacy.serial],['کد پنج‌رقمی صادرشده در سابقه',details?.issuedCode],
    ['سریال در سیستم قبلی',legacy.setSerial],['شناسهٔ فعال‌سازی',legacy.activeId],['شناسهٔ دستگاه',legacy.setId],
    ...(showCustomer?[['شناسهٔ پروفایل مشتری',details?.profileId] as [string,string|undefined]]:[]),
    ['شناسهٔ نمایندگی',legacy.agencyId],
   ]}/>
  </details>}
 </>;
}
