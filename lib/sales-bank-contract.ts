import {salesFail as fail,sreq,stxt,sday,money} from './sales';
import {dayAt} from './duties';

export const salesBankModes=['terminal','import','reconcile','reverse'] as const;
export const MAX_SALES_BANK_BYTES=10*1024*1024;
// Identifiers are strings: leading zeroes matter and punctuation is not interchangeable.
export const bankCode=(value:string)=>value.trim().toLowerCase().replace(/\s+/g,'');
export function normalizeBankRows(input:unknown){
 if(!Array.isArray(input)||!input.length||input.length>500)fail('فایل باید بین ۱ تا ۵۰۰ ردیف بانکی داشته باشد؛ فایل بزرگ‌تر را به بازه‌های کوچک‌تر تقسیم کنید.');
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
export function bankMatch(row:any,all:any[]){
 const d=row.data,candidates:any[]=[];
 const answer=(status:string,reason:string,extra:any={})=>({status,reason,candidates,...extra});
 if(d.status==='matched')return answer('matched','این ردیف به پرداخت وصول‌شده متصل است.',{agentId:d.agentId,paymentId:d.paymentId,terminalId:d.terminalId});
 if(d.status==='reversed')return answer('reversed','تأیید این ردیف برگشت خورده و دوباره خودکار تأیید نمی‌شود.');
 if(d.direction!=='in')return answer('ignored','برداشت بانک، وصول خریدار نیست.');
 if(!['pos','transfer'].includes(d.kind))return answer('unmatched','نوع واریز مشخص نیست؛ مالی باید بررسی کند.');
 if(!all.some(a=>a.id===d.accountId&&a.type==='treasury_account'&&a.data.state==='active'&&a.data.kind==='bank'&&a.data.currency==='IRR'))return answer('unmatched','حساب مقصد بانکی ریالی تأییدشده نیست.');
 const code=bankCode(d.reference||''),payments=all.filter(r=>r.type==='sales_payment'&&r.data.method==='bank'&&!r.data.openingId),agents=all.filter(r=>r.type==='sales_agent'&&r.data.active&&r.data.kind!=='referrer');
 const exact=payments.filter(p=>code&&bankCode(p.data.reference||'')===code&&p.data.amount===d.amount&&p.data.day===d.day&&p.data.receivingAccountId===d.accountId);
 candidates.push(...exact.map(p=>({id:p.id,agentId:p.data.agentId,amount:p.data.amount,day:p.data.day,reference:p.data.reference,state:p.data.state})));
 // Two bank rows with the same identifying evidence cannot independently consume one claim.
 if(code&&all.some(r=>r.type==='sales_bank_row'&&r.id!==row.id&&r.data.accountId===d.accountId&&r.data.direction==='in'&&bankCode(r.data.reference||'')===code))return answer('ambiguous','چند ردیف بانک با همین شماره پیگیری در حساب مقصد وجود دارد؛ بررسی مالی لازم است.');
 if(exact.length>1)return answer('ambiguous','چند اعلام پرداخت با این اطلاعات وجود دارد.');
 if(code&&payments.some(p=>p.data.receivingAccountId===d.accountId&&bankCode(p.data.reference||'')===code&&!exact.some(x=>x.id===p.id)))return answer('ambiguous','این شماره پیگیری با مبلغ یا تاریخ دیگری در اعلام پرداخت وجود دارد؛ مالی باید بررسی کند.');
 if(exact.some(p=>p.data.bankRowId||p.data.state!=='pending'))return answer('ambiguous','این مشخصات قبلاً در پرداختی بررسی‌شده استفاده شده است؛ وصول جدید ثبت نشد.');
 if(d.kind==='transfer'){
  if(!code)return answer('unmatched','شماره پیگیری بانک لازم است؛ مبلغ به‌تنهایی کافی نیست.');
  if(exact.length!==1)return answer('unmatched','اعلام پرداخت یکتا با حساب مقصد، مبلغ، تاریخ و شماره پیگیری منطبق پیدا نشد.');
  const p=exact[0];if(!agents.some(a=>a.id===p.data.agentId))return answer('unmatched','خریدار این اعلام پرداخت فعال نیست.');
  if(!p.data.fileId)return answer('unmatched','اعلام پرداخت فاقد مدرک است.');
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
