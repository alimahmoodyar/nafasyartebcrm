'use client';

import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';

const endpoint='/api/sales/resources';
export const salesResourcesTitle='فایل‌های فروش و آموزش';
const categories={catalog:'کاتالوگ',promotion:'تبلیغات',training:'آموزش'};
const audiences={all:'همهٔ نماینده‌ها و عامل‌ها',representative:'نماینده‌ها',reseller:'عامل‌های فروش'};
type SalesResource={id:string;revision:number;title:string;category:keyof typeof categories;audience:keyof typeof audiences;filename:string};
type Library={manage:boolean;files:SalesResource[]};

export function RepresentativeResources(){
 const [open,setOpen]=useState(false);
 return <>
  <button type="button" className="link" onClick={()=>setOpen(true)}>{salesResourcesTitle}</button>
  <Dialog open={open} onOpenChange={setOpen}>
   <DialogContent className="modal sm:max-w-2xl">
    <DialogTitle>{salesResourcesTitle}</DialogTitle>
    <DialogDescription>کاتالوگ‌ها، اقلام تبلیغاتی و فایل‌های آموزشی قابل دانلود.</DialogDescription>
    {open&&<SalesResources/>}
   </DialogContent>
  </Dialog>
 </>;
}

export function SalesResources({management=false}:{management?:boolean}){
 const [library,setLibrary]=useState<Library|null>(null);
 const [category,setCategory]=useState('');
 const [draft,setDraft]=useState<SalesResource|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [formOpen,setFormOpen]=useState(false);
 const formRef=useRef<HTMLFormElement>(null);
 async function load(signal?:AbortSignal){
  const response=await fetch(endpoint,{cache:'no-store',signal});
  const data=await response.json();
  if(!response.ok)throw Error(data.error);
  if(!signal?.aborted)setLibrary(data);
 }
 useEffect(()=>{
  const controller=new AbortController();
  void load(controller.signal).catch(error=>{if(!controller.signal.aborted)setError(error.message);});
  return ()=>controller.abort();
 },[]);
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy)return;
  const body=new FormData(event.currentTarget);
  if(draft){body.set('id',draft.id);body.set('revision',String(draft.revision));}
  setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch(endpoint,{method:'POST',body});
   const data=await response.json();
   if(!response.ok)throw Error(data.error);
   setDraft(null);setFormOpen(false);setMessage('فایل منتشر شد.');
   await load();
  }catch(error){setError((error as Error).message);}
  finally{setBusy(false);}
 }
 function start(resource:SalesResource|null){
  setDraft(resource);setFormOpen(true);setError('');setMessage('');
  requestAnimationFrame(()=>formRef.current?.querySelector('input')?.focus());
 }
 const files=library?.files.filter(file=>!category||category===file.category)||[];
 const manage=management&&library?.manage;
 return <section aria-label={salesResourcesTitle}>
  {management&&<h3>{salesResourcesTitle}</h3>}
  {error&&<p className="notice error" role="alert">{error}</p>}
  {message&&<p role="status">{message}</p>}
  {!library&&!error&&<p role="status">در حال دریافت فایل‌ها…</p>}
  {library&&<>
   <div className="tools">
    <label className="field">دستهٔ فایل<select value={category} onChange={event=>setCategory(event.target.value)}>
     <option value="">همهٔ دسته‌ها</option>
     {Object.entries(categories).map(([key,label])=><option key={key} value={key}>{label}</option>)}
    </select></label>
    {manage&&<button type="button" className="btn primary" disabled={busy} onClick={()=>start(null)}>بارگذاری فایل</button>}
   </div>
   {manage&&formOpen&&<form ref={formRef} key={draft?.id||'new'} onSubmit={save}>
    <fieldset disabled={busy} className="formgrid">
     <label className="field">نام نمایشی<input name="title" defaultValue={draft?.title||''} maxLength={160} required/></label>
     <label className="field">دسته<select name="category" defaultValue={draft?.category||'catalog'}>{Object.entries(categories).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
     <label className="field">مخاطب<select name="audience" defaultValue={draft?.audience||'all'}>{Object.entries(audiences).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
     <label className="field">فایل (حداکثر ۱۰ مگابایت)<input name="file" type="file" required/></label>
     <div className="tools"><button className="btn primary">{draft?'ذخیرهٔ نسخهٔ جایگزین':'انتشار فایل'}</button><button type="button" className="btn" onClick={()=>setFormOpen(false)}>انصراف</button></div>
    </fieldset>
   </form>}
   {files.length?<ul>{files.map(file=><li key={file.id}>
    <strong>{file.title}</strong> · {categories[file.category]}{manage&&<> · {audiences[file.audience]}</>}
    {' '}<a className="link" href={endpoint+'?id='+encodeURIComponent(file.id)} aria-label={'دانلود '+file.title}>دانلود</a>
    {manage&&<button type="button" className="link" disabled={busy} onClick={()=>start(file)}>جایگزینی فایل</button>}
   </li>)}</ul>:<p>فایلی در این دسته منتشر نشده است.</p>}
  </>}
 </section>;
}
