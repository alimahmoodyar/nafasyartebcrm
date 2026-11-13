import {accessPermissions} from './permissions';
import type {Session} from './permissions';

export const shortageStages = {
 line: 'پیگیری کسری توسط انبار خط',
 production: 'تعیین تکلیف کسری توسط مسئول خط تولید',
 parts: 'شمارش و دریافت قطعات برگشتی',
 finance: 'بررسی مفقودی توسط مدیر مالی',
 ceo: 'تأیید نهایی مفقودی توسط مدیرعامل',
 recovered: 'قطعات برگشت داده شدند',
 lost: 'مفقودی تأیید شد',
} as const;
export type ShortageStage = keyof typeof shortageStages;
export const shortageActions = {
 resend: ['line', 'ارسال مجدد دستگاه'],
 escalate_shortage: ['line', 'ارجاع کسری به مسئول خط تولید'],
 found_device: ['production', 'دستگاه پیدا شد'],
 propose_parts: ['production', 'تأیید اولیهٔ قطعات برگشتی'],
 report_loss: ['production', 'ارجاع مفقودی به مدیر مالی'],
 confirm_parts: ['parts', 'تأیید شمارش و دریافت قطعات'],
 return_parts: ['parts', 'برگشت مغایرت شمارش به مسئول خط'],
 review_loss: ['finance', 'ثبت بررسی مالی و ارجاع به مدیرعامل'],
 approve_loss: ['ceo', 'تأیید نهایی مفقودی'],
 return_loss: ['ceo', 'بازگشت برای بررسی مالی'],
} as const;
export type ShortageAction = keyof typeof shortageActions;
export type Shortage = {stage:ShortageStage;notes:string;at:string;by:string;parts?:{batchId:string;quantity:number}[]};
export function shortageRoles(u:Session){
 const p=accessPermissions(u.permissions),profile=u.profileReview?.id;
 if(!u.isAdmin&&(p.salesAgentId||p.serviceAgentId||p.hospitalCenterId||p.salesRoles?.includes('agent')||p.serviceRoles?.includes('agent')||p.qmsRoles?.includes('observer')))return {line:false,production:false,finance:false,ceo:false};
 return {
  line:u.isAdmin||(profile?profile==='line-store':!!p.flowRoles?.includes('inventory')&&!!p.warehouses?.includes('line')),
  production:u.isAdmin||(profile?profile==='line-manager':!!p.flowRoles?.includes('production')),
  finance:u.isAdmin||(profile?profile==='finance-director':!!p.supplyRoles?.includes('finance')),
  ceo:u.isAdmin||(profile?profile==='ceo':!!p.supplyRoles?.includes('ceo')),
 };
}
export function canActOnShortage(roles:ReturnType<typeof shortageRoles>,stage:ShortageStage){
 return stage==='parts'?roles.line:stage==='line'||stage==='production'||stage==='finance'||stage==='ceo'?roles[stage]:false;
}
export function handoffHasOpenWork(pending:string[], shortages:Record<string,Shortage>){
 return pending.length>0||Object.values(shortages).some(s=>s.stage!=='lost'&&s.stage!=='recovered');
}
