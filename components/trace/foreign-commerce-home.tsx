'use client';

import {Building2,ContactRound,Inbox,Ship,type LucideIcon} from 'lucide-react';
import type {RoleProfile} from '@/lib/role-profiles';
import './employee-self-service.css';

export function ForeignCommerceHome({profile,name,count,limited,personnel,onNavigate}:{profile:RoleProfile;name?:string;count:number;limited?:boolean;personnel?:boolean;onNavigate:(section:string,target?:string)=>void}){
 const suppliers=profile.links.find(link=>link.target==='supplier-history:');
 const trade=profile.links.find(link=>link.target==='foreign:');
 const card=(Icon:LucideIcon,title:string,description:string,section:string,target?:string)=>
  <button type="button" className="employee-home-card" onClick={()=>onNavigate(section,target)}>
   <span className="employee-service-icon"><Icon size={20}/></span>
   <span><strong>{title}</strong><small>{description}</small></span>
  </button>;
 return <section className="employee-home" dir="rtl" aria-label={profile.title}>
  <header className="employee-home-header">
   <div><h2>{profile.title}</h2>{name&&<p>خانهٔ من · {name}</p>}</div>
  </header>
  <div className="employee-home-cards">
   {suppliers&&card(Building2,'تأمین‌کنندگان و سوابق خرید خارجی','پروندهٔ تأمین‌کننده، کالاهای متصل و خریدهای قبلی',suppliers.section,suppliers.target)}
   {trade&&card(Ship,'پرونده‌های بازرگانی خارجی','انتخاب منبع و نمونه، خرید و حمل، ارز و مجوز',trade.section,trade.target)}
   {card(Inbox,'کارتابل من',`${count.toLocaleString('fa-IR')}${limited?' +':''} کار منتظر اقدام`,'tasks')}
   {personnel&&card(ContactRound,'پرسنلی من','پروندهٔ پرسنلی و درخواست‌های من','personnel')}
  </div>
 </section>;
}
