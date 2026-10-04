import {validateBom,type BomLine} from './production';
export const importUnits=['عدد','کیلوگرم','گرم','متر','سانتی‌متر','سانتی‌متر مربع','لیتر'];
export const clean=(v:unknown)=>String(v??'').replace(/[\u200e\u200f\u202a-\u202e\ufeff]/g,'').replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/ي/g,'ی').replace(/ك/g,'ک').trim();
export function importNumber(v:unknown){const s=clean(v).replace(/[,٬]/g,'').replace(/[\/٫]/g,'.');if(!/^\d+(\.\d+)?$/.test(s))throw Error('مقدار عددی قابل تشخیص نیست: '+clean(v).slice(0,30));return String(Number(s));}
export type ImportLine=BomLine&{sourceQuantity:string;sourceSecondary:string;note:string};
export type ImportDraft={productCode:string;productName:string;formulaCode:string;baseQuantity:string;lines:ImportLine[]};
export function parseBomGrid(grid:unknown[][]):ImportDraft{
 if(grid.length>5000||grid.some(r=>r.length>200))throw Error('ابعاد فایل بیش از حد مجاز است.');
 const rows=grid.map(r=>r.map(clean));const header=rows.findIndex(r=>r.includes('کد کالا')&&r.includes('عنوان کالا')&&r.includes('مقدار واحد اصلی'));
 if(header<0)throw Error('ستون‌های کد کالا، عنوان کالا و مقدار واحد اصلی در گزارش پیدا نشد.');
 const h=rows[header],ci=h.indexOf('کد کالا'),ni=h.indexOf('عنوان کالا'),qi=h.indexOf('مقدار واحد اصلی'),si=h.indexOf('مقدار واحد فرعی'),ui=h.indexOf('واحد'),ri=h.indexOf('ردیف');
 const meta=(label:string)=>{for(const row of rows.slice(0,header)){const i=row.findIndex(x=>x.replace(/[:：]/g,'').trim()===label);if(i>=0){for(let j=i-1;j>=0;j--)if(row[j])return row[j];}}return '';};
 const lines:ImportLine[]=[];
 for(const r of rows.slice(header+1)){
  if(r[ci]==='کد کالا')continue;
  if(!r[ci]&&!r[ni]&&!r[qi]&&!(ri>=0&&/^\d+$/.test(r[ri]||'')))continue;
  if(!/^\d{2,12}$/.test(r[ci]||''))throw Error('کد کالا در یکی از ردیف‌ها خالی یا نامعتبر است.');
  lines.push({partCode:r[ci],name:r[ni]||'',quantity:importNumber(r[qi]),unit:ui>=0?r[ui]:'',sourceQuantity:r[qi],sourceSecondary:si>=0?r[si]||'':'',note:''});
 }
 if(!lines.length||lines.length>200)throw Error('فایل باید بین ۱ تا ۲۰۰ قلم داشته باشد.');
 if(new Set(lines.map(l=>l.partCode)).size!==lines.length)throw Error('کد کالای تکراری در فایل وجود دارد؛ ابتدا بررسی کنید.');
 return {productCode:meta('کد محصول'),productName:meta('نام محصول'),formulaCode:meta('کد فرمول'),baseQuantity:meta('مقدار')||'',lines};
}
// Explicit, opt-in corrections approved by the owner for this exact accounting formula.
export function applyApprovedFiveLitre(d:ImportDraft):ImportDraft{
 if(d.productCode!=='30100012'||d.formulaCode!=='2040001358')throw Error('این اصلاحات فقط برای فرمول تأییدشده سوشیا ۵ لیتری است.');
 const area=['10100021','10100022','10100361'],hoses=['10100319','10100321','10100322','10100323'];
 return {...d,lines:d.lines.map(l=>({...l,unit:area.includes(l.partCode)?'سانتی‌متر مربع':hoses.includes(l.partCode)?'سانتی‌متر':l.partCode==='10100822'?'گرم':'عدد',quantity:l.partCode==='10100822'?'107':l.quantity,note:l.partCode==='10100822'?'اصلاح تأییدشده: ۱۰۷ گرم = ۰٫۱۰۷ کیلوگرم':l.partCode==='10100326'?'۲ عدد شلنگ نازال کامل ۲ متری':'واحد مطابق تأیید مدیر؛ مجموعه‌ها کامل محسوب می‌شوند'}))};
}
export function importLines(rows:unknown){return validateBom(rows).map(l=>({...l,quantity:importNumber(l.quantity)}));}
