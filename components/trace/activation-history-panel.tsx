'use client';

import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {Search} from 'lucide-react';
import {formatActivationTime,type PhoneActivationHistoryRow} from '@/lib/phone-activation-contract';
import {ActivationDossier} from './activation-dossier';

type Filters={q:string;from:string;to:string;agency:string;kind:string};
type Agency={id:string;name:string};
const defaults:Filters={q:'',from:'',to:'',agency:'',kind:''};
const types={legacy:'ثبت در سیستم قبلی',first:'فعال‌سازی اولیه',board:'تعویض برد',code:'صدور کد مجدد'};

export function ActivationHistoryPanel({accountId}:{accountId:string}){
 const [draft,setDraft]=useState(defaults),[advanced,setAdvanced]=useState(true);
 const [active,setActive]=useState(defaults),[page,setPage]=useState(1),[more,setMore]=useState(false);
 const [rows,setRows]=useState<PhoneActivationHistoryRow[]>([]),[selected,setSelected]=useState('');
 const [agencies,setAgencies]=useState<Agency[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const requestId=useRef(0);
 const dossier=rows.find(row=>row.id===selected);
 const request=useCallback(async<T,>(params:URLSearchParams,signal?:AbortSignal)=>{
  const response=await fetch('/api/phone-activation?'+params,{cache:'no-store',headers:{'x-assistant-account':accountId},signal});
  const data=await response.json() as T&{error?:string;accountId:string};
  if(!response.ok||data.accountId!==accountId)throw Error(data.error||'دریافت سوابق انجام نشد.');
  return data;
 },[accountId]);
 const load=useCallback(async(filters:Filters,next:number,signal?:AbortSignal)=>{
  const current=++requestId.current;
  setBusy(true);setError('');setSelected('');
  try{
   const data=await request<{rows:PhoneActivationHistoryRow[];more:boolean}>(new URLSearchParams({view:'history',page:String(next),...filters}),signal);
   if(current!==requestId.current||signal?.aborted)return;
   setActive(filters);setPage(next);setRows(data.rows);setMore(data.more);
   const exact=filters.q.trim().replace(/[۰-۹٠-٩]/g,char=>String(char.charCodeAt(0)-(char>='۰'?1776:1632)));
   if(exact)setSelected(data.rows.find(row=>row.serial.toUpperCase()===exact.toUpperCase())?.id||'');
  }catch(error){
   if(current===requestId.current&&!signal?.aborted){setRows([]);setMore(false);setError((error as Error).message);}
  }finally{if(current===requestId.current&&!signal?.aborted)setBusy(false);}
 },[request]);
 const [directoryError,setDirectoryError]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();
  void load(defaults,1,controller.signal);
  request<{agencies:Agency[]}>(new URLSearchParams({view:'history-agencies'}),controller.signal)
   .then(data=>setAgencies(data.agencies))
   .catch(()=>{if(!controller.signal.aborted)setDirectoryError(true);});
  return()=>controller.abort();
 },[load,request]);
 const change=(key:keyof Filters,value:string)=>setDraft(current=>({...current,[key]:value}));
 function search(event:FormEvent){
  event.preventDefault();
  void load(advanced?draft:{...active,q:draft.q},1);
 }

 return <section dir="rtl" className="panel inside" aria-label="سوابق فعال‌سازی">
  <h2>سوابق فعال‌سازی</h2>
  <form onSubmit={search}>
   <div className="tools">
    <label className="field">سریال دستگاه یا نام مشتری<input type="search" value={draft.q} maxLength={160} onChange={event=>change('q',event.target.value)}/></label>
    <button className="btn" type="button" aria-expanded={advanced} aria-controls="activation-history-filters" onClick={()=>setAdvanced(value=>!value)}>جست‌وجوی پیشرفته</button>
   </div>
   {advanced&&<div className="formgrid" id="activation-history-filters">
    <label className="field">از تاریخ شمسی<input dir="ltr" placeholder="۱۴۰۵/۰۸/۱۲" maxLength={12} value={draft.from} onChange={event=>change('from',event.target.value)}/></label>
    <label className="field">تا تاریخ شمسی<input dir="ltr" placeholder="۱۴۰۵/۰۸/۳۰" maxLength={12} value={draft.to} onChange={event=>change('to',event.target.value)}/></label>
    <label className="field">نمایندگی<select value={draft.agency} onChange={event=>change('agency',event.target.value)}>
     <option value="">همهٔ نمایندگی‌ها</option>{agencies.map(agency=><option key={agency.id} value={agency.id}>{agency.name}</option>)}
    </select></label>
    <label className="field">نوع رویداد<select value={draft.kind} onChange={event=>change('kind',event.target.value)}>
     <option value="">همهٔ رویدادها</option>{Object.entries(types).map(([key,label])=><option key={key} value={key}>{label}</option>)}
    </select></label>
    {directoryError&&<p role="status">فهرست نمایندگی‌ها بارگیری نشد. برای بارگیری دوباره، صفحه را تازه کنید.</p>}
   </div>}
   <div className="tools"><button className="btn primary" type="submit" disabled={busy}><Search size={17} aria-hidden="true"/>{advanced?'جست‌وجو با این فیلترها':'جست‌وجو'}</button></div>
  </form>
  {error&&<p className="notice error" role="alert">{error}</p>}
  {busy&&<p role="status">در حال جست‌وجوی سوابق…</p>}
  {!busy&&!error&&!rows.length&&<p role="status">سابقه‌ای با این جست‌وجو پیدا نشد.</p>}
  {!!rows.length&&<div className="as-table"><table>
   <thead><tr><th>سریال دستگاه</th><th>مشتری</th><th>تاریخ</th><th>نمایندگی</th><th>رویداد</th></tr></thead>
   <tbody>{rows.map(row=><tr key={row.id}>
    <td><button className="btn" type="button" aria-pressed={row.id===selected} onClick={()=>setSelected(row.id)}><bdi>{row.serial||'مشاهدهٔ سابقه'}</bdi></button></td>
    <td>{row.customer.name||'—'}</td><td>{formatActivationTime(row.at,row.kind==='legacy')}</td><td>{row.dealer||'—'}</td><td>{types[row.kind]}</td>
   </tr>)}</tbody>
  </table></div>}
  {(more||page>1)&&<div className="tools">
   <button className="btn" type="button" disabled={busy||page===1} onClick={()=>void load(active,page-1)}>صفحهٔ قبل</button>
   <button className="btn" type="button" disabled={busy||!more} onClick={()=>void load(active,page+1)}>صفحهٔ بعد</button>
  </div>}
  {dossier&&<section className="panel inside" aria-label="شناسنامهٔ دستگاه">
   <h2>شناسنامهٔ دستگاه <bdi>{dossier.serial}</bdi></h2>
   <ActivationDossier key={dossier.id} record={dossier}/>
  </section>}
 </section>;
}
