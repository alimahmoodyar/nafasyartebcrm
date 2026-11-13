"use client";
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {transportStates} from '@/lib/transport-contract';
import {SolarDate} from './solar-date';
import {MaterialSelect} from './material-select';
import {formatDate,formatDateTime} from '@/lib/persian-date';
import {defaultShippingFilters,shippingStatuses,shippingDateTypes,shippingFilterError,type ShippingFilters} from '@/lib/shipping-report';
const channels:Record<string,string>={portal:'حساب نماینده',phone:'تلفنی',in_person:'حضوری',message:'پیام',email:'ایمیل',letter:'نامه',other:'سایر',staff_entry:'ثبت کارشناس'};
const n=(v:number|null)=>v===null?'نیازمند تطبیق':v.toLocaleString('fa-IR');
const day=(v:string)=>v?formatDate(v):'ثبت نشده';
export function FulfillmentShipmentReport({revision,renderActions}:{revision:unknown;renderActions:(id:string)=>ReactNode}){
 const [form,setForm]=useState<ShippingFilters>({...defaultShippingFilters}),[result,setResult]=useState<any>(null),[choices,setChoices]=useState<any>({products:[],sources:[],destinations:[],channels:[]}),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const sequence=useRef(0),applied=useRef<ShippingFilters>({...defaultShippingFilters});
 const change=(key:keyof ShippingFilters,value:string)=>setForm(f=>({...f,[key]:value}));
 async function run(filters:ShippingFilters){const invalid=shippingFilterError(filters);if(invalid){setError(invalid);return;}const current=++sequence.current;applied.current={...filters};setLoading(true);setError('');setResult(null);try{const response=await fetch('/api/fulfillment/report?'+new URLSearchParams(filters),{cache:'no-store'}),data=await response.json() as any;if(current!==sequence.current)return;if(!response.ok)throw Error(data.error||'گزارش دریافت نشد.');setChoices(data.choices);setResult(data);}catch(e){if(current===sequence.current)setError((e as Error).message);}finally{if(current===sequence.current)setLoading(false);}}
 useEffect(()=>{void run(applied.current);return()=>{sequence.current++;};},[revision]);
 function status(value:string){const next={...form,status:value};setForm(next);void run(next);}
 return <section aria-label="گزارش سفارش‌های ارسال">
 <div className="tools" role="group" aria-label="نمای سفارش‌های ارسال">{[['open','سفارش‌های باز'],['closed','بسته‌شده‌ها'],['all','همه سوابق']].map(([value,title])=><button type="button" key={value} className={'btn '+(form.status===value?'primary':'')} onClick={()=>status(value)}>{title}</button>)}</div>
 <form onSubmit={e=>{e.preventDefault();void run(form);}}><div className="formgrid">
 <label className="field">شماره سفارش، شناسه حواله، سریال یا رهگیری<input type="search" value={form.query} maxLength={200} onChange={e=>change('query',e.target.value)}/></label>
 <MaterialSelect value={form.productId||'all-products'} onChange={id=>change('productId',id==='all-products'?'':id)} choices={[{id:'all-products',code:'',name:'همه کالاها'},...choices.products]}/>
 <label className="field">وضعیت<select value={form.status} onChange={e=>change('status',e.target.value)}>{Object.entries(shippingStatuses).map(([id,title])=><option key={id} value={id}>{title}</option>)}</select></label>
 <label className="field">نوع تاریخ<select value={form.dateType} onChange={e=>change('dateType',e.target.value)}>{Object.entries(shippingDateTypes).map(([id,title])=><option key={id} value={id}>{title}</option>)}</select></label>
 <SolarDate label="از تاریخ" required={false} value={form.from} onChange={v=>change('from',v)}/><SolarDate label="تا تاریخ" required={false} value={form.to} onChange={v=>change('to',v)}/>
 <label className="field">انبار مبدأ<select value={form.sourceId} onChange={e=>change('sourceId',e.target.value)}><option value="">همه مبدأها</option>{choices.sources.map((w:any)=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
 <label className="field">مقصد<select value={form.destinationId} onChange={e=>change('destinationId',e.target.value)}><option value="">همه مقصدها</option>{choices.destinations.map((w:any)=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
 <label className="field">روش دریافت سفارش<select value={form.channel} onChange={e=>change('channel',e.target.value)}><option value="">همه روش‌ها</option>{choices.channels.map((c:string)=><option key={c} value={c}>{channels[c]||c}</option>)}</select></label>
 </div><p className="subtle">همه فیلترها اختیاری‌اند و با هم اعمال می‌شوند. بازه شامل روز شروع و پایان است؛ تاریخ ثبت‌نشده با حدس جایگزین نمی‌شود.</p><div className="tools"><button className="btn primary" disabled={loading}>گرفتن گزارش</button><button type="button" className="btn" disabled={loading} onClick={()=>{const next={...defaultShippingFilters,status:'all'};setForm(next);void run(next);}}>پاک‌کردن فیلترها و نمایش همه</button></div></form>
 {error&&<p className="notice error" role="alert">{error}</p>}{loading&&<p role="status">در حال دریافت گزارش…</p>}
 {result&&<><p role="status">{n(result.summary.orders)} سفارش · {n(result.summary.shipments)} حواله · {n(result.summary.open)} حواله باز · {n(result.summary.closed)} حواله بسته</p><p className="subtle">{result.notice}</p>
 {!!result.summary.products.length&&<div style={{overflowX:'auto'}}><table aria-label="جمع گزارش به تفکیک کالا"><thead><tr>{['کالا','کد','تعداد حواله‌شده','دریافت تأییدشده مقصد','مانده تأیید دریافت'].map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>{result.summary.products.map((p:any)=><tr data-pair-row={JSON.stringify(p.productId||p.code)} key={p.productId||p.code}><td>{p.name||'نام ثبت نشده'}</td><td><bdi dir="ltr">{p.code||'—'}</bdi></td><td>{n(p.quantity)}</td><td>{n(p.received)}{p.unresolvedShipments>0&&<> + {n(p.unresolvedShipments)} حواله نیازمند تطبیق</>}</td><td>{n(p.remaining)}{p.unresolvedShipments>0&&' + مقدار نامعلوم حواله‌های مغایرت‌دار'}</td></tr>)}</tbody></table></div>}
 {!result.rows.length&&<p className="empty">سفارشی مطابق این فیلترها پیدا نشد.</p>}
 {result.rows.map((r:any)=><article data-pair-row={JSON.stringify(r.id)} className="flow-card" key={r.id}><h3>{r.orderCode||'سفارش قدیمی بدون شماره'} · {r.productName||r.productCode} · {r.destinationName}</h3><p>{shippingStatuses[r.status]} · تعداد: {n(r.quantity)} · دریافت تأییدشده: {n(r.received)} · مانده: {n(r.remaining)}</p><p>ثبت سفارش: {day(r.orderDay)} · خروج: {day(r.dispatchDay)} · دریافت مقصد: {day(r.receiptDay)}</p><p>مبدأ: {r.sources.map((w:any)=>w.name).join('، ')||r.pickup||'ثبت نشده'} ← مقصد: {r.destinationName} · {r.destination}</p>
 <details><summary>مسیر سفارش، سریال‌ها و جزئیات دریافت</summary>{r.notes&&<p>یادداشت حواله: {r.notes}</p>}<p>شناسه حواله: <bdi dir="ltr">{r.shipmentCode}</bdi></p><p>روش دریافت سفارش: {channels[r.channel]||r.channel||'ثبت نشده'} · ثبت‌کننده: {r.submittedBy||'ثبت نشده'}</p>{r.requestDay&&<p>تاریخ دریافت درخواست: {day(r.requestDay)}</p>}{r.requestReference&&<p>مرجع درخواست: {r.requestReference}</p>}{r.serials.map((s:string)=><p key={s}>سریال: <bdi dir="ltr">{s}</bdi></p>)}{r.transportState&&<p>مرحله فعلی حمل: {transportStates[r.transportState]||r.transportState}</p>}<p>کد حمل: {r.transportCode||'ثبت نشده'} · باربری / تحویل‌گیرنده: {r.carrier||'ثبت نشده'}</p><p>بارنامه: {r.waybill||'ثبت نشده'} · رهگیری: {r.tracking||'ثبت نشده'} · رسید: {r.receiptReference||'ثبت نشده'}</p>{r.receiptResult&&<p>نتیجه اعلام مقصد: {({complete:'کامل',shortage:'کسری',damage:'آسیب'} as any)[r.receiptResult]||r.receiptResult}</p>}<ol>{r.timeline.map((t:any,i:number)=><li key={i}>{t.title} · {t.at.includes('T')?formatDateTime(t.at):day(t.at)}{t.by&&' · '+t.by}{t.notes&&' · '+t.notes}</li>)}</ol></details>
 {r.status!=='cancelled'&&renderActions(r.id)}</article>)}
 </>}
 </section>;
}
