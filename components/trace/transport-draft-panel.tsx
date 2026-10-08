"use client";
import {useEffect,useRef,useState} from 'react';
import {transportActions} from '@/lib/transport-contract';
import {formatDateTime} from '@/lib/persian-date';
import {transportDrafts,removeTransportDraft,saveTransportDraft,type TransportDraft} from '@/lib/transport-drafts';
export function TransportDraftPanel({accountId,onReview,onSent}:{accountId:string;onReview:(row:TransportDraft)=>Promise<void>;onSent:()=>void}){
 const [rows,setRows]=useState<TransportDraft[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');const epoch=useRef(0);
 async function load(){const current=epoch.current;try{const next=await transportDrafts(accountId);if(current===epoch.current)setRows(next)}catch(e){if(current===epoch.current)setError((e as Error).message)}}
 useEffect(()=>{epoch.current++;setRows([]);setError('');setMessage('');void load();const refresh=()=>void load();window.addEventListener('nafasyar-transport-drafts',refresh);return()=>{epoch.current++;window.removeEventListener('nafasyar-transport-drafts',refresh)}},[accountId]);
 async function send(row:TransportDraft){const current=epoch.current;setBusy(true);setError('');setMessage('');try{
  const headers={'X-Transport-Account':accountId};let r:Response;
  if(row.kind==='operation')r=await fetch('/api/transport',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(row.payload)});
  else{const form=new FormData();form.append('file',row.file!);r=await fetch('/api/transport/files?'+new URLSearchParams({mission:row.missionId,purpose:row.purpose!,requestId:row.id,...(row.revision?{revision:String(row.revision)}:{})}),{method:'POST',headers,body:form})}
  const result=await r.json() as any;if(!r.ok)throw Error(result.error||'ارسال انجام نشد.');await removeTransportDraft(accountId,row.id);if(current===epoch.current){setMessage('ارسال و ثبت روی سرور تأیید شد.');await load();onSent()}
 }catch(e){if(current===epoch.current)setError((e as Error).message+' پیش‌نویس حفظ شد. اگر وضعیت مأموریت تغییر کرده، بازبینی کنید.')}finally{if(current===epoch.current)setBusy(false)}}
 async function review(row:TransportDraft){const current=epoch.current;setBusy(true);setError('');try{
  const r=await fetch('/api/transport?'+new URLSearchParams({id:row.missionId,operation:row.id}),{headers:{'X-Transport-Account':accountId},cache:'no-store'}),status=await r.json() as any;if(!r.ok)throw Error(status.error);if(current!==epoch.current)return;
  if(status.saved){await removeTransportDraft(accountId,row.id);setMessage('این مورد قبلاً ثبت شده بود؛ از پیش‌نویس‌ها حذف شد.');await load();onSent();return;}
  if(row.kind==='file'){await saveTransportDraft({...row,revision:status.revision});setMessage('وضعیت مدرک بازبینی شد؛ برای ارسال دوباره دکمهٔ ارسال را بزنید.');await load();}
  else await onReview({...row,payload:{...row.payload,revision:status.revision}});
 }catch(e){if(current===epoch.current)setError((e as Error).message)}finally{if(current===epoch.current)setBusy(false)}}
 return <section><h2>پیش‌نویس‌های ارسال‌نشده</h2><p>متن و عکس تا هفت روز در همین مرورگر و برای همین حساب نگهداری می‌شوند. ارسال فقط با دکمهٔ «ارسال» انجام می‌شود؛ تا تأیید سرور، کار انجام‌شده محسوب نمی‌شود.</p>{error&&<p className="notice error" role="alert">{error}</p>}{message&&<p className="notice" role="status">{message}</p>}{!rows.length&&<p className="empty">پیش‌نویسی ندارید.</p>}{rows.map(row=><article className="flow-card" key={row.id}><h3>{row.missionCode} · {row.kind==='file'?row.file?.name:transportActions[row.payload?.mode]}</h3><p>{formatDateTime(new Date(row.createdAt).toISOString())}</p>{row.kind==='operation'&&<p>{row.payload?.notes}</p>}<div className="tools"><button className="btn primary" disabled={busy} onClick={()=>void send(row)}>ارسال</button><button className="btn" disabled={busy} onClick={()=>void review(row)}>بازبینی با وضعیت جدید</button><button className="btn" disabled={busy} onClick={async()=>{if(window.confirm('این پیش‌نویس ارسال‌نشده حذف شود؟')){await removeTransportDraft(accountId,row.id);await load()}}}>حذف پیش‌نویس</button></div></article>)}</section>;
}
