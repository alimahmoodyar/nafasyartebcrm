'use client';

import {useEffect,useRef,useState} from 'react';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {latinDigits} from '@/lib/persian-date';

type Account={
 id:string;
 revision:number;
 data:{title:string;number:string;iban:string;cardNumber?:string;state:'review'|'active'};
};
type DestinationData={accounts:Account[];roles:{treasury:boolean;manager:boolean}};
const emptyAccount={title:'',number:'',iban:'',cardNumber:''};

export function TreasuryDestinationPanel({test,accountId}:{test:boolean;accountId:string}){
 const [data,setData]=useState<DestinationData|null>(null),[form,setForm]=useState(emptyAccount);
 const [review,setReview]=useState<Account|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const pending=useRef<{signature:string;id:string}|null>(null);
 const url='/api/treasury?'+(test?'roleTest=true':'destinations=true');
 async function load(){
  const response=await fetch(url,{cache:'no-store'}),result=await response.json() as DestinationData&{error?:string};
  if(!response.ok)throw Error(result.error||'دریافت حساب‌های مقصد انجام نشد.');
  setData(result);
 }
 useEffect(()=>{void load().catch(e=>setError(e.message));},[url]);
 async function save(payload:Record<string,unknown>){
  setBusy(true);setError('');setMessage('');
  try{
   const body={...payload,confirmed:true,...(test?{roleTest:true}:{})},signature=JSON.stringify(body);
   const request=pending.current?.signature===signature?pending.current:{signature,id:crypto.randomUUID()};
   pending.current=request;
   const response=await fetch('/api/treasury',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,id:request.id})}),result=await response.json() as {error?:string};
   if(!response.ok)throw Error(result.error||'ثبت حساب مقصد انجام نشد.');
   pending.current=null;setForm(emptyAccount);setReview(null);
   setMessage(payload.mode==='destination_account'?'حساب برای تأیید مدیر مالی ثبت شد.':'حساب مقصد تأیید شد.');
   await load();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 const accounts=(data?.accounts||[]).filter(account=>!accountId||account.id===accountId);
 return <section className="panel" dir="rtl">
  <div className="panelhead"><h2>{test?'حساب مقصد فروش · آزمایشی':'حساب‌های مقصد فروش'}</h2></div>
  {test&&<p className="notice">این حساب‌ها فقط برای آزمون گردش کار هستند. اطلاعات بانکی فرضی وارد کنید.</p>}
  {data?.roles.treasury&&!accountId&&<form onSubmit={e=>{e.preventDefault();void save({...form,mode:'destination_account',revision:0});}}>
   <div className="grid">
    <label className="field">نام بانک<input required maxLength={200} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
    <label className="field">شماره حساب<input required maxLength={100} dir="ltr" value={form.number} onChange={e=>setForm({...form,number:latinDigits(e.target.value)})}/></label>
    <label className="field">شماره شبا<input required maxLength={80} dir="ltr" value={form.iban} onChange={e=>setForm({...form,iban:latinDigits(e.target.value)})}/></label>
    <label className="field">شماره کارت (اختیاری)<input maxLength={40} dir="ltr" inputMode="numeric" value={form.cardNumber} onChange={e=>setForm({...form,cardNumber:latinDigits(e.target.value)})}/></label>
   </div>
   <button type="submit" className="btn primary" disabled={busy}>ثبت حساب مقصد</button>
  </form>}
  {message&&<p role="status">{message}</p>}
  {error&&!review&&<p className="error" role="alert">{error}</p>}
  {!data&&!error&&<p role="status">در حال دریافت…</p>}
  {data&&!accounts.length&&<p>حساب مقصدی برای نمایش وجود ندارد.</p>}
  <div className="grid">{accounts.map(account=><article data-pair-row={JSON.stringify(account.id)} className="card" key={account.id}>
   <h3>{account.data.title}</h3>
   <p>شماره حساب <bdi>{account.data.number}</bdi></p>
   <p>شبا <bdi>{account.data.iban}</bdi></p>
   {account.data.cardNumber&&<p>شماره کارت <bdi>{account.data.cardNumber}</bdi></p>}
   <p>{account.data.state==='review'?'در انتظار تأیید مدیر مالی':'تأییدشده'}</p>
   {data?.roles.manager&&account.data.state==='review'&&<button data-pair-open="treasury-destination-panel:6d3068e7bbe7" type="button" className="btn" disabled={busy} onClick={()=>{setError('');setReview(account);}}>بررسی و تأیید</button>}
  </article>)}</div>
  <Dialog open={!!review} onOpenChange={open=>{if(!open&&!busy)setReview(null);}}>
   <DialogContent dir="rtl"><DialogTitle>تأیید حساب مقصد فروش</DialogTitle>
    <DialogDescription>نام بانک و شماره‌های ثبت‌شده را بررسی کنید.</DialogDescription>
    {review&&<><p>{review.data.title} · <bdi>{review.data.number}</bdi></p><p>شبا <bdi>{review.data.iban}</bdi></p>
     {review.data.cardNumber&&<p>شماره کارت <bdi>{review.data.cardNumber}</bdi></p>}
     {error&&<p className="error" role="alert">{error}</p>}
     <button type="button" className="btn primary" disabled={busy} onClick={()=>void save({mode:'approve_destination_account',entityId:review.id,revision:review.revision})}>تأیید حساب مقصد</button>
    </>}
   </DialogContent>
  </Dialog>
 </section>;
}
