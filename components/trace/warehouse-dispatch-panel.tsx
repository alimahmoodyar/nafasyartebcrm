"use client";
import {RefreshButton} from './refresh-button';
import {useEffect,useRef,useState} from 'react';
import type {Session} from '@/lib/permissions';
import {dispatchCategories,type DispatchRow} from '@/lib/warehouse-dispatch';
import {formatDate} from '@/lib/persian-date';
import {FulfillmentPanel} from './fulfillment-panel';
import {AfterSalesPanel} from './after-sales-panel';
import {HospitalPartsPanel} from './hospital-parts-panel';
export function WarehouseDispatchPanel({demo,user,onSaved,onNavigate,targetId=""}:{targetId?:string;demo:boolean;user:Session;onSaved:()=>void;onNavigate:(section:string,target?:string)=>void}){
 const [category,setCategory]=useState(''),[rows,setRows]=useState<DispatchRow[]>([]),[selected,setSelected]=useState<DispatchRow|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);const seq=useRef(0);
 async function load(){if(demo)return;const current=++seq.current;setLoading(true);setError('');setRows([]);try{const r=await fetch('/api/warehouse/dispatch?'+new URLSearchParams({category}),{cache:'no-store'}),d:any=await r.json();if(current!==seq.current)return;if(!r.ok)throw Error(d.error);const visible:DispatchRow[]=targetId?d.rows.filter((row:DispatchRow)=>row.id===targetId):d.rows;setRows(visible);setSelected(s=>visible.find(row=>row.id===(targetId||s?.id))||null);}catch(e){if(current===seq.current)setError((e as Error).message);}finally{if(current===seq.current)setLoading(false);}}
 useEffect(()=>{void load();return()=>{seq.current++}},[category,demo,targetId]);
 const saved=()=>{void load();onSaved()};
 if(demo)return <p className="notice">برای مشاهده سفارش‌ها وارد اطلاعات شرکت شوید.</p>;
 return <section aria-label="سفارش‌های باز"><h2 style={{marginBottom:16}}>سفارش‌های باز</h2><div className="tools" style={{justifyContent:'space-between',marginBottom:16}}>{!targetId&&<label className="field">دسته‌بندی<select value={category} onChange={e=>{setSelected(null);setCategory(e.target.value)}}><option value="">همه سفارش‌های باز</option>{Object.entries(dispatchCategories).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>}<RefreshButton retry={!!error} type="button" className="btn" disabled={loading} onRefresh={()=>load()} /></div>
 {error&&<p className="notice error" role="alert">{error}</p>}{loading&&<p role="status">در حال دریافت سفارش‌ها…</p>}{!loading&&!error&&!rows.length&&<p className="empty">سفارش بازی در این دسته وجود ندارد.</p>}
 {!!rows.length&&<div className="as-table"><table aria-label="فهرست سفارش‌های باز"><thead><tr>{['سفارش / تاریخ','دسته','مقصد','اقلام','مرحله',''].map((v,i)=><th key={i}>{v}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><bdi>{r.reference}</bdi><p className="subtle">{r.created?formatDate(r.created):'—'}</p></td><td>{dispatchCategories[r.category]}</td><td>{r.destination||'—'}</td><td>{r.lines.map((l,i)=><p key={i}>{l.name} {l.code&&<bdi dir="ltr">({l.code})</bdi>} · {l.quantity.toLocaleString('fa-IR')} {l.unit}</p>)}</td><td>{r.state}</td><td><button className="btn" type="button" onClick={()=>setSelected(r)}>بررسی و انجام</button></td></tr>)}</tbody></table></div>}
 {selected&&<article className="flow-card"><div className="tools" style={{justifyContent:'space-between'}}><strong>{selected.reference} · {selected.destination}</strong><button className="btn" type="button" aria-label="بستن جزئیات سفارش" onClick={()=>setSelected(null)}>×</button></div>{selected.source==='product'?<FulfillmentPanel key={selected.id} demo={false} embedded initialTab="dispatch" dispatchOrderId={selected.sourceId} onSaved={saved}/>:selected.source==='service'?<AfterSalesPanel key={selected.id} demo={false} embedded user={user} domain={selected.category} initialTab="orders" dispatchOrderId={selected.sourceId} onSaved={saved} onNavigate={onNavigate}/>:<HospitalDispatch key={selected.id} requestId={selected.sourceId} onSaved={saved}/>}</article>}
 </section>;
}
function HospitalDispatch({requestId,onSaved}:{requestId:string;onSaved:()=>void}){
 const [data,setData]=useState<any>(null),[error,setError]=useState('');async function load(){try{const r=await fetch('/api/hospital',{cache:'no-store'}),d:any=await r.json();if(!r.ok)throw Error(d.error);setData(d);}catch(e){setError((e as Error).message)}}useEffect(()=>{void load()},[]);const request=data?.rows.find((r:any)=>r.type==='hospital_part_request'&&r.id===requestId);
 return error?<p className="notice error" role="alert">{error}</p>:!data?<p role="status">در حال دریافت درخواست…</p>:!request?<p>درخواست دیگر در دسترس نیست.</p>:<HospitalPartsPanel data={{...data,rows:[request]}} jobId={request.data.jobId} targetId={request.id} onSaved={async()=>{await load();onSaved()}}/>;
}
