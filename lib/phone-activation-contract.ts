import type {LegacyActivation} from './legacy-activation-import';
import {calendarLocale,formatDateTime,isIsoDay,localDay} from './persian-date';
import {addSolarMonths} from './sales-payment-terms';

const legacyTime=new Intl.DateTimeFormat(calendarLocale,{dateStyle:'medium',timeStyle:'medium',timeZone:'UTC'});
export function formatActivationTime(at:string,legacy:boolean){
 if(!legacy)return formatDateTime(at);
 const date=new Date(at);
 return at&&!at.startsWith('1900-')&&Number.isFinite(+date)?legacyTime.format(date):'—';
}
export function importedActivationWarranty(legacy:Pick<LegacyActivation,'activeDate'|'status'>,today=localDay()){
 // Excel stores the Tehran wall clock in an ISO string. Read its calendar day directly.
 const day=legacy.activeDate.slice(0,10);
 return legacy.status==='0'&&!day.startsWith('1900-')?activationWarranty(day,24,today):null;
}
export const legacyCorrectionMonths=24;
export function activationWarranty(day:string,months:number,today=localDay()){
 if(!isIsoDay(day)||!isIsoDay(today)||day>today||months<=0)return null;
 const endsOn=addSolarMonths(day,months);
 if(!endsOn)return null;
 const remainingDays=Math.max(0,(Date.parse(endsOn)-Date.parse(today))/86_400_000);
 return {endsOn,remainingDays};
}
export const phoneActivationPurposes=['activate','board','legacy-correction'] as const;
export type PhoneActivationPurpose = typeof phoneActivationPurposes[number];
export function isPhoneActivationPurpose(value:unknown):value is PhoneActivationPurpose{
 return phoneActivationPurposes.some(purpose=>purpose===value);
}
export type PhoneActivationCustomer = {
 name:string;
 mobile:string;
 nationalId:string;
 postalCode:string;
 referrer:string;
 address?:string;
 telephone?:string;
 email?:string;
};
export type PhoneActivationProduct = {id:string;name:string;model:string;code:string;months:number};
export type PhoneCodeHistory = {purpose:PhoneActivationPurpose;at:string;actorName:string;reference:string};
export type PhoneActivationDevice = {
 serial:string;
 state:'new'|'activated'|'review';
 basis:string;
 model:string;
 productName:string;
 months:number|null;
 devicesKnown:boolean;
 canCorrectLegacy?:boolean;
 warrantyCorrection?:{at:string;actorName:string};
 activatedDay:string;
 dealer:string;
 customer:Partial<PhoneActivationCustomer>;
 history:PhoneCodeHistory[];
 legacy?:LegacyActivation;
};
export type PhoneActivationHistoryRow={
 id:string;
 kind:'legacy'|'first'|'board'|'code'|'legacy-correction';
 serial:string;
 at:string;
 activatedAt?:string;
 warrantyStartDay?:string;
 dealer:string;
 model:string;
 months?:number;
 customer:Partial<PhoneActivationCustomer>;
 actor?:string;
 legacy?:LegacyActivation;
};
export type PhoneActivationResult = {
 activationCode:string;
 activatedDay:string;
 first:boolean;
 corrected?:boolean;
 actorName:string;
 at:string;
};
export const phoneCustomerFields = [
 ['name','نام و نام خانوادگی مشتری'],
 ['mobile','شماره همراه مشتری'],
 ['nationalId','کد ملی مشتری'],
 ['postalCode','کد پستی'],
 ['referrer','نام پزشک یا مرکز معرفی‌کننده'],
] as const;
