'use client';
import {useState} from 'react';
import {Search,Plus,Copy,ChevronDown,ChevronUp} from 'lucide-react';
import {formatDate,latinDigits} from '@/lib/persian-date';
import type {SalesTemplateWorkspace,SalesTemplateSummary,SalesTemplateProductPrice,SalesTemplateCurrentPrice} from '@/lib/sales-template-workspace';

type ProductPrice=SalesTemplateProductPrice;
type CatalogTemplate=SalesTemplateSummary;
type CurrentPrice=SalesTemplateCurrentPrice;
export type SalesTemplateCatalogData=SalesTemplateWorkspace;
export type SalesTemplateCatalogProps={data:SalesTemplateCatalogData;onCreate:()=>void;onCopy:(template:CatalogTemplate)=>void;loading?:boolean};
const statusLabels:Record<CatalogTemplate['status'],string>={active:'فعال',scheduled:'شروع در آینده',expired:'پایان‌یافته',previous:'نسخه قبلی'};
const typeLabels={fixed:'الگوی ثابت',promotion:'پروموشن'};
const sourceLabels={cost_approved:'قیمت مصوب بهای تمام‌شده',sales_template:'قیمت ثبت‌شده در الگوی فروش',sales_price:'قیمت فروش مصوب'};
const text=(v:unknown)=>latinDigits(String(v??'')).replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\s]+/g,' ').trim().toLocaleLowerCase('fa');
const money=(value:string|null)=>value!==null&&/^-?\d+$/.test(value)?BigInt(value).toLocaleString('fa-IR')+' ریال':'—';
const number=(value:number|null)=>value!==null&&Number.isFinite(value)?value.toLocaleString('fa-IR'):'—';
const percent=(value:number|null)=>value!==null&&Number.isFinite(value)?number(value/100)+'٪':'—';
const productText=(p:Pick<ProductPrice,'name'|'model'|'code'>)=>text([p.name,p.model,p.code].join(' '));
const productLabel=(p:Pick<ProductPrice,'name'|'model'>)=>p.name||p.model||'کالای ثبت‌شده';

