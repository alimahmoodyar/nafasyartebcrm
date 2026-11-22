'use client';
import {useEffect,useState} from 'react';
import {Inbox,ContactRound,Mail,Send,Bell,ListTodo,UserRound,BriefcaseBusiness,Boxes,ClipboardList,type LucideIcon} from 'lucide-react';
import type {Session} from '@/lib/permissions';
import {cartableRows,type CartableRow} from '@/lib/cartable-view';
import {PersonalHome} from './personal-home';
import {RoleTaskTools} from './role-task-tools';
import {personnelWorkEntry} from './employee-home-policy';
import './employee-self-service.css';
type App={key:string;title:string;shortTitle?:string;icon:LucideIcon};
type WorkspaceSelection={accountId:string;id:string};
type Snapshot={accessKey:string;accountId:string;tasks:CartableRow[];unread:number|null;limited:boolean};
export function EmployeeHome({user,apps,onNavigate,workspace,onWorkspaceChange}:{user:Session;apps:App[];onNavigate:(section:string,target?:string)=>void;workspace?:WorkspaceSelection|null;onWorkspaceChange?:(next:WorkspaceSelection|null)=>void}){
 const [localWorkspace,setLocalWorkspace]=useState<WorkspaceSelection|null>(null);
 const workspaces=user.assignedWorkspaces||[],selection=onWorkspaceChange?workspace:localWorkspace;
 const selectWorkspace=(id:string)=>{const next=id?{accountId:user.userId,id}:null;if(onWorkspaceChange)onWorkspaceChange(next);else setLocalWorkspace(next)};
 const active=workspaces.length===1?workspaces[0]:selection?.accountId===user.userId?workspaces.find(w=>w.id===selection.id):undefined;
 const rolePage=workspaces.length>1&&!!active;
 const covered=new Set(workspaces.flatMap(w=>w.programs));
 const accessKey=JSON.stringify([user.permissions,user.assignedWorkspaces]);
 const [summary,setSummary]=useState<Snapshot|null>(null),[error,setError]=useState(''),[version,setVersion]=useState(0);
 const personnelWork=personnelWorkEntry(user);
 const jobs=apps.flatMap(a=>a.key==='personnel'?(personnelWork?[{...a,title:personnelWork.title,shortTitle:personnelWork.title}]:[]):!['tasks','reminders','development','mobile-install'].includes(a.key)?[a]:[]).filter(a=>!covered.has(a.key));
 useEffect(()=>{
  const abort=new AbortController();setSummary(null);setError('');
  const read=async(url:string)=>{const r=await fetch(url,{cache:'no-store',headers:{'x-assistant-account':user.userId},signal:abort.signal}),d=await r.json() as any;if(!r.ok)throw Error(d.error||'دریافت خلاصه انجام نشد.');if(d.accountId&&d.accountId!==user.userId)throw Error('حساب ورود تغییر کرده است؛ صفحه را تازه کنید.');return d};
  void Promise.allSettled([read('/api/tasks'),read('/api/inbox')]).then(([tasks,inbox])=>{
   if(abort.signal.aborted)return;
   if(tasks.status==='rejected'){setError(tasks.reason.message);return;}
   setSummary({accessKey,accountId:user.userId,tasks:cartableRows(tasks.value),unread:inbox.status==='fulfilled'&&Number.isFinite(inbox.value.summary?.unread)?inbox.value.summary.unread:null,limited:!!tasks.value.limited||!!tasks.value.positionWorkHasMore});
   if(inbox.status==='rejected')setError('خلاصهٔ پیام‌ها دریافت نشد؛ پیام‌ها را در کارتابل بررسی کنید.');
  });
  const wake=()=>setVersion(v=>v+1);window.addEventListener('nafasyar-tasks-changed',wake);window.addEventListener('nafasyar-inbox-changed',wake);
  return()=>{abort.abort();window.removeEventListener('nafasyar-tasks-changed',wake);window.removeEventListener('nafasyar-inbox-changed',wake)};
 },[user.userId,accessKey,version]);
 const current=summary?.accountId===user.userId&&summary.accessKey===accessKey?summary:null;
 const open=(_row:CartableRow)=>onNavigate('tasks');
 const roleTools=<>{workspaces.length>1&&!active&&<section className="employee-workspaces" aria-label="نقش‌های من"><h3>نقش‌های من</h3><div className="employee-workspace-grid">{workspaces.map(w=><button type="button" className="employee-workspace-tile" key={w.id} onClick={()=>selectWorkspace(w.id)}><span className="employee-service-icon"><BriefcaseBusiness size={20}/></span><span><strong>{w.title}</strong><small>{w.group}</small></span></button>)}</div></section>}
  {active&&<section className="employee-workspace-tools" aria-label={'ابزارهای '+active.title}><h3>ابزارهای {active.title}</h3><div className="employee-workspace-grid">{active.links.filter((link,index,all)=>all.findIndex(other=>other.section===link.section&&(other.target||'')===(link.target||''))===index).map(link=>{const Icon=apps.find(a=>a.key===link.section)?.icon||(link.section==='assets'?Boxes:ClipboardList);return <button type="button" className="employee-workspace-tile" key={link.section+':'+(link.target||'')} onClick={()=>onNavigate(link.section,link.target)}><span className="employee-service-icon"><Icon size={20}/></span><strong>{link.title}</strong></button>})}</div><p className="employee-workspace-note">کارها و پیام‌های این نقش در «کارتابل من» پیگیری می‌شوند.</p>{rolePage&&<button type="button" className="employee-workspace-back" onClick={()=>onNavigate('tasks')}>باز کردن کارتابل من</button>}</section>}</>;
 return <section className="employee-home" dir="rtl" aria-label="خانهٔ شخصی کارکنان">
  <header className="employee-home-header"><div><h2>{active?.title||'خانهٔ من'}</h2><p>{user.name}، خوش آمدید</p></div>{rolePage&&<button type="button" className="employee-workspace-back" onClick={()=>selectWorkspace('')}>همهٔ نقش‌های من</button>}</header>
  {!rolePage&&<>
  {!jobs.length&&!user.assignedProfileIds?.length&&!user.permissions.roleAssignment?.roles?.length&&<p className="employee-home-role"><UserRound size={19}/>نقش سازمانی هنوز تخصیص داده نشده است. امکانات شغلی پس از تعیین نقش اضافه می‌شوند.</p>}
  <div className="employee-home-cards">
   <button type="button" className="employee-home-card" onClick={()=>onNavigate('tasks')}><span className="employee-service-icon"><Inbox size={20}/></span><span><strong>کارتابل من</strong><small>کارها، پیام‌ها، درخواست‌های ارسالی و یادآورها</small></span>{current&&<span className="employee-home-count" aria-label="کارهای منتظر اقدام">{current.tasks.length.toLocaleString('fa-IR')}{current.limited?' +':''}</span>}</button>
   {apps.some(a=>a.key==='personnel')&&<button type="button" className="employee-home-card" onClick={()=>onNavigate('personnel')}><span className="employee-service-icon"><ContactRound size={20}/></span><span><strong>پرسنلی من</strong><small>پرونده، حقوق و کارکرد، درخواست‌ها و اموال</small></span></button>}
  </div>
  {roleTools}

  {!rolePage&&!!jobs.length&&<section className="employee-home-work"><h3>{workspaces.length?'سایر ابزارهای مجاز':'برنامه‌های شغلی شما'}</h3><PersonalHome accountId={user.userId} name={user.name} apps={jobs} scope="employee-work" title="برنامه‌های شغلی" greeting={false} compact onNavigate={section=>onNavigate(section,section==='personnel'?personnelWork?.target:undefined)}/></section>}
  <section className="employee-home-summary"><header><h3>خلاصهٔ کارتابل</h3><button type="button" onClick={()=>onNavigate('tasks')}>مشاهدهٔ همه</button></header>
   {error&&<p role="alert" className="employee-empty">{error}<button type="button" className="btn" onClick={()=>setVersion(v=>v+1)}>تلاش دوباره</button></p>}
   {!current&&!error&&<p role="status" className="employee-empty">در حال دریافت خلاصهٔ کارتابل…</p>}
   {current?.tasks.slice(0,2).map(row=><button type="button" className="employee-home-row" key={row.id} onClick={()=>open(row)}><span className="employee-service-icon"><ListTodo size={18}/></span><span><strong>{row.title}</strong><small>{row.context}{row.review?' · منتظر بررسی شما':''}</small></span></button>)}
   {!!current?.unread&&<button type="button" className="employee-home-row" onClick={()=>onNavigate('tasks','inbox')}><span className="employee-service-icon"><Mail size={18}/></span><span><strong>{current.unread.toLocaleString('fa-IR')} گفت‌وگوی خوانده‌نشده</strong><small>پیام‌ها و درخواست‌های کاری را در کارتابل بررسی کنید.</small></span></button>}
   {current&&!current.tasks.length&&current.unread===0&&<p className="employee-empty">کاری در انتظار اقدام شما نیست و گفت‌وگوی خوانده‌نشده‌ای ندارید.</p>}
   <nav className="employee-home-actions" aria-label="بخش‌های کارتابل">{[['','منتظر اقدام',ListTodo],['inbox','پیام‌ها',Mail],['sent','ارسالی‌ها',Send],['personal-reminders','یادآورها',Bell]].map(([target,title,Icon]:any)=><button type="button" key={target} onClick={()=>onNavigate('tasks',target)}><Icon size={16}/>{title}</button>)}</nav>
   <RoleTaskTools accountId={user.userId} onNavigate={onNavigate}/>
  </section>
  <div className="employee-home-help"><p>ارسال و پاسخ پیام‌ها از بخش «پیام‌ها» در کارتابل انجام می‌شود.</p>{apps.some(a=>a.key==='mobile-install')&&<button type="button" onClick={()=>onNavigate('mobile-install')}>نصب روی گوشی</button>}</div>
  </>}
  {rolePage&&roleTools}

 </section>;
}
