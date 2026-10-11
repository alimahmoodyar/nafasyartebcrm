import {internal,hrVisible,presentHr,workSummary} from './personnel';
import type {HrActor} from './personnel';
import {isIsoDay} from './persian-date';

type MissingField={key:string;label:string;owner:string};
const employeeFields:Record<string,string>={code:'کد پرسنلی',unit:'واحد محل خدمت',title:'عنوان شغلی',location:'محل کار',employment:'نوع همکاری',managerId:'مدیر مستقیم',start:'تاریخ شروع همکاری',leaveMinutes:'مانده اولیه مرخصی'};
function permissions(member:any):Record<string,any>{try{const p=typeof member?.permissions==='string'?JSON.parse(member.permissions):member?.permissions;return p&&typeof p==='object'&&!Array.isArray(p)?p:{};}catch{return {};}}
const missing=(key:string,label:string):MissingField=>({key,label,owner:'واحد اداری'});
// This is a read projection. Viewing the portal never creates employee records.
export function personnelProfileStatus(rows:any[],memberId:string,members:any[]){
 const record=rows.find(r=>r.type==='hr_employee'&&r.data.memberId===memberId),d=record?.data||{},fields:MissingField[]=[];
 if(!record)fields.push(missing('profile','ایجاد و اتصال پرونده پایه پرسنلی'));
 else{
  for(const [key,label]of Object.entries(employeeFields)){
   const valid=key==='leaveMinutes'?Number.isSafeInteger(d[key])&&d[key]>=0:key==='start'?isIsoDay(d[key]):typeof d[key]==='string'&&!!d[key].trim();
   if(!valid)fields.push(missing(key,label));
  }
  if(d.state!=='active')fields.push(missing('state',d.state==='disabled'?'بررسی وضعیت غیرفعال پرونده':'تکمیل و فعال‌سازی پرونده توسط اداری'));
 }
 const responsible=members.filter(internal).filter(m=>{const roles=permissions(m).personnelRoles;return Array.isArray(roles)&&roles.includes('hr');}).map(m=>({id:m.id,name:m.name}));
 const ready=!!record&&d.state==='active'&&!fields.length;
 const manager=members.find(m=>m.id===d.managerId&&internal(m));
 const assignments=rows.filter(r=>r.type==='hr_assignment'&&r.data.memberId===memberId&&isIsoDay(r.data.start)&&isIsoDay(r.data.end)&&rows.some(s=>s.id===r.data.shiftId&&s.type==='hr_shift'&&s.data.state==='published'));
 const leaveMissing=[...fields];if(record&&!manager&&!leaveMissing.some(f=>f.key==='managerId'))leaveMissing.push(missing('managerId','تعیین مدیر مستقیم فعال'));
 if(!assignments.length)leaveMissing.push(missing('shift','تخصیص برنامه و شیفت کاری'));
 const hoursMissing=[...fields,...(!assignments.length?[missing('shift','تخصیص برنامه و شیفت کاری')]:[])];
 return {recordId:record?.id||'',revision:record?.revision||0,state:d.state||'missing',ready,missing:fields,responsible,services:{finance:{ready,missing:fields},leave:{ready:ready&&!!manager&&!!assignments.length,missing:leaveMissing},hours:{ready:ready&&!!assignments.length,missing:hoursMissing}}};
}

export function ownPersonnelWork(rows:any[],a:HrActor,start:string,end:string){
 const own=(r:any)=>r.data.memberId===a.id;
 const assignments=rows.filter(r=>r.type==='hr_assignment'&&own(r)&&r.data.start<=end&&r.data.end>=start).map(r=>{
  const shift=rows.find(s=>s.type==='hr_shift'&&s.id===r.data.shiftId)?.data;
  return {...presentHr(r,a,rows),shift:shift?{title:shift.title,startTime:shift.startTime,endTime:shift.endTime,breakMinutes:shift.breakMinutes,weekdays:shift.weekdays,holidays:shift.holidays}:null};
 });
 const punches=rows.filter(r=>r.type==='hr_punch'&&own(r)&&r.data.day>=start&&r.data.day<=end).sort((x,y)=>String(x.data.at).localeCompare(String(y.data.at))).map(r=>presentHr(r,a,rows));
 const periods=rows.filter(r=>r.type==='hr_period'&&Array.isArray(r.data.memberIds)&&r.data.memberIds.includes(a.id)&&hrVisible(r,a,rows)).map(r=>{
  const d=r.data;return {id:r.id,type:r.type,revision:r.revision,created:r.created,updated:r.updated,data:{title:d.title,start:d.start,end:d.end,deadline:d.deadline,state:d.state,memberIds:[a.id]}};
 });
 let summary:any;
 const employee=rows.find(r=>r.type==='hr_employee'&&own(r));
 if(!employee||employee.data.state!=='active')summary={memberId:a.id,error:'پرونده پرسنلی باید توسط واحد اداری تکمیل و فعال شود.'};
 else try{summary={memberId:a.id,...workSummary(rows,a.id,start,end)}}catch(e){summary={memberId:a.id,error:(e as Error).message};}
 return {start,end,summary,assignments,punches,periods};
}

export function ownDocumentStatus(rows:any[],memberId:string){
 const status=(type:string,published:(r:any)=>boolean,label:string)=>{
  const own=rows.filter(r=>r.type===type&&r.data.memberId===memberId);
  if(own.some(published))return {state:'published',message:label+' منتشرشده آماده مشاهده است.'};
  return own.length?{state:'pending',message:label+' هنوز تأیید و منتشر نشده است؛ واحد اداری و حقوق‌ودستمزد باید پیگیری کند.'}:{state:'missing',message:'هنوز '+label+' برای شما ثبت و منتشر نشده است؛ از واحد اداری و حقوق‌ودستمزد پیگیری کنید.'};
 };
 return {ruling:status('hr_ruling',r=>r.data.state==='published','حکم حقوقی'),payroll:status('hr_payroll',r=>r.data.published===true,'فیش حقوقی')};
}
