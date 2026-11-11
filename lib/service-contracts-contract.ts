import type {ServiceField} from './after-sales-contract';
import type {Session} from './permissions';
export const serviceContractActions:Record<string,string>={register:'ثبت قرارداد نمایندگی خدمات',renew:'ثبت تمدید قرارداد',terminate:'ثبت قطع همکاری'};
const f=(key:string,label:string,type='text',extra:Partial<ServiceField>={}):ServiceField=>({key,label,type,...extra});
const term=[f('number','شماره قرارداد / الحاقیه'),f('startsOn','تاریخ شروع اعتبار','date'),f('endsOn','تاریخ پایان اعتبار','date'),f('reference','مرجع قرارداد / مدرک امضا','text',{optional:true}),f('notes','توضیح ثبت قرارداد','textarea')];
export const serviceContractForms:Record<string,ServiceField[]>={register:[f('agentId','نماینده خدمات خانگی','select',{source:'agents'}),...term],renew:term,terminate:[f('day','تاریخ قطع همکاری','date'),f('notes','دلیل و نتیجه تعیین تکلیف','textarea')]};
export function serviceContractRights(u:Session){
 const p=u.permissions,home=!!p.serviceDomains?.includes('home'),own=p.serviceAgentId||'',external=!!p.salesAgentId||!!p.hospitalCenterId||!!p.salesRoles?.includes('agent');
 return {expert:u.isAdmin||!external&&!own&&home&&!!p.serviceRoles?.some(r=>['support','coordinator'].includes(r)),read:u.isAdmin||!external&&home&&!!p.serviceRoles?.length,manage:u.isAdmin||!external&&!own&&home&&!!p.serviceRoles?.some(r=>['support','coordinator','manager'].includes(r)),ownAgent:own};
}
export function serviceContractStatus(c:any,today:string,warningStart:string){
 const daysRemaining=Math.round((Date.parse(c.data.endsOn+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);
 const state=c.data.state==='terminated'?'terminated':c.data.state==='renewed'?'renewed':today<c.data.startsOn?'not_started':daysRemaining<0?'expired':'active';
 return {state,daysRemaining,warningStart,warning:c.data.state==='active'&&today>=c.data.startsOn&&today>=warningStart,remainingText:daysRemaining<0?Math.abs(daysRemaining).toLocaleString('fa-IR')+' روز از پایان قرارداد گذشته':daysRemaining===0?'امروز آخرین روز اعتبار قرارداد است':daysRemaining.toLocaleString('fa-IR')+' روز تا پایان قرارداد'};
}
export const serviceContractHelp='Home service expert records/renews representation contracts and determines termination. Representatives read only their own contract. One persistent warning per contract and assignee starts one Persian calendar month before expiry, remains open after expiry, and updates its countdown without creating another warning. Only a recorded renewal extending the end date, or recorded termination, closes all copies atomically. Company/tester identity remains audited; contract dates, numbers and evidence must come from the actual/test scenario, never invented.';
