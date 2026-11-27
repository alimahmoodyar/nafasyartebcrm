'use client';
import {useEffect,useState} from 'react';
import {SolarDate} from './solar-date';
import type {Visit} from './exhibition-visits';
export type Person={id:string;name:string;unit:string};
export async function eventApi<T>(query:string,body?:unknown,signal?:AbortSignal){
 const r=await fetch('/api/events'+query,{method:body?'POST':'GET',body:body?JSON.stringify(body):undefined,headers:body?{'Content-Type':'application/json'}:undefined,cache:'no-store',signal});
 const data=await r.json() as T&{error?:string};if(!r.ok)throw Error(data.error||'دسترسی به رویداد ممکن نشد.');return data;
}
export function PeoplePicker({label,values,onChange,multi=false,eventId}:{label:string;values:Person[];onChange:(v:Person[])=>void;multi?:boolean;eventId?:string}){
 const [term,search]=useState(''),[matches,setMatches]=useState<Person[]>([]),[err,setErr]=useState('');
 useEffect(()=>{setMatches([]);setErr('');if(!term.trim())return;
 const controller=new AbortController();const timer=setTimeout(()=>{const params=new URLSearchParams({search:term,...(eventId?{event:eventId,specialist:'1'}:{})});
 eventApi<{people:Person[]}>('?'+params,undefined,controller.signal).then(r=>{if(!controller.signal.aborted){setMatches(r.people);if(!r.people.length)setErr('نتیجه‌ای پیدا نشد.')}}).catch(e=>{if(!controller.signal.aborted)setErr(e.message)})},200);
 return ()=>{clearTimeout(timer);controller.abort()};
 },[term,eventId]);
 return <fieldset className="field"><legend>{label}</legend><input type="search" aria-label={'جست‌وجوی '+label} placeholder="نام، نام خانوادگی یا واحد" value={term} onChange={e=>search(e.target.value)}/>{err&&<small>{err}</small>}{term&&matches.filter(p=>!values.some(v=>p.id===v.id)).map(p=><button type="button" className="btn" key={p.id} onClick={()=>{onChange(multi?[...values,p]:[p]);search('')}}>{p.name} · {p.unit}</button>)}<div className="tools">{values.map(p=><button type="button" className="btn" key={p.id} aria-label={'حذف '+p.name} onClick={()=>onChange(values.filter(v=>v.id!==p.id))}>{p.name} ×</button>)}</div></fieldset>;
}
export function Referral({eventId,visit,done}:{eventId:string;visit:Visit;done:(s:string)=>void}){
 const [open,toggle]=useState(false),[owner,setOwner]=useState<Person[]>([]),[action,setAction]=useState(visit.data.action),[due,setDue]=useState(visit.data.due),[linkExisting,setLink]=useState(false),[segment,setSegment]=useState('home'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(){setBusy(true);setError('');try{const r=await eventApi<{pending?:boolean}>('',{mode:'refer',event:eventId,id:visit.id,revision:visit.revision,ownerId:owner[0].id,nextAction:action,nextDue:due,segment,linkExisting});toggle(false);done(r.pending?'سرنخ ثبت شد؛ همگام‌سازی کارتابل در انتظار است.':'سرنخ به کارشناس ارجاع شد.')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 if(!open)return <button className="btn" onClick={()=>toggle(true)}>{visit.data.leadId?'تغییر کارشناس':'ارجاع به کارشناس تخصصی'}</button>;
 return <fieldset disabled={busy}><legend>ارجاع سرنخ فروش</legend><PeoplePicker label="کارشناس تخصصی فروش" eventId={eventId} values={owner} onChange={setOwner}/>{!visit.data.leadId&&<label className="field">مسیر فروش<select value={segment} onChange={e=>setSegment(e.target.value)}><option value="home">خانگی</option><option value="hospital">بیمارستانی</option></select></label>}{!visit.data.leadId&&<label><input type="checkbox" checked={linkExisting} onChange={e=>setLink(e.target.checked)}/> اگر این مخاطب نزد همین کارشناس سرنخ باز دارد، بازدید به همان پرونده اضافه شود.</label>}<label className="field">اقدام بعدی<input value={action} onChange={e=>setAction(e.target.value)}/></label><SolarDate label="موعد" value={due} onChange={setDue}/>{error&&<p role="alert">{error}</p>}<button className="btn primary" disabled={!owner.length||!due||!action.trim()} onClick={()=>void save()}>ثبت ارجاع</button><button className="btn" onClick={()=>toggle(false)}>انصراف</button></fieldset>;
}
