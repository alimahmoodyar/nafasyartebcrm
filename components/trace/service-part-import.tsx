'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {parseServicePartGrid,type ServicePartImportRow} from '@/lib/service-part-import';
import {formatDate,isIsoDay,localDay} from '@/lib/persian-date';
import {SolarDate} from './solar-date';

type ImportPreview={rows:ServicePartImportRow[];errors:string[];warnings:string[];catalogSnapshot:string;newMaterialCount:number;newTariffCount:number;unchangedCount:number;totalCount:number};
type ImportBody={mode:'preview'|'commit';domain:string;source:string;validFrom:string;rows:ServicePartImportRow[];id?:string;confirmed?:boolean;catalogSnapshot?:string};
const count=(value:number)=>value.toLocaleString('fa-IR');
const money=(value:string)=>{try{return BigInt(value).toLocaleString('fa-IR')}catch{return '—'}};

export function ServicePartImport({domain,onSaved}:{domain:string;onSaved:()=>void}){
 const headingId=useId(),[rows,setRows]=useState<ServicePartImportRow[]>([]),[source,setSource]=useState(''),[validFrom,setValidFrom]=useState(localDay),[preview,setPreview]=useState<ImportPreview|null>(null);
 const [busy,setBusy]=useState(false),[pendingCommit,setPendingCommit]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const generation=useRef(0),inFlight=useRef(false),commitBody=useRef<ImportBody|null>(null);
 const locked=busy||pendingCommit;
 useEffect(()=>{generation.current++;commitBody.current=null;inFlight.current=false;setRows([]);setSource('');setPreview(null);setValidFrom(localDay());setError('');setMessage('');setPendingCommit(false);setBusy(false);},[domain]);
 useEffect(()=>()=>{generation.current++;},[]);
 function invalidate(){generation.current++;setPreview(null);commitBody.current=null;setError('');setMessage('');}
 async function choose(file?:File){
  if(!file||locked||inFlight.current)return;
  invalidate();const current=generation.current;inFlight.current=true;setBusy(true);setRows([]);setSource(file.name);
  try{
   if(!/\.xlsx$/i.test(file.name))throw Error('فایل را با فرمت XLSX انتخاب کنید.');
   if(file.size>10*1024*1024)throw Error('حداکثر حجم این فایل اکسل ۱۰ مگابایت است.');
   const {readSheet}=await import('read-excel-file/browser');
   const grid=await readSheet(file,1,{parseNumber:value=>({excelNumber:value})});
   const parsed=parseServicePartGrid(grid,domain);
   if(current===generation.current)setRows(parsed);
  }catch(e){if(current===generation.current)setError(e instanceof Error?e.message:'خواندن فایل انجام نشد.');}
  finally{if(current===generation.current){inFlight.current=false;setBusy(false);}}
 }
 async function run(commit=false){
  if(inFlight.current||busy||!rows.length||!isIsoDay(validFrom)||(!commit&&pendingCommit)||commit&&!commitBody.current&&(!preview||preview.errors.length))return;
  const current=generation.current;
  const body:ImportBody=commit?(commitBody.current||{mode:'commit',id:crypto.randomUUID(),confirmed:true,catalogSnapshot:preview!.catalogSnapshot,domain,source,validFrom,rows}):{mode:'preview',domain,source,validFrom,rows};
  if(commit){commitBody.current=body;setPendingCommit(true);}else setPreview(null);
  inFlight.current=true;setBusy(true);setError('');setMessage('');let definiteFailure=false;
  try{
   const response=await fetch('/api/after-sales/catalog-import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   // A lost response can follow a completed transaction. Retain this exact body
   // and operation ID until the same request confirms its outcome.
   const result:any=await response.json();
   if(current!==generation.current)return;
   if(!response.ok){definiteFailure=response.status<500;throw Error(result.error||'بررسی یا ثبت قطعات انجام نشد.');}
   if(commit){
    commitBody.current=null;setPendingCommit(false);setPreview(null);
    setMessage(`ثبت کامل شد: ${count(result.newMaterialCount)} قطعه جدید، ${count(result.newTariffCount)} قیمت مصرف‌کننده و ${count(result.unchangedCount)} ردیف بدون تغییر.`);
    onSaved();
   }else setPreview(result);
  }catch(e){if(current===generation.current){
   setError(e instanceof Error?e.message:'پاسخ عملیات دریافت نشد.');
   if(commit&&definiteFailure){commitBody.current=null;setPendingCommit(false);setPreview(null);}
   else if(commit)setMessage('نتیجهٔ ثبت هنوز مشخص نیست. با «بررسی نتیجهٔ همین ثبت» ادامه دهید.');
  }}finally{if(current===generation.current){inFlight.current=false;setBusy(false);}}
 }
 const displayRows=preview?.rows||rows;
 return <section className="panel" aria-labelledby={headingId} style={{margin:'16px 0',padding:16,minWidth:0}}>
  <h3 id={headingId}>ورود قطعات و قیمت مصرف‌کننده از اکسل</h3>
  <p>برگهٔ اول فایل خوانده می‌شود؛ حداکثر ۲۵۰ قطعه در هر بار. قیمت مصرف‌کننده پس از ثبت در برآورد خدمات همین حوزه استفاده می‌شود. موجودی، بچ انبار و قیمت خرید از این فایل ساخته نمی‌شود.</p>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,16rem),1fr))',gap:16}}>
   <label className="field">فایل قطعات و قیمت‌ها<input type="file" accept=".xlsx" disabled={locked} onChange={e=>{const file=e.target.files?.[0];e.target.value='';void choose(file);}}/></label>
   <SolarDate label="تاریخ شروع اعتبار قیمت مصرف‌کننده" value={validFrom} disabled={locked} onChange={value=>{invalidate();setValidFrom(value);}}/>
  </div>
  {busy&&<p role="status">در حال بررسی…</p>}
  {rows.length>0&&<>
   <p><bdi>{source}</bdi> · {count(rows.length)} قطعه · اعتبار قیمت از {formatDate(validFrom)}</p>
   <p className="subtle">قطعات و قیمت مصرف‌کننده برای بررسی پیش از ثبت؛ برای دیدن همه ستون‌ها، جدول را افقی جابه‌جا کنید.</p>
   <div style={{maxHeight:420,overflow:'auto',maxWidth:'100%'}}>
    <table className="stocktable" aria-label="قطعات و قیمت مصرف‌کننده برای بررسی پیش از ثبت"><thead><tr><th>ردیف فایل</th><th>کد قطعه</th><th>نام قطعه</th><th>واحد</th><th>قیمت مصرف‌کننده برای هر واحد، ریال</th></tr></thead>
     <tbody>{displayRows.map((row,index)=><tr key={row.code}><td>{count(row.sourceRow??index+1)}</td><td><bdi dir="ltr">{row.code}</bdi></td><td>{row.name}</td><td>{row.unit}</td><td style={{whiteSpace:'nowrap'}}>{money(row.consumerPriceRial)}</td></tr>)}</tbody>
    </table>
   </div>
   <button type="button" className="btn" disabled={locked||!isIsoDay(validFrom)} onClick={()=>void run()}>بررسی و پیش‌نمایش ثبت</button>
  </>}
  {preview&&<div className="notice" style={{display:'block'}}>
   <p>قطعه جدید: {count(preview.newMaterialCount)} · قیمت جدید: {count(preview.newTariffCount)} · بدون تغییر: {count(preview.unchangedCount)} · مجموع: {count(preview.totalCount)}</p>
   {preview.warnings.map((warning,index)=><p key={index}>{warning}</p>)}
   {preview.errors.map((problem,index)=><p role="alert" key={index}>{problem}</p>)}
   <p>تمام ردیف‌ها با هم ثبت می‌شوند. وجود خطا مانع ثبت کل فایل است.</p>
   <button type="button" className="btn primary" disabled={locked||preview.errors.length>0} onClick={()=>void run(true)}>تأیید و ثبت قطعات و قیمت مصرف‌کننده</button>
  </div>}
  {pendingCommit&&!busy&&<button type="button" className="btn primary" onClick={()=>void run(true)}>بررسی نتیجهٔ همین ثبت</button>}
  {error&&<p className="notice error" role="alert" style={{whiteSpace:'pre-wrap'}}>{error}</p>}
  {message&&<p className="notice" role="status">{message}</p>}
 </section>;
}
