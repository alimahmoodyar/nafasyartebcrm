"use client";
import {useState} from 'react';
import {jobRoles,validatePermissions,type Permissions,type RoleAssignment} from '@/lib/permissions';
import {warehouses} from '@/lib/production';
import {serviceDomains} from '@/lib/after-sales-labels';

export function JobRolePicker({permissions,onChange,salesAgents,serviceAgents}:{permissions:Permissions;onChange:(p:Permissions)=>void;salesAgents:any[];serviceAgents:any[]}) {
 const [search,setSearch]=useState('');
 const a=permissions.roleAssignment||{roles:[]};
 const selected=jobRoles.filter(r=>a.roles.includes(r.id));
 let preview:Permissions|undefined,error='';
 try{preview=validatePermissions({read:[],write:[],eventStages:[],roleAssignment:a});}catch(e){error=(e as Error).message;}
 const change=(next:RoleAssignment)=>{
  try{onChange(validatePermissions({read:[],write:[],eventStages:[],roleAssignment:next}));}
  catch{onChange({read:[],write:[],eventStages:[],roleAssignment:next});}
 };
 const toggle=(id:string,enabled:boolean)=>change({...a,roles:enabled?[...a.roles,id]:a.roles.filter(r=>r!==id)});
 const groups=[...new Set(jobRoles.map(r=>r.group))];
 return <section aria-label="انتخاب مسئولیت‌های فرد" style={{marginTop:18}}>
  <h3>این فرد چه مسئولیت‌هایی دارد؟</h3><p className="subtle">یک یا چند نقش انتخاب کنید. دسترسی کارهای مرتبط به‌صورت خودکار تنظیم می‌شود.</p>
  <label className="field">جست‌وجوی نقش<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="مثلاً انباردار، خرید، تکنسین یا اموال‌دار"/></label>
  <div style={{maxHeight:300,overflowY:'auto',padding:8,border:'1px solid var(--border)',borderRadius:12}}>
   {groups.map(group=>{const roles=jobRoles.filter(r=>r.group===group&&(!search||`${r.label} ${r.actions}`.includes(search)));return roles.length?<fieldset key={group} className="stage-permissions"><legend>{group}</legend>{roles.map(r=><label key={r.id} style={{display:'block',padding:6}}><input type="checkbox" checked={a.roles.includes(r.id)} onChange={e=>toggle(r.id,e.target.checked)}/> {r.label}</label>)}</fieldset>:null;})}
  </div>
  {selected.some(r=>r.scope==='warehouses')&&<fieldset className="stage-permissions"><legend>مسئول کدام انبارهاست؟</legend>{warehouses.map(w=><label key={w.id}><input type="checkbox" checked={(a.warehouses||[]).includes(w.id)} onChange={e=>change({...a,warehouses:e.target.checked?[...(a.warehouses||[]),w.id]:(a.warehouses||[]).filter(x=>x!==w.id)})}/>{w.name}</label>)}</fieldset>}
  {selected.some(r=>r.scope==='services')&&<fieldset className="stage-permissions"><legend>در کدام حوزه خدمات فعالیت می‌کند؟</legend>{Object.entries(serviceDomains).map(([key,label])=><label key={key}><input type="checkbox" checked={(a.serviceDomains||[]).includes(key)} onChange={e=>change({...a,serviceDomains:e.target.checked?[...(a.serviceDomains||[]),key]:(a.serviceDomains||[]).filter(x=>x!==key)})}/>{label}</label>)}</fieldset>}
  {selected.some(r=>r.scope==='salesAgent')&&<label className="field">نمایندگی فروش<select value={a.salesAgentId||''} onChange={e=>change({...a,salesAgentId:e.target.value})}><option value="">انتخاب نمایندگی</option>{salesAgents.filter(x=>x.data.active).map(x=><option key={x.id} value={x.id}>{x.data.name}</option>)}</select></label>}
  {selected.some(r=>r.scope==='serviceAgent')&&<label className="field">نمایندگی خدمات<select value={a.serviceAgentId||''} onChange={e=>{const agent=serviceAgents.find(x=>x.id===e.target.value);change({...a,serviceAgentId:e.target.value,serviceDomains:agent?[agent.data.domain]:[]});}}><option value="">انتخاب نمایندگی</option>{serviceAgents.filter(x=>x.data.active).map(x=><option key={x.id} value={x.id}>{x.data.name} · {serviceDomains[x.data.domain]}</option>)}</select></label>}
  <div className="notice" style={{marginTop:12}}><div><strong>خلاصه کارهای مجاز پس از ذخیره</strong>{selected.length?<ul>{selected.map(r=><li key={r.id}><strong>{r.label}:</strong> {r.actions}</li>)}</ul>:<p>هنوز نقشی انتخاب نشده است.</p>}{preview?.warehouses?.length?<p>انبارها: {warehouses.filter(w=>preview!.warehouses!.includes(w.id)).map(w=>w.name).join('، ')}</p>:null}{preview?.serviceDomains?.length?<p>حوزه خدمات: {preview.serviceDomains.map(d=>serviceDomains[d]).join('، ')}</p>:null}<p className="subtle">حذف نقش، مجوزهای مخصوص همان نقش را حذف می‌کند؛ دسترسی مشترک نقش‌های باقی‌مانده حفظ می‌شود.</p></div></div>
  {error&&<p role="status" className="notice error">{error}</p>}
 </section>;
}
