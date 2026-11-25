'use client';
import {useState,type FormEvent} from 'react';
import {employeeAssetFields,employeeAssetKinds,employeeAssetStates,employeeAssetTerminal,type EmployeeAssetField,type EmployeeAssetKind,type EmployeeAssetRequest} from '@/lib/asset-employee-request';

type Mode='employee_request'|'employee_request_resubmit'|'employee_request_edit'|'employee_request_review'|'employee_request_finalize'|'employee_request_seen';
type Props={record:{id:string;revision:number;data:any};accountId:string;owner:boolean;reviewer:boolean;onSaved:()=>Promise<void>};
const endpoint='/api/assets/workflow';
const fieldOptions=Object.entries(employeeAssetFields) as [EmployeeAssetField,string][];

export function AssetEmployeeRequests({record,accountId,owner,reviewer,onSaved}:Props){
 const [draft,setDraft]=useState<{mode:Mode;request?:EmployeeAssetRequest;id:string;fileId:string;revision:number;formKey:string}|null>(null);
 const [decision,setDecision]=useState('approve'),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const requests=Object.values(record.data.employeeRequests||{}) as EmployeeAssetRequest[];
 const options=Object.entries(employeeAssetKinds).filter(([kind])=>!requests.some(request=>request.kind===kind&&!employeeAssetTerminal(request)));
 const pending=!!record.data.pending||record.data.lifecycle==='disposed';
 function open(mode:Mode,request?:EmployeeAssetRequest){
  setDraft({mode,request,id:crypto.randomUUID(),fileId:crypto.randomUUID(),revision:record.revision,formKey:crypto.randomUUID()});setDecision('approve');setError('');setMessage('');
 }
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!draft||busy)return;
  const form=new FormData(event.currentTarget),file=form.get('photo'),request=draft.request,requestKind=request?.kind||form.get('kind') as EmployeeAssetKind;
  const body={id:draft.id,recordId:record.id,revision:draft.revision,confirmed:true,mode:draft.mode,requestKind,
   requestId:request?.id,requestVersion:request?.version,notes:form.get('notes')||'',decision,
   fields:form.getAll('field'),changes:Object.fromEntries(fieldOptions.filter(([key])=>form.has('change-'+key)).map(([key])=>[key,form.get('change-'+key)])),fileId:''};
  setBusy(true);setError('');
  try{
   if(file instanceof File&&file.name&&file.size){
    const query=new URLSearchParams({id:draft.fileId,assetId:record.id,revision:String(draft.revision),filename:file.name,purpose:'employee_request',requestOperationId:draft.id,confirmed:'true'});
    const uploaded=await fetch('/api/assets/files?'+query,{method:'POST',headers:{'Content-Type':'application/octet-stream','x-asset-account':accountId},body:file});
    const result=await uploaded.json() as {id?:string;error?:string};
    if(!uploaded.ok||!result.id)throw Error(result.error||'عکس بارگذاری نشد.');
    body.fileId=result.id;
   }
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','x-asset-account':accountId},body:JSON.stringify(body)});
   const result=await response.json() as {error?:string};
   if(!response.ok)throw Error(result.error||'درخواست ثبت نشد.');
   setDraft(null);setMessage('وضعیت درخواست ثبت شد.');
   window.dispatchEvent(new Event('nafasyar-tasks-changed'));
   await onSaved();
  }catch(failure){setError((failure as Error).message);}
  finally{setBusy(false);}
 }
 if(!owner&&!reviewer||!requests.length&&(!owner||pending))return null;
 const approval=draft?.mode==='employee_request_review'||draft?.mode==='employee_request_finalize';
 return <section className="asset-employee-requests" aria-label="درخواست‌های این مال">
  {owner&&!pending&&options.length>0&&<button className="btn" type="button" onClick={()=>open('employee_request')}>ثبت درخواست</button>}
  {requests.map(request=><article className="flow-card" key={request.id}>
   <strong>{employeeAssetKinds[request.kind]} · {employeeAssetStates[request.state]}</strong>
   {reviewer&&!owner&&<p>درخواست‌دهنده {request.requesterName}</p>}
   <p>{request.notes}</p>{request.editNote&&<p>توضیح اصلاحات: {request.editNote}</p>}
   {request.reviewNote&&<p>توضیح اموال‌دار {request.reviewNote}</p>}
   {request.photoId&&<a href={'/api/assets/files?id='+encodeURIComponent(request.photoId)+'&view=preview'} target="_blank" rel="noopener noreferrer">دیدن عکس درخواست</a>}
   {request.state==='review'&&<dl>{fieldOptions.filter(([key])=>Object.hasOwn(request.changes||{},key)).map(([key,label])=><div key={key}><dt>{label}</dt><dd>فعلی {request.baseline?.[key]||'—'} · پیشنهادی {request.changes?.[key]||'—'}</dd></div>)}</dl>}
   <div className="tools">
    {reviewer&&!owner&&!pending&&request.state==='submitted'&&<button className="btn" type="button" onClick={()=>open('employee_request_review',request)}>بررسی درخواست</button>}
    {reviewer&&!owner&&!pending&&request.state==='review'&&<button className="btn" type="button" onClick={()=>open('employee_request_finalize',request)}>بررسی اصلاحات</button>}
    {owner&&!pending&&request.state==='returned'&&<button className="btn" type="button" onClick={()=>open('employee_request_resubmit',request)}>تکمیل و ارسال دوباره</button>}
    {owner&&!pending&&request.state==='editing'&&<button className="btn" type="button" onClick={()=>open('employee_request_edit',request)}>اصلاح فیلدهای مجاز</button>}
    {owner&&employeeAssetTerminal(request)&&!request.seen&&<button className="btn" type="button" onClick={()=>open('employee_request_seen',request)}>مشاهدهٔ نتیجه</button>}
   </div>
  </article>)}
  {message&&<p role="status">{message}</p>}{error&&<p className="notice error" role="alert">{error}</p>}
  {draft&&<form className="panel inside" onSubmit={save} key={draft.formKey} onChange={()=>{if(error){setError('');setDraft(value=>value&&({...value,id:crypto.randomUUID(),fileId:crypto.randomUUID()}));}}}>
   <fieldset disabled={busy} className="formgrid">
    {draft.mode==='employee_request'&&<>
     <label className="field">نوع درخواست<select name="kind" required defaultValue=""><option value="">انتخاب کنید</option>{options.map(([kind,label])=><option value={kind} key={kind}>{label}</option>)}</select></label>
     <label className="field">عکس (اختیاری)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"/></label>
    </>}
    {approval&&<label className="field">تصمیم<select value={decision} onChange={event=>setDecision(event.target.value)}><option value="approve">تأیید</option><option value="return">برگشت برای تکمیل</option><option value="reject">رد درخواست</option></select></label>}
    {draft.mode==='employee_request_review'&&draft.request?.kind==='edit'&&decision==='approve'&&<fieldset className="wide">
     <legend>فیلدهای قابل اصلاح</legend>{fieldOptions.map(([key,label])=><label className="flow-check" key={key}><input type="checkbox" name="field" value={key}/>{label}</label>)}
    </fieldset>}
    {draft.mode==='employee_request_edit'&&fieldOptions.filter(([key])=>draft.request?.fields?.includes(key)).map(([key,label])=><label className="field" key={key}>{label}
     <input name={'change-'+key} maxLength={300} required={key==='name'||key==='location'} defaultValue={draft.request?.changes?.[key]??draft.request?.baseline?.[key]??''}/>
    </label>)}
    {draft.mode==='employee_request_seen'?<p>نتیجهٔ این درخواست را مشاهده کردم.</p>:<label className="field wide">توضیح<textarea name="notes" required maxLength={4000} defaultValue={draft.mode==='employee_request_resubmit'?draft.request?.notes:''}/></label>}
    <div className="tools wide"><button type="submit" className="btn primary">{busy?'در حال ثبت…':'تأیید و ثبت'}</button><button type="button" className="btn" onClick={()=>setDraft(null)}>بستن فرم</button></div>
   </fieldset>
  </form>}
 </section>;
}
