'use client';

import {useEffect,useState} from 'react';
import {ArrowDownLeft,ArrowUpRight,Phone,Users} from 'lucide-react';

const kinds=[['incoming','تماس ورودی',ArrowDownLeft],['partner','نماینده یا عامل فروش',Users],['outreach','تماس بازاریابی',ArrowUpRight]] as const;
const results=[['no_answer','پاسخ نداد'],['interested','علاقه‌مند است'],['quote','درخواست پیش‌فاکتور'],['declined','علاقه‌مند نیست'],['other','سایر']];

export function SalesCallsPanel({buyer='',compact=false,onNavigate}:{buyer?:string;compact?:boolean;onNavigate?:(section:string,target?:string)=>void}){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [kind,setKind]=useState(buyer?'partner':'incoming'),[contact,setContact]=useState(buyer?'agent:'+buyer:''),[result,setResult]=useState('');
 const [follow,setFollow]=useState(false),[id,setId]=useState(''),[showReport,setShowReport]=useState(false);
 async function refresh(){
  const response=await fetch('/api/sales/calls',{cache:'no-store'});
  const body=await response.json() as {error?:string};
  if(!response.ok)throw Error(body.error);
  setData(body);
 }
 useEffect(()=>{void refresh().catch(e=>{if(!compact)setError(e.message)})},[compact]);
 async function save(body:any){
  setBusy(true);setError('');setMessage('');
  try{
   const operation=id||crypto.randomUUID();setId(operation);
   const r=await fetch('/api/sales/calls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,id:operation,confirmed:true})});
   const out=await r.json() as {error?:string;followupPending?:boolean};if(!r.ok){if(r.status<500)setId('');throw Error(out.error);}
   setId('');setMessage(out.followupPending?'ثبت شد. کارتابل در بررسی بعدی تازه می‌شود.':'ثبت شد.');return true;
  }catch(e){setError((e as Error).message);return false;}finally{setBusy(false);}
 }
 if(!data)return compact?null:<p>{error||'در حال دریافت فرم تماس…'}</p>;
 if(compact)return <button type="button" className="btn" onClick={()=>onNavigate?.('sales','sales-view:calls')}><Phone size={17}/> ثبت تماس فروش</button>;
 const report=data.report;
 return <section className="panel" dir="rtl">
  <div className="panelhead"><div><h2><Phone size={22}/> ثبت تماس فروش</h2><p className="subtle">{data.name} · {new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium',timeStyle:'short'}).format(new Date())}</p></div>
  {data.manager&&<button type="button" className="btn" onClick={()=>setShowReport(!showReport)}>{showReport?'فرم ثبت تماس':'گزارش عملکرد و پیگیری'}</button>}</div>
  <div className="inside">
  {data.sample&&<p className="notice">پیش‌نمایش با داده‌های آزمایشی</p>}
  {error&&<p role="alert" className="notice error">{error}</p>}{message&&<p role="status" className="notice">{message}</p>}
  {showReport&&data.manager?<div>
   <form className="tools" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);if(await save({mode:'policy',dropPercent:Number(f.get('drop')),behindPoints:Number(f.get('behind'))}))await refresh().catch(e=>setError(e.message));}}>
    <label>حد افت فروش (درصد)<input name="drop" type="number" min="1" max="100" defaultValue={data.policy.dropPercent} required/></label>
    <label>حد عقب‌ماندگی هدف (واحد درصد)<input name="behind" type="number" min="1" max="100" defaultValue={data.policy.behindPoints} required/></label>
    <button className="btn" disabled={busy}>ذخیرهٔ حد هشدار</button>
   </form>
   <h3>عملکرد هفت روز اخیر</h3>
   {report.week.map((x:any)=><p key={x.actor}>{x.name} · {kinds.map(([k,label])=>label+' '+(x.counts[k]?.effective||0)+' مؤثر / '+(x.counts[k]?.missed||0)+' بی‌پاسخ').join(' · ')} · {x.onTime} پیگیری به‌موقع · {x.late} دیرهنگام یا معوق · خانگی این ماه: {x.home.orders} از {x.home.cases} پرونده · بیمارستانی این ماه: {x.hospitalMonth.active} در جریان · بیمارستانی این فصل: {x.hospitalQuarter.orders} از {x.hospitalQuarter.cases} پرونده</p>)}
   <p>خانگی، ماه جاری: {report.home.orders} پرونده رسیده به سفارش از {report.home.cases} پرونده</p>
   <p>بیمارستانی، ماه جاری: {report.hospitalMonth.active} پرونده در جریان از {report.hospitalMonth.cases} پرونده</p>
   <p>بیمارستانی، فصل جاری: {report.hospitalQuarter.orders} پرونده رسیده به سفارش از {report.hospitalQuarter.cases} پرونده</p>
   <h3>پرونده‌های نیازمند پیگیری</h3>
   {data.open.map((a:any)=><p key={a.id}><button type="button" className="link" onClick={()=>{setKind('partner');setContact('agent:'+a.id);setShowReport(false)}}>{a.name}</button> · {a.reasons.join('؛ ')} · {a.due}</p>)}
  </div>:<form onSubmit={async e=>{
   e.preventDefault();const form=e.currentTarget,f=new FormData(form);
   const ok=await save({mode:'call',callKind:kind,result,agentId:contact.startsWith('agent:')?contact.slice(6):'',leadId:contact.startsWith('lead:')?contact.slice(5):'',name:f.get('name'),phone:f.get('phone'),productId:f.get('product'),notes:f.get('notes'),nextAction:f.get('nextAction'),nextDue:f.get('nextDue'),nextTime:f.get('nextTime')});
   if(ok){form.reset();setResult('');setFollow(false);await refresh().catch(e=>setError(e.message));}
  }}>
   <fieldset><legend>نوع تماس</legend><div className="tools">{kinds.map(([key,label,Icon])=><button key={key} type="button" aria-pressed={kind===key} className={'btn '+(kind===key?'primary':'')} onClick={()=>{setKind(key);setContact('')}}><Icon size={18}/> {label}</button>)}</div></fieldset>
   {data.open.find((a:any)=>'agent:'+a.id===contact)&&<p className="notice">{data.open.find((a:any)=>'agent:'+a.id===contact).reasons.join('؛ ')}</p>}
   <div className="formgrid">
    <label>مخاطب<select value={contact} onChange={e=>setContact(e.target.value)} required><option value="">انتخاب مخاطب</option>{kind!=='partner'&&<option value="new">مخاطب تازه</option>}{data.agents.filter((a:any)=>kind!=='partner'||a.partner).map((a:any)=><option key={a.id} value={'agent:'+a.id}>{a.name}</option>)}{kind!=='partner'&&data.leads.map((l:any)=><option key={l.id} value={'lead:'+l.id}>{l.name} · سرنخ فروش</option>)}</select></label>
    <label>نتیجه تماس<select value={result} onChange={e=>{setResult(e.target.value);if(e.target.value==='no_answer')setFollow(true)}} required><option value="">انتخاب نتیجه</option>{results.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    {contact==='new'&&<><label>نام مخاطب<input name="name" required maxLength={200}/></label><label>شماره تماس<input name="phone" type="tel" required/></label></>}
    <label>مدل دستگاه (اختیاری)<select name="product"><option value="">انتخاب مدل</option>{data.products.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>توضیح (اختیاری)<input name="notes" maxLength={2000}/></label>
   </div>
   <label><input type="checkbox" checked={follow} disabled={result==='no_answer'} onChange={e=>setFollow(e.target.checked)}/> پیگیری لازم است</label>
   {follow&&<div className="formgrid"><label>اقدام بعدی<input name="nextAction" required maxLength={300} placeholder="مثلاً تماس مجدد"/></label><label>موعد پیگیری<input name="nextDue" type="date" min={data.today} required/></label><label>ساعت<input name="nextTime" type="time"/></label></div>}
   <div className="tools"><button className="btn primary" disabled={busy}>ثبت تماس</button><button type="button" className="btn" onClick={()=>onNavigate?.('tasks')}>انصراف</button></div>
  </form>}
  {!showReport&&contact&&contact!=='new'&&<details><summary>سابقه تماس‌های این پرونده</summary>{data.calls.filter((r:any)=>contact===('agent:'+r.data.agentId)||contact===('lead:'+r.data.leadId)).map((r:any)=><p key={r.id}>{r.data.day} · {results.find(([key])=>key===r.data.result)?.[1]} · {r.data.notes}</p>)}</details>}
  </div>
 </section>;
}
