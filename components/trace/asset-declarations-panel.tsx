'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {ReceiptAttachment} from './receipt-attachment';
import {ReceiptPhotoEditor} from './receipt-photo-editor';
import {CameraCodeScanner} from './camera-code-scanner';
import {AssetCategoryChoices} from './asset-category-choices';
import {assetConditions} from '@/lib/assets-contract';
import {formatDateTime} from '@/lib/persian-date';
import {CheckCheck,ClipboardList,Plus,Printer,Search,Building2} from 'lucide-react';
import './asset-declarations.css';

const states:Record<string,string>={draft:'پیش‌نویس',submitted:'در انتظار تأیید اموال‌دار',returned:'نیازمند اصلاح',approved:'تأییدشده'};
const fresh=()=>({number:1,name:'',category:'',location:'',brand:'',model:'',serial:'',condition:'',existingCode:'',notes:'',photoFileIds:[] as string[]});
export function AssetDeclarationsPanel({review=false,initialId='',onBack,onCompany}:{review?:boolean;initialId?:string;onBack?:()=>void;onCompany?:()=>void}){
 const [data,setData]=useState<any>(null),[selected,setSelected]=useState<any>(null),[items,setItems]=useState<any[]>([fresh()]),[noAssets,setNoAssets]=useState(false),[editing,setEditing]=useState(false),[holderConfirmed,setHolderConfirmed]=useState(false),[matched,setMatched]=useState(false),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[photoEditing,setPhotoEditing]=useState<number|null>(null),[large,setLarge]=useState(''),[assetSearch,setAssetSearch]=useState(''),[matches,setMatches]=useState<any[]>([]),[scanRow,setScanRow]=useState<number|null>(null);
 const flight=useRef(false),current=useRef<any>(null),account=useRef(''),operation=useRef({signature:'',id:''});
 const loadVersion=useRef(0),detailId=useId(),detailRef=useRef<HTMLDivElement>(null);
 const [focusRequest,setFocusRequest]=useState(0);
 const [photoToEdit,setPhotoToEdit]=useState<{id:string;file:File}|null>(null);
 const headers=()=>({'Content-Type':'application/json',...(account.current?{'x-asset-account':account.current}:{})});
 async function read(recordId=''){
  const params=new URLSearchParams(review?{review:'true',queue:'true'}:{});
  if(recordId)params.set('id',recordId);
  const response=await fetch('/api/assets/declarations?'+params,{cache:'no-store',headers:headers()}),result=await response.json() as any;
  if(!response.ok)throw Error(result.error||'دریافت اعلام اموال انجام نشد.');
  if(account.current&&account.current!==result.accountId)throw Error('حساب ورود تغییر کرده است؛ صفحه را تازه کنید.');
  account.current=result.accountId;
  return result;
 }
 async function load(){const version=++loadVersion.current,result=await read();if(version===loadVersion.current)setData(result);return result;}
 useEffect(()=>{
  if(!focusRequest||!review)return;
  const detail=detailRef.current;
  if(!detail)return;
  const header=detail.closest('.workspace-body')?.querySelector('.workspace-topbar');
  detail.style.scrollMarginBlockStart=((header?.getBoundingClientRect().height||0)+16)+'px';
  detail.focus({preventScroll:true});
  detail.scrollIntoView({block:'start',inline:'nearest',behavior:'instant'});
 },[focusRequest,review]);
 function choose(r:any){if(flight.current)return;if(editing&&!window.confirm('تغییرات ذخیره‌نشده را کنار بگذاریم؟'))return;current.current=r;setSelected(r);setItems(r.data.items.map((v:any,i:number)=>{const found=review?r.codeMatches?.[i]?.asset:null;return {...v,existingAssetId:found?.id||'',assetRevision:found?.revision||0};}));setNoAssets(!!r.data.noAssets);setEditing(!review&&['draft','returned'].includes(r.data.state));setHolderConfirmed(false);setMatched(false);setReason(review?'':[...(r.data.history||[])].reverse().find((entry:any)=>entry.mode==='save'||entry.mode==='submit')?.notes||'');setMatches([]);setError('');setMessage('');setPhotoEditing(null);if(review)setFocusRequest(n=>n+1);}
 useEffect(()=>{let live=true;void load().then(async j=>{
  if(!live||!initialId)return;
  const record=j.records.find((r:any)=>r.id===initialId)||(await read(initialId)).records[0];
  if(live&&record)choose(record);
 }).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[review,initialId]);
 function start(none=false){if(flight.current||editing&&!window.confirm('ویرایش ذخیره‌نشده را کنار بگذاریم؟'))return;current.current=null;setSelected(null);setItems(none?[]:[fresh()]);setNoAssets(none);setEditing(true);setHolderConfirmed(false);setReason('');setError('');setMessage('');setPhotoEditing(null);operation.current={signature:'',id:''};}
 function update(i:number,patch:any){setItems(p=>p.map((v,n)=>n===i?{...v,...patch}:v));}
 function quantity(raw:string){const n=Number(raw);if(!Number.isInteger(n)||n<1||n>20)return;if(items.slice(n).some(v=>v.photoFileIds?.length)){setError('ردیف دارای عکس را حذف نکنید؛ شماره عکس‌ها باید حفظ شود.');return;}setItems(p=>Array.from({length:n},(_,i)=>p[i]||{...fresh(),name:p[0]?.name||'',category:p[0]?.category||'',location:p[0]?.location||'',brand:p[0]?.brand||'',model:p[0]?.model||'',number:i+1}));}
 async function write(body:any){const signature=JSON.stringify(body);if(operation.current.signature!==signature)operation.current={signature,id:crypto.randomUUID()};const r=await fetch('/api/assets/declarations',{method:'POST',headers:headers(),body:JSON.stringify({...body,id:operation.current.id,confirmed:true})}),j=await r.json() as any;if(!r.ok)throw Error(j.error||'ثبت انجام نشد.');current.current=j.record;setSelected(j.record);
  if(review){
   setData((value:any)=>value?{...value,records:value.records.filter((r:any)=>r.id!==j.record.id)}:value);
   window.dispatchEvent(new Event('nafasyar-tasks-changed'));
   void load().catch(()=>setError('نتیجه ثبت شد، اما تازه‌سازی صف انجام نشد.'));
  }else{
   if(body.mode==='withdraw')setData((value:any)=>value?{...value,records:value.records.filter((r:any)=>r.id!==body.recordId)}:value);
   window.dispatchEvent(new Event('nafasyar-tasks-changed'));
   await load().catch(()=>setError('ثبت انجام شد. برای دیدن فهرست جدید، صفحه را تازه کنید.'));
  }
  return j.record;}
 async function save(mode='save'){
  if(flight.current||photoEditing!==null)return;flight.current=true;setBusy(true);setError('');setMessage('');
  try{const r=await write({mode,recordId:current.current?.id,revision:current.current?.revision||0,noAssets,items:items.map(({existingAssetId,assetRevision,copies,...v})=>v),holderConfirmed,notes:reason});setItems(r.data.items);setEditing(mode==='save');if(mode==='save')setMessage('پیش‌نویس ذخیره شد.');}catch(e){setError((e as Error).message)}finally{flight.current=false;setBusy(false)}
 }
 async function withdraw(){
  const record=current.current;
  if(flight.current||!record||!window.confirm('این پرونده و عکس‌های آن از فهرست اعلام‌های شما و صف اموال‌دار حذف شوند؟'))return;
  flight.current=true;setBusy(true);setError('');setMessage('');
  try{
   await write({mode:'withdraw',recordId:record.id,revision:record.revision});
   setEditing(false);setItems([fresh()]);setNoAssets(false);setReason('');setHolderConfirmed(false);setScanRow(null);
   setMessage('پروندهٔ اعلام اموال حذف شد.');
  }catch(e){setError((e as Error).message)}finally{flight.current=false;setBusy(false)}
 }
 async function openPhotoEditor(index:number,photo:{id:string;filename:string;url:string}){
  if(flight.current)return;flight.current=true;setBusy(true);setError('');
  try{
   const response=await fetch(photo.url,{cache:'no-store',headers:{'x-asset-account':account.current}});
   if(!response.ok)throw Error('عکس برای ویرایش در دسترس نیست.');
   setPhotoToEdit({id:photo.id,file:new File([await response.blob()],photo.filename,{type:response.headers.get('Content-Type')||'image/jpeg'})});
   setPhotoEditing(index);
  }catch(e){setError((e as Error).message)}finally{flight.current=false;setBusy(false)}
 }
 function closePhotoEditor(){setPhotoToEdit(null);setPhotoEditing(null);}
 async function upload(index:number,files:File[],replaceId?:string){
  if(flight.current||!files.length)return;flight.current=true;setBusy(true);setError('');
  try{if(files.some(f=>!f.type.startsWith('image/')||!f.size||f.size>10*1024*1024))throw Error('عکس معتبر و حداکثر ۱۰ مگابایت انتخاب کنید.');if(!replaceId&&(items[index].photoFileIds?.length||0)+files.length>5)throw Error('برای هر مال حداکثر پنج عکس مجاز است.');
   let record=await write({mode:'save',recordId:current.current?.id,revision:current.current?.revision||0,noAssets:false,items:items.map(({existingAssetId,assetRevision,copies,...v})=>v),notes:reason});
   for(const file of files){const q=new URLSearchParams({id:crypto.randomUUID(),recordId:record.id,revision:String(record.revision),number:String(index+1),filename:file.name,confirmed:'true',...(replaceId?{replaceId}:{})}),r=await fetch('/api/assets/declarations/files?'+q,{method:'POST',headers:{'x-asset-account':account.current},body:file}),j=await r.json() as any;if(!r.ok)throw Error(j.error||'عکس ذخیره نشد.');record=j.record;current.current=record;setSelected(record);setItems(record.data.items);}
   await load();setMessage('عکس همین شماره ذخیره شد.');
  }catch(e){setError((e as Error).message);if(current.current)try{const j=await load(),r=j.records.find((r:any)=>r.id===current.current.id);if(r){current.current=r;setSelected(r);setItems(r.data.items);setEditing(['draft','returned'].includes(r.data.state));}}catch{}}finally{flight.current=false;setBusy(false);closePhotoEditor()}
 }
 async function reviewAction(mode:'approve'|'return'){
  if(flight.current||!selected)return;flight.current=true;setBusy(true);setError('');
  try{const r=await write({mode,recordId:selected.id,revision:selected.revision,notes:reason,matched,...(mode==='approve'?{reviewItems:items}: {})});setItems(r.data.items);setMessage(mode==='approve'?'موجودی تأیید شد و از صف بررسی خارج شد.':'اعلام برای اصلاح به خود فرد برگشت و از صف بررسی خارج شد.');setFocusRequest(n=>n+1);}catch(e){setError((e as Error).message);setFocusRequest(n=>n+1)}finally{flight.current=false;setBusy(false)}
 }
 async function searchAssets(){setError('');try{const r=await fetch('/api/assets/declarations?'+new URLSearchParams({assetSearch})),j=await r.json() as any;if(!r.ok)throw Error(j.error);setMatches(j.assets);}catch(e){setError((e as Error).message)}}
 const showForm=!!(editing||selected)&&(!review||selected?.data.state==='submitted');
 const ownReview=review&&!!selected&&(selected.data.memberId===data?.me||selected.data.createdBy===data?.accountId);
 const field=(i:number,k:string,label:string,required=false)=><label className="field"><span>{label}{required?' *':''}</span><input required={required} maxLength={k==='name'?200:300} value={items[i][k]||''} disabled={busy} onChange={e=>update(i,{[k]:e.target.value})}/></label>;
 const photos=(number:number)=>(selected?.files||[]).filter((f:any)=>f.number===number&&items[number-1]?.photoFileIds.includes(f.id));
 return <section className="panel inside asset-declarations" dir="rtl"><div className="panelhead"><div><h2><ClipboardList size={22}/> {review?'اعلام اموال کارکنان':'اعلام اموال شرکت نزد من'}</h2><p className="subtle">{review?'عکس، وضعیت و دارنده را تطبیق دهید؛ ثبت تکراری یا تحویل تاریخی ایجاد نمی‌شود.':'فقط اموال نزد خودت را اعلام کن؛ اموالدار بررسی و تأیید می‌کند.'}</p></div><div className="tools">{onBack&&<button className="btn" disabled={busy} onClick={()=>{if(!editing||window.confirm('از ویرایش ذخیره‌نشده خارج شویم؟'))onBack()}}>بازگشت</button>}{review&&onCompany&&<button className="btn" onClick={onCompany}><Building2 size={17}/>ثبت مستقیم اموال شرکت</button>}</div></div>
 {error&&(!review||!selected)&&<p className="notice error" role="alert">{error}</p>}{!review&&message&&<p className="notice" role="status">{message}</p>}
 {!data?<p>در حال دریافت…</p>:<>{!review&&<div className="tools"><button className="btn primary" disabled={busy||photoEditing!==null} onClick={()=>start()}><Plus size={17}/>اعلام اموال جدید</button><button className="btn" disabled={busy||photoEditing!==null} onClick={()=>start(true)}>مالی از شرکت نزد من نیست</button></div>}
 <div className="asset-declarations-layout" data-review-open={review&&!!selected||undefined}><aside className="asset-declarations-list" aria-label={review?'صف اعلام‌های در انتظار بررسی':undefined}>{data.records.map((r:any)=><button type="button" className={'asset-declaration-choice '+(selected?.id===r.id?'selected':'')} disabled={busy||photoEditing!==null} key={r.id} aria-controls={review?detailId:undefined} aria-pressed={review?selected?.id===r.id:undefined} onClick={()=>choose(r)}><strong>{review?r.data.memberName:r.data.noAssets?'اعلام نداشتن مال':r.data.items[0]?.name||'پیش‌نویس'}</strong><span>{r.data.noAssets?'مالی نزد من نیست':r.data.items.length.toLocaleString('fa-IR')+' مال'} · {states[r.data.state]}</span><small>{formatDateTime(r.updated)}</small></button>)}{!data.records.length&&<p className="subtle">{review?'اعلامی برای بررسی نیست.':'هنوز اعلامی ثبت نکرده‌ای.'}</p>}</aside>
 <div className="asset-declaration-detail" id={detailId} ref={detailRef} tabIndex={review?-1:undefined} aria-label={review?'پروندهٔ اعلام اموال':undefined}>{review&&selected&&error&&<p className="notice error" role="alert">{error}</p>}{review&&message&&<p className="notice" role="status">{message}</p>}{ownReview&&selected.data.state==='submitted'&&<p className="notice" role="status">{selected.data.reviewedAt?'اصلاحات شما ارسال شد.':'اعلام شما ارسال شد.'} چون دارندهٔ مال خودتان هستید، تأیید نهایی با اموال‌دار دیگری یا مدیر سامانه است.</p>}{showForm&&<><div className="notice"><strong>{selected?.data.memberName||data.personName}</strong><p>{selected?states[selected.data.state]:'پیش‌نویس جدید'}{selected?.data.reviewNotes?(selected.data.state==='submitted'?' · دلیل برگشت قبلی: ':' · نظر اموالدار: ')+selected.data.reviewNotes:''}</p>{!review&&<div role="status">{selected?.data.state==='submitted'&&<p>{selected.data.reviewedAt?'اصلاحات شما برای بررسی دوباره ارسال شد.':'این اعلام برای بررسی و تأیید به اموال‌دار ارسال شده است.'}{data.custodian&&' وضعیت را در کارتابل نقش اموال‌دار، بخش «پیگیری اعلام‌های خودم» ببینید.'}</p>}</div>}</div>
 {!review&&selected&&['draft','submitted','returned'].includes(selected.data.state)&&selected.data.memberId===data.me&&<div className="tools">{!editing&&selected.data.state==='submitted'&&<button type="button" className="btn" disabled={busy} onClick={()=>{if(window.confirm('این اعلام برای ویرایش به پیش‌نویس برگردد؟ بعد از اصلاح، دوباره آن را برای اموال‌دار ارسال کنید.'))void save()}}>ویرایش اعلام من</button>}<button type="button" className="btn asset-declaration-delete" disabled={busy||photoEditing!==null} onClick={()=>void withdraw()}>حذف پرونده</button></div>}
 {noAssets?<div className="notice"><h3>مالی از شرکت نزد من نیست</h3><p>این اعلام، اموال قبلی را حذف یا تسویه نمی‌کند. اگر دفتر اموال مغایرت داشته باشد، باید بررسی شود.</p></div>:<>{editing&&<div className="tools"><button type="button" className="btn" disabled={busy||photoEditing!==null||items.length>=20} onClick={()=>setItems(p=>[...p,{...fresh(),number:p.length+1}])}><Plus size={17}/>افزودن مال</button><label className="field">تعداد مال مشابه<select value={items.length} disabled={busy||photoEditing!==null} onChange={e=>quantity(e.target.value)}>{Array.from({length:20},(_,i)=><option key={i} value={i+1}>{(i+1).toLocaleString('fa-IR')}</option>)}</select></label><small>تا ۲۰ مال در هر اعلام؛ برای تعداد بیشتر اعلام بعدی بسازید.</small></div>}
 {review&&!ownReview&&selected?.data.state==='submitted'&&<div className="tools"><label className="field">جست‌وجوی شناسنامه موجود<input value={assetSearch} onChange={e=>setAssetSearch(e.target.value)} placeholder="نام، کد یا سریال"/></label><button className="btn" onClick={()=>void searchAssets()}><Search size={17}/>جست‌وجو</button></div>}
 {items.map((item,i)=><article className="flow-card asset-declaration-unit" key={i}><h3>مال شماره {(i+1).toLocaleString('fa-IR')}</h3><div className="asset-declaration-unit-layout"><div className="asset-declaration-photos">{photos(i+1).map((f:any)=><div className="asset-declaration-photo-card" key={f.id}><button className="asset-declaration-photo" type="button" onClick={()=>setLarge(f.url)}><img src={f.url} alt={'عکس مال شماره '+(i+1).toLocaleString('fa-IR')}/><span>بزرگ‌نمایی</span></button>{editing&&<div className="tools"><button type="button" className="btn" disabled={busy||photoEditing!==null} onClick={()=>void openPhotoEditor(i,f)}>ویرایش عکس</button><button type="button" className="btn asset-declaration-delete" disabled={busy||photoEditing!==null} onClick={()=>update(i,{photoFileIds:item.photoFileIds.filter((id:string)=>id!==f.id)})}>حذف عکس</button></div>}</div>)}{photoEditing===i&&photoToEdit&&<ReceiptPhotoEditor source={photoToEdit.file} subject={'مال شماره '+(i+1).toLocaleString('fa-IR')} disabled={busy} onConfirm={file=>void upload(i,[file],photoToEdit.id)} onCancel={closePhotoEditor}/>} {editing&&<ReceiptAttachment file={null} required multiple subject={'مال شماره '+(i+1).toLocaleString('fa-IR')} disabled={busy||!!photoToEdit||photoEditing!==null&&photoEditing!==i} onEditingChange={active=>setPhotoEditing(active?i:null)} onChange={file=>{if(file)void upload(i,[file])}} onFiles={files=>void upload(i,files)}/>}</div>
 <div>{editing||review&&!ownReview&&selected?.data.state==='submitted'?<div className="formgrid">{field(i,'name','نام مال',true)}<div className="asset-declaration-category"><h4>دسته‌بندی مال *</h4><AssetCategoryChoices value={item.category||''} onChange={category=>update(i,{category})} disabled={busy} iconSize={22}/>{field(i,'category','نام گروه مال',true)}</div>{field(i,'location','محل فعلی',true)}<label className="field">وضعیت ظاهری *<select value={item.condition||''} disabled={busy} onChange={e=>update(i,{condition:e.target.value})}><option value="">انتخاب کنید</option>{Object.entries(assetConditions).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>{field(i,'brand','برند (اختیاری)')}{field(i,'model','مدل (اختیاری)')}{field(i,'serial','سریال سازنده (اختیاری)')}{editing&&<label className="field">کد اموال یا شمارهٔ برچسب (اختیاری)<input value={item.existingCode||''} onChange={e=>update(i,{existingCode:e.target.value})}/><button className="btn" disabled={busy} onClick={()=>setScanRow(scanRow===i?null:i)}>اسکن برچسب</button>{scanRow===i&&<CameraCodeScanner onScan={v=>{update(i,{existingCode:v});setScanRow(null)}}/>}</label>}{review&&<><label className="field">تطبیق با شناسنامه<select value={item.existingAssetId||''} disabled={busy||['existing','inactive','conflict'].includes(selected?.codeMatches?.[i]?.state)} onChange={e=>{const match=matches.find(m=>m.id===e.target.value);update(i,{existingAssetId:match?.id||'',assetRevision:match?.revision||0})}}><option value="">{['inactive','conflict'].includes(selected?.codeMatches?.[i]?.state)?'کد هم‌نفس نیازمند بررسی است':'مال جدید؛ کد یکتا ساخته شود'}</option>{(selected?.codeMatches?.[i]?.asset?[selected.codeMatches[i].asset]:matches).map((m:any)=><option key={m.id} value={m.id}>{m.code} · {m.name} · دارنده: {m.holderName||'شرکت'}</option>)}</select><small>شمارهٔ اعلام‌شده: {item.existingCode||'ندارد'}</small>{selected?.codeMatches?.[i]?.state==='legacy'&&<small>این شماره در دفتر اموال هم‌نفس نیست و به‌عنوان شمارهٔ برچسب قبلی در اعلام می‌ماند.</small>}{selected?.codeMatches?.[i]?.state==='inactive'&&<small>این کد متعلق به مال بایگانی‌شده یا خارج‌شده است.</small>}{selected?.codeMatches?.[i]?.state==='conflict'&&<small>این کد در چند شناسنامه ثبت شده و نیاز به بررسی دارد.</small>}</label></>}</div>:<><h4>{item.name}</h4><p>{item.category} · {item.location} · {assetConditions[item.condition]||'وضعیت انتخاب نشده'}</p><p>{item.serial?'سریال: '+item.serial:''}</p></>}
 </div></div></article>)}</>}
 {editing&&<><label className="field">توضیحات (اختیاری)<textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={4000}/></label><label className="field"><span><input type="checkbox" checked={holderConfirmed} onChange={e=>setHolderConfirmed(e.target.checked)}/>تأیید می‌کنم این اعلام مربوط به اموال شرکت نزد خودم است.</span></label><div className="tools"><button className="btn" disabled={busy||photoEditing!==null} onClick={()=>void save()}>ذخیره پیش‌نویس</button><button className="btn primary" disabled={busy||photoEditing!==null||!holderConfirmed} onClick={()=>void save('submit')}>ارسال برای بررسی اموالدار</button></div><p className="subtle">برای هر مال، نام، گروه، محل، وضعیت و عکس مستقل لازم است. کد قطعی بعد از تأیید ایجاد می‌شود.</p></>}
 {review&&!ownReview&&selected?.data.state==='submitted'&&<><label className="field">یادداشت بررسی؛ برای اصلاح یا برگشت اجباری<textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={4000}/></label><label className="asset-declaration-confirmation"><input type="checkbox" checked={matched} onChange={e=>setMatched(e.target.checked)}/><span>مال، عکس، وضعیت و دارنده را تطبیق دادم.</span></label><div className="tools"><button className="btn" disabled={busy||!reason.trim()} onClick={()=>void reviewAction('return')}>برگشت برای اصلاح</button><button className="btn primary" disabled={busy||!matched||selected?.codeMatches?.some((entry:any)=>['inactive','conflict'].includes(entry.state))} onClick={()=>void reviewAction('approve')}><CheckCheck size={17}/>تأیید موجودی نزد این فرد</button></div></>}
 </>}
 {selected?.data.state==='approved'&&<div className="notice"><strong>تأیید اموالدار: {selected.data.reviewedName}</strong><p>مبنای ثبت: موجودی ابتدای استقرار</p>{selected.data.groupId&&review&&<a className="btn primary" href={'/api/assets/registration/print?id='+encodeURIComponent(selected.data.groupId)} target="_blank" rel="noopener noreferrer"><Printer size={17}/>چاپ لیبل‌ها و راهنمای شماره عکس</a>}{(selected.data.approvedItems||[]).map((v:any)=><p key={v.assetId}>مال شماره {v.number.toLocaleString('fa-IR')} · <bdi>{v.code}</bdi> · {v.copies.toLocaleString('fa-IR')} لیبل</p>)}</div>}
 {review&&selected?.data.state==='returned'&&!message&&<p className="notice">این اعلام برای اصلاح به خود فرد برگشته است.</p>}{!editing&&!selected&&<p className="subtle">{review?'یک اعلام را از فهرست انتخاب کنید.':'اعلام جدید بساز یا یکی از اعلام‌های قبلی را باز کن.'}</p>}</div></div></>}
 {large&&<div className="asset-declaration-lightbox" role="dialog" aria-modal="true" aria-label="بزرگ‌نمایی عکس مال"><button autoFocus className="btn" onClick={()=>setLarge('')}>بستن عکس</button><img src={large} alt="عکس مال در اندازه بزرگ"/></div>}
 </section>;
}
