'use client';
import {useEffect,useRef,useState} from 'react';
import type {OperationForm} from '@/lib/assistant-workspace';
import {partnerKinds} from '@/lib/sales-network-contract';
import {salesRequestChannels} from '@/lib/sales-contract';
import {formatDate,localDay} from '@/lib/persian-date';
import {selectSalesTemplate} from '@/lib/sales-template';
import {NumberInput} from './number-input';
import {SolarDate} from './solar-date';

const money=(value:any)=>/^\d+$/.test(String(value))?BigInt(value).toLocaleString('fa-IR')+' ریال':'—';
const percent=(value:number)=>Number(value/100).toLocaleString('fa-IR')+'٪';
export function SalesOrderSummary({quote,buyer}:{quote:any;buyer?:any}){
 if(!quote)return null;
 return <div aria-label="خلاصه فروش" style={{background:'#eef8f3',borderRadius:12,padding:16}}>
  {buyer&&<p><strong>{buyer.name}</strong> · {partnerKinds[buyer.kind]||'خریدار'} · {quote.deliveryMode==='consignment'?'تحویل امانی':'فروش قطعی'}</p>}
  {quote.lines.map((line:any)=><p key={line.productId}>{line.name} · {line.quantity.toLocaleString('fa-IR')} عدد<br/><small>قیمت مصوب هر دستگاه: {money(line.unitPrice)} · تخفیف: {percent(line.discountBps)} · قیمت پس از تخفیف: {money(line.unitNet)}</small></p>)}
  <p>جمع تخفیف: {money(quote.discount)}<br/><strong>{quote.deliveryMode==='consignment'?'ارزش محموله امانی':'مبلغ نهایی'}: {money(quote.amount)}</strong></p>
  {quote.deliveryMode==='consignment'?<p>ارسال به شعبه امانی است؛ تحویل شعبه فاکتور فروش و بدهی ایجاد نمی‌کند.</p>:quote.salesTerms?<p>شرایط پرداخت{quote.salesTerms.cashBps!==quote.salesTerms.standardCashBps||quote.salesTerms.months!==quote.salesTerms.standardMonths?' پیشنهادی':' مصوب'}: {percent(quote.salesTerms.cashBps)} نقد{quote.salesTerms.cashBps<10000?'؛ باقی‌مانده '+quote.salesTerms.months.toLocaleString('fa-IR')+' ماهه':''}<br/>{quote.installments?.map((p:any)=><span key={p.id}>{p.kind==='cash'?'نقد':'مانده'}: {money(p.amount)} · {formatDate(p.due)}<br/></span>)}</p>:<p>الگوی پرداخت این نوع خریدار تعریف نشده است؛ مهلت فعلی پرونده: {quote.termDays?.toLocaleString('fa-IR')||'۰'} روز، سررسید {formatDate(quote.due)}.</p>}
  {quote.discountBlocked&&<p>به‌دلیل بدهی سررسیدشده، تخفیف فعلاً اعمال نمی‌شود.</p>}
 </div>;
}

