'use client';
import {NumberInput} from '@/components/trace/number-input';
import {MaterialSelect} from './material-select';
import {PurchaseShipmentsPanel} from './purchase-shipments-panel';
import {IconDisclosure,useWorkspaceBack} from "./program-workspace";
import {SupplierQualityPanel} from './supplier-quality-panel';
import {SupplierImportPanel} from './supplier-import-panel';
import {SupplierPurchaseHistory} from './supplier-purchase-history';
import {useEffect,useRef,useState} from 'react';
import {supplierFields,supplierRegistrationFields,supplierRisks,supplierSearchPhone,supplierSearchText,supplierStates} from '@/lib/supplier-contract';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Checkbox} from '@/components/ui/checkbox';
import {SolarDate} from './solar-date';
import {formatDate} from '@/lib/persian-date';
function SupplierMaterialLink({supplierId,materials,links,onLinked}:{supplierId:string;materials:any[];links:any[];onLinked:()=>Promise<void>}){
 const [materialId,setMaterialId]=useState(''),[supplierCode,setSupplierCode]=useState(''),[notes,setNotes]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[operationId,setOperationId]=useState(()=>crypto.randomUUID());
 const choices=materials.filter(m=>!links.some(l=>l.data.supplierId===supplierId&&l.data.materialId===m.id));
 async function add(){if(busy||!materialId)return;setBusy(true);setMessage('');try{const r=await fetch('/api/suppliers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:operationId,confirmed:true,mode:'link',supplierId,materialId,supplierCode,notes})}),d=await r.json() as any;if(!r.ok)throw Error(d.error);await onLinked();setMaterialId('');setSupplierCode('');setNotes('');setOperationId(crypto.randomUUID());setMessage('کالا با وضعیت در انتظار ارزیابی به تأمین‌کننده اضافه شد.');}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}
 return <fieldset className="wide" disabled={busy} style={{minWidth:0,border:'1px solid #d8e0f5',borderRadius:12,padding:16}}><legend>افزودن کالا به تأمین‌کننده</legend><p>کالاهای متصل‌شده دوباره در فهرست انتخاب نمایش داده نمی‌شوند. افزودن کالا به معنای تأیید صلاحیت خرید نیست.</p><div className="formgrid"><MaterialSelect title="جست‌وجو و انتخاب کالا" value={materialId} choices={choices.map(m=>({id:m.id,code:m.code,name:m.name,accountingCode:m.accountingCode}))} onChange={v=>{setMaterialId(v);setOperationId(crypto.randomUUID());setMessage('')}} required={false} disabled={busy} emptyMessage="کالای جدیدی با این نام یا کد برای اتصال پیدا نشد."/><label className="field">کد کالا نزد تأمین‌کننده<input value={supplierCode} maxLength={100} onChange={e=>{setSupplierCode(e.target.value);setOperationId(crypto.randomUUID())}}/></label><label className="field wide">یادداشت ارتباط<textarea value={notes} maxLength={3000} onChange={e=>{setNotes(e.target.value);setOperationId(crypto.randomUUID())}}/></label></div><button type="button" className="btn primary" disabled={busy||!materialId} onClick={()=>void add()}>{busy?'در حال افزودن…':'تأیید و افزودن کالا'}</button>{message&&<p role="status">{message}</p>}</fieldset>;
}
export function SupplierPanel({materialId='',routeScope,createFor,onCreated,onCancel}:{materialId?:string;routeScope?:'domestic'|'foreign';createFor?:{materialId:string;route:string;name?:string;code?:string};onCreated?:(supplier:{supplierId:string})=>void;onCancel?:()=>void}){
 const [showDeleted,setShowDeleted]=useState(false);
 const [linkedSupplier,setLinkedSupplier]=useState(''),[selectedSupplier,setSelectedSupplier]=useState(''),[savedMessage,setSavedMessage]=useState('');
 const domestic=routeScope==='domestic',foreignOnly=routeScope==='foreign';
 const separateRecord=domestic||foreignOnly;
 const paged=separateRecord&&!createFor;
 const [openHistory,setOpenHistory]=useState('');
 const [shipmentScope,setShipmentScope]=useState<any>(null);
 const [qualityScope,setQualityScope]=useState<any>(null);
 const [loaded,setData]=useState<any>(null),[material,setMaterial]=useState(materialId),[draft,setDraft]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[search,setSearch]=useState('');
 const [page,setPage]=useState(1),[appliedSearch,setAppliedSearch]=useState('');
 const [materialCatalog,setMaterialCatalog]=useState<any[]|null>(null),[loadingMaterials,setLoadingMaterials]=useState(false);
 const requestSequence=useRef(0);
 const listKey=JSON.stringify([routeScope,paged?(selectedSupplier||[page,appliedSearch,material,showDeleted]):'']);
 const data=loaded?.listKey===listKey?loaded:null;
 const showSupplier=(id:string)=>{
  setSelectedSupplier(id);setLinkedSupplier('');setSavedMessage('');setShipmentScope(null);setQualityScope(null);setOpenHistory('');
 };
 const backRef=useWorkspaceBack(()=>showSupplier(''),domestic&&!!selectedSupplier&&!draft);
 const foreignBackRef=useWorkspaceBack(()=>{
  if(shipmentScope)setShipmentScope(null);
  else if(qualityScope)setQualityScope(null);
  else if(openHistory)setOpenHistory('');
  else if(linkedSupplier)setLinkedSupplier('');
  else showSupplier('');
 },foreignOnly&&!!selectedSupplier&&!draft,110);
 async function load(){
  const sequence=++requestSequence.current,params=new URLSearchParams();
  if(routeScope)params.set('route',routeScope);
  if(paged&&selectedSupplier){params.set('view','detail');params.set('supplier',selectedSupplier);}
  else if(paged){params.set('view','list');params.set('page',String(page));params.set('search',appliedSearch);params.set('material',material);params.set('deleted',showDeleted?'1':'0');}
  try{
   const r=await fetch('/api/suppliers?'+params,{cache:'no-store'}),d=await r.json() as any;
   if(!r.ok)throw Error(d.error);
   if(sequence===requestSequence.current)setData({...d,listKey});
  }catch(e){if(sequence===requestSequence.current)throw e;}
 }
 useEffect(()=>{
  setData(null);setError('');
  void load().catch(e=>setError(e.message));
  return()=>{++requestSequence.current;};
 },[listKey]);
 async function loadMaterialCatalog(){
  if(!paged||materialCatalog||loadingMaterials)return;
  setLoadingMaterials(true);
  try{
   const response=await fetch('/api/suppliers?'+new URLSearchParams({route:routeScope!,view:'materials'}),{cache:'no-store'});
   const result=await response.json() as {materials:any[];error?:string};
   if(!response.ok)throw Error(result.error);
   setMaterialCatalog(result.materials);
  }catch(e){setError((e as Error).message)}finally{setLoadingMaterials(false);}
 }
 useEffect(()=>{setMaterialCatalog(null);},[routeScope]);
 useEffect(()=>{
  if(linkedSupplier||draft?.mode==='supplier'&&draft.supplierId&&domestic||data?.technicalAuthorities?.length)void loadMaterialCatalog();
 },[linkedSupplier,draft?.mode,draft?.supplierId,data?.technicalAuthorities?.length]);
 useEffect(()=>{if(createFor)begin('supplier',{route:createFor.route,linkMaterialId:createFor.materialId})},[]);
 const begin=(mode:string,extra:any={})=>{setError('');setSavedMessage('');setDraft({id:crypto.randomUUID(),confirmed:true,mode,route:'domestic',kind:'manufacturer',active:true,country:'ایران',materialId:material,status:'pending',qualityRisk:'high',supplyRisk:'high',reviewDue:'',scores:{},documentIds:[],...extra,phones:extra.phones?.length?extra.phones:[extra.phone||'']});};
 const change=(k:string,v:any)=>setDraft((d:any)=>({...d,[k]:v}));
 async function save(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{const payload=draft.mode==='supplier'?{...draft,phone:draft.phones?.[0]||'',phones:draft.phones||[]}:draft;const r=await fetch('/api/suppliers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),d=await r.json() as any;if(!r.ok)throw Error(d.error);setDraft(null);if(createFor){onCreated?.({supplierId:d.id||payload.id});return;}
 if(separateRecord&&payload.mode==='supplier'&&!payload.supplierId){
  showSupplier(d.id||payload.id);
  if(domestic)setLinkedSupplier(d.id||payload.id);
  setSavedMessage('تأمین‌کننده ثبت شد. می‌توانید اکنون یا بعداً کالا اضافه کنید.');
  return;
 }
 await load();}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const field=(k:string,label:string,required=false)=><label className="field" key={k}>{label}<NumberInput fieldKey={k} required={required} value={draft?.[k]??''} onChange={e=>change(k,e.target.value)}/></label>;
 const pick=(k:string,label:string,items:Record<string,string>)=><label className="field">{label}<select required value={draft?.[k]||''} onChange={e=>change(k,e.target.value)}><option value="">انتخاب کنید</option>{Object.entries(items).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>;
 const technicalButtons=(e:any,scope:string)=>data?.technicalAuthorities?.map((authority:string)=><span key={authority}><button data-pair-open="supplier-panel:7db4ee3fcf3c" data-pair-item={JSON.stringify([e.id])} type="button" className="btn" onClick={()=>begin('technical',{scope,targetId:e.id,revision:e.revision,authority,decision:'hold',specs:e.specs||e.data?.specs||''})}>{authority==='engineering'?'تحقیق‌وتوسعه':'تضمین / کنترل کیفیت'}: کنترل توقف خرید</button></span>);
 const supplierPhones=(supplier:any)=>(supplier.phones||[supplier.phone]).filter(Boolean) as string[];
 const q=supplierSearchText(search),phoneQuery=/^[+\d\s()-]+$/.test(q)?supplierSearchPhone(q):'';
 const draftName=supplierSearchText(draft?.name),draftPhones=(draft?.phones||[]).map(supplierSearchPhone).filter((value:string)=>value.length>6).join(',');
 const [matchesSimilar,setMatchesSimilar]=useState<any[]>([]);
 useEffect(()=>{
  setMatchesSimilar([]);
  if(!domestic||draft?.mode!=='supplier'||draftName.length<4&&!draftPhones)return;
  const controller=new AbortController();
  const timer=setTimeout(async()=>{
   try{
    const params=new URLSearchParams({route:'domestic',view:'similar',search:draftName,supplier:draft.supplierId||''});
    if(draftPhones)for(const phone of draftPhones.split(','))params.append('phone',phone);
    const response=await fetch('/api/suppliers?'+params,{cache:'no-store',signal:controller.signal});
    if(!response.ok)return;
    const result=await response.json() as {suppliers:any[]};
    if(!controller.signal.aborted)setMatchesSimilar(result.suppliers);
   }catch{/* Similar records are a hint. The registration form remains usable. */}
  },250);
  return()=>{clearTimeout(timer);controller.abort();};
 },[domestic,draft?.mode,draft?.supplierId,draftName,draftPhones]);
 const visibleSuppliers=(data?.suppliers||[]).filter((s:any)=>{
  if(paged)return true;
  if(separateRecord&&selectedSupplier)return s.id===selectedSupplier;
  return (showDeleted||!s.data.deletedAt)&&(!material||data.links.some((l:any)=>l.data.materialId===material&&l.data.supplierId===s.id))&&
   (supplierSearchText(s.data.name+' '+(s.data.accountingVendorCode||'')+' '+supplierPhones(s.data).join(' ')).includes(q)||!!phoneQuery&&supplierPhones(s.data).some(value=>supplierSearchPhone(value).includes(phoneQuery)));
 });
 const pct=(n:number|null)=>n===null?'سابقه کافی ثبت نشده':n.toLocaleString('fa-IR')+'٪';
 return <section className="panel" dir="rtl" ref={foreignOnly?foreignBackRef:backRef}>{!createFor&&<><div className="panelhead"><h2>{domestic?'تأمین‌کنندگان':'تأمین‌کنندگان و ارزیابی'}</h2>{domestic&&selectedSupplier?<button type="button" className="btn" onClick={()=>showSupplier('')}>بازگشت به فهرست</button>:data?.canManage&&!selectedSupplier&&<button data-pair-open="supplier-panel:a965ed50ceea" className="btn primary" onClick={()=>begin('supplier',foreignOnly?{route:'foreign',country:''}:{})}>{separateRecord?'ثبت تأمین‌کننده':'تأمین‌کننده جدید'}</button>}</div><div className="inside">
 {data?.canImportVendors&&!selectedSupplier&&<div className="tools"><SupplierImportPanel onSaved={load}/></div>}
 {savedMessage&&<p role="status" className="notice">{savedMessage}</p>}
 {!separateRecord&&<p className="notice">صلاحیت خرید برای هر کالا جداست. امتیاز ارزیابی کارشناسی با سابقه واقعی پذیرش و تحویل نمایش داده می‌شود؛ امتیاز بالا جای تأیید صلاحیت را نمی‌گیرد.</p>}
 {error&&!draft&&<p role="alert" className="notice error">{error}</p>}{!data&&<p>در حال دریافت…</p>}
 {shipmentScope&&<><button data-pair-open="supplier-panel:21dec5df0a1e" className="btn" onClick={()=>setShipmentScope(null)}>بستن سوابق محموله</button><PurchaseShipmentsPanel {...shipmentScope}/></>}{qualityScope&&<><button data-pair-open="supplier-panel:91e312bf052f" className="btn" onClick={()=>setQualityScope(null)}>بستن مدارک و اقدامات</button><SupplierQualityPanel key={qualityScope.supplierId+qualityScope.linkId} {...qualityScope} onChanged={()=>void load().catch(e=>setError(e.message))}/></>}{data&&<>{!selectedSupplier&&<form className="formgrid" onSubmit={e=>{e.preventDefault();setPage(1);setAppliedSearch(search);}}><label className="field">کالا<select value={material} onFocus={()=>void loadMaterialCatalog()} onChange={e=>{setPage(1);setMaterial(e.target.value);}}><option value="">همه کالاها</option>{(materialCatalog||data.materials).map((m:any)=><option key={m.id} value={m.id}>{m.code} · {m.name}</option>)}</select></label><label className="field">جست‌وجوی تأمین‌کننده<NumberInput fieldKey={"search"} value={search} onChange={e=>setSearch(e.target.value)}/></label>{paged&&<button type="submit" className="btn primary">جست‌وجو</button>}</form>}
 {!domestic&&(!foreignOnly||data.technicalAuthorities.length>0)&&<IconDisclosure inline scope="material-technical-controls" title="بررسی وضعیت فنی کالاها">{(materialCatalog||data.materials).filter((m:any)=>!material||m.id===material).map((m:any)=><article data-pair-row={JSON.stringify(m.id)} className="flow-card" key={m.id}><h4>{m.code} · {m.name}</h4><p>{m.specs}</p>{Object.entries(m.technicalControls||{}).map(([k,v]:any)=><p key={k}>{k==='engineering'?'تحقیق‌وتوسعه':'کیفیت'}: {v.held?'خرید متوقف':'توقف برداشته شده'} · {v.reason} · {v.evidence}</p>)}{technicalButtons(m,'material')}<IconDisclosure inline scope={'technical-history:'+m.id} title="سوابق تصمیم فنی">{m.technicalHistory?.map((h:any,i:number)=><p key={i}>{formatDate(h.at)} · {h.reason} · {h.evidence}</p>)}</IconDisclosure></article>)}</IconDisclosure>}
 {!separateRecord&&data.suppliers.some((s:any)=>s.canLink&&!s.data.deletedAt)&&<button data-pair-open="supplier-panel:865ef80fa6f5" className="btn" onClick={()=>begin('link')}>اتصال تأمین‌کننده به کالا</button>}
 {!selectedSupplier&&<label className="flow-check"><Checkbox checked={showDeleted} onCheckedChange={v=>{setPage(1);setShowDeleted(v===true);}}/><span>نمایش حذف‌شده‌ها</span></label>}
 {separateRecord&&!selectedSupplier?visibleSuppliers.map((s:any)=><article key={s.id} className="flow-card">
  <h3>{s.data.name}</h3>
  <p>{[foreignOnly?s.data.country:s.data.city,s.data.kind==='manufacturer'?'سازنده':'واسطه / بازرگان',s.data.deletedAt?'حذف‌شده':s.data.importedForSetup?'نیازمند تکمیل':s.data.active?'فعال':'غیرفعال'].filter(Boolean).join(' · ')}</p>
  <button type="button" className="btn" onClick={()=>showSupplier(s.id)}>مشاهدهٔ پرونده</button>
 </article>):visibleSuppliers.map((s:any)=><article data-pair-row={JSON.stringify(s.id)} key={s.id} className="flow-card"><h3>{s.data.name}{!domestic&&(s.data.route==='domestic'?' · داخلی':' · خارجی')}{s.data.deletedAt?' · حذف‌شده':s.data.importedForSetup?' · نیازمند تکمیل':!s.data.active?' · غیرفعال':''}</h3><p>{s.data.country} · {s.data.contact} · <bdi>{(s.data.phones||[s.data.phone]).filter(Boolean).join('، ')}</bdi> · <bdi>{s.data.email}</bdi></p><p>{s.data.kind==='manufacturer'?'سازنده':s.data.kind==='trader'?'واسطه / بازرگان':s.data.legalType||'نوع تأمین تعیین نشده'} · {s.data.manufacturer} · {s.data.factory}</p><p>{s.data.address} · {s.data.messenger}</p>{s.data.accountingVendorCode&&<p>کد تفصیلی حسابداری <bdi>{s.data.accountingVendorCode}</bdi></p>}{Object.entries(supplierRegistrationFields).map(([key,label])=>s.data[key]&&<p key={key}>{label} <bdi>{s.data[key]}</bdi></p>)}<button data-pair-open="supplier-panel:ccfd1223bae6" data-pair-item={JSON.stringify([s.id])} className="btn" onClick={()=>setQualityScope({supplierId:s.id,linkId:''})}>مدارک عمومی و همه اقدامات</button>{s.canEditIdentity&&!s.data.deletedAt&&<button data-pair-open="supplier-panel:d60001de63cf" data-pair-item={JSON.stringify([s.id])} className="btn" onClick={()=>begin('supplier',{...s.data,supplierId:s.id,revision:s.revision})}>ویرایش پرونده</button>}
 {s.canLink&&!s.data.deletedAt&&(separateRecord?<div className="supplier-link-actions">
  {linkedSupplier===s.id?<><SupplierMaterialLink supplierId={s.id} materials={materialCatalog||data.materials} links={data.links} onLinked={load}/><button type="button" className="btn" onClick={()=>setLinkedSupplier('')}>بستن فرم اتصال کالا</button></>:<button type="button" className="btn" onClick={()=>setLinkedSupplier(s.id)}>اتصال کالا</button>}
 </div>:<details><summary>افزودن کالا به این تأمین‌کننده</summary><SupplierMaterialLink supplierId={s.id} materials={materialCatalog||data.materials} links={data.links} onLinked={load}/></details>)}
 {s.canEditIdentity&&<button data-pair-open="supplier-panel:6b7aacbb3a34" data-pair-item={JSON.stringify([s.id])} className="btn" onClick={()=>begin(s.data.deletedAt?'restore':'archive',{supplierId:s.id,revision:s.revision,name:s.data.name})}>{s.data.deletedAt?'بازیابی تأمین‌کننده':'حذف تأمین‌کننده'}</button>}{s.data.deletedAt&&<p>حذف در {formatDate(s.data.deletedAt)} · ثبت‌کننده: {s.data.deletedBy} · دلیل: {s.data.deletionReason}</p>}
 {s.data.lifecycleHistory?.length>0&&<details><summary>سوابق حذف و بازیابی</summary>{s.data.lifecycleHistory.map((h:any,i:number)=><p key={i}>{formatDate(h.at)} · {h.action==='archive'?'حذف':'بازیابی'} · {h.actor} · {h.reason}</p>)}</details>}
 {data.links.filter((l:any)=>l.data.supplierId===s.id&&(!!selectedSupplier||!material||l.data.materialId===material)).map((l:any)=>{const m=data.materials.find((m:any)=>m.id===l.data.materialId),last=l.reviews.at(-1);return <div data-pair-row={JSON.stringify(l.id)} className="supplier-material-card" key={l.id}><p>مشخصات عمومی: {m?.specs||"ثبت نشده"}</p><p>مشخصات محصول تأمین‌کننده: {l.data.supplierSpecs||"ثبت نشده"}</p>{l.commercial&&<button data-pair-open="supplier-panel:744c5645a7ac" data-pair-item={JSON.stringify([s.id])} className="btn" onClick={()=>setShipmentScope({supplierId:s.id,materialId:l.data.materialId})}>مشخصات، خریدهای قبلی و پکینگ</button>}<h4>{m?.name} · {l.data.partCode} · {supplierStates[l.data.status]}</h4><button data-pair-open="supplier-panel:032786ae6423" data-pair-item={JSON.stringify([s.id,l.id])} className="btn" onClick={()=>setQualityScope({supplierId:s.id,linkId:l.id})}>مدارک و اقدامات اصلاحی این کالا</button><p>کد نزد تأمین‌کننده: {l.data.supplierCode||'—'} · بازبینی: {l.data.reviewDue?formatDate(l.data.reviewDue):'تعیین نشده'}</p><p>ریسک کیفیت: {supplierRisks[l.data.qualityRisk]} · ریسک تأمین: {supplierRisks[l.data.supplyRisk]}</p>{technicalButtons(l,'supplier_material')}{Object.entries(l.data.technicalControls||{}).map(([k,v]:any)=><p key={k}>{k==='engineering'?'تحقیق‌وتوسعه':'کیفیت'}: {v.held?'خرید متوقف':'توقف برداشته شده'} · {v.reason}</p>)}{l.block&&<p role="status">مانع خرید: {l.block}</p>}{l.data.status==='conditional'&&<p>سقف هر سفارش: {l.data.maxQuantity/1000} {l.data.unit} · {l.data.restrictions}</p>}<p>پذیرش کیفی: {pct(l.metrics.quality)} · تحویل به‌موقع: {pct(l.metrics.delivery)} · سفارش‌ها: {l.metrics.orders}</p>{l.commercial&&<p>امتیاز کارشناسی آخرین ارزیابی: {last?.data.score??'تکمیل نشده'} از ۱۰۰</p>}{data.canQuality&&<button data-pair-open="supplier-panel:177bc24eff63" data-pair-item={JSON.stringify([l.id])} className="btn" onClick={()=>begin('review',{linkId:l.id,revision:l.revision,status:l.data.status,qualityRisk:l.data.qualityRisk,supplyRisk:l.data.supplyRisk,reviewDue:l.data.reviewDue,restrictions:l.data.restrictions,maxQuantity:l.data.maxQuantity?String(l.data.maxQuantity/1000):''})}>ثبت ارزیابی و صلاحیت</button>}
 {s.data.route==='foreign'&&l.commercial&&<>
 {l.data.commercialDetails&&<dl>{Object.entries({brand:'برند یا سازنده',packaging:'بسته‌بندی',minimumOrder:'حداقل سفارش',leadTime:'زمان معمول تحویل'}).map(([key,label])=>l.data.commercialDetails[key]&&<div key={key}><dt>{label}</dt><dd>{l.data.commercialDetails[key]}</dd></div>)}</dl>}
 {data.canWriteHistory&&!s.data.deletedAt&&<button type="button" className="btn" onClick={()=>begin('commercial_details',{linkId:l.id,revision:l.revision,supplierCode:l.data.supplierCode,...l.data.commercialDetails})}>ویرایش مشخصات خرید این کالا</button>}
 <button type="button" className="btn" aria-expanded={openHistory===l.id} onClick={()=>setOpenHistory(openHistory===l.id?'':l.id)}>سوابق خرید قدیمی</button>
 {openHistory===l.id&&<SupplierPurchaseHistory key={l.id} linkId={l.id} unit={m?.unit||''} canWrite={data.canWriteHistory&&!s.data.deletedAt}/>}
 </>}
 <IconDisclosure inline scope="supplier-panel-details-e8032a57f1" title={<> سوابق ارزیابی و خرید </>}>{l.reviews.map((r:any)=><div data-pair-row={JSON.stringify(r.id)} key={r.id}><p>{formatDate(r.data.at)} · {supplierStates[r.data.status]} · {r.data.rationale}</p><p>مرجع شواهد: {r.data.evidence} · بازبینی: {formatDate(r.data.reviewDue)}</p>{r.data.documents?.map((f:any)=><p key={f.id}><a href={'/api/suppliers/files?id='+encodeURIComponent(f.id)}>{f.filename}</a></p>)}{r.data.score!=null&&<p>امتیاز کارشناسی: {r.data.score}</p>}</div>)}{data.orders.filter((o:any)=>o.data.supplierLinkId===l.id).map((o:any)=><p key={o.id}>{formatDate(o.created)} · {o.data.quantity/1000} {o.data.unit} · {o.data.state}{o.data.totalRial!==undefined?' · '+BigInt(o.data.totalRial).toLocaleString('fa-IR')+' ریال':''}</p>)}</IconDisclosure></div>})}</article>)}
 {paged&&!selectedSupplier&&(page>1||data.hasMore)&&<div className="tools" aria-label="صفحه‌های تأمین‌کنندگان"><button type="button" className="btn" disabled={page===1} onClick={()=>setPage(page-1)}>صفحهٔ قبل</button><span>{page.toLocaleString('fa-IR')}</span><button type="button" className="btn" disabled={!data.hasMore} onClick={()=>setPage(page+1)}>صفحهٔ بعد</button></div>}
 {!visibleSuppliers.length&&<p className="empty">{data.suppliers.length?'تأمین‌کننده‌ای پیدا نشد.':'هنوز تأمین‌کننده‌ای ثبت نشده است.'}</p>}
 <IconDisclosure scope="supplier-panel-details-00e6a5a6b7" title={<> روش کار و امتیازدهی </>}>{Object.values(data.help).map((t:any,i)=><p key={i}>{t}</p>)}</IconDisclosure></>}
 </div></>}{createFor&&!draft&&error&&<p role="alert">{error}</p>}<Dialog open={!!draft} onOpenChange={v=>{if(!busy&&!v){setDraft(null);if(createFor)onCancel?.()}}}><DialogContent className="modal sm:max-w-3xl"><DialogTitle>{createFor?'تأمین‌کننده جدید برای این کالا':draft?.mode==='technical'?'کنترل فنی خرید':draft?.mode==='review'?'ارزیابی و صلاحیت کالا':draft?.mode==='link'?'اتصال به کالا':draft?.mode==='commercial_details'?'مشخصات خرید این کالا':'پرونده تأمین‌کننده'}</DialogTitle><DialogDescription>ثبت با نام شما و همراه سابقه انجام می‌شود. تغییر پرونده، ارزیابی مجدد کالاهای مرتبط را لازم می‌کند.</DialogDescription>{draft&&<form onSubmit={save}><fieldset disabled={busy} style={{border:0,padding:0}}><div className="formgrid">
 {['archive','restore'].includes(draft.mode)&&<><p className="notice wide">{draft.name}؛ {draft.mode==='archive'?'از انتخاب برای خرید و استعلام جدید خارج می‌شود. سوابق و پرونده‌های باز باقی می‌مانند و باید جداگانه تعیین تکلیف شوند.':'پرونده بازیابی می‌شود ولی غیرفعال می‌ماند؛ فعال‌سازی و ارزیابی مجدد جداگانه لازم است.'}</p>{field('reason','دلیل '+(draft.mode==='archive'?'حذف':'بازیابی'),true)}</>}
 {draft.mode==='supplier'&&<>{createFor?<p className="notice wide">کالا: {createFor.name||data?.materials.find((m:any)=>m.id===createFor.materialId)?.name} · کد {createFor.code||data?.materials.find((m:any)=>m.id===createFor.materialId)?.code} · مسیر {createFor.route==='domestic'?'داخلی':'خارجی'}؛ ارتباط با این کالا با وضعیت «در انتظار ارزیابی» ثبت می‌شود.</p>:domestic?null:foreignOnly?<p className="wide">مسیر تأمین خارجی</p>:pick('route','مسیر',{domestic:'داخلی',foreign:'خارجی'})}{pick('kind','نوع تأمین',{manufacturer:'سازنده',trader:'واسطه / بازرگان'})}
 {draft.importedForSetup&&<p className="notice wide">برای فعال‌کردن این پرونده، مسئول تماس و تلفن اصلی را تکمیل کنید.</p>}
 {data?.canImportVendors&&draft.route==='domestic'&&<label className="field">کد تفصیلی حسابداری<input dir="ltr" maxLength={80} value={draft.accountingVendorCode||''} readOnly={!!data.suppliers.find((s:any)=>s.id===draft.supplierId)?.data.accountingVendorCode} onChange={e=>change('accountingVendorCode',e.target.value)}/></label>}{!separateRecord&&Object.entries(supplierFields).filter(([k])=>k!=='phone').map(([k,t])=>field(k,t,['name','country'].includes(k)||k==='contact'&&(!draft.importedForSetup||draft.active)))}{foreignOnly&&<>{field('name',supplierFields.name,true)}{field('country',supplierFields.country,true)}{field('contact',supplierFields.contact,true)}{field('email',supplierFields.email)}</>}{domestic&&<>
  {field('name',supplierFields.name,true)}
  {Object.entries(supplierRegistrationFields).map(([key,label])=><label key={key} className="field">{label} (اختیاری)<NumberInput fieldKey={key} value={draft[key]||''} onChange={event=>change(key,event.target.value)} inputMode="numeric" maxLength={32} dir="ltr"/></label>)}
  {field('contact','مسئول تماس',!draft.importedForSetup||draft.active)}
 </>}<fieldset className="field wide"><legend>شماره‌های تلفن</legend>{draft.phones.map((phone:string,index:number)=><div className="formgrid" key={index}><label className="field">{index===0?'تلفن اصلی':'تلفن '+(index+1)}<NumberInput fieldKey={'supplierPhone'+index} required={index===0&&(!draft.importedForSetup||draft.active)} type="tel" value={phone} onChange={e=>change('phones',draft.phones.map((v:string,i:number)=>i===index?e.target.value:v))}/></label>{index>0&&<button data-pair-open="supplier-panel:0ffbf81ec93b" type="button" className="btn" onClick={()=>change('phones',draft.phones.filter((_:string,i:number)=>i!==index))}>حذف شماره</button>}</div>)}<button data-pair-open="supplier-panel:5348610fc735" type="button" className="btn" disabled={draft.phones.length>=10} onClick={()=>change('phones',[...draft.phones,''])}>افزودن شماره تلفن</button></fieldset>
 {matchesSimilar.length>0&&<div className="notice wide" role="status"><p>پروندهٔ مشابه پیدا شد.</p>{matchesSimilar.map((s:any)=><button key={s.id} type="button" className="btn" onClick={()=>{setDraft(null);showSupplier(s.id);}}>باز کردن {s.data.name}</button>)}</div>}
 {domestic&&<details className="wide"><summary>اطلاعات تکمیلی</summary><div className="formgrid">{Object.entries(supplierFields).filter(([key])=>!['name','contact','phone'].includes(key)).map(([key,label])=>field(key,label,key==='country'))}</div></details>}{foreignOnly&&<details className="wide"><summary>اطلاعات تکمیلی</summary><div className="formgrid">{Object.entries(supplierFields).filter(([key])=>!['name','country','contact','phone','email'].includes(key)).map(([key,label])=>field(key,label))}</div></details>}
 <label className="flow-check"><Checkbox checked={draft.active} onCheckedChange={v=>change('active',v===true)}/><span>فعال</span></label></>}
 {!foreignOnly&&draft.mode==='supplier'&&draft.supplierId&&data?.suppliers.some((s:any)=>s.id===draft.supplierId&&s.canLink)&&<><SupplierMaterialLink key={draft.supplierId} supplierId={draft.supplierId} materials={materialCatalog||data.materials} links={data.links} onLinked={load}/><div className="wide"><h4>کالاهای این تأمین‌کننده</h4>{data.links.filter((l:any)=>l.data.supplierId===draft.supplierId).map((l:any)=><p key={l.id}>{l.data.partCode} · {data.materials.find((m:any)=>m.id===l.data.materialId)?.name} · {supplierStates[l.data.status]}</p>)}</div></>}
 {draft.mode==='link'&&<>{pick('supplierId','تأمین‌کننده',Object.fromEntries(data.suppliers.filter((s:any)=>!s.data.deletedAt&&s.canLink).map((s:any)=>[s.id,s.data.name])))}<MaterialSelect title="کالا" value={draft.materialId||''} choices={data.materials.map((m:any)=>({id:m.id,code:m.code,name:m.name,accountingCode:m.accountingCode}))} onChange={id=>change('materialId',id)} disabled={busy}/>{field('supplierCode','کد کالا نزد تأمین‌کننده')}{field('notes','یادداشت ارتباط')}</>}
 {draft.mode==='commercial_details'&&<>{field('supplierCode','کد یا مدل کالا نزد تأمین‌کننده')}{field('brand','برند یا سازنده')}{field('packaging','بسته‌بندی')}{field('minimumOrder','حداقل سفارش')}{field('leadTime','زمان معمول تحویل')}</>}
 {draft.mode==='technical'&&<>{pick('decision','تصمیم فنی',draft.scope==='material'?{hold:'توقف خرید',release:'برداشتن توقف همین واحد',change:'ویرایش طراحی و توقف خرید'}:{hold:'توقف خرید از این منبع',release:'برداشتن توقف همین واحد'})}{field('reason','دلیل فنی تصمیم',true)}{field('evidence','مرجع شواهد خط تولید، خدمات یا تغییر طراحی',true)}{draft.decision==='change'&&field('specs','مشخصات طراحی جدید',true)}<p className="notice wide">این تصمیم با نام شما ثبت می‌شود. توقف واحد دیگر باقی می‌ماند. ویرایش طراحی تا آزادسازی صریح، خرید را متوقف می‌کند.</p></>}
 {draft.mode==='review'&&<>{pick('status','نتیجه صلاحیت',supplierStates)}{pick('qualityRisk','ریسک کیفیت',supplierRisks)}{pick('supplyRisk','ریسک تأمین',supplierRisks)}<SolarDate label="موعد بازبینی" value={draft.reviewDue} onChange={v=>change('reviewDue',v)}/>{field('rationale','دلایل تصمیم',true)}{field('evidence','مرجع شواهد، ممیزی، آزمون یا مدارک بررسی‌شده',true)}<fieldset className="field wide"><legend>مدارک تأییدشده مرتبط با این ارزیابی</legend>{(data.links.find((l:any)=>l.id===draft.linkId)?.documents||[]).map((d:any)=><label className="flow-check" key={d.id}><Checkbox checked={draft.documentIds.includes(d.id)} onCheckedChange={v=>change('documentIds',v?[...draft.documentIds,d.id]:draft.documentIds.filter((x:string)=>x!==d.id))}/>{d.title} · نسخه {d.version}</label>)}</fieldset>{field('restrictions','محدودیت و کنترل اضافی',draft.status==='conditional')}{draft.status==='conditional'&&field('maxQuantity','سقف مقدار هر سفارش مشروط، واحد کالا',true)}<p className="notice wide">امتیازها کارشناسی و اختیاری‌اند. بدون تکمیل همه موارد، امتیاز کل ساخته نمی‌شود. وزن‌ها سیاست پیشنهادی شرکت‌اند، نه امتیاز اجباری استاندارد.</p>{Object.entries({quality:'کیفیت (۴۰٪)',delivery:'تحویل (۲۰٪)',cost:'هزینه (۲۰٪)',response:'پاسخ‌گویی (۱۰٪)',documents:'مدارک (۱۰٪)'}).map(([k,t])=><label className="field" key={k}>{t}<NumberInput fieldKey={k} type="number" min="0" max="100" step="any" value={draft.scores[k]??''} onChange={e=>change('scores',{...draft.scores,[k]:e.target.value===''?null:Number(e.target.value)})}/></label>)}</>}
 </div>{error&&<p className="notice error" role="alert">{error}</p>}<button className="btn primary" disabled={busy}>{draft.mode==='archive'?'تأیید حذف تأمین‌کننده':draft.mode==='restore'?'تأیید بازیابی تأمین‌کننده':domestic&&draft.mode==='supplier'?(draft.supplierId?'ذخیرهٔ تغییرات':'ثبت و افزودن کالا'):'تأیید و ثبت'}</button></fieldset></form>}</DialogContent></Dialog></section>;
}
