import {normalizeIranIban,iranIbanError} from './iran-iban';
import {isIsoDay} from './persian-date';
import {AccessError} from './authorization';

export const payrollBankFormatPending='قالب دستور پرداخت و گزارش نتیجه بانک هنوز دریافت و پیکربندی نشده است.';
export function payrollPaidTotal(data:any){
 if(!Array.isArray(data.payments||[]))throw new AccessError('اطلاعات پرداخت نیازمند بررسی است.',409);
 return (data.payments||[]).reduce((n:bigint,p:any)=>{if(typeof p.amount!=='string'||!/^\d{1,18}$/.test(p.amount))throw new AccessError('مبلغ پرداخت نامعتبر است.',409);return n+BigInt(p.amount)},BigInt(0));
}
export function payrollPaymentList(slips:any[]){
 return slips.filter(r=>r.type==='hr_payroll'&&r.data.published&&['payable','partial'].includes(r.data.state)).map(r=>{
  const paid=payrollPaidTotal(r.data),remaining=BigInt(r.data.net)-paid,iban=normalizeIranIban(r.data.bankAccount||'');
  return {id:r.id,revision:r.revision,name:r.data.name||'پرسنل',amount:remaining>0?String(remaining):'0',iban,error:remaining<0?'پرداخت بیشتر از خالص ثبت شده است.':iranIbanError(iban,true)||'',periodId:r.data.periodId};
 });
}
export type PayrollBankRow={transactionId:string;accountId:string;beneficiaryIban:string;amount:string;day:string;status:'success'|'pending'|'failed'|'reversed'};
/** Normalized adapter contract only. These rows are NOT accepted as proof from
 * a browser/MCP caller. The bank-specific parser and evidence provenance await
 * the owner's actual export. No payment or accounting write occurs here. */
export function previewPayrollBankMatch(slips:any[],transactions:PayrollBankRow[],priorKeys:string[]=[]){
 const payments=payrollPaymentList(slips),seen=new Set(priorKeys),used=new Map<string,bigint>(),matches:any[]=[],exceptions:any[]=[];
 for(const row of transactions){
  const key=row.accountId+':'+row.transactionId;
  if(!row.accountId||!row.transactionId||!/^\d{1,18}$/.test(row.amount)||BigInt(row.amount)<=0||!isIsoDay(row.day)){exceptions.push({key,reason:'اطلاعات تراکنش ناقص یا نامعتبر است.'});continue;}
  if(seen.has(key)){exceptions.push({key,reason:'تراکنش تکراری است.'});continue;}seen.add(key);
  if(row.status!=='success'){exceptions.push({key,reason:row.status==='reversed'?'تراکنش برگشتی؛ نیازمند ثبت اصلاح مستقل است.':'پرداخت موفق قطعی نیست.'});continue;}
  const iban=normalizeIranIban(row.beneficiaryIban);if(iranIbanError(iban,true)){exceptions.push({key,reason:'شبای مقصد معتبر نیست.'});continue;}
  const candidates=payments.filter(p=>!p.error&&p.iban===iban&&BigInt(p.amount)-(used.get(p.id)||BigInt(0))>=BigInt(row.amount));
  if(candidates.length!==1){exceptions.push({key,reason:candidates.length?'چند فیش سازگار وجود دارد؛ تخصیص نیازمند بررسی است.':'فیش یا مانده سازگار پیدا نشد.'});continue;}
  const slip=candidates[0],sum=(used.get(slip.id)||BigInt(0))+BigInt(row.amount);used.set(slip.id,sum);matches.push({key,slipId:slip.id,slipRevision:slip.revision,transactionId:row.transactionId,accountId:row.accountId,iban,amount:row.amount,day:row.day,remaining:String(BigInt(slip.amount)-sum),partial:sum<BigInt(slip.amount)});
 }
 return {matches,exceptions,committed:false};
}
