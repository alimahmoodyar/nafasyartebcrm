import {personnelDocumentStatus} from './personnel-documents';
import {contactPatch} from './member-contact';
import {personnelProfileId} from './personnel-profile';
import {AccessError} from './authorization';
import {sreq,stxt,sday} from './sales';
import {dayAt,addDay} from './duties';

export const employmentModes=['personnel_create','personnel_complete','contract_save','contract_finalize','contract_close'] as const;
export {personnelFileCategories} from './personnel-contract';
const fail=(message:string,status=400):never=>{throw new AccessError(message,status)};
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
  const data={memberId,name,code:'P-'+b.id.replace(/-/g,'').toUpperCase(),unit:'',title:'',location:sreq(b.location,200),employment:sreq(b.employment,100),managerId:stxt(b.managerId||'',200),start:sday(b.start),end:'',...details,mobile,bankAccount:sreq(b.bankAccount,100),personal:stxt(b.personal||'',2000),leaveMinutes:0,state:'setup',productionEligible:false};
  requiredPersonnel(data,mobile);if(data.managerId&&(data.managerId===memberId||!members.some(m=>m.id===data.managerId&&m.status==='active')&&!rows.some(r=>r.type==='hr_employee'&&r.data.memberId===data.managerId&&r.data.state!=='disabled')))fail('مدیر مستقیم را از اشخاص ثبت‌شده انتخاب کنید.');
  if(rows.some(r=>r.type==='hr_employee'&&r.data.nationalId===data.nationalId))fail('برای این کد ملی پرونده پرسنلی وجود دارد.',409);
  return [{id:personnelProfileId(memberId),type:'hr_employee',revision:0,data}];
 }
 if(b.mode==='personnel_complete'){
  if(!old||old.type!=='hr_employee')fail('پرونده پرسنلی یافت نشد.',404);
  const d=old.data;requiredPersonnel(d,linkedMobile||d.mobile);
  if(d.state==='disabled')fail('پرونده همکاری غیرفعال است.');
  return [{...old,data:{...d,state:'active',profileApprovedAt:d.profileApprovedAt||now,...(personnelDocumentStatus(rows,old.id).complete?{identityCompleteAt:d.identityCompleteAt||now}:{}),setupMissing:[],familyBase:d.familyBase||{maritalStatus:d.maritalStatus,childrenCount:d.childrenCount||0,effective:d.start}}}];
 }

 if(b.mode==='contract_save'){
  if(old&&(old.type!=='hr_contract'||old.data.state!=='draft'))fail('فقط پیش‌نویس قرارداد قابل ویرایش است.',409);
  const memberId=sreq(b.memberId),employee=rows.find(r=>r.type==='hr_employee'&&r.data.memberId===memberId&&r.data.state==='active');if(!employee)fail('پرونده پرسنلی فعال لازم است.');
  if(old&&old.data.memberId!==memberId)fail('صاحب قرارداد قابل تعویض نیست.');
  if(b.contractKind&&b.contractKind!=='fixed')fail('نوع قرارداد را انتخاب کنید.');
  const start=sday(b.start),end=sday(b.end);if(end&&end<start)fail('پایان قرارداد نباید قبل از شروع باشد.');
  const previousId=stxt(b.previousId||'',200);if(previousId){const prev=rows.find(r=>r.id===previousId&&r.type==='hr_contract');if(!prev||prev.data.memberId!==memberId||!['active','renewed'].includes(prev.data.state)||!prev.data.end)fail('قرارداد قبلی برای تمدید معتبر نیست.');if(start!==addDay(prev.data.end,1))fail('تمدید از روز بعد از پایان قرارداد قبلی شروع می‌شود.');}
  return [{id,type:'hr_contract',revision:old?.revision||0,data:{...(old?.data||{}),memberId,title:'قرارداد پرسنلی',contractKind:'fixed',start,end,previousId,text:stxt(b.text||'',12000),state:'draft'}}];
 }
 if(!old||old.type!=='hr_contract')fail('قرارداد یافت نشد.',404);
 const d=old.data;
 if(b.mode==='contract_finalize'){
  if(d.state!=='draft')fail('قرارداد قبلاً تعیین تکلیف شده است.',409);
  if(!rows.some(r=>r.type==='hr_employee'&&r.data.memberId===d.memberId&&r.data.state==='active'))fail('پرونده پرسنلی فعال لازم است.');
  const files=rows.filter(r=>r.type==='hr_file'&&r.data.caseId===old.id&&r.data.category==='signed_contract');if(!files.length)fail('ابتدا تصویر یا فایل قرارداد امضاشده را بارگذاری کنید.');
  const others=rows.filter(r=>r.type==='hr_contract'&&r.id!==old.id&&r.id!==d.previousId&&r.data.memberId===d.memberId&&['active','renewed'].includes(r.data.state));
  if(others.some(r=>r.data.start<=(d.end||'9999-12-31')&&(r.data.end||'9999-12-31')>=d.start))fail('قرارداد نهایی‌شده دیگری با این بازه هم‌پوشانی دارد.',409);
  const changes:any[]=[];
  if(d.previousId){const prev=rows.find(r=>r.id===d.previousId&&r.type==='hr_contract');if(!prev||prev.data.memberId!==d.memberId||prev.data.state!=='active'||d.start!==addDay(prev.data.end,1))fail('قرارداد قبلی تغییر کرده یا قبلاً تمدید شده است.',409);changes.push({...prev,data:{...prev.data,state:'renewed',renewedBy:old.id}});}
  changes.push({...old,data:{...d,state:'active',finalizedAt:now,signedFileIds:files.map(r=>r.id)}});return changes;
 }
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
 if(!['single','married'].includes(data.maritalStatus))fail('وضعیت تأهل اجباری است.');
 if(!contactPatch({mobile:mobile||''}).mobile)fail('تلفن همراه پرسنل اجباری است.');employeeDetails(data);
}
