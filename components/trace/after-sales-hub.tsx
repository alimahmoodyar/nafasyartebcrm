'use client';
import {useState} from 'react';
import type {Session} from '@/lib/permissions';
import {serviceReadDomains,isAgent} from '@/lib/service-access';
import {serviceBranchTitles} from '@/lib/after-sales-labels';
import {AfterSalesPanel} from './after-sales-panel';
import {HospitalPanel} from './hospital-panel';
import {ProgramWorkspace,SubprogramNavigation} from './program-workspace';

type Props={demo:boolean;user:Session;onNavigate:(section:string,target?:string)=>void;transportAvailable?:boolean};

function HospitalServicesWorkspace({demo,user,onNavigate,transportAvailable}:Props){
 const [view,setView]=useState('');
 const items:[string,string][]=[...(!isAgent(user)?[['centers','مراکز، دستگاه‌ها و پرونده‌های بیمارستانی'] as [string,string]]:[]),['partners','نمایندگان، قطعات و تعرفه‌های بیمارستانی']];
 return <ProgramWorkspace programId="hospital-services" title={serviceBranchTitles.hospital}>
  <SubprogramNavigation items={items} value={view} onChange={setView}/>
  {view==='centers'&&!isAgent(user)&&(demo?<p className="notice">برای مشاهده اطلاعات خدمات بیمارستانی، «اطلاعات شرکت» را انتخاب کنید.</p>:<HospitalPanel key={user.userId+':centers'}/>)}
  {view==='partners'&&<AfterSalesPanel key={user.userId+':hospital'} domain="hospital" demo={demo} user={user} onNavigate={onNavigate} transportAvailable={transportAvailable}/>}
 </ProgramWorkspace>;
}

export function AfterSalesHub({demo,user,onNavigate,transportAvailable}:Props){
 const [domain,setDomain]=useState(''),domains=serviceReadDomains(user);
 return <ProgramWorkspace programId="after-sales-hub" title="خدمات پس از فروش">
  <SubprogramNavigation items={domains.map(d=>[d,serviceBranchTitles[d]] as [string,string])} value={domain} onChange={setDomain}/>
  {!domains.length&&<p className="notice">دسترسی خدمات پس از فروش برای این حساب تعریف نشده است.</p>}
  {domains.includes(domain)&&(domain==='home'?<AfterSalesPanel key={user.userId+':home'} domain="home" demo={demo} user={user} onNavigate={onNavigate} transportAvailable={transportAvailable}/>:<HospitalServicesWorkspace key={user.userId+':hospital'} demo={demo} user={user} onNavigate={onNavigate} transportAvailable={transportAvailable}/>)}
 </ProgramWorkspace>;
}
