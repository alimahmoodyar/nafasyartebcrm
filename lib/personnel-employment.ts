import {normalizeIranIban,iranIbanError} from './iran-iban';
import {personnelDocumentStatus} from './personnel-documents';
import {contactPatch} from './member-contact';
import {personnelProfileId} from './personnel-profile';
import {payrollEmployeeFacts,contractPayrollFacts} from './personnel-payroll-facts';
import {AccessError} from './authorization';
import {sreq,stxt,sday} from './sales';
import {dayAt,addDay} from './duties';
import {contractSalaryBases,normalizeContractSalary,validContractSalary} from './personnel-contract-salary';

export const employmentModes=['personnel_create','personnel_complete','contract_save','contract_finalize','contract_edit','contract_close'] as const;
export {personnelFileCategories} from './personnel-contract';
const fail=(message:string,status=400):never=>{throw new AccessError(message,status)};
export function personnelBankAccount(value:unknown,required=false){const iban=normalizeIranIban(stxt(value||'',100)),error=iranIbanError(iban,required);if(error)fail(error);return iban;}
export function employeeDetails(body:any,previous:any={}){
 const out:any={};for(const [key,max] of Object.entries({nationalId:10,address:1500,emergencyContact:300}))out[key]=Object.hasOwn(body,key)?stxt(body[key]||'',max):previous[key]||'';
 out.nationalId=out.nationalId.replace(/[۰-۹]/g,(c:string)=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)));
 if(out.nationalId&&!/^\d{10}$/.test(out.nationalId))fail('کد ملی را ده‌رقمی وارد کنید یا خالی بگذارید.');
 out.maritalStatus=Object.hasOwn(body,'maritalStatus')?stxt(body.maritalStatus||'',20):previous.maritalStatus||'';if(out.maritalStatus&&!['single','married'].includes(out.maritalStatus))fail('وضعیت تأهل معتبر نیست.');
 out.childrenCount=Object.hasOwn(body,'childrenCount')?Number(body.childrenCount):previous.childrenCount??0;if(!Number.isInteger(out.childrenCount)||out.childrenCount<0||out.childrenCount>30)fail('تعداد فرزندان معتبر نیست.');
 out.birthDate=Object.hasOwn(body,'birthDate')?(body.birthDate?sday(body.birthDate):''):previous.birthDate||'';
 if(out.birthDate&&out.birthDate>dayAt())fail('تاریخ تولد در آینده نیست.');return out;
}
export function employmentChanges(b:any,old:any,rows:any[],now:string,members:any[]=[],linkedMobile=''){
 const id=b.recordId||b.id;
 if(b.mode==='personnel_create'){
  if(old)fail('برای شخص تازه، پرونده تازه بسازید.',409);
  const memberId='person:'+b.id,name=sreq(b.name,100),details=employeeDetails(b),mobile=contactPatch({mobile:b.mobile}).mobile;
  const data={...payrollEmployeeFacts(b),memberId,name,code:'P-'+b.id.replace(/-/g,'').toUpperCase(),unit:'',title:'',location:sreq(b.location,200),employment:sreq(b.employment,100),managerId:stxt(b.managerId||'',200),start:sday(b.start),end:'',...details,mobile,bankAccount:personnelBankAccount(b.bankAccount,true),personal:stxt(b.personal||'',2000),leaveMinutes:0,state:'setup',productionEligible:false};
  requiredPersonnel(data,mobile);if(data.managerId&&(data.managerId===memberId||!members.some(m=>m.id===data.managerId&&m.status==='active')&&!rows.some(r=>r.type==='hr_employee'&&r.data.memberId===data.managerId&&r.data.state!=='disabled')))fail('مدیر مستقیم را از اشخاص ثبت‌شده انتخاب کنید.');
  if(rows.some(r=>r.type==='hr_employee'&&r.data.nationalId===data.nationalId))fail('برای این کد ملی پرونده پرسنلی وجود دارد.',409);
  return [{id:personnelProfileId(memberId),type:'hr_employee',revision:0,data}];
 }
 if(b.mode==='personnel_complete'){
  if(!old||old.type!=='hr_employee')fail('پرونده پرسنلی یافت نشد.',404);
  const d=old.data;requiredPersonnel(d,linkedMobile||d.mobile);
  if(d.state==='disabled')fail('پرونده همکاری غیرفعال است.');
  return [{...old,data:{...d,state:'active',bankAccount:personnelBankAccount(d.bankAccount,true),profileApprovedAt:d.profileApprovedAt||now,...(personnelDocumentStatus(rows,old.id).complete?{identityCompleteAt:d.identityCompleteAt||now}:{}),setupMissing:[],familyBase:d.familyBase||{maritalStatus:d.maritalStatus,childrenCount:d.childrenCount||0,effective:d.start}}}];
 }

 if(b.mode==='contract_save'||b.mode==='contract_finalize'||b.mode==='contract_edit'){
  const editing=b.mode==='contract_edit';
  if(editing){
   if(!old||old.type!=='hr_contract'||old.data.state!=='active')fail('فقط قرارداد نهایی‌شده فعال قابل اصلاح است.',409);
   sreq(b.notes,4000);
  }
  if(b.mode==='contract_finalize'&&!old)fail('پیش‌نویس قرارداد یافت نشد.',404);
  if(!editing&&old&&(old.type!=='hr_contract'||old.data.state!=='draft'))fail('فقط پیش‌نویس قرارداد قابل ویرایش است.',409);
  const previous=old?.data||{},value=(key:string)=>Object.hasOwn(b,key)?b[key]:previous[key];
  const memberId=sreq(value('memberId')),employee=rows.find(r=>r.type==='hr_employee'&&r.data.memberId===memberId&&r.data.state==='active');if(!employee)fail('پرونده پرسنلی فعال لازم است.');
  if(old&&old.data.memberId!==memberId)fail('صاحب قرارداد قابل تعویض نیست.');
  if(b.contractKind&&b.contractKind!=='fixed')fail('نوع قرارداد را انتخاب کنید.');
  const start=sday(value('start')),end=sday(value('end'));if(end<start)fail('پایان قرارداد نباید قبل از شروع باشد.');
  const baseSalary=normalizeContractSalary(value('baseSalary')),salaryBasis=value('salaryBasis');
  if(!validContractSalary(baseSalary))fail('حقوق پایه را به ریال صحیح و مثبت وارد کنید.');
  if(typeof salaryBasis!=='string'||!Object.hasOwn(contractSalaryBases,salaryBasis))fail('مبنای محاسبه حقوق پایه را انتخاب کنید.');
  const previousId=stxt(value('previousId')||'',200);
  if(editing){
   if(previousId!==(previous.previousId||''))fail('ارتباط تمدید قرارداد قابل تعویض نیست.',409);
   const rangeStart=start<previous.start?start:previous.start,rangeEnd=end>previous.end?end:previous.end;
   const overlaps=(from:string,to:string)=>from<=rangeEnd&&to>=rangeStart;
   if(rows.some(r=>r.type==='hr_period'&&r.data.state!=='draft'&&r.data.memberIds?.includes(memberId)&&overlaps(r.data.start,r.data.end)&&(!r.data.payrollV2||!!r.data.work?.[memberId])))fail('کارکرد این بازه قفل شده است؛ بازگشایی مجاز یا اصلاح مزد در دوره باز لازم است.',409);
   if(rows.some(r=>{
    if(r.type!=='hr_payroll'||r.data.memberId!==memberId||r.data.state==='cancelled')return false;
    if(r.data.contracts?.some((c:any)=>c.id===old.id))return true;
    const period=rows.find(p=>p.type==='hr_period'&&p.id===r.data.periodId);
    return !period||overlaps(period.data.start,period.data.end);
   }))fail('این قرارداد مبنای فیش محاسبه‌شده است؛ سابقه آن قابل بازنویسی نیست. اصلاح مزد را از مسیر حقوق در دوره باز ثبت کنید.',409);
   if(rows.some(r=>r.type==='hr_ruling'&&r.data.contractId===old.id&&r.data.state!=='cancelled'))fail('این قرارداد سابقه اصلاح مزد دارد؛ تغییر مزد را از مسیر اصلاح مزد قرارداد ثبت کنید.',409);
  }
  const others=rows.filter(r=>r.type==='hr_contract'&&r.id!==id&&r.id!==previousId&&r.data.memberId===memberId&&['active','renewed'].includes(r.data.state));
  if(others.some(r=>r.data.start<=end&&(r.data.end||'9999-12-31')>=start))fail('قرارداد نهایی‌شده دیگری با این بازه هم‌پوشانی دارد.',409);
  const changes:any[]=[];
  if(previousId){const prev=rows.find(r=>r.id===previousId&&r.type==='hr_contract');if(!prev||prev.data.memberId!==memberId||prev.data.state!==(editing?'renewed':'active')||editing&&prev.data.renewedBy!==id||!prev.data.end||start!==addDay(prev.data.end,1))fail('تمدید باید از روز بعد از پایان قرارداد قبلی شروع شود؛ قرارداد قبلی را تازه‌سازی کنید.',409);if(!editing)changes.push({...prev,data:{...prev.data,state:'renewed',renewedBy:id}});}
  const signedFileIds=[...new Set([...(Array.isArray(previous.signedFileIds)?previous.signedFileIds:[]),...rows.filter(r=>r.type==='hr_file'&&r.data.caseId===id&&r.data.category==='signed_contract').map(r=>r.id)])];
  changes.push({id,type:'hr_contract',revision:old?.revision||0,data:{...previous,memberId,title:'قرارداد پرسنلی',contractKind:'fixed',start,end,previousId,text:stxt(value('text')||'',12000),baseSalary:BigInt(baseSalary).toString(),salaryBasis,salaryCurrency:'IRR',registrationBasis:'physical_signed_contract',...contractPayrollFacts(b,previous,start,end),state:'active',finalizedAt:editing?previous.finalizedAt:now,...(editing?{editedAt:now}:{}),signedFileIds}});return changes;
 }
 if(!old||old.type!=='hr_contract')fail('قرارداد یافت نشد.',404);
 const d=old.data;
 if(b.mode==='contract_close'){
  if(!['draft','active'].includes(d.state))fail('قرارداد قابل بستن نیست.',409);
  return [{...old,data:{...d,state:'closed',closeReason:sreq(b.notes,4000),closedAt:now}}];
 }
 return fail('عملیات قرارداد ناشناخته است.');
}
export function contractAlerts(rows:any[],today=dayAt()){
 return rows.filter(r=>r.type==='hr_contract'&&r.data.state==='active'&&r.data.end&&r.data.end<=addDay(today,30)).map(r=>{const days=Math.round((Date.parse(r.data.end)-Date.parse(today))/86400000),employee=rows.find(e=>e.type==='hr_employee'&&e.data.memberId===r.data.memberId);return {id:r.id,memberId:r.data.memberId,name:employee?.data.name||'کارمند',title:r.data.title,end:r.data.end,days,stage:days<0?'expired':days<=7?'seven':'thirty'};}).sort((a,b)=>a.end.localeCompare(b.end)||a.id.localeCompare(b.id));
}

export function requiredPersonnel(data:any,mobile:string){
 for(const key of ['name','location','employment','start','nationalId','birthDate','address','emergencyContact','bankAccount'])if(typeof data[key]!=='string'||!data[key].trim())fail('اطلاعات اجباری پرونده پرسنلی کامل نیست.');
 if(!['single','married'].includes(data.maritalStatus))fail('وضعیت تأهل اجباری است.');personnelBankAccount(data.bankAccount,true);
 if(!contactPatch({mobile:mobile||''}).mobile)fail('تلفن همراه پرسنل اجباری است.');employeeDetails(data);
}
