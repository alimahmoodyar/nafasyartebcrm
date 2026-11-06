import {receiptDay} from './batch-number';
/** Printed QR is a public, immutable label snapshot, never authorization. */
export function batchQrText(batch:{id:string;data:Record<string,string>},origin:string){
 const b=batch.data,url=new URL('/b/'+encodeURIComponent(String(b.code)),origin);
 const clean=(v:unknown)=>String(v??'').replace(/[\r\n\x00-\x1f\x7f]/g,' ').trim();
 const date=(value:string)=>{try{return receiptDay(value).display}catch{return clean(value)}};
 return ['NAFASYAR-BATCH/1','نام کالا: '+clean(b.part||b.name),'کد کالا: '+clean(b.partCode),'بچ: '+clean(b.code),'تاریخ ورود: '+date(b.date),'مقدار اولیه دریافت (نه موجودی فعلی): '+clean(b.quantity)+' '+clean(b.unit),...(b.expiry?['انقضا: '+date(b.expiry)]:[]),'جزئیات با ورود و دسترسی مجاز:',url.href].join('\n');
}
export function batchScanCode(value:unknown){
 const raw=typeof value==='string'?value.replace(/\r\n?/g,'\n').trim():'';
 if(!raw.startsWith('NAFASYAR-BATCH/1\n'))return raw;
 if(raw.length>3000)return '';
 const matches=raw.split('\n').filter(s=>s.startsWith('بچ: '));
 return matches.length===1?matches[0].slice(4).trim():'';
}
