import {AccessError} from './authorization';
import {money,sreq,stxt} from './sales';
import {progressivePayrollTax} from './personnel-payroll-engine';
const fail=(message:string,status=400):never=>{throw new AccessError(message,status)};
const amount=(v:unknown)=>BigInt(money(v));

export function payrollSlipEditable(slip:any,rows:any[]){
 const d=slip?.data,period=rows.find(r=>r.id===d?.periodId&&r.type==='hr_period');
 return slip?.type==='hr_payroll'&&d.engine==='contract-v2'&&['review','approved','rejected'].includes(d.state)&&period&&period.data.state!=='closed'&&!(d.payments||[]).length&&!(d.pendingPayments||[]).length;
}

export function editPayrollSlip(body:any,slip:any,rows:any[],actor:any,now:string){
 if(!['payroll','approver','finance'].some(r=>actor.has(r)))fail('اصلاح فیش فقط برای مسئول مجاز حقوق یا مالی است.',403);
 if(slip?.data.memberId===actor.id)fail('اصلاح فیش خودتان باید توسط مسئول مالی دیگر انجام شود.',403);
 if(!payrollSlipEditable(slip,rows))fail('فیش قطعی مالی، پرداخت‌شده یا دوره بسته، اصلاح مستقیم ندارد؛ تعدیل دوره باز لازم است.',409);
 const d=slip.data,reason=sreq(body.notes,4000),original=d.calculationBasis||{components:d.components,insurance:d.insurance,tax:d.tax,loanDeductions:d.loanDeductions,net:d.net,gross:d.gross};
 if(!Array.isArray(body.lines)||!body.lines.length||body.lines.length>50)fail('ریز اقلام معتبر لازم است.');
 const keys=new Set<string>();
 const components=body.lines.map((line:any)=>{
  const key=sreq(line.key,120);if(keys.has(key))fail('ردیف تکراری است.');keys.add(key);
  const previous=d.components.find((x:any)=>x.key===key);
  if(!previous&&!key.startsWith('manual:'))fail('ردیف ناشناخته است.');
  if(typeof line.insured!=='boolean'||typeof line.taxable!=='boolean')fail('وضعیت بیمه و مالیات هر قلم باید مشخص باشد.');
  let value=amount(line.amount);let input:any;
  if(line.minutes!==undefined||line.hourlyRate!==undefined){
   if(!Number.isSafeInteger(line.minutes)||line.minutes<0||line.minutes>1000000||line.hourlyRate===undefined)fail('دقیقه و نرخ ساعتی معتبر لازم است.');
   const rate=amount(line.hourlyRate),computed=(BigInt(line.minutes)*rate+BigInt(30))/BigInt(60);
   // The server derives this amount; browser totals never override it.
   value=computed;input={minutes:line.minutes,hourlyRate:String(rate)};
  }
  return {key,title:sreq(line.title||previous?.title,160),amount:String(value),insured:line.insured,taxable:line.taxable,sources:previous?.sources||[],override:{reason:stxt(line.reason||'',1000),...input}};
 });
 // Removing a source component must be explicit (set it to zero), not an
 // accidental omission from a client-side form or stale UI.
 if(d.components.some((x:any)=>!keys.has(x.key)))fail('همه اقلام اصلی باید در اصلاح حضور داشته باشند؛ مبلغ حذف‌شده را صریح صفر کنید.');
 const loanDeductions=body.loanDeductions??d.loanDeductions??[];
 if(!Array.isArray(loanDeductions)||loanDeductions.length>100)fail('اقساط معتبر نیست.');
 const loanIds=new Set<string>();
 const loans=loanDeductions.map((l:any)=>{
  if(loanIds.has(l.id))fail('قسط تکراری است.');loanIds.add(l.id);
  const prior=(d.loanDeductions||[]).find((x:any)=>x.id===l.id),loan=rows.find(r=>r.id===l.id&&r.type==='hr_request'&&r.data.memberId===d.memberId&&['loan','advance'].includes(r.data.kind)&&r.data.state==='paid');
  if(!prior||!loan)fail('قسط باید از وام یا مساعده پرداخت‌شده همین فرد باشد.');
  const value=amount(l.amount),remaining=amount(loan.data.amount)-amount(loan.data.recovered||'0');if(value>remaining)fail('قسط از مانده واقعی بیشتر است.');return {...prior,amount:String(value),revision:loan.revision};
 });
 if((d.loanDeductions||[]).some((l:any)=>!loanIds.has(l.id)))fail('کسر قسط را برای توقف صریح صفر کنید؛ ردیف آن حذف نشود.');
 const p=d.policy.data,gross=components.reduce((n:any,x:any)=>n+BigInt(x.amount),BigInt(0));
 const insuredGross=components.filter((x:any)=>x.insured).reduce((n:any,x:any)=>n+BigInt(x.amount),BigInt(0)),cap=amount(d.insuranceCap||d.insuranceBase||'0'),insuredBase=insuredGross<cap?insuredGross:cap;
 const autoInsurance=(insuredBase*BigInt(p.insuranceBps)+BigInt(5000))/BigInt(10000),insurance=body.insuranceOverride===undefined?autoInsurance:amount(body.insuranceOverride);
 const taxableGross=components.filter((x:any)=>x.taxable).reduce((n:any,x:any)=>n+BigInt(x.amount),BigInt(0)),taxable=taxableGross-insurance*BigInt(p.taxInsuranceDeductionBps)/BigInt(10000),autoTax=progressivePayrollTax(taxable,p),tax=body.taxOverride===undefined?autoTax:amount(body.taxOverride);
 const other=body.otherDeduction===undefined?amount(d.adjustmentDeduction||'0'):amount(body.otherDeduction),loanTotal=loans.reduce((n:any,x:any)=>n+BigInt(x.amount),BigInt(0)),net=gross-insurance-tax-other-loanTotal;
 if(net<0||net>BigInt('999999999999999999'))fail('خالص حقوق معتبر نیست؛ کسورات و اقلام را بررسی کنید.');
 const fileIds=body.fileIds||[];if(!Array.isArray(fileIds)||fileIds.length>10||new Set(fileIds).size!==fileIds.length||fileIds.some((id:string)=>!rows.some(r=>r.id===id&&r.type==='hr_file'&&r.data.caseId===slip.id&&r.data.category==='payroll_correction')))fail('پیوست اصلاح باید متعلق به همین فیش باشد.');
 if(d.missionAmountStatus==='pending_policy'&&body.missionReviewed!==true)fail('مبلغ نامعلوم مأموریت باید صریح با دلیل تعیین شود؛ صفر به‌طور ضمنی پذیرفته نمی‌شود.');
 const previous={components:d.components,insurance:d.insurance,tax:d.tax,loanDeductions:d.loanDeductions,otherDeduction:d.adjustmentDeduction,net:d.net,gross:d.gross,state:d.state};
 const edits=d.slipEdits||[];if(edits.length>=100)fail('سقف اصلاح این فیش پر شده است.');
 return {...slip,data:{...d,calculationBasis:original,components,base:components.find((x:any)=>x.key==='base')?.amount||'0',insuranceBase:String(insuredBase),insurance:String(insurance),taxable:String(taxable>0?taxable:0),tax:String(tax),employerInsurance:String((insuredBase*BigInt(p.employerBps)+BigInt(5000))/BigInt(10000)),unemployment:String((insuredBase*BigInt(p.unemploymentBps)+BigInt(5000))/BigInt(10000)),loanDeductions:loans,adjustmentDeduction:String(other),gross:String(gross),net:String(net),missionAmountStatus:d.missions?.length?'manual_documented':d.missionAmountStatus,state:'review',published:false,approvedBy:'',approvedAt:'',paymentApprovedBy:'',createdBy:actor.userId,lastEditedBy:actor.userId,slipEdits:[...edits,{id:body.id,at:now,actor:actor.userId,reason,fileIds,before:previous,after:{components,insurance:String(insurance),tax:String(tax),loanDeductions:loans,otherDeduction:String(other),gross:String(gross),net:String(net)},automatic:{insurance:String(autoInsurance),tax:String(autoTax)}}]}};
}
