'use client';
import {BatchLabelLink} from './batch-label-link';
import {useEffect,useState} from 'react';
import type {Session} from '@/lib/permissions';
import type {Row} from '@/lib/model';
import {warehouseName} from '@/lib/production';
export function WarehouseStockPanel({user,demo,onOpen}:{user:Session;demo:boolean;onOpen:(row:Row)=>void}){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[query,setQuery]=useState(''),[warehouse,setWarehouse]=useState(''),[stage,setStage]=useState('');
 async function load(){setError('');try{const r=await fetch('/api/flow',{cache:'no-store'}),v:any=await r.json();if(!r.ok){setData(null);throw Error(v.error||'دریافت موجودی انجام نشد.');}setData(v);}catch(e:any){setError(e.message);}}
 useEffect(()=>{if(!demo)void load();},[demo]);
 if(demo)return <p className="notice">برای موجودی واقعی وارد اطلاعات شرکت شوید.</p>;
 const warehouses=(data?.warehouses||[]).filter((w:any)=>user.isAdmin||(w.inventoryMembers||[]).some((m:any)=>[m.id,'local:'+m.id,m.subject].filter(Boolean).includes(user.userId))),receipts=(data?.entities||[]).filter((e:any)=>e.type==='receipt'),rows=data?.rows||[];
 const entries=(data?.balances||[]).filter((b:any)=>b.quantity>0&&(user.isAdmin||data.warehouseIds.includes(b.warehouse))).flatMap((b:any)=>{
  const row=rows.find((r:any)=>r.id===b.item_id);if(!row||row.kind!=='batch')return [];
  const receipt=receipts.find((r:any)=>r.id===row.id),stored=['raw','quarantine'].includes(b.warehouse),w=stored?warehouses.find((w:any)=>w.id===(receipt?.data.warehouseId||row.data.warehouseId)):undefined;
  if(stored&&(receipt?.data.warehouseId||row.data.warehouseId)&&!w)return [];
  const locations=b.warehouse==='raw'?(data.slots||[]).filter((s:any)=>s.batch_id===row.id).map((s:any)=>s.location.includes('|')?s.location.slice(s.location.indexOf('|')+1):s.location).join('، '):'';
  return [{...b,row,warehouseId:w?.id||'',warehouseName:w?.data.name||(stored?'سوابق بدون انبار فیزیکی':'محل فیزیکی جداگانه ثبت نشده'),locations}];
 });
 const filtered=entries.filter((e:any)=>(!warehouse||e.warehouseId===warehouse)&&(!stage||e.warehouse===stage)&&(e.row.data.part+' '+e.row.data.code+' '+e.row.data.partCode+' '+e.locations).toLowerCase().includes(query.trim().toLowerCase()));
 return <section className="panel"><div className="inside"><div className="formgrid"><label className="field">نام کالا، کد قطعه، بچ یا محل<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label><label className="field">انبار فیزیکی<select value={warehouse} onChange={e=>setWarehouse(e.target.value)}><option value="">همه انبارهای مجاز</option>{warehouses.map((w:any)=><option key={w.id} value={w.id}>{w.data.name}</option>)}</select></label><label className="field">محل یا وضعیت موجودی<select value={stage} onChange={e=>setStage(e.target.value)}><option value="">همه وضعیت‌ها</option>{Array.from(new Set<string>(entries.map((e:any)=>e.warehouse))).map(id=><option key={id} value={id}>{warehouseName(id)}</option>)}</select></label></div>
  <p className="subtle">مقدار موجودی از گردش ثبت‌شده خوانده می‌شود؛ موجودی خدمات و رزرو دستگاه‌ها در گزینه‌های همان بخش قابل مشاهده‌اند.</p><button className="btn" onClick={()=>void load()}>تازه‌سازی</button>
  {error&&<p className="notice error" role="alert">{error}</p>}{!data&&!error&&<p role="status">در حال دریافت موجودی…</p>}
  {data&&<div style={{overflowX:'auto'}}><table><thead><tr>{['کالا','بچ','انبار فیزیکی','محل / وضعیت','موجودی','واحد',''].map(title=><th key={title}>{title}</th>)}</tr></thead><tbody>{filtered.map((e:any)=><tr key={e.item_id+':'+e.warehouse}><td>{e.row.data.part}</td><td><button className="link" onClick={()=>onOpen(e.row)}>{e.row.data.code}</button></td><td>{e.warehouseName}</td><td>{warehouseName(e.warehouse)}{e.locations&&' · '+e.locations}</td><td>{(e.quantity/1000).toLocaleString('fa-IR',{maximumFractionDigits:3})}</td><td>{e.row.data.unit}</td><td><BatchLabelLink batchId={e.row.id}/></td></tr>)}</tbody></table>{!filtered.length&&<p className="empty">موجودی مطابق این جست‌وجو در دسترسی شما نیست.</p>}</div>}
 </div></section>;
}
