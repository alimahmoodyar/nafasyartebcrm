'use client';
import {useEffect,useRef,useState} from 'react';
import {formatDate} from '@/lib/persian-date';
import {serviceTimeline} from '@/lib/service-payment-schedule';
const money=(v:string)=>BigInt(v).toLocaleString('fa-IR')+' ریال';
export function ServicePaymentSchedule({collection,onOpen}:{collection:any;onOpen:(orderId:string)=>void}){
 const [data,setData]=useState(collection),[loading,setLoading]=useState(false),[error,setError]=useState(''),request=useRef(0);
 useEffect(()=>{request.current++;setData(collection);setError('');setLoading(false);return()=>{request.current++}},[collection]);
 async function page(n:number){const id=++request.current;setLoading(true);setError('');try{const response=await fetch('/api/after-sales?domain=home&collectionOnly=1&schedulePage='+n,{cache:'no-store'}),result=await response.json() as any;if(!response.ok)throw Error(result.error||'دریافت سررسیدها انجام نشد.');if(id===request.current)setData(result.collection)}catch(e){if(id===request.current)setError((e as Error).message)}finally{if(id===request.current)setLoading(false)}}
 return <section className="panel service-rep-schedule" aria-label="سررسیدهای پرداخت قطعات"><h3>سررسیدهای پرداخت قطعات</h3><p className="subtle">نزدیک‌ترین سررسید اول؛ سررسیدگذشته‌ها در ابتدای فهرست قرار دارند.</p>
 {error&&<p className="notice error" role="alert">{error}</p>}
 {!data?<p>اطلاعات سررسید دریافت نشده است.</p>:<>
 <p className="subtle">وضعیت حساب تا {formatDate(data.asOf)} · {Number(data.scheduleTotal||0).toLocaleString('fa-IR')} بخش باز</p>
 {!data.paymentSchedule?.length?<p>سررسید بازی ثبت نشده است؛ مهلت قطعاتِ خارج‌نشده از انبار هنوز شروع نشده است.</p>:data.paymentSchedule.map((r:any)=>{const line=serviceTimeline(r.exitDay,r.due,data.asOf);return <article className="service-due-row" key={r.orderId+':'+r.shipmentId}>
 <div><button className="link" type="button" onClick={()=>onOpen(r.orderId)}>{r.orderCode}</button><p className="subtle">{r.shipmentLabel||'فاکتور'}</p><strong className={'service-due-badge '+(r.days<0?'late':r.days<=7?'soon':'later')}>{r.days<0?(-r.days).toLocaleString('fa-IR')+' روز تأخیر':r.days===0?'سررسید امروز':r.days.toLocaleString('fa-IR')+' روز مانده'}</strong></div>
 <dl className="service-due-amounts"><div><dt>مبلغ اولیه</dt><dd>{money(r.amountRial)}</dd></div><div><dt>پرداخت‌ها و مبالغ کسرشده</dt><dd>{money(r.settledRial)}</dd></div><div><dt>مانده</dt><dd>{money(r.remainingRial)}</dd></div></dl>
 <div className="service-due-timeline"><div className="service-due-dates"><span>خروج انبار<br/>{r.exitDay?formatDate(r.exitDay):'—'}</span><span>سررسید<br/>{formatDate(r.due)}</span><span className={r.days<0?'service-late':''}>امروز<br/>{formatDate(data.asOf)}</span></div>{line&&<div className="service-time-track" role="img" aria-label={'از خروج تا سررسید '+(r.days<0?(-r.days)+' روز تأخیر':r.days+' روز باقی‌مانده')}><span className="service-time-elapsed" style={{width:line.normalPct+'%'}}/><span className="service-time-due" style={{insetInlineStart:line.duePct+'%'}}/>{line.overduePct>0&&<span className="service-time-overdue" style={{insetInlineStart:line.duePct+'%',width:line.overduePct+'%'}}/>}<span className={'service-time-today '+(r.days<0?'late':'')} style={{insetInlineStart:line.todayPct+'%'}}/></div>}{BigInt(r.heldRial)>BigInt(0)&&<small className="subtle">بخشی از مانده، در انتظار تأیید گارانتی و فعلاً خارج از مطالبه است.</small>}</div>
 </article>})}
 {data.schedulePages>1&&<nav className="tools" aria-label="صفحه‌های سررسید"><button type="button" className="btn" disabled={loading||data.schedulePage<=1} onClick={()=>void page(data.schedulePage-1)}>قبلی</button><span>{Number(data.schedulePage).toLocaleString('fa-IR')} از {Number(data.schedulePages).toLocaleString('fa-IR')}</span><button type="button" className="btn" disabled={loading||data.schedulePage>=data.schedulePages} onClick={()=>void page(data.schedulePage+1)}>بعدی</button></nav>}
 <p className="subtle">مهلت هر محموله از خروج همان محموله از انبار شروع می‌شود. پرداخت‌ها و بستانکاری‌های عمومی به ترتیب قدیمی‌ترین سررسید محاسبه می‌شوند.</p>
 </>}{loading&&<p role="status">در حال دریافت سررسیدها…</p>}</section>;
}
