'use client';
import {useEffect,useRef,useState} from 'react';
import {BuyerSelect} from './buyer-select';
import {buyerSearchText} from '@/lib/buyer-search';
import {partnerKinds} from '@/lib/sales-network-contract';
import {assignmentGroups,assignmentOwners,type AssignmentDirectory} from '@/lib/sales-buyer-assignments';

async function request<T={saved?:boolean;followupPending?:boolean}>(url:string,options?:RequestInit):Promise<T>{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),35000);
 try{
  const r=await fetch(url,{...options,signal:controller.signal}),d=await r.json().catch(()=>{throw Error('پاسخ سامانه قابل خواندن نیست؛ فهرست را تازه‌سازی کنید.');});
  if(!d||typeof d!=='object')throw Error('پاسخ سامانه قابل خواندن نیست؛ فهرست را تازه‌سازی کنید.');
  const error='error' in d&&typeof d.error==='string'?d.error:'درخواست انجام نشد.';
  if(!r.ok)throw Object.assign(Error(error),{status:r.status});
  return d as T;
 }catch(e){if(controller.signal.aborted)throw Error(options?.method==='POST'?'پاسخ ثبت دریافت نشد؛ نتیجه را در فهرست بررسی کنید یا دوباره تأیید کنید.':'دریافت فهرست طول کشید؛ دوباره تازه‌سازی کنید.');throw e;}
 finally{clearTimeout(timer);}
}

