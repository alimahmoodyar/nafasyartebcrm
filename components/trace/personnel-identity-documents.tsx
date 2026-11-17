'use client';
import {useRef,useState} from 'react';
import {ReceiptAttachment} from './receipt-attachment';
import {personnelFileCategories} from '@/lib/personnel-contract';
import {identityDocumentCategories,personnelDocumentStatus} from '@/lib/personnel-documents';

export function PersonnelIdentityDocuments({data,onSaved}:{data:any;onSaved:()=>Promise<any>}){
 const [category,setCategory]=useState('national_card'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const lock=useRef(false),ids=useRef(new WeakMap<File,string>());
 const employee=data.records.find((r:any)=>r.type==='hr_employee'&&r.data.memberId===data.me);
 if(!employee)return <p>برای بارگذاری مدارک، ابتدا پرونده شما باید توسط مسئول اداری تشکیل شود.</p>;
 const status=personnelDocumentStatus(data.records,employee.id),files=data.records.filter((r:any)=>r.type==='hr_file'&&r.data.caseId===employee.id);
 async function upload(selected:File[]){if(lock.current||!selected.length)return;lock.current=true;setBusy(true);setError('');setMessage('');try{for(const file of selected){let id=ids.current.get(file);if(!id){id=crypto.randomUUID();ids.current.set(file,id)}const q=new URLSearchParams({id,caseId:employee.id,filename:file.name,category,confirmed:'true'}),r=await fetch('/api/personnel/files?'+q,{method:'POST',headers:{'Content-Type':'application/octet-stream','x-assistant-account':data.accountId},body:file}),j=await r.json() as any;if(!r.ok)throw Error(j.error||'بارگذاری انجام نشد.');}await onSaved();setMessage('مدارک بارگذاری شد؛ نتیجه بررسی اداری در همین بخش نمایش داده می‌شود.')}catch(e){setError((e as Error).message);try{await onSaved()}catch{}}finally{lock.current=false;setBusy(false)}}
 return <section className="panel inside"><h3>مدارک هویتی من</h3><p role="status">{status.complete?'مدارک هویتی کامل و تأییدشده است.':'پرونده ناقص است؛ مدارک را بارگذاری کنید تا مسئول اداری بررسی کند.'}{status.pending>0&&' '+status.pending.toLocaleString('fa-IR')+' مدرک در انتظار بررسی اداری است.'}</p>{status.missing.length>0&&<p>نیازمند تکمیل: {status.missing.map(k=>personnelFileCategories[k]).join('، ')}</p>}
 {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}<div className="tools"><label className="field">نوع مدرک<select disabled={busy} value={category} onChange={e=>setCategory(e.target.value)}>{identityDocumentCategories.map(k=><option key={k} value={k}>{personnelFileCategories[k]}</option>)}</select></label><ReceiptAttachment file={null} multiple allowDocuments subject={personnelFileCategories[category].replace(/^تصویر /,'')} disabled={busy} onChange={f=>{if(f)void upload([f])}} onFiles={f=>void upload(f)}/></div>
 <ul className="hr-documents">{files.map((r:any)=><li key={r.id}><a href={'/api/personnel/files?id='+encodeURIComponent(r.id)}>{r.data.filename}</a><small>{personnelFileCategories[r.data.category]||'مدرک'} · {r.data.reviewState==='pending'?'در انتظار بررسی اداری':r.data.reviewState==='rejected'?'نیازمند اصلاح':'تأییدشده'}</small>{r.data.reviewReason&&<p>نظر اداری: {r.data.reviewReason}</p>}</li>)}</ul></section>;
}
