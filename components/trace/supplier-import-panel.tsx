'use client';

import {useRef,useState} from 'react';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {readBomSheets} from '@/lib/bom-import-file';
import {parseVendorWorkbook} from '@/lib/supplier-import-contract';

type Preview={
 snapshot:string;created:number;reused:number;staged:number;held:number;unchanged:number;waiting:number;ready:number;existingLinks:number;
 reviewCount:number;review:{vendorCode:string;itemCode?:string;title:string;reason:string}[];
};
const labels={created:'پروندهٔ اولیه',reused:'تأمین‌کنندهٔ موجود',staged:'ارتباط ذخیره‌شده برای تطبیق',ready:'آمادهٔ اتصال',existingLinks:'ارتباط از قبل ثبت‌شده',waiting:'منتظر تطبیق',held:'کنارگذاشته برای بررسی',unchanged:'تکراری یا قبلاً پردازش‌شده'} as const;

export function SupplierImportPanel({onSaved}:{onSaved:()=>Promise<void>}){
 const [open,setOpen]=useState(false),[linkMode,setLinkMode]=useState(false),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [source,setSource]=useState(''),[draft,setDraft]=useState<ReturnType<typeof parseVendorWorkbook>|null>(null);
 const [preview,setPreview]=useState<Preview|null>(null),[message,setMessage]=useState(''),[error,setError]=useState('');
 const pending=useRef<any>(null),flight=useRef(false);
 function start(link:boolean){
  pending.current=null;setDraft(null);setSource('');setPreview(null);setError('');setMessage('');setLinkMode(link);setOpen(true);
 }
 async function choose(file?:File){
  if(!file||flight.current)return;
  flight.current=true;setBusy(true);setError('');setPreview(null);setMessage('');setDraft(null);
  try{
   const rows=parseVendorWorkbook(await readBomSheets(file,true));
   if(!rows.vendors.length||rows.vendors.length>500||rows.links.length>2000)throw Error('تعداد تأمین‌کنندگان یا ارتباط‌ها خارج از سقف ورود است.');
   setSource(file.name);setDraft(rows);
  }catch(e){setError((e as Error).message||'اکسل خوانده نشد.');}
  finally{flight.current=false;setBusy(false);}
 }
 async function run(commit:boolean){
  if(flight.current||!linkMode&&!draft||commit&&!preview&&!pending.current)return;
  flight.current=true;setBusy(true);setError('');setMessage('');
  const input=linkMode?{}:{source,...draft};
  const mode=linkMode?(commit?'commit_links':'preview_links'):(commit?'commit':'preview');
  if(commit&&!pending.current)pending.current={...input,mode,id:crypto.randomUUID(),confirmed:true,snapshot:preview?.snapshot};
  try{
   const response=await fetch('/api/suppliers/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(commit?pending.current:{...input,mode})});
   const result=await response.json() as Preview & {error?:string};
   if(!response.ok){
    if(response.status<500){pending.current=null;setUncertain(false);setPreview(null);}
    throw Error(result.error||'ورود انجام نشد.');
   }
   setPreview(result);
   if(commit){
    pending.current=null;setUncertain(false);
    setMessage(linkMode?'اتصال‌های منطبق ثبت شدند.':'پرونده‌ها و ارتباط‌های در انتظار تطبیق ذخیره شدند.');
    await onSaved().catch(()=>setError('ثبت انجام شد. برای دیدن فهرست جدید، صفحه را تازه‌سازی کنید.'));
   }
  }catch(e){
   const retry=commit&&!!pending.current;setUncertain(retry);
   setError(retry?'نتیجه قطعی دریافت نشد. همان ثبت را دوباره بررسی کنید.':(e as Error).message);
  }finally{flight.current=false;setBusy(false);}
 }
 const ready=preview&&(linkMode?preview.ready+preview.existingLinks:preview.created+preview.staged+preview.held);
 return <>
  <button type="button" className="btn" onClick={()=>start(false)}>ورود اکسل تأمین‌کنندگان</button>
  <button type="button" className="btn" onClick={()=>start(true)}>تطبیق ارتباط‌های کالا</button>
  <Dialog open={open} onOpenChange={next=>{if(!busy&&!uncertain)setOpen(next);}}>
   <DialogContent className="modal sm:max-w-3xl">
    <DialogTitle>{linkMode?'تطبیق ارتباط‌های کالا':'ورود اکسل تأمین‌کنندگان'}</DialogTitle>
    <DialogDescription>{linkMode?'کدهای حسابداری کالا با شناسنامه‌های موجود مقایسه می‌شوند. ارتباط‌های جدید پس از تأیید در حال ارزیابی خواهند بود.':'تأمین‌کنندگان از کد تفصیلی شناسایی می‌شوند. ارتباط کالاها برای تطبیق بعدی ذخیره می‌شود.'}</DialogDescription>
    {!linkMode&&<label className="field">فایل اکسل آمادهٔ ورود<input type="file" accept=".xlsx" disabled={busy||uncertain} onChange={e=>void choose(e.currentTarget.files?.[0])}/></label>}
    {draft&&!linkMode&&<p>{draft.vendors.length.toLocaleString('fa-IR')} تأمین‌کننده · {draft.links.length.toLocaleString('fa-IR')} ارتباط</p>}
    {preview&&<>
     <div className="tools">{Object.entries(labels).map(([key,label])=>{const value=preview[key as keyof typeof labels];return value?<span className="badge" key={key}>{value.toLocaleString('fa-IR')} {label}</span>:null;})}</div>
     {!ready&&!message&&<p>ردیف تازه‌ای برای ثبت در این مرحله پیدا نشد.</p>}
     {preview.review.length>0&&<details open><summary>ردیف‌های نیازمند بررسی</summary><ul style={{maxHeight:240,overflow:'auto'}}>{preview.review.map((item,index)=><li key={index}><bdi>{item.vendorCode}{item.itemCode?' / '+item.itemCode:''}</bdi> · {item.title} · {item.reason}</li>)}</ul></details>}
     {preview.reviewCount>preview.review.length&&<p>۱۰۰ مورد اول از {preview.reviewCount.toLocaleString('fa-IR')} مورد نیازمند بررسی نمایش داده شده است.</p>}
    </>}
    {message&&<p role="status" className="notice">{message}</p>}
    {error&&<p role="alert" className="notice error">{error}</p>}
    <div className="tools">
     {uncertain?<button type="button" className="btn primary" disabled={busy} onClick={()=>void run(true)}>بررسی دوبارهٔ همان ثبت</button>:<>
      <button type="button" className="btn" disabled={busy||!linkMode&&!draft} onClick={()=>void run(false)}>پیش‌نمایش</button>
      <button type="button" className="btn primary" disabled={busy||!ready||!!message} onClick={()=>void run(true)}>{linkMode?'تأیید و اتصال موارد منطبق':'تأیید و ثبت'}</button>
     </>}
     {busy&&<span role="status">در حال بررسی…</span>}
    </div>
   </DialogContent>
  </Dialog>
 </>;
}
