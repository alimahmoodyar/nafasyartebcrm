import {AccessError} from './authorization';
import {personnelStaff} from './personnel-profile';
import {personnelBaseApproved} from './personnel-documents';
import {requiredPersonnel} from './personnel-employment';

const fail=(message:string,status=409):never=>{throw new AccessError(message,status)};
const ownerTypes=new Set(['hr_employee','hr_contract','hr_assignment','hr_delegate','hr_request','hr_ruling','hr_document','hr_punch','hr_payroll','hr_file']);
export function emptyAccountProfile(profile:any,rows:any[]){
 if(!profile||profile.type!=='hr_employee'||profile.data.state!=='setup')return false;
 const allowed=new Set(['memberId','name','state','setupMissing','createdBy','createdAt','history']);
 return Object.keys(profile.data).every(k=>allowed.has(k))&&(profile.data.history||[]).every((h:any)=>h.mode==='profile_setup')&&!rows.some(r=>r.id!==profile.id&&(r.data.caseId===profile.id||r.data.employeeId===profile.id||r.data.memberId===profile.data.memberId));
}
export function accountPersonnelLink(member:any,rows:any[]){
 const profiles=rows.filter(r=>r.type==='hr_employee'&&r.data.memberId===member.id),profile=profiles[0];
 const internal=member.status!=='deleted'&&personnelStaff({...member,status:'active'});
 const canLink=internal&&profiles.length<=1&&(!profile||emptyAccountProfile(profile,rows));
 return {canLink,reason:!internal?'فقط حساب کارکنان داخلی قابل اتصال است.':profiles.length>1?'این حساب چند پرونده دارد؛ ابتدا بررسی شود.':!canLink?'این حساب پرونده پرسنلی دارای اطلاعات دارد؛ اتصال به پرونده دیگری مجاز نیست.':'',profile:profile?{id:profile.id,revision:profile.revision,name:profile.data.name,code:profile.data.code||'',state:profile.data.state}:null};
}
function remapPeriod(data:any,from:string,to:string){
 const d={...data};if(d.memberIds?.includes(from)){if(d.memberIds.includes(to))fail('هر دو شناسه در یک دوره کارکرد وجود دارند؛ اتصال نیازمند بررسی اداری است.');d.memberIds=d.memberIds.map((id:string)=>id===from?to:id);}
 for(const key of ['work','workBasis'])if(d[key]&&Object.hasOwn(d[key],from)){if(Object.hasOwn(d[key],to))fail('کارکرد تکراری در این دوره وجود دارد.');d[key]={...d[key],[to]:d[key][from]};delete d[key][from];}
 for(const key of ['workExceptions','payrollExceptions'])if(Array.isArray(d[key]))d[key]=d[key].map((item:any)=>item.memberId===from?{...item,memberId:to}:item);
 return d;
}
/** Only live identity pointers change. Amounts, states, file/contract IDs and historical snapshots stay intact. */
export function personnelAccountLinkPlan(rows:any[],members:any[],member:any,profile:any,actor:{userId:string;name?:string},reason:string,now:string){
 const state=accountPersonnelLink(member,rows);if(!state.canLink)fail(state.reason);
 if(!profile||profile.type!=='hr_employee')fail('پرونده پرسنلی یافت نشد.',404);
 if(!personnelBaseApproved(profile.data))fail('ابتدا اطلاعات پایه پرونده را در اداری تأیید کنید.');
 const from=profile.data.memberId,to=member.id;
 if(typeof from!=='string'||!from.startsWith('person:')||members.some(m=>m.id===from))fail('این پرونده به حساب دیگری متصل است؛ اتصال دوباره مجاز نیست.');
 if(rows.some(r=>r.type==='hr_employee'&&r.id!==profile.id&&r.data.memberId===from))fail('شناسه پرسنلی تکراری است؛ ابتدا پرونده‌ها بررسی شوند.');
 requiredPersonnel(profile.data,profile.data.mobile);
 const oldBase=state.profile?rows.find(r=>r.id===state.profile!.id):null,changes=new Map<string,any>();
 for(const row of rows){
  let data=row.data;
  if(ownerTypes.has(row.type)){
   if(data.memberId===from)data={...data,memberId:to};
   if(['hr_employee','hr_delegate'].includes(row.type)&&data.managerId===from)data={...data,managerId:to};
   if(row.type==='hr_request'&&data.substituteId===from)data={...data,substituteId:to};
  }else if(row.type==='hr_period')data=remapPeriod(data,from,to);
  if(row.id===profile.id)data={...data,accountLinkedAt:now,accountLink:{memberId:to,previousMemberId:from,previousBaseId:oldBase?.id||'',at:now,actor:actor.userId,reason},history:[...(data.history||[]),{at:now,actor:actor.userId,name:actor.name||'',mode:'account_link',notes:reason,state:data.state}]};
  if(JSON.stringify(data)!==JSON.stringify(row.data))changes.set(row.id,{...row,data});
 }
 if(oldBase)changes.set(oldBase.id,{...oldBase,type:'hr_link_archive',data:{...oldBase.data,state:'linked',linkedIntoId:profile.id,linkedAt:now,linkedBy:actor.userId}});
 // Carry only exact old revisions over this identity-only migration. An already stale
 // calculation remains stale; no unrelated source revision or amount is approved here.
 const versions=(items:any)=>Array.isArray(items)?items.map((v:any)=>{const r=changes.get(v.id);return r&&v.revision===r.revision?{...v,revision:v.revision+1}:v}):items;
 for(let pass=0;pass<3;pass++)for(const row of rows){
  const prior=changes.get(row.id)||row;let data=prior.data;
  if(row.type==='hr_period'&&data.workBasis){const workBasis=Object.fromEntries(Object.entries(data.workBasis).map(([key,value])=>[key,versions(value)]));data={...data,workBasis};}
  if(row.type==='hr_payroll'){
   data={...data,...(data.sourceVersions?{sourceVersions:versions(data.sourceVersions)}:{}),...(data.calculationSourceBasis?{calculationSourceBasis:versions(data.calculationSourceBasis)}:{})};
   const e=data.employeeBasis,r=e&&changes.get(e.id);if(r&&e.revision===r.revision)data={...data,employeeBasis:{...e,revision:e.revision+1}};
  }
  if(JSON.stringify(data)!==JSON.stringify(row.data))changes.set(row.id,{...prior,data});
 }
 const employees=rows.filter(r=>r.type==='hr_employee'&&r.id!==oldBase?.id).map(r=>(changes.get(r.id)||r).data);
 for(const e of employees){let id=e.memberId;const seen=new Set<string>();while(id){if(seen.has(id))fail('این اتصال در زنجیره مدیران حلقه ایجاد می‌کند.');seen.add(id);id=employees.find(x=>x.memberId===id)?.managerId||'';}}
 if(changes.size>200)fail('بیش از ۲۰۰ سابقه مرتبط وجود دارد؛ اتصال باید با بررسی جداگانه انجام شود.');
 return {from,to,changes:[...changes.values()],previousBaseId:oldBase?.id||''};
}
