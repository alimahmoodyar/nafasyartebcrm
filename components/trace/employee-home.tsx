'use client';
import {useEffect,useState} from 'react';
import {Inbox,ContactRound,Mail,Send,Bell,ListTodo,UserRound,type LucideIcon} from 'lucide-react';
import type {Session} from '@/lib/permissions';
import {cartableRows,type CartableRow} from '@/lib/cartable-view';
import {PersonalHome} from './personal-home';
import {RoleTaskTools} from './role-task-tools';
import './employee-self-service.css';
type App={key:string;title:string;shortTitle?:string;icon:LucideIcon};
type Snapshot={accountId:string;tasks:CartableRow[];unread:number|null;limited:boolean};
export function EmployeeHome({user,apps,onNavigate}:{user:Session;apps:App[];onNavigate:(section:string,target?:string)=>void}){
 const [summary,setSummary]=useState<Snapshot|null>(null),[error,setError]=useState(''),[version,setVersion]=useState(0);
 const jobs=apps.filter(a=>!['tasks','personnel','reminders','development','mobile-install'].includes(a.key));
 useEffect(()=>{
  const abort=new AbortController();setSummary(null);setError('');
  const read=async(url:string)=>{const r=await fetch(url,{cache:'no-store',headers:{'x-assistant-account':user.userId},signal:abort.signal}),d=await r.json() as any;if(!r.ok)throw Error(d.error||'دریافت خلاصه انجام نشد.');if(d.accountId&&d.accountId!==user.userId)throw Error('حساب ورود تغییر کرده است؛ صفحه را تازه کنید.');return d};
  void Promise.allSettled([read('/api/tasks'),read('/api/inbox')]).then(([tasks,inbox])=>{
   if(abort.signal.aborted)return;
   if(tasks.status==='rejected'){setError(tasks.reason.message);return;}
   setSummary({accountId:user.userId,tasks:cartableRows(tasks.value),unread:inbox.status==='fulfilled'&&Number.isFinite(inbox.value.summary?.unread)?inbox.value.summary.unread:null,limited:!!tasks.value.limited||!!tasks.value.positionWorkHasMore});
   if(inbox.status==='rejected')setError('خلاصهٔ پیام‌ها دریافت نشد؛ پیام‌ها را در کارتابل بررسی کنید.');
  });
  const wake=()=>setVersion(v=>v+1);window.addEventListener('nafasyar-tasks-changed',wake);window.addEventListener('nafasyar-inbox-changed',wake);
  return()=>{abort.abort();window.removeEventListener('nafasyar-tasks-changed',wake);window.removeEventListener('nafasyar-inbox-changed',wake)};
 },[user.userId,version]);
 const current=summary?.accountId===user.userId?summary:null;
 const open=(_row:CartableRow)=>onNavigate('tasks');
 return <section className="employee-home" dir="rtl" aria-label="خانهٔ شخصی کارکنان">
  <header className="employee-home-header"><div><h2>سلام، {user.name}</h2><p>پیام‌ها و امور شخصی شما، در دو جای مشخص.</p></div></header>
  {!jobs.length&&!user.permissions.roleAssignment?.roles?.length&&<p className="employee-home-role"><UserRound size={19}/>نقش سازمانی هنوز تخصیص داده نشده است. امکانات شغلی پس از تعیین نقش اضافه می‌شوند.</p>}
  <div className="employee-home-cards">
   <button type="button" className="employee-home-card" onClick={()=>onNavigate('tasks')}><span className="employee-service-icon"><Inbox size={23}/></span><span><strong>کارتابل</strong><small>کارها، پیام‌ها، درخواست‌های ارسالی و یادآورها</small></span>{current&&<span className="employee-home-count" aria-label="کارهای منتظر اقدام">{current.tasks.length.toLocaleString('fa-IR')}{current.limited?' +':''}</span>}</button>
   {apps.some(a=>a.key==='personnel')&&<button type="button" className="employee-home-card" onClick={()=>onNavigate('personnel')}><span className="employee-service-icon"><ContactRound size={23}/></span><span><strong>پرسنلی من</strong><small>پرونده، حقوق و کارکرد، درخواست‌ها و اموال</small></span></button>}
  </div>
  <section className="employee-home-summary"><header><h3>خلاصهٔ کارتابل</h3><button type="button" onClick={()=>onNavigate('tasks')}>مشاهدهٔ همه</button></header>
   {error&&<p role="alert" className="employee-empty">{error}<button type="button" className="btn" onClick={()=>setVersion(v=>v+1)}>تلاش دوباره</button></p>}
   {!current&&!error&&<p role="status" className="employee-empty">در حال دریافت خلاصهٔ کارتابل…</p>}
   {current?.tasks.slice(0,2).map(row=><button type="button" className="employee-home-row" key={row.id} onClick={()=>open(row)}><span className="employee-service-icon"><ListTodo size={18}/></span><span><strong>{row.title}</strong><small>{row.context}{row.review?' · منتظر بررسی شما':''}</small></span></button>)}
   {!!current?.unread&&<button type="button" className="employee-home-row" onClick={()=>onNavigate('tasks','inbox')}><span className="employee-service-icon"><Mail size={18}/></span><span><strong>{current.unread.toLocaleString('fa-IR')} گفت‌وگوی خوانده‌نشده</strong><small>پیام‌ها و درخواست‌های کاری را در کارتابل بررسی کنید.</small></span></button>}
   {current&&!current.tasks.length&&current.unread===0&&<p className="employee-empty">کاری در انتظار اقدام شما نیست و گفت‌وگوی خوانده‌نشده‌ای ندارید.</p>}
   <nav className="employee-home-actions" aria-label="بخش‌های کارتابل">{[['','منتظر اقدام',ListTodo],['inbox','پیام‌ها',Mail],['sent','ارسالی‌ها',Send],['personal-reminders','یادآورها',Bell]].map(([target,title,Icon]:any)=><button type="button" key={target} onClick={()=>onNavigate('tasks',target)}><Icon size={16}/>{title}</button>)}</nav>
  </section>
  <div className="employee-home-help"><p>ارسال و پاسخ پیام‌ها از بخش «پیام‌ها» در کارتابل انجام می‌شود.</p>{apps.some(a=>a.key==='mobile-install')&&<button type="button" onClick={()=>onNavigate('mobile-install')}>نصب روی گوشی</button>}</div>
  {!!jobs.length&&<section className="employee-home-work"><h3>برنامه‌های شغلی شما</h3><PersonalHome accountId={user.userId} name={user.name} apps={jobs} scope="employee-work" title="برنامه‌های شغلی" greeting={false} compact onNavigate={onNavigate}/><RoleTaskTools accountId={user.userId} onNavigate={onNavigate}/></section>}
 </section>;
}
