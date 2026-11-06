'use client';
import {useEffect,useState} from 'react';
import {ArrowLeftRight,Boxes,ClipboardList,UserRound} from 'lucide-react';
import type {RoleProfile,ProfileWork} from '@/lib/role-profiles';

type Snapshot={profile:RoleProfile;work:ProfileWork[];unverified:string[];personalPreview:boolean};
export function RoleTestingPanel({targetId='',onNavigate,onProfile}:{targetId?:string;onNavigate:(section:string,target?:string)=>void;onProfile:(profile:{id:string;title:string}|null)=>void}){
 const [profiles,setProfiles]=useState<RoleProfile[]>([]),[snapshot,setSnapshot]=useState<Snapshot|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const id=targetId;
 useEffect(()=>{let live=true;setLoading(true);setError('');setSnapshot(null);
  fetch('/api/role-profiles'+(id?'?profile='+encodeURIComponent(id):''),{cache:'no-store'}).then(async r=>{const d=await r.json() as Snapshot&{profiles?:RoleProfile[];error?:string};if(!r.ok)throw Error(d.error||'دریافت پروفایل انجام نشد.');if(live){if(id){setSnapshot(d);onProfile({id:d.profile.id,title:d.profile.title})}else setProfiles(d.profiles||[])}}).catch(e=>{if(live)setError(e instanceof Error?e.message:'دریافت انجام نشد.')}).finally(()=>{if(live)setLoading(false)});return()=>{live=false};
 },[id]);
 const open=(p:RoleProfile)=>{onProfile({id:p.id,title:p.title});onNavigate('role-testing',p.id)};
 return <section className="panel" dir="rtl"><div className="panelhead"><div><h2>{snapshot?'پروفایل نقش '+snapshot.profile.title:'پروفایل نقش‌ها'}</h2><p className="subtle">جایگاه مستقل از شخص؛ بررسی مرحله‌به‌مرحله فرایندهای انبار و تولید</p></div>{id&&<button className="btn" onClick={()=>{onProfile(null);onNavigate('role-testing')}}>همه نقش‌ها</button>}</div>
 <p className="notice">عملیات روی داده‌های آزمایشی همین سامانه و با حساب مدیر انجام می‌شود. انتخاب پروفایل، حساب شخصی نمی‌سازد و هویت مدیر را تغییر نمی‌دهد. این بررسی گردش کار است؛ آزمون مجوز کاربران واقعی در مرحله اتصال اشخاص انجام خواهد شد.</p>
 {error&&<p className="notice error" role="alert">{error}<button className="btn" onClick={()=>onNavigate('role-testing')}>بازگشت به نقش‌ها</button></p>}{loading&&<p role="status">دریافت پروفایل…</p>}
 {!id&&!loading&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:16}}>{profiles.map(p=><button key={p.id} className="panel inside" style={{textAlign:'right',cursor:'pointer'}} onClick={()=>open(p)}><UserRound size={26}/><h3>پروفایل نقش {p.title}</h3><p className="subtle">{p.group} · {p.operational?'کارتابل و عملیات':'پروفایل شخصی'}</p><span>باز کردن پروفایل</span></button>)}</div>}
 {snapshot&&<>
  {!snapshot.profile.operational?<div className="inside"><h3>پروفایل شخصی</h3><p>کارکرد، فیش حقوقی، مرخصی، مساعده، شرح وظایف و اموال امانی در این پروفایل قرار می‌گیرند. نمایش اطلاعات شخصی پس از اتصال فرد انجام می‌شود؛ برای این جایگاه فعلاً کارتابل عملیاتی تعریف نشده است.</p></div>:<>
  <h3><Boxes size={20} style={{display:'inline',marginLeft:8}}/>عملیات و فرم‌ها</h3><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>{snapshot.profile.links.map((a,i)=><button className="btn" key={i} onClick={()=>onNavigate(a.section,a.target)}>{a.title}<ArrowLeftRight size={16}/></button>)}</div>
  <h3 style={{marginTop:28}}><ClipboardList size={20} style={{display:'inline',marginLeft:8}}/>کارتابل فرایندی این جایگاه ({snapshot.work.length.toLocaleString('fa-IR')})</h3><p className="subtle">فهرست از مرحله فعلی پرونده‌ها خوانده می‌شود؛ پس از انجام عملیات در فرم اصلی و بازگشت به پروفایل به‌روز می‌شود. در نقش‌های انبار فعلاً همه انبارها دیده می‌شوند و تفکیک مرکزی/خط به تنظیم محدوده نیاز دارد.</p>
  {snapshot.work.length?snapshot.work.map(w=><div className="recordline" key={w.id}><div><strong>{w.title}</strong><p className="subtle">مرجع: {w.sourceId}</p></div><button className="btn primary" onClick={()=>onNavigate(w.section,w.target)}>باز کردن پرونده</button></div>):<p className="empty">در شاخه‌های متصل‌شده، پرونده بازی برای این جایگاه نیست.</p>}
  </>}
  {(snapshot.profile.gaps.length>0||snapshot.unverified.length>0)&&<details style={{marginTop:24}}><summary>بخش‌های نیازمند تکمیل و آزمون</summary>{[...snapshot.profile.gaps,...snapshot.unverified].map((gap,i)=><p className="notice" key={i}>{gap}</p>)}</details>}
 </>}
 </section>;
}
