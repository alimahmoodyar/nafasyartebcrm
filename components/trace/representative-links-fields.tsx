'use client';

type Choice={id:string;revision:number;name:string;domain?:string;code?:string;kind?:string;linkedSalesAgentId?:string};
type Props={origin:'sales'|'service';value:any;onChange:(value:any)=>void;serviceDomains?:string[];serviceChoices?:Choice[];salesChoices?:Choice[];canLinkSales?:boolean;disabled?:boolean};
const domains:Record<string,string>={home:'خدمات خانگی',hospital:'خدمات بیمارستانی'};
const box={width:18,height:18,padding:0,flexShrink:0,accentColor:'#16804a'};
const linkKeys=['salesRepresentation','serviceRepresentation','serviceDomain','linkedServiceAgentId','linkedServiceRevision','serviceCode','linkedSalesAgentId','linkedSalesRevision'];
/** Hide relationship mutations on ordinary edits by users without both scopes. */
export function representativeLinkPayload(value:any,origin:'sales'|'service',canLink:boolean){
 if('linkedServiceAgents' in value||'linkedSalesAgent' in value)value=Object.fromEntries(Object.entries(value).filter(([key])=>!['linkedServiceAgents','linkedSalesAgent'].includes(key)));
 if(canLink)return value;
 return Object.fromEntries(Object.entries(value).filter(([key])=>!linkKeys.includes(key)));
}
export function RepresentativeLinksFields({origin,value,onChange,serviceDomains=[],serviceChoices=[],salesChoices=[],canLinkSales=false,disabled=false}:Props){
 const isSales=origin==='sales',sales=isSales?true:(value.salesRepresentation??(!!value.linkedSalesAgent||!!value.linkedSalesAgentId)),service=isSales?(value.serviceRepresentation??!!value.linkedServiceAgents?.length):true;
 const canLink=isSales?!!serviceDomains.length:canLinkSales;
 const canUnlinkAll=!isSales||(value.linkedServiceAgents||[]).every((a:any)=>serviceDomains.includes(a.domain));
 const domain=value.serviceDomain||value.linkedServiceAgents?.[0]?.domain||serviceDomains[0]||'home';
 const locked=disabled||!canLink||isSales&&!serviceDomains.includes(domain);
 const selected=isSales?(value.linkedServiceAgentId??value.linkedServiceAgents?.find((a:any)=>a.domain===domain)?.id??''):(value.linkedSalesAgentId??value.linkedSalesAgent?.id??'');
 const options=isSales?serviceChoices.filter(a=>a.domain===domain&&(!a.linkedSalesAgentId||a.linkedSalesAgentId===value.agentId||a.id===selected)):salesChoices;
 const choose=(id:string)=>{const found=options.find(a=>a.id===id);onChange({...value,...(isSales?{serviceDomain:domain,linkedServiceAgentId:id,linkedServiceRevision:found?.revision}: {linkedSalesAgentId:id,linkedSalesRevision:found?.revision})});};
 return <fieldset className="wide" style={{border:'1px solid var(--border)',borderRadius:12,padding:16,minWidth:0}}><legend>نوع نمایندگی و اتصال پرونده‌ها</legend>
  <div style={{display:'flex',flexWrap:'wrap',gap:24,marginBottom:12}}>
   <label style={{display:'flex',alignItems:'center',gap:8}}><input aria-label="نمایندگی فروش" type="checkbox" style={box} checked={!!sales} disabled={disabled||isSales||!canLink} onChange={e=>onChange({...value,salesRepresentation:e.target.checked,...(!e.target.checked?{linkedSalesAgentId:'',linkedSalesRevision:undefined}:{})})}/>نمایندگی فروش</label>
   <label style={{display:'flex',alignItems:'center',gap:8}}><input aria-label="نمایندگی خدمات" type="checkbox" style={box} checked={!!service} disabled={disabled||!isSales||!canLink||!!service&&!canUnlinkAll} onChange={e=>onChange({...value,serviceRepresentation:e.target.checked,...(e.target.checked?{serviceDomain:domain}:{})})}/>نمایندگی خدمات</label>
  </div>
  <p className="subtle">{isSales?'این پرونده در فروش ثبت می‌شود. اگر نمایندگی خدمات هم دارد، پرونده همان نمایندگی را متصل کنید یا پرونده جدید بسازید.':'این پرونده در خدمات ثبت می‌شود. اگر نمایندگی فروش هم دارد، پرونده فروش موجود را انتخاب کنید.'}</p>
  {(isSales?service:sales)&&<div className="formgrid">
   {isSales&&<label className="field">حوزه خدمات<select aria-label="حوزه خدمات" required disabled={disabled||!canLink} value={domain} onChange={e=>{const existing=value.linkedServiceAgents?.find((a:any)=>a.domain===e.target.value);onChange({...value,serviceDomain:e.target.value,linkedServiceAgentId:existing?.id||'',linkedServiceRevision:existing?.revision,serviceCode:''});}}>{!serviceDomains.includes(domain)&&<option value={domain}>{domains[domain]||domain} — اتصال قبلی</option>}{serviceDomains.map(d=><option key={d} value={d}>{domains[d]||d}</option>)}</select></label>}
   <label className="field">{isSales?'پرونده خدمات':'پرونده فروش موجود'}<select aria-label={isSales?'پرونده خدمات':'پرونده فروش موجود'} value={selected} required={!isSales} disabled={locked} onChange={e=>choose(e.target.value)}><option value="">{isSales?'ساخت پرونده جدید خدمات':'انتخاب پرونده فروش'}</option>{selected&&!options.some(a=>a.id===selected)&&<option value={selected}>{(isSales?value.linkedServiceAgents?.find((a:any)=>a.id===selected):value.linkedSalesAgent)?.name||'پرونده متصل قبلی'}</option>}{options.map(a=><option key={a.id} value={a.id}>{a.name}{a.code?' · '+a.code:''}</option>)}</select></label>
   {isSales&&!selected&&<label className="field">کد نمایندگی خدمات<input aria-label="کد نمایندگی خدمات" required maxLength={80} disabled={locked} value={value.serviceCode||''} onChange={e=>onChange({...value,serviceCode:e.target.value})}/></label>}
  </div>}
  {!canLink&&<p className="subtle">تغییر اتصال به دسترسی مدیریت فروش و مدیریت حوزه خدمات مربوط نیاز دارد. اتصال قبلی حفظ می‌شود.</p>}
  {canLink&&isSales&&service&&!canUnlinkAll&&<p className="subtle">برداشتن تیک خدمات به اختیار مدیریت همه حوزه‌های متصل نیاز دارد؛ می‌توانید اتصال حوزه مجاز خود را ویرایش کنید.</p>}
  {isSales&&value.linkedServiceAgents?.length>1&&<p className="subtle">اتصال‌های موجود: {value.linkedServiceAgents.map((a:any)=>(domains[a.domain]||a.domain)+' — '+a.name).join('؛ ')}. تغییر انتخاب، اتصال همان حوزه را ویرایش می‌کند؛ برداشتن تیک خدمات همه اتصال‌های خدمات را جدا می‌کند.</p>}
  <small className="subtle">اتصال پرونده‌ها سوابق را کنار هم قرار می‌دهد؛ حساب ورود خدمات و دسترسی‌های فرد جداگانه تنظیم می‌شوند.</small>
 </fieldset>;
}
