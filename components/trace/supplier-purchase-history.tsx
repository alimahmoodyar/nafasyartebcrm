'use client';

import {useEffect,useRef,useState,type FormEvent} from 'react';
import {formatDate} from '@/lib/persian-date';
import {SolarDate} from './solar-date';

type Purchase={
 id:string;reference:string;day:string;deliveredOn:string;quantity:string;unit:string;price:string;currency:string;
 quality:string;notes:string;files:{id:string;filename:string}[];
};
type HistoryPage={entries:Purchase[];nextPage:number|null};
const url='/api/suppliers/history';

export function SupplierPurchaseHistory({linkId,unit,canWrite}:{linkId:string;unit:string;canWrite:boolean}){
 const [page,setPage]=useState<HistoryPage|null>(null),[version,setVersion]=useState(0);
 const [error,setError]=useState(''),[message,setMessage]=useState(''),[showForm,setShowForm]=useState(false),[busy,setBusy]=useState(false);
 const [day,setDay]=useState(''),[deliveredOn,setDeliveredOn]=useState('');
 const operationId=useRef('');

 async function read(index:number,signal?:AbortSignal):Promise<HistoryPage>{
  const response=await fetch(url+'?'+new URLSearchParams({link:linkId,page:String(index)}),{cache:'no-store',signal});
  const data=await response.json() as HistoryPage & {error?:string};
  if(!response.ok)throw new Error(data.error||'دریافت سوابق انجام نشد.');
  return data;
 }
 useEffect(()=>{
  const request=new AbortController();
  void read(0,request.signal).then(value=>{if(!request.signal.aborted)setPage(value);})
   .catch(error=>{if(!request.signal.aborted)setError(error.message);});
  return()=>request.abort();
 },[linkId,version]);

 async function more(){
  if(page?.nextPage==null||busy)return;
  setBusy(true);setError('');
  try{
   const next=await read(page.nextPage);
   setPage({nextPage:next.nextPage,entries:[...new Map([...page.entries,...next.entries].map(item=>[item.id,item])).values()]});
  }catch(error){setError((error as Error).message);}
  finally{setBusy(false);}
 }
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy)return;
  const fields=new FormData(event.currentTarget),body=new FormData();
  const files=fields.getAll('file').filter((value):value is File=>value instanceof File&&!!value.name);
  if(files.length>3||files.some(file=>!file.size||file.size>10*1024*1024)){
   setError('حداکثر سه فایل غیرخالی، هرکدام تا ۱۰ مگابایت، انتخاب کنید.');
   return;
  }
  for(const file of files)body.append('file',file);
  fields.delete('file');
  operationId.current ||= crypto.randomUUID();
  body.append('metadata',JSON.stringify({...Object.fromEntries(fields),id:operationId.current,linkId,day,deliveredOn}));
  setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch(url,{method:'POST',body}),data=await response.json() as {error?:string};
   if(!response.ok)throw new Error(data.error||'ثبت سابقه انجام نشد.');
   operationId.current='';setDay('');setDeliveredOn('');setShowForm(false);
   setMessage('سابقهٔ خرید ثبت شد.');setVersion(value=>value+1);
  }catch(error){setError((error as Error).message);}
  finally{setBusy(false);}
 }
 return <section className="inside" aria-label="سوابق خرید قدیمی">
  {canWrite&&<button type="button" className="btn" aria-expanded={showForm} onClick={()=>{setShowForm(!showForm);setError('');}}>ثبت سابقهٔ خرید قدیمی</button>}
  {error&&<p role="alert" className="notice error">{error}</p>}
  {message&&<p role="status">{message}</p>}
  {showForm&&<form onSubmit={save} onChange={()=>{operationId.current='';}}>
   <fieldset className="formgrid" disabled={busy}>
    <legend>سابقهٔ خرید همین کالا از این تأمین‌کننده</legend>
    <label className="field wide">شمارهٔ سفارش، فاکتور یا مرجع سابقه<input name="reference" required maxLength={200}/></label>
    <label className="field">تاریخ خرید (اختیاری)<SolarDate label="تاریخ خرید" value={day} onChange={value=>{operationId.current='';setDay(value);}}/></label>
    <label className="field">تاریخ واقعی تحویل (اختیاری)<SolarDate label="تاریخ واقعی تحویل" value={deliveredOn} onChange={value=>{operationId.current='';setDeliveredOn(value);}}/></label>
    <label className="field">مقدار<input name="quantity" inputMode="decimal" maxLength={24}/></label>
    <label className="field">واحد<input name="unit" defaultValue={unit} maxLength={35}/></label>
    <label className="field">قیمت واحد<input name="price" inputMode="decimal" maxLength={24}/></label>
    <label className="field">کد ارز<input name="currency" pattern="[A-Za-z]{3}" maxLength={3} placeholder="USD" dir="ltr"/></label>
    <label className="field wide">نتیجهٔ کنترل کیفیت<textarea name="quality" maxLength={1000}/></label>
    <label className="field wide">یادداشت<textarea name="notes" maxLength={2000}/></label>
    <label className="field wide">پیش‌فاکتور، فاکتور یا پکینگ‌لیست (اختیاری)<input name="file" type="file" multiple/></label>
    <div className="tools wide"><button className="btn primary" type="submit">{busy?'در حال ثبت…':'ثبت سابقه'}</button></div>
   </fieldset>
  </form>}
  {!page&&!error&&<p role="status">دریافت سوابق…</p>}
  {page&&!page.entries.length&&<p>سابقهٔ خرید قدیمی ثبت نشده است.</p>}
  {page?.entries.map(item=><article className="flow-card" key={item.id}>
   <h5>{item.reference}</h5>
   <p>{item.day?formatDate(item.day):'تاریخ خرید ثبت نشده'}{item.deliveredOn&&' · تحویل '+formatDate(item.deliveredOn)}</p>
   {item.quantity&&<p>مقدار {item.quantity} {item.unit}</p>}
   {item.price&&<p>قیمت واحد {item.price} <bdi>{item.currency}</bdi></p>}
   {item.quality&&<p>نتیجهٔ کنترل کیفیت {item.quality}</p>}
   {item.notes&&<p>{item.notes}</p>}
   {item.files.map(file=><p key={file.id}><a href={url+'?file='+encodeURIComponent(file.id)}>{file.filename}</a></p>)}
  </article>)}
  {page?.nextPage!=null&&<button type="button" className="btn" disabled={busy} onClick={()=>void more()}>نمایش سوابق بیشتر</button>}
 </section>;
}
