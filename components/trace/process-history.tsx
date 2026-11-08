'use client';
import {useEffect,useState} from 'react';
import {materialProcesses,type ProcessRow} from '@/lib/process-history';
import {formatDateTime} from '@/lib/persian-date';
import {tehranDay} from '@/lib/serials';
import {SolarDate} from './solar-date';

const titles:Record<string,string>={...materialProcesses,'task:duty':'وظایف سازمانی','task:flow':'گردش مواد','task:sourcing':'تأمین','task:transport':'حمل‌ونقل','task:fulfillment':'ارسال و تحویل محصول','task:sales':'فروش','task:qms':'مدیریت کیفیت'};
const title=(key:string)=>titles[key]||(/^line[\s_-]*receipt$/i.test(key)?materialProcesses.lineReceipt:'سایر کارهای فرایندی');
const normalize=(value:string)=>value.toLowerCase().replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/‌/g,' ').trim();
type Row=ProcessRow&{task?:unknown};
const num=(v:number|undefined)=>v==null?'—':v.toLocaleString('fa-IR');
const fields:Record<string,[keyof Row,string][]>={
 issue:[['material','کالا'],['place','انبار یا خط مقصد'],['batches','بچ']],
 lineReceipt:[['material','کالا'],['place','انبار یا خط مقصد'],['batches','بچ'],['actor','تأییدکننده']],
 receipt:[['material','کالا'],['place','انبار مقصد'],['supplier','تأمین‌کننده'],['order','سفارش'],['batches','بچ']],
 quality:[['material','کالا'],['batches','بچ'],['actor','بازرس']],
 placement:[['material','کالا'],['batches','بچ'],['place','انبار یا قفسه']],
};
export function ProcessHistory({waiting,revision,onOpen}:{waiting:boolean;revision:unknown;onOpen:(row:Row)=>void}){
 const [rows,setRows]=useState<Row[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const [dateBasis,setDateBasis]=useState('sent');
 const [process,setProcess]=useState(''),[query,setQuery]=useState(''),[start,setStart]=useState(''),[end,setEnd]=useState(''),[status,setStatus]=useState(''),[extra,setExtra]=useState<Record<string,string>>({}),[page,setPage]=useState(0);
 useEffect(()=>{
  const abort=new AbortController();
  setLoading(true);setError('');setRows([]);
  void fetch('/api/tasks?view=process-history',{cache:'no-store',signal:abort.signal}).then(async response=>{
   const result=await response.json() as {rows?:Row[];error?:string};
   if(!response.ok)throw new Error(result.error||'دریافت سوابق انجام نشد.');
   if(!abort.signal.aborted)setRows(result.rows||[]);
  }).catch(e=>{if(!abort.signal.aborted)setError(e.message)}).finally(()=>{if(!abort.signal.aborted)setLoading(false)});
  return ()=>abort.abort();
 },[revision,waiting]);
 const list=rows.filter(row=>!waiting||row.waiting);
 const types=[...new Set(list.map(row=>row.process))];
 const statuses=[...new Set(list.filter(row=>!process||row.process===process).map(row=>row.status))];
 const invalid=!!(start&&end&&start>end);
 const filtered=invalid?[]:list.filter(row=>{
  const date=process==='issue'&&dateBasis==='received'?row.receivedAt:row.date;
  if(!date)return false;
  const day=date.length===10?date:tehranDay(new Date(date));
  return (!process||row.process===process)&&(!status||row.status===status)&&(!start||day>=start)&&(!end||day<=end)
   &&normalize(query).split(/\s+/).every(word=>normalize([row.title,row.reference,row.material,row.batches,row.place,row.actor,row.supplier,row.order].filter(Boolean).join(' ')).includes(word))
   &&(fields[process]||[]).every(([key])=>normalize(String(row[key]??'')).includes(normalize(extra[key]||'')));
 });
 const totals=new Map<string,{material:string;unit:string;sent:number;received:number}>();
 if(process==='issue')for(const row of filtered){
  const material=row.material||row.title,unit=row.unit||'',key=JSON.stringify([material,unit]);
  const item=totals.get(key)||{material,unit,sent:0,received:0};
  item.sent+=row.quantity||0;item.received+=row.received||0;totals.set(key,item);
 }
 async function download(){
  try{
   const XLSX=await import('xlsx'),book=XLSX.utils.book_new();
   XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([
    ['فرایند','تاریخ رویداد','تاریخ تأیید خط','شرح','شماره پرونده','کالا','بچ','محل','مسئول','تأمین‌کننده','سفارش','وضعیت','مقدار','دریافت خط','واحد'],
    ...filtered.map(r=>[title(r.process),formatDateTime(r.date),r.receivedAt?formatDateTime(r.receivedAt):'',r.title,r.reference,r.material,r.batches,r.place,r.actor,r.supplier,r.order,r.status,r.quantity,r.received,r.unit]),
   ]),'نتایج');
   if(totals.size)XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['کالا','واحد','ارسال','تأیید دریافت'],...[...totals.values()].map(r=>[r.material,r.unit,r.sent,r.received])]),'خلاصه');
   XLSX.writeFile(book,'سوابق کارتابل.xlsx');
  }catch{setError('ساخت خروجی اکسل انجام نشد.')}
 }
 const textField=(label:string,value:string,change:(value:string)=>void)=><label className="field" key={label}>{label}<input value={value} onChange={e=>{change(e.target.value);setPage(0)}}/></label>;
 const shownPage=Math.min(page,Math.max(0,Math.ceil(filtered.length/25)-1));
 return <section className="process-history">
  <div className="formgrid" lang="fa" translate="no">
   <label className="field">نوع فرایند<select value={process} onChange={e=>{setProcess(e.target.value);setExtra({});setStatus('');setPage(0)}}><option value="">همهٔ فرایندها</option>{types.map(key=><option key={key} value={key}>{title(key)}</option>)}</select></label>
   {textField('جست‌وجوی عنوان، کالا، بچ یا شماره پرونده',query,setQuery)}
   {process==='issue'&&!waiting&&<label className="field">مبنای تاریخ<select value={dateBasis} onChange={e=>{setDateBasis(e.target.value);setPage(0)}}><option value="sent">ارسال از انبار</option><option value="received">تأیید دریافت در خط</option></select></label>}
   <SolarDate required={false} label="از تاریخ" value={start} onChange={v=>{setStart(v);setPage(0)}}/>
   <SolarDate required={false} label="تا تاریخ" value={end} onChange={v=>{setEnd(v);setPage(0)}}/>
   <label className="field">وضعیت<select value={status} onChange={e=>{setStatus(e.target.value);setPage(0)}}><option value="">همهٔ وضعیت‌ها</option>{statuses.map(s=><option key={s}>{s}</option>)}</select></label>
   {(fields[process]||[]).map(([key,label])=>textField(label,extra[key]||'',v=>setExtra(old=>({...old,[key]:v}))))}
  </div>
  {error&&<p role="alert" className="notice error">{error}</p>}
  {invalid&&<p role="alert">تاریخ پایان باید برابر یا بعد از تاریخ شروع باشد.</p>}
  {loading?<p role="status">در حال دریافت سوابق…</p>:<>
   <div className="tools"><span>{num(filtered.length)} نتیجه</span><button className="btn" type="button" disabled={!filtered.length} onClick={()=>void download()}>خروجی اکسل</button></div>
   {totals.size>0&&<details open><summary>جمع تحویل به تفکیک کالا</summary>{[...totals.values()].map(r=><p key={JSON.stringify([r.material,r.unit])}>{r.material} · ارسال {num(r.sent)} {r.unit} · تأیید دریافت {num(r.received)} {r.unit}</p>)}</details>}
   {filtered.slice(shownPage*25,(shownPage+1)*25).map(row=><article className="flow-card" key={row.id}>
    <h3>{row.title}</h3><p><span lang="fa" translate="no">{title(row.process)}</span> · {formatDateTime(row.date)} · {row.status}</p>
    {row.receivedAt&&<p>تأیید دریافت خط · {formatDateTime(row.receivedAt)}</p>}
    <p>{[row.reference,row.batches,row.place,row.actor,row.supplier,row.order].filter(Boolean).join(' · ')}</p>
    {row.quantity!=null&&<p>مقدار {num(row.quantity)} {row.unit}{row.process==='issue'&&row.received!=null&&' · دریافت خط '+num(row.received)}</p>}
    {(row.task||row.section)&&<button type="button" className="btn" onClick={()=>onOpen(row)}>مشاهدهٔ پرونده</button>}
   </article>)}
   {filtered.length>25&&<div className="tools"><button type="button" className="btn" disabled={!shownPage} onClick={()=>setPage(shownPage-1)}>صفحهٔ قبل</button><button type="button" className="btn" disabled={(shownPage+1)*25>=filtered.length} onClick={()=>setPage(shownPage+1)}>صفحهٔ بعد</button></div>}
  </>}
 </section>;
}
