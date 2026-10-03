/** Calendar boundary: stored days stay ISO; people see the Persian calendar in Tehran. */
export const calendarLocale='fa-IR-u-ca-persian-nu-arabext';
export const calendarTimeZone='Asia/Tehran';
export const solarMonths=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const partsFormatter=new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:calendarTimeZone});
const dayFormatter=new Intl.DateTimeFormat(calendarLocale,{year:'numeric',month:'2-digit',day:'2-digit',timeZone:calendarTimeZone});
const timestampFormatter=new Intl.DateTimeFormat(calendarLocale,{dateStyle:'medium',timeStyle:'short',timeZone:calendarTimeZone});
export const latinDigits=(s:string)=>s.replace(/[۰-۹٠-٩]/g,c=>String(c.charCodeAt(0)-(c>='۰'?0x6f0:0x660)));
export const persianDigits=(s:string)=>s.replace(/\d/g,c=>'۰۱۲۳۴۵۶۷۸۹'[Number(c)]);
export function isIsoDay(s:unknown):s is string {
 if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number(s.slice(0,4))<1700||Number(s.slice(0,4))>2399)return false;
 const date=new Date(s+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===s;
}
export function localDay(value:string|Date=new Date()){
 if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value))return isIsoDay(value)?value:'';
 const date=value instanceof Date?value:new Date(value);if(!Number.isFinite(date.getTime()))return '';
 const p=new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:calendarTimeZone}).formatToParts(date);
 const get=(key:string)=>p.find(x=>x.type===key)!.value;return `${get('year')}-${get('month')}-${get('day')}`;
}
export function solarParts(iso:string){
 if(!isIsoDay(iso))return {year:NaN,month:NaN,day:NaN};
 const p=partsFormatter.formatToParts(new Date(iso+'T12:00:00Z'));
 const get=(key:string)=>Number(p.find(x=>x.type===key)?.value);return {year:get('year'),month:get('month'),day:get('day')};
}
const years=new Map<number,Map<string,string>>();
function solarYear(year:number){
 if(!Number.isInteger(year)||year<1200||year>1699)return new Map<string,string>();
 const cached=years.get(year);if(cached)return cached;
 const dates=new Map<string,string>(),start=new Date(Date.UTC(year+621,2,18,12));
 for(let i=0;i<370;i++){const iso=start.toISOString().slice(0,10),p=solarParts(iso);if(p.year===year)dates.set(`${p.month}/${p.day}`,iso);start.setUTCDate(start.getUTCDate()+1);}
 if(years.size>=32)years.delete(years.keys().next().value!);years.set(year,dates);return dates;
}
export function solarToIso(year:number,month:number,day:number){return solarYear(year).get(`${month}/${day}`)||'';}
export function solarMonthDays(year:number,month:number){for(let day=31;day>=29;day--)if(solarToIso(year,month,day))return day;return 0;}
/** Accept unambiguous year-first Persian text or legacy Gregorian/Excel days. Invalid inputs stay invalid. */
export function parseCalendarDay(value:unknown):string {
 if(value instanceof Date)return Number.isFinite(value.getTime())?value.toISOString().slice(0,10):'';
 if(typeof value!=='string')return '';
 const s=latinDigits(value).trim().replace(/[\u200e\u200f\u202a-\u202e]/g,'');
 const m=/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(s);if(!m)return '';
 const [year,month,day]=m.slice(1).map(Number);
 if(year>=1200&&year<=1699)return solarToIso(year,month,day);
 const iso=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;return isIsoDay(iso)?iso:'';
}
function asDate(value:string|Date|null|undefined){
 if(!value)return null;if(value instanceof Date)return Number.isFinite(value.getTime())?value:null;
 if(/^\d{4}-\d{2}-\d{2}$/.test(value))return isIsoDay(value)?new Date(value+'T12:00:00Z'):null;
 const date=new Date(value);return Number.isFinite(date.getTime())?date:null;
}
export function formatDate(value?:string|Date|null){const date=asDate(value);return date?dayFormatter.format(date):value?'تاریخ نامعتبر':'—';}
export function formatDateTime(value?:string|Date|null){const date=asDate(value);return date?timestampFormatter.format(date):value?'تاریخ نامعتبر':'—';}
export function formatMonth(iso:string){const p=solarParts(iso);return Number.isFinite(p.year)?solarMonths[p.month-1]+' '+persianDigits(String(p.year)):'—';}
export function solarDateText(iso:string){const p=solarParts(iso);return Number.isFinite(p.year)?`${p.year}/${String(p.month).padStart(2,'0')}/${String(p.day).padStart(2,'0')}`:'';}
const dateFields=new Set(['date','day','due','until','newDue','oldDue','dueDay','period','startDate','endDate','contactDay','intakeDay','deliveredDay','activationDay','activationDate','dealerDate','nextDue','needBy','availableOn','fxDate','eta','validUntil','validFrom','expiry','partWarrantyEnd','warrantyEnd','warrantyStart','created','updated','expires','at','from','to']);
export function displayDateField(field:string,value:unknown){
 if(typeof value!=='string'||!value)return value;
 if(!dateFields.has(field)&&!/(?:At|_at|Day|Date)$/.test(field))return value;
 if(isIsoDay(value))return formatDate(value);
 if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value))return formatDateTime(value);
 return value;
}
/** A separate readable projection. Never feed this back as an optimistic-lock snapshot. */
export function calendarDisplay(value:unknown,field=''):unknown {
 if(Array.isArray(value))return value.map(v=>calendarDisplay(v,field));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,calendarDisplay(v,k)]));
 return displayDateField(field,value);
}