/** Read-only catalog; edits always begin a new version through the parent form. */
export function SalesTemplateCatalog({data,onCreate,onCopy,loading=false}:SalesTemplateCatalogProps){
 const [tab,setTab]=useState<'templates'|'prices'>('templates'),[search,setSearch]=useState(''),[kind,setKind]=useState(''),[product,setProduct]=useState(''),[type,setType]=useState(''),[status,setStatus]=useState(''),[expanded,setExpanded]=useState<string[]>([]);
 const query=text(search),kinds:Record<string,string>=data.kinds||{},allTemplates:CatalogTemplate[]=data.templates||[],allPrices:CurrentPrice[]=data.prices||[],products=data.products||[];
 const matchTemplate=(t:CatalogTemplate)=>{
  if(kind&&t.kind!==kind||type&&t.templateType!==type||status&&t.status!==status||product&&!t.productPrices.some(p=>p.productId===product))return false;
  return !query||text([t.title,kinds[t.kind],typeLabels[t.templateType],'نسخه '+t.version].join(' ')).includes(query)||t.productPrices.some(p=>productText(p).includes(query));
 };
 const templates=allTemplates.filter(matchTemplate),prices=allPrices.filter(p=>(!kind||p.kind===kind)&&(!product||p.productId===product)&&(!query||text([p.name,p.model,p.code,p.templateTitle,p.termsTemplateTitle,kinds[p.kind]].join(' ')).includes(query)));
 const filtered=!!(search||kind||product||tab==='templates'&&(type||status));
 const clear=()=>{setSearch('');setKind('');setProduct('');setType('');setStatus('');};
 const toggle=(id:string)=>setExpanded(ids=>ids.includes(id)?ids.filter(v=>v!==id):[...ids,id]);
 const tabs=[['templates','فهرست الگوها'],['prices','قیمت‌های معتبر امروز']] as const;
 const tabKey=(e:React.KeyboardEvent<HTMLButtonElement>,index:number)=>{const key=e.key;if(!['ArrowRight','ArrowLeft','Home','End'].includes(key))return;e.preventDefault();const next=key==='Home'?0:key==='End'?1:index===0?1:0;setTab(tabs[next][0]);e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();};
 const badge=(t:CatalogTemplate)=><span className={'badge '+(t.status==='active'?'good':'')}>{statusLabels[t.status]||'وضعیت نامشخص'}</span>;
 const priceTable=(t:CatalogTemplate)=>{const selected=t.productPrices.filter(p=>!product||p.productId===product);return selected.length?<div className="sales-table" style={{maxWidth:'100%',overflowX:'auto'}}><table><caption>قیمت کالاهای {t.title||'الگوی فروش'} · نسخه {number(t.version)}</caption><thead><tr><th scope="col">کالا / کد</th><th scope="col">قیمت پایه هر واحد</th><th scope="col">تخفیف الگو</th><th scope="col">قیمت پس از تخفیف الگو</th></tr></thead><tbody>{selected.map((p,i)=><tr key={p.productId+':'+i}><th scope="row" style={{fontWeight:500}}>{productLabel(p)}{p.model&&p.model!==p.name&&<small style={{display:'block'}}>{p.model}</small>}{p.code&&<small className="code" dir="ltr" style={{display:'block'}}>{p.code}</small>}</th><td style={{whiteSpace:'nowrap'}}>{money(p.unitPrice)}</td><td>{percent(t.discountBps)}</td><td style={{whiteSpace:'nowrap'}}>{money(p.unitNet)}</td></tr>)}</tbody></table></div>:<p className="subtle">این نسخه فهرست قیمت کالا ندارد؛ برای قیمت قابل سفارش، «قیمت‌های معتبر امروز» را ببینید.</p>;};
 return <section className="sales-template-catalog" dir="rtl" aria-label="فهرست الگوها و قیمت‌های فروش" aria-busy={loading} style={{minWidth:0}}>
  <div className="tools" style={{justifyContent:'space-between',alignItems:'center'}}><div><h3 style={{marginBlock:'0 .25rem'}}>الگوها و قیمت‌های فروش</h3><p className="subtle" style={{margin:0}}>نسخه‌های قبلی برای بررسی سوابق باقی می‌مانند. تغییر شرایط با تعریف نسخه جدید انجام می‌شود.</p></div><button type="button" className="btn primary" disabled={loading} onClick={onCreate}><Plus size={18} aria-hidden="true"/>تعریف نسخه جدید الگوی فروش</button></div>
  <div role="tablist" aria-label="گزارش الگوهای فروش" className="tools" style={{marginBlock:'1rem'}}>{tabs.map(([key,label],index)=><button key={key} id={'sales-template-tab-'+key} type="button" role="tab" aria-controls={'sales-template-panel-'+key} aria-selected={tab===key} tabIndex={tab===key?0:-1} className={'btn '+(tab===key?'primary':'')} onKeyDown={e=>tabKey(e,index)} onClick={()=>setTab(key)}>{label}</button>)}</div>
  <div className="formgrid" style={{marginBottom:'1rem'}}>
   <label className="field wide"><span><Search size={16} aria-hidden="true" style={{display:'inline',verticalAlign:'middle',marginInlineEnd:6}}/>جست‌وجوی الگو یا کالا</span><input type="search" aria-label="جست‌وجوی الگو یا کالا" value={search} placeholder="نام الگو، نام کالا، مدل یا کد کالا" onChange={e=>setSearch(e.target.value)}/></label>
   <label className="field"><span>نوع خریدار</span><select aria-label="نوع خریدار" value={kind} onChange={e=>setKind(e.target.value)}><option value="">همه خریداران</option>{Object.entries(kinds).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   <label className="field"><span>کالا</span><select aria-label="کالا" value={product} onChange={e=>setProduct(e.target.value)}><option value="">همه کالاها</option>{products.map(p=><option key={p.id} value={p.id}>{productLabel(p)}{p.code?' · '+p.code:''}</option>)}</select></label>
   {tab==='templates'&&<><label className="field"><span>نوع الگو</span><select aria-label="نوع الگو" value={type} onChange={e=>setType(e.target.value)}><option value="">همه انواع الگو</option>{Object.entries(typeLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label className="field"><span>وضعیت الگو</span><select aria-label="وضعیت الگو" value={status} onChange={e=>setStatus(e.target.value)}><option value="">همه وضعیت‌ها</option>{Object.entries(statusLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></>}
  </div>
  {filtered&&<button type="button" className="link" onClick={clear}>پاک کردن فیلترها</button>}
  {loading&&<p role="status">در حال دریافت الگوها و قیمت‌ها…</p>}
  <div id={'sales-template-panel-'+tab} role="tabpanel" aria-labelledby={'sales-template-tab-'+tab} tabIndex={0}>
   <p className="subtle" role="status">{tab==='templates'?number(templates.length)+' الگو':number(prices.length)+' ردیف قیمت'}{filtered?' در این فیلتر':''}{tab==='prices'?' · مبنای بررسی: '+formatDate(data.today):''}</p>
   {tab==='templates'?<>
    {!templates.length&&!loading&&<p className="notice">{allTemplates.length?'هیچ الگویی با این فیلتر پیدا نشد.':'هنوز الگوی فروشی تعریف نشده است؛ نسخه اول را از دکمه بالا تعریف کنید.'}</p>}
    <div style={{display:'grid',gap:12}}>{templates.map(t=>{const open=expanded.includes(t.id),title=t.title||'الگوی بدون عنوان';return <article className="flow-card" data-template-id={t.id} key={t.id} style={{margin:0,minWidth:0}}>
     <div className="tools" style={{justifyContent:'space-between',alignItems:'center'}}><h4 style={{margin:0}}>{title} <small>· نسخه {number(t.version)}</small></h4>{badge(t)}</div>
     <p>{kinds[t.kind]||'نوع خریدار ثبت‌شده'} · {typeLabels[t.templateType]}{t.isFixedBaseline&&!t.isSelected?' · الگوی ثابت مبنا':''}</p>
     <p className="subtle">شروع: {t.effectiveFrom?formatDate(t.effectiveFrom):'تاریخ شروع در سابقه ثبت نشده'} · پایان: {t.effectiveTo?formatDate(t.effectiveTo):'بدون تاریخ پایان'}{t.durationDays!==null?' · مدت '+number(t.durationDays)+' روز':''}</p>
     <p>تخفیف {percent(t.discountBps)} · سهم نقد پیش‌فرض {percent(t.cashBps)} · مهلت پرداخت {number(t.days)} روز · حداقل سهم نقد {percent(t.minCashBps)} · حداکثر مهلت {number(t.maxDays)} روز · {number(t.productPrices.length)} کالا</p>
     <div className="tools"><button type="button" className="btn" aria-expanded={open} aria-controls={'sales-template-products-'+t.id} aria-label={'نمایش قیمت کالاهای '+title} onClick={()=>toggle(t.id)}>{open?<ChevronUp size={16} aria-hidden="true"/>:<ChevronDown size={16} aria-hidden="true"/>}{open?'بستن قیمت کالاها':'قیمت کالاها'}</button><button type="button" className="btn" disabled={loading} aria-label={'نسخه جدید از '+title} onClick={()=>onCopy(t)}><Copy size={16} aria-hidden="true"/>نسخه جدید از این الگو</button></div>
     {open&&<div id={'sales-template-products-'+t.id} style={{marginTop:12}}>{priceTable(t)}<p className="subtle">این جدول فقط قیمت‌های ثبت‌شده و تخفیف همین نسخه را نشان می‌دهد؛ تخفیف کسب‌شده از تارگت یا شرایط اختصاصی خریدار در آن محاسبه نشده است.</p></div>}
    </article>;})}</div>
   </>:<>
    <p className="notice">قیمت پایه و تخفیف عمومی معتبر امروز برای هر نوع خریدار نمایش داده می‌شود. تخفیف تارگت کسب‌شده، بدهی معوق و شرایط اختصاصی خریدار در بررسی سفارش محاسبه می‌شوند. بررسی حساب خریدار و تأیید سفارش مراحل جداگانه دارند.</p>
    {!prices.length&&!loading&&<p className="notice">{allPrices.length?'هیچ کالایی با این فیلتر پیدا نشد.':'کالایی برای بررسی قیمت موجود نیست.'}</p>}
    {!!prices.length&&<div className="sales-table" style={{maxWidth:'100%',overflowX:'auto'}}><table><caption>قیمت‌های فروش معتبر در {formatDate(data.today)} · مبلغ‌ها به ریال</caption><thead><tr><th scope="col">کالا / کد</th><th scope="col">نوع خریدار</th><th scope="col">قیمت پایه هر واحد</th><th scope="col">تخفیف عمومی</th><th scope="col">قیمت پس از تخفیف</th><th scope="col">منبع قیمت و شرایط</th><th scope="col">اعتبار قیمت</th></tr></thead><tbody>{prices.map((p,i)=><tr data-price-product={p.productId} key={p.kind+':'+p.productId+':'+i}><th scope="row" style={{fontWeight:500}}>{productLabel(p)}{p.model&&p.model!==p.name&&<small style={{display:'block'}}>{p.model}</small>}{p.code&&<small className="code" dir="ltr" style={{display:'block'}}>{p.code}</small>}</th><td>{kinds[p.kind]||'نوع خریدار ثبت‌شده'}</td><td style={{whiteSpace:'nowrap'}}>{money(p.unitPrice)}</td><td>{percent(p.discountBps)}</td><td style={{whiteSpace:'nowrap'}}>{money(p.unitNet)}</td><td>{p.source?sourceLabels[p.source]:'قیمت معتبر ندارد'}{p.templateTitle&&<small style={{display:'block'}}>{p.templateTitle}</small>}{p.termsTemplateTitle&&<small style={{display:'block'}}>شرایط فروش: {p.termsTemplateTitle}</small>}</td><td><span className={'badge '+(p.canQuote?'good':'bad')}>{p.canQuote?'قیمت معتبر':'نیازمند تکمیل'}</span>{(p.diagnostics||[]).map((d,index)=><small key={d.code+':'+index} style={{display:'block',maxWidth:280}}>{d.message}</small>)}</td></tr>)}</tbody></table></div>}
   </>}
  </div>
  <div id={'sales-template-panel-'+(tab==='templates'?'prices':'templates')} role="tabpanel" aria-labelledby={'sales-template-tab-'+(tab==='templates'?'prices':'templates')} hidden/>
 </section>;
}
