import {normalizeMaterialUnit} from './material-units';
export type ServicePartImportRow={code:string;name:string;unit:string;consumerPriceRial:string;sourceRow?:number};
export const servicePartImportLimit=250;
const clean=(value:unknown):string=>{
 if(value&&typeof value==='object'&&Object.hasOwn(value,'excelNumber')){
  const raw=(value as {excelNumber:unknown}).excelNumber;
  if(typeof raw!=='string'||!/^\d+(?:\.0+)?$/.test(raw))throw Error('عدد اکسل باید صحیح و دقیق باشد.');
  value=raw.replace(/\.0+$/,'');
 }
 if(typeof value==='number'&&!Number.isSafeInteger(value))throw Error('عدد اکسل دقیق نیست؛ کد و قیمت را به‌صورت متن وارد کنید.');
 return String(value??'').replace(/[\u200e\u200f\u202a-\u202e\ufeff]/g,'').replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/ي/g,'ی').replace(/ك/g,'ک').trim();
};
const key=(value:unknown)=>clean(value).replace(/[\s\u200c]/g,'').toLowerCase();
export function normalizeServicePartRows(input:unknown):{rows:ServicePartImportRow[];errors:string[]} {
 const rows:ServicePartImportRow[]=[],errors:string[]=[],seen=new Set<string>();
 if(!Array.isArray(input)||!input.length||input.length>servicePartImportLimit)return {rows,errors:['فایل باید بین ۱ تا '+servicePartImportLimit+' قطعه داشته باشد.']};
 for(const [index,value] of input.entries()){
  const raw=value as any,at='ردیف '+(Number.isInteger(raw?.sourceRow)?raw.sourceRow:index+1)+': ';
  try{
   if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('ساختار قطعه معتبر نیست.');
   const code=clean(raw.code),name=clean(raw.name),unit=normalizeMaterialUnit(clean(raw.unit)),price=clean(raw.consumerPriceRial).replace(/[,٬\s]/g,'');
   if(!/^\d{2,12}$/.test(code))throw Error('کد قطعه باید ۲ تا ۱۲ رقم باشد.');
   if(seen.has(code))throw Error('کد قطعه تکراری است: '+code);seen.add(code);
   if(!name||name.length>200)throw Error('نام قطعه خالی یا بیش از حد طولانی است.');
   if(!unit)throw Error('واحد قطعه معتبر نیست: '+clean(raw.unit));
   if(!/^\d{1,18}$/.test(price)||BigInt(price)<=BigInt(0))throw Error('قیمت مصرف‌کننده باید عدد صحیح مثبت ریال با حداکثر ۱۸ رقم باشد.');
   if(raw.sourceRow!==undefined&&(!Number.isInteger(raw.sourceRow)||raw.sourceRow<1||raw.sourceRow>100000))throw Error('شماره ردیف فایل معتبر نیست.');
   rows.push({code,name,unit,consumerPriceRial:BigInt(price).toString(),...(raw.sourceRow!==undefined?{sourceRow:raw.sourceRow}:{})});
  }catch(e){errors.push(at+(e instanceof Error?e.message:'اطلاعات قطعه معتبر نیست.'));}
 }
 return {rows,errors};
}
// The accounting export and explicit column aliases identify price currency and audience.
// An invalid/mixed row rejects the whole file; this parser never silently drops it.
export function parseServicePartGrid(grid:unknown[][],domain:string):ServicePartImportRow[] {
 if(!['home','hospital'].includes(domain))throw Error('حوزهٔ خدمات معتبر نیست.');
 if(!Array.isArray(grid)||grid.length>5000||grid.some(row=>!Array.isArray(row)||row.length>100))throw Error('ابعاد فایل معتبر نیست.');
 const aliases={code:['کد کالا/خدمت','کد کالا','کد قطعه','code','partCode'],name:['عنوان کالا/خدمت','عنوان کالا','نام کالا','نام قطعه','name'],unit:['عنوان واحد','واحد','واحد اصلی','unit'],price:['فی','قیمت مصرف‌کننده','قیمت مصرف کننده','قیمت مصرف کننده (ریال)','قیمت واحد مصرف‌کننده','consumerPriceRial'],currency:['ارز','واحد پول','currency'],saleCode:['کد نوع فروش','salesType','saleType'],saleTitle:['عنوان نوع فروش','salesTypeTitle','saleTypeTitle']};
 const find=(row:unknown[],names:string[])=>row.findIndex(cell=>names.some(name=>key(cell)===key(name)));
 const header=grid.findIndex(row=>find(row,aliases.code)>=0&&find(row,aliases.name)>=0&&find(row,aliases.price)>=0);
 if(header<0)throw Error('ستون کد قطعه، نام و قیمت مصرف‌کننده پیدا نشد.');
 const columns=Object.fromEntries(Object.entries(aliases).map(([name,names])=>[name,find(grid[header],names)]));
 if(columns.unit<0||columns.currency<0)throw Error('ستون واحد قطعه و ارز لازم است؛ قیمت باید صریحاً به ریال باشد.');
 const input:any[]=[],errors:string[]=[];
 for(let i=header+1;i<grid.length;i++){
  const row=grid[i];try{
   if(row.every(cell=>!clean(cell)))continue;
   const currency=key(row[columns.currency]);if(!['ریال','ریالایران','irr','rial','rials'].includes(currency))throw Error('ارز قیمت باید ریال باشد؛ تبدیل خودکار ارز انجام نمی‌شود.');
   if(columns.saleCode>=0&&clean(row[columns.saleCode])!=='3')throw Error('این ردیف مربوط به قیمت مصرف‌کنندهٔ خدمات خانگی نیست.');
   if(columns.saleCode>=0&&domain!=='home')throw Error('فایل نوع فروش ۳ مربوط به خدمات خانگی است.');
   if(columns.saleTitle>=0){const title=key(row[columns.saleTitle]);if(!['خدماتپسازفروشخانگی(مصرفکننده)','مصرفکننده','مصرفکنندهنهایی','consumer','endcustomer'].includes(title))throw Error('نوع فروش باید قیمت مصرف‌کننده باشد.');if(title==='خدماتپسازفروشخانگی(مصرفکننده)'&&domain!=='home')throw Error('این ردیف مربوط به خدمات خانگی است.');}
   input.push({code:row[columns.code],name:row[columns.name],unit:row[columns.unit],consumerPriceRial:row[columns.price],sourceRow:i+1});
  }catch(e){errors.push('ردیف '+(i+1)+': '+(e instanceof Error?e.message:'ساختار معتبر نیست.'));}
 }
 const normalized=normalizeServicePartRows(input);errors.push(...normalized.errors);
 if(errors.length)throw Error(errors.slice(0,20).join('\n')+(errors.length>20?'\nو '+(errors.length-20)+' خطای دیگر':''));
 return normalized.rows;
}