export function SalesBuyerAssignments({initialBuyerId='',onSaved}:{initialBuyerId?:string;onSaved:()=>void|Promise<void>}){
 const [data,setData]=useState<AssignmentDirectory|null>(null),[draft,setDraft]=useState({buyerId:initialBuyerId,ownerId:null as string|null}),[memberSearch,setMemberSearch]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[refreshRequired,setRefreshRequired]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [search,setSearch]=useState(''),[ownerFilter,setOwnerFilter]=useState('all'),[kindFilter,setKindFilter]=useState('');
 const pending=useRef<{key:string;id:string}|null>(null),saveLock=useRef(false),loadVersion=useRef(0),mounted=useRef(true),formRef=useRef<HTMLFormElement>(null);
 async function load(){
  const version=++loadVersion.current;setLoading(true);
  try{
   const d=await request<AssignmentDirectory>('/api/sales/network?assignments=1',{cache:'no-store'});
   if(!Array.isArray(d.buyers)||!Array.isArray(d.members))throw Error('فهرست تخصیص دریافت نشد؛ دوباره تازه‌سازی کنید.');
   if(mounted.current&&version===loadVersion.current){setData(d);setRefreshRequired(false);}
   return d as AssignmentDirectory;
  }catch(e){
   if(!mounted.current||version!==loadVersion.current)throw Object.assign(Error((e as Error).message),{ignored:true});
   if((e as any).status===403)setData(null);throw e;
  }
  finally{if(mounted.current&&version===loadVersion.current)setLoading(false);}
 }
 useEffect(()=>{mounted.current=true;void load().catch(e=>{if(mounted.current&&!e.ignored)setError(e.message)});return()=>{mounted.current=false;loadVersion.current++;};},[]);
 const buyer=data?.buyers.find(b=>b.id===draft.buyerId),members=data?.members||[],ownerId=draft.ownerId??(members.some(m=>m.id===buyer?.ownerId)?buyer!.ownerId:'');
 function chooseBuyer(id:string){setDraft({buyerId:id,ownerId:null});setMemberSearch('');setError('');setMessage('');pending.current=null;}
 async function refresh(){setError('');try{await load();}catch(e){if(!(e as any).ignored)setError((e as Error).message);}}
 async function save(e:React.FormEvent){
  e.preventDefault();if(saveLock.current)return;setError('');setMessage('');
  const owner=members.find(m=>m.id===ownerId);
  if(!buyer||!owner){setError(!buyer?'خریدار را از نتیجه‌های جست‌وجو انتخاب کنید.':'کارشناس فروش مسئول را انتخاب کنید.');return;}
  if(refreshRequired){setError('تخصیص قبلی ثبت شده است؛ پیش از ثبت بعدی فهرست را تازه‌سازی کنید.');return;}
  saveLock.current=true;setBusy(true);
  try{
   const payload={agentId:buyer.id,revision:buyer.revision,ownerId},key=JSON.stringify(payload);
   if(pending.current?.key!==key)pending.current={key,id:crypto.randomUUID()};
   const d=await request('/api/sales/network',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:pending.current.id,mode:'assign',confirmed:true,...payload})});
   if(d.saved!==true)throw Error('تأیید ثبت از سامانه دریافت نشد؛ نتیجه را در فهرست بررسی کنید.');
   pending.current=null;setRefreshRequired(true);
   const success=`تخصیص ثبت شد: ${buyer.name} ← ${owner.name}.`;
   setMessage(success+(d.followupPending?' کارتابل در اجرای بعدی همگام می‌شود.':' کارشناس با تازه‌سازی فروش می‌تواند برای این خریدار ثبت انجام دهد.'));
   // Keep the acknowledged assignment visible on a failed refresh, but require a fresh revision before the next write.
   setData(current=>current&&({...current,buyers:current.buyers.map(b=>b.id===buyer.id?{...b,ownerId:owner.id,ownerName:owner.name}:b)}));
   try{
    const fresh=await load(),current=fresh.buyers.find(b=>b.id===buyer.id);
    if(!current||current.ownerId!==owner.id){setDraft({buyerId:buyer.id,ownerId:null});setMessage(success+' مسئول فعلی در فهرست تازه تغییر کرده است؛ پیش از اقدام بعدی بررسی کنید.');}
    await onSaved();
   }catch{setError('تخصیص ثبت شده، اما تازه‌سازی انجام نشد؛ برای دریافت آخرین وضعیت دوباره تازه‌سازی کنید.');}
   if(typeof window!=='undefined'){window.dispatchEvent(new Event('nafasyar-tasks-changed'));window.dispatchEvent(new Event('nafasyar-inbox-changed'));}
  }catch(e){
   if((e as any).status===409){pending.current=null;setDraft({buyerId:buyer.id,ownerId:null});try{await load();}catch{setRefreshRequired(true);}}
   if((e as any).status===403)setData(null);
   setError((e as Error).message);
  }finally{saveLock.current=false;setBusy(false);}
 }
 const owners=data?assignmentOwners(data):[],groups=data?assignmentGroups(data,search,ownerFilter,kindFilter):[],shown=groups.reduce((n,g)=>n+g.buyers.length,0),unassigned=data?.buyers.filter(b=>!b.ownerId).length||0;
 return <section aria-label="تخصیص خریدار به کارشناس">
  <h3>تخصیص خریدار به کارشناس</h3><p>خریدار موجود و مسئول فروش او را انتخاب کنید. مشخصات و سوابق خریدار حفظ می‌شوند.</p>
  <button type="button" className="btn" disabled={busy||loading} onClick={()=>void refresh()}>{loading?'در حال دریافت فهرست…':'تازه‌سازی فهرست'}</button>
  {!data?<>{error&&<p role="alert">{error}</p>}{loading&&<p role="status">در حال دریافت خریداران و کارشناسان…</p>}</>:<>
   <form ref={formRef} noValidate onSubmit={save}><fieldset disabled={busy} style={{border:0,padding:0}}><div className="formgrid">
    <BuyerSelect value={draft.buyerId} onChange={chooseBuyer} choices={data.buyers.map(b=>({id:b.id,name:b.name,detail:(partnerKinds[b.kind]||'خریدار')+' · مسئول فعلی: '+(b.ownerName||'تعیین نشده')}))}/>
    <div className="field"><label>جست‌وجوی کارشناس<input type="search" value={memberSearch} onChange={e=>setMemberSearch(e.target.value)} placeholder="نام کارشناس فروش"/></label><label>کارشناس مسئول<select required value={ownerId} onChange={e=>{setDraft({...draft,ownerId:e.target.value});pending.current=null;setError('');setMessage('');}}><option value="">انتخاب کارشناس فروش</option>{members.filter(m=>m.id===ownerId||buyerSearchText(m.name).includes(buyerSearchText(memberSearch))).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label></div>
   </div>{buyer&&<p>مسئول فعلی {buyer.name}: {buyer.ownerName||'تعیین نشده'}</p>}
    {!data.buyers.length&&<p role="status">خریدار فعال ثبت‌شده‌ای وجود ندارد؛ ابتدا پرونده خریدار را ایجاد کنید.</p>}{!members.length&&<p role="status">کارشناس فروش فعالی وجود ندارد؛ ابتدا نقش فروش را برای یک حساب فعال تعیین کنید.</p>}
    <button type="submit" className="btn primary" disabled={busy||refreshRequired}>{busy?'در حال ثبت…':'تأیید و ثبت تخصیص'}</button>
   </fieldset>
   {busy&&<p role="status">در حال ثبت تخصیص؛ منتظر نتیجه بمانید…</p>}{error&&<p className="notice error" role="alert">{error}</p>}{message&&<p className="notice" role="status">{message}</p>}
   {refreshRequired&&<p>برای ثبت بعدی، ابتدا «تازه‌سازی فهرست» را بزنید.</p>}
   </form>
   <section aria-label="فهرست تخصیص خریداران" style={{marginTop:28}}><h3>خریداران هر کارشناس</h3>
    <p>{data.buyers.length.toLocaleString('fa-IR')} خریدار فعال · {unassigned.toLocaleString('fa-IR')} خریدار بدون کارشناس</p>
    <div className="formgrid">
     <label className="field">جست‌وجوی خریدار یا کارشناس<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="نام خریدار یا کارشناس"/></label>
     <label className="field">فیلتر کارشناس<select value={ownerFilter} onChange={e=>setOwnerFilter(e.target.value)}><option value="all">همه کارشناسان</option><option value="unassigned">بدون کارشناس</option>{owners.map(o=><option key={o.id} value={'member:'+o.id}>{o.name}{o.eligible?'':' (غیرفعال یا بدون نقش فروش)'}</option>)}</select></label>
     <label className="field">نوع خریدار<select value={kindFilter} onChange={e=>setKindFilter(e.target.value)}><option value="">همه خریداران</option>{Object.entries(partnerKinds).filter(([kind])=>kind!=='referrer').map(([kind,name])=><option key={kind} value={kind}>{name}</option>)}</select></label>
    </div><p role="status">{shown.toLocaleString('fa-IR')} خریدار در فهرست</p>
    {!groups.length&&<p>{data.buyers.length?'موردی با این جست‌وجو و فیلترها پیدا نشد.':'هنوز خریداری ثبت نشده است.'}</p>}
    {groups.map(group=><div key={group.id||'unassigned'} className="flow-card"><h4>{group.name} · {group.buyers.length.toLocaleString('fa-IR')} از {group.total.toLocaleString('fa-IR')} خریدار</h4>
     {group.id&&!group.eligible&&<p>مسئول فعلی فعال یا دارای نقش فروش نیست؛ کارشناس دیگری انتخاب کنید.</p>}
     <div className="sales-table"><table><thead><tr><th scope="col">خریدار</th><th scope="col">نوع خریدار</th><th scope="col">تخصیص</th></tr></thead><tbody>{group.buyers.map(b=><tr key={b.id}><td>{b.name}</td><td>{partnerKinds[b.kind]||'خریدار'}</td><td><button type="button" className="btn" disabled={busy} onClick={()=>{chooseBuyer(b.id);formRef.current?.scrollIntoView({behavior:'smooth',block:'start'});}}>{b.ownerId?'تغییر کارشناس':'انتخاب کارشناس'}<span className="sr-only"> برای {b.name}</span></button></td></tr>)}</tbody></table></div>
    </div>)}
   </section>
  </>}
 </section>;
}
