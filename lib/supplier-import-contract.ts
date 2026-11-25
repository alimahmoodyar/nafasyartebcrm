import type {BomSheet} from './bom-import-file';

export const vendorSheet='تأمین‌کنندگان',vendorLinkSheet='ارتباط کالاها';
export const vendorHeaders=['کد تفصیلی تأمین‌کننده','نام تأمین‌کننده','نوع شخص','شناسهٔ ملی شرکت','تلفن اصلی','نشانی'];
export const vendorLinkHeaders=['کد تفصیلی تأمین‌کننده','کد حسابداری کالا','عنوان کالا','تصمیم','دلیل بررسی'];
export type VendorImportRow={vendorCode:string;name:string;legalType:string;nationalId:string;phone:string;address:string};
export type VendorLinkImportRow={vendorCode:string;itemCode:string;itemName:string;hold:boolean;reason:string};

export function parseVendorWorkbook(sheets:BomSheet[]){
 const rows=(name:string,headers:string[])=>{
  const grid=sheets.find(sheet=>sheet.name===name)?.grid;
  if(!grid||headers.some((value,index)=>String(grid[0]?.[index]??'').trim()!==value))
   throw Error('برگهٔ «'+name+'» یا سرستون‌های آن با الگوی ورود هماهنگ نیست.');
  return grid.slice(1).filter(row=>row.some(value=>String(value??'').trim())).map(row=>headers.map((_,index)=>String(row[index]??'').trim()));
 };
 const vendors=rows(vendorSheet,vendorHeaders).map(([vendorCode,name,legalType,nationalId,phone,address])=>({vendorCode,name,legalType,nationalId,phone,address}));
 const links=rows(vendorLinkSheet,vendorLinkHeaders).map(([vendorCode,itemCode,itemName,decision,reason])=>{
  if(!['بررسی','اتصال'].includes(decision))throw Error('تصمیم برای کد کالای '+itemCode+' باید «اتصال» یا «بررسی» باشد.');
  return {vendorCode,itemCode,itemName,hold:decision==='بررسی',reason};
 });
 return {vendors,links};
}
