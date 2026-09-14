import {asciiDigits} from './batch-number';
import type {Field, Row} from './model';
export const distributionFields: Field[] = [
 {key:'serial',label:'سریال دستگاه',required:true},
 {key:'dealerCode',label:'کد نماینده'},
 {key:'dealerName',label:'نام نماینده فروش',required:true},
 {key:'dealerDate',label:'تاریخ فروش به نماینده',type:'date'},
 {key:'invoice',label:'شماره فاکتور'},
 {key:'customerName',label:'نام مشتری نهایی'},
 {key:'customerMobile',label:'موبایل مشتری'},
 {key:'customerNationalId',label:'کد ملی مشتری'},
 {key:'customerCity',label:'شهر مشتری'},
 {key:'customerAddress',label:'نشانی مشتری',type:'textarea'},
 {key:'notes',label:'توضیحات',type:'textarea'},
];
export const distributionKeys=distributionFields.map(f=>f.key);
export const idKeys=['serial','dealerCode','invoice','customerMobile','customerNationalId'];
export function normalizeSerial(value:string){return asciiDigits(value).trim().toUpperCase();}
export function normalizeDistribution(input:unknown):Record<string,string>{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('اطلاعات ردیف معتبر نیست.');
 const source=input as Record<string,unknown>, result:Record<string,string>={};
 for(const f of distributionFields){const raw=source[f.key];if(raw!==undefined&&typeof raw!=='string')throw new Error(f.label+' باید متن باشد؛ صفر ابتدای شناسه را حفظ کنید.');const v=(raw as string||'').trim();if(v.length>(f.type==='textarea'?2000:200))throw new Error(f.label+' بیش از حد طولانی است.');result[f.key]=idKeys.includes(f.key)?asciiDigits(v):v;}
 result.serial=normalizeSerial(result.serial);
 if(!result.serial||!result.dealerName)throw new Error('سریال دستگاه و نام نماینده الزامی‌اند.');
 if(result.customerNationalId&&!/^\d{10}$/.test(result.customerNationalId))throw new Error('کد ملی باید ۱۰ رقم باشد؛ صفرهای ابتدایی را از منبع اصلی وارد کنید.');
 if(result.customerMobile&&!/^(?:09\d{9}|\+989\d{9})$/.test(result.customerMobile))throw new Error('موبایل را به صورت 09xxxxxxxxx یا +989xxxxxxxxx وارد کنید.');
 for(const key of ['dealerDate'])if(result[key]){const d=new Date(result[key]+'T12:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(result[key])||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==result[key]||Number(result[key].slice(0,4))<1900||Number(result[key].slice(0,4))>2100)throw new Error('تاریخ باید میلادی و به صورت YYYY-MM-DD باشد.');}
 if(!result.customerName&&['customerMobile','customerNationalId','customerCity','customerAddress'].some(k=>result[k]))throw new Error('برای ثبت مشخصات مشتری، نام مشتری را هم وارد کنید.');
 return result;
}
export type DistributionPreview={row:number;data:Record<string,string>;status:'new'|'complete'|'same'|'conflict'|'invalid'|'unknown';message:string;device?:string;previous?:string;changes?:string[]};
export function previewDistribution(raw:unknown, row:number, devices:Row[], existing:Row[]):DistributionPreview{
 let data:Record<string,string>={};
 try{data=normalizeDistribution(raw);}catch(e){return{row,data:raw&&typeof raw==='object'?raw as Record<string,string>:{},status:'invalid',message:(e as Error).message};}
 const matches=devices.filter(d=>normalizeSerial(d.data.code)===data.serial);
 if(matches.length!==1)return{row,data,status:matches.length?'conflict':'unknown',message:matches.length?'چند دستگاه با این سریال وجود دارد؛ نیاز به بررسی مدیر.':'سریال در شناسنامه دستگاه‌ها ثبت نشده است.'};
 const device=matches[0].id, current=existing.find(r=>r.data.device===device);
 if(!current)return{row,data,device,status:'new',message:'ثبت ارتباط جدید',previous:''};
 const conflicts=distributionFields.filter(f=>f.key!=='serial'&&current.data[f.key]&&data[f.key]&&current.data[f.key]!==data[f.key]);
 if(conflicts.length)return{row,data,device,status:'conflict',message:'تفاوت با اطلاعات قبلی: '+conflicts.map(f=>f.label).join('، '),previous:JSON.stringify(current.data)};
 const changes=distributionFields.filter(f=>data[f.key]&&!current.data[f.key]).map(f=>f.label);
 return{row,data,device,status:changes.length?'complete':'same',message:changes.length?'تکمیل: '+changes.join('، '):'قبلاً ثبت شده؛ بدون تغییر',previous:JSON.stringify(current.data),changes};
}
