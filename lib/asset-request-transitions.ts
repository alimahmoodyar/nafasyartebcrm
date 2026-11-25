import {AccessError} from './authorization';
import {taskRequired,taskText} from './duties';
import {storage} from './storage';
import {currentEmployeeAssetRequests,employeeAssetFields,employeeAssetKinds,employeeAssetTerminal,type EmployeeAssetField,type EmployeeAssetKind,type EmployeeAssetRequest} from './asset-employee-request';

const fail=(message:string,status=409):never=>{throw new AccessError(message,status)};
type Context={userId:string;name:string;memberId:string;employee:boolean;custodian:boolean};

export async function changeEmployeeAssetRequest(asset:any,data:any,input:any,actor:Context,guards:D1PreparedStatement[],now:string){
 const kind=input.requestKind as EmployeeAssetKind;
 if(!Object.hasOwn(employeeAssetKinds,kind))fail('نوع درخواست معتبر نیست.',400);
 const current=currentEmployeeAssetRequests(data).find(row=>row.kind===kind);
 const own=actor.employee&&actor.memberId===data.holderId&&data.holderKind==='employee';
 const reviewing=['employee_request_review','employee_request_finalize'].includes(input.mode);
 if(reviewing?(!actor.custodian||current?.requesterId===actor.memberId):!own)fail('این اقدام در دسترسی شما نیست.',403);
 if(data.pending&&input.mode!=='employee_request_seen')fail('ابتدا انتقال در جریان این مال را تعیین تکلیف کنید.');
 const note=input.mode==='employee_request_seen'?'':taskRequired(input.notes,4000);
 const save=(request:EmployeeAssetRequest)=>{data.employeeRequests={...data.employeeRequests,[kind]:{...request,version:input.id}};};
 if(input.mode==='employee_request'){
  if(current&&!employeeAssetTerminal(current))fail('برای این مال درخواست بازی از همین نوع وجود دارد.');
  let photoId:string|undefined;
  if(input.fileId){
   const db=storage(),file=await db.prepare("SELECT id,data,revision FROM flow_entities WHERE id=? AND type='asset_file'").bind(taskRequired(input.fileId)).first<{id:string;data:string;revision:number}>();
   const proof=file&&JSON.parse(file.data);
   if(!file||proof.purpose!=='employee_request'||proof.assetId!==asset.id||proof.actor!==actor.userId||proof.requestOperationId!==input.id||proof.custodyId!==(data.custodyId||''))throw new AccessError('عکس پیوست باید متعلق به همین درخواست باشد.',403);
   photoId=file.id;
   guards.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN guard ELSE 0 END WHERE id=?').bind(file.id,file.revision,input.id));
  }
  save({id:input.id,kind,requesterId:actor.memberId,requesterName:actor.name,custodyId:data.custodyId||'',notes:note,state:'submitted',version:input.id,photoId});
  return;
 }
 if(!current||current.id!==input.requestId||current.version!==input.requestVersion)throw new AccessError('درخواست تغییر کرده است. پرونده را تازه کنید.',409);
 if(input.mode==='employee_request_seen'){
  if(!employeeAssetTerminal(current))fail('درخواست هنوز باز است.');
  save({...current,seen:true});return;
 }
 if(input.mode==='employee_request_resubmit'){
  if(current.state!=='returned')fail('درخواست در مرحله تکمیل نیست.');
  save({...current,notes:note,state:'submitted'});return;
 }
 if(input.mode==='employee_request_edit'){
  if(current.state!=='editing'||!current.fields?.length)throw new AccessError('مجوز ویرایش معتبر نیست.',403);
  const changes:EmployeeAssetRequest['changes']={};
  const proposed=input.changes;
  if(!proposed||typeof proposed!=='object'||Array.isArray(proposed)||Object.keys(proposed).some(key=>!current.fields!.includes(key as EmployeeAssetField)))fail('فقط فیلدهای مجاز را ویرایش کنید.',400);
  for(const key of current.fields){
   if(!Object.hasOwn(proposed,key))continue;
   const value=['name','location'].includes(key)?taskRequired(proposed[key],300):taskText(proposed[key],300);
   if(value!==current.baseline?.[key])changes[key]=value;
  }
  if(!Object.keys(changes).length)fail('حداقل یک تغییر وارد کنید.',400);
  save({...current,changes,editNote:note,state:'review'});return;
 }
 const final=input.mode==='employee_request_finalize';
 if(final?current.state!=='review':current.state!=='submitted')fail('درخواست در مرحله بررسی نیست.');
 if(!['approve','return','reject'].includes(input.decision))fail('تصمیم معتبر انتخاب کنید.',400);
 if(input.decision!=='approve'){
  const state=input.decision==='reject'?'rejected':final?'editing':'returned';
  const baseline=final&&state==='editing'?Object.fromEntries((current.fields||[]).map(key=>[key,String(data[key]||'')])):current.baseline;
  save({...current,reviewNote:note,state,baseline,seen:false});return;
 }
 if(final){
  for(const key of current.fields||[]){
   if(!Object.hasOwn(current.changes||{},key))continue;
   if(String(data[key]||'')!==current.baseline?.[key])fail('یکی از اطلاعات مال تغییر کرده است. درخواست را برای اصلاح دوباره برگردانید.');
   data[key]=current.changes?.[key];
  }
  save({...current,reviewNote:note,state:'approved',seen:false});return;
 }
 if(kind==='repair'){
  if(data.issue?.state==='open'||['working','awaiting_review','rework'].includes(data.service?.state))fail('برای همین مال تعمیر یا خرابی بازی وجود دارد.');
  data.issue={id:current.id,state:'open',kind:'fault',at:now,by:actor.userId,notes:current.notes,employeeRequestId:current.id};
  data.condition='repair';
  save({...current,reviewNote:note,state:'repair_open'});return;
 }
 const fields=input.fields as EmployeeAssetField[];
 if(!Array.isArray(fields)||!fields.length||new Set(fields).size!==fields.length||fields.some(key=>!Object.hasOwn(employeeAssetFields,key)))fail('فیلدهای مجاز اصلاح را انتخاب کنید.',400);
 save({...current,fields,baseline:Object.fromEntries(fields.map(key=>[key,String(data[key]||'')])),reviewNote:note,state:'editing'});
}
