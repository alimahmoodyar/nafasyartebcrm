import {AccessError} from './authorization';
import {sreq} from './sales';
export function reviewPersonnelFile(body:any,file:any,rows:any[],actor:any,now:string){
 if(!actor.has('hr'))throw new AccessError('بررسی مدرک فقط برای مسئول اداری مجاز است.',403);
 const employee=rows.find(r=>r.id===file?.data.caseId&&r.type==='hr_employee');
 if(file?.type!=='hr_file'||!employee)throw new AccessError('مدرک پرونده پرسنلی یافت نشد.',404);
 if(file.data.reviewState!=='pending')throw new AccessError('این مدرک قبلاً بررسی شده است.',409);
 return {...file,data:{...file.data,reviewState:body.mode==='file_approve'?'approved':'rejected',reviewedBy:actor.userId,reviewedAt:now,reviewReason:body.mode==='file_reject'?sreq(body.notes,4000):''}};
}
