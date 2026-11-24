'use client';
import {useMemo,useState,type ChangeEvent} from 'react';
import {formatDateTime} from '@/lib/persian-date';
import {legacyActivationChunkSize,legacyActivationWarnings,parseLegacyWorkbook,type LegacyActivation,type LegacyAgency,type LegacyPreview,type LegacySalesAgent} from '@/lib/legacy-activation-import';

type Parsed=ReturnType<typeof parseLegacyWorkbook>;
type SavedRow={event:LegacyActivation;file:string;importedAt:string;salesName:string};
type ResultRow={row:LegacyActivation;comparison:LegacyPreview|undefined;alternatives?:LegacyActivation[]};
const displayCount=(n:number)=>n.toLocaleString('fa-IR');
const split=(rows:LegacyActivation[])=>Array.from({length:Math.ceil(rows.length/legacyActivationChunkSize)},(_,i)=>rows.slice(i*legacyActivationChunkSize,(i+1)*legacyActivationChunkSize));
const summary=(row:LegacyActivation)=>[
 row.activeDate.replace('T',' ').replace('Z',''),
 row.serial?'سریال '+row.serial:'سریال کامل ندارد',
 row.status?'وضعیت '+row.status:'',
 row.channel?'کانال '+row.channel:'',
 row.setId?'شناسه ساخت '+row.setId:'',
 row.setSerial?'سریال ساخت '+row.setSerial:'',
 row.deviceSetSerial?'سریال ست '+row.deviceSetSerial:'',
 row.agencyId?'شناسه نمایندگی '+row.agencyId:'',
].filter(Boolean).join(' · ');
function nameKey(name:string){return name.replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\s\u200c]+/g,'').toLowerCase();}

