'use client';

import {useEffect,useState,type FormEvent} from 'react';
import {formatDate,latinDigits,solarParts} from '@/lib/persian-date';

const endpoint='/api/sales/rewards';
const titles={quarter:'هدف و پاداش فصلی',year:'هدف و پاداش سالانه'} as const;
type Period=keyof typeof titles;
type Kind='cash'|'fixed'|'equivalent';
type Result={actual:string;net:string;value:string;quantity:string;remainder:string};
type Plan={agentId:string;period:Period;year:number;quarter:number;start:string;end:string;basis:'net'|'units';target:string;netTarget?:string;productIds:string[];kind:Kind;productId:string;rate:number;quantity:number;unitValue:string;state:string;result?:Result};
type Reward={id:string;revision:number;data:Plan;progress:{ready:boolean;started:boolean;ended:boolean;daysLeft:number;result:Result}};
type Library={sample?:boolean;manager:boolean;finance:boolean;today:string;rewards:Reward[];agents:{id:string;name:string;eligible:boolean}[];products:{id:string;name:string}[]};
const format=(value:string|number|bigint)=>BigInt(value).toLocaleString('fa-IR');
function progressLine(label:string,actual:string,target:string,unit:string){
 const remaining=BigInt(target)-BigInt(actual);
 return <p><strong>{label}</strong> · خرید {format(actual)} از {format(target)} {unit} · مانده {format(remaining>BigInt(0)?remaining:0)} {unit}</p>;
}
const seasons=['بهار','تابستان','پاییز','زمستان'];
const kinds={cash:'ریالی',fixed:'کالایی با تعداد ثابت',equivalent:'کالایی معادل پاداش ریالی'};

