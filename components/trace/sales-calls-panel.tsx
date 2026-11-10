'use client';

import {useEffect,useState} from 'react';
import {callResultLabels,leadCallResults,partnerCallResults} from '@/lib/sales-call-results';
import {ArrowDownLeft,ArrowUpRight,Phone,Users} from 'lucide-react';

const kinds=[['incoming','تماس ورودی',ArrowDownLeft],['partner','نماینده یا عامل فروش',Users],['outreach','تماس بازاریابی',ArrowUpRight]] as const;


export function SalesCallsPanel({buyer='',referralId='',compact=false,onNavigate}:{buyer?:string;referralId?:string;compact?:boolean;onNavigate?:(section:string,target?:string)=>void}){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [kind,setKind]=useState(buyer?'partner':'incoming'),[contact,setContact]=useState(buyer?'agent:'+buyer:''),[result,setResult]=useState('');
 const [follow,setFollow]=useState(false),[refer,setRefer]=useState(false),[id,setId]=useState(''),[showReport,setShowReport]=useState(false);
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
   window.dispatchEvent(new Event('nafasyar-tasks-changed'));
   setId('');setMessage(out.followupPending?'ثبت شد. کارتابل در بررسی بعدی تازه می‌شود.':'ثبت شد.');return true;
  }catch(e){setError((e as Error).message);return false;}finally{setBusy(false);}
 }
 if(!data)return compact?null:<p>{error||'در حال دریافت فرم تماس…'}</p>;
 if(compact)return <button type="button" className="btn" onClick={()=>onNavigate?.('sales','sales-view:calls')}><Phone size={17}/> ثبت تماس فروش</button>;
 const report=data.report;
 const partner=kind==='partner'||data.agents.some((a:any)=>a.partner&&'agent:'+a.id===contact);
 const results=Object.entries(partner?partnerCallResults:leadCallResults);
 if(referralId){
  const call=data.referrals?.find((row:any)=>row.id===referralId);
  if(!call)return <p role="alert">این ارجاع در دسترسی شما نیست.</p>;
  const referral=call.data.referral;
  return <section className="panel" dir="rtl"><div className="inside">
   <h2>رسیدگی به ارجاع تماس</h2>
   <p>{call.data.name} · {call.data.actorName} · {call.data.day}</p>
   <p><strong>خلاصهٔ تماس</strong> {call.data.notes}</p>
   <p><strong>درخواست از مدیر فروش</strong> {referral.request}</p>
   {error&&<p role="alert" className="notice error">{error}</p>}
   {referral.state==='resolved'?<p role="status">تصمیم ثبت‌شده: {referral.decision}</p>:<form onSubmit={async e=>{
    e.preventDefault();const form=new FormData(e.currentTarget);
    if(await save({mode:'resolve_referral',callId:call.id,revision:call.revision,decision:form.get('decision')}))await refresh().catch(e=>setError(e.message));
   }}><label>تصمیم مدیر فروش<textarea name="decision" required maxLength={2000}/></label>
   <div className="tools"><button className="btn primary" disabled={busy}>ثبت تصمیم و بستن ارجاع</button></div></form>}
   <button type="button" className="btn" onClick={()=>onNavigate?.('tasks','mine')}>بازگشت به کارتابل</button>
  </div></section>;
 }
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
   {(data.referrals||[]).filter((row:any)=>row.data.referral.state==='open').map((row:any)=><p key={row.id}><button type="button" className="link" onClick={()=>onNavigate?.('sales','sales-view:calls:referral:'+row.id)}>رسیدگی به ارجاع · {row.data.name}</button> · {row.data.referral.request}</p>)}
   {data.open.map((a:any)=><p key={a.id}><button type="button" className="link" onClick={()=>{setKind('partner');setContact('agent:'+a.id);setShowReport(false)}}>{a.name}</button> · {a.reasons.join('؛ ')} · {a.due}</p>)}
  </div>:<form onSubmit={async e=>{
   e.preventDefault();const form=e.currentTarget,f=new FormData(form);
   const ok=await save({mode:'call',callKind:kind,result,agentId:contact.startsWith('agent:')?contact.slice(6):'',leadId:contact.startsWith('lead:')?contact.slice(5):'',name:f.get('name'),phone:f.get('phone'),productId:f.get('product'),notes:f.get('notes'),nextAction:f.get('nextAction'),nextDue:f.get('nextDue'),nextTime:f.get('nextTime'),managerRequest:f.get('managerRequest')});
   if(ok){form.reset();setResult('');setFollow(false);setRefer(false);await refresh().catch(e=>setError(e.message));}
  }}>
   <fieldset><legend>نوع تماس</legend><div className="tools">{kinds.map(([key,label,Icon])=><button key={key} type="button" aria-pressed={kind===key} className={'btn '+(kind===key?'primary':'')} onClick={()=>{setKind(key);setContact('');setResult('');setRefer(false)}}><Icon size={18}/> {label}</button>)}</div></fieldset>
   {data.open.find((a:any)=>'agent:'+a.id===contact)&&<p className="notice">{data.open.find((a:any)=>'agent:'+a.id===contact).reasons.join('؛ ')}</p>}
   <div className="formgrid">
    <label>مخاطب<select value={contact} onChange={e=>{setContact(e.target.value);setResult('');setRefer(false)}} required><option value="">انتخاب مخاطب</option>{kind!=='partner'&&<option value="new">مخاطب تازه</option>}{data.agents.filter((a:any)=>kind!=='partner'||a.partner).map((a:any)=><option key={a.id} value={'agent:'+a.id}>{a.name}</option>)}{kind!=='partner'&&data.leads.map((l:any)=><option key={l.id} value={'lead:'+l.id}>{l.name} · سرنخ فروش</option>)}</select></label>
    <label>نتیجه تماس<select value={result} onChange={e=>{setResult(e.target.value);if(e.target.value==='no_answer'){setFollow(true);setRefer(false)}}} required><option value="">انتخاب نتیجه</option>{results.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    {contact==='new'&&<><label>نام مخاطب<input name="name" required maxLength={200}/></label><label>شماره تماس<input name="phone" type="tel" required/></label></>}
    <label>مدل دستگاه (اختیاری)<select name="product"><option value="">انتخاب مدل</option>{data.products.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>{refer?'خلاصهٔ موضوع برای مدیر':'توضیح (اختیاری)'}<textarea name="notes" maxLength={2000} required={refer}/></label>
   </div>
   <fieldset className="sales-call-followup">
    <legend>پیگیری بعدی</legend>
    <label className="sales-call-followup-toggle">
     <input type="checkbox" checked={follow} disabled={result==='no_answer'} onChange={e=>{setFollow(e.target.checked);if(e.target.checked)setRefer(false)}}/>
     <span>{partner?'پیگیری با من':'برای این تماس پیگیری ثبت شود'}</span>
    </label>
    {partner&&result!=='no_answer'&&<label className="sales-call-followup-toggle">
     <input type="checkbox" checked={refer} onChange={e=>{setRefer(e.target.checked);if(e.target.checked)setFollow(false)}}/>
     <span>ارجاع به مدیر فروش</span>
    </label>}
    {refer&&<label className="field">چه تصمیم یا اقدامی از مدیر می‌خواهید؟<textarea name="managerRequest" maxLength={1000} required/></label>}
    {result==='no_answer'&&<p className="subtle">برای تماس بی‌پاسخ، اقدام بعدی و موعد پیگیری را ثبت کنید.</p>}
    {follow&&<div className="formgrid">
     <label>اقدام بعدی<input name="nextAction" required maxLength={300} placeholder="مثلاً تماس مجدد"/></label>
     <label>موعد پیگیری<input name="nextDue" type="date" min={data.today} required/></label>
     <label>ساعت<input name="nextTime" type="time"/></label>
    </div>}
   </fieldset>
   <div className="tools"><button className="btn primary" disabled={busy}>ثبت تماس</button><button type="button" className="btn" onClick={()=>onNavigate?.('tasks')}>انصراف</button></div>
  </form>}
  {!showReport&&contact&&contact!=='new'&&<details><summary>سابقه تماس‌های این پرونده</summary>{data.calls.filter((r:any)=>contact===('agent:'+r.data.agentId)||contact===('lead:'+r.data.leadId)).map((r:any)=><p key={r.id}>{r.data.day} · {callResultLabels[r.data.result as keyof typeof callResultLabels]} · {r.data.notes}{r.data.referral&&<> · {r.data.referral.state==='resolved'?'تصمیم مدیر: '+r.data.referral.decision:'ارجاع‌شده به مدیر فروش'}</>}</p>)}</details>}
  </div>
 </section>;
}
