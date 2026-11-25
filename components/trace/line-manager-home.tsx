import {Barcode,Boxes,CalendarDays,FolderKanban} from 'lucide-react';
import {useId,type ReactNode} from 'react';
import type {RoleProfile} from '@/lib/role-profiles';
import './line-manager-home.css';

type Work = {id:string;title:string;context?:string;reference?:string;section?:string;target?:string};
type Props = {
  profile:RoleProfile;
  work:readonly Work[];
  loading:boolean;
  error?:string;
  limited?:boolean;
  onExit?:()=>void;
  onNavigate:(section:string,target?:string)=>void;
};

export function LineManagerHome(props:Props){
  const tools = [
    {section:'routine-production',target:'',icon:CalendarDays,hint:'کارتابل تولید، کارهای روزانه و سوابق'},
    {section:'routine-production',target:'worker-custody',icon:Boxes,hint:'ذخیره، شمارش، تحویل و برگشت مواد'},
    {section:'build-projects',icon:FolderKanban,hint:'سفارش ساخت، تجهیزات، اجرا و تطبیق'},
    {section:'warehouse',icon:Barcode,hint:'محصول نهایی، مونتاژ و گزارش کیفیت'},
  ];
  return <OperationalRoleHome {...props}>
    <section aria-label="ابزارهای نقش">
      <h2>ابزارهای نقش</h2>
      <div className="line-manager-grid">{tools.map(({section,target,icon:Icon,hint})=>{
        const link=props.profile.links.find(link=>link.section===section&&(target===undefined||(link.target||'')===target));
        return link&&<button type="button" className="line-manager-tile" key={section+(target??'')} onClick={()=>props.onNavigate(link.section,link.target)}>
          <span className="line-manager-icon"><Icon size={20} aria-hidden="true"/></span>
          <strong>{link.title}</strong><small>{hint}</small>
        </button>;
      })}</div>
    </section>
  </OperationalRoleHome>;
}

export function OperationalRoleHome({profile,work,loading,error,limited,onExit,onNavigate,children,groupLabel=profile.group}:Props&{children:ReactNode;groupLabel?:string}){
  const titleId=useId(),cartableId=useId();
  return <section className="line-manager-home" dir="rtl" aria-labelledby={titleId}>
    <header className="line-manager-hero">
      <div><p>خانهٔ نقش · {groupLabel}</p><h1 id={titleId}>{profile.title}</h1></div>
      {onExit&&<button type="button" className="btn role-home-exit" onClick={onExit}>بازگشت به خانهٔ من</button>}
    </header>
    {children}
    <section aria-labelledby={cartableId}>
      <div className="line-manager-heading">
        <h2 id={cartableId}>کارتابل نقش</h2>
        <button type="button" className="btn" onClick={()=>onNavigate('tasks')}>مشاهده همهٔ کارها</button>
      </div>
      <div className="line-manager-queue">
        <h3>کارهای منتظر اقدام</h3>
        {loading&&<p role="status">در حال دریافت کارتابل…</p>}
        {error&&<p role="alert">{error}</p>}
        {!loading&&!error&&!work.length&&<p>کاری در انتظار اقدام نیست.</p>}
        {work.slice(0,3).map(item=><div className="line-manager-job" key={item.id}>
          <div><strong>{item.title}</strong>{(item.reference||item.context)&&<small>{[item.context,item.reference].filter(Boolean).join(' · ')}</small>}</div>
          <button type="button" className="btn" onClick={()=>onNavigate(item.section||'tasks',item.target)} aria-label={'باز کردن کار: '+item.title}>باز کردن کار</button>
        </div>)}
        {limited&&<p className="subtle">بقیهٔ کارها در کارتابل نقش در دسترس‌اند.</p>}
      </div>
    </section>
  </section>;
}
