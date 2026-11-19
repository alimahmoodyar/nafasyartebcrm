import {storage} from './storage';
import {hrActor,hrVisible,hrFail} from './personnel';
import {payrollPaymentList,payrollBankFormatPending} from './personnel-payroll-payments';
import {payrollSlipEditable} from './personnel-payroll-edit';
import type {Session} from './permissions';
const parse=(r:any)=>({...r,data:JSON.parse(r.data)});
const viewRoles=['hr','payroll','approver','finance','treasury'];
const monetaryRoles=['payroll','approver','finance'];
export async function readPayrollSlip(u:Session,id:string){
 const actor=await hrActor(u),db=storage(),raw=await db.prepare("SELECT * FROM flow_entities WHERE id=? AND type='hr_payroll'").bind(id).first();
 if(!raw)hrFail('فیش در دسترس نیست.',404);const slip=parse(raw);
 // Treasury gets only the bounded three-column payment projection, even when
 // someone calls this URL directly instead of using the simplified UI.
 if(!monetaryRoles.some(r=>actor.has(r))||!hrVisible(slip,actor,[]))hrFail('جزئیات مالی این فیش در دسترس نیست.',404);
 const periodRaw=await db.prepare("SELECT * FROM flow_entities WHERE id=? AND type='hr_period'").bind(slip.data.periodId).first();
 const period=periodRaw?parse(periodRaw):null;return {actor,slip,period};
}
export async function payrollRead(u:Session,args:any){
 const actor=await hrActor(u),db=storage();if(!viewRoles.some(r=>actor.has(r)))hrFail('دسترسی حقوق یا اداری لازم است.',403);
 const page=Number(args.page||1);if(!Number.isSafeInteger(page)||page<1||page>10000)hrFail('صفحه معتبر نیست.');
 const view=args.view||'periods',periodId=String(args.periodId||''),offset=(page-1)*20;
 const common={page,pageSize:20,bankFormatPending:payrollBankFormatPending};
 if(view==='slip'){
  const {slip,period}=await readPayrollSlip(u,String(args.id||''));
  return {...common,item:slip,period:period?{id:period.id,revision:period.revision,type:period.type,data:{title:period.data.title,start:period.data.start,end:period.data.end,state:period.data.state}}:null,editable:payrollSlipEditable(slip,period?[period]:[])};
 }
 if(view==='missions'){
  const {slip}=await readPayrollSlip(u,String(args.id||'')),missionId=String(args.missionId||'');
  if(!slip.data.missions?.some((m:any)=>m.id===missionId))hrFail('مأموریت متعلق به مبنای این فیش نیست.',404);
  const section=args.section||'reports',types:Record<string,string>={reports:'staff_mission_report',points:'staff_mission_point',files:'staff_mission_file'};if(!types[section])hrFail('نوع گزارش معتبر نیست.');
  const rows=(await db.prepare("SELECT f.* FROM flow_entities f WHERE f.type=? AND json_extract(f.data,'$.missionId')=?"+(section==='files'?' AND '+payrollMissionFileScope:'')+" ORDER BY f.created,f.id LIMIT 21 OFFSET ?").bind(types[section],missionId,offset).all()).results.map(parse);
  return {...common,section,hasMore:rows.length>20,items:rows.slice(0,20).map(r=>section==='files'?{id:r.id,filename:r.data.filename,byteSize:r.data.byteSize,eventKind:r.data.eventKind}:r)};
 }
 if(view==='periods'){
  const privileged=actor.has('hr')||actor.has('payroll')||actor.has('approver');
  const where=privileged?'':" AND EXISTS(SELECT 1 FROM flow_entities s WHERE s.type='hr_payroll' AND json_extract(s.data,'$.periodId')=p.id AND json_extract(s.data,'$.state') IN ('approved','payable','partial','paid','closed'))";
  const rows=(await db.prepare("SELECT p.* FROM flow_entities p WHERE p.type='hr_period'"+where+" ORDER BY p.created DESC,p.id DESC LIMIT 21 OFFSET ?").bind(offset).all()).results.map(parse);
  return {...common,hasMore:rows.length>20,items:rows.slice(0,20).map(r=>({id:r.id,revision:r.revision,type:r.type,data:{title:r.data.title,start:r.data.start,end:r.data.end,state:r.data.state,memberIds:privileged?r.data.memberIds:undefined,workExceptions:privileged?r.data.workExceptions:undefined,payrollExceptions:privileged?r.data.payrollExceptions:undefined}}))};
 }
 if(view==='policies'){
  if(!['hr','payroll','approver'].some(r=>actor.has(r)))hrFail('دسترسی قواعد حقوق ندارید.',403);
  const rows=(await db.prepare("SELECT * FROM flow_entities WHERE type='hr_policy' AND json_extract(data,'$.engine')='contract-v2' ORDER BY created DESC,id DESC LIMIT 21 OFFSET ?").bind(offset).all()).results.map(parse);
  return {...common,hasMore:rows.length>20,items:rows.slice(0,20)};
 }
 if(!['slips','payments','mission_report'].includes(view)||!periodId)hrFail('نوع گزارش و دوره معتبر لازم است.');
 if(view==='payments'){
  const batch=await readPayrollPaymentBatch(actor,periodId),items=batch.items.slice(offset,offset+20);
  return {...common,hasMore:offset+20<batch.items.length,items,total:batch.total,count:batch.items.length,invalid:batch.items.filter(r=>r.error).length};
 }
 if(!monetaryRoles.some(r=>actor.has(r)))hrFail('فهرست فیش در دسترس نیست.',403);
 const where=actor.has('payroll')||actor.has('approver')?'':" AND json_extract(data,'$.state') IN ('approved','payable','partial','paid','closed')";
 const rows=(await db.prepare("SELECT * FROM flow_entities WHERE type='hr_payroll' AND json_extract(data,'$.periodId')=? AND json_extract(data,'$.state')<>'cancelled'"+where+" ORDER BY json_extract(data,'$.name'),id LIMIT 21 OFFSET ?").bind(periodId,offset).all()).results.map(parse);
 return {...common,hasMore:rows.length>20,items:rows.slice(0,20).map(r=>view==='mission_report'?{id:r.id,name:r.data.name,missions:r.data.missions||[],amountStatus:r.data.missionAmountStatus}:({id:r.id,revision:r.revision,type:r.type,data:{memberId:r.data.memberId,name:r.data.name,title:r.data.title,net:r.data.net,state:r.data.state,published:r.data.published,missionAmountStatus:r.data.missionAmountStatus}}))};
}

