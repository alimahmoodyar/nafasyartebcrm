import {costRead,costWrite} from './costing';
export function routineRoles(u:any){const p=u.permissions,read=!p.salesAgentId&&!p.serviceAgentId&&!p.hospitalCenterId,manager=read&&(u.isAdmin||p.supplyRoles?.includes('ceo')),foreman=read&&(manager||p.flowRoles?.includes('production')),engineering=read&&(manager||p.supplyRoles?.includes('engineering')),quality=read&&(manager||p.flowRoles?.includes('qc'));
 return {read,manager:!!manager,foreman:!!foreman,engineering:!!engineering,quality:!!quality,finance:costWrite(u),financial:costRead(u),staff:!!(foreman||engineering||quality||costRead(u))};}
export function targetFor(j:any){const p=j.policy,s=j.step,span=j.end-j.start,rest=s.allowancesIncluded?0:(j.restMinutes??p.restMinutes??0),setup=j.setupMinutes??p.setupMinutes??0;
 const useful=Math.max(0,span-j.leaveMinutes-j.downtimeMinutes-rest-setup)*(p.efficiencyPercent??100)/100;
 const standard=Math.floor(useful*60/s.seconds),lower=Math.floor(standard*(p.lowerPercent??100)/100),upper=Math.floor(standard*(p.upperPercent??100)/100);
 const provisional=j.rework===true||(!s.allowancesIncluded&&(j.restMinutes??p.restMinutes)==null)||(j.setupMinutes??p.setupMinutes)===null||p.efficiencyPercent===null||p.lowerPercent===null||p.upperPercent===null||s.allowancesIncluded===null;
 const regular=j.outputs.filter((x:any)=>!x.overtime).reduce((n:number,x:any)=>n+x.good,0),overtime=j.outputs.filter((x:any)=>x.overtime).reduce((n:number,x:any)=>n+x.good,0);
 const target=Math.min(standard,j.assigned),low=Math.min(lower,j.assigned),high=Math.min(upper,j.assigned);
 return {usefulMinutes:useful,standard,target,lower:low,upper:high,provisional,regular,overtime,shortfall:Math.max(0,low-regular),attainment:target?Math.round(regular/target*1000)/10:null};}
export const routineHelp=[
 'مهندسی برای هر قطعه واسط، نسخه مسیر ساخت و زمان هر عملیات را ثبت می‌کند. BOM هر مرحله جداست. تغییر مسیر فقط بر بچ‌های جدید اثر دارد.',
 'سرکارگر دارای نقش تولید، بازه کار روزانه و تعداد تخصیص را تعیین می‌کند. استراحت، آماده‌سازی، ضریب زمان مفید و بازه هدف قابل تنظیم‌اند؛ مقدار تعیین‌نشده هدف را موقت می‌کند. استراحت منظورشده در استاندارد دوباره کسر نمی‌شود.',
 'خروجی سالم، ضایعات، دوباره‌کاری و کار باقی‌مانده جدا هستند. تأیید عملیات میانی فقط موجودی در جریان ساخت را جابه‌جا می‌کند. تنها خروجی آخرین مرحله پس از تأیید کیفیت به انبار نیمه‌ساخته (۳۵۱) اضافه می‌شود. انباردار از «انبارها و موجودی» مقدار لازم را به خط تولید منتقل می‌کند؛ این انتقال مصرف نیست.',
 'مواد از موجودی خط کسر می‌شوند؛ انتقال انبار به خط از گردش مواد موجود انجام می‌شود و مصرف نیست. مصرف پیشنهادی BOM را با مصرف واقعی تطبیق دهید؛ مغایرت دلیل می‌خواهد. دوباره‌کاری مصرف استاندارد تکراری ندارد و مواد اضافی آن جدا ثبت می‌شود.',
 'نتیجه عادی و اضافه‌کاری جدا هستند. کسری هدف با دلیل و بررسی سرکارگر ثبت می‌شود؛ هیچ کسر حقوق، تغییر مزایا یا دستور کار بدون مزد از این بخش صادر نمی‌شود.',
 'بستن روز، زمان واقعی و تصویر ثابت هدف را حفظ می‌کند. تغییر بعدی سیاست، گزارش بسته‌شده را بازنویسی نمی‌کند. برای کار باقی‌مانده روز بعد تخصیص جدید بسازید.',
 'پس از تعیین تکلیف تمام قطعات و بستن کارها، مالی نرخ زمان واقعی و سربار مستند را تأیید می‌کند. هزینه مواد، دستمزد و سربار یک بار به بچ واسط منتقل می‌شود؛ هنگام مصرف در دستگاه، اجزای آن دوباره در BOM دستگاه وارد نشوند.'
];
