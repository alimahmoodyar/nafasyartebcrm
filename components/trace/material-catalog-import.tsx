'use client';
import {Fragment,useRef,useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {readBomSheets,defaultBomSheet,type BomSheet} from '@/lib/bom-import-file';
import {financeMaterialWorkbook,guessMaterialImportMapping,parseMaterialImportGrid,type MaterialImportMapping,type MaterialImportRow} from '@/lib/material-import';
import {materialUnits} from '@/lib/material-units';
type ImportResultRow={row:number;accountingCode:string;status:string;name:string;message:string};
function ImportResultList({label,changes}:{label:string;changes:ImportResultRow[]}){
 if(!changes.length)return null;
 return <details><summary>{label} ({changes.length.toLocaleString('fa-IR')})</summary>
 <ol style={{maxHeight:320,overflow:'auto'}}>{changes.map(change=><li key={change.row}><bdi>{change.accountingCode||'بدون کد'}</bdi> · {change.name} · {change.message}</li>)}</ol>
 </details>;
}
export function MaterialCatalogImport({onSaved,accounting=false}:{onSaved:()=>void;accounting?:boolean}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[book,setBook]=useState<BomSheet[]>([]),[sheet,setSheet]=useState(0),[source,setSource]=useState('');
 const [header,setHeader]=useState(0),[mapping,setMapping]=useState<MaterialImportMapping>({code:-1,name:-1,unit:-1}),[rows,setRows]=useState<MaterialImportRow[]>([]);
 const [preview,setPreview]=useState<any>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[uncertain,setUncertain]=useState(false);
 const [financeSheet,setFinanceSheet]=useState(''),[savedExclusions,setSavedExclusions]=useState<ImportResultRow[]>([]);
 const epoch=useRef(0),inFlight=useRef(false),pending=useRef<any>(null),fileInput=useRef<HTMLInputElement>(null);
 const firstIssueRow=useRef<HTMLTableRowElement>(null);
 const firstIssue=accounting?preview?.changes?.find((change:any)=>change.status==='review'):undefined;
 const invalidate=()=>{epoch.current++;setPreview(null);setError('');setMessage('');pending.current=null;};
 function selectSheet(sheets:BomSheet[],index:number){
  invalidate();setSheet(index);setRows([]);const grid=sheets[index]?.grid||[];
  const found=grid.findIndex(row=>{const m=guessMaterialImportMapping(row,accounting);return m.code>=0&&(accounting||m.name>=0);});const h=found>=0?found:0,m=guessMaterialImportMapping(grid[h]||[],accounting);setHeader(h);setMapping(m);
  if(found>=0){try{setRows(parseMaterialImportGrid(grid,h,m,accounting));}catch(e){setError(e instanceof Error?e.message:'فایل خوانده نشد.');}}
 }
 async function choose(file?:File){
  if(!file||inFlight.current)return;invalidate();const generation=epoch.current;inFlight.current=true;setBusy(true);setBook([]);setRows([]);setFinanceSheet('');setSavedExclusions([]);
  try{
   const sheets=await readBomSheets(file,accounting,accounting);
   if(generation!==epoch.current)return;
   const finance=accounting?financeMaterialWorkbook(sheets):null;
   setSource(file.name);
   if(finance){setFinanceSheet(finance.name);setRows(finance.rows);return;}
   setBook(sheets);selectSheet(sheets,defaultBomSheet(sheets));
  }catch(e){setError(e instanceof Error?e.message:'فایل خوانده نشد.');}finally{inFlight.current=false;setBusy(false);}
 }
 function edit(index:number,key:keyof MaterialImportRow,value:string|boolean){invalidate();setRows(items=>items.map((row,i)=>i===index?{...row,[key]:value}:row));}
 async function run(commit=false){
  if(inFlight.current||!rows.length)return;inFlight.current=true;setBusy(true);setError('');setMessage('');const generation=epoch.current;
  const payloadBase={...(accounting?{catalog:'accounting'}:{}),...(financeSheet?{profile:'finance-frequent'}:{}),source:source+' · برگه '+(financeSheet||book[sheet].name),rows};
  if(commit&&!pending.current){if(!preview||preview.errors.length||(financeSheet&&!preview.newMaterialCount&&!preview.linkedCount)){inFlight.current=false;setBusy(false);return;}pending.current={...payloadBase,mode:'commit',id:crypto.randomUUID(),confirmed:true,catalogSnapshot:preview.catalogSnapshot};}
  const payload=commit?pending.current:{...payloadBase,mode:'preview'};
  try{
   const response=await fetch('/api/material-import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   if(!response.ok&&response.status<500){pending.current=null;setUncertain(false);setPreview(null);const d:any=await response.json();throw Error(d.error||'پیش‌نمایش را دوباره بررسی کنید.');}
   if(!response.ok)throw Error('پاسخ قطعی دریافت نشد.');const data:any=await response.json();if(generation!==epoch.current)return;
   if(commit){pending.current=null;setUncertain(false);if(financeSheet)setSavedExclusions(preview?.changes.filter((change:any)=>change.status==='excluded')||[]);setFinanceSheet('');setPreview(null);setRows([]);setBook([]);setSource('');if(fileInput.current)fileInput.current.value='';setMessage(accounting?data.newMaterialCount+' جدید، '+data.linkedCount+' اتصال به پروندهٔ موجود، '+data.existingCount+' بدون تغییر، '+(financeSheet?data.excludedCount+' کنار گذاشته شد.':data.duplicateCount+' تکراری در فایل، '+data.skippedCount+' بدون کد حسابداری.'):data.newMaterialCount+' کالای جدید ثبت شد؛ '+data.existingCount+' کالای موجود بدون تغییر حفظ شد. برای تکمیل مشخصات، نام یا کد کالا را جست‌وجو کنید.');onSaved();}
   else setPreview(data);
  }catch(e){if(generation===epoch.current){const unresolved=commit&&!!pending.current;setUncertain(unresolved);setError(unresolved?'نتیجه ثبت هنوز قطعی نیست؛ «بررسی مجدد همین ثبت» را بزنید.':e instanceof Error?e.message:'عملیات انجام نشد.');}}
  finally{inFlight.current=false;setBusy(false);}
 }
 function prepare(){invalidate();try{setRows(parseMaterialImportGrid(book[sheet].grid,header,mapping,accounting));}catch(e){setRows([]);setError(e instanceof Error?e.message:'ستون‌ها را بررسی کنید.');}}
 return <><button data-pair-open="material-catalog-import:e38dbdcff02c" type="button" className="btn" onClick={()=>setOpen(true)}>{accounting?'ورود اکسل حسابداری':'ورود از اکسل'}</button><Dialog open={open} onOpenChange={value=>{if(!busy&&!uncertain)setOpen(value)}}><DialogContent className="modal sm:max-w-4xl material-catalog-import" style={{maxHeight:'85dvh',overflow:'hidden',display:'flex',flexDirection:'column'}}><div className="material-catalog-import__header"><DialogTitle>{accounting?'ورود اکسل حسابداری':'ورود گروهی کالا از اکسل'}</DialogTitle><DialogDescription>{accounting?'کدهای حسابداری به شناسنامه‌های موجود وصل می‌شوند. هم‌نفس برای کالاهای تازه کد خودش را می‌سازد.':'کد، نام و واحد کالاها را بررسی کنید. مشخصات تکمیلی و فرم کنترل کیفیت بعداً برای هر کالا تکمیل می‌شوند.'}</DialogDescription></div>
 <div className="material-catalog-import__body"><fieldset disabled={busy||uncertain} style={{border:0,padding:0,minWidth:0}}><label className="field">فایل اکسل<input ref={fileInput} type="file" accept=".xls,.xlsx" onChange={e=>void choose(e.target.files?.[0])}/></label><p className="subtle">{accounting?'فایل اقلام پرمصرف مالی با پسوند XLS یا XLSX مستقیم خوانده می‌شود. برای سایر فایل‌ها، سقف ۲۰۰ قلم در هر برگه است. ':'XLSX یا XLS با ساختار XML، حداکثر ۲۰۰ قلم. فقط برگهٔ انتخاب‌شده خوانده می‌شود. '}{accounting?'برای حفظ صفرهای اول، ستون کد را در اکسل به‌صورت متن نگه دارید.':'ستون مقدار مصرف در تعریف کالا استفاده نمی‌شود. ثبت کالا موجودی، بچ یا BOM ایجاد نمی‌کند.'}</p>
 {book.length>0&&<><label className="field">برگه فایل<select value={sheet} onChange={e=>selectSheet(book,Number(e.target.value))}>{book.map((s,i)=><option key={i} value={i}>{s.name}</option>)}</select></label><details><summary>تنظیم ستون‌ها</summary><label className="field">ردیف عنوان ستون‌ها<input type="number" min={1} max={book[sheet].grid.length} value={header+1} onChange={e=>{invalidate();setRows([]);const h=Number(e.target.value)-1;setHeader(h);setMapping(guessMaterialImportMapping(book[sheet].grid[h]||[],accounting));}}/></label><div className="formgrid">{(accounting?['code','name','unit','existingCode'] as const:['code','name','unit'] as const).map((key,i)=><label className="field" key={key}>{[accounting?'ستون کد حسابداری':'ستون کد','ستون نام','ستون واحد','ستون کد هم‌نفس'][i]}<select value={mapping[key]??-1} onChange={e=>{invalidate();setRows([]);setMapping(m=>({...m,[key]:Number(e.target.value)}));}}><option value={-1}>{key==='unit'?'انتخاب واحد در جدول':accounting&&key!=='code'?'در فایل نیست':'انتخاب ستون'}</option>{(book[sheet].grid[header]||[]).map((value,col)=><option key={col} value={col}>{String(value||'ستون '+(col+1))}</option>)}</select></label>)}</div><button className="btn" type="button" onClick={prepare}>خواندن با ستون‌های انتخاب‌شده</button></details></>}
 {financeSheet&&<div className="notice"><strong>فهرست اقلام پرمصرف مالی · {rows.length.toLocaleString('fa-IR')} قلم</strong>
 <p>برگهٔ اقلام پرمصرف با فهرست اصلی فایل تطبیق داده شد. موارد ناقص و مغایر برای پیگیری دستی کنار می‌مانند.</p>
 {preview&&<><p>{preview.newMaterialCount.toLocaleString('fa-IR')} جدید · {preview.linkedCount.toLocaleString('fa-IR')} اتصال به پروندهٔ موجود · {preview.existingCount.toLocaleString('fa-IR')} از قبل ثبت‌شده · {preview.excludedCount.toLocaleString('fa-IR')} کنارگذاشته‌شده</p>
 <ImportResultList label="موارد کنارگذاشته‌شده برای پیگیری دستی" changes={preview.changes.filter((change:ImportResultRow)=>change.status==='excluded')}/>
 <ImportResultList label="موارد آمادهٔ ثبت" changes={preview.changes.filter((change:ImportResultRow)=>['new','link'].includes(change.status))}/>
 {!preview.newMaterialCount&&!preview.linkedCount&&<p>ردیف تازه‌ای برای ثبت پیدا نشد.</p>}</>}
 </div>}
 {!financeSheet&&rows.length>0&&<><p>{rows.length} قلم · ردیف‌ها قابل ویرایش‌اند.</p><div className="material-catalog-import__table"><table className={'stocktable'+(accounting?' material-catalog-import__accounting':'')}><thead><tr><th>{accounting?'کد حسابداری':'کد کالا'}</th><th>نام کالا</th><th>واحد</th>{accounting&&<><th>کد هم‌نفس موجود</th><th>کالای جدید</th></>}</tr></thead><tbody>{rows.map((row,index)=>{
 const result=accounting?preview?.changes?.[index]:undefined;
 return <Fragment key={index}><tr ref={firstIssue?.row===index+1?firstIssueRow:undefined}><td><input aria-label={'کد قلم '+(index+1)} dir="ltr" value={row.code} onChange={e=>edit(index,'code',e.target.value)}/></td><td><input aria-label={'نام قلم '+(index+1)} value={row.name} onChange={e=>edit(index,'name',e.target.value)}/></td><td><select aria-label={'واحد قلم '+(index+1)} value={row.unit} onChange={e=>edit(index,'unit',e.target.value)}><option value="">انتخاب واحد</option>{accounting&&row.unit&&!materialUnits.includes(row.unit)&&<option value={row.unit}>{row.unit} (نیازمند بررسی)</option>}{materialUnits.map(unit=><option key={unit}>{unit}</option>)}</select></td>{accounting&&<>
 <td><input aria-label={'کد هم‌نفس موجود قلم '+(index+1)} dir="ltr" inputMode="numeric" maxLength={12} value={row.existingCode||''} disabled={row.createNew} onChange={e=>edit(index,'existingCode',e.target.value)}/></td>
 <td><input type="checkbox" aria-label={'کالای جدید قلم '+(index+1)} disabled={!!row.existingCode} checked={row.createNew===true} onChange={e=>edit(index,'createNew',e.target.checked)}/></td>
 </>}</tr>{result&&<tr className="material-catalog-import__result" data-review={result.status==='review'||undefined}><td colSpan={5}>{result.message}{result.internalCode&&<> · <bdi>{result.internalCode}</bdi> · {result.name}</>}</td></tr>}</Fragment>;
 })}</tbody></table></div></>}
 {!financeSheet&&preview&&<div className="notice"><p>{preview.newMaterialCount} کالای جدید · {preview.existingCount} بدون تغییر{accounting?<> · {preview.linkedCount} اتصال به پروندهٔ موجود · {preview.duplicateCount} تکراری در فایل · {preview.skippedCount} بدون کد حسابداری</>:'؛ شناسنامه‌های موجود تغییر نمی‌کنند.'}</p>{(!accounting||!firstIssue)&&preview.errors.map((s:string,i:number)=><p role="alert" key={i}>{s}</p>)}{preview.warnings.map((s:string,i:number)=><p key={i}>{s}</p>)}</div>}</fieldset>
 {message&&<p role="status" className="notice">{message}</p>}
 <ImportResultList label="موارد کنارگذاشته‌شده برای پیگیری دستی" changes={savedExclusions}/></div>
 <footer className="material-catalog-import__footer">
 {error&&<p role="alert" className="notice error" style={{whiteSpace:'pre-wrap'}}>{error}</p>}
 {!busy&&firstIssue&&<div role="status" className="notice error">
 <strong>{preview.errors.length.toLocaleString('fa-IR')} ردیف نیاز به اصلاح دارد.</strong>
 <p>ردیف {Number(firstIssue.row).toLocaleString('fa-IR')} · <bdi>{firstIssue.accountingCode}</bdi> · {firstIssue.message}</p><button type="button" className="btn" onClick={()=>{firstIssueRow.current?.scrollIntoView({block:'center',inline:'nearest'});firstIssueRow.current?.querySelector('input')?.focus({preventScroll:true});}}>رفتن به این ردیف</button>
 </div>}
 {busy?<p role="status">در حال بررسی…</p>:rows.length>0&&!uncertain&&!firstIssue&&<p role="status">{preview?preview.errors.length?'خطاهای مشخص‌شده را اصلاح و فایل را دوباره بررسی کنید.':(accounting?'نتیجهٔ تطبیق را بررسی و ثبت را تأیید کنید.':preview.newMaterialCount+' کالای جدید آماده ورود است؛ برای ثبت، دکمه تأیید را بزنید.'):'ابتدا «بررسی فایل» و سپس «تأیید و ورود کالاها به سیستم» را بزنید.'}</p>}
 <div className="material-catalog-import__actions">
 {rows.length>0&&!uncertain&&<><button type="button" className="btn" disabled={busy} onClick={()=>void run()}>بررسی فایل</button><button type="button" className="btn primary" disabled={busy||!preview||!!preview.errors.length||!!financeSheet&&!preview.newMaterialCount&&!preview.linkedCount} onClick={()=>void run(true)}>تأیید و ورود کالاها به سیستم</button></>}
 {uncertain&&<button type="button" className="btn primary" disabled={busy} onClick={()=>void run(true)}>بررسی مجدد همین ثبت</button>}
 {!rows.length&&!uncertain&&<button data-pair-open="material-catalog-import:1cf04d3fccb4" type="button" className="btn" disabled={busy} onClick={()=>setOpen(false)}>بستن</button>}
 </div></footer>
 </DialogContent></Dialog></>;
}
