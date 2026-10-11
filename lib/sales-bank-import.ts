import {formatDate,latinDigits,parseCalendarDay,isIsoDay} from './persian-date';
export type ExcelNumber={excelNumber:string};
export type Column=number|'';
export type BankImportMapping={firstRow:number;lastRow:number;unit:'IRR'|'IRT';amountMode:'split'|'signed';dateMode:'text'|'excel1900'|'excel1904';columns:Record<'day'|'bankId'|'reference'|'terminalCode'|'provider'|'kind'|'description'|'incoming'|'outgoing'|'amount'|'direction',Column>;inValue:string;outValue:string;posValues:string;transferValues:string;defaultProvider?:string};
export const emptyBankImportMapping=():BankImportMapping=>({firstRow:2,lastRow:2,unit:'IRR',amountMode:'split',dateMode:'text',columns:{day:'',bankId:'',reference:'',terminalCode:'',provider:'',kind:'',description:'',incoming:'',outgoing:'',amount:'',direction:''},inValue:'دریافت',outValue:'پرداخت',posValues:'پوز\nPOS',transferValues:'واریز\nانتقال وجه'});
const isExcelNumber=(v:unknown):v is ExcelNumber=>!!v&&typeof v==='object'&&'excelNumber' in v;
export const bankCellText=(v:unknown)=>latinDigits(isExcelNumber(v)?v.excelNumber:v instanceof Date?formatDate(v):String(v??'')).trim();

