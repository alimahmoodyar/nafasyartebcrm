'use client';
import {useEffect,useState} from 'react';
import {ServiceContractsPanel} from './service-contracts-panel';
import {serviceContractRights} from '@/lib/service-contracts-contract';
import {ServiceCommercialPanel} from './service-commercial-panel';
import type {Session} from '@/lib/permissions';
import {serviceReadDomains,isAgent} from '@/lib/service-access';
import {serviceBranchTitles} from '@/lib/after-sales-labels';
import {AfterSalesPanel} from './after-sales-panel';
import {HospitalPanel} from './hospital-panel';
import {ProgramWorkspace,SubprogramNavigation} from './program-workspace';

type Props={target?:string;demo:boolean;user:Session;onNavigate:(section:string,target?:string)=>void;transportAvailable?:boolean};

function HospitalServicesWorkspace({demo,user,onNavigate,transportAvailable}:Props){
 const [view,setView]=useState('');
 const items:[string,string][]=[...(!isAgent(user)?[['centers','مراکز، دستگاه‌ها و پرونده‌های بیمارستانی'] as [string,string]]:[]),['partners','نمایندگان، قطعات و تعرفه‌های بیمارستانی']];
 return <ProgramWorkspace programId="hospital-services" title={serviceBranchTitles.hospital}>
  <SubprogramNavigation items={items} value={view} onChange={setView}/>
  {view==='centers'&&!isAgent(user)&&(demo?<p className="notice">برای مشاهده اطلاعات خدمات بیمارستانی، «اطلاعات شرکت» را انتخاب کنید.</p>:<HospitalPanel key={user.userId+':centers'}/>)}
  {view==='partners'&&<AfterSalesPanel key={user.userId+':hospital'} domain="hospital" demo={demo} user={user} onNavigate={onNavigate} transportAvailable={transportAvailable}/>}
 </ProgramWorkspace>;
}

export function AfterSalesHub({demo,user,onNavigate,transportAvailable,target=''}:Props){
 const targetView=target.startsWith('service-contract:')?'contracts':target.startsWith('service-commercial:')?'commercial':'cases';
 const [domain,setDomain]=useState(targetView==='cases'?'':'home'),domains=serviceReadDomains(user);
 const scope=[user.userId,user.profileReview?.id||'',user.profileReview?.buyerId||'',user.permissions.serviceAgentId||'',(user.permissions.serviceRoles||[]).join(',')].join(':');
 const [homeView,setHomeView]=useState(targetView);
 useEffect(()=>{setDomain(targetView==='cases'?'':'home');setHomeView(targetView);},[scope]);
 useEffect(()=>{if(targetView!=='cases'){setDomain('home');setHomeView(targetView);}},[target]);
 return <ProgramWorkspace programId="after-sales-hub" title="خدمات پس از فروش">
  <SubprogramNavigation items={domains.map(d=>[d,serviceBranchTitles[d]] as [string,string])} value={domain} onChange={setDomain}/>
  {!domains.length&&<p className="notice">دسترسی خدمات پس از فروش برای این حساب تعریف نشده است.</p>}
  {domains.includes(domain)&&(domain==='home'?<ProgramWorkspace programId="home-services" title={serviceBranchTitles.home}><SubprogramNavigation items={[["cases","پرونده‌ها و عملیات خدمات"],["commercial","اعتبار و تعرفه خدمات"],...(serviceContractRights(user).read?[["contracts","قرارداد نمایندگی و تمدید"] as [string,string]]:[])]} value={homeView} onChange={setHomeView}/>{homeView==='contracts'?demo?<p className="notice">برای مشاهده قرارداد، اطلاعات شرکت یا محیط آزمایش را انتخاب کنید.</p>:<ServiceContractsPanel key={scope+':contracts'} target={target}/>:homeView==='commercial'?demo?<p className="notice">برای ثبت، اطلاعات شرکت یا محیط آزمایش را انتخاب کنید.</p>:<ServiceCommercialPanel key={scope+':commercial'} target={target}/>:<AfterSalesPanel key={scope+':home'} workTarget={target} domain="home" demo={demo} user={user} onNavigate={onNavigate} transportAvailable={transportAvailable}/>}</ProgramWorkspace>:<HospitalServicesWorkspace key={user.userId+':hospital'} demo={demo} user={user} onNavigate={onNavigate} transportAvailable={transportAvailable}/>)}
 </ProgramWorkspace>;
}
