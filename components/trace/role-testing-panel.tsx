'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeftRight,Boxes,ClipboardList,Mail,Search,UserRound} from 'lucide-react';
import {batchScanCode} from '@/lib/batch-qr';
import type {RoleProfile,ProfileWork} from '@/lib/role-profiles';

type Snapshot={activeProfile?:string;profile:RoleProfile;work:ProfileWork[];unverified:string[];personalPreview:boolean};
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
 const selection=useRef(false);const id=targetId;
 useEffect(()=>{let live=true;setLoading(true);setError('');setSnapshot(null);
  fetch('/api/role-profiles'+(id?'?profile='+encodeURIComponent(id):''),{cache:'no-store'}).then(async r=>{const d=await r.json() as Snapshot&{profiles?:RoleProfile[];error?:string};if(!r.ok)throw Error(d.error||'دریافت پروفایل انجام نشد.');if(live){if(id){if(d.activeProfile!==id){if(await select(d.profile)){if(live)setSnapshot(d);}return;}setSnapshot(d);onProfile({id:d.profile.id,title:d.profile.title})}else setProfiles(d.profiles||[])}}).catch(e=>{if(live)setError(e instanceof Error?e.message:'دریافت انجام نشد.')}).finally(()=>{if(live)setLoading(false)});return()=>{live=false};
 },[id]);
 async function select(p:RoleProfile|null){if(selection.current)return false;selection.current=true;setLoading(true);setError('');try{const r=await fetch('/api/role-profiles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),mode:p?'select_profile':'exit_profile',profileId:p?.id,confirmed:true})});const d=await r.json() as any;if(!r.ok)throw Error(d.error);onProfile(p?{id:p.id,title:p.title}:null);await onAccessChanged?.();onNavigate('role-testing',p?.id||'');return true;}catch(e){setError((e as Error).message);return false;}finally{selection.current=false;setLoading(false)}}const open=(p:RoleProfile)=>void select(p);
 return <section className="panel" dir="rtl"><div className="panelhead"><div><h2>{snapshot?'پروفایل نقش '+snapshot.profile.title:'پروفایل نقش‌ها'}</h2><p className="subtle">جایگاه مستقل از شخص؛ بررسی مرحله‌به‌مرحله فرایندهای انبار و تولید</p></div>{id&&<button className="btn" onClick={()=>void select(null)}>همه نقش‌ها</button>}</div>
 <p className="notice">انتخاب پروفایل، مجوزهای سمت سرور و فرم‌ها را به همین جایگاه محدود می‌کند؛ هویت ثبت‌کننده همچنان مدیر است و حساب شخصی ساخته نمی‌شود. آزمون انتساب به فرد و مسئولیت‌های شخصی جداگانه انجام می‌شود.</p>
 {error&&<p className="notice error" role="alert">{error}<button className="btn" onClick={()=>onNavigate('role-testing')}>بازگشت به نقش‌ها</button></p>}{loading&&<p role="status">دریافت پروفایل…</p>}
 {!id&&!loading&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:16}}>{profiles.map(p=><button key={p.id} disabled={loading} className="panel inside" style={{textAlign:'right',cursor:'pointer'}} onClick={()=>open(p)}><UserRound size={26}/><h3>پروفایل نقش {p.title}</h3><p className="subtle">{p.group} · {p.operational?'کارتابل و عملیات':'پروفایل شخصی'}</p><span>باز کردن پروفایل</span></button>)}</div>}
 {snapshot&&<>
  {snapshot.profile.id==='central-store'&&<BatchLookup/>}
  <button className="panel inside" style={{cursor:"pointer",textAlign:"right",width:"100%"}} onClick={()=>onNavigate("tasks")}><ClipboardList size={28}/><h3>کارتابل ({snapshot.work.length.toLocaleString("fa-IR")})</h3><p>پیام‌های مستقیم و کارهای فرایندی این جایگاه</p><span>باز کردن کارتابل</span></button>
  <button type="button" className="btn" onClick={()=>onNavigate("tasks","inbox")}><Mail size={18}/>صندوق پیام آزمایشی</button>
  {!snapshot.profile.operational?<div className="inside"><h3>پروفایل شخصی</h3><p>کارکرد، فیش حقوقی، مرخصی، مساعده، شرح وظایف و اموال امانی در این پروفایل قرار می‌گیرند. نمایش اطلاعات شخصی پس از اتصال فرد انجام می‌شود؛ برای این جایگاه فعلاً کارتابل عملیاتی تعریف نشده است.</p></div>:<>
  <h3><Boxes size={20} style={{display:'inline',marginLeft:8}}/>عملیات و فرم‌ها</h3><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>{snapshot.profile.links.map((a,i)=><button className="btn" key={i} onClick={()=>onNavigate(a.section,a.target)}>{a.title}<ArrowLeftRight size={16}/></button>)}</div>
  </>}
  {(snapshot.profile.gaps.length>0||snapshot.unverified.length>0)&&<details style={{marginTop:24}}><summary>بخش‌های نیازمند تکمیل و آزمون</summary>{[...snapshot.profile.gaps,...snapshot.unverified].map((gap,i)=><p className="notice" key={i}>{gap}</p>)}</details>}
 </>}
 </section>;
}
