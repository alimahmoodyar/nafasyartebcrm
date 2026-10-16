import {bankCellText,emptyBankImportMapping,parseSalesBankRows,type ExcelNumber} from './sales-bank-import';
import {parseCalendarDay} from './persian-date';

export type BankSheet={sheet:string;data:unknown[][]};
export type BankReportKind='statement'|'pos'|'unknown';
export type BankReportDetection={kind:BankReportKind;headerRow:number;columns:Record<string,number>};
export const MAX_BANK_WORKBOOK_BYTES=10*1024*1024;
const MAX_ROWS=10000,MAX_COLUMNS=200;
const normalized=(v:unknown)=>bankCellText(v).normalize('NFKC').replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\s\u200c\u200e\u200f()[\]،:؛/_-]/g,'').toLowerCase();

export function bankWorkbookFormat(filename:string,bytes:Uint8Array){
 if(!/\.(xlsx|xls)$/i.test(filename)||/[\x00-\x1f\x7f/\\]/.test(filename)||filename.length>180)throw Error('فایل اکسل با پسوند XLS یا XLSX انتخاب کنید.');
 if(!bytes.length||bytes.length>MAX_BANK_WORKBOOK_BYTES)throw Error('فایل اکسل باید غیرخالی و حداکثر ۱۰ مگابایت باشد.');
 const xls=[208,207,17,224,161,177,26,225].every((v,i)=>bytes[i]===v),xlsx=[80,75,3,4].every((v,i)=>bytes[i]===v);
 if(/\.xlsx$/i.test(filename)?!xlsx:!xls)throw Error('محتوای فایل با پسوند اکسل مطابقت ندارد؛ خروجی اصلی بانک را انتخاب کنید.');
 return xls?'xls':'xlsx';
}

/** Same byte reader in browser, HTTP and MCP. No formulas, macros or external links execute. */
export async function readBankWorkbook(filename:string,bytes:Uint8Array):Promise<BankSheet[]>{
 const format=bankWorkbookFormat(filename,bytes);let sheets:BankSheet[];
 if(format==='xlsx'){
  const {default:readExcel}=await import('read-excel-file/universal');
  sheets=await readExcel<ExcelNumber>(bytes.slice().buffer,{parseNumber:value=>({excelNumber:value})});
 }else{
  const XLSX=await import('xlsx');
  const book=XLSX.read(bytes,{type:'array',cellDates:true,cellNF:true,cellText:false});
  sheets=book.SheetNames.map(sheet=>{
   const ws=book.Sheets[sheet];let lastRow=-1,lastColumn=-1;
   // Legacy bank exports format all 256 columns. Bounds must follow actual data,
   // not the BIFF dimension record, or the supplied 11-column statement is rejected.
   for(const [address,cell] of Object.entries(ws)){if(address.startsWith('!')||!cell||cell.v==null||cell.v==='')continue;if(cell.f)throw Error('گردش بانک باید داده قطعی داشته باشد؛ سلول فرمولی را به مقدار تبدیل کنید.');const at=XLSX.utils.decode_cell(address);lastRow=Math.max(lastRow,at.r);lastColumn=Math.max(lastColumn,at.c);}
   if(lastRow>=MAX_ROWS||lastColumn>=MAX_COLUMNS)throw Error('برگه اکسل بیش از ۱۰٬۰۰۰ ردیف یا ۲۰۰ ستون دارد؛ خروجی را محدود کنید.');
   const data:unknown[][]=[];
   for(let r=0;r<=lastRow;r++){const row:unknown[]=[];for(let c=0;c<=lastColumn;c++){const cell=ws[XLSX.utils.encode_cell({r,c})];if(cell?.f)throw Error('گردش بانک باید داده قطعی داشته باشد؛ سلول فرمولی را به مقدار تبدیل کنید.');row.push(cell?.v??'');}data.push(row);}
   return {sheet,data};
  });
 }
 if(!sheets.length||sheets.length>20)throw Error('فایل اکسل باید بین ۱ تا ۲۰ برگه داشته باشد.');
 if(sheets.some(s=>s.data.length>MAX_ROWS||s.data.some(r=>r.length>MAX_COLUMNS)))throw Error('برگه اکسل بیش از ۱۰٬۰۰۰ ردیف یا ۲۰۰ ستون دارد؛ خروجی را محدود کنید.');
 return sheets;
}

