'use client';
import {useEffect,useRef,useState} from 'react';
import {BuyerSelect} from './buyer-select';
import {partnerKinds} from '@/lib/sales-network-contract';

export function SalesBuyerAssignments({initialBuyerId='',onSaved}:{initialBuyerId?:string;onSaved:()=>void|Promise<void>}){
 const [data,setData]=useState<any>(null),[buyerId,setBuyerId]=useState(initialBuyerId),[ownerId,setOwnerId]=useState(''),[memberSearch,setMemberSearch]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const pending=useRef<{key:string,id:string}|null>(null);
 async function load(){const r=await fetch('/api/sales/network?assignments=1',{cache:'no-store'}),d:any=await r.json();if(!r.ok){setData(null);throw Error(d.error||'فهرست تخصیص در دسترس نیست.');}setData(d);return d;}
 useEffect(()=>{let active=true;void load().catch(e=>{if(active)setError(e.message)});return()=>{active=false};},[]);
 const buyer=data?.buyers.find((b:any)=>b.id===buyerId),members=data?.members||[];
 useEffect(()=>{setOwnerId(members.some((m:any)=>m.id===buyer?.ownerId)?buyer.ownerId:'');setMemberSearch('');pending.current=null;},[buyerId,buyer?.revision,data?.members]);
 async function save(e:React.FormEvent){e.preventDefault();if(busy)return;setError('');setMessage('');if(!buyer||!members.some((m:any)=>m.id===ownerId)){setError('خریدار موجود و کارشناس فروش فعال را انتخاب کنید.');return;}
  const payload={agentId:buyer.id,revision:buyer.revision,ownerId},key=JSON.stringify(payload);if(pending.current?.key!==key)pending.current={key,id:crypto.randomUUID()};setBusy(true);
  try{const r=await fetch('/api/sales/network',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:pending.current.id,mode:'assign',confirmed:true,...payload})}),d:any=await r.json();if(!r.ok){if(r.status===409){pending.current=null;await load();}throw Error(d.error||'تخصیص ثبت نشد.');}
   setMessage(d.followupPending?'تخصیص ثبت شد؛ کارتابل در اجرای بعدی همگام می‌شود.':'تخصیص ثبت شد؛ کارشناس با تازه‌سازی فروش می‌تواند برای این خریدار ثبت انجام دهد.');pending.current=null;
   try{await load();await onSaved();}catch{setError('تخصیص ثبت شده، اما تازه‌سازی فهرست انجام نشد؛ دوباره تازه‌سازی کنید.');}
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <section aria-label="تخصیص خریدار به کارشناس"><h3>تخصیص خریدار به کارشناس</h3><p>خریدار موجود و مسئول فروش او را انتخاب کنید. پرونده جدید ساخته نمی‌شود و قیمت، شرایط مالی و سوابق خریدار حفظ می‌شوند.</p>
  {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  <button className="btn" disabled={busy} onClick={()=>{setError('');void load().catch(e=>setError(e.message))}}>تازه‌سازی فهرست</button>
  {!data?<p role="status">{error?'': 'در حال دریافت خریداران و کارشناسان…'}</p>:<form onSubmit={save}><fieldset disabled={busy}><div className="formgrid">
   <BuyerSelect value={buyerId} onChange={setBuyerId} choices={data.buyers.map((b:any)=>({id:b.id,name:b.name,detail:(partnerKinds[b.kind]||'خریدار')+' · مسئول فعلی: '+(b.ownerName||'تعیین نشده')}))}/>
   <div className="field"><label>جست‌وجوی کارشناس<input type="search" value={memberSearch} onChange={e=>setMemberSearch(e.target.value)} placeholder="نام کارشناس فروش"/></label><label>کارشناس مسئول<select required value={ownerId} onChange={e=>setOwnerId(e.target.value)}><option value="">انتخاب کارشناس فروش</option>{members.filter((m:any)=>m.id===ownerId||m.name.includes(memberSearch.trim())).map((m:any)=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label></div>
  </div>{buyer&&<p>مسئول فعلی {buyer.name}: {buyer.ownerName||'تعیین نشده'}</p>}
   {!data.buyers.length&&<p role="status">خریدار فعال ثبت‌شده‌ای وجود ندارد؛ ابتدا پرونده خریدار را ایجاد کنید.</p>}{!members.length&&<p role="status">کارشناس فروش فعالی وجود ندارد؛ ابتدا نقش فروش را برای یک حساب فعال تعیین کنید.</p>}
   <button className="btn primary" disabled={!buyer||!ownerId||busy}>{busy?'در حال ثبت…':'تأیید و ثبت تخصیص'}</button>
  </fieldset></form>}
 </section>;
}
