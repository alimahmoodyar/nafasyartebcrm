'use client';
import {useEffect,useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {salesStates} from '@/lib/sales-contract';
export function WarehouseReturnsPanel({demo,onSaved}:{demo:boolean;onSaved:()=>void}){
 const [data,setData]=useState<any>(null),[query,setQuery]=useState(''),[draft,setDraft]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function load(){const r=await fetch('/api/sales',{cache:'no-store'}),v:any=await r.json();if(!r.ok){setData(null);throw Error(v.error||'دریافت برگشتی‌ها انجام نشد.');}setData(v);}
 useEffect(()=>{if(!demo)void load().catch(e=>setError(e.message));},[demo]);
 if(demo)return <p className="notice">برای دریافت برگشتی وارد اطلاعات شرکت شوید.</p>;
 const all=data?.warehouseOnly?data.returns:(data?.accounts||[]).flatMap((a:any)=>a.returns||[]),items=all||[],name=(id:string)=>data?.agents.find((a:any)=>a.id===id)?.data.name||'خریدار';
 async function save(e:React.FormEvent){e.preventDefault();if(busy||!draft.physicallyReceived)return;setBusy(true);setError('');try{const r=await fetch('/api/sales',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)}),v:any=await r.json();if(!r.ok)throw Error(v.error||'دریافت ثبت نشد.');setDraft(null);setMessage('دریافت فیزیکی ثبت شد؛ کالا در قرنطینه است و بررسی مالی جدا انجام می‌شود.');await load();onSaved();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 return <section className="panel"><div className="inside"><p>دریافت برگشتی، کالا را به قرنطینه می‌برد. تأیید اعتبار خریدار در فرایند مالی انجام می‌شود.</p>
  <label className="field">جست‌وجوی خریدار یا سریال<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label>
  {error&&<p className="notice error" role="alert">{error}</p>}{message&&<p className="notice" role="status">{message}</p>}
  {!data&&!error&&<p role="status">در حال دریافت برگشتی‌ها…</p>}
  {items.filter((r:any)=>(name(r.data.agentId)+' '+r.data.serials.join(' ')).includes(query.trim())).map((r:any)=><article className="flow-card" key={r.id}><h3>{name(r.data.agentId)} · {salesStates[r.data.state]}</h3><p>{r.data.serials.join('، ')} · {r.data.reason}</p>{data.roles.warehouse&&r.data.state==='requested'&&<button className="btn primary" onClick={()=>{setError('');setDraft({id:crypto.randomUUID(),mode:'return_receive',confirmed:true,agentId:r.data.agentId,returnId:r.id,revision:r.revision,receipt:'',notes:'',physicallyReceived:false})}}>ثبت دریافت فیزیکی</button>}</article>)}
  {data&&!items.length&&<p className="empty">برگشتی ثبت‌شده‌ای در دسترسی شما نیست.</p>}
  <Dialog open={!!draft} onOpenChange={open=>{if(!open&&!busy)setDraft(null)}}><DialogContent className="modal sm:max-w-2xl"><DialogTitle>دریافت برگشتی مشتری</DialogTitle><DialogDescription>فقط پس از دریافت واقعی سریال‌های درخواست، تأیید کنید.</DialogDescription>{draft&&<form onSubmit={save}><fieldset disabled={busy}><label className="field">شماره رسید انبار<input required value={draft.receipt} onChange={e=>setDraft({...draft,receipt:e.target.value})}/></label><label className="field">وضعیت ظاهری و محل قرنطینه<textarea required value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label><label className="flow-check"><input type="checkbox" required checked={draft.physicallyReceived} onChange={e=>setDraft({...draft,physicallyReceived:e.target.checked})}/>همه سریال‌های درخواست را دریافت و کنترل کردم.</label>{error&&<p role="alert">{error}</p>}<button className="btn primary" disabled={busy||!draft.physicallyReceived}>تأیید و ثبت دریافت</button></fieldset></form>}</DialogContent></Dialog>
 </div></section>;
}
