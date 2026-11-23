'use client';
import {useEffect,useState} from 'react';
import {Inbox,ContactRound,Mail,Send,Bell,ListTodo,UserRound,BriefcaseBusiness,Boxes,ClipboardList,type LucideIcon} from 'lucide-react';
import type {Session} from '@/lib/permissions';
import {cartableRows,type CartableRow} from '@/lib/cartable-view';
import {roleProfiles} from '@/lib/role-profiles';
import {RoleTestingPanel} from './role-testing-panel';
import {ServiceOfficeWorkspace} from './service-office-workspace';
import {CentralWarehouseMenu} from './central-warehouse-menu';
import {PersonalHome} from './personal-home';
import {RoleTaskTools} from './role-task-tools';
import {ServiceRepresentativeDashboard} from './service-representative-dashboard';
import {SalesPanel} from './sales-panel';
import {selectedEmployeeWorkspace,personnelWorkEntry} from './employee-home-policy';
import './employee-self-service.css';
type App={key:string;title:string;shortTitle?:string;icon:LucideIcon};
type WorkspaceSelection={accountId:string;id:string};
type Snapshot={accessKey:string;accountId:string;tasks:CartableRow[];unread:number|null;limited:boolean};
export function EmployeeHome({user,apps,onNavigate,workspace,onWorkspaceChange,warehouseMenu='',onWarehouseMenuChange}:{user:Session;apps:App[];onNavigate:(section:string,target?:string)=>void;workspace?:WorkspaceSelection|null;onWorkspaceChange?:(next:WorkspaceSelection|null)=>void;warehouseMenu?:string;onWarehouseMenuChange?:(id:string)=>void}){
 const [localWorkspace,setLocalWorkspace]=useState<WorkspaceSelection|null>(null);
 const workspaces=user.assignedWorkspaces||[],selection=onWorkspaceChange?workspace:localWorkspace;
 const selectWorkspace=(id:string)=>{const next={accountId:user.userId,id:id||'personal'};if(onWorkspaceChange)onWorkspaceChange(next);else setLocalWorkspace(next)};
 const active=selectedEmployeeWorkspace(user,selection);
 const warehouseMenus=active?.menus;
 const warehouseTools=warehouseMenus?.length&&onWarehouseMenuChange?<CentralWarehouseMenu menus={warehouseMenus} activeId={warehouseMenu} onSelect={onWarehouseMenuChange} onNavigate={onNavigate}/>:null;
 const scope=active?.id||'personal';
 const query=workspaces.length?'?workspace='+encodeURIComponent(scope):'';
 const covered=new Set(workspaces.flatMap(w=>w.programs));
 const accessKey=JSON.stringify([scope,user.permissions,user.assignedWorkspaces]);
 const [summary,setSummary]=useState<Snapshot|null>(null),[error,setError]=useState(''),[version,setVersion]=useState(0);
 const personnelWork=personnelWorkEntry(user);
 const jobs=apps.flatMap(a=>a.key==='personnel'?(personnelWork?[{...a,title:personnelWork.title,shortTitle:personnelWork.title}]:[]):!['tasks','reminders','development','mobile-install'].includes(a.key)?[a]:[]).filter(a=>!covered.has(a.key));
 useEffect(()=>{
  const abort=new AbortController();setSummary(null);setError('');
  const read=async(url:string)=>{const r=await fetch(url,{cache:'no-store',headers:{'x-assistant-account':user.userId},signal:abort.signal}),d=await r.json() as any;if(!r.ok)throw Error(d.error||'دریافت خلاصه انجام نشد.');if(d.accountId&&d.accountId!==user.userId)throw Error('حساب ورود تغییر کرده است؛ صفحه را تازه کنید.');return d};
  void Promise.allSettled([read('/api/tasks'+query),read('/api/inbox?channel=direct')]).then(([tasks,inbox])=>{
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
 const roleTools=<>{workspaces.length>0&&!active&&<section className="employee-workspaces" aria-label="نقش‌های من"><h3>نقش‌های من</h3><div className="employee-workspace-grid">{workspaces.map(w=><button type="button" className="employee-workspace-tile" key={w.id} onClick={()=>selectWorkspace(w.id)}><span className="employee-service-icon"><BriefcaseBusiness size={20}/></span><span><strong>{w.title}</strong><small>{w.group}</small></span></button>)}</div></section>}
  </>;
 const profile=active&&roleProfiles.find(p=>p.id===active.id);
 if(active&&profile)return <section dir="rtl">
  <button type="button" className="btn" onClick={()=>selectWorkspace('')}>بازگشت به خانهٔ من</button>
  <RoleTestingPanel assigned={{profile:{...profile,links:active.links},count:current?.tasks.length||0,exit:()=>selectWorkspace('')}} targetId={active.id} onNavigate={onNavigate} onProfile={()=>{}} representativeDashboard={<SalesPanel demo={false} targetId="rep-dashboard" onNavigate={onNavigate}/>} serviceRepresentativeDashboard={<ServiceRepresentativeDashboard user={user} onNavigate={onNavigate}/>} centralWarehouseTools={warehouseTools} officeServiceDashboard={<ServiceOfficeWorkspace user={user} onNavigate={onNavigate}/>}/>
  {['personnel-hr','home-service','home-service-customer-support','home-service-technician','driver','sales-representative','home-service-representative'].includes(active.id)&&<button className="btn primary" onClick={()=>onNavigate('tasks')}>کارتابل {active.title}</button>}
  <RoleTaskTools accountId={user.userId} workspace={active.id} onNavigate={onNavigate}/>
 </section>;
 return <section className="employee-home" dir="rtl" aria-label="خانهٔ شخصی کارکنان">
  <header className="employee-home-header"><div><h2>{'خانهٔ من'}</h2><p>{user.name}، خوش آمدید</p></div></header>

  {!jobs.length&&!user.assignedProfileIds?.length&&!user.permissions.roleAssignment?.roles?.length&&<p className="employee-home-role"><UserRound size={19}/>نقش سازمانی هنوز تخصیص داده نشده است. امکانات شغلی پس از تعیین نقش اضافه می‌شوند.</p>}
  <div className="employee-home-cards">
   <button type="button" className="employee-home-card" onClick={()=>onNavigate('tasks')}><span className="employee-service-icon"><Inbox size={20}/></span><span><strong>کارتابل من</strong><small>کارها، پیام‌ها، درخواست‌های ارسالی و یادآورها</small></span>{current&&<span className="employee-home-count" aria-label="کارهای منتظر اقدام">{current.tasks.length.toLocaleString('fa-IR')}{current.limited?' +':''}</span>}</button>
   {apps.some(a=>a.key==='personnel')&&<button type="button" className="employee-home-card" onClick={()=>onNavigate('personnel')}><span className="employee-service-icon"><ContactRound size={20}/></span><span><strong>پرسنلی من</strong><small>پرونده، حقوق و کارکرد، درخواست‌ها و اموال</small></span></button>}
  </div>
  {roleTools}

  {!!jobs.length&&<section className="employee-home-work"><h3>{workspaces.length?'سایر ابزارهای مجاز':'برنامه‌های شغلی شما'}</h3><PersonalHome accountId={user.userId} name={user.name} apps={jobs} scope="employee-work" title="برنامه‌های شغلی" greeting={false} compact onNavigate={section=>onNavigate(section,section==='personnel'?personnelWork?.target:undefined)}/></section>}
  <section className="employee-home-summary"><header><h3>خلاصهٔ کارتابل</h3><button type="button" onClick={()=>onNavigate('tasks')}>مشاهدهٔ همه</button></header>
   {error&&<p role="alert" className="employee-empty">{error}<button type="button" className="btn" onClick={()=>setVersion(v=>v+1)}>تلاش دوباره</button></p>}
   {!current&&!error&&<p role="status" className="employee-empty">در حال دریافت خلاصهٔ کارتابل…</p>}
   {current?.tasks.slice(0,2).map(row=><button type="button" className="employee-home-row" key={row.id} onClick={()=>open(row)}><span className="employee-service-icon"><ListTodo size={18}/></span><span><strong>{row.title}</strong><small>{row.context}{row.review?' · منتظر بررسی شما':''}</small></span></button>)}
   {!!current?.unread&&<button type="button" className="employee-home-row" onClick={()=>onNavigate('tasks','inbox')}><span className="employee-service-icon"><Mail size={18}/></span><span><strong>{current.unread.toLocaleString('fa-IR')} گفت‌وگوی خوانده‌نشده</strong><small>پیام‌ها و درخواست‌های کاری را در کارتابل بررسی کنید.</small></span></button>}
   {current&&!current.tasks.length&&current.unread===0&&<p className="employee-empty">کاری در انتظار اقدام شما نیست و گفت‌وگوی خوانده‌نشده‌ای ندارید.</p>}
   <nav className="employee-home-actions" aria-label="بخش‌های کارتابل">{[['','منتظر اقدام',ListTodo],['inbox','پیام‌ها',Mail],['sent','ارسالی‌ها',Send],['personal-reminders','یادآورها',Bell]].map(([target,title,Icon]:any)=><button type="button" key={target} onClick={()=>onNavigate('tasks',target)}><Icon size={16}/>{title}</button>)}</nav>
   {!workspaces.length&&<RoleTaskTools accountId={user.userId} onNavigate={onNavigate}/>}
  </section>
  <div className="employee-home-help"><p>ارسال و پاسخ پیام‌ها از بخش «پیام‌ها» در کارتابل انجام می‌شود.</p>{apps.some(a=>a.key==='mobile-install')&&<button type="button" onClick={()=>onNavigate('mobile-install')}>نصب روی گوشی</button>}</div>


 </section>;
}