export function SalesOrderActionSummary({args}:{args:any}){
 const [summary,setSummary]=useState<any>(null),[error,setError]=useState('');
 const key=JSON.stringify({agentId:args.agentId,items:args.items,salesTerms:args.salesTerms,referrerId:args.referrerId,quoteHash:args.quoteHash});
 useEffect(()=>{
  const controller=new AbortController(),value=JSON.parse(key);setSummary(null);setError('');
  void (async()=>{
   const [r,s]=await Promise.all([fetch('/api/sales/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value),signal:controller.signal}),fetch('/api/sales?agent='+encodeURIComponent(value.agentId),{cache:'no-store',signal:controller.signal})]);
   const quote:any=await r.json(),catalog:any=await s.json();if(!r.ok||!s.ok)throw Error(quote.error||catalog.error||'خلاصه سفارش دریافت نشد.');
   if(quote.quoteHash!==value.quoteHash)throw Error('قیمت یا شرایط مصوب تغییر کرده است؛ این فرمان را لغو و خلاصهٔ جدید را آماده کنید.');
   const a=catalog.agents.find((a:any)=>a.id===value.agentId);if(!controller.signal.aborted)setSummary({quote,buyer:a?{name:a.data.name,kind:a.data.kind||'representative'}:undefined});
  })().catch(e=>{if(!controller.signal.aborted)setError(e.message);});
  return ()=>controller.abort();
 },[key]);
 return summary?<SalesOrderSummary {...summary}/>:<p role={error?'alert':'status'}>{error||'در حال دریافت خلاصه فروش…'}</p>;
}

export function SalesOrderWorkspace({form,accountId,locked,onChange,onPrepare,onReviewReady}:{form:OperationForm;accountId:string;locked:boolean;onChange:(form:OperationForm)=>void;onPrepare:(args:any)=>void;onReviewReady:(ready:boolean)=>void}){
 const [catalog,setCatalog]=useState<any>(null),[error,setError]=useState('');
 const key=JSON.stringify({agentId:form.args.agentId,items:form.args.items,salesTerms:form.args.salesTerms,referrerId:form.args.referrerId});
 const [preview,setPreview]=useState<{accountId:string;key:string;quote:any}>({accountId,key,quote:form.preview}),[previewError,setPreviewError]=useState(form.previewError||''),[loading,setLoading]=useState(false);
 const latest=useRef(form);latest.current=form;
 useEffect(()=>{
  const controller=new AbortController();setCatalog(null);setError('');
  void fetch('/api/sales',{cache:'no-store',signal:controller.signal}).then(async r=>{const d:any=await r.json();if(!r.ok)throw Error(d.error||'فهرست فروش دریافت نشد.');if(d.me!==accountId)throw Error('حساب ورود تغییر کرده است.');if(!controller.signal.aborted)setCatalog(d);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
  return ()=>controller.abort();
 },[accountId]);
 useEffect(()=>{
  const args=JSON.parse(key),controller=new AbortController();setPreviewError('');
  if(!args.agentId||!args.items?.length||args.items.some((i:any)=>!i.productId||!Number.isSafeInteger(i.quantity)||i.quantity<1)){setLoading(false);setPreview({accountId,key,quote:null});return ()=>controller.abort();}
  setLoading(true);
  void fetch('/api/sales/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args),signal:controller.signal}).then(async r=>{const quote:any=await r.json();if(!r.ok)throw Error(quote.error||'قیمت قابل محاسبه نیست.');if(!controller.signal.aborted)setPreview({accountId,key,quote});}).catch(e=>{if(!controller.signal.aborted){setPreview({accountId,key,quote:null});setPreviewError(e.message);}}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[key,accountId]);
 const currentCatalog=catalog?.me===accountId?catalog:null;
 const args=form.args,quote=preview.accountId===accountId&&preview.key===key?preview.quote:null,agent=currentCatalog?.agents.find((a:any)=>a.id===args.agentId),items=args.items?.length?args.items:[{productId:'',quantity:1}];
 const terms=quote?.salesTerms||form.preview?.salesTerms||selectSalesTemplate(currentCatalog?.templates||[],agent?.data.kind||'representative',quote?.day||currentCatalog?.today||localDay())?.data;
 const quoteChanged=!!form.actionId&&!!quote&&args.quoteHash!==quote.quoteHash;
 useEffect(()=>{onReviewReady(!form.actionId||!!quote&&!loading&&!quoteChanged);},[form.actionId,quote,loading,quoteChanged,onReviewReady]);
 function change(patch:any){const next={...latest.current,args:{...latest.current.args,...patch,quoteHash:undefined},preview:undefined,previewError:undefined};onChange(next);}
 const source=args.requestSource||{},needsSource=currentCatalog&&!currentCatalog.roles.agent;
 function sourceChange(patch:any){change({requestSource:{...source,...patch}});}
 const sourceComplete=!needsSource||source.channel&&source.contactName?.trim()&&source.day;
 function prepare(){
  if(!quote||loading)return;
  const allowed=['mode','agentId','items','salesTerms','referrerId','customerReference','requestSource','notes','leadId','leadRevision'];
  const submitted:any=Object.fromEntries(Object.entries(latest.current.args).filter(([k])=>allowed.includes(k)));
  submitted.items=items.map((i:any)=>({productId:i.productId,quantity:i.quantity}));submitted.quoteHash=quote.quoteHash;
  if(currentCatalog.roles.agent)delete submitted.requestSource;
  onPrepare(submitted);
 }
 return <div aria-label="سفارش ساده فروش">
  <p className="subtle">خریدار، کالا و تعداد را مشخص کنید؛ قیمت، تخفیف و پرداخت از شرایط مصوب خوانده می‌شوند.</p>
  {error&&<p role="alert">{error}</p>}
  {!currentCatalog&&!error&&<p role="status">در حال دریافت خریداران و محصولات…</p>}
  <fieldset disabled={locked||!currentCatalog} style={{border:0,padding:0,minWidth:0}}>
   <label className="field"><span>خریدار</span><select value={args.agentId||''} onChange={e=>change({agentId:e.target.value,salesTerms:undefined,referrerId:undefined,requestSource:undefined})}><option value="">فروش به چه کسی؟</option>{currentCatalog?.agents.filter((a:any)=>a.data.active&&a.data.kind!=='referrer').map((a:any)=><option key={a.id} value={a.id}>{a.data.name} — {partnerKinds[a.data.kind||'representative']}</option>)}</select></label>
   {items.map((item:any,index:number)=><div key={index} style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 100px auto',gap:8,alignItems:'end',marginTop:12}}>
    <label className="field"><span>محصول</span><select value={item.productId||''} onChange={e=>change({items:items.map((i:any,n:number)=>n===index?{...i,productId:e.target.value}:i)})}><option value="">انتخاب محصول</option>{currentCatalog?.products.filter((p:any)=>!['غیرفعال','توقف تولید'].includes(p.status)).map((p:any)=><option key={p.id} value={p.id}>{p.name}{p.model&&p.model!==p.name?' · '+p.model:''}</option>)}</select></label>
    <label className="field"><span>تعداد</span><NumberInput fieldKey="quantity" aria-label="تعداد" type="number" min={1} max={10000} value={item.quantity??''} onChange={e=>change({items:items.map((i:any,n:number)=>n===index?{...i,quantity:e.target.value===''?undefined:Number(e.target.value)}:i)})}/></label>
    {items.length>1&&<button type="button" className="link" onClick={()=>change({items:items.filter((_:any,n:number)=>n!==index)})}>حذف</button>}
   </div>)}
   {!locked&&<button type="button" className="link" style={{marginBlock:12}} onClick={()=>change({items:[...items,{productId:'',quantity:1}]})}>افزودن محصول دیگر</button>}
   {quote&&<SalesOrderSummary quote={quote} buyer={agent?{name:agent.data.name,kind:agent.data.kind||'representative'}:form.preview?.buyer}/>}
   {quoteChanged&&<p role="alert">قیمت یا شرایط مصوب تغییر کرده است؛ فرمان قبلی را لغو و خلاصهٔ جدید را آماده کنید.</p>}
   {loading&&<p role="status">در حال محاسبه قیمت و شرایط مصوب…</p>}
   {previewError&&<p role="alert">{previewError}</p>}
   {needsSource&&<details style={{marginBlock:12}} open={!sourceComplete}><summary>نحوه دریافت سفارش مشتری{sourceComplete?' ✓':''}</summary><div className="formgrid">
    <label className="field">روش دریافت<select value={source.channel||''} onChange={e=>sourceChange({channel:e.target.value})}><option value="">انتخاب کنید</option>{Object.entries(salesRequestChannels).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
    <label className="field">نام درخواست‌دهنده<NumberInput fieldKey="contactName" value={source.contactName||''} onChange={e=>sourceChange({contactName:e.target.value})}/></label>
    <SolarDate label="تاریخ دریافت درخواست" value={source.day||''} onChange={day=>sourceChange({day})}/>
    <label className="field">خلاصه تماس یا مرجع پیام (اختیاری)<NumberInput maxLength={1000} fieldKey="reference" value={source.reference||''} onChange={e=>sourceChange({reference:e.target.value})}/></label>
   </div></details>}
   {terms&&agent?.data.kind!=='branch'&&<details style={{marginBlock:12}}><summary>شرایط متفاوت از مصوب، در صورت توافق</summary>{!args.salesTerms?<button type="button" className="link" onClick={()=>change({salesTerms:{cashBps:terms.cashBps,months:terms.months}})}>واردکردن شرایط پیشنهادی</button>:<><p>شرایط پیشنهادی به تأیید مدیر فروش نیاز دارد.</p><div className="formgrid"><label className="field">سهم نقد، درصد<NumberInput fieldKey="cashBps" type="number" min={(terms.minCashBps??0)/100} max={(terms.maxCashBps??10000)/100} step="0.01" value={args.salesTerms.cashBps/100} onChange={e=>change({salesTerms:{...args.salesTerms,cashBps:Math.round(Number(e.target.value)*100)}})}/></label><label className="field">مهلت، ماه<NumberInput fieldKey="months" type="number" min={0} max={terms.maxMonths??12} value={args.salesTerms.months} onChange={e=>change({salesTerms:{...args.salesTerms,months:Number(e.target.value)}})}/></label></div><button type="button" className="link" onClick={()=>change({salesTerms:undefined})}>برگشت به شرایط مصوب</button></>}</details>}
   <details style={{marginBlock:12}}><summary>توضیح سفارش، در صورت نیاز</summary><label className="field">توضیح<NumberInput fieldKey="notes" value={args.notes||''} onChange={e=>change({notes:e.target.value})}/></label></details>
  </fieldset>
  {!form.actionId&&<button type="button" className="btn primary" disabled={locked||!currentCatalog||!quote||loading||!sourceComplete} onClick={prepare}>بررسی و آماده‌سازی سفارش</button>}
 </div>;
}
