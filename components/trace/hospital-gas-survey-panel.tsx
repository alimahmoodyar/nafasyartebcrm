'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import type {SurveyAnswers} from '@/lib/hospital-gas-survey-contract';

type Survey={id:string;center:string;agentId:string;expires:string;link?:string;submitted?:string;revoked?:string;answers?:SurveyAnswers;syncUrl?:string;syncTicket?:string};
type Data={surveys:Survey[];buyers:{id:string;name:string}[]};
const url='/api/hospital-gas-survey';

export function HospitalGasSurveyPanel({onAnswers}:{onAnswers:(answers:SurveyAnswers)=>void}){
 const [open,setOpen]=useState(false),[data,setData]=useState<Data|null>(null);
 const [center,setCenter]=useState(''),[agentId,setAgentId]=useState(''),[days,setDays]=useState('7');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [fresh,setFresh]=useState<Survey|null>(null);
 const createId=useRef('');
 async function relay(id:string,endpoint:{syncUrl:string;syncTicket:string},mode:'read'|'revoke'){
  const response=await fetch(endpoint.syncUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,ticket:endpoint.syncTicket,mode})});
  const result=await response.json() as {receipt?:string;error?:string};
  if(!response.ok)throw Error(result.error||'ارتباط با پرسش‌نامه برقرار نشد.');
  if(result.receipt)await act({id,mode:'import',receipt:result.receipt});
  return !!result.receipt;
 }
 async function load(sync=true){
  const response=await fetch(url,{cache:'no-store'}),next=await response.json() as Data&{error?:string};
  if(!response.ok)throw Error(next.error);
  setData(next);
  if(sync){
   const outstanding=next.surveys.filter(survey=>survey.syncUrl&&survey.syncTicket);
   const results=await Promise.allSettled(outstanding.map(survey=>relay(survey.id,{syncUrl:survey.syncUrl!,syncTicket:survey.syncTicket!},'read')));
   if(results.some(result=>result.status==='fulfilled'&&result.value))await load(false);
   if(results.some(result=>result.status==='rejected'))setError('همگام‌سازی بعضی پاسخ‌ها انجام نشد. دوباره تازه‌سازی کنید.');
  }
 }
 useEffect(()=>{if(open)void load().catch(error=>setError(error.message));},[open]);
 async function act<T>(body:object){
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,confirmed:true})}),next=await response.json() as T&{error?:string};
  if(!response.ok)throw Error(next.error);
  return next;
 }
 async function create(event:FormEvent){
  event.preventDefault();
  if(busy)return;
  setBusy(true);setError('');setMessage('');
  createId.current||=crypto.randomUUID();
  try{
   const result=await act<Survey>({mode:'create',id:createId.current,center,agentId,days:Number(days)});
   setFresh(result);setCenter('');setAgentId('');createId.current='';setMessage('لینک ساخته شد.');
   await load();
  }catch(error){setError((error as Error).message);}finally{setBusy(false);}
 }
 async function copy(link:string){
  try{await navigator.clipboard.writeText(link);setMessage('لینک کپی شد.');}catch{setMessage('می‌توانید لینک را از کادر انتخاب و کپی کنید.');}
 }
 async function revoke(survey:Survey){
  if(busy||!window.confirm('لینک این پرسش‌نامه لغو شود؟'))return;
  setBusy(true);setError('');setMessage('');
  try{const ticket=await act<{syncUrl:string;syncTicket:string}>({mode:'prepare_revoke',id:survey.id});await relay(survey.id,ticket,'revoke');if(fresh?.id===survey.id)setFresh(null);await load();setMessage('وضعیت لینک به‌روز شد.');}
  catch(error){setError((error as Error).message);}finally{setBusy(false);}
 }
 return <section className="panel inside" dir="rtl">
  <button data-pair-open="hospital-gas-survey-panel:c4ad25218ef4" type="button" className="btn" aria-expanded={open} onClick={()=>setOpen(!open)}>لینک پرسش‌نامه و پاسخ‌ها</button>
  {open&&<>
   <form className="space-y-3" onSubmit={create}>
    <h3>ساخت لینک پرسش‌نامه</h3>
    <label className="field">نام بیمارستان یا مرکز<input required maxLength={160} value={center} onChange={event=>{createId.current='';setCenter(event.target.value);}}/></label>
    <label className="field">پروندهٔ فروش (اختیاری)<select value={agentId} onChange={event=>{createId.current='';setAgentId(event.target.value);const buyer=data?.buyers.find(row=>row.id===event.target.value);if(buyer)setCenter(buyer.name);}}>
     <option value="">بدون اتصال به پروندهٔ فروش</option>{data?.buyers.map(buyer=><option key={buyer.id} value={buyer.id}>{buyer.name}</option>)}
    </select></label>
    <label className="field">اعتبار لینک (روز)<input required type="number" min="1" max="30" value={days} onChange={event=>{createId.current='';setDays(event.target.value);}}/></label>
    <button type="submit" className="btn primary" disabled={busy}>ساخت لینک</button>
   </form>
   {fresh?.link&&<div className="tools"><input aria-label="لینک پرسش‌نامه" dir="ltr" readOnly value={fresh.link} onFocus={event=>event.currentTarget.select()}/><button type="button" className="btn" onClick={()=>void copy(fresh.link!)}>کپی لینک</button></div>}
   {error&&<p className="notice error" role="alert">{error}</p>}
   {message&&<p role="status">{message}</p>}
   <h3>پرسش‌نامه‌ها</h3>
   <button type="button" className="btn" disabled={busy} onClick={()=>void load().catch(error=>setError(error.message))}>تازه‌سازی پاسخ‌ها</button>
   {data?.surveys.map(survey=><article data-pair-row={JSON.stringify(survey.id)} className="flow-card" key={survey.id}>
    <strong>{survey.center}</strong>
    <p>{survey.submitted?'پاسخ دریافت شد':survey.revoked?'لغوشده':survey.link?'در انتظار پاسخ':'منقضی‌شده'} · مهلت {new Date(survey.expires).toLocaleDateString('fa-IR')}</p>
    {survey.link&&<div className="tools"><button type="button" className="btn" onClick={()=>void copy(survey.link!)}>کپی لینک</button><button type="button" className="btn" disabled={busy} onClick={()=>void revoke(survey)}>لغو لینک</button></div>}
    {survey.answers&&<button type="button" className="btn primary" onClick={()=>onAnswers(survey.answers!)}>باز کردن پاسخ در ظرفیت‌سنجی</button>}
   </article>)}
   {data?.surveys.length===0&&<p>هنوز پرسش‌نامه‌ای ساخته نشده.</p>}
  </>}
 </section>;
}

import {HospitalOxygenCapacity} from './hospital-oxygen-capacity';

export function HospitalGasWorkspace({canSurvey}:{canSurvey:boolean}){
 const [loaded,setLoaded]=useState<{answers:SurveyAnswers;revision:number}>();
 return <>{canSurvey&&<HospitalGasSurveyPanel onAnswers={answers=>setLoaded(current=>({answers,revision:(current?.revision||0)+1}))}/>}
  <HospitalOxygenCapacity key={loaded?.revision||0} initial={loaded?.answers}/>
 </>;
}