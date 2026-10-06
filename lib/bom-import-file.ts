import {parseBomGrid} from './bom-import';
export async function readBomGrid(file:File){
 if(file.size>5*1024*1024)throw Error('حداکثر حجم فایل ۵ مگابایت است.');
 const prefix=await file.slice(0,200).text();let grid:unknown[][];
 if(prefix.trimStart().startsWith('<')){
  const text=await file.text();if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('فایل XML مجاز نیست.');
  const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))throw Error('ساختار XML فایل خراب است.');
  const ns='urn:schemas-microsoft-com:office:spreadsheet',sheets=doc.getElementsByTagNameNS(ns,'Worksheet');
  if(sheets.length!==1)throw Error('فایل گزارش باید فقط یک برگه داشته باشد.');
  grid=Array.from(sheets[0].getElementsByTagNameNS(ns,'Row')).map(row=>{const values:unknown[]=[];let i=0;for(const cell of Array.from(row.getElementsByTagNameNS(ns,'Cell'))){const index=cell.getAttributeNS(ns,'Index');if(index)i=Number(index)-1;if(!Number.isInteger(i)||i<0||i>=200)throw Error('ستون فایل معتبر نیست.');values[i]=cell.getElementsByTagNameNS(ns,'Data')[0]?.textContent||'';i+=1+Number(cell.getAttributeNS(ns,'MergeAcross')||0);}return values;});
 }else{
  if(!/\.xlsx$/i.test(file.name))throw Error('این XLS باینری است؛ در اکسل با فرمت XLSX ذخیره کنید. خروجی XML حسابداری با پسوند XLS پشتیبانی می‌شود.');
  const {readSheet}=await import('read-excel-file/browser');grid=await readSheet(file);
 }
 if(grid.length>5000||grid.some(r=>r.length>200))throw Error("ابعاد فایل بیش از حد مجاز است.");
 return grid;
}

export async function readBomFile(file:File){return parseBomGrid(await readBomGrid(file));}
