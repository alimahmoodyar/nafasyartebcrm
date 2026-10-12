"use client";

import {useState, type ReactNode} from 'react';
import {Box, ClipboardCheck, Factory, ShieldCheck, Truck, Users, Wrench, LockKeyhole, Search, type LucideIcon} from 'lucide-react';
import {modules, stages, validatePermissions, type Permissions, type Session} from '@/lib/permissions';
import {manualPermissionSections} from '@/lib/manual-permissions-catalog';
import {canOpenSection} from '@/lib/navigation-access';
import {qmsRoles} from '@/lib/qms-contract';
import {assetRoles} from '@/lib/assets-contract';
import {personnelRoles} from '@/lib/personnel-contract';
import {salesRoles} from '@/lib/sales-contract';
import {transportRoles} from '@/lib/transport-contract';
import {serviceRoles, serviceDomains} from '@/lib/after-sales-labels';
import {supplyRoles} from '@/lib/sourcing-labels';
import {warehouses} from '@/lib/production';
import {names, type Kind} from '@/lib/model';

type GrantKey = 'treasuryWorkflowRoles'|'assetRoles'|'qmsRoles'|'personnelRoles'|'salesRoles'|'transportRoles'|'serviceRoles'|'serviceDomains'|'supplyRoles'|'flowRoles'|'financialRead'|'financialWrite';
const treasuryRoles = {treasury:'خزانه‌دار؛ اجرای پرداخت مجاز و ثبت چک، تنخواه و ضمانت‌نامه',manager:'مدیر مالی؛ بررسی مالی مستقل و بررسی ضمانت‌نامه',accountant:'رئیس حسابداری؛ تطبیق صورتحساب و کنترل حسابداری',ceo:'مدیرعامل؛ صدور مجوز نهایی پرداخت'};
const flowRoles = {inventory:'انبار؛ دریافت، جانمایی و تحویل مواد',qc:'کنترل کیفیت؛ بررسی ورودی و نتیجه آزمون',production:'تولید؛ مصرف مواد، مونتاژ و بسته‌بندی',procurement:'تأمین؛ پیگیری خرید مواد',sales:'فروش؛ تحویل محصول و پیگیری ارسال',logistics:'تدارکات؛ پیگیری گردش و حمل مواد'};
const financialDomains = [
 {id:'costing',title:'بهای تمام‌شده',description:'مشاهده بهای مواد و هزینه ساخت؛ این دسترسی، پیشنهاد قیمت و سود و اطلاعات مالی پروژه‌های ساخت را نیز قابل مشاهده می‌کند.'},
 {id:'control',title:'کنترل مالی',description:'مشاهده کنترل‌های مالی و مستندات همان بخش؛ ثبت، اجازه بارگذاری و ثبت بررسی مالی را نیز می‌دهد.'},
 {id:'transport',title:'مالی حمل‌ونقل',description:'مشاهده مأموریت‌ها، هزینه‌های حمل و مدارک هزینه؛ ثبت و بررسی، اجازه تأیید یا رد هزینه‌ها را نیز می‌دهد. ثبت اولیه هزینه با راننده مأموریت است.'},
] as const;
const traceHelp:Record<Kind,string> = {
 product:'شناسنامه محصول، مشخصات پایه و BOM؛ اختیار تأیید تغییر مهندسی جداگانه است.',
 batch:'مشخصات بچ قطعات و مدارک ورودی؛ این مشاهده، آیکون انبارها و موجودی را نیز نمایش می‌دهد.',
 device:'شناسنامه دستگاه و سریال‌ها؛ مشاهده گزارش تولید و فعال‌سازی نیز از همین دسترسی است.',
 event:'رویدادهای تولید و تحویل؛ برای ثبت، مراحل مجاز را پایین همین کارت مشخص کنید.',
 service:'سوابق خدمات قبلی دستگاه؛ عملیات پرونده‌های جدید از کارت خدمات پس از فروش تنظیم می‌شود.',
 action:'مشاهده و ثبت اقدامات اصلاحی مرتبط با دستگاه‌ها.',
 distribution:'اطلاعات نماینده و مشتری و توزیع دستگاه؛ مشاهده دستگاه نیز لازم است.',
 firmware:'نسخه‌ها و فایل نرم‌افزار دستگاه؛ مشاهده شامل دریافت فایل HEX هم می‌شود.',
};
const cardStyle = {border:'1px solid var(--border)',borderRadius:14,padding:16,background:'#fff',minWidth:0} as const;
const checkboxStyle = {width:18,height:18,padding:0,flexShrink:0,accentColor:'#16804a'} as const;
const gridStyle = {display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,285px),1fr))',gap:14} as const;

