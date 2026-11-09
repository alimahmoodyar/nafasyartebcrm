"use client";
import {useEffect,useState} from 'react';
import {returnActions,type ReturnAction} from '@/lib/sales-return-contract';
import {formatDate} from '@/lib/persian-date';

const checked=['review','inspect','quality'];
const scanned=['waybill','pickup','inspect','handback','factory','line','pack'];
const references:Record<string,string>={waybill:'شماره بارنامه',pickup:'شماره رسید تحویل به خدمات',handback:'مرجع تحویل مجدد به نماینده',refund:'شماره مرجع پرداخت قطعی'};
const notes:Record<string,string>={review:'شرح تماس و علت احتمالی برگشت',inspect:'گزارش کامل بررسی حضوری و علت خرابی',technical:'علت ریشه‌ای و تصمیم درباره اقدام اصلاحی',repair:'شرح تعمیر یا تعویض و نتیجه',quality:'نتایج آزمون و علت مردودی در صورت وجود'};
const prompts:Record<string,string>={settle:'با تأیید، تا سقف بدهی از حساب نماینده کم می‌شود و مازاد به مالی ارجاع می‌شود.',reserve:'یک دستگاه سالم از همین مدل رزرو می‌شود. موجودی ناموجود در کارتابل باز می‌ماند.',dispatch:'حوالهٔ جایگزین برای ارسال جداگانه به انبار ارجاع می‌شود.'};