export async function readPayrollPaymentBatch(actor:any,periodId:string){
 if(!actor.has('treasury')&&!actor.has('finance'))hrFail('فهرست پرداخت برای خزانه و مالی است.',403);if(!periodId||periodId.length>200)hrFail('دوره معتبر لازم است.');
 const rows=(await storage().prepare("SELECT * FROM flow_entities WHERE type='hr_payroll' AND json_extract(data,'$.periodId')=? AND json_extract(data,'$.state') IN ('payable','partial') AND json_extract(data,'$.published')=1 ORDER BY json_extract(data,'$.name'),id LIMIT 101").bind(periodId).all()).results.map(parse);
 if(rows.length>100)hrFail('تعداد فیش‌های پرداخت از سقف افراد دوره بیشتر است؛ هم‌پوشانی بررسی شود.',409);
 const items=payrollPaymentList(rows),total=String(items.filter(r=>!r.error).reduce((n,r)=>n+BigInt(r.amount),BigInt(0)));return {items,total};
}

// Only files committed into an immutable report/finish/completion are evidence.
// Uploading a file into a pending form does not publish it to financial readers.
export const payrollMissionFileScope=`(EXISTS(SELECT 1 FROM flow_entities report,json_each(report.data,'$.fileIds') file WHERE report.type='staff_mission_report' AND json_extract(report.data,'$.missionId')=json_extract(f.data,'$.missionId') AND file.value=f.id) OR EXISTS(SELECT 1 FROM flow_entities mission WHERE mission.type='staff_mission' AND mission.id=json_extract(f.data,'$.missionId') AND (EXISTS(SELECT 1 FROM json_each(mission.data,'$.finish.fileIds') file WHERE file.value=f.id) OR EXISTS(SELECT 1 FROM json_each(mission.data,'$.returnCompletions') response,json_each(response.value,'$.fileIds') file WHERE file.value=f.id))))`;
