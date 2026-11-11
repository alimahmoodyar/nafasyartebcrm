import type {Session} from './permissions';
import type {ServiceField} from './after-sales-contract';

export const serviceCommercialActions:Record<string,string>={credit_propose:'پیشنهاد حد اعتبار نماینده',credit_decide:'بررسی حد اعتبار',part_price_propose:'پیشنهاد قیمت قطعه',part_price_decide:'بررسی مالی قیمت قطعه',work_define:'تعریف کار و زمان‌سنجی',labor_publish:'تعیین فی دقیقه و ضریب اجرت'};
const f=(key:string,label:string,type='text',extra:Partial<ServiceField>={}):ServiceField=>({key,label,type,...extra});
export const serviceCommercialForms:Record<string,ServiceField[]>={
 credit_propose:[f('agentId','نماینده خدمات خانگی','select',{source:'agents'}),f('limitRial','حد اعتبار پیشنهادی (ریال)','money'),f('notes','دلیل پیشنهاد','textarea')],
 credit_decide:[f('approved','حد اعتبار تأیید شود','boolean'),f('notes','دلیل تصمیم','textarea')],
 part_price_propose:[f('partCode','کالای انبار مرکزی','select',{source:'materials'}),f('priceRial','قیمت فروش قطعه به نماینده (ریال)','money',{optional:true}),f('consumerPriceRial','قیمت قطعه در فاکتور مشتری (ریال)','money',{optional:true}),f('validFrom','شروع اعتبار','date'),f('notes','توضیح قیمت‌گذاری','textarea')],
 part_price_decide:[f('approved','قیمت‌ها تأیید شوند','boolean'),f('notes','دلیل تصمیم مالی','textarea')],
 work_define:[f('name','عنوان کار / خدمت'),f('minutes','زمان استاندارد انجام کار (دقیقه)','quantity'),f('active','کار فعال است','boolean'),f('notes','شرح زمان‌سنجی','textarea')],
 labor_publish:[f('ratePerMinuteRial','فی هر دقیقه برای اجرت نماینده (ریال)','money'),f('customerMultiplier','ضریب اجرت مشتری نسبت به نماینده','quantity'),f('notes','توضیح مصوبه مدیرعامل','textarea')]
};
export function serviceCommercialPermissions(u:Session){
 const p=u.permissions,internal=!p.salesAgentId&&!p.serviceAgentId&&!p.hospitalCenterId&&!p.salesRoles?.includes('agent')&&!p.serviceRoles?.includes('agent');
 const home=internal&&!!p.serviceDomains?.includes('home'),manager=home&&!!p.serviceRoles?.includes('manager');
 return {manager:u.isAdmin||manager,expert:u.isAdmin||home&&!!p.serviceRoles?.some(r=>['support','coordinator'].includes(r)),finance:u.isAdmin||internal&&!!p.treasuryWorkflowRoles?.includes('manager'),ceo:u.isAdmin||internal&&!!p.supplyRoles?.includes('ceo')};
}
export function calculatedLabor(minutes:number,rate:string,multiplier:number){
 const base=(BigInt(minutes)*BigInt(rate)+BigInt(999))/BigInt(1000),customer=(base*BigInt(multiplier)+BigInt(999))/BigInt(1000);
 if(base>BigInt(999999999999999999)||customer>BigInt(999999999999999999))throw Error('مبلغ محاسبه‌شده بیش از محدوده مجاز است.');
 return {priceRial:base.toString(),consumerPriceRial:customer.toString()};
}
export function currentServiceLabor(tariffs:any[],day:string,domain:string){
 const chosen=new Map<string,any>();
 for(const t of tariffs){const d=t.data;if(d.domain!==domain||d.kind!=='labor'||!d.active||d.validFrom>day||!d.workId||!d.formula)continue;const old=chosen.get(d.workId);if(!old||[d.validFrom,t.created,t.id].join('|')>[old.data.validFrom,old.created,old.id].join('|'))chosen.set(d.workId,t);}
 return [...chosen.values()];
}
export function serviceCreditExposure(rows:any[]){const net=rows.reduce((n:bigint,r:any)=>n+BigInt(r.debit||0)-BigInt(r.credit||0),BigInt(0));return net>BigInt(0)?net:BigInt(0);}
export const serviceCommercialHelp={credit:'Home support/coordinator proposes representative credit; home service manager approves. Only approved limits apply; new part orders cannot exceed outstanding net service debt plus the order. No approved limit means no credit purchase.',parts:'Home service manager proposes catalog part prices. Finance director approves/rejects. Proposals never publish immediately. Existing estimates/invoices retain their snapshots.',labor:'Home service manager defines each work name and standard minutes. CEO sets IRR per minute and customer multiplier. Publishing calculates all active work rates and creates immutable tariff versions. No finance approval of work timing or derived labor rates. Representative labor = minutes × rate; customer labor = representative labor × multiplier. Warranty customer charge is zero.',actors:'The authenticated tester remains the real actor. Self-approval is blocked in company data except authenticated administrator profile-review oversight (actual administrator remains the actor); isolated training permits role-to-role testing and records both actual tester and tested role.'};
