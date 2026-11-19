import {AccessError} from './authorization';
import {sday,sreq,stxt,integer,money} from './sales';
import {dayAt} from './duties';
import {solarParts,solarToIso,solarMonthDays} from './persian-date';
const fail=(s:string):never=>{throw new AccessError(s,400)};
export function studyRenewal(issued:string){const p=solarParts(sday(issued)),m=p.month+6,y=p.year+(m>12?1:0),month=m>12?m-12:m;return solarToIso(y,month,Math.min(p.day,solarMonthDays(y,month)));}
export function adultOn(birth:string,day:string){const p=solarParts(birth),d=solarParts(day);return d.year-p.year>18||d.year-p.year===18&&(d.month>p.month||d.month===p.month&&d.day>=p.day);}
export function payrollEmployeeFacts(b:any,previous:any={},rows:any[]=[],now=dayAt()){
 const out:any={};if(!Object.hasOwn(b,'children')&&Object.hasOwn(b,'childrenCount')&&Number(b.childrenCount)>0&&(!previous.memberId||Number(b.childrenCount)!==Number(previous.childrenCount)))fail('نام و تاریخ تولد هر فرزند در همان پرونده تکمیل شود.');
 if(Object.hasOwn(b,'children')){if(!Array.isArray(b.children)||b.children.length>30)fail('فهرست فرزندان معتبر نیست.');const ids=new Set<string>();out.children=b.children.map((c:any)=>{const id=sreq(c.id,100);if(ids.has(id))fail('فرزند تکراری است.');ids.add(id);const birthDate=sday(c.birthDate);if(birthDate>now)fail('تولد فرزند در آینده نیست.');return {id,name:sreq(c.name,200),birthDate,effective:c.effective?sday(c.effective):previous.profileApprovedAt?(b.familyEffective?sday(b.familyEffective):now):[birthDate,b.start||previous.start||birthDate].sort().at(-1)};});if(out.children.length!==Number(b.childrenCount??previous.childrenCount??0))fail('برای هر فرزند یک ردیف نام و تاریخ تولد ثبت کنید.');}
 if(Object.hasOwn(b,'insuranceNumber'))out.insuranceNumber=stxt(b.insuranceNumber||'',30);
 if(Object.hasOwn(b,'insuranceDays')&&b.insuranceDays!==''){
  const days=integer(Number(b.insuranceDays),0,50000),asOf=sday(b.insuranceAsOf);if(asOf>now)fail('تاریخ گزارش سابقه بیمه در آینده نیست.');
  const changed=!previous.insuranceBasis||previous.insuranceBasis.days!==days||previous.insuranceBasis.asOf!==asOf;
  const sourceId=stxt(b.insuranceSourceId||previous.insuranceBasis?.sourceId||'',200);
  const evidence=rows.find(r=>r.id===sourceId&&r.type==='hr_file'&&r.data.caseId===b.recordId&&r.data.category==='insurance_record'&&(!r.data.reviewState||r.data.reviewState==='approved'));
  if(b.insuranceConfirmed===true&&!evidence)fail('برای تأیید سابقه، گزارش سوابق همین پرونده را انتخاب کنید.');
  out.insuranceBasis={days,asOf,sourceId,confirmed:b.insuranceConfirmed===true||!Object.hasOwn(b,'insuranceConfirmed')&&!changed&&previous.insuranceBasis?.confirmed===true};if(JSON.stringify(out.insuranceBasis)!==JSON.stringify(previous.insuranceBasis)){const old=previous.insuranceHistory||[];if(old.length>=100)fail('سقف سابقه گزارش بیمه پر شده است.');out.insuranceHistory=[...(old.length?old:previous.insuranceBasis?[previous.insuranceBasis]:[]),out.insuranceBasis];}
 }
 if(out.children){
  for(const c of out.children)if(c.effective<c.birthDate)fail('تاریخ اثر فرزند قبل از تولد نیست.');
  const changed=JSON.stringify(previous.children||[])!==JSON.stringify(out.children);
  if(changed&&previous.profileApprovedAt){
   const effective=sday(b.familyEffective);if(effective>now)fail('تاریخ اثر تغییر فرزندان در آینده نیست.');
   if(rows.some(r=>r.type==='hr_period'&&r.data.state!=='draft'&&r.data.memberIds?.includes(previous.memberId)&&r.data.end>=effective))fail('اطلاعات این بازه قفل است؛ اصلاح را در بازه باز ثبت کنید.');
   const history=previous.childrenHistory||[];if(history.length>=100)fail('سقف سابقه تغییر فرزندان پر شده است.');
   out.childrenHistory=[...(history.length?history:[{effective:previous.familyBase?.effective||previous.start,children:previous.children||[]}]),{effective,children:out.children}];
  }
 }
 return out;
}
export function contractPayrollFacts(b:any,previous:any,start:string,end:string){
 const value=(k:string)=>Object.hasOwn(b,k)?b[k]:previous[k];
 const effective=value('salaryEffective')?sday(value('salaryEffective')):start;
 if(effective<start||effective>end)fail('تاریخ اثر مزد در بازه قرارداد باشد.');
 const employment=value('employment')||'';if(employment&&!['تمام‌وقت','پاره‌وقت','کارآموز'].includes(employment))fail('نوع همکاری معتبر نیست.');
 const benefits=value('benefits')||[];if(!Array.isArray(benefits)||benefits.length>20)fail('مزایای قرارداد معتبر نیست.');
 const priorSeniorityDaily=value('priorSeniorityDaily')?money(value('priorSeniorityDaily'),true):'',seniorityAsOf=priorSeniorityDaily?sday(value('seniorityAsOf')):'';
 return {salaryEffective:effective,employment,shiftWork:value('shiftWork')===true,priorSeniorityDaily,seniorityAsOf,benefits:benefits.map((x:any)=>{const day=x.effective?sday(x.effective):effective;if(day<start||day>end)fail('تاریخ اثر مزیت در بازه قرارداد باشد.');if(!['job','welfare'].includes(x.kind))fail('ماهیت مزیت مشخص شود.');return {title:sreq(x.title,100),amount:money(x.amount,true),effective:day,kind:x.kind}})};
}
export function childEligibility(rows:any[],employee:any,day:string){
 const snapshot=(employee.childrenHistory||[]).filter((x:any)=>x.effective<=day).sort((a:any,b:any)=>a.effective.localeCompare(b.effective)).at(-1);const children=[...(snapshot?.children||employee.children||[])],pending:any[]=[],eligible:any[]=[];for(const r of rows.filter(r=>r.type==='hr_request'&&r.data.kind==='family'&&r.data.familyEvent==='birth'&&r.data.memberId===employee.memberId&&r.data.state==='approved'&&r.data.effective<=day&&(!snapshot||r.data.effective>snapshot.effective))){if(!children.some((c:any)=>c.id===r.id))children.push({id:r.id,name:r.data.childName,birthDate:r.data.eventDate,effective:r.data.effective});}
 if(employee.childrenCount&&!children.length)return {eligible,pending:[{reason:'نام و تاریخ تولد فرزندان تکمیل نشده است.'}]};
 for(const c of children.filter((c:any)=>c.birthDate<=day&&(c.effective||c.birthDate)<=day)){
  const medical=rows.find(r=>r.type==='hr_request'&&r.data.kind==='family'&&r.data.familyEvent==='medical'&&r.data.childId===c.id&&r.data.memberId===employee.memberId&&r.data.state==='approved'&&r.data.effective<=day&&(!r.data.validUntil||r.data.validUntil>=day));if(medical){eligible.push({...c,basis:'medical',sourceId:medical.id});continue;}
  if(!adultOn(c.birthDate,day)){eligible.push({...c,basis:'age'});continue;}
  const evidence=rows.filter(r=>r.type==='hr_request'&&r.data.kind==='family'&&r.data.familyEvent==='study'&&r.data.childId===c.id&&r.data.memberId===employee.memberId&&r.data.state==='approved'&&r.data.effective<=day&&r.data.eventDate<=day&&r.data.renewal>day).sort((a,b)=>a.data.eventDate.localeCompare(b.data.eventDate)).at(-1);
  if(evidence)eligible.push({...c,basis:'study',sourceId:evidence.id});else pending.push({id:c.id,name:c.name,reason:'گواهی تحصیلی معتبر یا بررسی مسیر پزشکی لازم است.'});
 }
 return {eligible,pending};
}

export function insuranceAt(employee:any,day:string){const candidates=[...(employee.insuranceHistory||[]),...(employee.insuranceBasis?[employee.insuranceBasis]:[])].filter((b:any)=>b.asOf<=day).sort((a:any,b:any)=>a.asOf.localeCompare(b.asOf));return candidates.at(-1);}
export function childStudyAlerts(rows:any[],today=dayAt()){
 const alerts:any[]=[];for(const e of rows.filter(r=>r.type==='hr_employee'&&r.data.state==='active')){const eligibility=childEligibility(rows,e.data,today);for(const child of eligibility.pending)alerts.push({employeeId:e.id,memberId:e.data.memberId,childId:child.id,name:child.name||'فرزند',stage:'required',due:today});for(const child of eligibility.eligible.filter((c:any)=>c.basis==='study')){const proof=rows.find(r=>r.id===child.sourceId);if(proof&&Date.parse(proof.data.renewal+'T12:00:00Z')-Date.parse(today+'T12:00:00Z')<=30*86400000)alerts.push({employeeId:e.id,memberId:e.data.memberId,childId:child.id,name:child.name,stage:'renewal',due:proof.data.renewal});}}return alerts;
}