function AccessCard({id,title,icon:Icon,description,children,disabled=false}:{id:string;title:string;icon:LucideIcon;description:string;children:ReactNode;disabled?:boolean}) {
 return <fieldset id={'manual-'+id} style={{...cardStyle,opacity:disabled ? .55 : 1}} disabled={disabled}>
  <legend style={{display:'flex',alignItems:'center',gap:8,padding:'0 6px',fontWeight:600,color:'#293c6b'}}><Icon size={21} aria-hidden="true"/>{title}</legend>
  <p className="subtle" style={{fontSize:13,margin:'4px 0 12px',lineHeight:1.8}}>{description}</p>{children}
 </fieldset>;
}

/** Every displayed choice writes a validated, domain-scoped permission. */
export function ManualPermissionsPicker({permissions:p,onChange,salesAgents,serviceAgents}:{permissions:Permissions;onChange:(p:Permissions)=>void;salesAgents:any[];serviceAgents:any[]}) {
 const [search,setSearch] = useState('');
 const external = !!(p.hospitalCenterId||p.salesAgentId||p.serviceAgentId||p.salesRoles?.includes('agent')||p.serviceRoles?.includes('agent'));
 let preview = p,error = '';
 try {preview=validatePermissions(p);}catch(e){error=(e as Error).message;}
 // A pending representative selection must not preview internal company icons.
 const previewPermissions = {...preview,...(p.salesRoles?.includes('agent')&&!p.salesAgentId?{salesAgentId:'pending'}:{}),...(p.serviceRoles?.includes('agent')&&!p.serviceAgentId?{serviceAgentId:'pending'}:{})};
 const user:Session = {userId:'manual-preview',email:'',name:'پیش‌نمایش',isAdmin:false,permissions:previewPermissions};
 const visible = (key:string)=>canOpenSection(user,key)&&(!p.hospitalCenterId||['hospital','reminders'].includes(key));
 const matches = (...values:string[])=>!search||values.join(' ').replace(/\u200c/g,' ').includes(search.replace(/\u200c/g,' '));
 const selectedCount = p.read.length+p.write.length+p.eventStages.length+(p.warehouses?.length||0)+(['treasuryWorkflowRoles','assetRoles','qmsRoles','personnelRoles','salesRoles','transportRoles','serviceRoles','serviceDomains','supplyRoles','flowRoles','financialRead','financialWrite'] as GrantKey[]).reduce((n,key)=>n+(p[key]?.length||0),0);
 const visibleCount = manualPermissionSections.filter(s=>!('ownerOnly' in s)&&visible(s.key)).length;
 const matchingGroup = (id:string,title:string,labels:Record<string,string>={})=>matches(title,...Object.values(labels),...manualPermissionSections.filter(s=>'group' in s&&(s.group===id||id==='trace-product'&&s.group==='trace')).map(s=>s.title));
 const toggle = (key:GrantKey,value:string,enabled:boolean)=>{
  const values = p[key]||[];
  onChange({...p,[key]:enabled?[...new Set([...values,value])]:values.filter(x=>x!==value)});
 };
 const choices = (key:GrantKey,labels:Record<string,string>,prefix:string)=>Object.entries(labels).map(([value,label])=><label key={value} style={{display:'flex',alignItems:'flex-start',gap:9,padding:'7px 0',fontSize:14,lineHeight:1.8}}><input type="checkbox" style={{...checkboxStyle,marginTop:4}} aria-label={prefix+'؛ '+label} checked={(p[key]||[]).includes(value)} onChange={e=>toggle(key,value,e.target.checked)}/><span>{label}</span></label>);
 const traceToggle = (kind:Kind,operation:'read'|'write',enabled:boolean)=>{
  const next:Permissions = {...p,read:[...p.read],write:[...p.write],eventStages:[...p.eventStages]};
  next[operation]=enabled?[...new Set([...next[operation],kind])]:next[operation].filter(k=>k!==kind);
  if(operation==='read'&&!enabled)next.write=next.write.filter(k=>k!==kind);
  if(operation==='read'&&enabled&&kind==='distribution')next.read=[...new Set([...next.read,'device' as Kind])];
  if(operation==='write'&&enabled){
   next.read=[...new Set([...next.read,kind,...(['event','service','action','distribution'].includes(kind)?['device','batch'] as Kind[]:[])])];
   if(kind==='device')next.read=[...new Set([...next.read,'product' as Kind])];
   if(kind==='event'&&!next.eventStages.length)next.eventStages=[...stages];
  }
  if(!next.write.includes('event'))next.eventStages=[];
  onChange(next);
 };
 const selectExternal = (kind:'sales'|'service',enabled:boolean)=>onChange(enabled?(kind==='sales'?{read:[],write:[],eventStages:[],salesRoles:['agent'],salesAgentId:''}:{read:[],write:[],eventStages:[],serviceRoles:['agent'],serviceDomains:['home'],serviceAgentId:''}):{read:[],write:[],eventStages:[]});
 const internalServices:Record<string,string> = {...serviceRoles,logistics:'تدارکات خدمات'};delete internalServices.agent;
 const internalSales = {...salesRoles};delete internalSales.agent;
 return <section aria-label="تنظیم دستی همه دسترسی‌ها" style={{marginTop:20}}>
  <h3>دسترسی‌ها را خودتان انتخاب کنید</h3><p className="subtle">برای هر بخش، فقط کارهای موردنیاز این فرد را تیک بزنید. آیکون‌های زیر، نتیجه همین انتخاب‌ها را پیش از ذخیره نشان می‌دهند. روی نام هر بخش بزنید تا به گزینه‌های دسترسی آن برسید.</p>
  <p role="status" className="subtle" aria-label="خلاصه انتخاب دستی">{selectedCount} گزینه انتخاب‌شده · {visibleCount} آیکون قابل نمایش پس از ذخیره</p>
  <label className="field" style={{margin:'14px 0'}}>جست‌وجوی بخش یا دسترسی<div style={{display:'flex',alignItems:'center',gap:10}}><Search size={20} aria-hidden="true"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="مثلاً ضمانت‌نامه، فروش، محصول یا حقوق" style={{width:'100%'}}/></div></label>
  <div aria-label="پیش‌نمایش آیکون‌های حساب" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,155px),1fr))',gap:8,marginBottom:18}}>
   {manualPermissionSections.filter(s=>matches(s.title)).map(s=>{
    const ownerOnly='ownerOnly' in s&&s.ownerOnly,enabled=!ownerOnly&&visible(s.key),Icon=s.icon;
    const target='group' in s?(s.group==='trace'?'trace-product':s.group):undefined;
    return <div key={s.key} data-section={s.key} data-access={ownerOnly?'admin-only':enabled?'visible':'hidden'} style={{border:'1px solid '+(enabled?'#a9d7c3':'var(--border)'),borderRadius:12,padding:10,background:enabled?'#edf8f2':'#f7f8fc',fontSize:13}}>
     {target?<a href={'#manual-'+target} aria-label={'تنظیم دسترسی '+s.title} style={{display:'flex',alignItems:'center',gap:7,minHeight:38,color:'inherit',textDecoration:'none'}}><Icon size={19} aria-hidden="true"/><strong>{s.title}</strong></a>:<div style={{display:'flex',alignItems:'center',gap:7,minHeight:38}}><Icon size={19} aria-hidden="true"/><strong>{s.title}</strong></div>}
     <span style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:enabled?'#176c44':'#67768f',marginTop:5}}>{ownerOnly?<><LockKeyhole size={13} aria-hidden="true"/>فقط مدیر سامانه</>:enabled?'نمایش دارد':'فعلاً نمایش ندارد'}</span>
    </div>;
   })}
  </div>
  <p className="subtle" style={{marginBottom:16}}>کارتابل، یادآور، درخواست توسعه و نصب روی گوشی برای حساب‌های مجاز مشترک‌اند. پرتال پرسنلی و اموال امانی برای کارکنان، فقط اطلاعات خود فرد را نشان می‌دهند؛ دسترسی مدیریتی آن‌ها جدا انتخاب می‌شود. تنظیمات سامانه و مدیریت حساب‌ها فقط برای ادمین می‌ماند.</p>
  {external&&<p className="notice">این حساب بیرونی است و فقط به پرونده نمایندگی یا مرکز خودش متصل می‌شود. برای انتخاب دسترسی شرکت، ابتدا انتخاب حساب بیرونی را بردارید.</p>}
  <div style={gridStyle}>
   {matchingGroup('sales','فروش و نمایندگان',internalSales)&&<AccessCard id="sales" title="فروش و نمایندگان" icon={Users} description="مدیریت فروش، ثبت سفارش، بررسی مالی فروش یا مشاهده گزارش را جدا انتخاب کنید. مدیر فروش، پوز و تطبیق دریافت‌ها و نظارت بر دو حوزه خدمات را نیز می‌بیند." disabled={external}>{choices('salesRoles',internalSales,'فروش')}</AccessCard>}
   {matchingGroup('treasury','خزانه‌داری و ضمانت‌نامه‌ها',treasuryRoles)&&<AccessCard id="treasury" title="خزانه‌داری و ضمانت‌نامه‌ها" icon={ClipboardCheck} description="اجرای پرداخت، بررسی مالی، کنترل حسابداری و مجوز نهایی مستقل‌اند. خزانه‌دار و مدیر مالی ضمانت‌نامه‌ها را نیز می‌بینند؛ خزانه‌دار پوز و تطبیق دریافت‌ها را می‌بیند." disabled={external}>{choices('treasuryWorkflowRoles',treasuryRoles,'خزانه‌داری')}</AccessCard>}
   {financialDomains.filter(d=>matchingGroup('financial-'+d.id,d.title)).map(d=><AccessCard key={d.id} id={'financial-'+d.id} title={d.title} icon={d.id==='transport'?Truck:ClipboardCheck} description={d.description} disabled={external}>
    <label style={{display:'flex',gap:9,alignItems:'center',padding:'7px 0'}}><input type="checkbox" style={checkboxStyle} aria-label={'مشاهده '+d.title} checked={(p.financialRead||[]).includes(d.id)} onChange={e=>onChange({...p,financialRead:e.target.checked?[...new Set([...(p.financialRead||[]),d.id])]:(p.financialRead||[]).filter(x=>x!==d.id),financialWrite:e.target.checked?p.financialWrite:(p.financialWrite||[]).filter(x=>x!==d.id)})}/>مشاهده</label>
    <label style={{display:'flex',gap:9,alignItems:'center',padding:'7px 0'}}><input type="checkbox" style={checkboxStyle} aria-label={'ثبت و بررسی '+d.title} checked={(p.financialWrite||[]).includes(d.id)} onChange={e=>onChange({...p,financialWrite:e.target.checked?[...new Set([...(p.financialWrite||[]),d.id])]:(p.financialWrite||[]).filter(x=>x!==d.id),financialRead:e.target.checked?[...new Set([...(p.financialRead||[]),d.id])]:p.financialRead})}/>ثبت و بررسی</label>
   </AccessCard>)}
   {matchingGroup('services','خدمات پس از فروش خانگی و بیمارستانی',internalServices)&&<AccessCard id="services" title="خدمات پس از فروش" icon={Wrench} description="ابتدا حوزه فعالیت و سپس کارهای مجاز را انتخاب کنید. مدیر خدمات، هر دو حوزه را برای نظارت می‌بیند؛ انجام عملیات فقط در حوزه‌های انتخاب‌شده مجاز است. فعالیت خدمات، بخش حمل‌ونقل مرتبط را نیز نمایش می‌دهد." disabled={external}>
    <div style={{borderBottom:'1px solid var(--border)',paddingBottom:8,marginBottom:8}}>{choices('serviceDomains',serviceDomains,'حوزه خدمات')}</div>{choices('serviceRoles',internalServices,'خدمات پس از فروش')}
   </AccessCard>}
   {matchingGroup('supply','برنامه تولید و تأمین',supplyRoles)&&<AccessCard id="supply" title="برنامه تولید و تأمین" icon={Truck} description="شروع درخواست، برنامه‌ریزی، بررسی موجودی، بررسی فنی، خرید داخلی یا خارجی و برنامه مالی را جدا انتخاب کنید. تصمیم‌گیر خرید، نظارت بر خدمات و پروژه‌های ساخت و پیشنهاد قیمت را نیز می‌بیند." disabled={external}>{choices('supplyRoles',supplyRoles,'تولید و تأمین')}</AccessCard>}
   {matchingGroup('flow','گردش مواد، تولید و ارسال',flowRoles)&&<AccessCard id="flow" title="گردش مواد، تولید و ارسال" icon={Factory} description="کارهای انبار، کنترل کیفیت، تولید، تأمین، فروش و تدارکات را جدا انتخاب کنید. تولید، کنترل کیفیت و مهندسی، کار روزانه و پروژه‌های ساخت مرتبط را نیز می‌بینند." disabled={external}>{choices('flowRoles',flowRoles,'گردش مواد')}
    {(p.flowRoles?.includes('inventory')||p.supplyRoles?.includes('inventory')||p.serviceRoles?.includes('inventory'))&&<fieldset style={{border:'1px solid var(--border)',borderRadius:8,padding:10,marginTop:12}}><legend>انبارهای تحت مسئولیت</legend>{warehouses.map(w=><label key={w.id} style={{display:'flex',gap:8,padding:6}}><input type="checkbox" style={checkboxStyle} aria-label={'دسترسی انبار '+w.name} checked={(p.warehouses??['raw','line','quarantine','nonconforming']).includes(w.id)} onChange={e=>onChange({...p,warehouses:e.target.checked?[...new Set([...(p.warehouses??['raw','line','quarantine','nonconforming']),w.id])]:(p.warehouses??['raw','line','quarantine','nonconforming']).filter(x=>x!==w.id)})}/>{w.name}</label>)}</fieldset>}
   </AccessCard>}
   {matchingGroup('transport','تدارکات و حمل‌ونقل',transportRoles)&&<AccessCard id="transport" title="تدارکات و حمل‌ونقل" icon={Truck} description="تخصیص و پیگیری مأموریت‌ها یا اجرای مأموریت‌های تخصیص‌یافته. دسترسی هزینه‌ها از کارت مالی حمل‌ونقل انتخاب می‌شود." disabled={external}>{choices('transportRoles',transportRoles,'حمل‌ونقل')}</AccessCard>}
   {matchingGroup('qms','کیفیت و تحقیق‌وتوسعه',qmsRoles)&&<AccessCard id="qms" title="کیفیت و تحقیق‌وتوسعه" icon={ShieldCheck} description="مسئولیت‌های کیفیت، مدارک، مجوزها، ممیزی و تجهیزات آزمون را انتخاب کنید. تحقیق و توسعه از کارت برنامه تولید و تأمین انتخاب می‌شود. تضمین یا کنترل کیفیت، بررسی محدودیت فنی خرید را نیز می‌بیند." disabled={external}>{choices('qmsRoles',qmsRoles,'کیفیت')}</AccessCard>}
   {matchingGroup('personnel','پرتال پرسنلی و حقوق',personnelRoles)&&<AccessCard id="personnel" title="پرتال پرسنلی و حقوق" icon={Users} description="کارکنان پرونده و درخواست‌های خود را می‌بینند. مدیریت پرونده همکاران، تهیه حقوق، تأیید یا پرداخت و گزارش‌ها نیازمند انتخاب مجوز مربوط است." disabled={external}>{choices('personnelRoles',personnelRoles,'پرسنلی')}</AccessCard>}
   {matchingGroup('assets','اموال شرکت و امانی من',assetRoles)&&<AccessCard id="assets" title="اموال شرکت و امانی من" icon={Box} description="کارکنان فقط اموال امانی خود را می‌بینند. اموال‌دار می‌تواند اموال شرکت، تحویل و بازپس‌گیری را ثبت و پیگیری کند." disabled={external}>{choices('assetRoles',assetRoles,'اموال')}</AccessCard>}
   {modules.filter(kind=>matchingGroup('trace-'+kind,names[kind])).map(kind=>{const section=manualPermissionSections.find(s=>s.key===kind)!;return <AccessCard key={kind} id={'trace-'+kind} title={section.title} icon={section.icon} description={traceHelp[kind]} disabled={external}>
    <label style={{display:'flex',gap:9,alignItems:'center',padding:'7px 0'}}><input type="checkbox" style={checkboxStyle} aria-label={'مشاهده '+names[kind]} checked={p.read.includes(kind)} onChange={e=>traceToggle(kind,'read',e.target.checked)}/>مشاهده</label>
    <label style={{display:'flex',gap:9,alignItems:'center',padding:'7px 0'}}><input type="checkbox" style={checkboxStyle} aria-label={'ثبت و ویرایش '+names[kind]} checked={p.write.includes(kind)} onChange={e=>traceToggle(kind,'write',e.target.checked)}/>ثبت و ویرایش مجاز</label>
    {kind==='event'&&p.write.includes('event')&&<fieldset style={{border:'1px solid var(--border)',borderRadius:8,padding:10,marginTop:10}}><legend>مراحل مجاز ثبت</legend>{stages.map(stage=><label key={stage} style={{display:'flex',gap:8,padding:6}}><input type="checkbox" style={checkboxStyle} aria-label={'ثبت مرحله '+stage} checked={p.eventStages.includes(stage)} onChange={e=>onChange({...p,eventStages:e.target.checked?[...new Set([...p.eventStages,stage])]:p.eventStages.filter(s=>s!==stage)})}/>{stage}</label>)}</fieldset>}
    {['event','service','action','distribution','device'].includes(kind)&&<p className="subtle" style={{fontSize:12,marginTop:10}}>انتخاب ثبت، مشاهده اطلاعات پایه موردنیاز دستگاه، بچ یا محصول را نیز فعال می‌کند؛ نتیجه را در آیکون‌های بالا ببینید.</p>}
   </AccessCard>;})}
   {matches('نماینده فروش نماینده خدمات حساب بیرونی')&&<AccessCard id="external" title="حساب نمایندگی بیرونی" icon={Users} description="انتخاب نمایندگی، دسترسی‌های عمومی شرکت را جایگزین می‌کند. حساب نماینده فقط پرونده، موجودی و حساب خودش را می‌بیند؛ با مجوز داخلی ترکیب نمی‌شود.">
    {p.hospitalCenterId?<p className="subtle">این حساب به یک مرکز بیمارستانی متصل است. اتصال مرکز از بخش مراکز مدیریت می‌شود.</p>:<>
     <label style={{display:'flex',gap:9,alignItems:'center',padding:'7px 0'}}><input type="checkbox" style={checkboxStyle} aria-label="حساب بیرونی نماینده فروش" checked={!!p.salesRoles?.includes('agent')} onChange={e=>selectExternal('sales',e.target.checked)}/>نماینده فروش</label>
     <label style={{display:'flex',gap:9,alignItems:'center',padding:'7px 0'}}><input type="checkbox" style={checkboxStyle} aria-label="حساب بیرونی نماینده خدمات" checked={!!p.serviceRoles?.includes('agent')} onChange={e=>selectExternal('service',e.target.checked)}/>نماینده خدمات</label>
     {p.salesRoles?.includes('agent')&&<label className="field" style={{marginTop:10}}>نمایندگی فروش<select required value={p.salesAgentId||''} onChange={e=>onChange({...p,salesAgentId:e.target.value})}><option value="">انتخاب نماینده فعال</option>{salesAgents.filter(a=>a.data.active).map(a=><option key={a.id} value={a.id}>{a.data.name}</option>)}</select></label>}
     {p.serviceRoles?.includes('agent')&&<label className="field" style={{marginTop:10}}>نمایندگی خدمات<select required value={p.serviceAgentId||''} onChange={e=>{const agent=serviceAgents.find(a=>a.id===e.target.value);onChange({...p,serviceAgentId:e.target.value,serviceDomains:agent?[agent.data.domain]:[]});}}><option value="">انتخاب نماینده فعال</option>{serviceAgents.filter(a=>a.data.active).map(a=><option key={a.id} value={a.id}>{a.data.name} · {serviceDomains[a.data.domain]}</option>)}</select></label>}
    </>}
   </AccessCard>}
  </div>
  {error&&<p className="notice error" role="status" style={{marginTop:14}}>{error}</p>}
  <p className="subtle" style={{marginTop:14}}>تیک مشاهده و ثبت مستقل است. هر اختیار فقط در دامنه انتخاب‌شده اعمال می‌شود؛ تأییدهای مستقل، حدود پرونده و انبار و ثبت سابقه عملیات همچنان رعایت می‌شوند.</p>
 </section>;
}
