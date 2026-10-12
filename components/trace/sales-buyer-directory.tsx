'use client';
import {useState,type ReactNode} from 'react';
import {searchBuyers} from '@/lib/buyer-search';
import {partnerKinds} from '@/lib/sales-network-contract';
import {NumberInput} from './number-input';
import {useWorkspaceBack} from './program-workspace';

export function SalesBuyerDirectory({agents,members,initialBuyerId='',createAction,renderDossier}:{agents:any[];members:any[];initialBuyerId?:string;createAction?:ReactNode;renderDossier:(buyer:any)=>ReactNode}){
 const [opened,setOpened]=useState(initialBuyerId),[query,setQuery]=useState(''),[kind,setKind]=useState(''),[status,setStatus]=useState('');
 const buyer=agents.find(a=>a.id===opened),back=()=>setOpened(''),backRef=useWorkspaceBack(back,!!opened,200);
 const owner=(a:any)=>members.find(m=>m.id===a.data.ownerId)?.name||'بدون کارشناس مشخص';
 const choices=agents.filter(a=>(!kind||(a.data.kind||'representative')===kind)&&(!status||(status==='active')===!!a.data.active)).map(a=>({id:a.id,name:a.data.name,detail:[a.data.contact,a.data.mobile,a.data.phone,a.data.province,a.data.city,owner(a),partnerKinds[a.data.kind||'representative']].filter(Boolean).join(' ')}));
 const visible=new Set(searchBuyers(choices,query).map(a=>a.id));
 const rows=agents.filter(a=>visible.has(a.id)).sort((a,b)=>a.data.name.localeCompare(b.data.name,'fa'));
 return <section className="sales-buyer-directory" ref={backRef} aria-label="خریداران و نمایندگان">
  {opened?<>
   <div className="tools"><button type="button" className="btn" onClick={back}>فهرست خریداران و نمایندگان</button>{buyer&&<span className="subtle">پروندهٔ {buyer.data.name}</span>}</div>
   {buyer?renderDossier(buyer):<p role="alert">این پرونده در فهرست فعلی شما نیست؛ فهرست را تازه‌سازی کنید یا به فهرست خریداران برگردید.</p>}
  </>:<>
   <div className="sales-buyer-directory-heading"><div><h3>خریداران و نمایندگان</h3><p className="subtle">هر شخص یک پرونده دارد؛ برای دیدن اطلاعات، تماس‌ها، پیگیری‌ها و حساب، پرونده‌اش را باز کنید.</p></div>{createAction}</div>
   <div className="sales-buyer-directory-filters">
    <label className="field">جست‌وجوی نام، تماس، شهر یا کارشناس<NumberInput fieldKey="buyerSearch" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <label className="field">نوع خریدار<select value={kind} onChange={e=>setKind(e.target.value)}><option value="">همه انواع</option>{Object.entries(partnerKinds).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label className="field">وضعیت پرونده<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">فعال و غیرفعال</option><option value="active">فعال</option><option value="inactive">غیرفعال</option></select></label>
   </div>
   <p role="status">{rows.length.toLocaleString('fa-IR')} پرونده از {agents.length.toLocaleString('fa-IR')}</p>
   <div className="sales-buyer-directory-list">{rows.map(a=><article className="sales-buyer-directory-card" key={a.id}>
    <div className="sales-partner-heading"><h4>{a.data.name}</h4><span className="badge">{a.data.active?'فعال':'غیرفعال'}</span></div>
    <p>{partnerKinds[a.data.kind||'representative']||'خریدار'}{a.data.province&&' · '+a.data.province}{a.data.city&&' / '+a.data.city}</p>
    {(a.data.contact||a.data.mobile||a.data.phone)&&<p>{a.data.contact} · <bdi>{a.data.mobile||a.data.phone}</bdi></p>}
    <p className="subtle">کارشناس: {owner(a)}</p>
    <button type="button" className="btn" aria-label={'باز کردن پروندهٔ '+a.data.name} onClick={()=>setOpened(a.id)}>باز کردن پرونده</button>
   </article>)}</div>
   {!rows.length&&<p className="empty">{agents.length?'با این جست‌وجو یا فیلتر، پرونده‌ای پیدا نشد.':'پرونده‌ای در دسترسی شما نیست.'}</p>}
  </>}
 </section>;
}
