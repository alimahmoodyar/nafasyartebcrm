import {salesFail as fail,sreq,stxt,sday,money} from './sales';
import {dayAt} from './duties';
import {latinDigits} from './persian-date';

export const salesBankModes=['terminal','import','archive_pos','reconcile','resolve_transfer','reverse','receiving_accounts'] as const;
export const MAX_SALES_BANK_BYTES=10*1024*1024;
export const isApprovedReceivingAccount=(a:any)=>['treasury_account','sales_receiving_account'].includes(a.type)&&a.data.state==='active'&&a.data.kind==='bank'&&a.data.currency==='IRR';
// Identifiers are strings: leading zeroes matter and punctuation is not interchangeable.
export const bankCode=(value:string)=>latinDigits(value).trim().toLowerCase().replace(/\s+/g,'');
const sameTransfer=(a:any,b:any)=>a.accountId===b.accountId&&a.amount===b.amount&&a.day===b.day;
export function transferPaymentFits(row:any,payment:any){
 const d=row.data,p=payment.data,reference=bankCode(p.reference||'');
 return payment.type==='sales_payment'&&p.method==='bank'&&!p.openingId&&sameTransfer(d,{...p,accountId:p.receivingAccountId})&&(!reference||reference===bankCode(d.reference||''));
}
export function normalizeBankRows(input:unknown,allowEmpty=false){
 if(!Array.isArray(input)||!allowEmpty&&!input.length||input.length>500)fail('فایل باید حداکثر ۵۰۰ ردیف بانکی داشته باشد. ثبت بدون تراکنش به بازهٔ تأییدشده نیاز دارد.');
 const seen=new Set<string>(),today=dayAt();
 return (input as any[]).map(raw=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('ردیف بانک معتبر نیست.');
  const bankId=sreq(raw.bankId,200),day=sday(raw.day);
  if(seen.has(bankId))fail('شناسه ردیف بانک در فایل تکرار شده است.',409);seen.add(bankId);
  if(day>today)fail('تاریخ وصول بانک در آینده نباشد.');
  if(!['in','out'].includes(raw.direction)||!['pos','transfer','other'].includes(raw.kind))fail('جهت و نوع واریز بانکی معتبر لازم است.');
  return {bankId,day,direction:raw.direction,amount:money(raw.amount,true),reference:stxt(raw.reference??'',300),terminalCode:stxt(raw.terminalCode??'',200),provider:stxt(raw.provider??'',200),kind:raw.kind,description:stxt(raw.description??'',1000)};
 });
}
export const bankRowIdentity=(d:any)=>JSON.stringify([d.bankId,d.day,d.direction,d.amount,d.reference,d.terminalCode,d.provider,d.kind,d.description]);
type BankCandidate={id:string;agentId:string;amount:string;day:string;reference:string;state:string;revision:number};
export function bankMatch(row:any,all:any[]){
 const d=row.data,candidates:BankCandidate[]=[];
 const answer=(status:string,reason:string,extra:{agentId?:string;paymentId?:string;terminalId?:string}={})=>({status,reason,candidates,...extra});
 if(d.status==='matched')return answer('matched','این ردیف به پرداخت وصول‌شده متصل است.',{agentId:d.agentId,paymentId:d.paymentId,terminalId:d.terminalId});
 if(d.status==='reversed')return answer('reversed','تأیید این ردیف برگشت خورده و دوباره خودکار تأیید نمی‌شود.');
 if(d.direction!=='in')return answer('ignored','برداشت بانک، وصول خریدار نیست.');
 if(!['pos','transfer'].includes(d.kind))return answer('unmatched','نوع واریز مشخص نیست؛ مالی باید بررسی کند.');
 if(!all.some(a=>a.id===d.accountId&&isApprovedReceivingAccount(a)))return answer('unmatched','حساب مقصد بانکی ریالی تأییدشده نیست.');
 const code=bankCode(d.reference||''),payments=all.filter(r=>r.type==='sales_payment'&&r.data.method==='bank'&&!r.data.openingId),agents=all.filter(r=>(r.type==='sales_agent'||r.type==='as_agent'&&r.data.domain==='home')&&r.data.active&&r.data.kind!=='referrer');
 const exact=payments.filter(p=>code&&bankCode(p.data.reference||'')===code&&p.data.amount===d.amount&&p.data.day===d.day&&p.data.receivingAccountId===d.accountId);
 const possible=d.kind==='transfer'?payments.filter(p=>p.data.state!=='rejected'&&transferPaymentFits(row,p)):exact;
 candidates.push(...possible.map(p=>({id:p.id,agentId:p.data.agentId,amount:p.data.amount,day:p.data.day,reference:p.data.reference,state:p.data.state,revision:p.revision})));
 // Two bank rows with the same identifying evidence cannot independently consume one claim.
 if(code&&all.some(r=>r.type==='sales_bank_row'&&r.id!==row.id&&r.data.accountId===d.accountId&&r.data.direction==='in'&&bankCode(r.data.reference||'')===code))return answer('ambiguous','چند ردیف بانک با همین شماره پیگیری در حساب مقصد وجود دارد؛ بررسی مالی لازم است.');
 if(exact.length>1)return answer('ambiguous','چند اعلام پرداخت با این اطلاعات وجود دارد.');
 if(code&&payments.some(p=>p.data.receivingAccountId===d.accountId&&bankCode(p.data.reference||'')===code&&!exact.some(x=>x.id===p.id)))return answer('ambiguous','این شماره پیگیری با مبلغ یا تاریخ دیگری در اعلام پرداخت وجود دارد؛ مالی باید بررسی کند.');
 if(exact.some(p=>p.data.bankRowId||p.data.state!=='pending'))return answer('ambiguous','این مشخصات قبلاً در پرداختی بررسی‌شده استفاده شده است؛ وصول جدید ثبت نشد.');
 if(d.kind==='transfer'){
  if(possible.length>1)return answer('ambiguous','چند اعلام واریز با حساب مقصد، مبلغ و تاریخ یکسان به این ردیف می‌خورند.');
  if(!possible.length)return answer('unmatched','اعلام واریز منطبق با حساب مقصد، مبلغ، تاریخ و شماره پیگیریِ ثبت‌شده پیدا نشد.');
  const p=possible[0];
  if(p.data.bankRowId||p.data.state!=='pending')return answer('ambiguous','اعلام پرداخت منطبق قبلاً بررسی شده است.');
  if(!bankCode(p.data.reference||'')){
   if(payments.some(other=>other.id!==p.id&&other.data.state==='pending'&&sameTransfer(d,{...other.data,accountId:other.data.receivingAccountId})))return answer('ambiguous','برای اعلام بدون شماره پیگیری، اعلام دیگری با همین حساب، مبلغ و تاریخ وجود دارد.');
   if(all.some(r=>r.type==='sales_bank_row'&&r.id!==row.id&&r.data.direction==='in'&&['transfer','pos'].includes(r.data.kind)&&sameTransfer(d,r.data)))return answer('ambiguous','برای این اعلام بدون شماره پیگیری، چند ردیف بانک با حساب، مبلغ و تاریخ یکسان وجود دارد.');
  }
  if(!agents.some(a=>a.id===p.data.agentId))return answer('unmatched','خریدار این اعلام پرداخت فعال نیست.');
  return answer('ready','اعلام پرداخت با گردش بانک به‌طور یکتا تطبیق دارد.',{agentId:p.data.agentId,paymentId:p.id});
 }
 if(!d.terminalCode||!d.provider)return answer('unmatched','کد ترمینال و شرکت ارائه‌دهنده پوز لازم است.');
 const terminals=all.filter(r=>r.type==='sales_bank_terminal'&&r.data.active&&r.data.accountId===d.accountId&&bankCode(r.data.terminalCode)===bankCode(d.terminalCode)&&bankCode(r.data.provider)===bankCode(d.provider)&&r.data.validFrom<=d.day&&(!r.data.validTo||r.data.validTo>=d.day));
 if(terminals.length!==1)return answer(terminals.length?'ambiguous':'unmatched',terminals.length?'مالکیت ترمینال در این تاریخ مبهم است.':'ترمینال در تاریخ وصول به خریداری متصل نیست.');
 const terminal=terminals[0],agentId=terminal.data.agentId;
 if(!agents.some(a=>a.id===agentId))return answer('unmatched','خریدار مالک این ترمینال فعال نیست.');
 if(exact.length&&exact[0].data.agentId!==agentId)return answer('ambiguous','صاحب اعلام پرداخت با صاحب پوز یکسان نیست.');
 // Legacy claims lack destination-account identity. Do not create a second credit over them.
 if(payments.some(p=>p.data.amount===d.amount&&p.data.day===d.day&&!p.data.receivingAccountId&&(code?bankCode(p.data.reference||'')===code:p.data.agentId===agentId)))return answer('ambiguous','اعلام پرداخت مشابه فاقد حساب مقصد وجود دارد؛ مالی ابتدا آن را تعیین تکلیف کند.');
 if(!code&&payments.some(p=>p.data.receivingAccountId===d.accountId&&p.data.agentId===agentId&&p.data.amount===d.amount&&p.data.day===d.day))return answer('ambiguous','واریز پوز بدون شماره پیگیری با اعلام پرداخت مشابه قابل تفکیک نیست.');
 return answer('ready',exact.length?'واریز پوز با اعلام پرداخت همین خریدار تطبیق دارد.':'وصول پوز متعلق به خریدار مشخص است.',{agentId,paymentId:exact[0]?.id||'',terminalId:terminal.id});
}

export function readyBankRowForPayment(payment:any,all:any[]){
 const ready=all.filter(row=>row.type==='sales_bank_row'&&row.data.status==='pending'&&row.data.direction==='in'&&transferPaymentFits(row,payment))
  .map(row=>({row,match:bankMatch(row,all)}))
  .filter(({match})=>match.status==='ready'&&match.paymentId===payment.id);
 return ready.length===1?ready[0]:undefined;
}

export function bankAmbiguities(rows:any[]){
 return rows.filter(row=>row.type==='sales_bank_row'&&row.data.status==='pending'&&row.data.kind==='transfer').flatMap(row=>{
  const assessment=bankMatch(row,rows);
  return assessment.status==='ambiguous'&&assessment.candidates.some(candidate=>candidate.state==='pending')?[{row,assessment}]:[];
 });
}