export function SalesRewards({period,manage=false,focusId=''}:{period?:Period;manage?:boolean;focusId?:string}){
 const [library,setLibrary]=useState<Library|null>(null);
 const [draft,setDraft]=useState<Reward|null>(null);
 const [formOpen,setFormOpen]=useState(false);
 const [kind,setKind]=useState<Kind>('cash');
 const [review,setReview]=useState<Reward|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [operation,setOperation]=useState('');
 async function load(signal?:AbortSignal){
  const response=await fetch(endpoint,{cache:'no-store',signal});
  if(!response.ok)throw Error(((await response.json()) as {error:string}).error);
  const data=await response.json() as Library;
  if(!signal?.aborted)setLibrary(data);
 }
 useEffect(()=>{
  const controller=new AbortController();
  void load(controller.signal).catch(error=>{if(!controller.signal.aborted)setError(error.message);});
  return ()=>controller.abort();
 },[]);
 useEffect(()=>{
  if(focusId&&library?.finance){
   setReview(library.rewards.find(reward=>reward.id===focusId&&reward.progress.ready&&reward.data.state!=='approved')||null);
   setOperation(crypto.randomUUID());
  }
 },[focusId,library]);
 function start(reward:Reward|null){
  setDraft(reward);setKind(reward?.data.kind||'cash');setFormOpen(true);setReview(null);
  setOperation(crypto.randomUUID());setError('');
 }
 async function submit(payload:object){
  if(busy)return;
  setBusy(true);setError('');
  try{
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation,...payload})});
   if(!response.ok)throw Error(((await response.json()) as {error:string}).error);
   setFormOpen(false);setReview(null);
   window.dispatchEvent(new Event('nafasyar-tasks-changed'));
   await load();
  }catch(error){setError((error as Error).message);}
  finally{setBusy(false);}
 }
 function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const form=new FormData(event.currentTarget);
  const value=(key:string)=>latinDigits(String(form.get(key)||'')).trim();
  void submit({
   mode:'save',id:draft?.id,revision:draft?.revision,period,agentId:value('agentId'),year:Number(value('year')),quarter:Number(value('quarter')),
   target:value('target'),netTarget:value('netTarget'),targetProductId:value('targetProductId'),kind,rate:Math.round(Number(value('rate').replace('٫','.'))*100),
   quantity:Number(value('quantity')),productId:value('productId'),unitValue:value('unitValue'),
  });
 }
 if(!library){
  const message=error||'در حال دریافت هدف…';
  if(manage)return <p role={error?'alert':'status'}>{message}</p>;
  return <section className="representative-rewards" aria-label="هدف و پاداش فروش">
   {Object.entries(titles).map(([key,title])=><div key={key}><h3>{title}</h3><p role={error?'alert':'status'}>{message}</p></div>)}
  </section>;
 }
 const current=solarParts(library.today);
 const periods:Period[]=period?[period]:['quarter','year'];
 const d=draft?.data;
 return <section className={manage?undefined:'representative-rewards'} aria-label={period?titles[period]:'هدف و پاداش فروش'}>
  {error&&<p className="notice error" role="alert">{error}</p>}
  {manage&&library.manager&&<button type="button" className="btn primary" disabled={busy} onClick={()=>start(null)}>تعریف هدف و پاداش</button>}
  {manage&&library.manager&&formOpen&&<form key={draft?.id||'new'} onSubmit={save}>
   <fieldset className="formgrid" disabled={busy}>
    <label className="field">نماینده یا عامل فروش<select name="agentId" required defaultValue={d?.agentId||''}><option value="">انتخاب کنید</option>{library.agents.filter(a=>a.eligible).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    <label className="field">سال شمسی<input name="year" inputMode="numeric" defaultValue={d?.year||current.year} required/></label>
    {period==='quarter'&&<label className="field">فصل<select name="quarter" defaultValue={d?.quarter||Math.ceil(current.month/3)}>{seasons.map((season,index)=><option key={season} value={index+1}>{season}</option>)}</select></label>}
    <label className="field">مدل دستگاهِ هدف<select name="targetProductId" required defaultValue={d?.productIds.length===1?d.productIds[0]:''}><option value="">انتخاب کنید</option>{library.products.map(product=><option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
    <label className="field">تعداد هدف<input name="target" inputMode="numeric" defaultValue={d?.basis==='units'?d.target:''} required/></label>
    <label className="field">مبلغ هدف (ریال)<input name="netTarget" inputMode="numeric" defaultValue={d?.netTarget||(d?.basis==='net'?d.target:'')} required/></label>
    <label className="field">نوع پاداش<select value={kind} onChange={event=>setKind(event.target.value as Kind)}>{Object.entries(kinds).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    {kind!=='fixed'&&<label className="field">درصد پاداش<input name="rate" inputMode="decimal" defaultValue={d?.rate?d.rate/100:''} required/></label>}
    {kind!=='cash'&&<label className="field">مدل دستگاه پاداش<select name="productId" defaultValue={d?.productId||''} required><option value="">انتخاب کنید</option>{library.products.map(product=><option key={product.id} value={product.id}>{product.name}</option>)}</select></label>}
    {kind==='fixed'&&<label className="field">تعداد دستگاه پاداش<input name="quantity" inputMode="numeric" defaultValue={d?.quantity||''} required/></label>}
    {kind==='equivalent'&&<label className="field">ارزش مبنای هر دستگاه (ریال)<input name="unitValue" inputMode="numeric" defaultValue={d?.unitValue||''} required/></label>}
    <div className="tools"><button className="btn primary">ذخیره</button><button type="button" className="btn" onClick={()=>setFormOpen(false)}>انصراف</button></div>
   </fieldset>
  </form>}
  {periods.map(key=>{
   const list=library.rewards.filter(reward=>reward.data.period===key).sort((a,b)=>b.data.start.localeCompare(a.data.start));
   const live=list.find(reward=>reward.progress.started&&!reward.progress.ended);
   const visible=manage?list:[live||list.find(reward=>reward.progress.started)||list.at(-1)].filter((item):item is Reward=>!!item);
   return <div key={key}>
    <h3>{titles[key]}</h3>
    {!visible.length&&<p className="subtle">هدفی تعریف نشده است.</p>}
    {visible.map(reward=>{
     const p=reward.data,r=p.result||reward.progress.result,unit=p.basis==='units'?'دستگاه':'ریال';
     const periodLabel=(p.quarter?seasons[p.quarter-1]+' ':'')+format(p.year);
     const product=library.products.find(item=>item.id===p.productId)?.name||p.productId;
     const status=p.state==='approved'?'ثبت‌شده':reward.progress.ready?'در انتظار تأیید مالی':reward.progress.ended?'پایان دوره · پاداش قابل ثبت ندارد':reward.progress.started?'در جریان':'هنوز شروع نشده';
     return <article key={reward.id} className="flow-card">
      <strong>{periodLabel}{library.sample?' · آزمایشی':''}{manage?' · '+(library.agents.find(a=>a.id===p.agentId)?.name||''):''}</strong>
      {p.netTarget&&<p>مدل هدف · {library.products.find(item=>item.id===p.productIds[0])?.name||p.productIds[0]}</p>}
      {progressLine(p.basis==='units'?'تعداد':'مبلغ',r.actual,p.target,unit)}
      {p.netTarget&&progressLine('مبلغ',r.net,p.netTarget,'ریال')}
      <p>{status}{reward.progress.started&&!reward.progress.ended&&<> · {format(reward.progress.daysLeft)} روز باقی مانده</>}</p>
      <p>{kinds[p.kind]} · {p.kind==='cash'?format(r.value)+' ریال':format(r.quantity)+' دستگاه '+product}
       {p.kind==='equivalent'&&r.remainder!=='0'&&<> · ماندهٔ کمتر از ارزش یک دستگاه {format(r.remainder)} ریال</>}
      </p>
      {manage&&<p className="subtle">{formatDate(p.start)} تا {formatDate(p.end)} · خرید خالص مشمول {format(r.net)} ریال</p>}
      {manage&&p.state!=='approved'&&library.manager&&<button type="button" className="link" disabled={busy} onClick={()=>start(reward)}>ویرایش طرح</button>}
      {manage&&p.state!=='approved'&&library.finance&&reward.progress.ready&&<button type="button" className="link" disabled={busy} onClick={()=>{setReview(reward);setFormOpen(false);setOperation(crypto.randomUUID());setError('');}}>بررسی و تأیید</button>}
      {manage&&review?.id===reward.id&&library.finance&&reward.progress.ready&&p.state!=='approved'&&<div className="tools">
       <button type="button" className="btn primary" disabled={busy} onClick={()=>void submit({mode:'approve',id:reward.id,revision:reward.revision,result:review.progress.result})}>تأیید و ثبت پاداش</button>
       <button type="button" className="btn" disabled={busy} onClick={()=>setReview(null)}>انصراف</button>
      </div>}
     </article>;
    })}
   </div>;
  })}
 </section>;
}
