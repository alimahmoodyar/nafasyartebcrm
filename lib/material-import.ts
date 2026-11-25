import {clean,guessImportMapping} from './bom-import';
import {normalizeMaterialUnit} from './material-units';
export type MaterialImportRow={code:string;name:string;unit:string;existingCode?:string;createNew?:boolean};
export type MaterialImportMapping={code:number;name:number;unit:number;existingCode?:number};
export function guessMaterialImportMapping(row:unknown[],accounting=false):MaterialImportMapping{
 const m=guessImportMapping(row);
 if(!accounting)return {code:m.partCode,name:m.name,unit:m.unit};
 const headings=row.map(value=>clean(value).replace(/‌/g,' ').replace(/\s+/g,' '));
 const external=headings.findIndex(value=>['کد حسابداری','کد کالا در حسابداری','کد سیستم حسابداری','شناسه کالا در حسابداری'].includes(value));
 const existingCode=headings.findIndex(value=>['کد هم نفس','کد داخلی هم نفس','کد هم‌نفس','کد داخلی'].includes(value));
 return {code:external>=0?external:m.partCode,name:m.name,unit:m.unit,existingCode};
}
export function parseMaterialImportGrid(grid:unknown[][],header:number,mapping:MaterialImportMapping,accounting=false):MaterialImportRow[]{
 if(!Array.isArray(grid)||grid.length>5000||grid.some(row=>!Array.isArray(row)||row.length>200))throw Error('ابعاد فایل معتبر نیست.');
 if(!Number.isInteger(header)||header<0||header>=grid.length)throw Error('ردیف عنوان ستون‌ها را انتخاب کنید.');
 const columns=[mapping?.code,mapping?.name,mapping?.unit,...(accounting?[mapping?.existingCode??-1]:[])];
 if(columns.some((v,i)=>!Number.isInteger(v)||v<(i===0||i===1&&!accounting?0:-1)||v>=grid[header].length)||new Set(columns.filter(v=>v>=0)).size!==columns.filter(v=>v>=0).length)throw Error('ستون‌های کد، نام و واحد را جدا بررسی کنید.');
 // Consumption, prices and stock columns are deliberately ignored in this catalog-only path.
 const rows=grid.slice(header+1).filter(row=>row.some(value=>!!clean(value))).map(row=>{
  const unit=clean(row[mapping.unit]);
  return {code:clean(row[mapping.code]),name:clean(row[mapping.name]),unit:normalizeMaterialUnit(unit)||(accounting?unit:''),
   ...(accounting?{existingCode:clean(row[mapping.existingCode??-1])}:{})};
 });
 if(!rows.length||rows.length>200)throw Error('فایل باید بین ۱ تا ۲۰۰ قلم داشته باشد.');
 return rows;
}
export function normalizeMaterialImportRows(value:unknown){
 if(!Array.isArray(value)||!value.length||value.length>200)throw Error('فهرست باید بین ۱ تا ۲۰۰ قلم داشته باشد.');
 const errors:string[]=[],seen=new Set<string>();
 const rows:MaterialImportRow[]=value.map((row,index)=>{
  const at='قلم '+(index+1)+': ';
  if(!row||typeof row!=='object'||['code','name','unit'].some(key=>typeof row[key]!=='string'))throw Error(at+'کد، نام و واحد باید متن باشند.');
  const code=clean(row.code),name=clean(row.name),unit=normalizeMaterialUnit(row.unit);
  if(!/^\d{2,12}$/.test(code))errors.push(at+'کد کالا باید ۲ تا ۱۲ رقم باشد.');
  if(seen.has(code))errors.push(at+'کد تکراری '+code);seen.add(code);
  if(!name||name.length>200)errors.push(at+'نام کالا خالی یا طولانی است.');
  if(!unit)errors.push(at+'واحد را انتخاب کنید.');
  return {code,name,unit};
 });
 return {rows,errors};
}
