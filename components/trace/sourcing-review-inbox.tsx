'use client';
import {useEffect,useRef,useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {NumberInput} from './number-input';
import {SolarDate} from './solar-date';
import {RefreshButton} from './refresh-button';
import {tehranDay} from '@/lib/serials';
import {formatDate} from '@/lib/persian-date';
import {quoteNumber} from '@/lib/sourcing-quote-comparison';
import type {SourcingReviewWorkspace} from '@/lib/sourcing-review-contract';

const titles:Record<string,string>={answer_quote_review:'پاسخ مالی به مدیرعامل',review_order_terms:'بررسی شرایط جدید خرید',technical:'بررسی فنی پیشنهاد',financial_review:'کنترل مالی پیشنهاد',finance:'برنامه تأمین مالی',issue_order:'تأیید وجه و صدور خرید',assign_owner:'تعیین مسئول مرحله',claim_work:'پذیرش مسئولیت'};
export function SourcingReviewInbox({workspace,targetId='',onNavigate}:{workspace:SourcingReviewWorkspace;targetId?:string;onNavigate?:(section:string,target?:string)=>void}){
 const [data,setData]=useState<any>(null),[draft,setDraft]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');const sequence=useRef(0);
 const planId=targetId.startsWith('sourcing:')?targetId.slice(9):'';
 async function load(){const n=++sequence.current;const r=await fetch('/api/sourcing?'+new URLSearchParams({reviewInbox:workspace,...(planId?{id:planId}:{})}),{cache:'no-store'});if(r.status===403){if(n===sequence.current)setData({denied:true,items:[]});return;}const d=await r.json() as any;if(!r.ok)throw Error(d.error);if(n===sequence.current)setData(d);}
 useEffect(()=>{setData(null);setDraft(null);setError('');void load().catch(e=>setError(e.message));return()=>{sequence.current++}},[workspace,planId]);
 const patch=(key:string,value:any)=>setDraft((d:any)=>({...d,[key]:value}));
 function start(item:any,mode=item.mode){setError('');setMessage('');setDraft({id:crypto.randomUUID(),item,mode,notes:'',confirmed:false,result:'',ownerId:item.ownerId||'',status:item.finance?.status==='approved'?'approved':'planned',budgetRial:item.finance?.budgetRial||'0',availableOn:item.finance?.availableOn||tehranDay(),reference:''});}
 async function submit(e:React.FormEvent){e.preventDefault();if(busy||!draft.confirmed)return;setBusy(true);setError('');const {item,mode}=draft;
  try{const body={id:draft.id,planId:item.planId,revision:item.planRevision,mode,notes:draft.notes,confirmed:true,...(['technical','financial_review'].includes(mode)?{quoteId:item.quoteId,quoteRevision:item.quoteRevision,result:draft.result}:mode==='answer_quote_review'?{quoteId:item.quoteId,quoteRevision:item.quoteRevision,role:workspace}:mode==='review_order_terms'?{orderId:item.orderId,orderRevision:item.orderRevision,result:draft.result}:mode==='finance'?{status:draft.status,budgetRial:draft.budgetRial,availableOn:draft.availableOn}:mode==='issue_order'?{orderId:item.orderId,reference:draft.reference}:mode==='assign_owner'?{role:workspace,ownerId:draft.ownerId}:{role:workspace})};
   const r=await fetch('/api/sourcing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json() as any;if(!r.ok)throw Error(d.error);
   setDraft(null);setMessage(d.assignment?'مسئولیت ثبت شد. '+(d.assignment.tasksUpdated?'کارتابل مسئول به‌روز شد.':'ارجاع کارتابل در نوبت همگام‌سازی است.'):'نتیجه ثبت شد.');window.dispatchEvent(new Event('nafasyar-tasks-changed'));await load();
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 if(data?.denied)return planId?<p className="notice error">دسترسی انجام این بررسی را ندارید.</p>:null;
 const ownerMode=['assign_owner','claim_work'].includes(draft?.mode);
 return <section className="sourcing-review-inbox" aria-label={workspace==='engineering'?'کارتابل تحقیق‌وتوسعه':'کارتابل مالی خرید'}>
  <div className="panelhead"><div><h3>{workspace==='engineering'?'کارتابل تحقیق‌وتوسعه':'کارتابل مالی خرید'}</h3><p className="subtle">{workspace==='engineering'?'پیشنهادهای منتظر بررسی فنی؛ تصمیم در همین کارتابل ثبت می‌شود.':'بررسی پیشنهادها، برنامهٔ تأمین وجه و صدور خرید؛ تصمیم در همین کارتابل ثبت می‌شود.'}</p></div><RefreshButton className="btn" disabled={busy} onRefresh={()=>load().catch(e=>setError(e.message))}/></div>
  {error&&!draft&&<p className="notice error" role="alert">{error}</p>}{message&&<p className="notice" role="status">{message}</p>}
  {!data&&!error&&<p role="status">در حال دریافت کارها…</p>}{data?.items.length===0&&<p className="notice">کاری در انتظار اقدام این واحد نیست.</p>}
  {data?.items.map((item:any)=><article className="sourcing-review-card" key={item.id}><strong>{item.taskTitle}</strong><p>{item.productName}{item.materialName?' · '+item.materialName+' ('+item.partCode+')':''}</p>{item.supplier&&<p>تأمین‌کننده: {item.supplier}</p>}{item.reviewNote&&<p>{item.reviewNote}</p>}{item.mode==='review_order_terms'&&<p>مدت تحویل: {item.deliveryDays} روز · پیش‌پرداخت: {item.requiredAdvanceRial} ریال</p>}{item.quantity!==undefined&&<p>مقدار: {quoteNumber(item.quantity/1000)} {item.unit}</p>}{item.specs&&<p>مشخصات پیشنهاد: {item.specs}</p>}{item.requiredSpecs&&item.requiredSpecs!==item.specs&&<p>مشخصات موردنیاز: {item.requiredSpecs}</p>}
   {workspace==='finance'&&<>{item.totalRial!==undefined&&<p>مبلغ کل: {quoteNumber(item.totalRial)} ریال{item.freight?.status==='pending'?'؛ هزینه حمل هنوز مشخص نیست':''}</p>}{item.paymentTerms&&<p>شرایط پرداخت: {item.paymentTerms}</p>}{item.technicalNote&&<p>نتیجه بررسی فنی: {item.technicalNote}</p>}{item.validUntil&&<p>اعتبار پیشنهاد: {formatDate(item.validUntil)}</p>}</>}
   {workspace==='finance'&&item.quoteId&&<details><summary>جزئیات قیمت و مدارک پیشنهاد</summary><p>قیمت واحد: {quoteNumber(item.unitPrice)} {item.currency}</p><p>هزینه جانبی: {quoteNumber(item.extrasRial)} ریال</p>{item.deliveryDays!==undefined&&<p>مدت تحویل: {quoteNumber(item.deliveryDays)} روز</p>}{item.needBy&&<p>موعد نیاز: {formatDate(item.needBy)}</p>}{item.files?.map((f:any)=><p key={f.id}><a href={'/api/sourcing/quote-files?id='+encodeURIComponent(f.id)}>{f.filename}</a></p>)}</details>}
   {workspace==='finance'&&item.finance&&<p>بودجهٔ جاری: {quoteNumber(item.finance.budgetRial)} ریال{item.finance.availableOn?' · تاریخ وجه: '+formatDate(item.finance.availableOn):''}</p>}
   <p className="subtle">مسئول: {item.ownerName||'تعیین نشده'}</p><div className="tools">{item.mode?item.canAct&&<button type="button" className="btn primary" disabled={busy} onClick={()=>start(item)}>{titles[item.mode]}</button>:<button type="button" className="btn" onClick={()=>onNavigate?.('sourcing',item.planId)}>بازکردن نیاز و مشخصات</button>}{item.canClaim&&<button type="button" className="btn" disabled={busy} onClick={()=>start(item,'claim_work')}>پذیرش مسئولیت</button>}{data.canAssign&&item.candidates?.length>0&&<button type="button" className="btn" disabled={busy} onClick={()=>start(item,'assign_owner')}>تعیین مسئول</button>}</div>
  </article>)}
  <Dialog open={!!draft} onOpenChange={v=>{if(!v&&!busy)setDraft(null)}}><DialogContent className="sourcing-review-dialog"><DialogTitle>{titles[draft?.mode]}</DialogTitle><DialogDescription>{ownerMode?'این فرم فقط مسئول انجام مرحله را مشخص می‌کند.':'نتیجه با نام شما در سابقهٔ همین پرونده ثبت می‌شود.'}</DialogDescription>{draft&&<form onSubmit={submit}><fieldset disabled={busy} className="sourcing-review-form">
   <p>{draft.item.productName}{draft.item.supplier?' · '+draft.item.supplier:''}</p>
   {['technical','financial_review','review_order_terms'].includes(draft.mode)&&<label className="field">نتیجه بررسی<select required value={draft.result} onChange={e=>patch('result',e.target.value)}><option value="">انتخاب کنید</option><option value="pass">تأیید</option><option value="fail">{draft.mode==='financial_review'?'برگشت به تأمین برای اصلاح':'رد'}</option></select></label>}
   {draft.mode==='finance'&&<><label className="field">وضعیت تأمین وجه<select value={draft.status} onChange={e=>patch('status',e.target.value)}><option value="planned">برآورد اولیه</option><option value="approved">بودجه و تأمین وجه تأییدشده</option></select></label><label className="field">سقف بودجه (ریال)<NumberInput fieldKey="budgetRial" required value={draft.budgetRial} onChange={e=>patch('budgetRial',e.target.value)}/></label><SolarDate label="تاریخ دسترسی به وجه" value={draft.availableOn} onChange={v=>patch('availableOn',v)}/><p className="subtle">این تأیید، انتقال وجه یا پرداخت بانکی نیست.</p></>}
   {draft.mode==='issue_order'&&<label className="field">مرجع تأیید وجه / بودجه<input required value={draft.reference} onChange={e=>patch('reference',e.target.value)}/></label>}
   {draft.mode==='assign_owner'&&<label className="field">مسئول واجد نقش<select required value={draft.ownerId} onChange={e=>patch('ownerId',e.target.value)}><option value="">انتخاب کنید</option>{draft.item.candidates.map((m:any)=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>}
   <label className="field">{ownerMode?'توضیح مسئولیت (اختیاری)':'نتیجه و دلیل بررسی'}<textarea required={!ownerMode} maxLength={4000} rows={3} value={draft.notes} onChange={e=>patch('notes',e.target.value)}/></label>
   <label className="flow-check"><input type="checkbox" required checked={draft.confirmed} onChange={e=>patch('confirmed',e.target.checked)}/>{ownerMode?'ثبت این مسئولیت را تأیید می‌کنم':'نتیجهٔ بررسی و ثبت آن را تأیید می‌کنم'}</label>
   {error&&<p className="notice error" role="alert">{error}</p>}<div className="tools"><button type="submit" className="btn primary" disabled={busy}>ثبت نتیجه</button><button type="button" className="btn" onClick={()=>setDraft(null)}>بستن</button></div>
  </fieldset></form>}</DialogContent></Dialog>
 </section>;
}
