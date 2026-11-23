'use client';

import {useRef,useState} from 'react';
import {CircleAlert,CircleCheck,Clock3} from 'lucide-react';
import {ReceiptAttachment} from './receipt-attachment';
import {personnelFileCategories} from '@/lib/personnel-contract';
import {personnelSelfFileCategories,personnelDocumentStatus} from '@/lib/personnel-documents';

const documentReview={
 pending:{text:'در انتظار بررسی اداری',icon:Clock3},
 rejected:{text:'نیازمند اصلاح',icon:CircleAlert},
 approved:{text:'تأییدشده',icon:CircleCheck},
};

export function PersonnelIdentityDocuments({data,onSaved}:{data:any;onSaved:()=>Promise<any>}){
 const [category,setCategory]=useState('national_card');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const lock=useRef(false),ids=useRef(new WeakMap<File,string>());
 const employee=data.records.find((r:any)=>r.type==='hr_employee'&&r.data.memberId===data.me);
 if(!employee)return <p>برای بارگذاری مدارک، ابتدا پرونده شما باید توسط مسئول اداری تشکیل شود.</p>;
 const status=personnelDocumentStatus(data.records,employee.id);
 const files=data.records.filter((r:any)=>r.type==='hr_file'&&r.data.caseId===employee.id);
 const categoryLabel=personnelFileCategories[category];

 async function upload(selected:File[]){
  if(lock.current||!selected.length)return;
  lock.current=true;setBusy(true);setError('');setMessage('');
  let uploaded=0;
  let failedFile:File|undefined;
  try{
   for(const file of selected){
    failedFile=file;
    let id=ids.current.get(file);
    if(!id){id=crypto.randomUUID();ids.current.set(file,id);}
    const query=new URLSearchParams({id,caseId:employee.id,filename:file.name,category,confirmed:'true'});
    const response=await fetch('/api/personnel/files?'+query,{method:'POST',headers:{'Content-Type':'application/octet-stream','x-assistant-account':data.accountId},body:file});
    const result=await response.json() as {error?:string};
    if(!response.ok)throw Error(result.error||'بارگذاری انجام نشد.');
    uploaded++;
   }
  }catch(e){
   const detail=(e as Error).message;
   setError('ارسال «'+failedFile?.name+'» تأیید نشد. '+detail+(selected.length-uploaded>1?' فایل‌های بعدی ارسال نشدند.':''));
  }
  if(uploaded){
   const sent=selected.length===1?'«'+categoryLabel+'» ارسال شد.':uploaded.toLocaleString('fa-IR')+' از '+selected.length.toLocaleString('fa-IR')+' فایل ارسال شد.';
   setMessage(sent+' وضعیت بررسی در فهرست مدارک همین صفحه دیده می‌شود.');
  }
  try{await onSaved();}
  catch{if(uploaded)setMessage(current=>current+' برای دیدن وضعیت به‌روز، صفحه را تازه‌سازی کنید.');}
  finally{lock.current=false;setBusy(false);}
 }

 return <section className="panel inside"><h3>مدارک هویتی من</h3>
  <p>{status.complete?'مدارک هویتی کامل و تأییدشده است.':'پرونده ناقص است.'}
   {status.pending>0&&' '+status.pending.toLocaleString('fa-IR')+' مدرک در انتظار بررسی اداری است.'}</p>
  {status.missing.length>0&&<p>مدارک لازم برای تکمیل پرونده: {status.missing.map(k=>personnelFileCategories[k]).join('، ')}</p>}
  <div className="tools">
   <label className="field">نوع مدرک<select disabled={busy} value={category} onChange={e=>setCategory(e.target.value)}>
    {personnelSelfFileCategories.map(k=><option key={k} value={k}>{personnelFileCategories[k]}</option>)}
   </select></label>
   <ReceiptAttachment file={null} multiple allowDocuments subject={categoryLabel.replace(/^تصویر /,'')} disabled={busy}
    onChange={file=>{if(file)void upload([file]);}} onFiles={files=>void upload(files)}/>
  </div>
  <div role="status">{(message||busy)&&<p className="notice">{message||'در حال ارسال '+categoryLabel+'…'}</p>}</div>
  {error&&<p className="notice error" role="alert">{error}</p>}
  {files.length>0&&<ul className="hr-documents" aria-label="وضعیت مدارک ارسال‌شده">{files.map((r:any)=>{
   const review=r.data.reviewState==='pending'?documentReview.pending:r.data.reviewState==='rejected'?documentReview.rejected:documentReview.approved;
   const Icon=review.icon;
   return <li key={r.id} className="notice">
    <strong>{personnelFileCategories[r.data.category]||'مدرک'}</strong>
    <div className="tools"><span className="inline-flex items-center gap-2"><Icon size={16} aria-hidden="true"/>{review.text}</span>
     <a href={'/api/personnel/files?id='+encodeURIComponent(r.id)}>{r.data.filename}</a></div>
    {r.data.reviewReason&&<p>توضیح اداری: {r.data.reviewReason}</p>}
   </li>;
  })}</ul>}
 </section>;
}
