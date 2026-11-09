'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeftRight,Boxes,ClipboardList,Search,UserRound} from 'lucide-react';
import {batchScanCode} from '@/lib/batch-qr';
import type {RoleProfile,ProfileWork} from '@/lib/role-profiles';

type Snapshot={activeProfile?:string;profile:RoleProfile;work:ProfileWork[];unverified:string[];personalPreview:boolean;buyerId?:string;buyerChoices?:{id:string;name:string}[];sample?:boolean};
function BatchLookup(){
 const [open,setOpen]=useState(false),[value,setValue]=useState(''),[error,setError]=useState('');
 const input=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{if(open)input.current?.focus()},[open]);
 const code=batchScanCode(value);
 const valid=/^\d{2,12}-\d{8}-\d{3,16}$/.test(code);
 function lookup(){
  if(!valid){
   setError('شمارهٔ کامل بچ را وارد کنید یا لیبل بچ را دوباره اسکن کنید.');
   return;
  }
  window.location.assign('/b/'+encodeURIComponent(code));
 }
 return <div>
  <button type="button" className="btn" aria-expanded={open} onClick={()=>setOpen(!open)}><Search size={18}/>اسکن یا جست‌وجوی بچ</button>
  {open&&<form onSubmit={event=>{event.preventDefault();lookup()}}>
   <label className="field">شمارهٔ کامل بچ
    <textarea ref={input} dir="ltr" rows={2} maxLength={3000} value={value}
     onChange={event=>{setValue(event.target.value);setError('')}}
     onKeyDown={event=>{if(valid&&event.key==='Enter'&&!event.nativeEvent.isComposing){event.preventDefault();lookup()}}}/>
   </label>
   {error&&<p role="alert">{error}</p>}
   <button type="submit" className="btn">مشاهدهٔ شناسنامهٔ بچ</button>
  </form>}
 </div>;
}
export function RoleTestingPanel({targetId='',onNavigate,onProfile,onAccessChanged}:{targetId?:string;onNavigate:(section:string,target?:string)=>void;onProfile:(profile:{id:string;title:string}|null)=>void;onAccessChanged?:()=>Promise<void>}){
 const [profiles,setProfiles]=useState<RoleProfile[]>([]),[snapshot,setSnapshot]=useState<Snapshot|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const [choosing,setChoosing]=useState<RoleProfile|null>(null),[choices,setChoices]=useState<{id:string;name:string}[]>([]),[buyer,setBuyer]=useState('');
 const selection=useRef(false);const id=targetId;
 useEffect(()=>{let live=true;setLoading(true);setError('');setSnapshot(null);
  fetch('/api/role-profiles'+(id?'?profile='+encodeURIComponent(id):''),{cache:'no-store'}).then(async r=>{const d=await r.json() as Snapshot&{profiles?:RoleProfile[];error?:string};if(!r.ok)throw Error(d.error||'دریافت پروفایل انجام نشد.');if(live){if(id){if(d.activeProfile!==id){if(d.profile.missionScope){setChoosing(d.profile);setChoices(d.buyerChoices||[]);return;}await select(d.profile);return;}setSnapshot(d);onProfile({id:d.profile.id,title:d.profile.title})}else setProfiles(d.profiles||[])}}).catch(e=>{if(live)setError(e instanceof Error?e.message:'دریافت انجام نشد.')}).finally(()=>{if(live)setLoading(false)});return()=>{live=false};
 },[id]);
 async function select(p:RoleProfile|null,buyerId=''){if(selection.current)return false;selection.current=true;setLoading(true);setError('');try{const r=await fetch('/api/role-profiles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),mode:p?'select_profile':'exit_profile',profileId:p?.id,buyerId,confirmed:true})});const d=await r.json() as any;if(!r.ok)throw Error(d.error);setChoosing(null);setBuyer('');onProfile(p?{id:p.id,title:p.title}:null);await onAccessChanged?.();if(p&&id===p.id){const fresh=await fetch('/api/role-profiles?profile='+encodeURIComponent(id),{cache:'no-store'});const next=await fresh.json() as Snapshot&{error?:string};if(!fresh.ok)throw Error(next.error);setSnapshot(next);}onNavigate('role-testing',p?.id||'');return true;}catch(e){setError((e as Error).message);return false;}finally{selection.current=false;setLoading(false)}}async function open(p:RoleProfile,chooseScope=false){
  if(!chooseScope&&!p.missionScope){void select(p);return;}
  setChoosing(p);setChoices([]);setBuyer('');setError('');setLoading(true);
  try{const r=await fetch('/api/role-profiles?profile='+encodeURIComponent(p.id),{cache:'no-store'}),d=await r.json() as Snapshot&{error?:string};if(!r.ok)throw Error(d.error);setChoices(d.buyerChoices||[]);}
  catch(error){setError((error as Error).message);}finally{setLoading(false);}
 }
 return <section className="panel" dir="rtl"><div className="panelhead"><div><h2>{snapshot?'پروفایل نقش '+snapshot.profile.title:'پروفایل نقش‌ها'}</h2><p className="subtle">جایگاه مستقل از شخص؛ بررسی مرحله‌به‌مرحله فرایندهای فروش، انبار و تولید</p></div>{id&&<button className="btn" onClick={()=>void select(null)}>همه نقش‌ها</button>}</div>
 <p className="notice">انتخاب پروفایل، مجوزهای سمت سرور و فرم‌ها را به همین جایگاه محدود می‌کند؛ هویت ثبت‌کننده همچنان مدیر است و حساب شخصی ساخته نمی‌شود. آزمون انتساب به فرد و مسئولیت‌های شخصی جداگانه انجام می‌شود.</p>
 {error&&<p className="notice error" role="alert">{error}<button className="btn" onClick={()=>onNavigate('role-testing')}>بازگشت به نقش‌ها</button></p>}{loading&&<p role="status">دریافت پروفایل…</p>}
 {choosing&&!loading&&<section className="inside"><h3>{choosing.title}</h3><p>این انتخاب فقط محدودهٔ پروندهٔ آزمایشی را تعیین می‌کند و کسی را به نقش منتسب نمی‌کند.</p><label className="field">{choosing.missionScope?'مأموریت حمل':'پرونده خریدار'}<select value={buyer} onChange={e=>setBuyer(e.target.value)}><option value="">{choosing.missionScope?'ورود بدون مأموریت':'ورود بدون انتخاب پرونده'}</option>{choices.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label><div className="tools"><button className="btn primary" onClick={()=>void select(choosing,buyer)}>ورود به پروفایل</button><button className="btn" onClick={()=>{setChoosing(null);if(id&&!snapshot)onNavigate('role-testing');}}>بازگشت</button></div></section>}
 {!id&&!choosing&&!loading&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:16}}>{profiles.map(p=><button key={p.id} disabled={loading} className="panel inside" style={{textAlign:'right',cursor:'pointer'}} onClick={()=>open(p)}><UserRound size={26}/><h3>پروفایل نقش {p.title}</h3><p className="subtle">{p.group} · {p.operational?'کارتابل و عملیات':'پروفایل شخصی'}</p><span>باز کردن پروفایل</span></button>)}</div>}
 {snapshot&&!choosing&&<>
  {snapshot.sample&&<p className="notice">محیط آزمایشی نقش نماینده فروش. سفارش‌ها و ثبت‌های این بخش نمونه‌اند و به نماینده‌ای تخصیص داده نمی‌شوند.</p>}
  {(snapshot.profile.buyerScope==='optional'||snapshot.profile.missionScope)&&<div className="tools"><p>{snapshot.buyerChoices?.find(b=>b.id===snapshot.buyerId)?.name||(snapshot.profile.missionScope?'پیش‌نمایش بدون مأموریت':'پیش‌نمایش بدون پرونده خریدار')}</p><button className="btn" onClick={()=>void open(snapshot.profile,true)}>{snapshot.profile.missionScope?'تغییر مأموریت':snapshot.buyerId?'تغییر پرونده خریدار':'انتخاب پرونده خریدار'}</button></div>}
  {snapshot.profile.id==='central-store'&&<BatchLookup/>}
  <button className="panel inside" disabled={loading} style={{cursor:"pointer",textAlign:"right",width:"100%"}} onClick={()=>onNavigate("tasks")}><ClipboardList size={28}/><h3>کارتابل ({snapshot.work.length.toLocaleString("fa-IR")})</h3><p>پیام‌های مستقیم و کارهای فرایندی این جایگاه</p></button>
  {!snapshot.profile.operational?<div className="inside"><h3>پروفایل شخصی</h3><p>کارکرد، فیش حقوقی، مرخصی، مساعده، شرح وظایف و اموال امانی در این پروفایل قرار می‌گیرند. نمایش اطلاعات شخصی پس از اتصال فرد انجام می‌شود؛ برای این جایگاه فعلاً کارتابل عملیاتی تعریف نشده است.</p></div>:<>
  <h3><Boxes size={20} style={{display:'inline',marginLeft:8}}/>شروع کار و گزارش‌ها</h3><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>{snapshot.profile.links.map((a,i)=><button className="btn" key={i} disabled={loading} onClick={()=>onNavigate(a.section,a.target||(snapshot.profile.missionScope&&a.section==='transport'?snapshot.buyerId:undefined))}>{a.title}<ArrowLeftRight size={16}/></button>)}</div>
  </>}
  {(snapshot.profile.gaps.length>0||snapshot.unverified.length>0)&&<details style={{marginTop:24}}><summary>بخش‌های نیازمند تکمیل و آزمون</summary>{[...snapshot.profile.gaps,...snapshot.unverified].map((gap,i)=><p className="notice" key={i}>{gap}</p>)}</details>}
 </>}
 </section>;
}
