'use client';
import {openWorkflowScan} from './workflow-scan-button';
import {useEffect,useRef,useState} from 'react';
import {Camera,Plus,ClipboardList,History,ArrowRight,Inbox,BriefcaseBusiness} from 'lucide-react';
import {CameraCodeScanner} from './camera-code-scanner';
import {AfterSalesPanel} from './after-sales-panel';
import type {Session} from '@/lib/permissions';
import {serviceMoment} from '@/lib/service-timing';
import {caseStates} from '@/lib/after-sales-labels';
import {officeServiceAccess} from '@/lib/service-office-access';
import {parseServiceDeviceQr,serviceDeviceSerial} from '@/lib/service-device-contract';
import type {CustomerCaseForm} from '@/lib/workflow-scan-contract';
import './driver-dashboard.css';
import './employee-self-service.css';
export function ServiceOfficeWorkspace({user,onNavigate,caseId='',initialSerial='',customerWorkspace=false,scannedAction,startIntake=false,taskTitles=[]}:{customerWorkspace?:boolean;scannedAction?:CustomerCaseForm;startIntake?:boolean;taskTitles?:string[];initialSerial?:string;user:Session;onNavigate:(section:string,target?:string)=>void;caseId?:string}){
 const [view,setView]=useState('home'),[query,setQuery]=useState(''),[search,setSearch]=useState(''),[page,setPage]=useState(1),[data,setData]=useState<any>(null),[serial,setSerial]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false),[retry,setRetry]=useState(0);const sequence=useRef(0);
 const scope=[user.userId,user.profileReview?.id||''].join(':'),canIntake=user.isAdmin||user.permissions.serviceRoles?.some(r=>['intake','manager'].includes(r));
 useEffect(()=>{sequence.current++;setView(startIntake?'new':initialSerial?'serial':'home');setSerial(initialSerial);setData(null);setError('');setSearch('');setQuery('');setPage(1);return()=>{sequence.current++}},[scope,caseId,initialSerial,startIntake]);
 useEffect(()=>{if(!['open','history','serial'].includes(view))return;const n=++sequence.current;setLoading(true);setError('');fetch('/api/after-sales/office?'+new URLSearchParams({view:view==='history'?'history':'open',q:search,page:String(page),...(view==='serial'?{serial}:{})}),{cache:'no-store'}).then(async r=>{const d:any=await r.json();if(!r.ok)throw Error(d.error||'دریافت پرونده‌ها انجام نشد.');if(n===sequence.current)setData(d)}).catch(e=>{if(n===sequence.current){setData(null);setError(e.message)}}).finally(()=>{if(n===sequence.current)setLoading(false)});return()=>{sequence.current++}},[scope,view,search,page,retry,serial]);
 function change(v:string){sequence.current++;setView(v);setPage(1);setSearch('');setQuery('');setData(null);setError('');setLoading(false)}
 async function scan(raw:string){const s=parseServiceDeviceQr(raw);if(!s){setError('QR شناسهٔ دستگاه را اسکن کنید؛ برای لیبل قدیمی، سریال را وارد کنید.');return}const n=++sequence.current;setLoading(true);setError('');try{const r=await fetch('/api/after-sales/office?'+new URLSearchParams({code:raw}),{cache:'no-store'}),d:any=await r.json();if(!r.ok)throw Error(d.error);if(n!==sequence.current)return;if(d.activeCaseId)onNavigate('after-sales','service-office:case:'+d.activeCaseId);else{setSerial(s);setView('serial');setData(d);setPage(1)}}catch(e){if(n===sequence.current)setError((e as Error).message)}finally{if(n===sequence.current)setLoading(false)}}
 if(!officeServiceAccess(user))return <p className="notice error">دسترسی خدمات دفتر شرکت لازم است.</p>;
 if(caseId||view==='new')return <section dir="rtl"><button data-pair-open="service-office-workspace:78ff8ef639d8" className="btn" onClick={()=>caseId?onNavigate('after-sales','service-office:'):change('home')}><ArrowRight size={18}/>بازگشت به خدمات دفتر</button><AfterSalesPanel customerWorkspace={customerWorkspace} customerScanAction={scannedAction} key={scope+':'+(caseId||'new:'+serial)} demo={false} user={user} onNavigate={onNavigate} domain="home" embedded workTarget={caseId||'office-intake:new'} intakeSerial={serial}/></section>;
 if(customerWorkspace&&view==='home')return <section className="employee-home" dir="rtl" aria-label="کارشناس پاسخ‌گویی مشتری">
  <header className="employee-home-header"><div><p>خدمات پس از فروش خانگی</p><h2>کارشناس پاسخ‌گویی مشتری</h2></div></header>
  <section className="employee-workspaces" aria-label="ابزارهای نقش">
   <h3>ابزارهای نقش</h3>
   <div className="employee-workspace-grid">
    {canIntake&&<button type="button" className="employee-workspace-tile" onClick={()=>{setSerial('');change('new')}}>
     <span className="employee-service-icon"><Plus size={20}/></span><span><strong>پذیرش دستگاه</strong><small>ثبت دستگاه و علائم مراجعه</small></span>
    </button>}
    <button type="button" className="employee-workspace-tile" onClick={()=>change('open')}>
     <span className="employee-service-icon"><ClipboardList size={20}/></span><span><strong>تعمیرات باز</strong><small>پرونده‌های در جریان و پیگیری مشتری</small></span>
    </button>
    <button type="button" className="employee-workspace-tile" onClick={()=>change('history')}>
     <span className="employee-service-icon"><History size={20}/></span><span><strong>سوابق تعمیرات</strong><small>پرونده‌های مختومه و نتیجهٔ تعمیر</small></span>
    </button>
    <button type="button" className="employee-workspace-tile" onClick={()=>onNavigate('personnel','missions:')}>
     <span className="employee-service-icon"><BriefcaseBusiness size={20}/></span><span><strong>مأموریت‌های کاری</strong><small>پیگیری برنامهٔ اعزام و مراجعه</small></span>
    </button>
   </div>
  </section>
  <section className="employee-home-summary" aria-label="خلاصهٔ کارتابل نقش">
   <header><h3>خلاصهٔ کارتابل نقش</h3><button type="button" onClick={()=>onNavigate('tasks')}><Inbox size={17}/> باز کردن کارتابل نقش</button></header>
   {taskTitles.map((title,index)=><button type="button" className="employee-home-row" key={index} onClick={()=>onNavigate('tasks')}>{title}</button>)}
  </section>
 </section>;
 return <section className="driver-dashboard" dir="rtl"><header className="driver-dashboard-header">{view!=='home'&&<button data-pair-open="service-office-workspace:c8f3baa252e0" className="btn" onClick={()=>change('home')}><ArrowRight size={18}/>بازگشت به خدمات دفتر</button>}<h2>{view==='home'?'تعمیرات دفتر شرکت':view==='scan'?'اسکن دستگاه':view==='history'?'سوابق تعمیرات':view==='serial'?'سوابق این دستگاه':'دستگاه‌های در حال تعمیر'}</h2></header>
 {error&&<p className="notice error" role="alert">{error}<button data-pair-open="service-office-workspace:efbb37da29d0" className="btn" onClick={()=>setRetry(v=>v+1)}>تلاش دوباره</button></p>}
 {view==='home'?<><p className="driver-dashboard-help">با اسکن لیبل دستگاه، پرونده و مرحلهٔ جاری تعمیر را باز کنید.</p><button className="driver-dashboard-scan" onClick={()=>openWorkflowScan()}><Camera size={34}/><span>اسکن دستگاه</span><small>پذیرش، تعمیر و تحویل با یک شناسه</small></button><nav className="driver-dashboard-nav">{canIntake&&<button data-pair-open="service-office-workspace:7200b5369b69" onClick={()=>{setSerial('');change('new')}}><Plus size={25}/><span>پذیرش دستگاه</span></button>}<button data-pair-open="service-office-workspace:67af6cd6d48d" onClick={()=>change('open')}><ClipboardList size={25}/><span>تعمیرات باز</span></button><button data-pair-open="service-office-workspace:39cd1ae40458" onClick={()=>change('history')}><History size={25}/><span>سوابق تعمیرات</span></button></nav><button data-pair-open="service-office-workspace:35ffc459f230" className="btn" onClick={()=>onNavigate('tasks')}>کارتابل</button></>:view==='scan'?<><CameraCodeScanner autoStart disabled={loading} onScan={scan}/><form className="tools" onSubmit={e=>{e.preventDefault();setSerial(serviceDeviceSerial(query));setSearch('');setQuery('');setPage(1);setView('serial')}}><label className="field">سریال دستگاه بدون QR<input required maxLength={160} value={query} onChange={e=>setQuery(e.target.value)}/></label><button className="btn" disabled={loading}>جست‌وجوی دستگاه</button></form>{loading&&<p role="status">در حال شناسایی دستگاه…</p>}</>:<>{view==='serial'&&<><p>سریال: <bdi>{serial}</bdi></p>{canIntake&&!loading&&!data?.activeCaseId&&<button data-pair-open="service-office-workspace:dc3e856b05ef" className="btn primary" onClick={()=>change('new')}>پذیرش نوبت جدید همین دستگاه</button>}{data?.activeCaseId&&<button data-pair-open="service-office-workspace:526cca1effab" className="btn primary" onClick={()=>onNavigate('after-sales','service-office:case:'+data.activeCaseId)}>بازکردن پروندهٔ جاری دستگاه</button>}</>}<form data-pair-open="service-office-workspace:052ecefd8fda" className="tools" onSubmit={e=>{e.preventDefault();setSearch(query.trim());setPage(1)}}><label className="field">جست‌وجوی سریال، مشتری، تلفن یا مدل<input type="search" value={query} maxLength={100} onChange={e=>setQuery(e.target.value)}/></label><button className="btn" disabled={loading}>جست‌وجو</button></form>{loading?<p role="status">در حال دریافت…</p>:data&&<>{!data.rows.length&&<p className="driver-dashboard-empty">پرونده‌ای با این مشخصات ثبت نشده است.</p>}{data.rows.map((r:any)=><button data-pair-open="service-office-workspace:62ca6e99bd88" data-pair-item={JSON.stringify([r.id])} className="driver-dashboard-row" key={r.id} onClick={()=>onNavigate('after-sales','service-office:case:'+r.id)}><strong><bdi>{r.serial}</bdi> · {r.model}</strong><span>{r.customer} · {caseStates[r.state]||r.state}</span><span>ثبت پذیرش: {serviceMoment(r.intakeAt,r.day)}</span><span>ثبت مرحلهٔ جاری: {serviceMoment(r.stageAt)}</span><span>{r.estimate===null?'هنوز برآورد نشده':Number(r.estimate).toLocaleString('fa-IR')+' ریال'}</span></button>)}{data.pages>1&&<div className="tools"><button data-pair-open="service-office-workspace:d0cddc224d95" className="btn" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>قبلی</button><span>{page} از {data.pages}</span><button data-pair-open="service-office-workspace:b59a28bba861" className="btn" disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)}>بعدی</button></div>}</>}</>}
 </section>;
}