export function SalesReturnPanel({targetId='',demo=false}:{targetId?:string;demo?:boolean}){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [action,setAction]=useState<{row:any;mode:ReturnAction;id:string;fileId?:string}|null>(null);
 async function load(){
  try{
   const response=await fetch('/api/sales/returns'+(targetId?'?id='+encodeURIComponent(targetId):''),{cache:'no-store'});
   const value=await response.json() as {items:any[];warehouses:any[];error?:string};
   if(!response.ok)throw Error(value.error);
   setData(value);
  }catch(e){setError((e as Error).message);}
 }
 useEffect(()=>{if(!demo)void load();},[targetId,demo]);
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!action||busy||demo)return;
  setBusy(true);setError('');
  const {row,mode,id}=action,fields=new FormData(event.currentTarget);
  const body={...Object.fromEntries(fields),mode,id,returnId:row.id,revision:row.revision,confirmed:true,approved:fields.get('approved')==='yes',packed:fields.get('packed')==='on'} as Record<string,unknown>;
  delete body.file;
  try{
   if(mode==='waybill'){
    let fileId=action.fileId;
    if(!fileId){
     const file=fields.get('file');if(!(file instanceof File)||!file.size)throw Error('فایل بارنامه را انتخاب کنید.');
     const upload=new FormData();
     upload.append('metadata',JSON.stringify({id:crypto.randomUUID(),confirmed:true,title:'بارنامه مرجوعی',agentId:row.agentId,returnId:row.id}));
     upload.append('file',file);
     const saved=await fetch('/api/sales/files',{method:'POST',body:upload}),result=await saved.json() as {id:string;error?:string};
     if(!saved.ok)throw Error(result.error);
     fileId=result.id;setAction({...action,fileId});
    }
    body.fileId=fileId;
   }
   const response=await fetch('/api/sales/returns',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   if(!response.ok)throw Error((await response.json() as {error:string}).error);
   setAction(null);await load();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 if(demo)return <p className="notice">برای مشاهده پرونده مرجوعی، محیط شرکت یا آزمایش نقش را باز کنید.</p>;
 return <section className="panel"><div className="panelhead"><h2>مرجوعی دستگاه</h2><button type="button" className="btn" disabled={busy} onClick={()=>{setError('');void load();}}>تازه‌سازی</button></div>
 <div className="inside">{error&&<p className="notice error" role="alert">{error}</p>}{data&&!data.items.length&&<p className="empty">پرونده‌ای در این کارتابل پیدا نشد.</p>}
 {data?.items.map((row:any)=><article className="flow-card" key={row.id}>
  <h3>{row.buyer} · <bdi>{row.serial}</bdi></h3><p>{row.status} · {row.resolution==='replacement'?'دستگاه جایگزین':'عودت وجه'}</p><p>{row.reason}</p>
  {row.waybill&&<p>بارنامه <bdi>{row.waybill.number}</bdi> · <a className="link" href={'/api/sales/files?id='+encodeURIComponent(row.waybill.fileId)}>{row.waybill.filename}</a></p>}
  {row.inspection&&<p>گزارش خدمات: {row.inspection.report}</p>}
  {row.technical&&<p>تصمیم فنی: {row.technical.action}{row.technical.personnel&&<> · پیگیری داخلی: {row.technical.personnel}</>}</p>}
  {row.settlement&&<p>کسر از بدهی {Number(row.settlement.offset).toLocaleString('fa-IR')} ریال · پرداخت مازاد {Number(row.settlement.payable).toLocaleString('fa-IR')} ریال {row.settlement.paidAt?'(پرداخت شد)':''}</p>}
  <div className="tools">{row.actions.map((mode:ReturnAction)=><button key={mode} type="button" className="btn" disabled={busy} onClick={()=>{setError('');setAction({row,mode,id:crypto.randomUUID()});}}>{returnActions[mode]}</button>)}</div>
  {action&&action.row.id===row.id&&<form key={action.id} className="formgrid" onSubmit={submit}>
   <h4 className="wide">{returnActions[action.mode]}</h4>
   {scanned.includes(action.mode)&&<label className="field">سریال دستگاه<input name="serial" dir="ltr" required autoFocus /></label>}
   {checked.includes(action.mode)&&<label className="field">نتیجه<select name="approved" required defaultValue=""><option value="">انتخاب کنید</option><option value="yes">تأیید</option><option value="no">رد</option></select></label>}
   {action.mode==='refund'&&<label className="field">مبلغ پرداخت‌شده، ریال<input name="paidAmount" inputMode="numeric" pattern="[0-9]+" required defaultValue={row.settlement.payable}/></label>}
   {references[action.mode]&&<label className="field">{references[action.mode]}<input name="reference" required maxLength={200}/></label>}
   {action.mode==='waybill'&&<label className="field">فایل بارنامه<input name="file" type="file" required={!action.fileId} accept=".pdf,.png,.jpg,.jpeg"/></label>}
   {action.mode==='factory'&&<label className="field">انبار کارخانه<select name="warehouseId" required defaultValue=""><option value="">انتخاب کنید</option>{data.warehouses.map((w:any)=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}
   {action.mode==='repair'&&<><label className="field">نام یا کد قطعه<input name="part" required maxLength={200}/></label><label className="field">اقدام<select name="method" required><option value="repair">تعمیر</option><option value="replace">تعویض</option></select></label></>}
   {notes[action.mode]&&<label className="field wide">{notes[action.mode]}<textarea name="notes" required maxLength={4000}/></label>}
   {action.mode==='technical'&&<label className="field wide">رسیدگی داخلی به خطای انسانی، در صورت نیاز<textarea name="personnel" maxLength={4000}/></label>}
   {action.mode==='pack'&&<label className="flow-check"><input type="checkbox" name="packed" required/>بسته‌بندی و لیبل سریال کنترل شد</label>}
   {prompts[action.mode]&&<p className="wide notice">{prompts[action.mode]}</p>}
   <div className="tools"><button type="submit" className="btn primary" disabled={busy}>تأیید و ثبت</button><button type="button" className="btn" disabled={busy} onClick={()=>setAction(null)}>بازگشت</button></div>
  </form>}
 </article>)}</div></section>;
}

export function DeviceSalesReturnHistory({deviceId}:{deviceId:string}){
 const [history,setHistory]=useState<any[]>([]);
 useEffect(()=>{
  const abort=new AbortController();
  setHistory([]);
  fetch('/api/sales/returns?device='+encodeURIComponent(deviceId),{signal:abort.signal,cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{if(d)setHistory((d as {history:any[]}).history||[]);}).catch(()=>{});
  return ()=>abort.abort();
 },[deviceId]);
 if(!history.length)return null;
 return <div className="detailsection"><h2>سابقه مرجوعی و تعمیر</h2>{history.map(row=><article key={row.id} className="flow-card">
  <h3>{row.status} · {formatDate(row.openedAt)}</h3><p>{row.reason}</p>
  {row.serviceReport&&<p>گزارش خدمات: {row.serviceReport}</p>}{row.technicalResult&&<p>نتیجه فنی: {row.technicalResult}</p>}
  {row.repairs.map((r:any,i:number)=><p key={i}>{r.method==='replace'?'تعویض':'تعمیر'} {r.part} · {r.report}</p>)}
  {row.quality.map((r:any,i:number)=><p key={i}>کنترل کیفیت {r.passed?'قبول':'مردود'} · {r.report}</p>)}
  {row.restockedAt&&<p>بازگشت به موجودی قابل فروش: {formatDate(row.restockedAt)}</p>}
 </article>)}</div>;
}
