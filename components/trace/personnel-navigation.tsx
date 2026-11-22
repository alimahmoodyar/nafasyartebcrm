'use client';
import {ContactRound,WalletCards,ClipboardPlus,Package} from 'lucide-react';
import './employee-self-service.css';

const groups=[
 {key:'information',title:'اطلاعات و مدارک',description:'مشخصات، قرارداد و مسئولیت‌ها',icon:ContactRound,views:['personal_contact','personal_documents','personal_duties']},
 {key:'pay',title:'حقوق و کارکرد',description:'فیش حقوقی و حضور',icon:WalletCards,views:['personal_payroll','personal_hours']},
 {key:'requests',title:'درخواست‌ها',description:'ثبت درخواست شخصی',icon:ClipboardPlus,views:['personal_requests','personal_family','personal_leave','personal_missions','personal_advance','personal_loan','personal_purchase','personal_tracking']},
 {key:'assets',title:'اموال من',description:'اعلام و تحویل اموال',icon:Package,views:['personal_assets']}
];
const requests=[['personal_requests','انتخاب نوع درخواست'],['personal_leave','مرخصی'],['personal_missions','مأموریت کاری'],['personal_advance','مساعده'],['personal_loan','وام'],['personal_purchase','خرید کالا یا خدمت'],['personal_family','اعلام تغییر وضعیت خانوادگی']];
export function PersonnelNavigation({value,onChange,contact=false,canManage=false,onTrack}:{value:string;onChange:(value:string)=>void;contact?:boolean;canManage?:boolean;onTrack?:()=>void}){
 const group=groups.find(g=>g.views.includes(value));
 const tabs=group?.key==='information'?[...(contact?[['personal_contact','اطلاعات تماس']]:[]),['personal_documents','مدارک و قراردادها'],['personal_duties','شرح وظایف']]:group?.key==='pay'?[['personal_payroll','فیش‌های حقوقی'],['personal_hours','کارکرد و تردد']]:[];
 return <div className="employee-personnel-navigation">
  <nav className="employee-personnel-groups" aria-label="خدمات شخصی پرسنل">{groups.map(g=><button key={g.key} type="button" className={'employee-personnel-group'+(g===group?' selected':'')} aria-current={g===group?'page':undefined} onClick={()=>onChange(g.key==='information'?(contact?'personal_contact':'personal_documents'):g.views[0])}><span className="employee-service-icon"><g.icon size={21}/></span><span><strong>{g.title}</strong><small>{g.description}</small></span></button>)}</nav>
  <div className="employee-personnel-subnav">
   {!!tabs.length&&<nav aria-label="گزینه‌های این بخش">{tabs.map(([key,title])=><button type="button" key={key} aria-pressed={value===key} onClick={()=>onChange(key)}>{title}</button>)}</nav>}
   {group?.key==='requests'&&<label className="employee-request-kind">نوع درخواست<select aria-label="نوع درخواست شخصی" value={requests.some(([key])=>key===value)?value:'personal_requests'} onChange={e=>onChange(e.target.value)}>{requests.map(([key,title])=><option value={key} key={key}>{title}</option>)}</select></label>}
   <div className="employee-personnel-links"><button type="button" onClick={()=>onTrack?onTrack():onChange('personal_tracking')}>پیگیری درخواست‌ها در کارتابل</button>{canManage&&<button type="button" aria-pressed={value==='management'} onClick={()=>onChange('management')}>امور اداری و مدیریت پرسنل</button>}</div>
  </div>
 </div>;
}
