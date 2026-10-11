'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {IconActions,IconDisclosure} from './program-workspace';
import {SolarDate} from './solar-date';
import {MoneyInput} from './money-input';
import {formatDate,localDay} from '@/lib/persian-date';
import {visiblePartRepairFields,partRepairActions,partRepairStates} from '@/lib/part-repair-contract';

const money=(v:any)=>v===null||v===undefined?'ثبت نشده':BigInt(v).toLocaleString('fa-IR')+' ریال';
const date=(v:string)=>v?formatDate(v):'—';
export function PartRepairsPanel({domain,accountId}:{domain:string;accountId:string}){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[draft,setDraft]=useState<any>(null),[search,setSearch]=useState(''),[state,setState]=useState('');
 const scope=domain+':'+accountId,current=useRef(scope),sequence=useRef(0),generation=useRef(0),operation=useRef<{scope:string;payload:string}|null>(null);current.current=scope;
 async function refresh(){const n=++sequence.current,s=scope;try{const r=await fetch('/api/after-sales/part-repairs?domain='+domain,{cache:'no-store'}),v:any=await r.json();if(current.current!==s||n!==sequence.current)return;if(!r.ok)throw Error(v.error||'خواندن پرونده‌ها انجام نشد.');setData({...v,scope:s});setError('');}catch(e){if(current.current===s&&n===sequence.current)setError((e as Error).message);}}
 useEffect(()=>{generation.current++;setBusy(false);setData(null);setDraft(null);setError('');setSearch('');setState('');operation.current=null;void refresh();return()=>{sequence.current++};},[scope]);
 const info=data?.scope===scope?data:null;
 function start(mode:string,row?:any){operation.current=null;setError('');setDraft({mode,repairId:row?.id,revision:row?.revision||0,day:localDay(),requestedAction:'repair',decision:'return',coverage:'warranty',originalDisposition:'hold',replacementPartCode:row?.data.partCode||'',approved:false,method:'phone',scope});}
 function update(key:string,value:any){operation.current=null;setDraft((d:any)=>({...d,[key]:value}));}
 async function submit(e:FormEvent){e.preventDefault();if(busy||draft?.scope!==scope)return;setBusy(true);setError('');const s=scope,g=generation.current;
  const {scope:_scope,...body}=draft;const payload=operation.current?.scope===s?operation.current.payload:JSON.stringify({...body,id:crypto.randomUUID(),domain,confirmed:true});operation.current={scope:s,payload};
  try{const r=await fetch('/api/after-sales/part-repairs',{method:'POST',headers:{'Content-Type':'application/json'},body:payload}),v:any=await r.json();if(current.current!==s||generation.current!==g)return;if(!r.ok)throw Error(v.error||'ثبت انجام نشد.');setDraft(null);operation.current=null;await refresh();}catch(e){if(current.current===s&&generation.current===g)setError((e as Error).message);}finally{if(current.current===s&&generation.current===g)setBusy(false);}
 }
 if(!info)return <div><p>{error||'در حال دریافت قطعات تعمیری…'}</p><button className="btn" onClick={()=>void refresh()}>تلاش دوباره</button></div>;
 const options:Record<string,any[]>={agents:info.agents.map((a:any)=>[a.id,a.name]),materials:info.materials.map((m:any)=>[m.code,m.name+' · '+m.code]),technicians:info.technicians.map((t:any)=>[t.id,t.name]),lots:info.lots.filter((l:any)=>l.partCode===info.rows.find((r:any)=>r.id===draft?.repairId)?.data.review?.partCode).map((l:any)=>[l.id,l.name+' · بچ '+l.code+' · آزاد '+(l.free/1000).toLocaleString('fa-IR')])};
 const fields=visiblePartRepairFields(draft?.mode,draft||{}).filter(f=>f.key!=='repairId');
 const rows=info.rows.filter((r:any)=>(!state||r.data.state===state)&&[r.data.partName,r.data.serial,r.data.receiptCode,r.data.agentName].join(' ').toLocaleLowerCase().includes(search.toLocaleLowerCase()));
 return <section><h3>قطعات تعمیری نمایندگان</h3><p className="subtle">هر رسید برای یک قطعه است. اطلاعات دریافت، اقدام و ارسال در مرحلهٔ مربوط تکمیل می‌شود.</p>
  <IconActions scope="representative-part-repairs-actions">{info.canCreate&&<button className="btn primary" onClick={()=>start('create')}>دریافت قطعهٔ نماینده</button>}<button className="btn" disabled={busy} onClick={()=>void refresh()}>تازه‌سازی</button></IconActions>
  <div className="formgrid"><label className="field">جست‌وجوی رسید، قطعه، سریال یا نماینده<input value={search} onChange={e=>setSearch(e.target.value)}/></label><label className="field">وضعیت<select value={state} onChange={e=>setState(e.target.value)}><option value="">همه</option>{Object.entries(partRepairStates).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></div>
  {error&&<p role="alert" className="notice">{error}</p>}
  {!rows.length&&<p className="empty">قطعه‌ای با این شرایط ثبت نشده است.</p>}
  <div className="as-grid">{rows.map((r:any)=>{const d=r.data;return <article className="flow-card" key={r.id}><h3>{d.partName} · {d.agentName}</h3><p>{d.receiptCode} · سریال: {d.serial||'ندارد / ناخوانا'}</p><p><strong>{partRepairStates[d.state]}</strong></p><p>اقدام مورد نیاز: {({repair:'تعمیر',program:'پروگرم',test:'تست'} as Record<string,string>)[d.requestedAction]}</p>
    <p>دریافت: {date(d.receivedDay)} · انجام: {date(d.doneDay)} · ارسال: {date(d.sentDay)}</p><p>تکنسین: {d.technicianName||'تعیین نشده'}</p>
    {d.review?.decision==='replace'&&<p>قطعهٔ نو: {d.review.partCode} · {d.review.coverage==='warranty'?'گارانتی — هزینه با شرکت':money(d.review.priceRial)}{d.consent?.approved===false?' · هزینه پذیرفته نشد؛ عودت همان قطعه':''}</p>}
    <IconActions scope={'part-repair:'+r.id}>{r.actions.map((mode:string)=><button className="btn" key={mode} onClick={()=>start(mode,r)}>{partRepairActions[mode]}</button>)}</IconActions>
    <IconDisclosure scope={'part-repair-details:'+r.id} title="جزئیات و رهگیری"><p>شرح درخواست: {d.requestNotes||'—'}</p><p>اقدامات انجام شده: {d.performedActions||'—'}</p><p>نتیجهٔ تست: {d.testResult||'—'}</p>{d.review&&<p>تصمیم مسئول خدمات: {d.review.reason} · {d.review.byName}</p>}{d.consent&&<p>پاسخ نماینده: {d.consent.approved?'پذیرفت':'نپذیرفت'} · {d.consent.person} · {d.consent.notes}</p>}
    {d.replacement&&<p>قطعهٔ جایگزین: {d.replacement.partName} · سریال: {d.replacement.serial||'ثبت نشده'} · بچ: {d.replacement.batchCode}</p>}{d.originalDisposition&&<p>قطعهٔ قبلی: {d.originalDisposition==='hold'?'امانی در شرکت با همین رسید نگهداری می‌شود':'به نماینده برمی‌گردد'}</p>}
    <p>حامل: {d.carrier||'—'} · بارنامه / رسید ارسال: {d.shippingReference||'—'} · باربری: {money(d.freightRial)}</p><p>دریافت نماینده: {date(d.deliveredDay)} · {d.receivedBy||'—'} · {d.receiptReference||'—'}</p>
    {d.history.map((h:any,i:number)=><p key={i}>{date(h.at)} · {partRepairActions[h.mode]} · {h.byName} {h.notes?' · '+h.notes:''}</p>)}</IconDisclosure>
   </article>})}</div>
  <Dialog open={!!draft&&draft.scope===scope} onOpenChange={v=>{if(!v&&!busy){setDraft(null);operation.current=null}}}><DialogContent className="as-dialog part-repair-dialog" dir="rtl"><DialogTitle>{partRepairActions[draft?.mode]||'قطعات تعمیری'}</DialogTitle><DialogDescription>اطلاعات این مرحله را براساس اقدام واقعی ثبت کنید.</DialogDescription>{draft&&<form onSubmit={submit}><div className="formgrid">{fields.map(f=>f.type==='date'?<SolarDate key={f.key} label={f.label} value={draft[f.key]||''} onChange={v=>update(f.key,v)} required={!f.optional}/>:f.type==='boolean'?<label className="field" key={f.key}><span><input type="checkbox" checked={draft[f.key]===true} onChange={e=>{update(f.key,e.target.checked);if(f.key==='noSerial'&&e.target.checked)update('serial','')}}/> {f.label}</span></label>:<label className={'field'+(f.type==='textarea'?' wide':'')} key={f.key}>{f.label}{f.optional?' (اختیاری)':''}{f.type==='select'?<select required={!f.optional} value={draft[f.key]||''} onChange={e=>update(f.key,e.target.value)}><option value="">انتخاب کنید</option>{(f.options||options[f.source||'']||[]).map((o:any)=><option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>:f.type==='textarea'?<textarea required={!f.optional} maxLength={4000} value={draft[f.key]||''} onChange={e=>update(f.key,e.target.value)}/>:f.type==='money'?<MoneyInput required={!f.optional} value={draft[f.key]} onChange={v=>update(f.key,v)}/>:<input required={!f.optional} maxLength={200} value={draft[f.key]||''} onChange={e=>update(f.key,e.target.value)}/>}</label>)}</div>
   {draft.mode==='review'&&draft.decision==='replace'&&<p className="notice">دلیل تصمیم و بررسی گارانتی را ثبت کنید. {draft.coverage==='paid'?'مبلغ از تعرفهٔ مصوب قطعه تعیین می‌شود و پیش از برداشت انبار برای پذیرش نماینده می‌رود.':'هزینهٔ قطعهٔ نو بر عهدهٔ شرکت خواهد بود.'}</p>}
   {draft.mode==='consent'&&<p className="notice">مبلغ قطعهٔ نو: {money(info.rows.find((r:any)=>r.id===draft.repairId)?.data.review.priceRial)}. خاموش بودن تأیید یعنی عدم پذیرش هزینه و برگشت قطعهٔ قبلی.</p>}
   {draft.mode==='issue'&&!options.lots.length&&<p className="notice">قطعهٔ نو در موجودی آزاد دفتر یافت نشد؛ ابتدا انبار خدمات را تأمین کنید.</p>}
   {error&&<p role="alert">{error}</p>}<button className="btn primary" disabled={busy}>{busy?'در حال ثبت…':'تأیید و ثبت این مرحله'}</button></form>}</DialogContent></Dialog>
 </section>;
}
