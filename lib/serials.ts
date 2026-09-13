import {receiptDay} from "./batch-number";
export type SerialRun={id:string;productId:string;day:string;created:string;data:{name:string;model:string;code:string;count:number;operator:string;jalaliDate:string}};
export type ReservedSerial={serial:string;deviceId:string|null};
export function tehranDay(now=new Date()){
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Tehran",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
 const get=(t:string)=>parts.find(p=>p.type===t)!.value;return `${get("year")}-${get("month")}-${get("day")}`;
}
export function serialPrefix(code:string,day:string){return `${code}-${receiptDay(day).compact}-`;}
export function nextSerials(prefix:string,existing:string[],count:number){
 let last=0;for(const serial of existing){if(!serial.startsWith(prefix))continue;const suffix=serial.slice(prefix.length);if(/^\d{4,}$/.test(suffix)){const n=Number(suffix);if(!Number.isSafeInteger(n)||n>99999999)throw new Error("شماره ترتیب خارج از محدوده است.");last=Math.max(last,n);}}
 if(last+count>99999999)throw new Error("ظرفیت شماره ترتیب این روز تکمیل شده است.");
 return Array.from({length:count},(_,i)=>prefix+String(last+i+1).padStart(4,"0"));
}
export function parseRun(r:any):SerialRun{return {id:r.id,productId:r.product_id,day:r.day,created:r.created,data:JSON.parse(r.payload)}};
