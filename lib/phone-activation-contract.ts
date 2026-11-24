import type {LegacyActivation} from './legacy-activation-import';
import {calendarLocale,formatDateTime} from './persian-date';

const legacyTime=new Intl.DateTimeFormat(calendarLocale,{dateStyle:'medium',timeStyle:'medium',timeZone:'UTC'});
export function formatActivationTime(at:string,legacy:boolean){
 if(!legacy)return formatDateTime(at);
 const date=new Date(at);
 return at&&!at.startsWith('1900-')&&Number.isFinite(+date)?legacyTime.format(date):'—';
}
export type PhoneActivationPurpose = 'activate'|'board';
export type PhoneActivationCustomer = {
 name:string;
 mobile:string;
 nationalId:string;
 postalCode:string;
 referrer:string;
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
 activatedDay:string;
 dealer:string;
 customer:Partial<PhoneActivationCustomer>;
 history:PhoneCodeHistory[];
 legacy?:LegacyActivation;
};
export type PhoneActivationHistoryRow={
 id:string;
 kind:'legacy'|'first'|'board'|'code';
 serial:string;
 at:string;
 activatedAt?:string;
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
