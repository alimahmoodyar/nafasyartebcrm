import {AccessError} from './authorization';
import {sreq,sday,stxt} from './sales';
import {dayAt} from './duties';
export const familyModes=['family_start','family_submit','family_approve','family_reject'] as const;
const fail=(m:string,s=400):never=>{throw new AccessError(m,s)};
export function familyAt(rows:any[],memberId:string,day:string){
 const employee=rows.find(r=>r.type==='hr_employee'&&r.data.memberId===memberId),base=employee?.data.familyBase;
 const applicable=!!base&&base.effective<=day;let maritalStatus=applicable?base.maritalStatus:'',childrenCount=applicable?base.childrenCount:null;
 const sources=rows.filter(r=>r.type==='hr_request'&&r.data.kind==='family'&&r.data.memberId===memberId&&r.data.state==='approved'&&r.data.effective<=day).sort((a,b)=>a.data.effective.localeCompare(b.data.effective)||(a.data.approvalOrder||0)-(b.data.approvalOrder||0)||a.updated.localeCompare(b.updated)||a.id.localeCompare(b.id));
 for(const r of sources){if(r.data.familyEvent==='birth')childrenCount=childrenCount===null?null:childrenCount+1;else if(r.data.familyEvent==='administrative'){if(r.data.maritalStatus!==undefined)maritalStatus=r.data.maritalStatus;if(r.data.childrenCount!==undefined)childrenCount=r.data.childrenCount;}else maritalStatus=r.data.familyEvent==='marriage'?'married':'single';}
 return {day,maritalStatus,childrenCount,known:!!maritalStatus&&childrenCount!==null,sourceIds:sources.map(r=>r.id),baseFrom:base?.effective||employee?.data.start||'',benefitRule:'existing_approved_payroll_rules'};
}
export function familyChanges(b:any,old:any,rows:any[],actor:any,now:string){
 if(b.mode==='family_start'){
  if(old)fail('برای اعلام جدید، درخواست تازه ثبت کنید.',409);
  const memberId=stxt(b.memberId||actor.id,200);if(!memberId||memberId!==actor.id&&!actor.has('hr'))fail('فقط برای خودتان درخواست ثبت کنید.',403);
  if(!rows.some(r=>r.type==='hr_employee'&&r.data.memberId===memberId&&r.data.state==='active'))fail('پرونده پرسنلی فعال لازم است.');
  if(!['birth','marriage','divorce'].includes(b.familyEvent))fail('نوع تغییر خانوادگی را انتخاب کنید.');
  const eventDate=sday(b.eventDate);if(eventDate>dayAt())fail('تاریخ واقعه در آینده نیست.');
  const childName=b.familyEvent==='birth'?sreq(b.childName,200):'';
  if(rows.some(r=>r.type==='hr_request'&&r.data.kind==='family'&&r.data.memberId===memberId&&r.data.familyEvent===b.familyEvent&&r.data.eventDate===eventDate&&r.data.childName===childName&&!['rejected','cancelled'].includes(r.data.state)))fail('این اعلام قبلاً ثبت شده است.',409);
  return [{id:b.id,type:'hr_request',revision:0,data:{memberId,kind:'family',title:'اعلام تغییر وضعیت خانوادگی',familyEvent:b.familyEvent,eventDate,childName,state:'draft',createdBy:actor.userId,createdAt:now}}];
 }
 if(!old||old.type!=='hr_request'||old.data.kind!=='family')fail('درخواست خانوادگی یافت نشد.',404);const d=old.data;
 if(b.mode==='family_submit'){
  if(!actor.has('hr')&&actor.id!==d.memberId)fail('درخواست متعلق به شما نیست.',403);if(d.state!=='draft')fail('درخواست قبلاً ارسال شده است.',409);
  const category=d.familyEvent==='birth'?'children_page':'spouse_page';if(!rows.some(r=>r.type==='hr_file'&&r.data.caseId===old.id&&r.data.category===category))fail('تصویر صفحه مربوط در شناسنامه را پیوست کنید.');
  return [{...old,data:{...d,state:'hr'}}];
 }
 if(!actor.has('hr'))fail('تأیید مسئول اداری لازم است.',403);if(d.memberId===actor.id||d.createdBy===actor.userId)fail('تأیید یا رد درخواست خودتان مجاز نیست.',403);if(d.state!=='hr')fail('درخواست در مرحله بررسی اداری نیست.',409);
 if(b.mode==='family_reject')return [{...old,data:{...d,state:'rejected',decision:sreq(b.notes,4000)}}];
 const effective=sday(b.effective);if(effective<d.eventDate)fail('تاریخ اثر قبل از واقعه نباشد.');
 if(rows.some(r=>r.type==='hr_period'&&r.data.state!=='draft'&&r.data.memberIds?.includes(d.memberId)&&r.data.end>=effective))fail('کارکرد یا حقوق این بازه بسته شده؛ تاریخ اثر در بازه باز و دلیل اصلاح را مشخص کنید.',409);
 if(effective!==d.eventDate&&!stxt(b.notes||'',4000))fail('دلیل تغییر تاریخ اثر را بنویسید.');
 const employee=rows.find(r=>r.type==='hr_employee'&&r.data.memberId===d.memberId);if(!employee)fail('پرونده شخص موجود نیست.');
 const current=familyAt(rows,d.memberId,effective);if(current.known&&d.familyEvent==='divorce'&&current.maritalStatus!=='married')fail('وضعیت مصوب شخص متأهل نیست؛ ابتدا سابقه را بررسی کنید.');if(current.known&&d.familyEvent==='marriage'&&current.maritalStatus==='married')fail('ازدواج در وضعیت مصوب شخص قبلاً ثبت است.');
 const data={...d,state:'approved',effective,approvedAt:now,approvedBy:actor.userId,approvalOrder:Math.max(0,...rows.filter(r=>r.type==='hr_request'&&r.data.kind==='family'&&r.data.memberId===d.memberId).map(r=>r.data.approvalOrder||0))+1};
 return [{...old,data}];
}

