import {presets,allPermissions,type Session,type Permissions} from './permissions';
const extra:Record<string,Permissions>={
 'مدیر سامانه':allPermissions,
 'مدیر خدمات پس از فروش':{read:[],write:[],eventStages:[],serviceRoles:['manager'],serviceDomains:['home','hospital']},
 ...Object.fromEntries([['sales','برنامه‌ریز فروش'],['ceo','مدیرعامل تأمین'],['engineering','مهندس محصول'],['inventory','کنترل موجودی تأمین'],['finance','کنترل مالی تأمین'],['domestic','کارشناس خرید داخلی'],['foreign','کارشناس خرید خارجی']].map(([role,name])=>[name,{read:[],write:[],eventStages:[],supplyRoles:[role]}])),
 ...Object.fromEntries([['intake','پذیرش خدمات'],['technician','تکنسین خدمات'],['coordinator','هماهنگ‌کننده خدمات'],['inventory','انبار خدمات'],['logistics','ارسال خدمات'],['finance','مالی خدمات']].map(([role,name])=>[name,{read:[],write:[],eventStages:[],serviceRoles:[role],serviceDomains:['home','hospital']}]))
};
export const trainingRoles=Object.entries({...presets,...extra}).filter(([name])=>name!=='سفارشی').map(([name,permissions],i)=>{
 const id='role-'+i,p=JSON.parse(JSON.stringify(permissions)) as Permissions;
 if(name==='انبار')p.warehouses=['raw','line','quarantine','nonconforming','finished'];
 if(name==='نماینده فروش')p.salesAgentId='training-sales-agent-1';
 if(name==='نماینده خدمات')p.serviceAgentId='training-service-agent-1';
 return {id,name,memberId:'training-'+id,session:{userId:'local:training-'+id,email:id+'@training.invalid',name:name+' — آزمایشی',isAdmin:name==='مدیر سامانه',permissions:p} as Session};
});
export const trainingScenarios=[
 {title:'ورود مواد و کنترل کیفیت',steps:['با نقش انبار، در گردش مواد، ورود کالا برای کالای ۱ ثبت کنید.','با نقش کنترل کیفیت، محموله منتظر بررسی را در کارتابل گردش مواد باز کنید؛ معیار ظاهر را تأیید و تعداد قبول/رد را ثبت کنید.','با نقش انبار، محموله تأییدشده را در محل خالی مثل A-9-1-1 جانمایی کنید. موجودی قرنطینه و مواد را مقایسه کنید.']},
 {title:'درخواست مواد و تولید',steps:['با نقش تولید درخواست مواد بدهید؛ با نقش انبار برداشت پیشنهادی را تحویل دهید.','برنامه تولید برای محصول نمونه ۱ بسازید؛ BOM و فرم کیفیت از قبل تعریف شده‌اند.','تخصیص مونتاژ، آماده‌سازی، ساخت، کنترل نهایی و رسید محصول را به ترتیب با نقش مسئول انجام دهید.']},
 {title:'تأمین و استعلام',steps:['برنامه‌ریز فروش برنامه نیاز را ثبت کند؛ مدیرعامل، مهندس و کنترل موجودی مراحل خود را انجام دهند.','کارشناس خرید داخلی/خارجی از تأمین‌کنندگان فرضی مرتبط استعلام ثبت کند؛ کنترل مالی تأمین پیشنهادها را بررسی کند.']},
 {title:'فروش، پرداخت و ارسال',steps:['نماینده فروش سفارش ثبت کند؛ کارشناس یا مدیر فروش بررسی کند.','نماینده رسید پرداخت فرضی ثبت کند؛ مالی فروش آن را تأیید و تخصیص دهد.','انبار و تدارکات مسیر تحویل را انجام دهند؛ نماینده مانده، سررسید و وضعیت سفارش را ببیند.']},
 {title:'خدمات و گارانتی',steps:['پذیرش خدمات برای دستگاه نمونه پرونده باز کند.','مدیر خدمات مسئول تعمیر را تعیین کند؛ تکنسین تشخیص و قطعات را ثبت کند.','انبار خدمات و مالی خدمات مراحل مربوط را انجام دهند؛ نماینده خدمات فقط پرونده‌های خود را ببیند.']},
 {title:'کارتابل و اعلان',steps:['پس از هر عملیات به نقش بعدی بروید و تازه‌سازی کنید. کارتابل بخش تخصصی و کارتابل عمومی را بررسی کنید.','برای اعلان قابل‌خواندن و نتیجه تأیید/رد، صندوق پیام و شرح وظیفه آزمایشی را هم بررسی کنید.','شماره پرونده، نقش، نتیجه مورد انتظار و نتیجه واقعی را در درخواست‌های توسعه ثبت کنید.']}
];
