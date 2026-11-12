'use client';
import {ServicePaymentsPanel} from './service-payments-panel';
import {ServicePartsPanel} from './service-parts-panel';
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
 const targetView=target.startsWith('service-parts:')?'parts':target.startsWith('service-contract:')?'contracts':target.startsWith('service-commercial:')?'commercial':'cases';
 const representativeParts=!!user.permissions.serviceAgentId&&target.startsWith('service-parts:');
 const domains=serviceReadDomains(user),roleEntry=!!user.profileReview,entryDomain=targetView!=='cases'||/^service-(report|claims|orders):/.test(target)?'home':roleEntry&&domains.length===1?domains[0]:'';
 const [domain,setDomain]=useState(entryDomain);
 const scope=[user.userId,user.profileReview?.id||'',user.profileReview?.buyerId||'',user.permissions.serviceAgentId||'',(user.permissions.serviceRoles||[]).join(',')].join(':');
 const [homeView,setHomeView]=useState(targetView);
 useEffect(()=>{setDomain(entryDomain);setHomeView(targetView);},[scope]);
 useEffect(()=>{setDomain(entryDomain);setHomeView(targetView);},[target]);
 if(target.startsWith('service-payments:'))return <ServicePaymentsPanel key={scope+':'+target} agentId={user.permissions.serviceAgentId||target.slice('service-payments:'.length)}/>;
 return <ProgramWorkspace direct={!!target||roleEntry} programId="after-sales-hub" title="خدمات پس از فروش">
  <SubprogramNavigation showLabel={!representativeParts} items={domains.map(d=>[d,serviceBranchTitles[d]] as [string,string])} value={domain} onChange={setDomain}/>
  {!domains.length&&<p className="notice">دسترسی خدمات پس از فروش برای این حساب تعریف نشده است.</p>}
  {domains.includes(domain)&&(domain==='home'?<ProgramWorkspace direct={!!target||roleEntry} programId="home-services" title={serviceBranchTitles.home}><SubprogramNavigation showLabel={!representativeParts} items={[["parts","قطعات مجاز و سفارش نمایندگی"],["cases","پرونده‌ها و عملیات خدمات"],["commercial","اعتبار و تعرفه خدمات"],...(serviceContractRights(user).read?[["contracts","قرارداد نمایندگی و تمدید"] as [string,string]]:[])]} value={homeView} onChange={setHomeView}/>{homeView==='parts'?demo?<p className="notice">برای ثبت سفارش، اطلاعات شرکت یا محیط آزمایش را انتخاب کنید.</p>:<ServicePartsPanel key={scope+':parts'} target={target}/>:homeView==='contracts'?demo?<p className="notice">برای مشاهده قرارداد، اطلاعات شرکت یا محیط آزمایش را انتخاب کنید.</p>:<ServiceContractsPanel key={scope+':contracts'} target={target}/>:homeView==='commercial'?demo?<p className="notice">برای ثبت، اطلاعات شرکت یا محیط آزمایش را انتخاب کنید.</p>:<ServiceCommercialPanel key={scope+':commercial'} target={target}/>:<AfterSalesPanel embedded={!!target||roleEntry} key={scope+':home'+(target?':'+target:'')} initialTab={/^service-(claims|orders):/.test(target)?'orders':'cases'} workTarget={target.startsWith('service-claims:')?'dashboard-claims':target.startsWith('service-orders:')?'dashboard-orders':target} domain="home" demo={demo} user={user} onNavigate={onNavigate} transportAvailable={transportAvailable}/>}</ProgramWorkspace>:<HospitalServicesWorkspace key={user.userId+':hospital'} demo={demo} user={user} onNavigate={onNavigate} transportAvailable={transportAvailable}/>)}
 </ProgramWorkspace>;
}
