import {validateBom,type BomLine} from './production';
export const importUnits=['عدد','کیلوگرم','گرم','متر','سانتی‌متر','سانتی‌متر مربع','لیتر'];
export const clean=(v:unknown)=>String(v??'').replace(/[\u200e\u200f\u202a-\u202e\ufeff]/g,'').replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/ي/g,'ی').replace(/ك/g,'ک').trim();
export function importNumber(v:unknown){const s=clean(v).replace(/[,٬]/g,'').replace(/[\/٫]/g,'.');if(!/^\d+(\.\d+)?$/.test(s))throw Error('مقدار عددی قابل تشخیص نیست: '+clean(v).slice(0,30));return String(Number(s));}
export type ImportLine=BomLine&{sourceQuantity:string;sourceSecondary:string;note:string};
export type ImportDraft={productCode:string;productName:string;formulaCode:string;baseQuantity:string;lines:ImportLine[]};
export type ImportMapping={partCode:number;name:number;quantity:number;unit:number};
export function guessImportMapping(row:unknown[]):ImportMapping{
 const values=row.map(clean);
 const find=(names:string[])=>values.findIndex(v=>names.includes(v));
 return {partCode:find(['کد کالا','کد قطعه','کد','کد مواد']),name:find(['عنوان کالا','نام کالا','نام قطعه','نام','شرح کالا']),quantity:find(['مقدار واحد اصلی','مقدار','تعداد','مصرف یک دستگاه','مصرف']),unit:find(['واحد','واحد اصلی','واحد سنجش'])};
}
export function parseMappedBomGrid(grid:unknown[][],header:number,mapping:ImportMapping):ImportDraft{
 if(grid.length>5000||grid.some(r=>r.length>200))throw Error('ابعاد فایل بیش از حد مجاز است.');
 if(!Number.isInteger(header)||header<0||header>=grid.length)throw Error('ردیف عنوان ستون‌ها را انتخاب کنید.');
 const required=[mapping.partCode,mapping.name,mapping.quantity];
 if(required.some(i=>!Number.isInteger(i)||i<0||i>=grid[header].length)||!Number.isInteger(mapping.unit)||mapping.unit < -1||mapping.unit>=grid[header].length)throw Error('ستون کد، نام و مصرف را انتخاب کنید.');
 const selected=Object.values(mapping).filter(i=>i>=0);
 if(new Set(selected).size!==selected.length)throw Error('برای هر فیلد یک ستون جدا انتخاب کنید.');
 const lines:ImportLine[]=[],seen=new Set<string>(),errors:string[]=[];
 grid.slice(header+1).forEach((row,index)=>{
  if(row.every(v=>!clean(v)))return;
  const partCode=clean(row[mapping.partCode]),name=clean(row[mapping.name]),sourceQuantity=clean(row[mapping.quantity]);
  const at='ردیف '+(header+index+2)+': ';
  if(!/^\d{2,12}$/.test(partCode)){errors.push(at+'کد کالا باید ۲ تا ۱۲ رقم باشد.');return;}
  if(seen.has(partCode)){errors.push(at+'کد تکراری '+partCode);return;}seen.add(partCode);
  if(!name||name.length>200){errors.push(at+'نام کالا خالی یا طولانی است.');return;}
  try{const quantity=importNumber(sourceQuantity);if(Number(quantity)<=0)throw Error('مصرف باید بیشتر از صفر باشد.');
   const rawUnit=mapping.unit>=0?clean(row[mapping.unit]):'';
   const unit=importUnits.find(u=>clean(u).replace(/\s|‌/g,'')===rawUnit.replace(/\s|‌/g,''))||'';
   lines.push({partCode,name,quantity,unit,sourceQuantity,sourceSecondary:'',note:rawUnit&&!unit?'واحد فایل «'+rawUnit+'»؛ واحد را انتخاب کنید.':''});
  }catch(e){errors.push(at+(e instanceof Error?e.message:'مقدار نامعتبر است.'));}
 });
 if(errors.length)throw Error(errors.slice(0,20).join('\n')+(errors.length>20?'\nو '+(errors.length-20)+' خطای دیگر':''));
 if(!lines.length||lines.length>200)throw Error('فایل باید بین ۱ تا ۲۰۰ قلم داشته باشد.');
 return {productCode:'',productName:'',formulaCode:'',baseQuantity:'',lines};
}
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