/** Every selected bank row is validated before the authenticated import can run. */
export function parseSalesBankRows(grid:any[][],mapping:BankImportMapping){
 const warnings:string[]=[],rows:any[]=[];
 if(!mapping||typeof mapping!=='object'||!mapping.columns||typeof mapping.columns!=='object')throw Error('نگاشت ستون‌های فایل بانک لازم است.');
 if(!['split','signed'].includes(mapping.amountMode))throw Error('ساختار مبالغ را انتخاب کنید.');
 const keys=['day','bankId','reference','terminalCode','provider','kind','description','incoming','outgoing','amount','direction'] as const;
 for(const key of keys){const value=mapping.columns[key];if(value!==''&&(!Number.isInteger(value)||Number(value)<0||Number(value)>199))throw Error('شماره ستون‌های فایل بانک معتبر نیست.');}
 if(!['inValue','outValue','posValues','transferValues'].every(key=>typeof mapping[key as keyof BankImportMapping]==='string'))throw Error('عنوان‌های نوع و جهت تراکنش معتبر نیست.');
 const required=['day','bankId',...(mapping.amountMode==='split'?['incoming','outgoing']:['amount','direction'])] as (keyof BankImportMapping['columns'])[];
 if(required.some(key=>mapping.columns[key]===''))throw Error('ستون تاریخ، شناسه تراکنش و مبلغ / جهت را مشخص کنید.');
 if(mapping.amountMode==='split'&&mapping.columns.incoming===mapping.columns.outgoing)throw Error('ستون واریز و برداشت باید متفاوت باشد.');
 if(!['IRR','IRT'].includes(mapping.unit))throw Error('واحد مبلغ را صریحاً انتخاب کنید.');
 if(!['text','excel1900','excel1904'].includes(mapping.dateMode))throw Error('فرمت تاریخ را انتخاب کنید.');
 if(!Number.isInteger(mapping.firstRow)||!Number.isInteger(mapping.lastRow)||mapping.firstRow<1||mapping.lastRow<mapping.firstRow||mapping.lastRow>grid.length)throw Error('محدوده ردیف‌های تراکنش معتبر نیست.');
 if(mapping.lastRow-mapping.firstRow+1>500)throw Error('در هر مرحله حداکثر ۵۰۰ ردیف تراکنش وارد کنید.');
 const clean=(v:unknown)=>bankCellText(v).replace(/[\u200e\u200f\u202a-\u202e]/g,'');
 if(mapping.amountMode==='signed'&&(!clean(mapping.inValue)||!clean(mapping.outValue)||clean(mapping.inValue)===clean(mapping.outValue)))throw Error('مقدار دریافت و پرداخت در ستون جهت باید مشخص و متفاوت باشد.');
 const values=(s:string)=>s.split(/\r?\n/).map(clean).filter(Boolean),pos=values(mapping.posValues),transfer=values(mapping.transferValues);
 if(pos.some(v=>transfer.includes(v)))throw Error('عنوان تراکنش پوز و واریز معمولی نباید یکسان باشد.');
 const numericWarnings=new Set<string>();
 const identifier=(v:unknown,key:string,row:number,needed=false)=>{
  const s=clean(v);if(needed&&!s)throw Error(`ردیف ${row}: شناسه تراکنش بانک خالی است.`);
  if(typeof v==='number'||isExcelNumber(v)){
   if(!/^\d{1,15}$/.test(s)||!Number.isSafeInteger(Number(s)))throw Error(`ردیف ${row}: ${key} در اکسل به صورت عدد نامطمئن ذخیره شده است؛ ستون را از بانک به صورت متن دریافت کنید.`);
   if(s){numericWarnings.add(key);}
  }else if(v instanceof Date||typeof v==='boolean')throw Error(`ردیف ${row}: ${key} باید متن باشد.`);
  if(s.length>200)throw Error(`ردیف ${row}: ${key} بیش از حد طولانی است.`);
  return s;
 };
 const amount=(v:unknown,row:number)=>{
  const s=clean(v).replace(/\u066b/g,'.');if(!s)return BigInt(0);
  if(!/^(?:\d+|\d{1,3}(?:[,٬]\d{3})+)(?:\.0+)?$/.test(s))throw Error(`ردیف ${row}: مبلغ باید عدد صحیح و غیرمنفی باشد؛ اعشار یا جداکننده مبهم قابل ثبت نیست.`);
  if(typeof v==='number'&&!Number.isSafeInteger(v))throw Error(`ردیف ${row}: مبلغ عددی اکسل دقیق نیست؛ نسخه متنی یا مبلغ کوچک‌تر لازم است.`);
  const n=BigInt(s.replace(/[,٬]/g,'').replace(/\.0+$/,''))*(mapping.unit==='IRT'?BigInt(10):BigInt(1));
  if(n>BigInt('999999999999999'))throw Error(`ردیف ${row}: مبلغ خارج از محدوده مجاز است.`);return n;
 };
 let blanks=0;
 for(let index=mapping.firstRow-1;index<mapping.lastRow;index++){
  const record=grid[index]||[],line=index+1;if(!record.some(v=>v!==null&&v!==undefined&&v!=='')){blanks++;continue;}
  const get=(key:keyof BankImportMapping['columns'])=>mapping.columns[key]===''?'':record[mapping.columns[key] as number];
  const rawDay=get('day');let day='';
  if(rawDay instanceof Date)day=parseCalendarDay(rawDay);
  else if(mapping.dateMode==='text')day=parseCalendarDay(clean(rawDay));
  else{const text=clean(rawDay);if(!/^\d+(?:\.\d+)?$/.test(text))throw Error(`ردیف ${line}: تاریخ باید شماره روز اکسل باشد یا فرمت تاریخ را تغییر دهید.`);const serial=Number(text);if(!Number.isFinite(serial)||serial<1||serial>180000||mapping.dateMode==='excel1900'&&Math.floor(serial)===60)throw Error(`ردیف ${line}: شماره روز اکسل معتبر نیست.`);const epoch=mapping.dateMode==='excel1904'?Date.UTC(1904,0,1):Math.floor(serial)<60?Date.UTC(1899,11,31):Date.UTC(1899,11,30);day=new Date(epoch+Math.floor(serial)*86400000).toISOString().slice(0,10);}
  if(!isIsoDay(day))throw Error(`ردیف ${line}: تاریخ معتبر با ترتیب سال/ماه/روز لازم است؛ فرمت تاریخ را بررسی کنید.`);
  let direction:'in'|'out',value:bigint;
  if(mapping.amountMode==='split'){const incoming=amount(get('incoming'),line),outgoing=amount(get('outgoing'),line);if((incoming>BigInt(0))===(outgoing>BigInt(0)))throw Error(`ردیف ${line}: دقیقاً یکی از مبلغ واریز یا برداشت باید بیشتر از صفر باشد.`);direction=incoming>BigInt(0)?'in':'out';value=incoming>BigInt(0)?incoming:outgoing;}
  else{value=amount(get('amount'),line);const type=clean(get('direction'));if(value<=BigInt(0)||![clean(mapping.inValue),clean(mapping.outValue)].includes(type))throw Error(`ردیف ${line}: مبلغ مثبت و جهت منطبق با مقادیر دریافت / پرداخت لازم است.`);direction=type===clean(mapping.inValue)?'in':'out';}
  const terminalCode=identifier(get('terminalCode'),'کد ترمینال',line),reference=identifier(get('reference'),'شماره پیگیری',line),bankId=identifier(get('bankId'),'شناسه تراکنش',line,true),kindText=clean(get('kind'));
  const kind=mapping.columns.kind===''?(terminalCode?'pos':'transfer'):pos.includes(kindText)?'pos':transfer.includes(kindText)?'transfer':'other';
  const provider=clean(mapping.columns.provider===''?mapping.defaultProvider||'':get('provider'));
  if(provider.length>200)throw Error(`ردیف ${line}: نام ارائه‌دهنده پوز بیش از حد طولانی است.`);
  rows.push({bankId,day,direction,amount:String(value),reference,terminalCode,provider,kind,description:clean(get('description'))});
 }
 if(!rows.length)throw Error('در محدوده انتخاب‌شده تراکنشی وجود ندارد.');
 if(blanks)warnings.push(`${blanks.toLocaleString('fa-IR')} ردیف کاملاً خالی در محدوده انتخاب‌شده وجود دارد و وارد نمی‌شود.`);
 for(const key of numericWarnings)warnings.push(`${key} در اکسل عددی است؛ ممکن است صفر ابتدای آن در فایل بانک حذف شده باشد. قبل از تأیید با فایل اصلی کنترل کنید.`);
 return {rows,warnings};
}