// HR edits append a dated fact; the original family basis and closed payroll stay intact.
export function administrativeFamilyChange(body:any,employee:any,rows:any[],actor:any,now:string){
 const d=employee.data;if(!d.profileApprovedAt&&!d.identityCompleteAt)return null;
 const current=familyAt(rows,d.memberId,dayAt()),changes:any={};
 if(Object.hasOwn(body,'maritalStatus')&&body.maritalStatus!==current.maritalStatus){if(!['single','married'].includes(body.maritalStatus))fail('وضعیت تأهل معتبر نیست.');changes.maritalStatus=body.maritalStatus;}
 if(Object.hasOwn(body,'childrenCount')&&Number(body.childrenCount)!==current.childrenCount){const count=Number(body.childrenCount);if(!Number.isInteger(count)||count<0||count>30)fail('تعداد فرزندان معتبر نیست.');changes.childrenCount=count;}
 if(!Object.keys(changes).length)return null;
 if(!actor.has('hr')||actor.id===d.memberId)fail('تغییر پرونده خودتان باید از درخواست و بررسی مسئول اداری دیگر انجام شود.',403);
 const effective=sday(body.familyEffective);if(effective>dayAt())fail('تاریخ تغییر خانوادگی در آینده نیست.');
 if(rows.some(r=>r.type==='hr_period'&&r.data.state!=='draft'&&r.data.memberIds?.includes(d.memberId)&&r.data.end>=effective))fail('حقوق این بازه بسته شده؛ اصلاح را در بازه باز ثبت کنید.',409);
 return {id:'family-edit:'+body.id,type:'hr_request',revision:0,data:{memberId:d.memberId,kind:'family',title:'اصلاح وضعیت خانوادگی در پرونده',familyEvent:'administrative',...changes,eventDate:effective,effective,state:'approved',createdBy:actor.userId,createdAt:now,approvedBy:actor.userId,approvedAt:now,approvalOrder:Math.max(0,...rows.filter(r=>r.type==='hr_request'&&r.data.kind==='family'&&r.data.memberId===d.memberId).map(r=>r.data.approvalOrder||0))+1}};
}
