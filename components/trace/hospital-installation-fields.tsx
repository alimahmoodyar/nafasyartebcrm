'use client';
import {NumberInput} from './number-input';
import {SolarDate} from './solar-date';
import {addSolarMonths} from '@/lib/sales-payment-terms';
import {formatDate,localDay,isIsoDay} from '@/lib/persian-date';
import {hospitalModelKey} from '@/lib/hospital-service-model';
import {hospitalWarrantyActive} from '@/lib/hospital-coverage';
export const blankHospitalService=()=>({intervalHours:'',lines:[{partCode:'',technicalCode:'',quantity:1}]});
export const blankHospitalInstallation=()=>({productId:'',serial:'',installedOn:'',projectId:'',warrantyStatus:'',warrantyStart:'',warrantyMonths:'',contractStatus:'',contractFrom:'',contractUntil:'',services:[blankHospitalService()]});
export function HospitalInstallationFields({value,products,projects=[],catalog,locked,onChange}:{value:any;products:any[];projects?:any[];catalog:any;locked:boolean;onChange:(value:any)=>void}){
 const set=(k:string,v:any)=>onChange({...value,[k]:v}),parts=catalog?.parts||[],kits=catalog?.kits||[],plans=value.services||[blankHospitalService()];
 const until=value.warrantyStatus==='yes'&&isIsoDay(value.warrantyStart)&&Number(value.warrantyMonths)>0?addSolarMonths(value.warrantyStart,Number(value.warrantyMonths)):'';
 const today=localDay(),needsContract=value.warrantyStatus==='no'||!!until&&!hospitalWarrantyActive({...value,warrantyUntil:until},today);
 function updatePlan(i:number,key:string,v:any){set('services',plans.map((p:any,j:number)=>i===j?{...p,[key]:v}:p));}
 function updatePart(i:number,j:number,key:string,v:any){updatePlan(i,'lines',plans[i].lines.map((p:any,k:number)=>j===k?{...p,[key]:v}:p));}
 function chooseProduct(productId:string){const matches=(catalog?.devicePlans||[]).filter((p:any)=>p.productId===productId&&(p.compressorQuantity||1)===(Number(value.compressorQuantity)||1)),first=matches[0];const same=first&&matches.every((p:any)=>JSON.stringify(p.services)===JSON.stringify(first.services));onChange({...value,productId,projectId:'',warrantyStatus:'',warrantyMonths:'',services:same?structuredClone(first.services):[blankHospitalService()]});}
 function reuseCompressor(model:string){const matching=kits.filter((k:any)=>k.data.active&&k.data.modelKey===hospitalModelKey(model));const profiles=(catalog?.devicePlans||[]).filter((p:any)=>p.productId===value.productId&&(p.compressorQuantity||1)===(Number(value.compressorQuantity)||1)&&hospitalModelKey(p.compressorModel)===hospitalModelKey(model));const one=profiles[0],same=one&&profiles.every((p:any)=>JSON.stringify(p.services)===JSON.stringify(one.services));onChange({...value,compressorModel:model,services:same?structuredClone(one.services):matching.length?matching.map((k:any)=>({intervalHours:k.data.intervalHours,lines:k.data.lines.map((l:any)=>({...l,quantity:l.quantity*(Number(value.compressorQuantity)||1)}))})):plans});}
 return <section className="hospital-installation field wide">
  <div className="hospital-installation-grid">
   <label className="field">مدل / محصول دستگاه<select required disabled={locked&&!!value.productId} value={value.productId||''} onChange={e=>chooseProduct(e.target.value)}><option value="">انتخاب محصول بیمارستانی</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} · {p.model}</option>)}</select></label>
   <label className="field">سریال دستگاه<NumberInput required readOnly={locked} fieldKey="serial" value={value.serial||''} onChange={e=>set('serial',e.target.value)}/></label>
   <label className="field">گارانتی دارد؟<select required disabled={!!value.projectId} value={value.warrantyStatus||''} onChange={e=>onChange({...value,warrantyStatus:e.target.value,warrantyMonths:e.target.value==='no'?0:''})}><option value="">انتخاب کنید</option><option value="yes">دارد</option><option value="no">ندارد</option></select></label>
   {value.warrantyStatus==='yes'&&<><SolarDate label="شروع گارانتی" value={value.warrantyStart||''} onChange={v=>set('warrantyStart',v)}/><label className="field">مدت گارانتی، ماه<NumberInput required readOnly={!!value.projectId} type="number" min={1} max={120} step={1} value={value.warrantyMonths??''} onChange={e=>set('warrantyMonths',e.target.value)}/></label></>}
  </div>
  {until&&<p className="subtle">پایان گارانتی: {formatDate(until)}{until<today?' — پایان یافته':value.warrantyStart>today?' — هنوز شروع نشده':''}</p>}
  {needsContract&&<div className="hospital-installation-grid">
   <label className="field">قرارداد خدمات دارد؟<select required={needsContract} value={value.contractStatus||''} onChange={e=>onChange({...value,contractStatus:e.target.value,contractFrom:e.target.value==='yes'?value.contractFrom:'',contractUntil:e.target.value==='yes'?value.contractUntil:''})}><option value="">انتخاب کنید</option><option value="yes">دارد</option><option value="no">ندارد</option></select></label>
   {value.contractStatus==='yes'&&<><SolarDate label="شروع قرارداد خدمات" value={value.contractFrom||''} onChange={v=>set('contractFrom',v)}/><SolarDate label="پایان قرارداد خدمات" value={value.contractUntil||''} onChange={v=>set('contractUntil',v)}/></>}
  </div>}
  <strong>سرویس‌ها و قطعات مصرفی</strong>
  {plans.map((p:any,i:number)=><section className="hospital-plan" key={i} aria-label={'سرویس '+(i+1)}>
   <div className="hospital-plan-heading"><label className="field">هر چند ساعت کارکرد؟<NumberInput aria-label={'بازه سرویس '+(i+1)} required type="number" min={1} max={100000} step={1} value={p.intervalHours} onChange={e=>updatePlan(i,'intervalHours',e.target.value)}/></label>{plans.length>1&&<button type="button" className="btn" aria-label={'حذف سرویس '+(i+1)} onClick={()=>set('services',plans.filter((_:any,j:number)=>j!==i))}>حذف سرویس</button>}</div>
   {p.lines.map((l:any,j:number)=><div className="hospital-consumable-row" key={j}>
    <select aria-label={'کالا سرویس '+(i+1)+' ردیف '+(j+1)} required value={l.partCode} onChange={e=>updatePart(i,j,'partCode',e.target.value)}><option value="">کالا / کد کالا</option>{parts.filter((p:any)=>p.unit==='عدد').map((p:any)=><option key={p.code} value={p.code}>{p.name} · {p.code}</option>)}</select>
    <input aria-label={'کد فنی سرویس '+(i+1)+' ردیف '+(j+1)} required placeholder="کد فنی" value={l.technicalCode||''} onChange={e=>updatePart(i,j,'technicalCode',e.target.value)}/>
    <NumberInput aria-label={'تعداد سرویس '+(i+1)+' ردیف '+(j+1)} title="تعداد کل برای یک سرویس دستگاه" required type="number" min={1} max={10000} step={1} value={l.quantity??1} onChange={e=>updatePart(i,j,'quantity',e.target.value)}/>
    <button type="button" className="btn" aria-label={'حذف کالا سرویس '+(i+1)+' ردیف '+(j+1)} disabled={p.lines.length===1} onClick={()=>updatePlan(i,'lines',p.lines.filter((_:any,k:number)=>j!==k))}>×</button>
   </div>)}
   <button type="button" className="btn" disabled={p.lines.length>=50} onClick={()=>updatePlan(i,'lines',[...p.lines,{partCode:'',technicalCode:'',quantity:1}])}>افزودن قطعه</button>
  </section>)}
  <div><button type="button" className="btn" disabled={plans.length>=12} onClick={()=>set('services',[...plans,{intervalHours:'',lines:structuredClone(plans[0].lines)}])}>افزودن بازه سرویس</button></div>
  <small className="subtle">تعداد، کل مصرف یک سرویس همین دستگاه است. فهرست سرویس بزرگ را کامل وارد کنید؛ قطعات دوره کوچک‌تر هم در آن باشند.</small>
  <details><summary>اطلاعات تکمیلی، پروژه و مبنای پایش (اختیاری)</summary><div className="hospital-installation-grid">
   {projects.length>0&&<label className="field">پروژه / قرارداد موجود<select value={value.projectId||''} onChange={e=>{const p=projects.find(p=>p.id===e.target.value);onChange({...value,projectId:e.target.value,warrantyMonths:p?.warrantyMonths??'',warrantyStatus:p?.warrantyMonths==null?'':p.warrantyMonths>0?'yes':'no'});}}><option value="">ثبت دستی توافق همین بیمارستان</option>{projects.filter(p=>!p.productIds?.length||p.productIds.includes(value.productId)).map(p=><option key={p.id} value={p.id}>{p.title} · {p.customer} · {p.contractNumber}</option>)}</select></label>}
   <SolarDate label="تاریخ نصب" required={false} value={value.installedOn||''} onChange={v=>set('installedOn',v)}/>
   <label className="field">مدل کمپرسور<input list="hospital-compressor-models" value={value.compressorModel||''} onChange={e=>{if(kits.some((k:any)=>k.data.active&&hospitalModelKey(k.data.componentModel)===hospitalModelKey(e.target.value)))reuseCompressor(e.target.value);else set('compressorModel',e.target.value)}}/><datalist id="hospital-compressor-models">{[...new Set<string>(kits.filter((k:any)=>k.data.active).map((k:any)=>k.data.componentModel))].map(m=><option key={m} value={m}/>)}</datalist></label>
   {['generatorModel','dryerModel'].map((k,i)=><label className="field" key={k}>{i===0?'مدل مولد':'مدل درایر'}<input value={value[k]||''} onChange={e=>set(k,e.target.value)}/></label>)}
   <label className="field">تعداد کمپرسور<NumberInput type="number" min={1} max={10000} value={value.compressorQuantity??1} onChange={e=>set('compressorQuantity',Number(e.target.value))}/></label>
   <label className="field">ساعت مبنای شروع برنامه سرویس<NumberInput type="number" min={0} max={10000000} value={value.baselineHours??''} onChange={e=>set('baselineHours',e.target.value)}/></label>
   <SolarDate label="تاریخ مبنای برنامه سرویس" required={value.baselineHours!==undefined&&value.baselineHours!==''} value={value.baselineDay||''} onChange={v=>set('baselineDay',v)}/>
  </div><small>بدون مبنای معتبر، ساعت یا سابقه سرویس فرضی ساخته نمی‌شود؛ درخواست دستی همچنان قابل ثبت است. فهرست قبلی کمپرسور، در صورت وجود، با تعداد کل دستگاه فراخوانی می‌شود.</small></details>
 </section>;
}
