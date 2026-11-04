import {guessImportMapping,parseBomGrid,parseMappedBomGrid} from './bom-import';
export type BomSheet={name:string;grid:unknown[][]};
export function defaultBomSheet(sheets:BomSheet[]){return Math.max(0,sheets.findIndex(s=>s.name.trim().replace(/[١۱]/g,'1')==='1'));}
function boundedGrid(grid:unknown[][]){if(grid.length>5000||grid.some(r=>r.length>200))throw Error('ابعاد فایل بیش از حد مجاز است.');return grid.map(row=>Array.from(row,v=>v??''));}
export async function readBomSheets(file:File):Promise<BomSheet[]>{
 if(file.size>5*1024*1024)throw Error('حداکثر حجم فایل ۵ مگابایت است.');
 const prefix=await file.slice(0,200).text();let result:BomSheet[];
 if(prefix.trimStart().startsWith('<')){
  const text=await file.text();if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('فایل XML مجاز نیست.');
  const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))throw Error('ساختار XML فایل خراب است.');
  const ns='urn:schemas-microsoft-com:office:spreadsheet',sheets=doc.getElementsByTagNameNS(ns,'Worksheet');
  if(!sheets.length||sheets.length>50)throw Error('فایل باید بین ۱ تا ۵۰ برگه داشته باشد.');
  result=Array.from(sheets,(sheet,number)=>{
   const grid:unknown[][]=[];let rowIndex=0;
   for(const row of Array.from(sheet.getElementsByTagNameNS(ns,'Row'))){
    const at=row.getAttributeNS(ns,'Index');if(at)rowIndex=Number(at)-1;
    if(!Number.isInteger(rowIndex)||rowIndex<grid.length||rowIndex>=5000)throw Error('ردیف فایل معتبر نیست.');
    while(grid.length<rowIndex)grid.push([]);
    const values:unknown[]=[];let i=0;
    for(const cell of Array.from(row.getElementsByTagNameNS(ns,'Cell'))){
     const index=cell.getAttributeNS(ns,'Index');if(index)i=Number(index)-1;
     const merge=Number(cell.getAttributeNS(ns,'MergeAcross')||0);
     if(!Number.isInteger(i)||i<values.length||i>=200||!Number.isInteger(merge)||merge<0||i+merge>=200)throw Error('ستون فایل معتبر نیست.');
     while(values.length<i)values.push('');values.push(cell.getElementsByTagNameNS(ns,'Data')[0]?.textContent||'');
     for(let j=0;j<merge;j++)values.push('');i+=1+merge;
    }
    grid.push(values);rowIndex++;
   }
   return {name:sheet.getAttributeNS(ns,'Name')||String(number+1),grid:boundedGrid(grid)};
  });
 }else{
  if(!/\.xlsx$/i.test(file.name))throw Error('این XLS باینری است؛ در اکسل با فرمت XLSX ذخیره کنید. خروجی XML حسابداری با پسوند XLS پشتیبانی می‌شود.');
  const {default:readWorkbook}=await import('read-excel-file/browser');const sheets=await readWorkbook(file);
  if(!sheets.length||sheets.length>50)throw Error('فایل باید بین ۱ تا ۵۰ برگه داشته باشد.');
  result=sheets.map(s=>({name:s.sheet,grid:boundedGrid(s.data)}));
 }
 return result;
}

// Compatibility entry point: choose one sheet, never concatenate assemblies.
export async function readBomGrid(file:File){const sheets=await readBomSheets(file);return sheets[defaultBomSheet(sheets)].grid;}

export async function readBomFile(file:File){
 const grid=await readBomGrid(file);
 try{return parseBomGrid(grid);}catch(error){
  const header=grid.findIndex(row=>{const m=guessImportMapping(row);return m.partCode>=0&&m.name>=0&&m.quantity>=0;});
  if(header<0)throw error;
  return parseMappedBomGrid(grid,header,guessImportMapping(grid[header]));
 }
}