const statementHeaders:Record<string,string[]>={day:['تاریخ تراکنش','تاریخ'],description:['شرح','شرح تراکنش'],incoming:['مبلغ واریز','واریز','بستانکار'],outgoing:['مبلغ برداشت','برداشت','بدهکار'],reference:['شماره ارجاع','شماره مرجع'],time:['زمان تراکنش','زمان','ساعت'],balance:['موجودی','مانده'],check:['سریال چک/ شماره فیش'],branch:['شعبه عامل']};
const posHeaders:Record<string,string[]>={reference:['شماره مرجع'],serial:['سریال تراکنش'],tracking:['کد رهگیری'],day:['تاریخ تراکنش'],time:['زمان تراکنش'],financialDay:['تاریخ مالی(شمسی)','تاریخ مالی'],iban:['شماره شبا','شبا'],status:['وضعیت تراکنش'],statusText:['شرح وضعیت تراکنش'],gross:['مبلغ اصلی'],paid:['مبلغ پرداختی'],terminal:['شماره پایانه','کد ترمینال'],provider:['کد سوئیچ'],description:['توضیحات'],fee:['مبلغ کارمزد'],net:['مبلغ واریز پس از کسر کارمزد'],paymentId:['شناسه پرداخت']};
function findColumns(row:unknown[],headers:Record<string,string[]>){
 const columns:Record<string,number>={};
 for(const [key,aliases] of Object.entries(headers))for(const alias of aliases){const found=row.flatMap((v,i)=>normalized(v)===normalized(alias)?[i]:[]);if(found.length>1)return null;if(found.length===1){columns[key]=found[0];break;}}
 return columns;
}
export function detectBankReport(grid:unknown[][]):BankReportDetection{
 for(let r=0;r<Math.min(grid.length,60);r++){
  const pos=findColumns(grid[r],posHeaders),labels=grid[r].map(normalized);
  // An incomplete/ambiguous POS export must not fall back to a manual bank-credit import.
  if(['iban','status','paid','terminal'].every(k=>posHeaders[k].some(alias=>labels.includes(normalized(alias)))))return {kind:'pos',headerRow:r+1,columns:pos||{}};
  const bank=findColumns(grid[r],statementHeaders);if(bank&&['day','description','incoming','outgoing','reference','time','balance'].every(k=>k in bank))return {kind:'statement',headerRow:r+1,columns:bank};
 }
 return {kind:'unknown',headerRow:0,columns:{}};
}
function identifier(value:unknown,line:number){
 const text=bankCellText(value);if(typeof value==='number'||value&&typeof value==='object'&&'excelNumber' in value){if(!/^\d{1,15}$/.test(text)||!Number.isSafeInteger(Number(text)))throw Error(`ردیف ${line}: شناسه عددی اکسل دقیق نیست؛ نسخه متنی لازم است.`);}
 if(value instanceof Date||typeof value==='boolean'||text.length>200)throw Error(`ردیف ${line}: شناسه معتبر نیست.`);return text;
}
function amount(value:unknown,unit:'IRR'|'IRT',line:number){
 const text=bankCellText(value).replace(/\u066b/g,'.');if(!/^(?:\d+|\d{1,3}(?:[,٬]\d{3})+)(?:\.0+)?$/.test(text))throw Error(`ردیف ${line}: مبلغ صحیح و غیرمنفی لازم است.`);
 if(typeof value==='number'&&!Number.isSafeInteger(value))throw Error(`ردیف ${line}: مبلغ عددی دقیق نیست.`);
 const n=BigInt(text.replace(/[,٬]/g,'').replace(/\.0+$/,''))*(unit==='IRT'?BigInt(10):BigInt(1));if(n>BigInt(999999999999999))throw Error(`ردیف ${line}: مبلغ خارج از محدوده است.`);return n;
}
function day(value:unknown,line:number){const text=bankCellText(value),parsed=parseCalendarDay(value instanceof Date?value:/^\d{8}$/.test(text)?`${text.slice(0,4)}/${text.slice(4,6)}/${text.slice(6)}`:text);if(!parsed)throw Error(`ردیف ${line}: تاریخ معتبر لازم است.`);return parsed;}
async function fingerprint(parts:unknown[]){const bytes=new TextEncoder().encode(JSON.stringify(parts));return 'statement:'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');}

export async function extractBankReport(grid:unknown[][],unit:'IRR'|'IRT',detection=detectBankReport(grid),range?:{firstRow:number;lastRow:number}){
 if(!['IRR','IRT'].includes(unit))throw Error('واحد مبلغ فایل را صریحاً انتخاب کنید؛ از روی اعداد قابل تشخیص نیست.');
 if(detection.kind==='unknown')throw Error('قالب شناخته نشد؛ ستون‌های گردش بانک را دستی مشخص کنید.');
 if(detection.kind==='pos'&&!['reference','day','iban','status','paid','terminal','fee','net'].every(k=>k in detection.columns))throw Error('ستون‌های گزارش پوز ناقص یا تکراری‌اند؛ خروجی اصلی شامل وضعیت، مرجع، تاریخ، پایانه، شبا، مبلغ پرداخت، کارمزد و واریز خالص لازم است.');
 const firstRow=range?.firstRow??detection.headerRow+1,lastRow=range?.lastRow??grid.length;
 if(!Number.isInteger(firstRow)||!Number.isInteger(lastRow)||firstRow<=detection.headerRow||lastRow<firstRow||lastRow>grid.length||lastRow-firstRow+1>500)throw Error('محدوده حداکثر ۵۰۰ ردیف تراکنش پس از عنوان ستون‌ها انتخاب کنید.');
 const source=grid.slice(firstRow-1,lastRow).flatMap((row,index)=>row.some(v=>v!==''&&v!=null)?[{row,line:firstRow+index}]:[]);
 if(!source.length||source.length>500)throw Error('در هر مرحله بین ۱ تا ۵۰۰ تراکنش انتخاب کنید.');
 const col=detection.columns,get=(row:unknown[],key:string)=>col[key]==null?'':row[col[key]],warnings:string[]=[];
 if(detection.kind==='statement'){
  const mapping=emptyBankImportMapping();mapping.unit=unit;mapping.firstRow=firstRow;mapping.lastRow=lastRow;mapping.columns={...mapping.columns,day:col.day,bankId:col.reference,reference:col.reference,description:col.description,incoming:col.incoming,outgoing:col.outgoing};
  // A bank's display row number or repeated reference is not a durable transaction identity.
  const result=parseSalesBankRows(grid as any[][],mapping),seen=new Set<string>();
  for(const [i,item] of source.entries()){const row=result.rows[i];row.bankId=await fingerprint([row.day,bankCellText(get(item.row,'time')),row.direction,row.amount,row.reference,bankCellText(get(item.row,'check')),bankCellText(get(item.row,'branch')),String(amount(get(item.row,'balance'),unit,item.line)),row.description]);if(seen.has(row.bankId))throw Error(`ردیف ${item.line}: تراکنش کاملاً مشابه وجود دارد؛ شناسه یکتای بانک را با نگاشت دستی مشخص کنید.`);seen.add(row.bankId);}
  warnings.push(...result.warnings,'شناسه ردیف از مشخصات تراکنش، زمان و مانده ساخته شد؛ شماره ردیف و شماره ارجاع تکراری به‌تنهایی شناسه نیستند.');
  return {kind:'statement' as const,headerRow:detection.headerRow,rows:result.rows,excluded:[],warnings,summary:{total:source.length,incoming:result.rows.filter(r=>r.direction==='in').length,outgoing:result.rows.filter(r=>r.direction==='out').length}};
 }
 const rows:any[]=[],excluded:{line:number;reason:string}[]=[],seen=new Set<string>();
 for(const {row,line} of source){
  const status=normalized(get(row,'status')),explanation=bankCellText(get(row,'statusText'));
  if(['ناموفق','تراکنشناموفق','failed','failure','unsuccessful'].includes(status)){excluded.push({line,reason:'تراکنش ناموفق'+(explanation?'؛ '+explanation:'')});continue;}
  if(!['موفق','تراکنشموفق','successful','success'].includes(status))throw Error(`ردیف ${line}: وضعیت تراکنش شناخته‌شده نیست؛ قبل از ورود بررسی کنید.`);
  const paid=amount(get(row,'paid'),unit,line),fee=amount(get(row,'fee'),unit,line),net=amount(get(row,'net'),unit,line);
  if(!paid){if(fee||net)throw Error(`ردیف ${line}: مبلغ صفر با کارمزد یا واریز غیرصفر ناسازگار است.`);excluded.push({line,reason:'مبلغ تراکنش صفر است'});continue;}
  if(paid!==net+fee)throw Error(`ردیف ${line}: مبلغ پرداخت با مجموع واریز خالص و کارمزد برابر نیست.`);
  const reference=identifier(get(row,'reference'),line),terminalCode=identifier(get(row,'terminal'),line),iban=identifier(get(row,'iban'),line).replace(/\s/g,'').toUpperCase();
  if(!reference||!terminalCode||!/^IR\d{24}$/.test(iban))throw Error(`ردیف ${line}: شماره مرجع، پایانه و شبای معتبر لازم است.`);
  const providerCode=identifier(get(row,'provider'),line),key=JSON.stringify([providerCode,terminalCode,reference]);if(seen.has(key))throw Error(`ردیف ${line}: شناسه تراکنش پوز تکراری است.`);seen.add(key);
  const gross=col.gross==null?paid:amount(get(row,'gross'),unit,line);
  rows.push({line,reference,serial:identifier(get(row,'serial'),line),tracking:identifier(get(row,'tracking'),line),day:day(get(row,'day'),line),time:bankCellText(get(row,'time')),financialDay:day(get(row,'financialDay')||get(row,'day'),line),iban,terminalCode,providerCode,status:'success',gross:String(gross),paid:String(paid),fee:String(fee),net:String(net),paymentId:identifier(get(row,'paymentId'),line),description:bankCellText(get(row,'description'))});
 }
 warnings.push('گزارش پوز، مدرک واریز قطعی بانک نیست؛ خواندن آن وصول یا تخصیص بدهی ایجاد نمی‌کند.','کد سوئیچ جای نام شرکت پرداخت نیست؛ ارتباط پایانه و حساب مقصد باید بررسی شود.');
 const accounts=[...new Set(rows.map(r=>r.iban))],terminals=[...new Set(rows.map(r=>r.terminalCode))];
 const groups=accounts.map(iban=>{const entries=rows.filter(r=>r.iban===iban),sum=(key:string)=>String(entries.reduce((total,r)=>total+BigInt(r[key]),BigInt(0)));return {iban,count:entries.length,paid:sum('paid'),fee:sum('fee'),net:sum('net'),terminals:[...new Set(entries.map(r=>r.terminalCode))]};});
 if(source.some(({row})=>['reference','serial','tracking','terminal','provider','paymentId'].some(key=>{const v=get(row,key);return typeof v==='number'||!!v&&typeof v==='object'&&'excelNumber' in v;})))warnings.push('بعضی شناسه‌ها در اکسل عددی‌اند؛ صفر احتمالی ابتدای شناسه را با خروجی اصلی شرکت پرداخت کنترل کنید.');
 if(accounts.length>1)warnings.push('گزارش چند شبای مقصد دارد؛ تراکنش‌ها باید بر اساس حساب مقصد تطبیق شوند.');
 return {kind:'pos' as const,headerRow:detection.headerRow,rows,excluded,warnings,summary:{total:source.length,eligible:rows.length,excluded:excluded.length,accounts,groups,terminals,paid:String(rows.reduce((sum,r)=>sum+BigInt(r.paid),BigInt(0))),fee:String(rows.reduce((sum,r)=>sum+BigInt(r.fee),BigInt(0))),net:String(rows.reduce((sum,r)=>sum+BigInt(r.net),BigInt(0)))}};
}
