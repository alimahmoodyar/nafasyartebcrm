'use client';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {MaterialAttachments} from './material-attachments';
import {BatchLabelLink} from './batch-label-link';
import {useEffect,useState} from 'react';
import type {Session} from '@/lib/permissions';
import type {Row} from '@/lib/model';
import {filterWarehouseStock} from '@/lib/warehouse-stock';
import {warehouseName} from '@/lib/production';
export function WarehouseStockPanel({user,demo,onOpen}:{user:Session;demo:boolean;onOpen:(row:Row)=>void}){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[query,setQuery]=useState(''),[warehouse,setWarehouse]=useState(''),[kind,setKind]=useState(''),[selected,setSelected]=useState<any>(null);
 async function load(){setError('');try{const r=await fetch('/api/warehouse/stock',{cache:'no-store'}),v:any=await r.json();if(!r.ok){setData(null);throw Error(v.error||'دریافت موجودی انجام نشد.');}setData(v);}catch(e:any){setError(e.message);}}
 useEffect(()=>{if(!demo)void load();},[demo]);
 if(demo)return <p className="notice">برای موجودی واقعی وارد اطلاعات شرکت شوید.</p>;
 const warehouses=data?.warehouses||[],entries=data?.entries||[],filtered=filterWarehouseStock(entries,{kind,query,warehouse});
 return <section className="panel"><div className="inside"><div className="formgrid"><label className="field">جست‌وجو با نام یا کد<input type="search" placeholder="نام، کد کالا یا محصول، بچ یا سریال" value={query} onChange={e=>setQuery(e.target.value)}/></label><label className="field">نوع موجودی<select value={kind} onChange={e=>setKind(e.target.value)}><option value="">همه</option><option value="material">مواد اولیه</option><option value="product">محصول نهایی</option></select></label><label className="field">انبار فیزیکی<select value={warehouse} onChange={e=>setWarehouse(e.target.value)}><option value="">همه انبارهای مجاز</option>{warehouses.map((w:any)=><option key={w.id} value={w.id}>{w.data.name}</option>)}</select></label></div>
  <p className="subtle">موجودی مواد اولیه و محصول نهایی از گردش ثبت‌شدهٔ انبارهای مجاز شما خوانده می‌شود.</p><button className="btn" onClick={()=>void load()}>تازه‌سازی</button>
  {error&&<p className="notice error" role="alert">{error}</p>}{!data&&!error&&<p role="status">در حال دریافت موجودی…</p>}
  {data&&<div style={{overflowX:'auto'}}><table><thead><tr>{['کالا / محصول','کد کالا / محصول','بچ / سریال','انبار فیزیکی','محل / وضعیت','موجودی','واحد',''].map(title=><th key={title}>{title}</th>)}</tr></thead><tbody>{filtered.map((e:any)=><tr key={e.item_id+':'+e.warehouse+':'+e.warehouseId+':'+e.locations}><td><button type="button" className="link" onClick={()=>setSelected(e)} aria-label={'مشاهده شناسنامه '+e.name}>{e.name}</button></td><td><button type="button" className="link" onClick={()=>setSelected(e)} aria-label={'شناسنامه کد '+e.itemCode}><bdi dir="ltr">{e.itemCode||'—'}</bdi></button></td><td><button className="link" onClick={()=>onOpen(e.row)}><bdi dir="ltr">{e.row.data.code}</bdi></button></td><td>{e.warehouseName}</td><td>{warehouseName(e.warehouse)}{e.locations&&' · '+e.locations}</td><td>{(e.quantity/1000).toLocaleString('fa-IR',{maximumFractionDigits:3})}</td><td>{e.unit}</td><td>{e.kind==='material'&&<BatchLabelLink batchId={e.row.id}/>}</td></tr>)}</tbody></table>{!filtered.length&&<p className="empty">موجودی مطابق این جست‌وجو در دسترسی شما نیست.</p>}</div>}
 <Dialog open={!!selected} onOpenChange={open=>{if(!open)setSelected(null)}}><DialogContent className="modal sm:max-w-3xl" style={{maxHeight:'85vh',overflowY:'auto'}}><DialogTitle>{selected?.passport?.title||'شناسنامه'} · {selected?.name}</DialogTitle><DialogDescription>مشخصات ثبت‌شدهٔ همین ردیف موجودی</DialogDescription>{selected&&<>
  {selected.passport?.historical&&<p className="notice">شناسنامهٔ اصلی در سوابق موجود نیست؛ مشخصات ثبت‌شدهٔ همین بچ یا دستگاه نمایش داده می‌شود.</p>}
  <dl className="formgrid">{(selected.passport?.details||[{label:'نام',value:selected.name},{label:'کد کالا / محصول',value:selected.itemCode}]).filter((f:any)=>f.value!==undefined&&f.value!==null&&f.value!=='').map((f:any)=><div key={f.label}><dt className="subtle">{f.label}</dt><dd style={{margin:0,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{String(f.value)}</dd></div>)}</dl>
  <h3>{selected.kind==='material'?'بچ انتخاب‌شده':'دستگاه انتخاب‌شده'}</h3><dl className="formgrid">{(selected.passport?.lot||[{label:selected.kind==='material'?'کد بچ':'سریال دستگاه',value:selected.row.data.code}]).filter((f:any)=>f.value!==undefined&&f.value!==null&&f.value!=='').map((f:any)=><div key={f.label}><dt className="subtle">{f.label}</dt><dd style={{margin:0,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{String(f.value)}</dd></div>)}</dl>
  {selected.passport?.materialId&&<details><summary>عکس و مدارک کالا</summary><MaterialAttachments key={selected.passport.materialId} materialId={selected.passport.materialId} write={false}/></details>}
 </>}</DialogContent></Dialog>
 </div></section>;
}
