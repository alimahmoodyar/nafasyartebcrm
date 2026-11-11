'use client';
import {useEffect,useState} from 'react';
import {ServiceFields,seedServiceFields} from './service-fields';
import {serviceCommercialActions,serviceCommercialForms,calculatedLabor} from '@/lib/service-commercial-contract';
import {formatDate} from '@/lib/persian-date';
const money=(n:any)=>n===null||n===undefined?'تعیین نشده':BigInt(n).toLocaleString('fa-IR')+' ریال';
const state=(s:string)=>({pending:'در انتظار تأیید',approved:'تأییدشده',rejected:'ردشده',pending_rate:'در انتظار مصوبه مدیرعامل',published:'منتشرشده'}[s]||s);
export function ServiceCommercialPanel({target=''}:{target?:string}){
 const [data,setData]=useState<any>(null),[draft,setDraft]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function refresh(){const r=await fetch('/api/after-sales/commercial',{cache:'no-store'}),d=await r.json() as any;if(!r.ok)throw Error(d.error);setData(d);return d;}
 useEffect(()=>{void refresh().catch(e=>setError(e.message));},[]);
 function start(mode:string,row?:any){const d={...seedServiceFields(serviceCommercialForms[mode]),mode,domain:'home',id:crypto.randomUUID(),confirmed:true};
  if(mode.endsWith('_decide'))Object.assign(d,{requestId:row.id,revision:row.revision,approved:true});
  if(mode==='work_define'){d.active=true;if(row)Object.assign(d,{...row.data,mode,workId:row.id,revision:row.revision,minutes:String(row.data.minutes/1000)});}
  if(mode==='labor_publish')Object.assign(d,{policyRevision:data.policy?.revision||0,ratePerMinuteRial:data.policy?.data.ratePerMinuteRial||'',customerMultiplier:data.policy?String(data.policy.data.customerMultiplier/1000):'1'});
  setDraft(d);setError('');setMessage('');
 }
 async function submit(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{const r=await fetch('/api/after-sales/commercial',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)}),d=await r.json() as any;if(!r.ok)throw Error(d.error);setDraft(null);setMessage('ثبت شد؛ اعتبار، تعرفه‌ها و کارتابل مرحله بعد به‌روز شدند.');await refresh();window.dispatchEvent(new Event('nafasyar-tasks-changed'));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 if(!data)return <section className="panel"><h2>اعتبار و تعرفه خدمات خانگی</h2><p role="status">{error||'در حال دریافت…'}</p><button className="btn" onClick={()=>void refresh().catch(e=>setError(e.message))}>تلاش دوباره</button></section>;
 const r=data.rights;
 const options=(source:string):string[][]=>source==='agents'?data.agents.filter((a:any)=>a.data.active).map((a:any)=>[a.id,a.data.name]):source==='materials'?data.materials.map((m:any)=>[m.code,m.code+' · '+m.name]):[];
 const selected=target.replace(/^service-commercial:/,'');
 const requests=[...data.requests].sort((a:any,b:any)=>Number(b.id===selected)-Number(a.id===selected));
 return <section className="panel"><h2>اعتبار و تعرفه خدمات خانگی</h2><p>حد اعتبار با تأیید مدیر خدمات، قیمت قطعه با تأیید مدیر مالی و اجرت با مصوبه مدیرعامل اعمال می‌شود.</p>
  <div className="tools">{r.expert&&<button className="btn" onClick={()=>start('credit_propose')}>پیشنهاد حد اعتبار</button>}{r.manager&&<><button className="btn" onClick={()=>start('part_price_propose')}>قیمت‌گذاری قطعه</button><button className="btn" onClick={()=>start('work_define')}>تعریف کار و زمان‌سنجی</button></>}{r.ceo&&<button className="btn" onClick={()=>start('labor_publish')}>فی دقیقه و ضریب اجرت</button>}<button className="btn" disabled={busy} onClick={()=>void refresh().catch(e=>setError(e.message))}>تازه‌سازی</button></div>
  {error&&<p role="alert" className="notice error">{error}</p>}{message&&<p role="status" className="notice">{message}</p>}
  {draft&&<form onSubmit={submit} className="panel"><h3>{serviceCommercialActions[draft.mode]}</h3><div className="formgrid"><ServiceFields fields={serviceCommercialForms[draft.mode]} value={draft} onChange={setDraft} options={options} disabled={busy}/></div>
   {draft.mode==='labor_publish'&&<div><p>این مصوبه اجرت همهٔ کارهای فعال را محاسبه می‌کند. قیمت فاکتورها و برآوردهای قبلی تغییر نمی‌کند.</p>{data.works.filter((w:any)=>w.data.active).map((w:any)=>{let prices:any;try{if(/^\d+$/.test(draft.ratePerMinuteRial)&&/^\d+(\.\d{1,3})?$/.test(draft.customerMultiplier))prices=calculatedLabor(w.data.minutes,draft.ratePerMinuteRial,Math.round(Number(draft.customerMultiplier)*1000));}catch{}return <p key={w.id}>{w.data.name} · {w.data.minutes/1000} دقیقه · نماینده: {prices?money(prices.priceRial):'—'} · مشتری: {prices?money(prices.consumerPriceRial):'—'}</p>;})}</div>}
   <div className="tools"><button className="btn primary" disabled={busy} type="submit">{busy?'در حال ثبت…':'ثبت و اعمال مرحله'}</button><button className="btn" type="button" disabled={busy} onClick={()=>setDraft(null)}>انصراف</button></div></form>}
  <h3>اعتبار نمایندگان</h3><div className="flow-grid">{data.accounts.map((a:any)=><article key={a.agentId} className="flow-card"><h4>{data.agents.find((x:any)=>x.id===a.agentId)?.data.name}</h4><p>حد اعتبار مصوب: {money(a.limitRial)}</p><p>بدهکار: {money(a.debtorRial)} · بستانکار: {money(a.creditorRial)}</p><p>در انتظار گارانتی: {money(a.heldWarrantyRial)} · قابل مطالبه: {money(a.collectibleRial)}</p></article>)}</div>
  <h3>درخواست‌های اعتبار و قیمت قطعه</h3>{!requests.length&&<p>درخواستی ثبت نشده است.</p>}{requests.map((q:any)=><article className="flow-card" key={q.id} aria-current={q.id===selected?'true':undefined}><h4>{q.data.kind==='credit'?'حد اعتبار · '+q.data.agentName:'قیمت قطعه · '+q.data.name}</h4><p>{state(q.data.state)} · ثبت‌کننده: {q.data.submitted?.byName||'—'}</p>{q.data.kind==='credit'?<p>{money(q.data.limitRial)}</p>:<p>نماینده: {money(q.data.priceRial)} · مشتری: {money(q.data.consumerPriceRial)} · اعتبار از {formatDate(q.data.validFrom)}</p>}<p>{q.data.notes}</p>{q.data.decision&&<p>دلیل تصمیم: {q.data.decision.notes}</p>}{q.data.state==='pending'&&((q.data.kind==='credit'&&r.manager)||(q.data.kind==='part_price'&&r.finance))&&<button className="btn" onClick={()=>start(q.data.kind==='credit'?'credit_decide':'part_price_decide',q)}>بررسی و ثبت تصمیم</button>}</article>)}
  <h3>کارها و زمان‌سنجی</h3>{!data.works.length&&<p>کاری تعریف نشده است.</p>}{data.works.map((w:any)=><article className="flow-card" key={w.id}><h4>{w.data.name}</h4><p>{w.data.minutes/1000} دقیقه · {w.data.active?'فعال':'غیرفعال'} · {state(w.data.state)}</p>{r.manager&&<button className="btn" onClick={()=>start('work_define',w)}>اصلاح کار و زمان</button>}</article>)}
  {data.policy&&<p className="notice">آخرین مصوبه: فی دقیقه {money(data.policy.data.ratePerMinuteRial)} · ضریب مشتری {data.policy.data.customerMultiplier/1000} · {formatDate(data.policy.data.validFrom)}</p>}
 </section>;
}
