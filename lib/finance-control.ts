export type Cadence='daily'|'weekly';
export const financeReports:{id:string;cadence:Cadence;title:string;files:string;purpose:string}[]=[
{id:'bank',cadence:'daily',title:'گردش بانک و دریافت‌وپرداخت',files:'صورت‌حساب مستقیم بانک‌ها، گردش حساب‌های بانکی سپیدار و جزئیات دریافت‌وپرداخت',purpose:'تطبیق تراکنش‌ها، مبالغ و انتقال بین حساب‌ها'},
{id:'payments',cadence:'daily',title:'کنترل پرداخت‌ها و مدارک',files:'ریز پرداخت‌ها، فاکتور یا درخواست پرداخت و تأییدیه‌ها',purpose:'بررسی پرداخت تکراری، مبلغ و مستندات'},
{id:'documents',cadence:'daily',title:'اسناد حسابداری و ثبت‌های ناقص',files:'ریز سطرهای اسناد همراه شماره، تاریخ، وضعیت، بدهکار و بستانکار',purpose:'بررسی توازن، اطلاعات ناقص و اسناد موقت'},
{id:'sales-stock',cadence:'daily',title:'تطبیق فروش و خروج کالا',files:'ریز فاکتور و برگشت فروش، حواله و برگشت انبار و شرایط فروش',purpose:'تطبیق کالا، مقدار، فاکتور و تحویل'},
{id:'checks',cadence:'daily',title:'چک‌ها و تعهدات نزدیک',files:'چک‌های دریافتی و پرداختی با وضعیت و سررسید، ماندهٔ قابل‌استفادهٔ بانک',purpose:'پیگیری سررسید و تعهدات تعیین‌تکلیف‌نشده'},
{id:'stock-production',cadence:'daily',title:'گردش انبار و تولید',files:'رسید، حواله و انتقال انبار، ثبت تولید و مصرف مواد',purpose:'بررسی موجودی منفی، انتقال یک‌طرفه و مصرف مواد'},
{id:'receivables',cadence:'weekly',title:'مطالبات مشتریان و نمایندگان',files:'مانده و گردش تفصیلی، فاکتورها، وصول‌ها، سررسیدها و سقف اعتبار',purpose:'پیگیری مطالبات معوق و وصول‌های تخصیص‌نیافته'},
{id:'payables',cadence:'weekly',title:'بدهی و خرید از تأمین‌کنندگان',files:'مانده و گردش تأمین‌کنندگان، فاکتور خرید، رسید کالا و سفارش‌ها',purpose:'تطبیق سفارش، تحویل، بدهی و پیش‌پرداخت'},
{id:'ledgers',cadence:'weekly',title:'تطبیق زیرسیستم‌ها با حسابداری',files:'ماندهٔ خزانه، مشتریان، تأمین‌کنندگان و ارزش انبار، حساب‌های متناظر دفتر کل',purpose:'شناسایی اختلاف مانده و عملیات بدون سند'},
{id:'advances',cadence:'weekly',title:'تنخواه، مساعده و پیش‌پرداخت',files:'گردش و مانده، مدارک هزینه و مهلت تسویه',purpose:'پیگیری مبالغ قدیمی و مدارک ناقص'},
{id:'cashflow',cadence:'weekly',title:'نقدینگی و تعهدات پیش رو',files:'ماندهٔ قابل‌استفاده و برنامهٔ وصول، پرداخت، حقوق، خرید و اقساط',purpose:'بررسی کسری احتمالی نقدینگی'},
{id:'consumption',cadence:'weekly',title:'مصرف مواد، ضایعات و دوباره‌کاری',files:'تولید واقعی، مصرف مواد و قطعات، استاندارد مصرف معتبر و ضایعات',purpose:'مقایسهٔ مصرف واقعی و استاندارد به تفکیک محصول'},
{id:'sensitive-stock',cadence:'weekly',title:'موجودی اقلام حساس و راکد',files:'موجودی و گردش اقلام حساس به همراه شمارش نمونه‌ای مستقل',purpose:'بررسی کسری، رکود و کمبود اقلام حیاتی'},
{id:'changes',cadence:'weekly',title:'ویرایش اسناد و تغییر اطلاعات پایه',files:'گزارش ویرایش و حذف اسناد و تغییر اطلاعات طرف حساب، در صورت دسترسی',purpose:'پیگیری تغییرات دورهٔ قبل و اصلاحات بدون توضیح'},
];
export function financePeriod(cadence:string,day:string){
 if(!['daily','weekly'].includes(cadence)||!/^\d{4}-\d{2}-\d{2}$/.test(day))throw new Error('تاریخ یا دوره معتبر نیست.');
 const date=new Date(day+'T12:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==day)throw new Error('تاریخ معتبر نیست.');
 if(cadence==='weekly')date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+1)%7));
 return date.toISOString().slice(0,10);
}
export function validFinanceReport(cadence:string,id:string){return id==='summary'||financeReports.some(r=>r.id===id&&r.cadence===cadence);}
export const MAX_FINANCE_BYTES=20*1024*1024;
export function validateFinanceFile(name:string,size:number){if(!name||name.length>240||/[\x00-\x1f]/.test(name)||!size||size>MAX_FINANCE_BYTES||! /\.(xlsx|xls|csv|pdf|png|jpg|jpeg|docx|zip)$/i.test(name))throw new Error('فایل Excel، CSV، PDF، تصویر، Word یا ZIP تا ۲۰ مگابایت انتخاب کنید.');}
export type FinanceFile={id:string;cadence:Cadence;period:string;report_id:string;filename:string;byte_size:number;sha256:string;uploaded_at:string;uploaded_by:string};
export type FinanceNote={id:string;cadence:Cadence;period:string;report_id:string;kind:'result'|'question'|'answer'|'closure';body:string;responsible:string;parent_id:string|null;created:string;created_by:string};
