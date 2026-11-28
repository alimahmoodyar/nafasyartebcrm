'use client';
import {RefreshButton} from './refresh-button';
import {warehousePath} from '@/lib/warehouse-tree';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {MaterialAttachments} from './material-attachments';
import {BatchLabelLink} from './batch-label-link';
import {Fragment,useEffect,useState} from 'react';
import type {Session} from '@/lib/permissions';
import type {Row} from '@/lib/model';
import {filterWarehouseStock,groupWarehouseStock} from '@/lib/warehouse-stock';
import {warehouseName} from '@/lib/production';
type TestStockPreview={batchId:string;code:string;name:string;unit:string;quantity:number;revision:number;balances:{warehouse:string;quantity:number}[]};
export function WarehouseStockPanel({user,demo,onOpen,onHistory}:{onHistory?:(group:any)=>void;user:Session;demo:boolean;onOpen:(row:Row)=>void}){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[query,setQuery]=useState(''),[warehouse,setWarehouse]=useState(''),[includeChildren,setIncludeChildren]=useState(true),[kind,setKind]=useState(''),[selected,setSelected]=useState<any>(null),[expanded,setExpanded]=useState<string[]>([]);
 const canRemoveTestStock=user.isAdmin&&!user.profileReview&&!user.rolePreview;
 const [cleanup,setCleanup]=useState<TestStockPreview|null>(null),[reason,setReason]=useState(''),[cleanupError,setCleanupError]=useState(''),[cleanupBusy,setCleanupBusy]=useState(false),[cleanupMessage,setCleanupMessage]=useState('');
 async function stockCleanup<Result>(payload:Record<string,unknown>){
  const response=await fetch('/api/flow',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),mode:'remove_test_stock',...payload})});
  const result=await response.json() as Result & {error?:string};
  if(!response.ok)throw Error(result.error||'پاک‌سازی موجودی انجام نشد.');
  return result;
 }
 async function previewCleanup(batchId:string){
  setCleanupBusy(true);setCleanupMessage('');setCleanupError('');setReason('');
  try{setCleanup(await stockCleanup<TestStockPreview>({batchId,previewOnly:true}));}
  catch(error){setCleanupError((error as Error).message);}
  finally{setCleanupBusy(false);}
 }
 async function removeTestStock(event:React.FormEvent){
  event.preventDefault();
  if(!cleanup||cleanupBusy||!reason.trim())return;
  setCleanupBusy(true);setCleanupError('');
  try{
   await stockCleanup({batchId:cleanup.batchId,code:cleanup.code,revision:cleanup.revision,balances:cleanup.balances,reason:reason.trim(),confirmed:true});
   setCleanup(null);setCleanupMessage('موجودی آزمایشی بچ '+cleanup.code+' از موجودی انبار خارج شد.');
   await load();window.dispatchEvent(new Event('nafasyar-tasks-changed'));
  }catch(error){setCleanupError((error as Error).message);}
  finally{setCleanupBusy(false);}
 }
 async function load(){setError('');try{const r=await fetch('/api/warehouse/stock',{cache:'no-store'}),v:any=await r.json();if(!r.ok){setData(null);throw Error(v.error||'دریافت موجودی انجام نشد.');}setData(v);setSelected(null);}catch(e:any){setError(e.message);}}
 useEffect(()=>{if(!demo)void load();},[demo]);
 if(demo)return <p className="notice">برای موجودی واقعی وارد اطلاعات شرکت شوید.</p>;
 const warehouses=data?.warehouses||[],entries=data?.entries||[],filtered=filterWarehouseStock(entries,{kind,query,warehouse,includeChildren},warehouses),groups=groupWarehouseStock(filtered);
 const showService=filtered.some((e:any)=>e.serviceLotId||(e.reserved||0)>0),columns=showService?8:6;
 return <section className="panel warehouse-stock"><div className="inside">
  <div className="warehouse-stock__filters">
   <label className="field warehouse-stock__search">جست‌وجو با نام یا کد<input type="search" placeholder="نام، کد کالا یا محصول، بچ یا سریال" value={query} onChange={e=>setQuery(e.target.value)}/></label>
   <label className="field">نوع موجودی<select value={kind} onChange={e=>setKind(e.target.value)}><option value="">همه</option><option value="material">مواد اولیه</option><option value="product">محصول نهایی</option></select></label>
   <label className="field">انبار یا مرکز خدمات<select value={warehouse} onChange={e=>setWarehouse(e.target.value)}><option value="">همه انبارهای مجاز</option>{warehouses.map((w:any)=><option key={w.id} value={w.id}>{warehousePath(warehouses,w.id)}</option>)}</select></label>
  </div>
  <div className="warehouse-stock__toolbar"><label className="flow-check"><input type="checkbox" checked={includeChildren} onChange={e=>setIncludeChildren(e.target.checked)}/>شامل زیرانبارها</label><RefreshButton retry={!!error} type="button" className="btn" onRefresh={()=>load()} /></div>
  {cleanupMessage&&<p role="status">{cleanupMessage}</p>}{!cleanup&&cleanupError&&<p className="notice error" role="alert">{cleanupError}</p>}
  {canRemoveTestStock&&<Dialog open={!!cleanup} onOpenChange={open=>{if(!open&&!cleanupBusy){setCleanup(null);setCleanupError('')}}}>
   <DialogContent className="modal sm:max-w-lg">
    <DialogTitle>خارج کردن موجودی آزمایشی</DialogTitle>
    <DialogDescription>فقط موجودی همین بچ خارج می‌شود. شناسنامهٔ کالا و سابقهٔ عملیات قابل پیگیری می‌مانند.</DialogDescription>
    {cleanup&&<form onSubmit={removeTestStock}>
     <p><strong>{cleanup.name}</strong> · بچ <bdi>{cleanup.code}</bdi></p>
     <p>کل موجودی این بچ در انبارها <strong>{(cleanup.quantity/1000).toLocaleString('fa-IR')} {cleanup.unit}</strong></p>
     <label className="field">دلیل پاک‌سازی<textarea required maxLength={500} disabled={cleanupBusy} value={reason} onChange={e=>setReason(e.target.value)}/></label>
     {cleanupError&&<p className="notice error" role="alert">{cleanupError}</p>}
     <div className="tools"><button className="btn primary" disabled={cleanupBusy||!reason.trim()}>{cleanupBusy?'در حال ثبت…':'تأیید خروج موجودی آزمایشی'}</button><button type="button" className="btn" disabled={cleanupBusy} onClick={()=>{setCleanup(null);setCleanupError('')}}>انصراف</button></div>
    </form>}
   </DialogContent>
  </Dialog>}
  {error&&<p className="notice error" role="alert">{error}</p>}{!data&&!error&&<p role="status">در حال دریافت موجودی…</p>}
  {entries.some((e:any)=>e.serviceLotId&&!e.warehouseId)&&<p className="notice">بخشی از موجودی خدمات هنوز به انبار متصل نشده است؛ در «همه انبارهای مجاز» دیده می‌شود. مدیر می‌تواند در تعریف انبار، مرکز خدمات را انتخاب کند.</p>}
  {data&&<>
   <div className="warehouse-stock__scroll" role="region" aria-label="گزارش موجودی" tabIndex={0}>
    <table className="warehouse-stock__table" aria-label="موجودی کالا و محصول"><thead><tr>
     <th scope="col" className="warehouse-stock__item">کالا / محصول</th><th scope="col" className="warehouse-stock__unit">واحد</th>
     <th scope="col" className="warehouse-stock__quantity warehouse-stock__usable">قابل مصرف</th><th scope="col" className="warehouse-stock__quantity warehouse-stock__pending">منتظر کنترل<small>یا جانمایی</small></th><th scope="col" className="warehouse-stock__quantity warehouse-stock__rejected">مردود<small>یا غیرقابل مصرف</small></th>
     {showService&&<><th scope="col" className="warehouse-stock__quantity">رزرو خدمات</th><th scope="col" className="warehouse-stock__quantity">آزاد از<small>رزرو خدمات</small></th></>}
     <th scope="col" className="warehouse-stock__action-heading">جزئیات</th>
    </tr></thead><tbody>{groups.map((g:any)=><Fragment key={g.key}>
     <tr className={expanded.includes(g.key)?'warehouse-stock__row is-expanded':'warehouse-stock__row'}>
      <td className="warehouse-stock__item"><button data-pair-open="warehouse-stock-panel:2d2ce641ff51" type="button" className="warehouse-stock__name" onClick={()=>setSelected(g)} aria-label={'مشاهده شناسنامه '+g.name}>{g.name}</button><button data-pair-open="warehouse-stock-panel:72a3e29f1114" type="button" className="warehouse-stock__code" onClick={()=>setSelected(g)} aria-label={'شناسنامه کد '+g.itemCode}><bdi dir="ltr">{g.itemCode||'—'}</bdi></button></td>
      <td className="warehouse-stock__unit">{g.unit}</td>
      {stockNumber(g.usable,'usable')}{stockNumber(g.pending,'pending')}{stockNumber(g.rejected,'rejected')}
      {showService&&<>{stockNumber(g.reserved)}{stockNumber(g.available)}</>}
      <td><div className="warehouse-stock__actions">{onHistory&&g.entries.some((e:any)=>!e.serviceLotId)&&<button type="button" className="warehouse-stock__action" onClick={()=>onHistory(g)} aria-label={'گردش کالا '+g.name}>گردش کالا</button>}<button data-pair-open="warehouse-stock-panel:077470e7dbca" type="button" className="warehouse-stock__action warehouse-stock__disclosure" aria-expanded={expanded.includes(g.key)} onClick={()=>setExpanded(keys=>keys.includes(g.key)?keys.filter(key=>key!==g.key):[...keys,g.key])}>{g.kind==='material'?'بچ‌ها':'سریال‌ها'} ({g.lotCount.toLocaleString('fa-IR')})<span className="warehouse-stock__chevron" aria-hidden="true"/></button></div></td>
     </tr>
     {expanded.includes(g.key)&&<tr className="warehouse-stock__detail-row"><td colSpan={columns}>
      <div className="warehouse-stock__detail"><div className="warehouse-stock__detail-heading"><strong>{g.kind==='material'?'بچ‌های':'سریال‌های'} {g.name}</strong><span>واحد: {g.unit}</span></div>
       <div className="warehouse-stock__detail-scroll"><table className="warehouse-stock__table warehouse-stock__table--detail" aria-label={'جزئیات موجودی '+g.name}><thead><tr>
        <th scope="col">بچ / سریال</th><th scope="col">انبار و محل نگهداری</th><th scope="col" className="warehouse-stock__quantity warehouse-stock__usable">قابل مصرف</th><th scope="col" className="warehouse-stock__quantity warehouse-stock__pending">منتظر کنترل<small>یا جانمایی</small></th><th scope="col" className="warehouse-stock__quantity warehouse-stock__rejected">مردود<small>یا غیرقابل مصرف</small></th>
        {showService&&<><th scope="col" className="warehouse-stock__quantity">رزرو خدمات</th><th scope="col" className="warehouse-stock__quantity">آزاد از<small>رزرو خدمات</small></th></>}<th scope="col">چاپ</th>
       </tr></thead><tbody>{g.entries.map((e:any)=><tr key={e.serviceLotId||e.item_id+':'+e.warehouse+':'+e.warehouseId+':'+e.locations}>
        <td><button data-pair-open="warehouse-stock-panel:11b7e6597ca9" type="button" className="warehouse-stock__lot" onClick={()=>setSelected(e)}><bdi dir="ltr">{e.row.data.code}</bdi></button></td>
        <td className="warehouse-stock__location"><span>{warehousePath(warehouses,e.warehouseId)||e.warehouseName}</span><small>{e.serviceLotId?'خدمات':warehouseName(e.warehouse)}{e.locations&&' · '+e.locations}</small></td>
        {stockNumber(e.quality.usable,'usable')}{stockNumber(e.quality.pending,'pending')}{stockNumber(e.quality.rejected,'rejected')}
        {showService&&<>{stockNumber(e.reserved||0)}{stockNumber(Math.max(0,e.quality.usable-(e.reserved||0)))}</>}
        <td>{e.kind==='material'&&!e.serviceLotId&&<><BatchLabelLink batchId={e.row.id}/>{canRemoveTestStock&&<button type="button" className="btn" disabled={cleanupBusy} onClick={()=>void previewCleanup(e.row.id)}>پاک‌سازی موجودی آزمایشی</button>}</>}</td>
       </tr>)}</tbody></table></div>
      </div>
     </td></tr>}
    </Fragment>)}</tbody></table>
    {!groups.length&&<p className="empty">موجودی مطابق این جست‌وجو در دسترسی شما نیست.</p>}
   </div>
   <p className="warehouse-stock__note">منتظر کنترل در پوشش خرید حساب می‌شود؛ تحویل به تولید فقط از موجودی تأییدشده است. مردودی در سفارش‌دهی حساب نمی‌شود.</p>
  </>}

 <Dialog open={!!selected} onOpenChange={open=>{if(!open)setSelected(null)}}><DialogContent className="modal sm:max-w-3xl" style={{maxHeight:'85vh',overflowY:'auto'}}><DialogTitle>{selected?.passport?.title||'شناسنامه'} · {selected?.name}</DialogTitle><DialogDescription>مشخصات ثبت‌شدهٔ همین کالا یا محصول</DialogDescription>{selected&&<>
  {selected.passport?.historical&&<p className="notice">شناسنامهٔ اصلی در سوابق موجود نیست؛ برای بررسی مشخصات ثبت‌شده، جزئیات بچ یا دستگاه را باز کنید.</p>}
  <dl className="formgrid">{(selected.passport?.details||[{label:'نام',value:selected.name},{label:'کد کالا / محصول',value:selected.itemCode}]).filter((f:any)=>f.value!==undefined&&f.value!==null&&f.value!=='').map((f:any)=><div key={f.label}><dt className="subtle">{f.label}</dt><dd style={{margin:0,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{String(f.value)}</dd></div>)}</dl>
  {!selected.grouped&&<><h3>{selected.kind==='material'?'بچ انتخاب‌شده':'دستگاه انتخاب‌شده'}</h3><dl className="formgrid">{(selected.passport?.lot||[{label:selected.kind==='material'?'کد بچ':'سریال دستگاه',value:selected.row.data.code}]).filter((f:any)=>f.value!==undefined&&f.value!==null&&f.value!=='').map((f:any)=><div key={f.label}><dt className="subtle">{f.label}</dt><dd style={{margin:0,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{String(f.value)}</dd></div>)}</dl></>}
  {selected.passport?.materialId&&<details><summary>عکس و مدارک کالا</summary><MaterialAttachments key={selected.passport.materialId} materialId={selected.passport.materialId} write={false}/></details>}
 </>}</DialogContent></Dialog>
 </div></section>;
}

function stockNumber(value:number,tone=''){
 return <td className={'warehouse-stock__number'+(tone?' warehouse-stock__'+tone:'')+(value===0?' is-zero':'')}><bdi dir="ltr">{(value/1000).toLocaleString('fa-IR',{maximumFractionDigits:3})}</bdi></td>;
}
