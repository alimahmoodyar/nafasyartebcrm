'use client';

import {Building2,ClipboardList,History,House,Inbox,ListChecks,Truck} from 'lucide-react';
import {useState} from 'react';
import {domesticSourcingTabs,type DomesticSourcingTab} from './domestic-sourcing-panel';
import {useWorkspaceBack} from './program-workspace';
import {SourcingPanel} from './sourcing-panel';
import {SupplierPanel} from './supplier-panel';
import './domestic-supply-home.css';

type View='home'|'suppliers'|DomesticSourcingTab;
const icons={inbox:Inbox,needs:ListChecks,quotes:ClipboardList,orders:Truck,history:History};

export function DomesticSupplyHome({canOpenCatalog,onNavigate,onExit,firstTask,loading,error}:{
 canOpenCatalog:boolean;
 onNavigate:(section:string,target?:string)=>void;
 onExit?:()=>void;
 firstTask?:string;
 loading:boolean;
 error?:string;
}){
 const [view,setView]=useState<View>('home');
 const backRef=useWorkspaceBack(()=>setView('home'),view!=='home',50);
 const actions=[
  {id:'home' as const,title:'خانهٔ نقش',Icon:House},
  ...(canOpenCatalog?[{id:'suppliers' as const,title:'تأمین‌کنندگان',Icon:Building2}]:[]),
  ...domesticSourcingTabs.map(([id,title])=>({id,title,Icon:icons[id]})),
 ];
 return <section className="domestic-supply-home" dir="rtl" aria-label="کارشناس تأمین داخلی">
  <header className="domestic-supply-heading">
   <h1>کارشناس تأمین داخلی</h1>
   {onExit&&<button type="button" className="btn" onClick={onExit}>بازگشت به خانهٔ من</button>}
  </header>
  <div className="domestic-supply-layout" ref={backRef}>
   <nav aria-label="ابزارهای تأمین داخلی">
    {actions.map(({id,title,Icon})=><button type="button" className="btn" key={id} aria-current={view===id?'page':undefined} onClick={()=>setView(id)}>
     <Icon size={18} aria-hidden="true"/>{title}
    </button>)}
   </nav>
   <div className="domestic-supply-content">
    {view==='home'?<>
     {canOpenCatalog&&<section className="domestic-supply-intro">
      <span className="domestic-supply-icon"><Building2 size={22} aria-hidden="true"/></span>
      <h2>تأمین‌کنندگان</h2>
      <p>پروندهٔ فروشنده یا سازنده و کالاهای مرتبط را در این بخش پیدا کنید.</p>
      <button type="button" className="btn" onClick={()=>setView('suppliers')}>مشاهدهٔ تأمین‌کنندگان</button>
     </section>}
     <section className="panel inside domestic-supply-work">
      <div className="domestic-supply-heading"><h2>کارتابل بازرگانی داخلی</h2><button type="button" className="btn" onClick={()=>setView('inbox')}>مشاهدهٔ کارتابل بازرگانی</button></div>
      {firstTask&&<p>{firstTask}</p>}
      {!firstTask&&loading&&!error&&<p role="status">در حال دریافت کارتابل…</p>}
      {error&&<p role="alert">{error}</p>}
      {!firstTask&&!loading&&!error&&<p>کاری در انتظار اقدام نیست.</p>}
      <button type="button" className="btn" onClick={()=>onNavigate('tasks')}>کارها و پیام‌ها</button>
     </section>
    </>:view==='suppliers'?canOpenCatalog&&<SupplierPanel routeScope="domestic"/>:
       <SourcingPanel key={view} demo={false} domesticTab={view} onNavigate={onNavigate}/>}
   </div>
  </div>
 </section>;
}
