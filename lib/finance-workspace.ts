import type {Session} from './permissions';
// Navigation grouping only. Domain authorization remains in each existing handler.
export const financeStandaloneSections=['treasury','guarantees','sales-bank','costing','pricing','finance-control','assets'] as const;
export const financeEntries=[['treasury','خزانه‌داری'],['guarantees','ضمانت‌نامه‌ها'],['sales-bank','دریافت‌های فروش و تطبیق بانکی'],['purchase-review','کارتابل مالی خرید و بودجه'],['payables','بدهی و پرداخت خرید'],['settlements','تسویه خرید و هزینه واقعی'],['expenses','ثبت و تشخیص هزینه'],['costing','بهای تمام‌شده و دوره‌های مالی'],['pricing','قیمت‌گذاری و سود'],['finance-control','کنترل و گزارش‌های مالی'],['assets','اموال شرکت'],['payroll','حقوق و پرداخت پرسنلی'],['advances','مساعده‌ها و تسهیلات پرسنلی'],['bridge','اتصال حسابداری']] as const;
export function financeTarget(section:string,target=''){return 'finance:'+(section==='finance-control'&&target.startsWith('sourcing:')?'purchase-review':section)+':'+encodeURIComponent(target);}
export function parseFinanceTarget(target=''){
 const match=/^finance:([^:]+):(.*)$/.exec(target);if(!match||!financeEntries.some(([key])=>key===match[1]))return null;
 try{return {key:match[1],target:decodeURIComponent(match[2])}}catch{return null}
}
export function financeHomeApps<T extends {key:string}>(apps:T[],user:Session):T[]{return user.isAdmin?apps.filter(app=>!financeStandaloneSections.includes(app.key as any)):apps;}
export function financeHomeAliases(user:Session){return user.isAdmin?Object.fromEntries(financeStandaloneSections.map(key=>[key,'finance'])):{}}
