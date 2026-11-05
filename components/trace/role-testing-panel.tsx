'use client';
import {useEffect,useState} from 'react';
import {FlaskConical,Search,UserRound,ArrowLeftRight,ClipboardList} from 'lucide-react';
import {NumberInput} from '@/components/trace/number-input';

type Role={id:string;label:string;group:string;actions:string;memberIds:string[]};
type Member={id:string;name:string;unit:string;username:string;roles:string[]};
export function RoleTestingPanel(){
 const [roles,setRoles]=useState<Role[]>([]),[members,setMembers]=useState<Member[]>([]),[search,setSearch]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState('');
 async function load(){setLoading(true);setError('');try{const r=await fetch('/api/role-preview',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'دریافت نقش‌ها انجام نشد.');setRoles(d.roles||[]);setMembers(d.members||[])}catch(e){setError(e instanceof Error?e.message:'دریافت نقش‌ها انجام نشد.')}finally{setLoading(false)}}
 useEffect(()=>{void load()},[]);
 async function enter(member:Member){if(busy)return;setBusy(member.id);setError('');try{const r=await fetch('/api/role-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({memberId:member.id})}),d=await r.json();if(!r.ok)throw Error(d.error||'ورود آزمایشی انجام نشد.');window.location.reload()}catch(e){setError(e instanceof Error?e.message:'ورود آزمایشی انجام نشد.');setBusy('')}}
 const q=search.trim().toLocaleLowerCase();
 const filtered=roles.filter(role=>{const attached=members.filter(m=>role.memberIds.includes(m.id));return !q||`${role.label} ${role.group} ${attached.map(m=>m.name+' '+m.unit+' '+m.username).join(' ')}`.toLocaleLowerCase().includes(q)});
 return <section className="panel" dir="rtl"><div className="panelhead"><div><h2><FlaskConical size={22} style={{display:'inline',verticalAlign:'middle',marginLeft:8}}/>نقش‌های آزمایشی</h2><p className="subtle">با حساب فعال هر نقش وارد کارتابل و فرم‌های واقعی همان نقش شوید.</p></div><button className="btn" onClick={()=>void load()} disabled={loading}>تازه‌سازی نقش‌ها</button></div>
  <div className="notice" style={{marginBlock:16}}><strong>داده‌های فعلی سامانه برای آزمایش هستند.</strong> این محیط دادهٔ جداگانه نمی‌سازد؛ ثبت یا تغییرهایی که انجام می‌دهید در همین داده‌های مشترک ذخیره می‌شوند و با مجوزهای حساب انتخاب‌شده کنترل می‌شوند. برای هر مرحله، کارتابل همان نقش را باز کنید و سپس برای رفتن به نقش بعد، «پایان آزمایش نقش» را بزنید.</div>
  <label className="personal-home-search"><Search size={18}/><NumberInput fieldKey="role-test-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="جست‌وجو بر اساس نقش، نام فرد یا واحد…" aria-label="جست‌وجوی نقش آزمایشی"/></label>
  {error&&<p className="notice error" role="alert">{error}</p>}{loading?<p className="empty">در حال دریافت نقش‌ها…</p>:!filtered.length?<p className="empty">نقشی مطابق جست‌وجو پیدا نشد.</p>:<div className="role-test-grid">{filtered.map(role=>{const assigned=members.filter(m=>role.memberIds.includes(m.id));return <article className="panel inside" key={role.id} style={{marginTop:14}}><div style={{display:'flex',gap:12,alignItems:'flex-start'}}><span className="personal-app-icon color-2"><UserRound size={24}/></span><div><h3 style={{marginTop:0}}>{role.label}</h3><p className="subtle">{role.group}</p>{role.actions&&<p>{role.actions}</p>}</div></div>
    {assigned.length?<div className="role-test-members">{assigned.map(member=><div className="recordline" key={member.id}><div><strong>{member.name}</strong><p className="subtle">{member.unit}{member.username?' · '+member.username:''}</p></div><button className="btn primary" disabled={!!busy} onClick={()=>void enter(member)}>{busy===member.id?'در حال ورود…':'آزمایش این نقش'}<ArrowLeftRight size={16}/></button></div>)}</div>:<p className="notice" style={{marginTop:14}}>برای این نقش حساب فعال متصل نیست. ابتدا در «کاربران و دسترسی‌ها» یک حساب با همین نقش بسازید.</p>}
    </article>})}</div>}
  <p className="subtle" style={{marginTop:20}}><ClipboardList size={16} style={{display:'inline',verticalAlign:'middle',marginLeft:6}}/>پس از ورود، آیکون «کارتابل» نقش را باز کنید؛ وظایف و ثبت‌ها با هویت همان حساب انجام می‌شوند.</p>
 </section>
}
