import type {ServiceField} from './after-sales-contract';
export const partRepairStates:Record<string,string>={received:'دریافت شده؛ تعیین تکنسین',working:'در دست اقدام',review:'غیرقابل تعمیر؛ تصمیم مسئول خدمات',consent:'منتظر پاسخ نماینده به هزینه',awaiting_stock:'منتظر قطعهٔ نو',ready_send:'آمادهٔ ارسال',shipped:'ارسال شده؛ منتظر رسید',closed:'تحویل به نماینده و پایان'};
export const partRepairActions:Record<string,string>={create:'دریافت قطعهٔ نماینده',assign:'تعیین تکنسین',work:'ثبت اقدام و نتیجهٔ تست',review:'تصمیم دربارهٔ قطعهٔ غیرقابل تعمیر',consent:'ثبت پاسخ نماینده به هزینه',issue:'تحویل قطعهٔ نو از انبار',ship:'ثبت ارسال واقعی',receive:'تأیید دریافت نماینده'};
const f=(key:string,label:string,type='text',extra:Partial<ServiceField>={}):ServiceField=>({key,label,type,...extra});
const target=f('repairId','پروندهٔ قطعه'),day=f('day','تاریخ انجام','date'),notes=f('notes','شرح / مدرک','textarea');
const choice=(key:string,label:string,options:string[][])=>f(key,label,'select',{options});
export const partRepairForms:Record<string,ServiceField[]>={
 create:[f('agentId','نماینده','select',{source:'agents'}),f('partName','نام قطعه'),f('partCode','کد کالا — در صورت وجود','select',{source:'materials',optional:true}),f('serial','سریال قطعه — در صورت وجود','text',{optional:true}),f('noSerial','قطعه سریال ندارد / ناخواناست','boolean',{optional:true}),day,choice('requestedAction','اقدام مورد نیاز',[['repair','تعمیر'],['program','پروگرم'],['test','تست']]),f('requestNotes','شرح درخواست','textarea',{optional:true})],
 assign:[target,f('technicianId','تکنسین','select',{source:'technicians'})],
 work:[target,day,f('performedActions','اقدامات انجام شده','textarea'),f('testResult','نتیجهٔ تست','textarea'),choice('outcome','نتیجه',[['ready','آمادهٔ برگشت؛ تست قبول'],['unrepairable','غیرقابل تعمیر']])],
 review:[target,choice('decision','تصمیم',[['return','عودت همان قطعه'],['replace','ارسال قطعهٔ نو']]),choice('coverage','هزینهٔ قطعهٔ نو',[['warranty','گارانتی — بر عهدهٔ شرکت'],['paid','با دریافت هزینه از نماینده']]),f('replacementPartCode','قطعهٔ جایگزین','select',{source:'materials'}),choice('originalDisposition','تکلیف قطعهٔ قبلی',[['hold','نگهداری در شرکت با رسید'],['return','برگشت همراه قطعهٔ نو']]),notes],
 consent:[target,f('approved','نماینده مبلغ را پذیرفت','boolean'),f('person','نام پاسخ‌دهنده'),choice('method','روش پاسخ',[['phone','تلفنی'],['written','کتبی'],['message','پیام ثبت‌شده']]),notes],
 issue:[target,f('lotId','قطعهٔ نو از موجودی آزاد دفتر','select',{source:'lots'}),f('replacementSerial','سریال قطعهٔ نو — در صورت وجود','text',{optional:true})],
 ship:[target,day,f('carrier','حامل / روش تحویل'),f('reference','شمارهٔ بارنامه / رسید'),f('freightRial','هزینهٔ باربری (ریال)','money',{optional:true})],
 receive:[target,day,f('person','تحویل‌گیرنده'),f('reference','رسید / مدرک دریافت')]
};
export const partRepairHelp=[
 'قطعهٔ نماینده امانی است؛ دریافت آن موجودی قابل فروش، فاکتور یا بستانکاری داغی ایجاد نمی‌کند. هر پرونده یک قطعه و یک کد رسید مستقل دارد.',
 'پذیرش یا مسئول نمایندگان دریافت واقعی را ثبت می‌کند؛ مسئول خدمات تکنسین را تعیین می‌کند. فقط تکنسین تعیین‌شده نتیجهٔ اقدام و تست را ثبت می‌کند.',
 'نتیجهٔ غیرقابل تعمیر برای تصمیم مستند گارانتی به مسئول خدمات می‌رود. جایگزینی رایگان خودکار نیست. در حالت هزینه‌دار، تعرفهٔ مصوب معتبر و پاسخ نماینده پیش از برداشت انبار لازم است.',
 'قطعهٔ نو فقط از موجودی آزاد دفتر همان حوزه خدمات برداشت می‌شود؛ بچ واقعی خودکار ثبت می‌شود. مبلغ تأییدشده فقط یک بار هنگام تحویل قطعهٔ نو فاکتور می‌شود. در حالت گارانتی بدهی ایجاد نمی‌شود.',
 'ارسال به معنی تحویل نیست؛ پرونده پس از ثبت دریافت واقعی نماینده بسته می‌شود. قطعهٔ قبلی در جایگزینی با رسید در شرکت می‌ماند یا همراه قطعهٔ نو برمی‌گردد؛ هیچ اسقاط خودکاری انجام نمی‌شود.',
 'برای هر ثبت، confirmed=true، شناسهٔ عملیات جدید و برای پروندهٔ موجود revision تازه لازم است. تاریخ‌ها واقعی و هزینه‌ها ریال صحیح هستند؛ ابزار بانکی یا ارسال پیام انجام نمی‌دهد.'
];
export function visiblePartRepairFields(mode:string,values:any){return (partRepairForms[mode]||[]).filter(f=>
 !(mode==='review'&&values.decision!=='replace'&&['coverage','replacementPartCode','originalDisposition'].includes(f.key))&&
 !(mode==='create'&&values.noSerial===true&&!values.serial&&f.key==='serial'));
}