export function LegacyActivationPanel({accountId}:{accountId:string}){
 const [file,setFile]=useState(''),[parsed,setParsed]=useState<Parsed|null>(null);
 const [known,setKnown]=useState(new Map<string,LegacyPreview>());
 const [sales,setSales]=useState<LegacySalesAgent[]>([]),[links,setLinks]=useState<LegacyAgency[]>([]);
 const [agency,setAgency]=useState(''),[sale,setSale]=useState('');
 const [busy,setBusy]=useState(false),[working,setWorking]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [filter,setFilter]=useState<'conflicts'|'warnings'|'new'|'same'>('conflicts'),[page,setPage]=useState(1);
 const [history,setHistory]=useState<{rows:SavedRow[];more:boolean}|null>(null),[historyQuery,setHistoryQuery]=useState(''),[historyPage,setHistoryPage]=useState(1);
 const [checked,setChecked]=useState(false),[committed,setCommitted]=useState(0);
 const salesById=useMemo(()=>new Map(sales.map(item=>[item.id,item])),[sales]);
 const linksById=useMemo(()=>new Map(links.map(item=>[item.id,item])),[links]);
 const agencies=useMemo(()=>{
  const grouped=new Map<string,{id:string;names:Set<string>;codes:Set<string>;count:number}>();
  for(const row of (parsed?[...parsed.events,...Array.from(parsed.conflicts.values()).flat()]:[])){
   if(!row.agencyId)continue;
   let item=grouped.get(row.agencyId);
   if(!item){item={id:row.agencyId,names:new Set(),codes:new Set(),count:0};grouped.set(row.agencyId,item);}
   if(row.agencyName)item.names.add(row.agencyName);
   if(row.agencyCode)item.codes.add(row.agencyCode);
   item.count++;
  }
  return [...grouped.values()].sort((a,b)=>([...a.names][0]||a.id).localeCompare([...b.names][0]||b.id,'fa'));
 },[parsed]);
 const selected=agencies.find(item=>item.id===agency),activeLink=linksById.get(agency);
 const suggested=selected?sales.filter(item=>selected.codes.has(item.code)||[...selected.names].some(name=>nameKey(name)===nameKey(item.name))):[];
 const stats=useMemo(()=>{
  const groups={conflicts:[] as ResultRow[],warnings:[] as ResultRow[],new:[] as ResultRow[],same:[] as ResultRow[]};
  for(const alternatives of parsed?.conflicts.values()||[])
   groups.conflicts.push({row:alternatives[0],comparison:undefined,alternatives:alternatives.slice(1)});
  for(const row of parsed?.events||[]){
   const comparison=known.get(row.activeId),entry={row,comparison};
   groups[comparison?.status==='conflict'?'conflicts':comparison?.status==='same'?'same':'new'].push(entry);
   if(legacyActivationWarnings(row).length)groups.warnings.push(entry);
  }
  return groups;
 },[parsed,known]);
 const choices=stats[filter],pages=Math.max(1,Math.ceil(choices.length/25));
 const currentPage=Math.min(page,pages);

 async function request<T>(suffix='',body?:unknown):Promise<T>{
  const r=await fetch('/api/legacy-activations'+suffix,{cache:'no-store',headers:{'x-assistant-account':accountId,...(body?{'Content-Type':'application/json'}:{})},
   ...(body?{method:'POST',body:JSON.stringify(body)}:{})});
  const d=await r.json() as T&{error?:string};
  if(!r.ok)throw Error(d.error||'درخواست انجام نشد.');
  return d as T;
 }
 async function readDirectory(){
  const directory=await request<{sales:LegacySalesAgent[];links:LegacyAgency[]}>();
  setSales(directory.sales);setLinks(directory.links);
 }
 async function run(task:()=>Promise<void>){
  if(busy)return;
  setBusy(true);setError('');setMessage('');
  try{await task();}
  catch(e){setError(e instanceof Error?e.message:'عملیات کامل نشد.');}
  finally{setBusy(false);setWorking('');}
 }
 function chooseFile(e:ChangeEvent<HTMLInputElement>){
  const upload=e.currentTarget.files?.[0];e.currentTarget.value='';
  if(!upload)return;
  void run(async()=>{
   setChecked(false);setParsed(null);setKnown(new Map());setCommitted(0);setAgency('');setSale('');setPage(1);
   if(!/\.xlsx$/i.test(upload.name))throw Error('فایل XLSX خروجی سیستم قبلی را انتخاب کنید.');
   setWorking('در حال خواندن اکسل…');
   const {readSheet}=await import('read-excel-file/browser');
   const input=parseLegacyWorkbook(await readSheet(upload,'ActivationFull'));
   if(!input.total)throw Error('در برگهٔ ActivationFull هیچ ردیفی برای بررسی پیدا نشد.');
   const packs=split(input.events),matches=new Map<string,LegacyPreview>();
   let done=0;
   setWorking('در حال تطبیق با سوابق ثبت‌شده…');
   await readDirectory();
   for(let start=0;start<packs.length;start+=5){
    const results=await Promise.all(packs.slice(start,start+5).map(rows=>request<{known:LegacyPreview[]}>('',{mode:'preview',rows})));
    for(const result of results)for(const key of result.known)matches.set(key.activeId,key);
    done=Math.min(start+5,packs.length);
    setWorking('بررسی فایل · '+displayCount(done)+' از '+displayCount(packs.length)+' بسته');
   }
   setKnown(matches);setParsed(input);setFile(upload.name);setFilter(input.conflicts.size||[...matches.values()].some(row=>row.status==='conflict')?'conflicts':'new');setChecked(true);
  });
 }
 async function saveRecords(){
  await run(async()=>{
   const candidates=stats.new.map(entry=>entry.row);
   const packs=split(candidates);
   const results=new Map(known);
   let saved=0;
   for(const [index,rows] of packs.entries()){
    setWorking('ثبت رکوردهای جدید · '+displayCount(index+1)+' از '+displayCount(packs.length)+' بسته');
    const response=await request<{saved:number;known:LegacyPreview[]}>('',{mode:'import',confirmed:true,rows,file});
    const current=new Map(response.known.map(row=>[row.activeId,row]));
    for(const row of rows)results.set(row.activeId,current.get(row.activeId)||{activeId:row.activeId,status:'same'});
    saved+=response.saved;
    setKnown(new Map(results));setCommitted(previous=>previous+response.saved);
   }
   const moved=[...results.values()].some(row=>row.status==='conflict');
   if(moved){setFilter('conflicts');setPage(1);}
   setMessage(displayCount(saved)+' سابقهٔ جدید ثبت شد.'+(moved?' مغایرت‌ها برای بررسی در فهرست هستند.':''));
  });
 }
 function linkAgency(){
  void run(async()=>{
   const result=await request<LegacyAgency>('',{mode:'link',confirmed:true,legacyId:agency,salesId:sale,revision:activeLink?.revision||0});
   setLinks(previous=>[...previous.filter(link=>link.id!==result.id),result]);setSale('');
   setMessage('اتصال نمایندگی ثبت شد.');
  });
 }
 function readHistory(next=1){
  void run(async()=>{
   const result=await request<{rows:SavedRow[];more:boolean}>('?'+new URLSearchParams({view:'history',q:historyQuery,page:String(next)}));
   setHistory(result);setHistoryPage(next);
  });
 }
 return <section className="panel" aria-label="ورود سوابق از سیستم قبلی">
  <h3>ورود سوابق از سیستم قبلی</h3>
  <label className="field">اکسل سوابق فعال‌سازی
   <input type="file" accept=".xlsx" disabled={busy} onChange={chooseFile}/>
  </label>
  {working&&<p role="status">{working}</p>}{message&&<p role="status">{message}</p>}{error&&<p className="notice error" role="alert">{error}</p>}
  {checked&&parsed&&<>
   <h4>پیش‌نمایش ورود سوابق</h4>
   <p>{file} · {displayCount(parsed.total)} ردیف · {displayCount(parsed.repeated)} ردیف تکراری داخل فایل{committed>0?' · '+displayCount(committed)+' ثبت‌شده در این نوبت':''}</p>
   {!!parsed.invalid.length&&<p className="notice" role="status">{displayCount(parsed.invalid.length)} ردیف نامعتبر. شمارهٔ ردیف‌ها {parsed.invalid.slice(0,30).map(displayCount).join('، ')}{parsed.invalid.length>30?' و موارد دیگر':''}.</p>}
   <div className="tools" aria-label="وضعیت سوابق">
    {([['new','جدید'],['same','ثبت‌شده'],['conflicts','مغایرت'],['warnings','نیازمند بررسی']] as const).map(([value,label])=><button className={'btn'+(filter===value?' primary':'')} key={value} type="button" aria-pressed={filter===value} onClick={()=>{setFilter(value);setPage(1)}}>{label} ({displayCount(stats[value].length)})</button>)}
   </div>
   {choices.length>0?<>
    <div className="as-table"><table><thead><tr><th>شناسهٔ قدیمی</th><th>سابقهٔ فایل</th><th>{filter==='conflicts'?'مقدار دیگر':'نمایندگی یا وضعیت'}</th></tr></thead>
     <tbody>{choices.slice((currentPage-1)*25,currentPage*25).map(({row,comparison,alternatives})=><tr key={row.activeId}>
      <td><bdi>{row.activeId}</bdi></td><td><bdi>{summary(row)}</bdi></td>
      <td>{alternatives?alternatives.map((item,i)=><p key={i}><bdi>{summary(item)}</bdi></p>):comparison?.existing?<bdi>{summary(comparison.existing)}</bdi>:[salesById.get(linksById.get(row.agencyId)?.salesId||'')?.name||row.agencyName,...legacyActivationWarnings(row)].filter(Boolean).join(' · ')||'—'}</td>
     </tr>)}</tbody></table></div>
    {pages>1&&<div className="tools">
     <button className="btn" type="button" disabled={currentPage<=1} onClick={()=>setPage(currentPage-1)}>قبلی</button><span>{displayCount(currentPage)} از {displayCount(pages)}</span><button className="btn" type="button" disabled={currentPage>=pages} onClick={()=>setPage(currentPage+1)}>بعدی</button>
    </div>}
   </>:<p>ردیفی در این بخش نیست.</p>}
   <button className="btn primary" type="button" disabled={busy||!stats.new.length} onClick={()=>void saveRecords()}>ثبت {displayCount(stats.new.length)} رکورد جدید</button>
   <h4>تطبیق نمایندگی‌های قبلی</h4>
   <p>{displayCount(agencies.filter(item=>linksById.has(item.id)).length)} وصل‌شده · {displayCount(agencies.filter(item=>!linksById.has(item.id)).length)} نیازمند تطبیق</p>
   <div className="formgrid">
    <label className="field">نمایندگی در سیستم قبلی<select value={agency} disabled={busy} onChange={e=>{setAgency(e.target.value);setSale('')}}>
     <option value="">انتخاب کنید</option>{agencies.map(item=><option key={item.id} value={item.id}>{[...item.names].join(' / ')||'نمایندگی بدون نام'} · {item.id} · {linksById.has(item.id)?'وصل‌شده':'نیازمند تطبیق'}</option>)}
    </select></label>
    {selected&&<label className="field">پروندهٔ نمایندگی فروش در هم‌نفس<select value={sale} disabled={busy} onChange={e=>setSale(e.target.value)}>
     <option value="">انتخاب کنید</option>
     {!!suggested.length&&<optgroup label="پیشنهاد از روی نام یا کد">{suggested.map(item=><option value={item.id} key={item.id}>{[item.name,item.code,item.city].filter(Boolean).join(' · ')}</option>)}</optgroup>}
     <optgroup label="نمایندگی‌های فعال">{sales.filter(item=>!suggested.some(match=>match.id===item.id)).map(item=><option value={item.id} key={item.id}>{[item.name,item.code,item.city].filter(Boolean).join(' · ')}</option>)}</optgroup>
    </select></label>}
   </div>
   {selected&&<p>{[...selected.codes].length?'کد قبلی '+[...selected.codes].join('، ')+' · ':''}{displayCount(selected.count)} سابقه · {activeLink?'متصل به '+(salesById.get(activeLink.salesId)?.name||'پروندهٔ فعلی'):'تعیین‌تکلیف‌نشده'}</p>}
   {selected&&<button type="button" className="btn" disabled={busy||!sale||sale===activeLink?.salesId} onClick={linkAgency}>{activeLink?'تغییر اتصال نمایندگی':'ثبت اتصال نمایندگی'}</button>}
  </>}
  <h4>سوابق واردشده</h4>
  <form className="tools" onSubmit={e=>{e.preventDefault();readHistory()}}><label className="field">شناسهٔ فعال‌سازی یا سریال<input type="search" maxLength={160} value={historyQuery} onChange={e=>setHistoryQuery(e.target.value)}/></label><button className="btn" disabled={busy}>نمایش سوابق</button></form>
  {history&&<>{history.rows.length?<div className="as-table"><table><thead><tr><th>شناسه</th><th>سابقه</th><th>نمایندگی</th><th>فایل و زمان ثبت</th></tr></thead><tbody>{history.rows.map(({event,file,importedAt,salesName})=><tr key={event.activeId}><td><bdi>{event.activeId}</bdi></td><td><bdi>{summary(event)}</bdi></td><td>{salesName||'تعیین‌تکلیف‌نشده'}{event.agencyName&&<small> · نام قبلی {event.agencyName}</small>}</td><td>{file} · {formatDateTime(importedAt)}</td></tr>)}</tbody></table></div>:<p>سابقه‌ای پیدا نشد.</p>}
   {(historyPage>1||history.more)&&<div className="tools"><button className="btn" type="button" disabled={busy||historyPage<=1} onClick={()=>readHistory(historyPage-1)}>قبلی</button><button className="btn" type="button" disabled={busy||!history.more} onClick={()=>readHistory(historyPage+1)}>بعدی</button></div>}
  </>}
 </section>;
}
