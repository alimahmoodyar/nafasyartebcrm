'use client';
import {BriefcaseBusiness,CalendarDays,ClipboardList,ClipboardPlus,ContactRound,House,Landmark,Package,ShoppingCart,UsersRound,Wallet,WalletCards} from 'lucide-react';
import './employee-self-service.css';

const groups=[
 {key:'information',title:'اطلاعات و مدارک',description:'مشخصات، قرارداد و مسئولیت‌ها',icon:ContactRound,views:['personal_contact','personal_documents','personal_duties']},
 {key:'pay',title:'حقوق و کارکرد',description:'فیش حقوقی و حضور',icon:WalletCards,views:['personal_payroll','personal_hours']},
 {key:'requests',title:'درخواست‌ها',description:'ثبت درخواست شخصی',icon:ClipboardPlus,views:['personal_requests','personal_family','personal_leave','personal_missions','personal_advance','personal_loan','personal_purchase','personal_tracking']},
 {key:'assets',title:'اموال من',description:'اعلام و تحویل اموال',icon:Package,views:['personal_assets']}
];
const requests=[
 {key:'personal_leave',title:'مرخصی',icon:CalendarDays},
 {key:'personal_missions',title:'مأموریت کاری',icon:BriefcaseBusiness},
 {key:'personal_advance',title:'مساعده',icon:Wallet},
 {key:'personal_loan',title:'وام',icon:Landmark},
 {key:'personal_purchase',title:'خرید کالا یا خدمت',icon:ShoppingCart},
 {key:'personal_family',title:'تغییر وضعیت خانوادگی',icon:UsersRound},
];

export function PersonnelRequestPicker({onChange}:{onChange:(value:string)=>void}){
 return <section className="panel inside employee-request-picker" aria-labelledby="employee-request-picker-title">
  <h3 id="employee-request-picker-title">انتخاب نوع درخواست</h3>
  <div className="employee-request-grid">
   {requests.map(({key,title,icon:Icon})=><button key={key} type="button" className="employee-request-tile" onClick={()=>onChange(key)}>
    <span className="employee-service-icon"><Icon size={22} aria-hidden="true"/></span>
    <span>{title}</span>
   </button>)}
  </div>
 </section>;
}

export function PersonnelMobileNavigation({value,contact,onChange}:{value:string;contact:boolean;onChange:(value:string)=>void}){
 const group=groups.find(item=>item.views.includes(value))?.key;
 const items=[
  {key:'home',target:'personal_home',title:'خانه',icon:House},
  {key:'requests',target:'personal_tracking',title:'درخواست‌ها',icon:ClipboardList},
  {key:'pay',target:'personal_hours',title:'کارکرد و حقوق',icon:WalletCards},
  {key:'information',target:contact?'personal_contact':'personal_documents',title:'پروندهٔ من',icon:ContactRound},
 ];
 const current=value==='personal_home'?'home':group;
 return <nav className="employee-personnel-mobile-nav" aria-label="بخش‌های پرتال پرسنلی">
  {items.map(({key,target,title,icon:Icon})=><button key={key} type="button" aria-current={current===key?'page':undefined} onClick={()=>onChange(target)}>
   <Icon size={19} aria-hidden="true"/><span>{title}</span>
  </button>)}
 </nav>;
}
export function PersonnelNavigation({value,onChange,contact=false,canManage=false,onTrack}:{value:string;onChange:(value:string)=>void;contact?:boolean;canManage?:boolean;onTrack?:()=>void}){
 const group=groups.find(g=>g.views.includes(value));
 const tabs=group?.key==='information'?[...(contact?[['personal_contact','اطلاعات تماس']]:[]),['personal_documents','مدارک و قراردادها'],['personal_duties','شرح وظایف']]:group?.key==='pay'?[['personal_payroll','فیش‌های حقوقی'],['personal_hours','کارکرد و تردد']]:[];
 return <div className="employee-personnel-navigation">
  <nav className="employee-personnel-groups" aria-label="خدمات شخصی پرسنل">{groups.map(g=><button key={g.key} type="button" className={'employee-personnel-group'+(g===group?' selected':'')} aria-current={g===group?'page':undefined} onClick={()=>onChange(g.key==='information'?(contact?'personal_contact':'personal_documents'):g.views[0])}><span className="employee-service-icon"><g.icon size={21}/></span><span><strong>{g.title}</strong><small>{g.description}</small></span></button>)}</nav>
  <div className="employee-personnel-subnav">
   {value!=='personal_home'&&<button className="employee-personnel-desktop-home" type="button" onClick={()=>onChange('personal_home')}>خانهٔ پرتال</button>}
   {!!tabs.length&&<nav aria-label="گزینه‌های این بخش">{tabs.map(([key,title])=><button type="button" key={key} aria-pressed={value===key} onClick={()=>onChange(key)}>{title}</button>)}</nav>}
   {requests.some(request=>request.key===value)&&<button type="button" onClick={()=>onChange('personal_requests')}>بازگشت به انواع درخواست</button>}
   {value==='personal_requests'&&<button type="button" onClick={()=>onChange('personal_tracking')}>درخواست‌های من</button>}
   <div className="employee-personnel-links"><button className="employee-track-link" type="button" onClick={()=>onTrack?onTrack():onChange('personal_tracking')}>پیگیری درخواست‌ها در کارتابل</button>{canManage&&<button type="button" aria-pressed={value==='management'} onClick={()=>onChange('management')}>امور اداری و مدیریت پرسنل</button>}</div>
  </div>
 </div>;
}
