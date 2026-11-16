'use client';
import {useEffect,useState} from 'react';
import {roleTaskTools} from '@/lib/cartable-view';
import {SalesCallsPanel} from './sales-calls-panel';
import './cartable.css';
export function RoleTaskTools({accountId,profileId='',roleSample=false,onNavigate}:{accountId:string;profileId?:string;roleSample?:boolean;onNavigate:(section:string,target?:string)=>void}){
 const [open,setOpen]=useState(false),[data,setData]=useState<any>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{if(!open)return;const abort=new AbortController();setData(null);setError('');void fetch('/api/tasks',{cache:'no-store',signal:abort.signal}).then(async r=>{const j=await r.json() as any;if(!r.ok)throw Error(j.error||'دریافت ابزارهای نقش انجام نشد.');if(j.accountId!==accountId||(j.profileReview?.id||'')!==profileId)throw Error('جایگاه فعال تغییر کرده است؛ صفحه را تازه کنید.');if(!abort.signal.aborted)setData(j)}).catch(e=>{if(!abort.signal.aborted)setError(e.message)});return()=>abort.abort()},[open,accountId,profileId,retry]);
 const current=data?.accountId===accountId&&(data?.profileReview?.id||'')===profileId?data:null;
 if(current?.requiresServiceScope)return null;
 const tools=current?[...(!roleSample?['inbox-workflow','reminders']:[]),...(current.receiptNotesAvailable?['receipt-notes']:[]),...(current.canPurchaseServices===true?['purchase-services']:[]),'review',...(current.ownPositions?.length?['positions']:[]),...(current.notifications?.some((n:any)=>!n.read_at)?['notifications']:[]),...(current.isAdmin?['management','definitions']:[])]:[];
 return <details className="role-task-tools" open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary>ابزارهای نقش و پیگیری‌ها</summary>{open&&<><p>فرم‌ها و تنظیمات تکمیلی اینجا در دسترس‌اند؛ کارهای منتظر اقدام را از کارتابل باز کنید.</p>{error?<p className="notice" role="alert">{error}<button className="btn" type="button" onClick={()=>setRetry(n=>n+1)}>تلاش دوباره</button></p>:!current?<p role="status">در حال دریافت…</p>:<><div className="tools">{tools.map(tool=><button type="button" className="btn" key={tool} onClick={()=>onNavigate('tasks','role-tools:'+tool)}>{roleTaskTools[tool]}</button>)}</div>{!roleSample&&<SalesCallsPanel compact onNavigate={onNavigate}/>}</>}</>}</details>;
}
