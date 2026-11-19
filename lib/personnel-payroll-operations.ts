import {AccessError} from './authorization';
import {sday,sreq,stxt} from './sales';
import {dayAt,addDay} from './duties';
import {normalizedPayrollPolicy,computeContractPayroll} from './personnel-payroll-engine';
import {contractPayrollFacts} from './personnel-payroll-facts';
import {normalizeContractSalary,validContractSalary,contractSalaryBases} from './personnel-contract-salary';
import {editPayrollSlip,payrollSlipEditable} from './personnel-payroll-edit';
import {unresolvedMissionFacts} from './personnel-payroll-missions';
export const payrollModes=['payroll_policy','salary_amend','payroll_prepare','payroll_work_accept','payroll_calculate','payroll_finalize','payroll_edit','payroll_recalculate'] as const;
const fail=(m:string,s=400):never=>{throw new AccessError(m,s)};

export function payrollWorkBasis(rows:any[],memberId:string,start:string,end:string){
 const relevant=rows.filter(r=>r.type==='hr_employee'&&r.data.memberId===memberId||r.type==='hr_punch'&&r.data.memberId===memberId&&r.data.day>=start&&r.data.day<=end||['hr_assignment','hr_request'].includes(r.type)&&r.data.memberId===memberId&&(r.data.start<=end&&r.data.end>=start||r.data.kind==='family'&&r.data.effective<=end)||r.type==='staff_mission'&&r.data.memberIds?.includes(memberId));
 const shifts=new Set(relevant.filter(r=>r.type==='hr_assignment').map(r=>r.data.shiftId));
 return [...relevant,...rows.filter(r=>r.type==='hr_shift'&&shifts.has(r.id))].map(r=>({id:r.id,revision:r.revision})).sort((a,b)=>a.id.localeCompare(b.id));
}
export function payrollCalculationBasis(rows:any[],memberId:string,start:string,end:string){const basis=payrollWorkBasis(rows,memberId,addDay(start,-6),addDay(end,6));for(const r of rows.filter(r=>r.type==='hr_contract'&&r.data.memberId===memberId&&r.data.start<=end&&r.data.end>=start||r.type==='hr_ruling'&&r.data.engine==='contract-v2'&&r.data.memberId===memberId&&r.data.state==='published'&&r.data.effective<=end||r.type==='hr_policy'&&r.data.engine==='contract-v2'&&r.data.state==='published'&&r.data.start<=end&&r.data.end>=start||r.type==='hr_request'&&r.data.memberId===memberId&&['loan','advance'].includes(r.data.kind)&&r.data.state==='paid'&&r.data.repaymentStart<=end))if(!basis.some(b=>b.id===r.id))basis.push({id:r.id,revision:r.revision});return basis.sort((a,b)=>a.id.localeCompare(b.id));}
export function payrollSourcesCurrent(data:any,rows:any[]){return !rows.some(r=>r.type==='hr_request'&&r.data.memberId===data.memberId&&r.data.kind==='objection'&&r.data.periodId===data.periodId&&['manager','hr'].includes(r.data.state))&& (!data.periodBasis||JSON.stringify(data.calculationSourceBasis)===JSON.stringify(payrollCalculationBasis(rows,data.memberId,data.periodBasis.start,data.periodBasis.end)))&& (data.sourceVersions||[]).every((s:any)=>rows.some(r=>r.id===s.id&&r.revision===s.revision))&&JSON.stringify(data.missionVersions||[])===JSON.stringify(rows.filter(r=>r.type==='staff_mission'&&r.data.memberIds?.includes(data.memberId)).map(r=>({id:r.id,revision:r.revision})).sort((a,b)=>a.id.localeCompare(b.id)));}

export function payrollOperation(b:any,old:any,rows:any[],a:any,now:string,summary:(mid:string,start:string,end:string)=>any):{changes:any[];preview?:any[];results?:any[]}{
 const role=(r:string)=>{if(!a.has(r))fail('دسترسی نقش مربوط به حقوق لازم است.',403)};
 if(b.mode==='payroll_edit')return {changes:[editPayrollSlip(b,old,rows,a,now)]};
 if(b.mode==='payroll_recalculate'){
  role('payroll');if(!payrollSlipEditable(old,rows))fail('فقط فیش پیش از قطعیت مالی قابل بازمحاسبه است.',409);sreq(b.notes,4000);
  const period=rows.find(r=>r.id===old.data.periodId&&r.type==='hr_period'),prior=old.data.recalculations||[];if(prior.length>=20)fail('سقف بازمحاسبه فیش پر شده است.');
  const result=payrollOperation({...b,mode:'payroll_calculate',memberIds:[old.data.memberId],adjustments:[]},period,rows.filter(r=>r.id!==old.id),a,now,summary),fresh=result.changes.find(r=>r.type==='hr_payroll');
  if(!fresh)fail('فیش قابل بازمحاسبه نیست.');const previous={...old.data,history:undefined,recalculations:undefined};
  return {changes:[{...old,data:{...fresh.data,recalculations:[...prior,{at:now,actor:a.userId,reason:b.notes,previous}]}}],results:result.results};
 }
 if(b.mode==='payroll_policy'){
  role('payroll');if(old)fail('قواعد جدید با نسخه تازه ثبت شوند.',409);
  return {changes:[{id:b.id,type:'hr_policy',revision:0,data:{...normalizedPayrollPolicy(b),createdBy:a.userId,createdAt:now}}]};
 }
 if(b.mode==='salary_amend'){
  role('hr');if(old)fail('اصلاح مزد را با نسخه جدید ثبت کنید.',409);
  const contract=rows.find(r=>r.type==='hr_contract'&&r.id===b.contractId&&['active','renewed'].includes(r.data.state));if(!contract)fail('قرارداد مربوط را انتخاب کنید.');
  const effective=sday(b.effective);if(effective<contract.data.start||effective>contract.data.end)fail('تاریخ اثر در بازه قرارداد باشد.');
  if(rows.some(r=>r.type==='hr_payroll'&&r.data.memberId===contract.data.memberId&&r.data.state!=='cancelled'&&r.data.work?.days?.some((d:any)=>d.day>=effective)))fail('این تاریخ فیش محاسبه‌شده دارد؛ اصلاح معوقه در دوره باز ثبت شود.',409);
  const baseSalary=normalizeContractSalary(b.baseSalary);if(!validContractSalary(baseSalary)||!Object.hasOwn(contractSalaryBases,b.salaryBasis))fail('مبلغ و مبنای مزد معتبر لازم است.');
  const data={engine:'contract-v2',memberId:contract.data.memberId,contractId:contract.id,title:'اصلاح مزد قرارداد',effective,text:sreq(b.notes,4000),baseSalary,salaryBasis:b.salaryBasis,...contractPayrollFacts({...b,salaryEffective:effective},contract.data,contract.data.start,contract.data.end),state:'draft',createdBy:a.userId};
  return {changes:[{id:b.id,type:'hr_ruling',revision:0,data}]};
 }
 if(b.mode==='payroll_finalize'){
  role('approver');if(old?.type!=='hr_payroll'||old.data.engine!=='contract-v2'||old.data.state!=='review')fail('فیش آماده بررسی را انتخاب کنید.',409);
  const d=old.data,period=rows.find(r=>r.id===d.periodId&&r.type==='hr_period');if(!period||period.data.state==='closed')fail('دوره بسته یا نامعتبر است.',409);
  if(d.createdBy===a.userId||d.memberId===a.id||d.lastEditedBy===a.userId)fail('تهیه‌کننده، اصلاح‌کننده یا صاحب فیش نمی‌تواند آن را تأیید کند.',403);
  if(!payrollSourcesCurrent(d,rows))fail('منابع محاسبه تغییر کرده‌اند؛ پیش از تأیید، فیش را دوباره بررسی و محاسبه کنید.',409);
  if(d.missionAmountStatus==='pending_policy')fail('حق مأموریت این فیش هنوز مبلغ مشخص ندارد؛ قاعده یا اصلاح مستند لازم است.',409);
  if(d.warnings?.length&&b.warningsReviewed!==true)fail('اختلاف‌های علامت‌خورده را بررسی کنید.');
  return {changes:[{...old,data:{...d,state:'approved',approvedBy:a.userId,approvedAt:now,published:true,publishedAt:now}}]};
 }
 if(!old||old.type!=='hr_period')fail('دوره کارکرد معتبر لازم است.',404);
 const d=old.data;if(d.state==='closed')fail('دوره بسته قابل تغییر نیست.',409);
 if(['payroll_prepare','payroll_calculate'].includes(b.mode))role('payroll');else role('hr');
 const members=Array.isArray(b.memberIds)&&b.memberIds.length?b.memberIds:d.memberIds;
 if(!Array.isArray(members)||!members.length||members.length>100||new Set(members).size!==members.length||members.some((m:any)=>!d.memberIds.includes(m)))fail('افراد یکتای همین دوره انتخاب شوند.');
 if(!Array.isArray(b.adjustments||[])||(b.adjustments||[]).length>100||(b.adjustments||[]).some((x:any)=>!members.includes(x.memberId)))fail('تعدیلات برای افراد انتخاب‌شده همین دوره باشند.');
 const changes:any[]=[],results:any[]=[],work={...(d.work||{})},workBasis={...(d.workBasis||{})};
 for(const mid of members){
  try{
   const e=rows.find(r=>r.type==='hr_employee'&&r.data.memberId===mid&&r.data.state==='active');if(!e)fail('پرونده فعال لازم است.');
   const existing=rows.find(r=>r.type==='hr_payroll'&&r.data.periodId===old.id&&r.data.memberId===mid&&r.data.state!=='cancelled');
   if(existing&&(b.mode!=='payroll_work_accept'||!payrollSlipEditable(existing,rows))){results.push({memberId:mid,name:e.data.name,status:'calculated',recordId:existing.id});continue;}
   if(b.mode==='payroll_work_accept'){
    if(d.end>=dayAt()||d.deadline>=dayAt())fail('پایان دوره و مهلت بررسی کارکرد باید گذشته باشد.');
    if(rows.some(r=>r.type==='hr_request'&&r.data.memberId===mid&&['manager','substitute','hr'].includes(r.data.state)&&['leave','mission','correction','overtime','shift','objection'].includes(r.data.kind)&&(r.data.periodId===old.id||r.data.start<=d.end&&r.data.end>=d.start)))fail('درخواست کارکرد باز نیازمند رسیدگی است.');
    if(unresolvedMissionFacts(rows,mid,d.start,d.end).length)fail('پایان سفر این دوره هنوز به تأیید مدیر نرسیده است.');
    const w=summary(mid,d.start,d.end);if(w.incomplete)fail('تردد ناقص نیازمند رسیدگی است.');
    work[mid]=w;workBasis[mid]=payrollWorkBasis(rows,mid,addDay(d.start,-6),addDay(d.end,6));results.push({memberId:mid,name:e.data.name,status:'ready'});continue;
   }
   if(!work[mid]||!workBasis[mid])fail('کارکرد این فرد باید در مسیر حقوق قراردادمحور تأیید شود.');
   if(JSON.stringify(workBasis[mid])!==JSON.stringify(payrollWorkBasis(rows,mid,addDay(d.start,-6),addDay(d.end,6))))fail('منابع کارکرد تغییر کرده‌اند؛ کارکرد دوباره بررسی شود.');
   const adjustments=(b.adjustments||[]).filter((x:any)=>x.memberId===mid);if(adjustments.length>20)fail('تعدیلات بیش از سقف است.');
   const calculated=computeContractPayroll(rows,e.data,{...d,id:old.id},work[mid],adjustments);
   const sourceIds=new Set([e.id,...calculated.contracts.map((x:any)=>x.id),calculated.policy.id,...workBasis[mid].map((x:any)=>x.id),...calculated.familyBasis.flatMap((x:any)=>x.sourceIds||[])]);
   const sourceVersions=rows.filter(r=>sourceIds.has(r.id)).map(r=>({id:r.id,revision:r.revision}));
   results.push({memberId:mid,name:e.data.name,status:calculated.missionAmountStatus==='pending_policy'||calculated.warnings.length?'review':'ready',...calculated});
   if(b.mode==='payroll_calculate')changes.push({id:crypto.randomUUID(),type:'hr_payroll',revision:0,data:{...calculated,sourceVersions,periodBasis:{start:d.start,end:d.end},calculationSourceBasis:payrollCalculationBasis(rows,mid,d.start,d.end),missionVersions:rows.filter(r=>r.type==='staff_mission'&&r.data.memberIds?.includes(mid)).map(r=>({id:r.id,revision:r.revision})).sort((a,b)=>a.id.localeCompare(b.id)),employeeId:e.id,employeeBasis:{id:e.id,revision:e.revision,start:e.data.start,insuranceBasis:e.data.insuranceBasis,children:e.data.children},memberId:mid,periodId:old.id,title:d.title,name:e.data.name,bankAccount:e.data.bankAccount,state:'review',createdBy:a.userId,createdAt:now,payments:[],published:false}});
  }catch(error){results.push({memberId:mid,name:rows.find(r=>r.type==='hr_employee'&&r.data.memberId===mid)?.data.name,status:'exception',reason:(error as Error).message});}
 }
 if(b.mode==='payroll_prepare')return {preview:results,changes:[]};
 if(b.mode==='payroll_work_accept'){
  if(!results.some(r=>r.status==='ready'))fail('کارکرد آماده نیست: '+results.filter(r=>r.status==='exception').map(r=>r.name+': '+r.reason).join('؛ '));
  changes.push({...old,data:{...d,payrollV2:true,work,workBasis,state:rows.some(r=>r.type==='hr_payroll'&&r.data.periodId===old.id)?'review':'approved',closedWorkBy:a.userId,closedWorkAt:now,workExceptions:results.filter(r=>r.status==='exception')}});
 }else{
  if(!changes.length)fail('فیش آماده نیست: '+results.filter(r=>r.status==='exception').map(r=>r.name+': '+r.reason).join('؛ '));
  changes.push({...old,data:{...d,payrollV2:true,state:'review',payrollExceptions:results.filter(r=>r.status==='exception')}});
 }
 return {changes,results};
}
